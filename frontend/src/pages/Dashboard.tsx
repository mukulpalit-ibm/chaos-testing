import { useEffect, useMemo, useState } from 'react';
import { MetricCard } from '../components/MetricCard';
import { RequestChart } from '../components/RequestChart';
import { useMetrics } from '../hooks/useMetrics';
import { useRequests } from '../hooks/useRequests';
import { api } from '../services/api';
import type { ChartDataPoint, RouteChaosRule } from '../types';

const MIN_BUCKETS = 10;
const MAX_BUCKETS = 30;

/**
 * Bucket requests into per-minute chart points.
 * The window adapts to actual request timestamps so old-but-present data
 * still shows up instead of being clipped to a fixed 10-minute wall.
 */
function buildChartData(requests: { timestamp: number; chaosType?: string }[]): ChartDataPoint[] {
  const now = Date.now();

  // Determine window start: oldest request or 10 minutes ago, whichever is earlier
  const earliest = requests.length > 0 ? Math.min(...requests.map(r => r.timestamp)) : now;
  const windowStartMs = Math.min(earliest, now - MIN_BUCKETS * 60 * 1000);

  // Number of 1-minute buckets needed, capped at MAX_BUCKETS
  const numBuckets = Math.min(Math.ceil((now - windowStartMs) / 60_000) + 1, MAX_BUCKETS);

  // Build ordered bucket map keyed by "HH:MM"
  const buckets: Record<string, ChartDataPoint> = {};
  for (let i = numBuckets - 1; i >= 0; i--) {
    const t = new Date(now - i * 60_000);
    const key = `${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`;
    buckets[key] = { time: key, requests: 0, chaos: 0 };
  }

  for (const req of requests) {
    const t = new Date(req.timestamp);
    const key = `${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`;
    if (key in buckets) {
      buckets[key].requests++;
      if (req.chaosType) buckets[key].chaos++;
    }
  }

  return Object.values(buckets);
}

export function Dashboard() {
  const { metrics, loading, error } = useMetrics();
  const { requests } = useRequests(true, 5000);
  const [toggling, setToggling] = useState(false);
  const [routes, setRoutes] = useState<RouteChaosRule[]>([]);

  const chartData = useMemo(() => buildChartData(requests), [requests]);

  // Load route rules so we can show how many are currently enabled
  const refreshRouteState = async () => {
    try {
      const config = await api.getConfig();
      setRoutes(config.routes);
    } catch {
      // non-fatal
    }
  };

  useEffect(() => { refreshRouteState(); }, []);

  const enabledCount = routes.filter(r => r.enabled).length;
  const totalCount = routes.length;

  const handleToggleChaos = async (enabled: boolean) => {
    setToggling(true);
    try {
      await api.setChaosEnabled(enabled);
      await refreshRouteState();
    } catch (err) {
      console.error('Failed to toggle chaos:', err);
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading metrics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Requests"
          value={metrics?.totalRequests.toLocaleString() || '0'}
          icon="📊"
          color="primary"
        />
        <MetricCard
          title="Chaos Injected"
          value={metrics?.injectedRequests.toLocaleString() || '0'}
          icon="⚡"
          color="danger"
        />
        <MetricCard
          title="Success Rate"
          value={`${metrics?.successRate.toFixed(1) || '0'}%`}
          icon="✓"
          color="success"
        />
        <MetricCard
          title="Avg Latency"
          value={`${metrics?.averageLatency.toFixed(0) || '0'}ms`}
          icon="⏱️"
          color="warning"
        />
      </div>

      {/* Chart */}
      <RequestChart data={chartData} />

      {/* Chaos Control */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Chaos Control</h3>
            <p className="mt-1 text-sm text-gray-500">
              Flips the active/inactive switch on every route rule at once — a quick pause/resume for all
              experiments without losing your settings.
            </p>
          </div>

          {/* Live route state badge */}
          {totalCount === 0 ? (
            <span className="shrink-0 text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full">
              No routes configured
            </span>
          ) : (
            <span className={`shrink-0 text-xs font-semibold px-3 py-1 rounded-full ${
              enabledCount === 0
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {enabledCount === 0
                ? 'All paused'
                : `${enabledCount} / ${totalCount} route${enabledCount > 1 ? 's' : ''} injecting`}
            </span>
          )}
        </div>

        {totalCount === 0 && (
          <p className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Go to <strong>Configuration</strong> and add at least one route rule before using these controls.
          </p>
        )}

        <div className="flex space-x-4">
          <button
            onClick={() => handleToggleChaos(true)}
            disabled={toggling || totalCount === 0}
            className="px-6 py-2 bg-danger text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-danger disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {toggling ? 'Updating…' : 'Enable All Routes'}
          </button>
          <button
            onClick={() => handleToggleChaos(false)}
            disabled={toggling || totalCount === 0}
            className="px-6 py-2 bg-success text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-success disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {toggling ? 'Updating…' : 'Disable All Routes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Made with Bob
