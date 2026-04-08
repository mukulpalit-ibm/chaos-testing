package main

import (
	"bytes"
	"chaos-testing/back-end/proxy/llm"
	"encoding/json"
	"fmt"
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

// RouteMetrics tracks statistics per route
type RouteMetrics struct {
	RequestCount int       `json:"requestCount"`
	TotalLatency int64     `json:"totalLatency"`
	ErrorCount   int       `json:"errorCount"`
	LastSeen     time.Time `json:"lastSeen"`
}

// RequestLog stores individual request details
type RequestLog struct {
	ID        string  `json:"id"`
	Timestamp int64   `json:"timestamp"`
	Route     string  `json:"route"`
	Method    string  `json:"method"`
	Status    int     `json:"status"`
	Latency   int64   `json:"latency"`
	ChaosType *string `json:"chaosType,omitempty"`
}

type ChaosState struct {
	mu            sync.RWMutex
	Discovered    map[string]bool
	Configs       map[string]*RouteConfig
	ExcludedPaths []string `json:"excludedPaths"`
	// Metrics tracking
	TotalRequests   int
	ChaosRequests   int
	SuccessRequests int
	TotalLatency    int64
	RouteMetrics    map[string]*RouteMetrics
	// Request logging
	RequestLogs      []RequestLog
	requestIDCounter int
}

var state = &ChaosState{
	Discovered:   make(map[string]bool),
	Configs:      make(map[string]*RouteConfig),
	RouteMetrics: make(map[string]*RouteMetrics),
	RequestLogs:  make([]RequestLog, 0, 100),
	// Hardcode internal proxy paths and backend health checks to never fail
	ExcludedPaths: []string{"/health", "/chaos/config", "/chaos/routes", "/chaos/metrics", "/chaos/requests", "/chaos/analyze"},
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
		startTime := time.Now()

		// [KEEP YOUR CORS HEADERS HERE]
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Chaos-Target")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		route := normalizeRoute(r.URL.Path)

		// [EXCLUSION & DISCOVERY LOGIC]
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
			// Initialize route metrics if needed
			if state.RouteMetrics[route] == nil {
				state.RouteMetrics[route] = &RouteMetrics{}
			}
		}

		var config *RouteConfig
		if state.Configs[route] != nil {
			confCopy := *state.Configs[route]
			config = &confCopy
		}
		state.mu.Unlock()

		// Track chaos type for logging
		var chaosType *string
		chaosInjected := false

		// Bypass chaos if disabled or excluded
		if isExcluded {
			next.ServeHTTP(w, r)
			return
		}

		if config == nil || !config.Enabled {
			// Still track the request even if chaos is disabled
			interceptor := &responseInterceptor{
				ResponseWriter: w,
				body:           &bytes.Buffer{},
				statusCode:     200,
			}
			next.ServeHTTP(interceptor, r)

			// Log request
			latency := time.Since(startTime).Milliseconds()
			logRequest(route, r.Method, interceptor.statusCode, latency, nil)

			// Update metrics
			updateMetrics(route, latency, interceptor.statusCode, false)

			// Write response
			w.WriteHeader(interceptor.statusCode)
			w.Write(interceptor.body.Bytes())
			return
		}

		// --- BLAST RADIUS CHECK ---
		if config.TargetHeader != "" {
			if r.Header.Get(config.TargetHeader) != config.TargetValue {
				log.Printf("🛡️ CHAOS BYPASSED: Header mismatch for %s", route)

				interceptor := &responseInterceptor{
					ResponseWriter: w,
					body:           &bytes.Buffer{},
					statusCode:     200,
				}
				next.ServeHTTP(interceptor, r)

				latency := time.Since(startTime).Milliseconds()
				logRequest(route, r.Method, interceptor.statusCode, latency, nil)
				updateMetrics(route, latency, interceptor.statusCode, false)

				w.WriteHeader(interceptor.statusCode)
				w.Write(interceptor.body.Bytes())
				return
			}
		}

		// --- DELAY INJECTION ---
		if config.DelayRate > 0 && rand.Float64() < config.DelayRate {
			delay := config.MinDelayMs
			if config.MaxDelayMs > config.MinDelayMs {
				delay += rand.Intn(config.MaxDelayMs - config.MinDelayMs)
			}
			if delay > 0 {
				log.Printf("⏳ CHAOS DELAY: %s sleeping for %dms", route, delay)
				time.Sleep(time.Duration(delay) * time.Millisecond)
				chaosTypeStr := "latency"
				chaosType = &chaosTypeStr
				chaosInjected = true
			}
		}

		// --- ERROR INJECTION ---
		if config.FailureRate > 0 && rand.Float64() < config.FailureRate {
			errorCode := 500
			if len(config.ErrorCodes) > 0 {
				errorCode = config.ErrorCodes[rand.Intn(len(config.ErrorCodes))]
			}
			log.Printf("💥 CHAOS HIT: %s -> %d", route, errorCode)

			latency := time.Since(startTime).Milliseconds()
			chaosTypeStr := "error"
			logRequest(route, r.Method, errorCode, latency, &chaosTypeStr)
			updateMetrics(route, latency, errorCode, true)

			http.Error(w, "Chaos Injected: "+http.StatusText(errorCode), errorCode)
			return
		}

		// --- PAYLOAD TAMPERING ---
		interceptor := &responseInterceptor{
			ResponseWriter: w,
			body:           &bytes.Buffer{},
			statusCode:     200,
		}

		next.ServeHTTP(interceptor, r)

		finalBody := interceptor.body.Bytes()

		// Apply Corruption if it's a successful JSON response
		if interceptor.statusCode >= 200 && interceptor.statusCode < 300 {
			if config.CorruptionRate > 0 && rand.Float64() < config.CorruptionRate {
				log.Printf("🦠 PAYLOAD CORRUPTED: %s", route)
				finalBody = corruptJSON(finalBody)
				chaosTypeStr := "corruption"
				chaosType = &chaosTypeStr
				chaosInjected = true
			}
		}

		// Log request
		latency := time.Since(startTime).Milliseconds()
		logRequest(route, r.Method, interceptor.statusCode, latency, chaosType)
		updateMetrics(route, latency, interceptor.statusCode, chaosInjected)

		// Write the final headers and body back to the real client
		w.WriteHeader(interceptor.statusCode)
		w.Write(finalBody)
	})
}

