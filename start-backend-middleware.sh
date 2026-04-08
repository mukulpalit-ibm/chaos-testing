#!/bin/bash

# Start Backend and Middleware Only (No Node.js required)

echo "🌪️  Starting Chaos Testing System (Backend + Middleware)"
echo ""

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo "⚠️  Port $1 is already in use. Please stop the service using it first."
        return 1
    fi
    return 0
}

# Check if ports are available
echo "Checking ports..."
check_port 8080 || exit 1
check_port 4000 || exit 1
echo "✅ Ports are available"
echo ""

# Start Backend Service
echo "🚀 Starting Backend Service (port 8080)..."
cd backend
go run main.go &
BACKEND_PID=$!
cd ..
sleep 2

# Start Chaos Middleware
echo "🌪️  Starting Chaos Middleware (port 4000)..."
cd middleware
go run main.go &
MIDDLEWARE_PID=$!
cd ..
sleep 2

echo ""
echo "✅ Services started!"
echo ""
echo "📍 Service URLs:"
echo "   Backend:    http://localhost:8080"
echo "   Middleware: http://localhost:4000"
echo ""
echo "📝 Note: Frontend dashboard requires Node.js/npm to be installed."
echo "   You can still use the middleware and test with curl commands."
echo ""
echo "💡 Example commands:"
echo "   curl http://localhost:4000/items"
echo "   curl http://localhost:4000/orders"
echo "   curl -X POST http://localhost:4000/chaos/orders -H 'Content-Type: application/json' -d '{\"random_failure\":\"10%\"}'"
echo ""
echo "💡 To stop all services, press Ctrl+C"
echo ""

# Wait for Ctrl+C
trap "echo ''; echo '🛑 Stopping all services...'; kill $BACKEND_PID $MIDDLEWARE_PID 2>/dev/null; exit" INT

wait

# Made with Bob
