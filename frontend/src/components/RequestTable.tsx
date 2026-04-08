import type { Request } from '../types';

interface RequestTableProps {
  requests: Request[];
}

export function RequestTable({ requests }: RequestTableProps) {
  const formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString();

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-success';
    if (status >= 400 && status < 500) return 'text-warning';
    if (status >= 500) return 'text-danger';
    return 'text-gray-700';
  };

  const getChaosBadgeClasses = (chaosType?: string) => {
    if (chaosType === 'latency') return 'bg-amber-100 text-amber-800';
    if (chaosType === 'error') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-500';
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="border-b border-gray-200 px-6 py-4">
        <h3 className="text-lg font-semibold text-gray-900">Request Feed</h3>
        <p className="mt-1 text-sm text-gray-600">
          Live view of recent traffic, filtered by route, method, chaos type, and status class.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Route
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Method
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Chaos Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Latency
              </th>
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {requests.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No requests match the current filters.
                </td>
              </tr>
            ) : (
              requests.map(request => (
                <tr key={request.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatTime(request.timestamp)}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {request.route}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                      {request.method}
                    </span>
                  </td>

                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${getStatusColor(request.status)}`}>
                    {request.status}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {request.chaosType ? (
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getChaosBadgeClasses(request.chaosType)}`}>
                        {request.chaosType}
                      </span>
                    ) : (
                      <span className="text-gray-400">none</span>
                    )}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {request.latency}ms
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Made with Bob