// logRequest adds a request to the request log
func logRequest(route, method string, status int, latency int64, chaosType *string) {
	state.mu.Lock()
	defer state.mu.Unlock()

	state.requestIDCounter++
	log := RequestLog{
		ID:        fmt.Sprintf("req-%d", state.requestIDCounter),
		Timestamp: time.Now().UnixMilli(),
		Route:     route,
		Method:    method,
		Status:    status,
		Latency:   latency,
		ChaosType: chaosType,
	}

	state.RequestLogs = append(state.RequestLogs, log)

	// Keep only last 100 requests to prevent memory bloat
	if len(state.RequestLogs) > 100 {
		state.RequestLogs = state.RequestLogs[len(state.RequestLogs)-100:]
	}
}

// updateMetrics updates global and per-route metrics
func updateMetrics(route string, latency int64, status int, chaosInjected bool) {
	state.mu.Lock()
	defer state.mu.Unlock()

	// Update global metrics
	state.TotalRequests++
	state.TotalLatency += latency

	if chaosInjected {
		state.ChaosRequests++
	}

	if status >= 200 && status < 400 {
		state.SuccessRequests++
	}

	// Update route-specific metrics
	if state.RouteMetrics[route] != nil {
		state.RouteMetrics[route].RequestCount++
		state.RouteMetrics[route].TotalLatency += latency
		state.RouteMetrics[route].LastSeen = time.Now()

		if status >= 400 {
			state.RouteMetrics[route].ErrorCount++
		}
	}
}

// --- Control API Handlers ---

