import { useMemo, useState } from 'react';
import { RequestTable } from '../components/RequestTable';
import { useRequests } from '../hooks/useRequests';

export function Monitor() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { requests, routes, filters, loading, error, setFilters, refetch } = useRequests(autoRefresh);

  const routeSummary = useMemo(
    () =>
      routes
        .slice()
        .sort((a, b) => b.requestCount - a.requestCount)
        .slice(0, 5),
    [routes],
  );

  if (loading && requests.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading requests...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Recent Requests</h2>
            <p className="mt-1 text-sm text-gray-600">
              Filter live traffic, inspect chaos impact, and promote discovered routes into experiments.
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={e => setAutoRefresh(e.target.checked)}
                className="mr-2 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <span className="text-sm font-medium text-gray-700">Auto-refresh</span>
            </label>

            <button
              onClick={refetch}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              Refresh Now
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={e => setFilters(current => ({ ...current, search: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="route, method, status"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Method</label>
            <select
              value={filters.method}
              onChange={e => setFilters(current => ({ ...current, method: e.target.value as typeof current.method }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ALL">All methods</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Chaos Type</label>
            <select
              value={filters.chaosType}
              onChange={e => setFilters(current => ({ ...current, chaosType: e.target.value as typeof current.chaosType }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ALL">All chaos</option>
              <option value="latency">Latency</option>
              <option value="error">Error</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status Class</label>
            <select
              value={filters.status}
              onChange={e => setFilters(current => ({ ...current, status: e.target.value as typeof current.status }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ALL">All statuses</option>
              <option value="2xx">2xx</option>
              <option value="4xx">4xx</option>
              <option value="5xx">5xx</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Route</label>
            <select
              value={filters.route}
              onChange={e => setFilters(current => ({ ...current, route: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ALL">All routes</option>
              {routes.map(route => (
                <option key={route.id} value={route.path}>
                  {route.method} {route.path}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error: {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <RequestTable requests={requests} />

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Discovered Routes</h3>

            {routeSummary.length === 0 ? (
              <p className="text-sm text-gray-500">No routes discovered yet.</p>
            ) : (
              <div className="space-y-3">
                {routeSummary.map(route => (
                  <div key={route.id} className="rounded-lg border border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {route.method} {route.path}
                        </p>
                        <p className="mt-1 text-sm text-gray-600">
                          {route.requestCount} requests • {route.averageLatency}ms avg latency
                        </p>
                        <p className="text-sm text-gray-600">
                          {route.errorRate.toFixed(1)}% error rate • Last seen{' '}
                          {new Date(route.lastSeen).toLocaleTimeString()}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setFilters(current => ({ ...current, route: route.path, method: route.method }))}
                        className="px-3 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Filter
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-gray-600">Visible Requests</p>
                <p className="text-2xl font-bold text-gray-900">{requests.length}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600">With Chaos</p>
                <p className="text-2xl font-bold text-danger">{requests.filter(request => request.chaosType).length}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold text-success">
                  {requests.length > 0
                    ? ((requests.filter(request => request.status >= 200 && request.status < 300).length / requests.length) * 100).toFixed(1)
                    : '0'}
                  %
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Made with Bob
