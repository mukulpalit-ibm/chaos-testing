#!/bin/bash

# LLM Integration Test Script
# Tests the complete AI analysis pipeline

set -e

PROXY_URL="http://localhost:3999"
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "🤖 LLM Integration Test Script"
echo "=============================="
echo ""

# Function to print colored output
print_step() {
    echo -e "${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Step 1: Check Ollama
print_step "Step 1: Checking Ollama server..."
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    print_success "Ollama server is running"
else
    print_error "Ollama server is not running"
    echo "Please start Ollama: ollama serve"
    exit 1
fi

# Step 2: Check models
print_step "Step 2: Checking installed models..."
MODELS=$(ollama list | tail -n +2 | awk '{print $1}')
echo "Available models:"
echo "$MODELS"

if echo "$MODELS" | grep -q "llama3"; then
    print_success "llama3 model is installed"
else
    print_error "llama3 model not found"
    echo "Installing llama3..."
    ollama pull llama3
fi
echo ""

# Step 3: Check proxy
print_step "Step 3: Checking proxy server..."
if curl -s "$PROXY_URL/health" > /dev/null 2>&1; then
    print_success "Proxy is running"
else
    print_error "Proxy is not running on $PROXY_URL"
    echo "Please start: cd back-end/proxy && go run proxy.go"
    exit 1
fi
echo ""

# Step 4: Generate test data
print_step "Step 4: Generating test traffic..."
echo "Generating 30 requests..."
for i in {1..10}; do
    curl -s "$PROXY_URL/products" > /dev/null &
    curl -s "$PROXY_URL/users/123" > /dev/null &
    curl -s -X POST "$PROXY_URL/orders" > /dev/null &
done
wait
print_success "Generated 30 requests"
echo ""

# Step 5: Enable chaos
print_step "Step 5: Enabling chaos on /products..."
curl -s -X PUT "$PROXY_URL/chaos/config" \
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
  }' > /dev/null
print_success "Chaos enabled"
echo ""

# Step 6: Generate chaos traffic
print_step "Step 6: Generating traffic with chaos..."
for i in {1..20}; do
    curl -s "$PROXY_URL/products" > /dev/null 2>&1 &
done
wait
print_success "Generated 20 requests with chaos"
echo ""

# Step 7: Check metrics
print_step "Step 7: Checking current metrics..."
METRICS=$(curl -s "$PROXY_URL/chaos/metrics")
echo "$METRICS" | jq '{totalRequests, chaosRequests: .injectedRequests, successRate, averageLatency}'
echo ""

# Step 8: Test analysis with llama3
print_step "Step 8: Running AI analysis with llama3..."
echo "This may take 5-10 seconds..."
ANALYSIS=$(curl -s -X POST "$PROXY_URL/chaos/analyze?model=llama3")

if echo "$ANALYSIS" | jq -e '.healthScore' > /dev/null 2>&1; then
    print_success "Analysis completed successfully!"
    echo ""
    
    # Display results
    echo "=== ANALYSIS RESULTS ==="
    echo ""
    
    echo "📊 Health Score:"
    echo "$ANALYSIS" | jq -r '.healthScore'
    echo ""
    
    echo "📝 Summary:"
    echo "$ANALYSIS" | jq -r '.summary'
    echo ""
    
    echo "🔍 Patterns Found:"
    echo "$ANALYSIS" | jq -r '.patterns[] | "  - [\(.severity | ascii_upcase)] \(.type): \(.description)"'
    echo ""
    
    echo "💡 Recommendations:"
    echo "$ANALYSIS" | jq -r '.recommendations[] | "  [\(.priority | ascii_upcase)] \(.title)\n    → \(.description)\n"'
    echo ""
    
    echo "⚠️  Anomalies:"
    echo "$ANALYSIS" | jq -r '.anomalies[] | "  - \(.metric): Expected \(.expected), Got \(.actual) (Deviation: \(.deviation)%)"'
    echo ""
    
    echo "⏱️  Processing Time: $(echo "$ANALYSIS" | jq -r '.processingTimeMs')ms"
    echo "🤖 Model Used: $(echo "$ANALYSIS" | jq -r '.model')"
    echo ""
    
    # Save full report
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    echo "$ANALYSIS" | jq '.' > "analysis-report-$TIMESTAMP.json"
    print_success "Full report saved to: analysis-report-$TIMESTAMP.json"
    
else
    print_error "Analysis failed"
    echo "Response:"
    echo "$ANALYSIS"
    exit 1
fi

echo ""
echo "=== TEST SUMMARY ==="
print_success "All tests passed!"
echo ""
echo "Next steps:"
echo "1. Review the analysis report"
echo "2. Try different models: phi3, mistral, llama3"
echo "3. Integrate with frontend dashboard"
echo "4. Set up automated periodic analysis"

# Made with Bob
