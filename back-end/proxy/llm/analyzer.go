package llm

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"
)

// Analyzer performs AI-powered analysis of chaos testing data
type Analyzer struct {
	client *OllamaClient
}

// AnalysisRequest contains data to be analyzed
type AnalysisRequest struct {
	Metrics      MetricsSnapshot   `json:"metrics"`
	RecentLogs   []RequestLog      `json:"recentLogs"`
	RouteStats   []RouteStatistics `json:"routeStats"`
	TimeRange    TimeRange         `json:"timeRange"`
	AnalysisType string            `json:"analysisType"` // "full", "patterns", "recommendations"
}

// MetricsSnapshot represents current system metrics
type MetricsSnapshot struct {
	TotalRequests    int     `json:"totalRequests"`
	ChaosRequests    int     `json:"chaosRequests"`
	SuccessRate      float64 `json:"successRate"`
	AverageLatency   float64 `json:"averageLatency"`
	ActiveRouteRules int     `json:"activeRouteRules"`
}

// RouteStatistics represents statistics for a single route
type RouteStatistics struct {
	Path           string  `json:"path"`
	RequestCount   int     `json:"requestCount"`
	AverageLatency float64 `json:"averageLatency"`
	ErrorRate      float64 `json:"errorRate"`
	ChaosEnabled   bool    `json:"chaosEnabled"`
}

// RequestLog represents a single request log entry
type RequestLog struct {
	ID        string  `json:"id"`
	Timestamp int64   `json:"timestamp"`
	Route     string  `json:"route"`
	Method    string  `json:"method"`
	Status    int     `json:"status"`
	Latency   int64   `json:"latency"`
	ChaosType *string `json:"chaosType,omitempty"`
}

// TimeRange represents a time period
type TimeRange struct {
	Start time.Time `json:"start"`
	End   time.Time `json:"end"`
}

// AnalysisResponse contains AI-generated insights
type AnalysisResponse struct {
	Summary          string           `json:"summary"`
	Patterns         []Pattern        `json:"patterns"`
	Recommendations  []Recommendation `json:"recommendations"`
	Anomalies        []Anomaly        `json:"anomalies"`
	HealthScore      float64          `json:"healthScore"`
	GeneratedAt      time.Time        `json:"generatedAt"`
	Model            string           `json:"model"`
	ProcessingTimeMs int64            `json:"processingTimeMs"`
}

// Pattern represents an identified pattern in the data
type Pattern struct {
	Type           string   `json:"type"` // "error_spike", "latency_increase", "route_correlation"
	Description    string   `json:"description"`
	Severity       string   `json:"severity"` // "low", "medium", "high"
	AffectedRoutes []string `json:"affectedRoutes"`
}

// Recommendation represents an actionable suggestion
type Recommendation struct {
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Priority    string   `json:"priority"` // "low", "medium", "high", "critical"
	ActionItems []string `json:"actionItems"`
	Impact      string   `json:"impact"`
}

// Anomaly represents an unusual metric or behavior
type Anomaly struct {
	Metric      string  `json:"metric"`
	Expected    float64 `json:"expected"`
	Actual      float64 `json:"actual"`
	Deviation   float64 `json:"deviation"`
	Description string  `json:"description"`
}

// unitSuffixRe: "26.4ms" -> "26.4", "95%" -> "95"
var unitSuffixRe = regexp.MustCompile(`(\d+\.?\d*)(ms|s|%|kb|mb|gb)\b`)

// cmpUnitRe: "<10ms" or ">100ms" or "<=50ms" inside a JSON value position -> bare number
var cmpUnitRe = regexp.MustCompile(`(:\s*)"?[<>]=?\s*(\d+\.?\d*)\s*(?:ms|s|%|kb|mb|gb)?\b"?`)

// quotedUnitRe: "\"711.7ms\"" (quoted unit string in a numeric field) -> bare number
var quotedUnitRe = regexp.MustCompile(`(:\s*)"(\d+\.?\d*)\s*(?:ms|s|%|kb|mb|gb)?"`)

// cleanLLMJSON strips markdown fences and repairs common LLM JSON mistakes so
// that json.Unmarshal has the best chance of succeeding.
func cleanLLMJSON(raw string) string {
	raw = strings.TrimSpace(raw)

	// Strip ```json ... ``` or ``` ... ``` fences
	if strings.HasPrefix(raw, "```") {
		lines := strings.SplitN(raw, "\n", 2)
		if len(lines) == 2 {
			raw = lines[1]
		}
		if idx := strings.LastIndex(raw, "```"); idx >= 0 {
			raw = raw[:idx]
		}
		raw = strings.TrimSpace(raw)
	}

	// "<10ms" / ">100" / "<=50ms" in value position -> bare number
	raw = cmpUnitRe.ReplaceAllString(raw, "${1}${2}")

	// "711.7ms" (quoted unit string) in value position -> bare number
	raw = quotedUnitRe.ReplaceAllString(raw, "${1}${2}")

	// Bare unit suffix: "26.4ms" -> "26.4"
	raw = unitSuffixRe.ReplaceAllString(raw, "$1")

	return raw
}

// NewAnalyzer creates a new analyzer with the specified model
func NewAnalyzer(model string) *Analyzer {
	return &Analyzer{
		client: NewOllamaClient(model),
	}
}

