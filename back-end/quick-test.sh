#!/bin/bash

# Quick test to verify LLM integration works

echo "🧪 Quick LLM Integration Test"
echo "=============================="
echo ""

# Check Ollama
echo "1. Checking Ollama..."
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "✓ Ollama is running"
    echo "   Available models:"
    curl -s http://localhost:11434/api/tags | jq -r '.models[].name' | sed 's/^/   - /'
else
    echo "✗ Ollama not running. Start with: ollama serve"
    exit 1
fi
echo ""

# Check proxy
echo "2. Checking proxy..."
if curl -s http://localhost:3999/health > /dev/null 2>&1; then
    echo "✓ Proxy is running"
else
    echo "✗ Proxy not running. Start with: cd back-end/proxy && go run proxy.go"
    exit 1
fi
echo ""

# Generate quick traffic
echo "3. Generating test traffic..."
for i in {1..10}; do
    curl -s http://localhost:3999/products > /dev/null &
done
wait
echo "✓ Generated 10 requests"
echo ""

# Test analysis
echo "4. Running AI analysis..."
echo "   (This may take 3-5 seconds with llama3)"
echo ""

RESPONSE=$(curl -s -X POST "http://localhost:3999/chaos/analyze?model=llama3")

if echo "$RESPONSE" | jq -e '.healthScore' > /dev/null 2>&1; then
    echo "✅ SUCCESS! Analysis completed"
    echo ""
    echo "Health Score: $(echo "$RESPONSE" | jq -r '.healthScore')/100"
    echo "Model Used: $(echo "$RESPONSE" | jq -r '.model')"
    echo "Processing Time: $(echo "$RESPONSE" | jq -r '.processingTimeMs')ms"
    echo ""
    echo "Summary:"
    echo "$RESPONSE" | jq -r '.summary' | fold -s -w 70 | sed 's/^/  /'
    echo ""
    echo "Full report saved to: quick-analysis.json"
    echo "$RESPONSE" | jq '.' > quick-analysis.json
else
    echo "❌ FAILED"
    echo "Response:"
    echo "$RESPONSE" | jq '.'
    exit 1
fi

# Made with Bob
