package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// Configuration
type Config struct {
	ActualURL      string `json:"actual_url"`
	MiddlewarePort string `json:"middleware_port"`
}

// ChaosConfig represents chaos settings for an endpoint
type ChaosConfig struct {
	RandomFailure     string `json:"random_failure"`      // e.g., "10%"
	RandomLatencyMin  string `json:"random_latency_min"`  // e.g., "0ms"
	RandomLatencyMax  string `json:"random_latency_max"`  // e.g., "500ms"
	FailurePercentage int    `json:"-"`                   // parsed percentage
	LatencyMinMs      int    `json:"-"`                   // parsed min latency
	LatencyMaxMs      int    `json:"-"`                   // parsed max latency
}

// Stats represents statistics for an endpoint
type Stats struct {
	TotalRequests   int     `json:"total_requests"`
	SuccessRequests int     `json:"success_requests"`
	FailedRequests  int     `json:"failed_requests"`
	TotalLatencyMs  int64   `json:"total_latency_ms"`
	AvgLatencyMs    float64 `json:"avg_latency_ms"`
}

var (
	config       Config
	chaosConfigs = make(map[string]*ChaosConfig)
	stats        = make(map[string]*Stats)
	mu           sync.RWMutex
)

func init() {
	rand.Seed(time.Now().UnixNano())
}

func loadConfig() error {
	file, err := os.ReadFile("config.json")
	if err != nil {
		return err
	}
	return json.Unmarshal(file, &config)
}

func parseDuration(s string) int {
	// Parse duration strings like "500ms", "1s", etc.
	s = strings.TrimSpace(s)
	if s == "" || s == "0" {
		return 0
	}

	var value int
	var unit string
	fmt.Sscanf(s, "%d%s", &value, &unit)

	switch unit {
	case "ms":
		return value
	case "s":
		return value * 1000
	default:
		return value
	}
}

func parsePercentage(s string) int {
	s = strings.TrimSpace(s)
	if s == "" || s == "0" || s == "0%" {
		return 0
	}
	var value int
	fmt.Sscanf(s, "%d%%", &value)
	return value
}

func applyChaosConfig(cfg *ChaosConfig) {
	if cfg.RandomFailure != "" {
		cfg.FailurePercentage = parsePercentage(cfg.RandomFailure)
	}
	if cfg.RandomLatencyMin != "" {
		cfg.LatencyMinMs = parseDuration(cfg.RandomLatencyMin)
	}
	if cfg.RandomLatencyMax != "" {
		cfg.LatencyMaxMs = parseDuration(cfg.RandomLatencyMax)
	}
}

func shouldInjectFailure(percentage int) bool {
	if percentage <= 0 {
		return false
	}
	return rand.Intn(100) < percentage
}

func getRandomLatency(min, max int) time.Duration {
	if min >= max {
		return time.Duration(min) * time.Millisecond
	}
	latency := min + rand.Intn(max-min)
	return time.Duration(latency) * time.Millisecond
}

func updateStats(path string, success bool, latencyMs int64) {
	mu.Lock()
	defer mu.Unlock()

	if stats[path] == nil {
		stats[path] = &Stats{}
	}

	s := stats[path]
	s.TotalRequests++
	s.TotalLatencyMs += latencyMs

	if success {
		s.SuccessRequests++
	} else {
		s.FailedRequests++
	}

	if s.TotalRequests > 0 {
		s.AvgLatencyMs = float64(s.TotalLatencyMs) / float64(s.TotalRequests)
	}
}

func enableCORS(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
}