// AnalyzeMetrics performs AI analysis on chaos testing metrics
func (a *Analyzer) AnalyzeMetrics(data AnalysisRequest) (*AnalysisResponse, error) {
	startTime := time.Now()

	// Check if Ollama is available
	if !a.client.IsAvailable() {
		return nil, fmt.Errorf("Ollama server is not available at %s. Please start Ollama with 'ollama serve'", a.client.BaseURL)
	}

	// Check if model exists
	if !a.client.ModelExists(a.client.Model) {
		return nil, fmt.Errorf("model '%s' not found. Please pull it with 'ollama pull %s'", a.client.Model, a.client.Model)
	}

	// Build prompt
	prompt := a.buildPrompt(data)

	// Get LLM response
	response, err := a.client.Generate(prompt)
	if err != nil {
		return nil, fmt.Errorf("LLM generation failed: %w", err)
	}

	// Try to parse JSON response
	var analysis AnalysisResponse

	// Clean LLM output (strip fences, fix unit-suffixed numbers) then extract JSON object
	cleaned := cleanLLMJSON(response)
	jsonStart := strings.Index(cleaned, "{")
	jsonEnd := strings.LastIndex(cleaned, "}")

	if jsonStart >= 0 && jsonEnd > jsonStart {
		jsonStr := cleaned[jsonStart : jsonEnd+1]
		if err := json.Unmarshal([]byte(jsonStr), &analysis); err != nil {
			// Parsing still failed — surface raw text as summary so nothing is lost
			analysis = AnalysisResponse{
				Summary:         response,
				Patterns:        []Pattern{},
				Recommendations: []Recommendation{},
				Anomalies:       []Anomaly{},
				HealthScore:     50.0,
			}
		}
	} else {
		// No JSON object found — use raw response as summary
		analysis = AnalysisResponse{
			Summary:         response,
			Patterns:        []Pattern{},
			Recommendations: []Recommendation{},
			Anomalies:       []Anomaly{},
			HealthScore:     50.0,
		}
	}

	// Set metadata
	analysis.ProcessingTimeMs = time.Since(startTime).Milliseconds()
	analysis.GeneratedAt = time.Now()
	analysis.Model = a.client.Model

	return &analysis, nil
}

// buildPrompt constructs the analysis prompt from data
func (a *Analyzer) buildPrompt(data AnalysisRequest) string {
	chaosPercentage := 0.0
	if data.Metrics.TotalRequests > 0 {
		chaosPercentage = float64(data.Metrics.ChaosRequests) / float64(data.Metrics.TotalRequests) * 100
	}

	var sb strings.Builder

	// System prompt
	sb.WriteString(systemPrompt)
	sb.WriteString("\n\nAnalyze the following chaos testing data:\n\n")

	// Metrics section
	sb.WriteString("METRICS:\n")
	sb.WriteString(fmt.Sprintf("- Total Requests: %d\n", data.Metrics.TotalRequests))
	sb.WriteString(fmt.Sprintf("- Chaos Injected: %d (%.1f%%)\n", data.Metrics.ChaosRequests, chaosPercentage))
	sb.WriteString(fmt.Sprintf("- Success Rate: %.1f%%\n", data.Metrics.SuccessRate))
	sb.WriteString(fmt.Sprintf("- Average Latency: %.1fms\n", data.Metrics.AverageLatency))
	sb.WriteString(fmt.Sprintf("- Active Chaos Rules: %d\n\n", data.Metrics.ActiveRouteRules))

	// Route statistics
	if len(data.RouteStats) > 0 {
		sb.WriteString("ROUTE STATISTICS:\n")
		for _, route := range data.RouteStats {
			sb.WriteString(fmt.Sprintf("- %s:\n", route.Path))
			sb.WriteString(fmt.Sprintf("  - Requests: %d\n", route.RequestCount))
			sb.WriteString(fmt.Sprintf("  - Avg Latency: %.1fms\n", route.AverageLatency))
			sb.WriteString(fmt.Sprintf("  - Error Rate: %.1f%%\n", route.ErrorRate))
			sb.WriteString(fmt.Sprintf("  - Chaos Enabled: %v\n", route.ChaosEnabled))
		}
		sb.WriteString("\n")
	}

	// Recent errors
	if len(data.RecentLogs) > 0 {
		sb.WriteString("RECENT FAILURES:\n")
		errorCount := 0
		for _, log := range data.RecentLogs {
			if log.Status >= 400 {
				chaosType := "none"
				if log.ChaosType != nil {
					chaosType = *log.ChaosType
				}
				sb.WriteString(fmt.Sprintf("- %s (%s): %d - chaos: %s\n",
					log.Route, log.Method, log.Status, chaosType))
				errorCount++
				if errorCount >= 10 {
					break
				}
			}
		}
		sb.WriteString("\n")
	}

	sb.WriteString("Provide analysis in JSON format with patterns, recommendations, anomalies, and health score (0-100).\n")
	sb.WriteString("Focus on actionable insights and specific recommendations.")

	return sb.String()
}

const systemPrompt = `You are an expert chaos engineering analyst specializing in distributed systems resilience. 
Analyze the provided chaos testing data and respond ONLY with valid JSON in this exact format:
{
  "summary": "Brief overview of system health and key findings",
  "patterns": [
    {
      "type": "error_spike|latency_increase|route_correlation",
      "description": "Detailed description of the pattern",
      "severity": "low|medium|high",
      "affectedRoutes": ["route1", "route2"]
    }
  ],
  "recommendations": [
    {
      "title": "Short actionable title",
      "description": "Detailed explanation",
      "priority": "low|medium|high|critical",
      "actionItems": ["Step 1", "Step 2"],
      "impact": "Expected outcome"
    }
  ],
  "anomalies": [
    {
      "metric": "metric_name",
      "expected": 100.0,
      "actual": 150.0,
      "deviation": 50.0,
      "description": "What this means"
    }
  ],
  "healthScore": 85
}

Be concise, technical, and actionable. Focus on practical insights that improve system resilience.`

// Made with Bob
