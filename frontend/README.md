# Chaos Testing Dashboard - Frontend

A lightweight React-based dashboard for managing and monitoring the Backend Chaos Testing Middleware.

## Features

- **Dashboard**: Real-time metrics and chaos control
- **Configuration**: Visual editor for chaos testing settings
- **Monitor**: Live request monitoring with chaos injection details

## Tech Stack

- React 18 + TypeScript
- Vite (build tool)
- React Router (navigation)
- Tailwind CSS (styling)
- Recharts (data visualization)

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Install dependencies
npm install
```

### Development

```bash
# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

### Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Configuration

Create a `.env` file in the frontend directory:

```env
VITE_API_URL=http://localhost:8080/api/v1
```

## Project Structure

```
src/
├── components/       # Reusable UI components
│   ├── Header.tsx
│   ├── MetricCard.tsx
│   ├── RequestChart.tsx
│   ├── RequestTable.tsx
│   └── ConfigForm.tsx
├── pages/           # Page components
│   ├── Dashboard.tsx
│   ├── Configuration.tsx
│   └── Monitor.tsx
├── hooks/           # Custom React hooks
│   ├── useMetrics.ts
│   ├── useConfig.ts
│   └── useRequests.ts
├── services/        # API services
│   └── api.ts
├── types/           # TypeScript types
│   └── index.ts
├── App.tsx          # Main app component
└── main.tsx         # Entry point
```

## Usage

### Dashboard Page

- View real-time metrics (total requests, chaos injected, success rate, latency)
- See request timeline chart
- Enable/disable chaos testing with one click

### Configuration Page

- Toggle chaos testing on/off
- Adjust global chaos probability
- Configure latency injection (min/max delay, probability)
- Configure error injection (probability, status codes)
- Preview configuration as JSON
- Save or reset configuration

### Monitor Page

- View recent requests in a table
- See chaos injection details for each request
- Toggle auto-refresh
- Filter requests (coming soon)
- View statistics (total requests, chaos injections, success rate)

## API Integration

The frontend communicates with the backend API at the URL specified in `VITE_API_URL`.

### Endpoints Used

- `GET /api/v1/metrics/current` - Fetch current metrics
- `GET /api/v1/config` - Fetch configuration
- `PUT /api/v1/config` - Update configuration
- `GET /api/v1/requests` - Fetch recent requests
- `POST /api/v1/chaos/enable` - Enable chaos testing
- `POST /api/v1/chaos/disable` - Disable chaos testing

## Development Notes

### Auto-refresh

- Metrics refresh every 5 seconds
- Requests refresh every 5 seconds (when auto-refresh is enabled)

### Error Handling

All API calls include error handling with user-friendly error messages.

### Type Safety

Full TypeScript support with strict type checking enabled.

## Customization

### Colors

Edit `tailwind.config.js` to customize the color scheme:

```js
theme: {
  extend: {
    colors: {
      primary: '#3B82F6',
      success: '#10B981',
      warning: '#F59E0B',
      danger: '#EF4444',
    },
  },
}
```

### Refresh Intervals

Modify refresh intervals in the hooks:

```typescript
// In useMetrics.ts
export function useMetrics(refreshInterval = 5000) { ... }

// In useRequests.ts
export function useRequests(autoRefresh = true, refreshInterval = 5000) { ... }
```

## Troubleshooting

### CORS Issues

If you encounter CORS errors, ensure your backend API has CORS enabled for the frontend origin.

### API Connection Failed

1. Check that the backend is running
2. Verify `VITE_API_URL` in `.env` is correct
3. Check browser console for detailed error messages

## License

MIT
