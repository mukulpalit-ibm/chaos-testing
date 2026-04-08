package main

import (
	"bytes"
	"encoding/json"
	"log"
	"math/rand"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"sync"
	"time"
)

// --- State Management ---

type RouteConfig struct {
	Enabled        bool    `json:"enabled"`
	FailureRate    float64 `json:"failureRate"`
	DelayRate      float64 `json:"delayRate"`
	MinDelayMs     int     `json:"minDelayMs"`
	MaxDelayMs     int     `json:"maxDelayMs"`
	ErrorCodes     []int   `json:"errorCodes"`
	TargetHeader   string  `json:"targetHeader"`   // e.g., "X-User-Tier"
	TargetValue    string  `json:"targetValue"`    // e.g., "free"
	CorruptionRate float64 `json:"corruptionRate"` // 0.0 to 1.0
}

type ChaosState struct {
	mu            sync.RWMutex
	Discovered    map[string]bool
	Configs       map[string]*RouteConfig
	ExcludedPaths []string `json:"excludedPaths"`
}

var state = &ChaosState{
	Discovered: make(map[string]bool),
	Configs:    make(map[string]*RouteConfig),
	// Hardcode internal proxy paths and backend health checks to never fail
	ExcludedPaths: []string{"/health", "/chaos/config", "/chaos/routes"},
}

// normalizeRoute simplifies paths (e.g., /users/123 -> /users/:id) to prevent state bloat
func normalizeRoute(path string) string {
	if strings.HasPrefix(path, "/users/") {
		return "/users/:id"
	}
	return path
}

// responseInterceptor catches the backend response so we can modify it
type responseInterceptor struct {
	http.ResponseWriter
	body       *bytes.Buffer
	statusCode int
}

func (w *responseInterceptor) WriteHeader(statusCode int) {
	w.statusCode = statusCode
}

func (w *responseInterceptor) Write(b []byte) (int, error) {
	return w.body.Write(b)
}

// corruptJSON recursively traverses JSON and randomly breaks values
func corruptJSON(body []byte) []byte {
	var data interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return body // If it's not valid JSON, leave it alone
	}

	var corrupt func(val interface{}) interface{}
	corrupt = func(val interface{}) interface{} {
		switch v := val.(type) {
		case string:
			return v + "-CORRUPTED"
		case float64:
			return v * -1 // Make prices/IDs negative!
		case bool:
			return !v // Flip true to false
		case map[string]interface{}:
			for k, child := range v {
				// 40% chance to corrupt any specific field in an object
				if rand.Float64() < 0.4 {
					v[k] = corrupt(child)
				}
			}
			return v
		case []interface{}:
			for i, child := range v {
				if rand.Float64() < 0.4 {
					v[i] = corrupt(child)
				}
			}
			return v
		default:
			return v
		}
	}

	corruptedData := corrupt(data)
	newBody, _ := json.Marshal(corruptedData)
	return newBody
}

func chaosMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// [KEEP YOUR CORS HEADERS HERE]
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Chaos-Target") // Added custom header to allowed list

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		route := normalizeRoute(r.URL.Path)

		// [KEEP YOUR EXCLUSION & DISCOVERY LOGIC HERE]
		state.mu.Lock()
		isExcluded := false
		for _, excludedPath := range state.ExcludedPaths {
			if strings.HasPrefix(r.URL.Path, excludedPath) {
				isExcluded = true
				break
			}
		}

		if !isExcluded {
			state.Discovered[route] = true
			if _, exists := state.Configs[route]; !exists {
				state.Configs[route] = &RouteConfig{Enabled: false}
			}
		}

		var config *RouteConfig
		if state.Configs[route] != nil {
			confCopy := *state.Configs[route]
			config = &confCopy
		}
		state.mu.Unlock()

		// Bypass chaos if disabled or excluded
		if isExcluded || config == nil || !config.Enabled {
			next.ServeHTTP(w, r)
			return
		}

		// --- NEW: BLAST RADIUS CHECK ---
		if config.TargetHeader != "" {
			if r.Header.Get(config.TargetHeader) != config.TargetValue {
				log.Printf("🛡️ CHAOS BYPASSED: Header mismatch for %s", route)
				next.ServeHTTP(w, r)
				return
			}
		}

		// --- DELAY & FAILURE LOGIC (Unchanged) ---
		if config.DelayRate > 0 && rand.Float64() < config.DelayRate {
			delay := config.MinDelayMs
			if config.MaxDelayMs > config.MinDelayMs {
				delay += rand.Intn(config.MaxDelayMs - config.MinDelayMs)
			}
			if delay > 0 {
				log.Printf("⏳ CHAOS DELAY: %s sleeping for %dms", route, delay)
				time.Sleep(time.Duration(delay) * time.Millisecond)
			}
		}

		if config.FailureRate > 0 && rand.Float64() < config.FailureRate {
			errorCode := 500
			if len(config.ErrorCodes) > 0 {
				errorCode = config.ErrorCodes[rand.Intn(len(config.ErrorCodes))]
			}
			log.Printf("💥 CHAOS HIT: %s -> %d", route, errorCode)
			http.Error(w, "Chaos Injected: "+http.StatusText(errorCode), errorCode)
			return
		}

		// --- NEW: PAYLOAD TAMPERING ---
		// We survived the hard failures! Now we intercept the response to corrupt it.
		interceptor := &responseInterceptor{
			ResponseWriter: w,
			body:           &bytes.Buffer{},
			statusCode:     200, // Default assume OK
		}

		// Forward to backend, but write into our interceptor instead of directly to client
		next.ServeHTTP(interceptor, r)

		finalBody := interceptor.body.Bytes()

		// Apply Corruption if it's a successful JSON response
		if interceptor.statusCode >= 200 && interceptor.statusCode < 300 {
			if config.CorruptionRate > 0 && rand.Float64() < config.CorruptionRate {
				log.Printf("🦠 PAYLOAD CORRUPTED: %s", route)
				finalBody = corruptJSON(finalBody)
			}
		}

		// Write the final headers and body back to the real client
		w.WriteHeader(interceptor.statusCode)
		w.Write(finalBody)
	})
}

// --- Control API Handlers ---

func handleRoutes(w http.ResponseWriter, r *http.Request) {
	state.mu.RLock()
	defer state.mu.RUnlock()

	// Format as requested in the plan
	var routes []map[string]string
	for route := range state.Discovered {
		routes = append(routes, map[string]string{"method": "ANY", "path": route})
	}

	json.NewEncoder(w).Encode(routes)
}

func handleConfig(w http.ResponseWriter, r *http.Request) {
	state.mu.Lock()
	defer state.mu.Unlock()

	if r.Method == http.MethodGet {
		json.NewEncoder(w).Encode(state.Configs)
		return
	}

	if r.Method == http.MethodPut {
		var newConfigs map[string]*RouteConfig
		if err := json.NewDecoder(r.Body).Decode(&newConfigs); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}

		// Update existing configs
		for route, config := range newConfigs {
			state.Configs[route] = config
		}
		json.NewEncoder(w).Encode(map[string]string{"status": "updated"})
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

// corsMiddleware is a quick hackathon-grade CORS implementation for the React app
func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*") // Fine for local dev
		w.Header().Set("Access-Control-Allow-Methods", "GET, PUT, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next(w, r)
	}
}

func main() {
	// Setup Reverse Proxy to target our Backend on :4000
	backendURL, _ := url.Parse("http://localhost:4000")
	proxy := httputil.NewSingleHostReverseProxy(backendURL)

	mux := http.NewServeMux()

	// Control API Routes (Wrapped in CORS)
	mux.HandleFunc("/chaos/routes", corsMiddleware(handleRoutes))
	mux.HandleFunc("/chaos/config", corsMiddleware(handleConfig))

	// Catch-all route for proxying (Wrapped in Chaos Middleware)
	mux.Handle("/", chaosMiddleware(proxy))

	log.Println("😈 Chaos Proxy running on http://localhost:3999")
	if err := http.ListenAndServe(":3999", mux); err != nil {
		log.Fatalf("Proxy failed to start: %v", err)
	}
}
