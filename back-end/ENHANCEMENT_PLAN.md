# Backend Enhancement Plan: Remove Frontend Mock Data Dependency

## Current State Analysis

### What Frontend Currently Uses Mock Data For

1. **Metrics** (`api.getMetrics()`)
   - Total requests count
   - Injected requests count
   - Success rate percentage
   - Average latency
   - Active route rules count

2. **Request Logs** (`api.getRequests()`)
   - Individual request history
   - Request ID, timestamp, route, method
   - Status codes
   - Latency per request
   - Chaos type (latency/error)

3. **Route Statistics** (in `mockDiscoveredRoutes`)
   - Request count per route
   - Average latency per route
   - Error rate per route
   - Last seen timestamp

## Required Backend Enhancements

### 1. Add Metrics Tracking Endpoint

**Endpoint**: `GET /chaos/metrics`

**Current State**: Not implemented in proxy
**Required Response**:
```json
{
  "totalRequests": 1250,
  "injectedRequests": 375,
  "successRate": 85.5,
  "averageLatency": 234.5,
  "activeRouteRules": 3
}
```

**Implementation Steps**:
1. Add metrics tracking to `ChaosState` struct:
   ```go
   type ChaosState struct {
       mu              sync.RWMutex
       Discovered      map[string]bool
       Configs         map[string]*RouteConfig
       ExcludedPaths   []string
       // NEW: Metrics tracking
       TotalRequests   int
       ChaosRequests   int
       SuccessRequests int
       TotalLatency    int64
       RouteMetrics    map[string]*RouteMetrics
   }
   
   type RouteMetrics struct {
       RequestCount    int
       TotalLatency    int64
       ErrorCount      int
       LastSeen        time.Time
   }
   ```

2. Update `chaosMiddleware` to track metrics:
   ```go
   func chaosMiddleware(next http.Handler) http.Handler {
       return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
           startTime := time.Now()
           route := normalizeRoute(r.URL.Path)
           
           // Track request
           state.mu.Lock()
           state.TotalRequests++
           if state.RouteMetrics[route] == nil {
               state.RouteMetrics[route] = &RouteMetrics{}
           }
           state.RouteMetrics[route].RequestCount++
           state.RouteMetrics[route].LastSeen = time.Now()
           state.mu.Unlock()
           
           // ... existing chaos logic ...
           
           // Track latency and success
           latency := time.Since(startTime).Milliseconds()
           state.mu.Lock()
           state.TotalLatency += latency
           state.RouteMetrics[route].TotalLatency += latency
           // Track if chaos was injected
           // Track if request succeeded
           state.mu.Unlock()
       }
   }
   ```

3. Add metrics handler:
   ```go
   func handleMetrics(w http.ResponseWriter, r *http.Request) {
       state.mu.RLock()
       defer state.mu.RUnlock()
       
       activeRules := 0
       for _, config := range state.Configs {
           if config.Enabled {
               activeRules++
           }
       }
       
       successRate := 0.0
       if state.TotalRequests > 0 {
           successRate = float64(state.SuccessRequests) / float64(state.TotalRequests) * 100
       }
       
       avgLatency := 0.0
       if state.TotalRequests > 0 {
           avgLatency = float64(state.TotalLatency) / float64(state.TotalRequests)
       }
       
       metrics := map[string]interface{}{
           "totalRequests":    state.TotalRequests,
           "injectedRequests": state.ChaosRequests,
           "successRate":      successRate,
           "averageLatency":   avgLatency,
           "activeRouteRules": activeRules,
       }
       
       json.NewEncoder(w).Encode(metrics)
   }
   ```

4. Register endpoint in `main()`:
   ```go
   mux.HandleFunc("/chaos/metrics", corsMiddleware(handleMetrics))
   ```

### 2. Add Request Logging Endpoint

**Endpoint**: `GET /chaos/requests`

**Current State**: Not implemented
**Required Response**:
```json
[
  {
    "id": "req-1234",
    "timestamp": 1678901234567,
    "route": "/products",
    "method": "GET",
    "status": 200,
    "latency": 145,
    "chaosType": "latency"
  }
]
```

**Implementation Steps**:
1. Add request log storage:
   ```go
   type RequestLog struct {
       ID        string  `json:"id"`
       Timestamp int64   `json:"timestamp"`
       Route     string  `json:"route"`
       Method    string  `json:"method"`
       Status    int     `json:"status"`
       Latency   int64   `json:"latency"`
       ChaosType *string `json:"chaosType,omitempty"`
   }
   
   type ChaosState struct {
       // ... existing fields ...
       RequestLogs []RequestLog
       requestIDCounter int
   }
   ```

