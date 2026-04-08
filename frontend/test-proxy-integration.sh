#!/bin/bash

echo "Testing Proxy Integration"
echo "========================="
echo ""

# Check if backend is running
echo "1. Checking if backend API is running on port 4000..."
if curl -s http://localhost:4000/health > /dev/null 2>&1; then
    echo "✅ Backend API is running"
else
    echo "❌ Backend API is NOT running on port 4000"
    echo "   Start it with: cd back-end && go run backend.go"
    exit 1
fi

# Check if proxy is running
echo ""
echo "2. Checking if chaos proxy is running on port 3999..."
if curl -s http://localhost:3999/chaos/config > /dev/null 2>&1; then
    echo "✅ Chaos proxy is running"
else
    echo "❌ Chaos proxy is NOT running on port 3999"
    echo "   Start it with: cd back-end/proxy && go run proxy.go"
    exit 1
fi

# Generate traffic through proxy
echo ""
echo "3. Generating traffic through proxy to discover routes..."
echo "   Sending requests to /products, /users/123, /orders..."

curl -s http://localhost:3999/products > /dev/null
echo "   ✓ GET /products"

curl -s http://localhost:3999/users/123 > /dev/null
echo "   ✓ GET /users/123"

curl -s -X POST http://localhost:3999/orders > /dev/null
echo "   ✓ POST /orders"

# Wait a moment for proxy to register routes
sleep 1

# Check discovered routes
echo ""
echo "4. Checking discovered routes in proxy..."
ROUTES=$(curl -s http://localhost:3999/chaos/routes)
echo "$ROUTES" | jq . 2>/dev/null || echo "$ROUTES"

# Check current config
echo ""
echo "5. Current chaos configuration..."
CONFIG=$(curl -s http://localhost:3999/chaos/config)
echo "$CONFIG" | jq . 2>/dev/null || echo "$CONFIG"

echo ""
echo "========================="
echo "✅ Integration test complete!"
echo ""
echo "Now refresh your frontend Configuration page to see the discovered routes."
echo "The routes should now appear with backend data merged with mock data."

# Made with Bob
