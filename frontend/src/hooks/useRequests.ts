import { useCallback, useEffect, useState } from 'react';
import type { DiscoveredRoute, Request, RequestFilters } from '../types';
import { api } from '../services/api';

const defaultFilters: RequestFilters = {
  search: '',
  method: 'ALL',
  chaosType: 'ALL',
  status: 'ALL',
  route: 'ALL',
};

export function useRequests(autoRefresh = true, refreshInterval = 5000) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [routes, setRoutes] = useState<DiscoveredRoute[]>([]);
  const [filters, setFilters] = useState<RequestFilters>(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      const [requestData, routeData] = await Promise.all([
        api.getRequests(50, filters),
        api.getDiscoveredRoutes(),
      ]);
      setRequests(requestData);
      setRoutes(routeData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch requests');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchRequests();

    if (autoRefresh) {
      const interval = setInterval(fetchRequests, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchRequests]);

  return {
    requests,
    routes,
    filters,
    loading,
    error,
    setFilters,
    refetch: fetchRequests,
  };
}

// Made with Bob
