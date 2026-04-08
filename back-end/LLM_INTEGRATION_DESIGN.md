# LLM Integration Design - Ollama for Chaos Testing Analysis

**Date**: 2026-04-08  
**LLM Provider**: Ollama (Local)  
**Analysis Type**: Batch Analysis  
**Cost**: Free (runs locally)

---

## Overview

Integrate Ollama (local LLM) to provide intelligent insights from chaos testing metrics, request logs, and route statistics. The system will analyze accumulated data and provide actionable recommendations for improving system resilience.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Chaos Proxy                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Metrics    │  │   Request    │  │    Route     │      │
│  │   Tracking   │  │   Logging    │  │  Statistics  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            ↓                                 │
│                  ┌──────────────────┐                        │
│                  │  Data Aggregator │                        │
│                  └──────────────────┘                        │
│                            ↓                                 │
│                  ┌──────────────────┐                        │
│                  │  LLM Analyzer    │                        │
│                  │  (Ollama Client) │                        │
│                  └──────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
                  ┌──────────────────┐
                  │  Ollama Server   │
                  │  (localhost:11434)│
                  │  Models:         │
                  │  - llama3        │
                  │  - mistral       │
                  │  - phi-3         │
                  └──────────────────┘
                            ↓
                  ┌──────────────────┐
                  │  AI Insights     │
                  │  - Patterns      │
                  │  - Recommendations│
                  │  - Anomalies     │
                  └──────────────────┘
```

---

## Ollama Setup

### Installation

**macOS**:
```bash
brew install ollama
```

**Linux**:
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows**:
Download from https://ollama.com/download

### Start Ollama Server
```bash
ollama serve
```

### Pull Recommended Models
```bash
# Lightweight and fast (1.3GB)
ollama pull phi3

# Balanced performance (4.1GB)
ollama pull mistral

# Most capable (4.7GB)
ollama pull llama3
```

### Test Ollama
```bash
curl http://localhost:11434/api/generate -d '{
  "model": "phi3",
  "prompt": "Why is the sky blue?",
  "stream": false
}'
```

---

## Data Structures

### Analysis Request
```go
type AnalysisRequest struct {
    Metrics      MetricsSnapshot      `json:"metrics"`
    RecentLogs   []RequestLog         `json:"recentLogs"`
    RouteStats   []RouteStatistics    `json:"routeStats"`
    TimeRange    TimeRange            `json:"timeRange"`
    AnalysisType string               `json:"analysisType"` // "full", "patterns", "recommendations"
}

type MetricsSnapshot struct {
    TotalRequests    int     `json:"totalRequests"`
    ChaosRequests    int     `json:"chaosRequests"`
    SuccessRate      float64 `json:"successRate"`
    AverageLatency   float64 `json:"averageLatency"`
    ActiveRouteRules int     `json:"activeRouteRules"`
}

type RouteStatistics struct {
    Path           string  `json:"path"`
    RequestCount   int     `json:"requestCount"`
    AverageLatency float64 `json:"averageLatency"`
    ErrorRate      float64 `json:"errorRate"`
    ChaosEnabled   bool    `json:"chaosEnabled"`
}

type TimeRange struct {
    Start time.Time `json:"start"`
    End   time.Time `json:"end"`
}
```

### Analysis Response
```go
type AnalysisResponse struct {
    Summary          string              `json:"summary"`
    Patterns         []Pattern           `json:"patterns"`
    Recommendations  []Recommendation    `json:"recommendations"`
    Anomalies        []Anomaly           `json:"anomalies"`
    HealthScore      float64             `json:"healthScore"`
    GeneratedAt      time.Time           `json:"generatedAt"`
    Model            string              `json:"model"`
    ProcessingTimeMs int64               `json:"processingTimeMs"`
}

type Pattern struct {
    Type        string  `json:"type"`        // "error_spike", "latency_increase", "route_correlation"
    Description string  `json:"description"`
    Severity    string  `json:"severity"`    // "low", "medium", "high"
    AffectedRoutes []string `json:"affectedRoutes"`
}

type Recommendation struct {
    Title       string   `json:"title"`
    Description string   `json:"description"`
    Priority    string   `json:"priority"`   // "low", "medium", "high", "critical"
    ActionItems []string `json:"actionItems"`
    Impact      string   `json:"impact"`
}

