# Ollama Setup and Testing Guide

Complete guide to set up and test the LLM integration for chaos testing analysis.

---

## Prerequisites

- Go 1.19+ installed
- Backend and Proxy running
- Terminal access

---

## Step 1: Install Ollama

### macOS
```bash
brew install ollama
```

### Linux
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### Windows
Download from: https://ollama.com/download

### Verify Installation
```bash
ollama --version
```

---

## Step 2: Start Ollama Server

Open a new terminal and run:
```bash
ollama serve
```

You should see:
```
Ollama is running on http://localhost:11434
```

**Keep this terminal open!**

---

## Step 3: Pull AI Models

### Option 1: Lightweight Model (Recommended for Testing)
```bash
ollama pull phi3
```
- Size: 1.3GB
- Speed: Fast
- Quality: Good
- Best for: Quick insights, frequent analysis

### Option 2: Balanced Model
```bash
ollama pull mistral
```
- Size: 4.1GB
- Speed: Medium
- Quality: Better
- Best for: Balanced performance

### Option 3: Most Capable Model
```bash
ollama pull llama3
```
- Size: 4.7GB
- Speed: Slower
- Quality: Best
- Best for: Deep analysis, complex patterns

### Verify Models
```bash
ollama list
```

---

## Step 4: Test Ollama

```bash
curl http://localhost:11434/api/generate -d '{
  "model": "phi3",
  "prompt": "Explain chaos engineering in one sentence.",
  "stream": false
}' | jq
```

Expected response:
```json
{
  "model": "phi3",
  "response": "Chaos engineering is...",
  "done": true
}
```

---

## Step 5: Start Your Services

### Terminal 1: Backend
```bash
cd back-end
go run backend.go
```

### Terminal 2: Proxy
```bash
cd back-end/proxy
go run proxy.go
```

You should see:
```
😈 Chaos Proxy running on http://localhost:3999
📊 Metrics endpoint: http://localhost:3999/chaos/metrics
📝 Requests endpoint: http://localhost:3999/chaos/requests
🛣️  Routes endpoint: http://localhost:3999/chaos/routes
⚙️  Config endpoint: http://localhost:3999/chaos/config
🤖 AI Analysis endpoint: POST http://localhost:3999/chaos/analyze
```

---

## Step 6: Generate Test Data

Run this script to generate traffic:
```bash
# Generate 50 requests
for i in {1..50}; do
  curl -s http://localhost:3999/products > /dev/null &
  curl -s http://localhost:3999/users/123 > /dev/null &
  curl -s -X POST http://localhost:3999/orders > /dev/null &
done
wait

echo "✅ Generated 150 requests"
```

### Enable Chaos on a Route
```bash
curl -X PUT http://localhost:3999/chaos/config \
  -H "Content-Type: application/json" \
  -d '{
    "/products": {
      "enabled": true,
      "failureRate": 0.3,
      "delayRate": 0.2,
      "minDelayMs": 100,
      "maxDelayMs": 500,
      "errorCodes": [500, 503]
    }
  }'
```

### Generate More Traffic with Chaos
```bash
for i in {1..30}; do
  curl -s http://localhost:3999/products > /dev/null 2>&1 &
done
wait

echo "✅ Generated 30 requests with chaos"
```

---

## Step 7: Trigger AI Analysis

### Using Default Model (phi3)
```bash
curl -X POST http://localhost:3999/chaos/analyze | jq
```

### Using Specific Model
```bash
# Using mistral
curl -X POST "http://localhost:3999/chaos/analyze?model=mistral" | jq

# Using llama3
curl -X POST "http://localhost:3999/chaos/analyze?model=llama3" | jq
```

