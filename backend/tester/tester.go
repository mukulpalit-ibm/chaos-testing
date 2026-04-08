package main

import (
	"fmt"
	"net/http"
	"sync"
	"time"
)

func main() {
	url := "http://localhost:8080/api/data"
	totalRequests := 1000

	// Map to store the count of each HTTP status code we get back
	results := make(map[int]int)
	var mu sync.Mutex
	var wg sync.WaitGroup

	fmt.Printf("Firing %d requests to %s...\n", totalRequests, url)
	startTime := time.Now()

	for i := 0; i < totalRequests; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()

			// Set a short timeout so the script doesn't hang forever
			client := http.Client{Timeout: 5 * time.Second}
			resp, err := client.Get(url)

			mu.Lock()
			defer mu.Unlock()

			if err != nil {
				// If the request completely failed (e.g., connection refused)
				results[0]++
				return
			}
			defer resp.Body.Close()

			// Record the status code
			results[resp.StatusCode]++
		}()
	}

	wg.Wait()
	duration := time.Since(startTime)

	// Print the final summary
	fmt.Printf("\n--- Results (Took %v) ---\n", duration)
	for code, count := range results {
		if code == 200 {
			fmt.Printf("✅ %d OK: %d requests\n", code, count)
		} else if code == 0 {
			fmt.Printf("❌ Failed to connect: %d requests\n", count)
		} else {
			fmt.Printf("⚠️ %d Error: %d requests\n", code, count)
		}
	}
}