type Anomaly struct {
    Metric      string  `json:"metric"`
    Expected    float64 `json:"expected"`
    Actual      float64 `json:"actual"`
    Deviation   float64 `json:"deviation"`
    Description string  `json:"description"`
}
```

---

## LLM Prompts

### System Prompt
```
You are an expert chaos engineering analyst specializing in distributed systems resilience. 
Your role is to analyze chaos testing metrics, identify patterns, detect anomalies, and 
provide actionable recommendations to improve system reliability.

Analyze the provided data and respond in JSON format with:
1. Summary: Brief overview of system health
2. Patterns: Identified failure patterns or trends
3. Recommendations: Specific actions to improve resilience
4. Anomalies: Unusual metrics or behaviors
5. HealthScore: Overall system health (0-100)

Be concise, technical, and actionable. Focus on practical insights.
```

### Analysis Prompt Template
```
Analyze the following chaos testing data:

METRICS:
- Total Requests: {{.TotalRequests}}
- Chaos Injected: {{.ChaosRequests}} ({{.ChaosPercentage}}%)
- Success Rate: {{.SuccessRate}}%
- Average Latency: {{.AverageLatency}}ms
- Active Chaos Rules: {{.ActiveRouteRules}}

ROUTE STATISTICS:
{{range .RouteStats}}
- {{.Path}}:
  - Requests: {{.RequestCount}}
  - Avg Latency: {{.AverageLatency}}ms
  - Error Rate: {{.ErrorRate}}%
  - Chaos Enabled: {{.ChaosEnabled}}
{{end}}

RECENT FAILURES:
{{range .RecentErrors}}
- {{.Route}} ({{.Method}}): {{.Status}} - {{.ChaosType}}
{{end}}

Provide analysis in JSON format with patterns, recommendations, anomalies, and health score.
```

---

## Implementation Plan

### Phase 1: Ollama Client Module

**File**: `back-end/proxy/llm/ollama.go`

```go
package llm

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
    "time"
)

type OllamaClient struct {
    BaseURL string
    Model   string
    Timeout time.Duration
}

type OllamaRequest struct {
    Model  string `json:"model"`
    Prompt string `json:"prompt"`
    Stream bool   `json:"stream"`
}

type OllamaResponse struct {
    Model     string `json:"model"`
    Response  string `json:"response"`
    Done      bool   `json:"done"`
    CreatedAt string `json:"created_at"`
}

func NewOllamaClient(model string) *OllamaClient {
    return &OllamaClient{
        BaseURL: "http://localhost:11434",
        Model:   model,
        Timeout: 60 * time.Second,
    }
}

func (c *OllamaClient) Generate(prompt string) (string, error) {
    req := OllamaRequest{
        Model:  c.Model,
        Prompt: prompt,
        Stream: false,
    }
    
    jsonData, err := json.Marshal(req)
    if err != nil {
        return "", err
    }
    
    httpReq, err := http.NewRequest("POST", c.BaseURL+"/api/generate", bytes.NewBuffer(jsonData))
    if err != nil {
        return "", err
    }
    
    httpReq.Header.Set("Content-Type", "application/json")
    
    client := &http.Client{Timeout: c.Timeout}
    resp, err := client.Do(httpReq)
    if err != nil {
        return "", err
    }
    defer resp.Body.Close()
    
    var ollamaResp OllamaResponse
    if err := json.NewDecoder(resp.Body).Decode(&ollamaResp); err != nil {
        return "", err
    }
    
    return ollamaResp.Response, nil
}

func (c *OllamaClient) IsAvailable() bool {
    resp, err := http.Get(c.BaseURL + "/api/tags")
    if err != nil {
        return false
    }
    defer resp.Body.Close()
    return resp.StatusCode == 200
}
```

### Phase 2: Analysis Engine

**File**: `back-end/proxy/llm/analyzer.go`

```go
package llm

import (
    "encoding/json"
    "fmt"
    "strings"
    "time"
)

type Analyzer struct {
    client *OllamaClient
}

func NewAnalyzer(model string) *Analyzer {
    return &Analyzer{
        client: NewOllamaClient(model),
    }
}

