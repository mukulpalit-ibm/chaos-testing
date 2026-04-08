# Frontend Chaos Testing Dashboard - Hackathon Design Document

## 1. Overview

A lightweight web dashboard for managing and monitoring the Backend Chaos Testing Middleware. Built for rapid development with minimal complexity while providing essential functionality for chaos testing experiments.

## 2. Technology Stack

**Core**:
- React 18 with TypeScript
- Vite (fast build tool)
- React Router (navigation)

**UI Library**:
- Tailwind CSS (utility-first styling)
- Shadcn/ui or DaisyUI (pre-built components)

**State & Data**:
- React hooks (useState, useEffect)
- Fetch API or Axios for HTTP requests
- WebSocket for real-time updates (optional)

**Charts**:
- Recharts (simple React charts)

## 3. Core Features (MVP)

### 3.1 Dashboard Page
**Purpose**: Quick overview of chaos testing status

**Components**:
- 4 metric cards (Total Requests, Chaos Injected, Success Rate, Avg Latency)
- Simple line chart showing request timeline
- Enable/Disable chaos toggle
- Current configuration summary

### 3.2 Configuration Page
**Purpose**: Edit chaos testing settings

**Components**:
- Simple form with inputs for:
  - Global chaos probability (slider 0-100%)
  - Latency settings (min/max delay in ms)
  - Error injection (probability, status codes)
- Save/Reset buttons
- JSON preview (read-only)

### 3.3 Monitor Page
**Purpose**: View recent requests and chaos injections

**Components**:
- Simple table showing:
  - Timestamp
  - Route
  - Method
  - Status Code
  - Chaos Type (if injected)
  - Latency
- Auto-refresh toggle
- Basic filters (route, chaos type)

## 4. Page Layouts

### 4.1 Dashboard
```
┌─────────────────────────────────────────────────────────┐
│  Header: Logo | Dashboard | Config | Monitor            │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Requests │ │ Injected │ │ Success  │ │ Latency  │  │
│  │  1,234   │ │   123    │ │   98%    │ │  145ms   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Request Timeline (Line Chart)                     │ │
│  │                                                    │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  [Enable Chaos] [Disable Chaos]                         │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Configuration
```
┌─────────────────────────────────────────────────────────┐
│  Header: Logo | Dashboard | Config | Monitor            │
├─────────────────────────────────────────────────────────┤
│  Chaos Configuration                                     │
│                                                          │
│  Global Settings                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Chaos Probability: [=====>    ] 50%                │ │
│  │                                                    │ │
│  │ Latency Injection                                  │ │
│  │ Min Delay (ms): [100]  Max Delay (ms): [500]      │ │
│  │ Probability: [=====>    ] 30%                      │ │
│  │                                                    │ │
│  │ Error Injection                                    │ │
│  │ Probability: [==>    ] 20%                         │ │
│  │ Status Codes: [500, 502, 503]                      │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  [Save Configuration] [Reset to Default]                │
└─────────────────────────────────────────────────────────┘
```

### 4.3 Monitor
```
┌─────────────────────────────────────────────────────────┐
│  Header: Logo | Dashboard | Config | Monitor            │
├─────────────────────────────────────────────────────────┤
│  Recent Requests  [Auto-refresh: ON] [Refresh Now]      │
│                                                          │
│  Filters: Route [All ▼] Chaos [All ▼]                   │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Time    | Route      | Method | Status | Chaos    │ │
│  │─────────┼────────────┼────────┼────────┼──────────│ │
│  │ 12:34:56│ /api/users │ GET    │ 200    │ Latency  │ │
│  │ 12:34:55│ /api/orders│ POST   │ 500    │ Error    │ │
│  │ 12:34:54│ /api/users │ GET    │ 200    │ -        │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  [Previous] Page 1 of 10 [Next]                         │
└─────────────────────────────────────────────────────────┘
```

## 5. Component Structure

```
src/
├── App.tsx                 # Main app component
├── pages/
│   ├── Dashboard.tsx       # Dashboard page
│   ├── Configuration.tsx   # Config page
│   └── Monitor.tsx         # Monitor page
├── components/
│   ├── Header.tsx          # Navigation header
│   ├── MetricCard.tsx      # Metric display card
│   ├── RequestChart.tsx    # Timeline chart
│   ├── ConfigForm.tsx      # Configuration form
│   └── RequestTable.tsx    # Request list table
├── hooks/
│   ├── useMetrics.ts       # Fetch metrics data
│   ├── useConfig.ts        # Manage configuration
│   └── useRequests.ts      # Fetch request data
├── services/
│   └── api.ts              # API client
└── types/
    └── index.ts            # TypeScript types
