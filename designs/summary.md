# Phase 1 – Chaos Middleware Hackathon Plan

## 🎯 Goal
Build a minimal end-to-end working system in the first 3–4 hours where requests flow through a proxy, chaos can be toggled per route, and effects (failures/latency) are immediately visible.

## Components

### Sample Backend (Go, :4000)
Create a simple mock API service with static responses:
- GET /products
- GET /users/:id
- POST /orders
- GET /health

Keep it extremely simple: no database, no business logic, just hardcoded JSON responses.

### Chaos Proxy (Go, :3999)
Core component using net/http/httputil.ReverseProxy.

Responsibilities:
- Forward all incoming requests to :4000
- Intercept requests and inject chaos

Chaos features (basic only):
- Random delay (e.g. 0–2 seconds)
- Random error (e.g. return HTTP 500)

State management:
- In-memory route registry (learn routes from incoming traffic)
- Per-route config:
  - enabled (true/false)
  - failureRate (0–1)

### Control API (inside proxy)

GET /chaos/routes
Returns discovered routes:
[
  { "method": "GET", "path": "/products" }
]

GET /chaos/config

PUT /chaos/config
{
  "/orders": {
    "enabled": true,
    "failureRate": 0.5
  }
}

### Dashboard (React, :5173)

Features:
- Fetch /chaos/routes
- Display list of routes
- Per-route controls:
  - Toggle chaos ON/OFF
  - Failure rate slider

Optional (only if time permits):
- Simple request log using polling

## 🔁 Expected Demo Flow

1. Call backend directly → http://localhost:4000/orders → works normally  
2. Call via proxy → http://localhost:3999/orders → still works  
3. Enable chaos for /orders via dashboard  
4. Requests start failing or slowing down  
5. Behavior change is immediately visible  

## ⚠️ Non-goals

- No LLM integration  
- No rule engine  
- No WebSockets  
- No advanced UI  
- No OpenAPI/Swagger parsing  

## ✅ Definition of Done

- Able to hit http://localhost:3999/orders  
- Dashboard can toggle chaos per route  
- Requests reflect chaos instantly (failures/latency)  
- System works end-to-end without manual intervention  

If this works cleanly, the foundation is strong and ready for extensions.