func chaosHandler(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Extract the API path from /chaos/{path}
	path := strings.TrimPrefix(r.URL.Path, "/chaos")
	if path == "" || path == "/" {
		// GET /chaos - return all chaos configs and stats
		if r.Method == http.MethodGet {
			mu.RLock()
			defer mu.RUnlock()

			response := map[string]interface{}{
				"chaos_configs": chaosConfigs,
				"stats":         stats,
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(response)
			return
		}
		http.Error(w, "Invalid chaos endpoint", http.StatusBadRequest)
		return
	}

	switch r.Method {
	case http.MethodGet:
		// GET /chaos/{path} - get chaos config for specific endpoint
		mu.RLock()
		cfg := chaosConfigs[path]
		st := stats[path]
		mu.RUnlock()

		response := map[string]interface{}{
			"path":         path,
			"chaos_config": cfg,
			"stats":        st,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)

	case http.MethodPost:
		// POST /chaos/{path} - set chaos config for specific endpoint
		var cfg ChaosConfig
		if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		applyChaosConfig(&cfg)

		mu.Lock()
		chaosConfigs[path] = &cfg
		mu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"message": "Chaos config updated",
			"path":    path,
			"config":  cfg,
		})

	case http.MethodDelete:
		// DELETE /chaos/{path} - remove chaos config for specific endpoint
		mu.Lock()
		delete(chaosConfigs, path)
		mu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Chaos config removed",
			"path":    path,
		})

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func proxyHandler(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	startTime := time.Now()
	path := r.URL.Path

	// Check if there's a chaos config for this path
	mu.RLock()
	cfg := chaosConfigs[path]
	mu.RUnlock()

	var injectedLatency time.Duration

	if cfg != nil {
		// Inject latency
		if cfg.LatencyMaxMs > 0 {
			injectedLatency = getRandomLatency(cfg.LatencyMinMs, cfg.LatencyMaxMs)
			time.Sleep(injectedLatency)
		}

		// Inject failure
		if shouldInjectFailure(cfg.FailurePercentage) {
			latencyMs := time.Since(startTime).Milliseconds()
			updateStats(path, false, latencyMs)

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{
				"error":   "Chaos-injected failure",
				"message": "This failure was intentionally injected by chaos middleware",
			})
			return
		}
	}

	// Forward request to actual backend
	targetURL := config.ActualURL + r.URL.Path
	if r.URL.RawQuery != "" {
		targetURL += "?" + r.URL.RawQuery
	}

	// Read body
	var bodyBytes []byte
	if r.Body != nil {
		bodyBytes, _ = io.ReadAll(r.Body)
		r.Body.Close()
	}

	// Create new request
	proxyReq, err := http.NewRequest(r.Method, targetURL, bytes.NewReader(bodyBytes))
	if err != nil {
		latencyMs := time.Since(startTime).Milliseconds()
		updateStats(path, false, latencyMs)
		http.Error(w, "Failed to create proxy request", http.StatusInternalServerError)
		return
	}

	// Copy headers
	for key, values := range r.Header {
		for _, value := range values {
			proxyReq.Header.Add(key, value)
		}
	}

	// Send request
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(proxyReq)
	if err != nil {
		latencyMs := time.Since(startTime).Milliseconds()
		updateStats(path, false, latencyMs)
		http.Error(w, "Failed to reach backend service", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	// Copy response headers
	for key, values := range resp.Header {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}

	// Copy response
	w.WriteHeader(resp.StatusCode)
	respBody, _ := io.ReadAll(resp.Body)
	w.Write(respBody)

	// Update stats
	latencyMs := time.Since(startTime).Milliseconds()
	success := resp.StatusCode >= 200 && resp.StatusCode < 300
	updateStats(path, success, latencyMs)
}

func main() {
	if err := loadConfig(); err != nil {
		log.Fatal("Failed to load config:", err)
	}

	http.HandleFunc("/chaos/", chaosHandler)
	http.HandleFunc("/chaos", chaosHandler)
	http.HandleFunc("/", proxyHandler)

	fmt.Printf("🌪️  Chaos Testing Middleware starting on port %s...\n", config.MiddlewarePort)
	fmt.Printf("📡 Proxying to: %s\n", config.ActualURL)
	log.Fatal(http.ListenAndServe(":"+config.MiddlewarePort, nil))
}

// Made with Bob