### Expected Response
```json
{
  "summary": "System shows moderate resilience with 85% success rate. The /products route is experiencing elevated error rates due to chaos injection...",
  "patterns": [
    {
      "type": "error_spike",
      "description": "/products route showing 30% error rate, consistent with configured chaos settings",
      "severity": "medium",
      "affectedRoutes": ["/products"]
    }
  ],
  "recommendations": [
    {
      "title": "Implement Circuit Breaker Pattern",
      "description": "High error rate on /products suggests need for circuit breaker to prevent cascade failures",
      "priority": "high",
      "actionItems": [
        "Add circuit breaker middleware",
        "Configure failure threshold at 50%",
        "Set recovery timeout to 30 seconds"
      ],
      "impact": "Reduce error propagation and improve system stability"
    }
  ],
  "anomalies": [
    {
      "metric": "errorRate",
      "expected": 5.0,
      "actual": 30.0,
      "deviation": 500.0,
      "description": "Error rate significantly higher than baseline"
    }
  ],
  "healthScore": 72,
  "generatedAt": "2026-04-08T09:30:00Z",
  "model": "phi3",
  "processingTimeMs": 2340
}
```

---

## Step 8: Save Analysis Reports

### Save to File
```bash
curl -X POST http://localhost:3999/chaos/analyze > analysis-$(date +%Y%m%d-%H%M%S).json
```

### Pretty Print
```bash
curl -X POST http://localhost:3999/chaos/analyze | jq '.' > analysis-report.json
```

### Extract Key Insights
```bash
# Get summary and health score
curl -X POST http://localhost:3999/chaos/analyze | jq '{summary, healthScore, recommendations: .recommendations[].title}'

# Get only high-priority recommendations
curl -X POST http://localhost:3999/chaos/analyze | jq '.recommendations[] | select(.priority == "high" or .priority == "critical")'

# Get anomalies
curl -X POST http://localhost:3999/chaos/analyze | jq '.anomalies'
```

---

## Step 9: Automated Periodic Analysis

### Every 5 Minutes
```bash
while true; do
  echo "=== Analysis at $(date) ===" >> daily-analysis.log
  curl -X POST http://localhost:3999/chaos/analyze | \
    jq '{summary, healthScore, patterns: .patterns | length, recommendations: .recommendations | length}' \
    >> daily-analysis.log
  sleep 300
done
```

### Hourly with Different Models
```bash
#!/bin/bash
MODELS=("phi3" "mistral" "llama3")

for model in "${MODELS[@]}"; do
  echo "Analyzing with $model..."
  curl -X POST "http://localhost:3999/chaos/analyze?model=$model" \
    > "analysis-$model-$(date +%Y%m%d-%H%M%S).json"
  sleep 60
done
```

---

## Troubleshooting

### Issue: "Ollama server is not available"

**Solution:**
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# If not, start it
ollama serve
```

### Issue: "model 'phi3' not found"

**Solution:**
```bash
# Pull the model
ollama pull phi3