2. Update middleware to log requests:
   ```go
   func chaosMiddleware(next http.Handler) http.Handler {
       return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
           startTime := time.Now()
           route := normalizeRoute(r.URL.Path)
           
           // Create response writer wrapper to capture status
           rw := &responseWriter{ResponseWriter: w, statusCode: 200}
           
           var chaosType *string
           
           // ... chaos injection logic ...
           // Set chaosType to "latency" or "error" when chaos is injected
           
           // Execute request
           next.ServeHTTP(rw, r)
           
           // Log request
           latency := time.Since(startTime).Milliseconds()
           state.mu.Lock()
           state.requestIDCounter++
           log := RequestLog{
               ID:        fmt.Sprintf("req-%d", state.requestIDCounter),
               Timestamp: time.Now().UnixMilli(),
               Route:     route,
               Method:    r.Method,
               Status:    rw.statusCode,
               Latency:   latency,
               ChaosType: chaosType,
           }
           state.RequestLogs = append(state.RequestLogs, log)
           
           // Keep only last 100 requests
           if len(state.RequestLogs) > 100 {
               state.RequestLogs = state.RequestLogs[len(state.RequestLogs)-100:]
           }
           state.mu.Unlock()
       })
   }
   
   type responseWriter struct {
       http.ResponseWriter
       statusCode int
   }
   
   func (rw *responseWriter) WriteHeader(code int) {
       rw.statusCode = code
       rw.ResponseWriter.WriteHeader(code)
   }
   ```

3. Add request logs handler:
   ```go
   func handleRequests(w http.ResponseWriter, r *http.Request) {
       state.mu.RLock()
       defer state.mu.RUnlock()
       
       // Return last 50 requests
       start := 0
       if len(state.RequestLogs) > 50 {
           start = len(state.RequestLogs) - 50
       }
       
       json.NewEncoder(w).Encode(state.RequestLogs[start:])
   }
   ```

4. Register endpoint:
   ```go
   mux.HandleFunc("/chaos/requests", corsMiddleware(handleRequests))
   ```

### 3. Enhance Routes Endpoint with Statistics

**Endpoint**: `GET /chaos/routes`

**Current Response**:
```json
[
  {"method": "ANY", "path": "/products"}
]
```

**Enhanced Response**:
```json
[
  {
    "method": "ANY",
    "path": "/products",
    "requestCount": 633,
    "averageLatency": 98,
    "errorRate": 0.6,
    "lastSeen": 1678901234567
  }
]
```

**Implementation**:
```go
func handleRoutes(w http.ResponseWriter, r *http.Request) {
    state.mu.RLock()
    defer state.mu.RUnlock()
    
    var routes []map[string]interface{}
    for route := range state.Discovered {
        metrics := state.RouteMetrics[route]
        if metrics == nil {
            metrics = &RouteMetrics{}
        }
        
        avgLatency := 0.0
        if metrics.RequestCount > 0 {
            avgLatency = float64(metrics.TotalLatency) / float64(metrics.RequestCount)
        }
        
        errorRate := 0.0
        if metrics.RequestCount > 0 {
            errorRate = float64(metrics.ErrorCount) / float64(metrics.RequestCount) * 100
        }
        
        routes = append(routes, map[string]interface{}{
            "method":         "ANY",
            "path":           route,
            "requestCount":   metrics.RequestCount,
            "averageLatency": avgLatency,
            "errorRate":      errorRate,
            "lastSeen":       metrics.LastSeen.UnixMilli(),
        })
    }
    
    json.NewEncoder(w).Encode(routes)
}
```

## Frontend Changes Required

### Remove Mock Data and Versioning Features

**File**: `frontend/src/services/api.ts`

1. **Remove mock data arrays**:
   - Remove `mockDiscoveredRoutes`
   - Remove `mockConfig`
   - Remove `mockConfigVersions`
   - Remove `mockRequests`

2. **Update API methods to use backend only**:
   ```typescript
   export const api = {
     getMetrics: async (): Promise<Metrics> => {
       const res = await fetch(`${API_BASE}/chaos/metrics`);
       if (!res.ok) throw new Error('Failed to fetch metrics');
       return res.json();
     },

     getRequests: async (limit = 50, filters?: Partial<RequestFilters>): Promise<Request[]> => {
       const res = await fetch(`${API_BASE}/chaos/requests`);
       if (!res.ok) throw new Error('Failed to fetch requests');
       const requests = await res.json();
       return applyRequestFilters(requests, filters).slice(0, limit);
     },

     getDiscoveredRoutes: async (): Promise<DiscoveredRoute[]> => {
       const res = await fetch(`${API_BASE}/chaos/routes`);
       if (!res.ok) throw new Error('Failed to fetch routes');
       return res.json();
     },

     getConfig: async (): Promise<ChaosConfig> => {
       const res = await fetch(`${API_BASE}/chaos/config`);
       if (!res.ok) throw new Error('Failed to fetch config');
       return mapBackendConfig(await res.json());
     },

     updateConfig: async (config: ChaosConfig): Promise<void> => {
       const validation = validateConfig(config);
       if (!validation.valid) {
         throw new Error(validation.errors.join(' '));
       }
       await updateBackendConfig(config);
     },

     validateConfig: async (config: ChaosConfig): Promise<ConfigValidationResult> => {
       return validateConfig(config);
     },

     // REMOVE: getConfigVersions
     // REMOVE: rollbackConfig
     // REMOVE: setChaosEnabled (if not used)
     
     createRouteRuleFromDiscovery: async (path: string, method: HttpMethod): Promise<RouteChaosRule> => {
       return createDefaultRouteRule(path, method);
     },
   };
   ```