```

## 6. Key Components

### 6.1 MetricCard
```typescript
interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: string;
}

function MetricCard({ title, value, icon }: MetricCardProps) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <p className="text-3xl">{value}</p>
    </div>
  );
}
```

### 6.2 ConfigForm
```typescript
interface ConfigFormProps {
  config: ChaosConfig;
  onSave: (config: ChaosConfig) => void;
}

function ConfigForm({ config, onSave }: ConfigFormProps) {
  const [formData, setFormData] = useState(config);
  
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Form inputs */}
    </form>
  );
}
```

### 6.3 RequestTable
```typescript
interface RequestTableProps {
  requests: Request[];
  autoRefresh?: boolean;
}

function RequestTable({ requests, autoRefresh }: RequestTableProps) {
  return (
    <table>
      <thead>
        <tr>
          <th>Time</th>
          <th>Route</th>
          <th>Method</th>
          <th>Status</th>
          <th>Chaos</th>
        </tr>
      </thead>
      <tbody>
        {requests.map(req => (
          <tr key={req.id}>
            <td>{formatTime(req.timestamp)}</td>
            <td>{req.route}</td>
            <td>{req.method}</td>
            <td>{req.status}</td>
            <td>{req.chaosType || '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

## 7. Data Types

```typescript
interface ChaosConfig {
  enabled: boolean;
  defaultProbability: number;
  latency: {
    enabled: boolean;
    minDelay: number;
    maxDelay: number;
    probability: number;
  };
  errors: {
    enabled: boolean;
    probability: number;
    statusCodes: number[];
  };
}

interface Metrics {
  totalRequests: number;
  injectedRequests: number;
  successRate: number;
  averageLatency: number;
}

interface Request {
  id: string;
  timestamp: number;
  route: string;
  method: string;
  status: number;
  chaosType?: string;
  latency: number;
}
```

## 8. API Integration

### 8.1 API Service
```typescript
const API_BASE = 'http://localhost:8080/api/v1';

export const api = {
  // Get current metrics
  getMetrics: async (): Promise<Metrics> => {
    const res = await fetch(`${API_BASE}/metrics/current`);
    return res.json();
  },
  
  // Get configuration
  getConfig: async (): Promise<ChaosConfig> => {
    const res = await fetch(`${API_BASE}/config`);
    return res.json();
  },
  
  // Update configuration
  updateConfig: async (config: ChaosConfig): Promise<void> => {
    await fetch(`${API_BASE}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
  },
  
  // Get recent requests
  getRequests: async (limit = 50): Promise<Request[]> => {
    const res = await fetch(`${API_BASE}/requests?limit=${limit}`);
    return res.json();
  },
  
  // Enable/disable chaos
  setChaosEnabled: async (enabled: boolean): Promise<void> => {
    await fetch(`${API_BASE}/chaos/${enabled ? 'enable' : 'disable'}`, {
      method: 'POST',
    });
  },
};
```

### 8.2 Custom Hooks
```typescript
// useMetrics.ts
export function useMetrics() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchMetrics = async () => {
      const data = await api.getMetrics();
      setMetrics(data);
      setLoading(false);
    };
    
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000); // Refresh every 5s
    
    return () => clearInterval(interval);
  }, []);
  
  return { metrics, loading };
}

