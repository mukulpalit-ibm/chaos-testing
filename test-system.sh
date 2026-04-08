#!/bin/bash

# Chaos Testing System Test Script

echo "🧪 Testing Chaos Testing System"
echo "================================"
echo ""

MIDDLEWARE_URL="http://localhost:4000"
BACKEND_URL="http://localhost:8080"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local method=${3:-GET}
    
    echo -n "Testing $name... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    else
        response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url")
    fi
    
    if [ "$response" = "200" ] || [ "$response" = "201" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (HTTP $response)"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (HTTP $response)"
        ((TESTS_FAILED++))
        return 1
    fi
}

echo "1️⃣  Testing Backend Service (Port 8080)"
echo "----------------------------------------"
test_endpoint "Health Check" "$BACKEND_URL/health"
test_endpoint "Get Users" "$BACKEND_URL/users"
test_endpoint "Get Items" "$BACKEND_URL/items"
test_endpoint "Get Orders" "$BACKEND_URL/orders"
echo ""

echo "2️⃣  Testing Middleware Proxy (Port 4000)"
echo "----------------------------------------"
test_endpoint "Proxy to /users" "$MIDDLEWARE_URL/users"
test_endpoint "Proxy to /items" "$MIDDLEWARE_URL/items"
test_endpoint "Proxy to /orders" "$MIDDLEWARE_URL/orders"
echo ""

echo "3️⃣  Testing Chaos Endpoints"
echo "----------------------------------------"
test_endpoint "Get all chaos configs" "$MIDDLEWARE_URL/chaos"

# Configure chaos for /orders
echo -n "Configuring chaos for /orders... "
response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$MIDDLEWARE_URL/chaos/orders" \
    -H "Content-Type: application/json" \
    -d '{"random_failure":"10%","random_latency_min":"0ms","random_latency_max":"100ms"}')

if [ "$response" = "200" ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAILED${NC}"
    ((TESTS_FAILED++))
fi

test_endpoint "Get chaos config for /orders" "$MIDDLEWARE_URL/chaos/orders"
echo ""

echo "4️⃣  Testing Chaos Behavior"
echo "----------------------------------------"
echo "Making 10 requests to /orders to test chaos injection..."

SUCCESS_COUNT=0
FAILURE_COUNT=0

for i in {1..10}; do
    response=$(curl -s -o /dev/null -w "%{http_code}" "$MIDDLEWARE_URL/orders")
    if [ "$response" = "200" ]; then
        ((SUCCESS_COUNT++))
    else
        ((FAILURE_COUNT++))
    fi
done

echo "Results: $SUCCESS_COUNT successful, $FAILURE_COUNT failed"
if [ $FAILURE_COUNT -gt 0 ]; then
    echo -e "${GREEN}✓ Chaos injection working${NC} (some requests failed as expected)"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠ No failures detected${NC} (chaos might not be working or just lucky)"
fi
echo ""

echo "5️⃣  Cleanup"
echo "----------------------------------------"
echo -n "Removing chaos config for /orders... "
response=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$MIDDLEWARE_URL/chaos/orders")

if [ "$response" = "200" ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ FAILED${NC}"
    ((TESTS_FAILED++))
fi
echo ""

echo "================================"
echo "📊 Test Summary"
echo "================================"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi

# Made with Bob