func (a *Analyzer) AnalyzeMetrics(data AnalysisRequest) (*AnalysisResponse, error) {
    startTime := time.Now()
    
    // Build prompt
    prompt := a.buildPrompt(data)
    
    // Get LLM response
    response, err := a.client.Generate(prompt)
    if err != nil {
        return nil, fmt.Errorf("LLM generation failed: %w", err)
    }
    
    // Parse JSON response
    var analysis AnalysisResponse
    if err := json.Unmarshal([]byte(response), &analysis); err != nil {
        // If JSON parsing fails, create a basic response
        analysis = AnalysisResponse{
            Summary: response,
            GeneratedAt: time.Now(),
            Model: a.client.Model,
        }
    }
    
    analysis.ProcessingTimeMs = time.Since(startTime).Milliseconds()
    analysis.GeneratedAt = time.Now()
    analysis.Model = a.client.Model
    
    return &analysis, nil
}

func (a *Analyzer) buildPrompt(data AnalysisRequest) string {
    chaosPercentage := 0.0
    if data.Metrics.TotalRequests > 0 {
        chaosPercentage = float64(data.Metrics.ChaosRequests) / float64(data.Metrics.TotalRequests) * 100
    }
    
    var sb strings.Builder
    
    sb.WriteString(systemPrompt)
    sb.WriteString("\n\nAnalyze the following chaos testing data:\n\n")
    
    // Metrics section
    sb.WriteString(fmt.Sprintf("METRICS:\n"))
    sb.WriteString(fmt.Sprintf("- Total Requests: %d\n", data.Metrics.TotalRequests))
    sb.WriteString(fmt.Sprintf("- Chaos Injected: %d (%.1f%%)\n", data.Metrics.ChaosRequests, chaosPercentage))
    sb.WriteString(fmt.Sprintf("- Success Rate: %.1f%%\n", data.Metrics.SuccessRate))
    sb.WriteString(fmt.Sprintf("- Average Latency: %.1fms\n", data.Metrics.AverageLatency))
    sb.WriteString(fmt.Sprintf("- Active Chaos Rules: %d\n\n", data.Metrics.ActiveRouteRules))
    
    // Route statistics
    sb.WriteString("ROUTE STATISTICS:\n")
    for _, route := range data.RouteStats {
        sb.WriteString(fmt.Sprintf("- %s:\n", route.Path))
        sb.WriteString(fmt.Sprintf("  - Requests: %d\n", route.RequestCount))
        sb.WriteString(fmt.Sprintf("  - Avg Latency: %.1fms\n", route.AverageLatency))
        sb.WriteString(fmt.Sprintf("  - Error Rate: %.1f%%\n", route.ErrorRate))
        sb.WriteString(fmt.Sprintf("  - Chaos Enabled: %v\n", route.ChaosEnabled))
    }
    
    // Recent errors
    sb.WriteString("\nRECENT FAILURES:\n")
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
    
    sb.WriteString("\nProvide analysis in JSON format with patterns, recommendations, anomalies, and health score (0-100).")
    
    return sb.String()
}

