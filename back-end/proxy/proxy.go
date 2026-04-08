package main

import (
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
	Enabled     bool    `json:"enabled"`
	FailureRate float64 `json:"failureRate"` // 0.0 to 1.0
	DelayRate   float64 `json:"delayRate"`   // 0.0 to 1.0
	MinDelayMs  int     `json:"minDelayMs"`
	MaxDelayMs  int     `json:"maxDelayMs"`
	ErrorCodes  []int   `json:"errorCodes"` // e.g., [403, 404, 500, 502, 503]
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

// --- Middleware & Chaos Logic ---

func chaosMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// --- ADD THESE 3 LINES FOR REACT TO WORK ---
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		// Handle preflight OPTIONS requests immediately
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		route := normalizeRoute(r.URL.Path)

		state.mu.Lock()
		// 1. Check if path is excluded
		isExcluded := false
		for _, excludedPath := range state.ExcludedPaths {
			if strings.HasPrefix(r.URL.Path, excludedPath) {
				isExcluded = true
				break
			}
		}

		// Register route if not excluded
		if !isExcluded {
			state.Discovered[route] = true
			if _, exists := state.Configs[route]; !exists {
				// Default safe config
				state.Configs[route] = &RouteConfig{
					Enabled:     false,
					FailureRate: 0.0,
					DelayRate:   0.0,
					MinDelayMs:  0,
					MaxDelayMs:  0,
					ErrorCodes:  []int{500},
				}
			}
		}

		// Grab a copy of the config so we can unlock quickly
		var config *RouteConfig
		if state.Configs[route] != nil {
			// Shallow copy to prevent race conditions during chaos execution
			confCopy := *state.Configs[route]
			config = &confCopy
		}
		state.mu.Unlock()

		// 2. Bypass chaos if excluded or disabled
		if isExcluded || config == nil || !config.Enabled {
			log.Printf("➡️ PROXIED: %s %s", r.Method, r.URL.Path)
			next.ServeHTTP(w, r)
			return
		}

		// 3. Apply Delay Chaos
		if config.DelayRate > 0 && rand.Float64() < config.DelayRate {
			delay := config.MinDelayMs
			if config.MaxDelayMs > config.MinDelayMs {
				delay += rand.Intn(config.MaxDelayMs - config.MinDelayMs)
			}
			if delay > 0 {
				log.Printf("⏳ CHAOS DELAY: %s %s sleeping for %dms", r.Method, route, delay)
				time.Sleep(time.Duration(delay) * time.Millisecond)
			}
		}

		// 4. Apply Failure Chaos
		if config.FailureRate > 0 && rand.Float64() < config.FailureRate {
			// Pick a random error code from the allowed list
			errorCode := http.StatusInternalServerError
			if len(config.ErrorCodes) > 0 {
				errorCode = config.ErrorCodes[rand.Intn(len(config.ErrorCodes))]
			}

			log.Printf("💥 CHAOS HIT: %s %s -> %d", r.Method, route, errorCode)
			http.Error(w, "Chaos Injected: "+http.StatusText(errorCode), errorCode)
			return // Stop processing, do not forward to backend
		}

		// 5. Forward to Backend (if it survived)
		log.Printf("⚠️ CHAOS SURVIVED: %s %s", r.Method, route)
		next.ServeHTTP(w, r)
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
