# Chaos Testing Middleware System

A comprehensive chaos engineering system with a middleware proxy, dummy e-commerce backend, and React dashboard for monitoring and controlling chaos experiments.

## 🏗️ Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  React Dashboard│─────▶│ Chaos Middleware │─────▶│ Backend Service │
│   (Port 5000)   │      │   (Port 4000)    │      │   (Port 8080)   │
└─────────────────┘      └──────────────────┘      └─────────────────┘
```

## 📦 Components

### 1. Backend Service (Port 8080)
Dummy e-commerce service with:
- Users management
- Items catalog
- Orders processing
- Health check endpoint

**Endpoints:**
- `GET /health` - Health check
- `GET /users` - List all users
- `GET /user?id={id}` - Get specific user
- `GET /items` - List all items
- `GET /item?id={id}` - Get specific item
- `GET /orders` - List all orders
- `GET /order?id={id}` - Get specific order
- `POST /orders` - Create new order

### 2. Chaos Middleware (Port 4000)
Proxy middleware that:
- Routes requests to backend
- Injects configurable failures
- Adds artificial latency
- Tracks statistics

**Features:**
- **Proxy Mode**: All non-chaos requests are forwarded to backend
- **Chaos Control**: `/chaos/*` endpoints for configuration
- **Statistics**: Real-time tracking of requests, failures, and latency

**Chaos Endpoints:**
- `GET /chaos` - Get all chaos configs and stats
- `GET /chaos/{path}` - Get chaos config for specific endpoint
- `POST /chaos/{path}` - Set chaos config for specific endpoint
- `DELETE /chaos/{path}` - Remove chaos config

**Configuration Format:**
```json
{
  "random_failure": "10%",
  "random_latency_min": "0ms",
  "random_latency_max": "500ms"
}
```

### 3. React Dashboard (Port 5000)
Web interface for:
- Viewing real-time statistics
- Configuring chaos settings
- Monitoring endpoint health

**Features:**
- Overall statistics dashboard
- Per-endpoint metrics
- Visual success rate indicators
- Easy chaos configuration UI

## 🚀 Getting Started

### Prerequisites
- Go 1.16 or higher
- Node.js 14 or higher (if available)
- npm or yarn (if available)

### Installation & Running

#### Option 1: Start Backend + Middleware Only (No Node.js required)
```bash
./start-backend-middleware.sh
```
This starts the backend (port 8080) and middleware (port 4000). You can test everything with curl commands!

#### Option 2: Start All Services (Requires Node.js/npm)
```bash
./start-all.sh
```
This starts backend, middleware, and the React dashboard (port 5000).

#### Option 3: Start Services Individually

**1. Start Backend Service**
```bash
cd backend
go run main.go
```
Backend will start on `http://localhost:8080`

**2. Start Chaos Middleware**
```bash
cd middleware
go run main.go
```
Middleware will start on `http://localhost:4000`

**3. Start React Dashboard (Optional - requires Node.js/npm)**
```bash
cd frontend
npm install
npm start
```
Dashboard will start on `http://localhost:5000`

## 📖 Usage Examples

### Making Requests Through Middleware

Instead of calling backend directly at `localhost:8080`, call through middleware at `localhost:4000`:

```bash
# Get all items (proxied through middleware)
curl http://localhost:4000/items

# Get all orders
curl http://localhost:4000/orders

# Create an order
curl -X POST http://localhost:4000/orders \
  -H "Content-Type: application/json" \
  -d '{"user_id": 1, "items": [1, 2]}'
```

### Configuring Chaos

```bash
# Add 20% failure rate to /orders endpoint
curl -X POST http://localhost:4000/chaos/orders \
  -H "Content-Type: application/json" \
  -d '{
    "random_failure": "20%",
    "random_latency_min": "100ms",
    "random_latency_max": "1000ms"
  }'

# Get chaos config for /orders
curl http://localhost:4000/chaos/orders

# Get all chaos configs and stats
curl http://localhost:4000/chaos

# Remove chaos config for /orders
curl -X DELETE http://localhost:4000/chaos/orders
```

### Testing Chaos Behavior

```bash
# Make multiple requests to see chaos in action
for i in {1..10}; do
  echo "Request $i:"
  curl -s http://localhost:4000/items | head -n 1
  echo ""
done
```

## 🎯 Configuration

### Middleware Configuration
Edit `middleware/config.json`:
```json
{
  "actual_url": "http://localhost:8080",
  "middleware_port": "4000"
}
```

## 📊 Dashboard Features

1. **Overall Statistics**
   - Total requests
   - Success/failure counts
   - Average response time
   - Success rate percentage

2. **Endpoint Statistics**
   - Per-endpoint metrics
   - Visual success rate bars
   - Request counts

3. **Chaos Configuration**
   - View active chaos configs
   - Configure chaos for any endpoint
   - Edit or delete existing configs
   - Real-time updates

## 🧪 Testing Scenarios

### Scenario 1: Gradual Failure Introduction
1. Start with no chaos
2. Add 10% failure rate
3. Increase to 25%
4. Monitor impact on success rate

### Scenario 2: Latency Testing
1. Add 500ms-2s latency to critical endpoints
2. Observe response time impact
3. Test timeout handling

### Scenario 3: Combined Chaos
1. Add both failures and latency
2. Test system resilience
3. Monitor recovery behavior

## 🔧 Development

### Project Structure
```
chaos-testing/
├── backend/
│   ├── main.go           # E-commerce backend service
│   └── go.mod
├── middleware/
│   ├── main.go           # Chaos middleware
│   ├── config.json       # Configuration
│   └── go.mod
├── frontend/
│   ├── src/
│   │   ├── App.js        # Main app component
│   │   ├── components/
│   │   │   ├── Dashboard.js      # Statistics dashboard
│   │   │   └── ChaosConfig.js    # Chaos configuration UI
│   │   └── ...
│   └── package.json
└── README.md
```

## 🎨 Features

- ✅ Configurable failure injection
- ✅ Random latency injection
- ✅ Real-time statistics tracking
- ✅ Per-endpoint chaos configuration
- ✅ Beautiful React dashboard
- ✅ CORS enabled for cross-origin requests
- ✅ Auto-refresh statistics
- ✅ Easy-to-use UI for chaos control

## 📝 Notes

- The middleware preserves the original API path when proxying
- Statistics are tracked per endpoint
- Chaos configurations are stored in memory (reset on restart)
- All three services must be running for full functionality
- The dashboard auto-refreshes every 5 seconds

## 🤝 Contributing

Feel free to extend this system with:
- Additional chaos patterns (circuit breakers, rate limiting)
- Persistent storage for configurations
- More sophisticated failure scenarios
- Advanced analytics and reporting

## 📄 License

This is a demonstration project for chaos engineering concepts.