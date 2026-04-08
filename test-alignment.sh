#!/bin/bash

echo "🔍 Testing Frontend-Backend Alignment"
echo "======================================"
echo ""

# Check if backend is running
echo "1. Checking if proxy is running on :3999..."
if curl -s http://localhost:3999/health > /dev/null 2>&1; then
    echo "   ✅ Proxy is running"
else
    echo "   ❌ Proxy is not running. Start it with: cd back-end/proxy && go run proxy.go"
    exit 1
fi

echo ""
echo "2. Testing /chaos/routes endpoint..."
ROUTES_RESPONSE=$(curl -s http://localhost:3999/chaos/routes)
echo "   Response: $ROUTES_RESPONSE"

# Check if id field exists
if echo "$ROUTES_RESPONSE" | grep -q '"id"'; then
    echo "   ✅ 'id' field is present"
else
    echo "   ❌ 'id' field is missing"
fi

# Check if method is ANY
if echo "$ROUTES_RESPONSE" | grep -q '"method":"ANY"'; then
    echo "   ✅ 'method' field is 'ANY'"
else
    echo "   ⚠️  'method' field is not 'ANY'"
fi

echo ""
echo "3. Testing /chaos/metrics endpoint..."
METRICS_RESPONSE=$(curl -s http://localhost:3999/chaos/metrics)
echo "   Response: $METRICS_RESPONSE"

# Check required fields
for field in totalRequests injectedRequests successRate averageLatency activeRouteRules; do
    if echo "$METRICS_RESPONSE" | grep -q "\"$field\""; then
        echo "   ✅ '$field' field is present"
    else
        echo "   ❌ '$field' field is missing"
    fi
done

echo ""
echo "4. Testing /chaos/requests endpoint..."
REQUESTS_RESPONSE=$(curl -s http://localhost:3999/chaos/requests)
echo "   Response (first item): $(echo "$REQUESTS_RESPONSE" | jq '.[0]' 2>/dev/null || echo "No requests yet")"

if [ "$(echo "$REQUESTS_RESPONSE" | jq 'length' 2>/dev/null)" -gt 0 ]; then
    # Check for chaosType field
    if echo "$REQUESTS_RESPONSE" | grep -q '"chaosType"'; then
        echo "   ✅ 'chaosType' field is present"
        
        # Check if corruption type exists
        if echo "$REQUESTS_RESPONSE" | grep -q '"chaosType":"corruption"'; then
            echo "   ✅ 'corruption' chaos type is supported"
        else
            echo "   ℹ️  No 'corruption' events yet (may need to enable corruption)"
        fi
    else
        echo "   ℹ️  No chaos events yet"
    fi
else
    echo "   ℹ️  No requests logged yet. Generate traffic to test."
fi

echo ""
echo "5. Testing /chaos/config endpoint..."
CONFIG_RESPONSE=$(curl -s http://localhost:3999/chaos/config)
echo "   Response: $(echo "$CONFIG_RESPONSE" | jq '.' 2>/dev/null | head -20)"

# Check for advanced fields
if echo "$CONFIG_RESPONSE" | grep -q '"corruptionRate"'; then
    echo "   ✅ 'corruptionRate' field is supported"
else
    echo "   ℹ️  'corruptionRate' not in current config"
fi

if echo "$CONFIG_RESPONSE" | grep -q '"targetHeader"'; then
    echo "   ✅ 'targetHeader' field is supported"
else
    echo "   ℹ️  'targetHeader' not in current config"
fi

echo ""
echo "======================================"
echo "✅ Alignment test complete!"
echo ""
echo "Next steps:"
echo "1. Start frontend: cd frontend && npm run dev"
echo "2. Open http://localhost:5173"
echo "3. Verify UI displays all data correctly"
echo "4. Check browser console for TypeScript errors"

# Made with Bob
