package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"sync"
	"time"
)

// Models
type User struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

type Item struct {
	ID    int     `json:"id"`
	Name  string  `json:"name"`
	Price float64 `json:"price"`
	Stock int     `json:"stock"`
}

type Order struct {
	ID        int       `json:"id"`
	UserID    int       `json:"user_id"`
	Items     []int     `json:"items"`
	Total     float64   `json:"total"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

// In-memory storage
var (
	users  = make(map[int]User)
	items  = make(map[int]Item)
	orders = make(map[int]Order)
	mu     sync.RWMutex
	nextOrderID = 1
)

func init() {
	// Initialize dummy data
	users[1] = User{ID: 1, Name: "John Doe", Email: "john@example.com"}
	users[2] = User{ID: 2, Name: "Jane Smith", Email: "jane@example.com"}
	users[3] = User{ID: 3, Name: "Bob Johnson", Email: "bob@example.com"}

	items[1] = Item{ID: 1, Name: "Laptop", Price: 999.99, Stock: 10}
	items[2] = Item{ID: 2, Name: "Mouse", Price: 29.99, Stock: 50}
	items[3] = Item{ID: 3, Name: "Keyboard", Price: 79.99, Stock: 30}
	items[4] = Item{ID: 4, Name: "Monitor", Price: 299.99, Stock: 15}
	items[5] = Item{ID: 5, Name: "Headphones", Price: 149.99, Stock: 25}

	orders[1] = Order{
		ID:        1,
		UserID:    1,
		Items:     []int{1, 2},
		Total:     1029.98,
		Status:    "completed",
		CreatedAt: time.Now().Add(-24 * time.Hour),
	}
}

// Handlers
func getUsers(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()

	userList := make([]User, 0, len(users))
	for _, user := range users {
		userList = append(userList, user)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(userList)
}

func getUser(w http.ResponseWriter, r *http.Request) {
	idStr := r.URL.Query().Get("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	mu.RLock()
	user, exists := users[id]
	mu.RUnlock()

	if !exists {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

func getItems(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()

	itemList := make([]Item, 0, len(items))
	for _, item := range items {
		itemList = append(itemList, item)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(itemList)
}

func getItem(w http.ResponseWriter, r *http.Request) {
	idStr := r.URL.Query().Get("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid item ID", http.StatusBadRequest)
		return
	}

	mu.RLock()
	item, exists := items[id]
	mu.RUnlock()

	if !exists {
		http.Error(w, "Item not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(item)
}

func getOrders(w http.ResponseWriter, r *http.Request) {
	mu.RLock()
	defer mu.RUnlock()

	orderList := make([]Order, 0, len(orders))
	for _, order := range orders {
		orderList = append(orderList, order)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(orderList)
}

func getOrder(w http.ResponseWriter, r *http.Request) {
	idStr := r.URL.Query().Get("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid order ID", http.StatusBadRequest)
		return
	}

	mu.RLock()
	order, exists := orders[id]
	mu.RUnlock()

	if !exists {
		http.Error(w, "Order not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(order)
}

func createOrder(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserID int   `json:"user_id"`
		Items  []int `json:"items"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	mu.Lock()
	defer mu.Unlock()

	// Validate user
	if _, exists := users[req.UserID]; !exists {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	// Calculate total
	var total float64
	for _, itemID := range req.Items {
		if item, exists := items[itemID]; exists {
			total += item.Price
		}
	}

	order := Order{
		ID:        nextOrderID,
		UserID:    req.UserID,
		Items:     req.Items,
		Total:     total,
		Status:    "pending",
		CreatedAt: time.Now(),
	}
	orders[nextOrderID] = order
	nextOrderID++

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(order)
}

func healthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "healthy",
		"time":   time.Now().Format(time.RFC3339),
	})
}

func main() {
	http.HandleFunc("/health", healthCheck)
	http.HandleFunc("/users", getUsers)
	http.HandleFunc("/user", getUser)
	http.HandleFunc("/items", getItems)
	http.HandleFunc("/item", getItem)
	http.HandleFunc("/orders", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			getOrders(w, r)
		} else if r.Method == http.MethodPost {
			createOrder(w, r)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})
	http.HandleFunc("/order", getOrder)

	fmt.Println("🚀 E-commerce Backend Service starting on port 8080...")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

// Made with Bob
