package main

import (
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"time"
)

func helloHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "Successfully processed request!")
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "OK")
}

func main() {
	rand.Seed(time.Now().UnixNano())

	// 1. Initialize the Chaos Manager with default safe parameters
	manager := NewChaosManager(ChaosSettings{
		FailureRate:   0.3, // Start with chaos OFF
		DelayRate:     0.0, // Start with chaos OFF
		MinDelayMs:    500,
		MaxDelayMs:    2000,
		ErrorCodes:    []int{403, 404, 500, 502, 503},
		ExcludedPaths: []string{"/health", "/chaos/config"}, // Exclude admin & health routes!
	})

	// 2. Set up the standard API router
	apiMux := http.NewServeMux()
	apiMux.HandleFunc("/api/data", helloHandler)

	// 3. Wrap the API routes in the Chaos Middleware
	chaosWrappedAPI := manager.Middleware(apiMux)

	// 4. Create the root router
	rootMux := http.NewServeMux()

	// Mount excluded routes directly to the root (bypassing middleware)
	rootMux.HandleFunc("/health", healthHandler)
	rootMux.HandleFunc("/chaos/config", manager.ConfigHandler) // The Admin endpoint

	// Mount the chaos-wrapped API router
	rootMux.Handle("/", chaosWrappedAPI)

	fmt.Println("Server running on :8080...")
	fmt.Println("Admin Config Endpoint: POST/GET http://localhost:8080/chaos/config")
	log.Fatal(http.ListenAndServe(":8080", rootMux))
}
