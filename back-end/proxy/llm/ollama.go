package llm

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// OllamaClient handles communication with local Ollama server
type OllamaClient struct {
	BaseURL string
	Model   string
	Timeout time.Duration
}

// OllamaRequest represents a request to Ollama API
type OllamaRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
	Stream bool   `json:"stream"`
}

// OllamaResponse represents a response from Ollama API
type OllamaResponse struct {
	Model     string `json:"model"`
	Response  string `json:"response"`
	Done      bool   `json:"done"`
	CreatedAt string `json:"created_at"`
}

// OllamaModelsResponse represents the list of available models
type OllamaModelsResponse struct {
	Models []OllamaModel `json:"models"`
}

// OllamaModel represents a single model
type OllamaModel struct {
	Name       string    `json:"name"`
	ModifiedAt time.Time `json:"modified_at"`
	Size       int64     `json:"size"`
}

// NewOllamaClient creates a new Ollama client
func NewOllamaClient(model string) *OllamaClient {
	if model == "" {
		model = "llama3" // Default to lightweight model
	}
	return &OllamaClient{
		BaseURL: "http://localhost:11434",
		Model:   model,
		Timeout: 60 * time.Second,
	}
}

// Generate sends a prompt to Ollama and returns the response
func (c *OllamaClient) Generate(prompt string) (string, error) {
	req := OllamaRequest{
		Model:  c.Model,
		Prompt: prompt,
		Stream: false,
	}

	jsonData, err := json.Marshal(req)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", c.BaseURL+"/api/generate", bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: c.Timeout}
	resp, err := client.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("ollama returned status %d", resp.StatusCode)
	}

	var ollamaResp OllamaResponse
	if err := json.NewDecoder(resp.Body).Decode(&ollamaResp); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	return ollamaResp.Response, nil
}

// IsAvailable checks if Ollama server is running
func (c *OllamaClient) IsAvailable() bool {
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(c.BaseURL + "/api/tags")
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == 200
}

// ListModels returns available models on the Ollama server
func (c *OllamaClient) ListModels() ([]string, error) {
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(c.BaseURL + "/api/tags")
	if err != nil {
		return nil, fmt.Errorf("failed to list models: %w", err)
	}
	defer resp.Body.Close()

	var modelsResp OllamaModelsResponse
	if err := json.NewDecoder(resp.Body).Decode(&modelsResp); err != nil {
		return nil, fmt.Errorf("failed to decode models response: %w", err)
	}

	models := make([]string, len(modelsResp.Models))
	for i, model := range modelsResp.Models {
		models[i] = model.Name
	}

	return models, nil
}

// ModelExists checks if a specific model is available
// Handles both "model" and "model:tag" formats
func (c *OllamaClient) ModelExists(modelName string) bool {
	models, err := c.ListModels()
	if err != nil {
		return false
	}

	for _, model := range models {
		// Exact match
		if model == modelName {
			return true
		}
		// Match without tag (e.g., "llama3" matches "llama3:latest")
		if strings.HasPrefix(model, modelName+":") {
			return true
		}
	}
	return false
}

// Made with Bob