# Verify it's installed
ollama list
```

### Issue: Analysis takes too long

**Solutions:**
1. Use a smaller model (phi3 instead of llama3)
2. Reduce the amount of data being analyzed
3. Increase timeout in code if needed

### Issue: JSON parsing errors

**Cause:** LLM sometimes adds extra text around JSON

**Solution:** The analyzer automatically extracts JSON from the response. If issues persist, try a different model.

### Issue: Low-quality insights

**Solutions:**
1. Use a larger model (llama3 instead of phi3)
2. Generate more test data for better analysis
3. Enable chaos on multiple routes for richer patterns

---

## Performance Tips

### 1. Model Selection
- **Development**: Use phi3 (fast, good enough)
- **Production**: Use mistral or llama3 (better insights)
- **CI/CD**: Use phi3 (speed matters)

### 2. Analysis Frequency
- **Real-time**: Not recommended (too slow)
- **Every 5-10 minutes**: Good for active development
- **Hourly**: Good for production monitoring
- **On-demand**: Best for deep analysis

### 3. Data Volume
- Keep request logs to last 100 entries (already implemented)
- Analyze when you have at least 50 requests
- More data = better insights

---

## Integration with Frontend

### Add Analysis Button to Dashboard

```typescript
// frontend/src/services/api.ts
export const api = {
  // ... existing methods ...
  
  analyzeSystem: async (model = 'phi3'): Promise<AnalysisResponse> => {
    const res = await fetch(`${API_BASE}/chaos/analyze?model=${model}`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Analysis failed');
    return res.json();
  }
};

// frontend/src/pages/Dashboard.tsx
const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
const [analyzing, setAnalyzing] = useState(false);

const runAnalysis = async () => {
  setAnalyzing(true);
  try {
    const result = await api.analyzeSystem('phi3');
    setAnalysis(result);
  } catch (error) {
    console.error('Analysis failed:', error);
  } finally {
    setAnalyzing(false);
  }
};

// In your JSX
<button onClick={runAnalysis} disabled={analyzing}>
  {analyzing ? 'Analyzing...' : '🤖 AI Analysis'}
</button>

{analysis && (
  <div className="analysis-results">
    <h3>Health Score: {analysis.healthScore}/100</h3>
    <p>{analysis.summary}</p>
    <h4>Recommendations:</h4>
    <ul>
      {analysis.recommendations.map((rec, i) => (
        <li key={i}>
          <strong>{rec.title}</strong> ({rec.priority})
          <p>{rec.description}</p>
        </li>
      ))}
    </ul>
  </div>
)}
```

---

## Example Use Cases

### 1. Daily Health Check
```bash
#!/bin/bash
# daily-health-check.sh

echo "Running daily chaos testing health check..."

# Generate test traffic
./generate-traffic.sh

# Wait for metrics to accumulate
sleep 10

# Run analysis
ANALYSIS=$(curl -s -X POST http://localhost:3999/chaos/analyze)
HEALTH_SCORE=$(echo $ANALYSIS | jq -r '.healthScore')

echo "Health Score: $HEALTH_SCORE"

if [ $(echo "$HEALTH_SCORE < 70" | bc) -eq 1 ]; then
  echo "⚠️  WARNING: Health score below threshold!"
  echo $ANALYSIS | jq '.recommendations'
  # Send alert (email, Slack, etc.)
fi
```

### 2. Pre-Deployment Check
```bash
#!/bin/bash
# pre-deploy-check.sh

echo "Running pre-deployment chaos analysis..."

# Enable aggressive chaos
curl -X PUT http://localhost:3999/chaos/config -d '{
  "/api/*": {
    "enabled": true,
    "failureRate": 0.5,
    "delayRate": 0.3
  }
}'

# Generate heavy load
./load-test.sh

# Analyze results
ANALYSIS=$(curl -s -X POST "http://localhost:3999/chaos/analyze?model=llama3")
CRITICAL_ISSUES=$(echo $ANALYSIS | jq '[.recommendations[] | select(.priority == "critical")] | length')

if [ $CRITICAL_ISSUES -gt 0 ]; then
  echo "❌ DEPLOYMENT BLOCKED: Critical issues found"
  echo $ANALYSIS | jq '.recommendations[] | select(.priority == "critical")'
  exit 1
fi

echo "✅ System ready for deployment"
```

### 3. Continuous Monitoring
```bash
#!/bin/bash
# continuous-monitor.sh

while true; do
  ANALYSIS=$(curl -s -X POST http://localhost:3999/chaos/analyze)
  HEALTH=$(echo $ANALYSIS | jq -r '.healthScore')
  TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
  
  echo "$TIMESTAMP | Health: $HEALTH" >> health-log.txt
  
  # Alert on degradation
  if [ $(echo "$HEALTH < 60" | bc) -eq 1 ]; then
    echo "🚨 ALERT: System health degraded to $HEALTH"
    # Send notification
  fi
  
  sleep 600  # Every 10 minutes
done
```

---

## Next Steps

1. ✅ Install and test Ollama
2. ✅ Generate test data
3. ✅ Run first analysis
4. ⏳ Integrate with frontend dashboard
5. ⏳ Set up automated monitoring
6. ⏳ Create custom analysis scripts
7. ⏳ Fine-tune prompts for your use case

---

## Resources

- **Ollama Documentation**: https://ollama.com/docs
- **Available Models**: https://ollama.com/library
- **Model Comparison**: See LLM_INTEGRATION_DESIGN.md
- **API Reference**: See back-end/proxy/llm/analyzer.go

---

## Support

For issues or questions:
1. Check Ollama logs: `ollama logs`
2. Check proxy logs for 🤖 emoji markers
3. Verify model is installed: `ollama list`
4. Test Ollama directly: `ollama run phi3 "test"`

---

**Status**: ✅ Ready for Testing  
**Last Updated**: 2026-04-08