package main

import (
	"encoding/json"
	"math/rand"
	"net/http"
	"strings"
	"sync"
	"time"
)

// ChaosSettings defines the JSON-friendly configuration.
type ChaosSettings struct {
	FailureRate   float64  `json:"failure_rate"`
	DelayRate     float64  `json:"delay_rate"`
	MinDelayMs    int64    `json:"min_delay_ms"`
	MaxDelayMs    int64    `json:"max_delay_ms"`
	ErrorCodes    []int    `json:"error_codes"` // CHANGED: Now an array of codes!
	ExcludedPaths []string `json:"excluded_paths"`
}

type ChaosManager struct {
	mu       sync.RWMutex
	settings ChaosSettings
}

func NewChaosManager(initial ChaosSettings) *ChaosManager {
	return &ChaosManager{settings: initial}
}

func (c *ChaosManager) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c.mu.RLock()
		cfg := c.settings
		c.mu.RUnlock()

		// 1. Exclusions
		for _, path := range cfg.ExcludedPaths {
			if strings.HasPrefix(r.URL.Path, path) {
				next.ServeHTTP(w, r)
				return
			}
		}

		// 2. Inject Latency
		if rand.Float64() < cfg.DelayRate {
			minDelay := time.Duration(cfg.MinDelayMs) * time.Millisecond
			maxDelay := time.Duration(cfg.MaxDelayMs) * time.Millisecond
			delayDuration := minDelay
			if maxDelay > minDelay {
				delayDuration += time.Duration(rand.Int63n(int64(maxDelay - minDelay)))
			}
			time.Sleep(delayDuration)
		}

		// 3. Inject Errors (UPDATED LOGIC)
		if rand.Float64() < cfg.FailureRate {
			code := http.StatusInternalServerError // Fallback
			if len(cfg.ErrorCodes) > 0 {
				// Pick a random code from the provided array
				code = cfg.ErrorCodes[rand.Intn(len(cfg.ErrorCodes))]
			}
			http.Error(w, "Simulated Chaos Failure", code)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (c *ChaosManager) ConfigHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		c.mu.RLock()
		defer c.mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(c.settings)
		return
	}

	if r.Method == http.MethodPost || r.Method == http.MethodPut {
		var newSettings ChaosSettings
		if err := json.NewDecoder(r.Body).Decode(&newSettings); err != nil {
			http.Error(w, "Invalid JSON payload", http.StatusBadRequest)
			return
		}
		c.mu.Lock()
		c.settings = newSettings
		c.mu.Unlock()
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status": "chaos settings updated successfully"}`))
		return
	}
	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}
