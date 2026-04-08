import { useState } from 'react';
import { MetricCard } from '../components/MetricCard';
import { RequestChart } from '../components/RequestChart';
import { useMetrics } from '../hooks/useMetrics';
import { api } from '../services/api';

export function Dashboard() {
  const { metrics, loading, error } = useMetrics();
  const [toggling, setToggling] = useState(false);

  // Generate mock chart data (in real app, this would come from API)
  const chartData = Array.from({ length: 10 }, (_, i) => ({
    time: `${i}:00`,
    requests: Math.floor(Math.random() * 100) + 50,
    chaos: Math.floor(Math.random() * 20) + 5,
  }));

  const handleToggleChaos = async (enabled: boolean) => {
    setToggling(true);
    try {
      await api.setChaosEnabled(enabled);
      // Metrics will auto-refresh
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

      {/* Control Buttons */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Chaos Control</h3>
        <div className="flex space-x-4">
          <button
            onClick={() => handleToggleChaos(true)}
            disabled={toggling}
            className="px-6 py-2 bg-danger text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-danger disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Enable Chaos
          </button>
          <button
            onClick={() => handleToggleChaos(false)}
            disabled={toggling}
            className="px-6 py-2 bg-success text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-success disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Disable Chaos
          </button>
        </div>
      </div>
    </div>
  );
}

// Made with Bob
