# Quick Start Guide

## Prerequisites Check

Before starting, check if you have Node.js installed:
```bash
node --version
npm --version
```

If these commands fail, you need to install Node.js first.

## Installation Options

### Option A: Install Node.js (Required for Dashboard)

**macOS:**
```bash
# Using Homebrew (recommended)
brew install node

# Or download from https://nodejs.org/
```

**After installing Node.js**, verify:
```bash
node --version  # Should show v14+ or higher
npm --version   # Should show 6+ or higher
```

### Option B: Use Without Dashboard (No Node.js needed)

If you don't want to install Node.js, you can still use the backend and middleware!

## Starting the System

### 🎯 WITH Dashboard (All 3 Components)

**Requirements:** Node.js and npm must be installed

```bash
./start-all.sh
```

This starts:
- Backend (port 8080)
- Middleware (port 4000)  
- Dashboard (port 5000)

Then open: http://localhost:5000

---

### 🎯 WITHOUT Dashboard (Backend + Middleware Only)

**Requirements:** Only Go (no Node.js needed)

```bash
./start-backend-middleware.sh
```

This starts:
- Backend (port 8080)
- Middleware (port 4000)

Test with curl commands:
```bash
# Get items
curl http://localhost:4000/items

# Configure chaos
curl -X POST http://localhost:4000/chaos/orders \
  -H "Content-Type: application/json" \
  -d '{"random_failure":"10%","random_latency_min":"0ms","random_latency_max":"500ms"}'

# View stats
curl http://localhost:4000/chaos
```

---

### 🎯 Manual Start (Individual Terminals)

**Terminal 1 - Backend:**
```bash
cd backend
go run main.go
```

**Terminal 2 - Middleware:**
```bash
cd middleware
go run main.go
```

**Terminal 3 - Dashboard (optional, requires Node.js):**
```bash
cd frontend
npm install
npm start
```

## Testing

Once services are running, test with:
```bash
./test-system.sh
```

## Troubleshooting

### "npm: command not found"
- Install Node.js from https://nodejs.org/
- Or use `./start-backend-middleware.sh` instead (no dashboard)

### "Port already in use"
- Stop existing services on ports 8080, 4000, or 5000
- Or change ports in config files

### Go compilation errors
- Make sure Go 1.16+ is installed: `go version`
- Run `go mod tidy` in backend and middleware directories

## Summary

| What You Want | Command | Requirements |
|---------------|---------|--------------|
| Full system with dashboard | `./start-all.sh` | Go + Node.js |
| Backend + Middleware only | `./start-backend-middleware.sh` | Go only |
| Manual control | Start each in separate terminal | Go (+ Node.js for dashboard) |