const systemPrompt = `You are an expert chaos engineering analyst. Analyze chaos testing data and respond in JSON format:
{
  "summary": "brief overview",
  "patterns": [{"type": "pattern_type", "description": "details", "severity": "low|medium|high", "affectedRoutes": []}],
  "recommendations": [{"title": "action", "description": "details", "priority": "low|medium|high|critical", "actionItems": [], "impact": "expected outcome"}],
  "anomalies": [{"metric": "name", "expected": 0, "actual": 0, "deviation": 0, "description": "details"}],
  "healthScore": 85
}`
```

### Phase 3: API Endpoint

**Add to**: `back-end/proxy/proxy.go`

```go
func handleAnalysis(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }
    
    // Get model from query param (default: phi3)
    model := r.URL.Query().Get("model")
    if model == "" {
        model = "phi3"
    }
    
    // Aggregate data
    state.mu.RLock()
    
    // Build metrics snapshot
    metrics := MetricsSnapshot{
        TotalRequests:    state.TotalRequests,
        ChaosRequests:    state.ChaosRequests,
        SuccessRate:      calculateSuccessRate(),
        AverageLatency:   calculateAverageLatency(),
        ActiveRouteRules: countActiveRules(),
    }
    
    // Build route statistics
    var routeStats []RouteStatistics
    for route, rm := range state.RouteMetrics {
        config := state.Configs[route]
        routeStats = append(routeStats, RouteStatistics{
            Path:           route,
            RequestCount:   rm.RequestCount,
            AverageLatency: float64(rm.TotalLatency) / float64(rm.RequestCount),
            ErrorRate:      float64(rm.ErrorCount) / float64(rm.RequestCount) * 100,
            ChaosEnabled:   config != nil && config.Enabled,
        })
    }
    
    // Get recent logs
    recentLogs := state.RequestLogs
    
    state.mu.RUnlock()
    
    // Create analysis request
    analysisReq := AnalysisRequest{
        Metrics:    metrics,
        RecentLogs: recentLogs,
        RouteStats: routeStats,
        TimeRange: TimeRange{
            Start: time.Now().Add(-1 * time.Hour),
            End:   time.Now(),
        },
        AnalysisType: "full",
    }
    
    // Perform analysis
    analyzer := llm.NewAnalyzer(model)
    result, err := analyzer.AnalyzeMetrics(analysisReq)
    if err != nil {
        http.Error(w, fmt.Sprintf("Analysis failed: %v", err), http.StatusInternalServerError)
        return
    }
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(result)
}
```

---

## API Endpoints

### POST `/chaos/analyze`

**Query Parameters**:
- `model` (optional): Ollama model to use (default: "phi3")
  - Options: "phi3", "mistral", "llama3"

**Response**:
```json
{
  "summary": "System shows moderate resilience with 85% success rate...",
  "patterns": [
    {
      "type": "error_spike",
      "description": "/products route experiencing 15% error rate",
      "severity": "medium",
      "affectedRoutes": ["/products"]
    }
  ],
  "recommendations": [
    {
      "title": "Reduce chaos intensity on /products",
      "description": "Current 30% failure rate may be too aggressive",
      "priority": "medium",
      "actionItems": [
        "Lower failureRate to 0.15",
        "Add circuit breaker pattern",
        "Implement retry logic"
      ],
      "impact": "Improve success rate by 10-15%"
    }
  ],
  "anomalies": [
    {
      "metric": "averageLatency",
      "expected": 150,
      "actual": 234.5,
      "deviation": 56.3,
      "description": "Latency 56% higher than baseline"
    }
  ],
  "healthScore": 78,
  "generatedAt": "2026-04-08T09:30:00Z",
  "model": "phi3",
  "processingTimeMs": 2340
}
```

---

## Usage Examples

### Trigger Analysis
```bash
# Using default model (phi3)
curl -X POST http://localhost:3999/chaos/analyze | jq

# Using specific model
curl -X POST "http://localhost:3999/chaos/analyze?model=llama3" | jq

# Save analysis to file
curl -X POST http://localhost:3999/chaos/analyze > analysis-report.json
```

### Automated Periodic Analysis
```bash
# Run analysis every 5 minutes
while true; do
  curl -X POST http://localhost:3999/chaos/analyze | \
    jq '.summary, .healthScore' >> daily-analysis.log
  sleep 300
done
```

---

## Benefits

✅ **Cost-Effective**: Runs locally, no API costs  
✅ **Privacy**: Data never leaves your machine  
✅ **Fast**: Local inference, no network latency  
✅ **Flexible**: Switch between models easily  
✅ **Actionable**: Specific recommendations for improvement  
✅ **Pattern Detection**: Identifies trends humans might miss  
✅ **Anomaly Detection**: Flags unusual behavior  
✅ **Health Scoring**: Quantifies system resilience  

---

## Model Comparison

| Model | Size | Speed | Quality | Best For |
|-------|------|-------|---------|----------|
| phi3 | 1.3GB | Fast | Good | Quick insights, frequent analysis |
| mistral | 4.1GB | Medium | Better | Balanced performance |
| llama3 | 4.7GB | Slower | Best | Deep analysis, complex patterns |

---

## Next Steps

1. ✅ Install Ollama
2. ✅ Pull recommended model (phi3)
3. ⏳ Implement Ollama client module
4. ⏳ Implement analysis engine
5. ⏳ Add analysis endpoint to proxy
6. ⏳ Test with real data
7. ⏳ Integrate with frontend dashboard

---

## Future Enhancements

- **Scheduled Analysis**: Automatic periodic analysis
- **Trend Analysis**: Compare current vs historical data
- **Alert Integration**: Trigger alerts on critical findings
- **Custom Prompts**: User-defined analysis focus
- **Multi-Model Ensemble**: Combine insights from multiple models
- **Fine-Tuning**: Train on your specific system patterns