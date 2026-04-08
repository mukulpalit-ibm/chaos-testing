package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
)

// sendJSON is a quick helper to keep our handlers clean
func sendJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(payload)
}

func main() {
	mux := http.NewServeMux()

	// 1. GET /health
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		sendJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "mock-backend"})
	})

	// 2. GET /products
	mux.HandleFunc("/api/products", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		products := []map[string]interface{}{
			{"id": 1, "name": "Mechanical Keyboard", "price": 120.00},
			{"id": 2, "name": "Chaos Monkey Plushie", "price": 25.50},
		}
		sendJSON(w, http.StatusOK, products)
	})

	// 3. POST /orders
	mux.HandleFunc("/api/orders", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		// Static success response
		sendJSON(w, http.StatusCreated, map[string]interface{}{
			"order_id": "ord_98765",
			"status":   "accepted",
		})
	})

	// 4. GET /users/:id
	// (Using standard mux, so we handle the wildcard manually)
	mux.HandleFunc("/api/users/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Strip the prefix to get the ID
		id := strings.TrimPrefix(r.URL.Path, "/users/")
		if id == "" {
			http.Error(w, "User ID required", http.StatusBadRequest)
			return
		}

		sendJSON(w, http.StatusOK, map[string]interface{}{
			"id":    id,
			"name":  "John Doe",
			"email": "johndoe@example.com",
			"role":  "admin",
		})
	})

	log.Println("📦 Sample Backend running on http://localhost:4000")
	if err := http.ListenAndServe(":4000", mux); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
