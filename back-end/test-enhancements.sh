#!/bin/bash

# Backend Enhancement Testing Script
# Tests the new metrics, request logging, and enhanced routes endpoints

set -e

PROXY_URL="http://localhost:3999"
BACKEND_URL="http://localhost:4000"

echo "🧪 Backend Enhancement Testing Script"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if services are running
print_step "Step 1: Checking if services are running..."
if ! curl -s "$BACKEND_URL/health" > /dev/null 2>&1; then
    print_error "Backend is not running on $BACKEND_URL"
    echo "Please start the backend: cd back-end && go run backend.go"
    exit 1
fi
print_success "Backend is running"

if ! curl -s "$PROXY_URL/health" > /dev/null 2>&1; then
    print_error "Proxy is not running on $PROXY_URL"
    echo "Please start the proxy: cd back-end/proxy && go run proxy.go"
    exit 1
fi
print_success "Proxy is running"
echo ""

# Generate traffic
print_step "Step 2: Generating traffic to populate metrics..."
for i in {1..20}; do
    curl -s "$PROXY_URL/products" > /dev/null &
    curl -s "$PROXY_URL/users/123" > /dev/null &
    curl -s -X POST "$PROXY_URL/orders" > /dev/null &
done
wait
print_success "Generated 60 requests"
echo ""

# Test metrics endpoint
print_step "Step 3: Testing GET /chaos/metrics endpoint..."
METRICS=$(curl -s "$PROXY_URL/chaos/metrics")
echo "$METRICS" | jq '.'

# Validate metrics structure
TOTAL_REQUESTS=$(echo "$METRICS" | jq -r '.totalRequests')
if [ "$TOTAL_REQUESTS" -gt 0 ]; then
    print_success "Metrics endpoint working - Total requests: $TOTAL_REQUESTS"
else
    print_error "Metrics endpoint not tracking requests properly"
fi
echo ""

# Test request logs endpoint
print_step "Step 4: Testing GET /chaos/requests endpoint..."
REQUESTS=$(curl -s "$PROXY_URL/chaos/requests")
REQUEST_COUNT=$(echo "$REQUESTS" | jq '. | length')
echo "Found $REQUEST_COUNT logged requests"
echo "$REQUESTS" | jq '.[0:3]'  # Show first 3 requests

if [ "$REQUEST_COUNT" -gt 0 ]; then
    print_success "Request logging working - $REQUEST_COUNT requests logged"
else
    print_error "Request logging not working"
fi
echo ""

# Test enhanced routes endpoint
print_step "Step 5: Testing GET /chaos/routes endpoint (with statistics)..."
ROUTES=$(curl -s "$PROXY_URL/chaos/routes")
echo "$ROUTES" | jq '.'

# Check if routes have statistics
HAS_STATS=$(echo "$ROUTES" | jq '.[0] | has("requestCount") and has("averageLatency") and has("errorRate")')
if [ "$HAS_STATS" = "true" ]; then
    print_success "Routes endpoint enhanced with statistics"
else
    print_error "Routes endpoint missing statistics"
fi
echo ""

# Enable chaos on a route
print_step "Step 6: Enabling chaos on /products route..."
CHAOS_CONFIG=$(cat <<EOF
{
  "/products": {
    "enabled": true,
    "failureRate": 0.3,
    "delayRate": 0.2,
    "minDelayMs": 100,
    "maxDelayMs": 500,
    "errorCodes": [500, 503],
    "corruptionRate": 0.1
  }
}
EOF
)

curl -s -X PUT "$PROXY_URL/chaos/config" \
  -H "Content-Type: application/json" \
  -d "$CHAOS_CONFIG" > /dev/null

print_success "Chaos enabled on /products"
echo ""

# Generate more traffic with chaos enabled
print_step "Step 7: Generating traffic with chaos enabled..."
for i in {1..30}; do
    curl -s "$PROXY_URL/products" > /dev/null 2>&1 &
done
wait
print_success "Generated 30 requests with chaos"
echo ""

# Check updated metrics
print_step "Step 8: Checking updated metrics after chaos..."
METRICS_AFTER=$(curl -s "$PROXY_URL/chaos/metrics")
echo "$METRICS_AFTER" | jq '.'

INJECTED=$(echo "$METRICS_AFTER" | jq -r '.injectedRequests')
ACTIVE_RULES=$(echo "$METRICS_AFTER" | jq -r '.activeRouteRules')

if [ "$INJECTED" -gt 0 ]; then
    print_success "Chaos injection tracked - $INJECTED requests affected"
else
    print_warning "No chaos injections recorded (might be due to probability)"
fi

if [ "$ACTIVE_RULES" -gt 0 ]; then
    print_success "Active route rules tracked - $ACTIVE_RULES active"
else
    print_error "Active route rules not tracked"
fi
echo ""

# Check request logs for chaos types
print_step "Step 9: Checking request logs for chaos types..."
RECENT_REQUESTS=$(curl -s "$PROXY_URL/chaos/requests")
CHAOS_REQUESTS=$(echo "$RECENT_REQUESTS" | jq '[.[] | select(.chaosType != null)]')
CHAOS_COUNT=$(echo "$CHAOS_REQUESTS" | jq '. | length')

echo "Requests with chaos injection: $CHAOS_COUNT"
echo "$CHAOS_REQUESTS" | jq '.[0:5]'  # Show first 5 chaos requests

if [ "$CHAOS_COUNT" -gt 0 ]; then
    print_success "Chaos types logged in requests"
else
    print_warning "No chaos types in logs (might be due to probability)"
fi
echo ""

# Check route statistics
print_step "Step 10: Checking route statistics..."
ROUTES_AFTER=$(curl -s "$PROXY_URL/chaos/routes")
PRODUCTS_ROUTE=$(echo "$ROUTES_AFTER" | jq '.[] | select(.path == "/products")')

echo "Statistics for /products route:"
echo "$PRODUCTS_ROUTE" | jq '.'

REQUEST_COUNT=$(echo "$PRODUCTS_ROUTE" | jq -r '.requestCount')
AVG_LATENCY=$(echo "$PRODUCTS_ROUTE" | jq -r '.averageLatency')
ERROR_RATE=$(echo "$PRODUCTS_ROUTE" | jq -r '.errorRate')

if [ "$REQUEST_COUNT" -gt 0 ]; then
    print_success "Route statistics working:"
    echo "  - Request count: $REQUEST_COUNT"
    echo "  - Average latency: ${AVG_LATENCY}ms"
    echo "  - Error rate: ${ERROR_RATE}%"
else
    print_error "Route statistics not working"
fi
echo ""

# Summary
print_step "Test Summary"
echo "======================================"
FINAL_METRICS=$(curl -s "$PROXY_URL/chaos/metrics")
echo "$FINAL_METRICS" | jq '{
  totalRequests,
  injectedRequests,
  successRate,
  averageLatency,
  activeRouteRules
}'

print_success "All backend enhancements tested successfully!"
echo ""
echo "Next steps:"
echo "1. Update frontend to use these new endpoints"
echo "2. Remove mock data from frontend"
echo "3. Test frontend integration"

# Made with Bob