3. **Remove helper functions**:
   - Remove `shouldUseMockOnly()`
   - Remove `persistMockConfigVersion()`
   - Remove `buildMetrics()` (if only used for mock)

4. **Simplify config mapping**:
   - Keep `mapBackendConfig()` and `updateBackendConfig()`
   - Remove mock fallbacks

### Update Frontend Components

**Files to modify**:

1. **frontend/src/hooks/useConfig.ts**
   - Remove `versions` state
   - Remove `rollbackToVersion` function
   - Remove `getConfigVersions()` call
   - Simplify to only handle config CRUD

2. **frontend/src/pages/Configuration.tsx**
   - Remove version history UI
   - Remove rollback functionality
   - Keep only current config editing

**File**: `frontend/src/types/index.ts`
   - Remove `ConfigVersion` interface (if not used elsewhere)

## Implementation Priority

### Phase 1: Backend Enhancements (Required)
1. ✅ Add metrics tracking to `ChaosState`
2. ✅ Implement `GET /chaos/metrics` endpoint
3. ✅ Add request logging to middleware
4. ✅ Implement `GET /chaos/requests` endpoint
5. ✅ Enhance `GET /chaos/routes` with statistics

### Phase 2: Frontend Cleanup (Required)
1. ✅ Remove all mock data arrays
2. ✅ Remove versioning/rollback features
3. ✅ Update API methods to use backend only
4. ✅ Remove unused helper functions
5. ✅ Update components to remove version UI

## Testing Plan

### 1. Test Metrics Endpoint
```bash
# Generate traffic
for i in {1..20}; do
  curl http://localhost:3999/products
  curl http://localhost:3999/users/123
done

# Check metrics
curl http://localhost:3999/chaos/metrics | jq
```

**Expected**:
- `totalRequests`: 40
- `injectedRequests`: ~8-12 (depending on chaos config)
- `successRate`: ~70-90%
- `averageLatency`: > 0

### 2. Test Request Logs
```bash
curl http://localhost:3999/chaos/requests | jq
```

**Expected**: Array of request objects with all fields populated

### 3. Test Enhanced Routes
```bash
curl http://localhost:3999/chaos/routes | jq
```

**Expected**: Routes with statistics (requestCount, averageLatency, etc.)

### 4. Test Frontend Integration
1. Start backend and proxy
2. Generate traffic
3. Open frontend
4. Verify:
   - Dashboard shows real metrics
   - Monitor page shows real request logs
   - Configuration page shows routes with real statistics
   - No version/rollback UI visible

## File Changes Summary

### Backend Files to Modify

1. **back-end/proxy/proxy.go**
   - Add `RouteMetrics` struct
   - Add metrics fields to `ChaosState`
   - Add `RequestLog` struct and storage
   - Update `chaosMiddleware` to track metrics and log requests
   - Add `handleMetrics` function
   - Add `handleRequests` function
   - Update `handleRoutes` to include statistics
   - Add `responseWriter` wrapper to capture status codes
   - Register new endpoints in `main()`

### Frontend Files to Modify

2. **frontend/src/services/api.ts**
   - Remove all mock data arrays
   - Remove `shouldUseMockOnly()`, `persistMockConfigVersion()`, `buildMetrics()`
   - Update all API methods to call backend directly
   - Remove `getConfigVersions()` and `rollbackConfig()` methods
   - Simplify error handling (no mock fallbacks)

3. **frontend/src/hooks/useConfig.ts**
   - Remove `versions` state
   - Remove `rollingBack` state
   - Remove `rollbackToVersion` function
   - Remove `getConfigVersions()` call from `fetchConfig()`

4. **frontend/src/pages/Configuration.tsx**
   - Remove version history section
   - Remove rollback button/functionality
   - Simplify UI to focus on current config only

5. **frontend/src/types/index.ts**
   - Remove `ConfigVersion` interface

## Estimated Effort

- **Backend Changes**: 2-3 hours
  - Metrics tracking: 1 hour
  - Request logging: 1 hour
  - Enhanced routes: 30 minutes
  - Testing: 30 minutes

- **Frontend Changes**: 1-2 hours
  - Remove mock data: 30 minutes
  - Remove versioning features: 30 minutes
  - Update components: 30 minutes
  - Testing: 30 minutes

**Total**: ~4-5 hours

## Benefits

✅ **No Mock Data Dependency**: Frontend shows real backend data only
✅ **Real-Time Metrics**: Actual request counts, latencies, success rates
✅ **Request History**: See actual requests flowing through proxy
✅ **Route Statistics**: Per-route analytics from real traffic
✅ **Simpler Codebase**: Removed versioning complexity
✅ **Production Ready**: Backend tracks everything needed for monitoring
✅ **Better UX**: Users see real data, cleaner interface

## Next Steps

1. ✅ Review this plan
2. ⏳ Implement backend enhancements in `back-end/proxy/proxy.go`
3. ⏳ Update frontend to remove mock data and versioning
4. ⏳ Test integration thoroughly
5. ✅ Deploy and monitor