// useConfig.ts
export function useConfig() {
  const [config, setConfig] = useState<ChaosConfig | null>(null);
  
  useEffect(() => {
    api.getConfig().then(setConfig);
  }, []);
  
  const saveConfig = async (newConfig: ChaosConfig) => {
    await api.updateConfig(newConfig);
    setConfig(newConfig);
  };
  
  return { config, saveConfig };
}
```

## 9. Styling Approach

### 9.1 Tailwind CSS Classes
```typescript
// Card styling
<div className="bg-white rounded-lg shadow p-6">

// Button styling
<button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">

// Input styling
<input className="border rounded px-3 py-2 w-full" />

// Table styling
<table className="w-full border-collapse">
```

### 9.2 Color Scheme
- Primary: Blue (#3B82F6)
- Success: Green (#10B981)
- Warning: Yellow (#F59E0B)
- Danger: Red (#EF4444)
- Background: Gray (#F3F4F6)

## 10. Development Setup

### 10.1 Project Setup
```bash
# Create Vite project
npm create vite@latest chaos-dashboard -- --template react-ts

# Install dependencies
cd chaos-dashboard
npm install
npm install react-router-dom
npm install recharts
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### 10.2 Project Structure
```
chaos-dashboard/
├── public/
├── src/
│   ├── pages/
│   ├── components/
│   ├── hooks/
│   ├── services/
│   ├── types/
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

### 10.3 Run Commands
```bash
# Development
npm run dev

# Build
npm run build

# Preview production build
npm run preview
```

## 11. Implementation Priority

### Phase 1 (Core - 2-3 hours)
1. ✅ Setup project with Vite + React + TypeScript
2. ✅ Create basic routing (Dashboard, Config, Monitor)
3. ✅ Implement API service layer
4. ✅ Build Dashboard page with metrics cards
5. ✅ Add basic styling with Tailwind

### Phase 2 (Features - 2-3 hours)
6. ✅ Build Configuration page with form
7. ✅ Implement Monitor page with request table
8. ✅ Add chart to Dashboard
9. ✅ Implement auto-refresh for metrics

### Phase 3 (Polish - 1-2 hours)
10. ✅ Add loading states
11. ✅ Error handling
12. ✅ Responsive design tweaks
13. ✅ Final testing

## 12. Optional Enhancements (If Time Permits)

- WebSocket for real-time updates
- Dark mode toggle
- Export data to CSV
- More detailed request information modal
- Simple notifications/toasts
- Route-specific configuration

## 13. Deployment

### Quick Deploy Options
- **Vercel**: `vercel deploy` (easiest)
- **Netlify**: Drag & drop build folder
- **GitHub Pages**: Push to gh-pages branch

### Environment Variables
```env
VITE_API_URL=http://localhost:8080
```

## 14. Testing (Minimal)

```typescript
// Basic component test
import { render, screen } from '@testing-library/react';
import MetricCard from './MetricCard';

test('renders metric card', () => {
  render(<MetricCard title="Requests" value={1234} />);
  expect(screen.getByText('Requests')).toBeInTheDocument();
  expect(screen.getByText('1234')).toBeInTheDocument();
});
```

## 15. Demo Script

1. Show Dashboard with live metrics
2. Toggle chaos on/off
3. Navigate to Configuration
4. Adjust latency and error settings
5. Save configuration
6. Go to Monitor page
7. Show real-time request table with chaos injections
8. Filter by chaos type

## 16. Time Estimate

- **Setup & Basic Structure**: 1 hour
- **Dashboard Page**: 1.5 hours
- **Configuration Page**: 1.5 hours
- **Monitor Page**: 1.5 hours
- **Styling & Polish**: 1 hour
- **Testing & Debugging**: 0.5 hours

**Total**: ~7 hours for a functional MVP

## 17. Success Criteria

✅ Can view real-time chaos testing metrics
✅ Can enable/disable chaos testing
✅ Can configure chaos parameters
✅ Can monitor recent requests
✅ Clean, professional UI
✅ Works on desktop browsers
✅ Successfully communicates with backend API

This streamlined design focuses on delivering core functionality quickly while maintaining a professional appearance suitable for a hackathon demo.