func handleRoutes(w http.ResponseWriter, r *http.Request) {
	state.mu.RLock()
	defer state.mu.RUnlock()

	// Enhanced format with statistics — initialise to empty slice so JSON encodes [] not null
	routes := make([]map[string]interface{}, 0, len(state.Discovered))
	for route := range state.Discovered {
		metrics := state.RouteMetrics[route]
		if metrics == nil {
			metrics = &RouteMetrics{}
		}

		avgLatency := 0.0
		if metrics.RequestCount > 0 {
			avgLatency = float64(metrics.TotalLatency) / float64(metrics.RequestCount)
		}

		errorRate := 0.0
		if metrics.RequestCount > 0 {
			errorRate = float64(metrics.ErrorCount) / float64(metrics.RequestCount) * 100
		}

		routes = append(routes, map[string]interface{}{
			"id":             fmt.Sprintf("ANY-%s", route),
			"method":         "ANY",
			"path":           route,
			"requestCount":   metrics.RequestCount,
			"averageLatency": avgLatency,
			"errorRate":      errorRate,
			"lastSeen":       metrics.LastSeen.UnixMilli(),
		})
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

func handleMetrics(w http.ResponseWriter, r *http.Request) {
	state.mu.RLock()
	defer state.mu.RUnlock()

	// Count active route rules
	activeRules := 0
	for _, config := range state.Configs {
		if config.Enabled {
			activeRules++
		}
	}

	// Calculate success rate
	successRate := 0.0
	if state.TotalRequests > 0 {
		successRate = float64(state.SuccessRequests) / float64(state.TotalRequests) * 100
	}

	// Calculate average latency
	avgLatency := 0.0
	if state.TotalRequests > 0 {
		avgLatency = float64(state.TotalLatency) / float64(state.TotalRequests)
	}

	metrics := map[string]interface{}{
		"totalRequests":    state.TotalRequests,
		"injectedRequests": state.ChaosRequests,
		"successRate":      successRate,
		"averageLatency":   avgLatency,
		"activeRouteRules": activeRules,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(metrics)
}

func handleRequests(w http.ResponseWriter, r *http.Request) {
	state.mu.RLock()
	defer state.mu.RUnlock()

	// Return last 50 requests (or all if less than 50)
	start := 0
	if len(state.RequestLogs) > 50 {
		start = len(state.RequestLogs) - 50
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(state.RequestLogs[start:])
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
	mux.HandleFunc("/chaos/metrics", corsMiddleware(handleMetrics))
	mux.HandleFunc("/chaos/requests", corsMiddleware(handleRequests))
	mux.HandleFunc("/chaos/analyze", corsMiddleware(handleAnalysis))

	// Catch-all route for proxying (Wrapped in Chaos Middleware)
	mux.Handle("/", chaosMiddleware(proxy))

	log.Println("😈 Chaos Proxy running on http://localhost:3999")
	log.Println("📊 Metrics endpoint: http://localhost:3999/chaos/metrics")
	log.Println("📝 Requests endpoint: http://localhost:3999/chaos/requests")
	log.Println("🛣️  Routes endpoint: http://localhost:3999/chaos/routes")
	log.Println("⚙️  Config endpoint: http://localhost:3999/chaos/config")
	log.Println("🤖 AI Analysis endpoint: POST http://localhost:3999/chaos/analyze")
	if err := http.ListenAndServe(":3999", mux); err != nil {
		log.Fatalf("Proxy failed to start: %v", err)
	}
}

func handleAnalysis(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed. Use POST to trigger analysis.", http.StatusMethodNotAllowed)
		return
	}

	// Get model from query param (default: phi3)
	model := r.URL.Query().Get("model")
	if model == "" {
		model = "llama3"
	}

	// Aggregate data from state
	state.mu.RLock()

	// Calculate success rate
	successRate := 0.0
	if state.TotalRequests > 0 {
		successRate = float64(state.SuccessRequests) / float64(state.TotalRequests) * 100
	}

	// Calculate average latency
	avgLatency := 0.0
	if state.TotalRequests > 0 {
		avgLatency = float64(state.TotalLatency) / float64(state.TotalRequests)
	}

	// Count active rules
	activeRules := 0
	for _, config := range state.Configs {
		if config.Enabled {
			activeRules++
		}
	}

	// Build metrics snapshot
	metrics := llm.MetricsSnapshot{
		TotalRequests:    state.TotalRequests,
		ChaosRequests:    state.ChaosRequests,
		SuccessRate:      successRate,
		AverageLatency:   avgLatency,
		ActiveRouteRules: activeRules,
	}

	// Build route statistics
	var routeStats []llm.RouteStatistics
	for route, rm := range state.RouteMetrics {
		config := state.Configs[route]

		routeAvgLatency := 0.0
		if rm.RequestCount > 0 {
			routeAvgLatency = float64(rm.TotalLatency) / float64(rm.RequestCount)
		}

		routeErrorRate := 0.0
		if rm.RequestCount > 0 {
			routeErrorRate = float64(rm.ErrorCount) / float64(rm.RequestCount) * 100
		}

		routeStats = append(routeStats, llm.RouteStatistics{
			Path:           route,
			RequestCount:   rm.RequestCount,
			AverageLatency: routeAvgLatency,
			ErrorRate:      routeErrorRate,
			ChaosEnabled:   config != nil && config.Enabled,
		})
	}

	// Convert RequestLog to llm.RequestLog
	var recentLogs []llm.RequestLog
	for _, rl := range state.RequestLogs {
		recentLogs = append(recentLogs, llm.RequestLog{
			ID:        rl.ID,
			Timestamp: rl.Timestamp,
			Route:     rl.Route,
			Method:    rl.Method,
			Status:    rl.Status,
			Latency:   rl.Latency,
			ChaosType: rl.ChaosType,
		})
	}

	state.mu.RUnlock()

	// Create analysis request
	analysisReq := llm.AnalysisRequest{
		Metrics:    metrics,
		RecentLogs: recentLogs,
		RouteStats: routeStats,
		TimeRange: llm.TimeRange{
			Start: time.Now().Add(-1 * time.Hour),
			End:   time.Now(),
		},
		AnalysisType: "full",
	}

	// Perform analysis
	log.Printf("🤖 Starting AI analysis with model: %s", model)
	analyzer := llm.NewAnalyzer(model)
	result, err := analyzer.AnalyzeMetrics(analysisReq)
	if err != nil {
		log.Printf("❌ Analysis failed: %v", err)
		http.Error(w, fmt.Sprintf("Analysis failed: %v", err), http.StatusInternalServerError)
		return
	}

	log.Printf("✅ Analysis complete in %dms - Health Score: %.0f", result.ProcessingTimeMs, result.HealthScore)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}
