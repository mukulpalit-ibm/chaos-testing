import { useCallback, useEffect, useState } from 'react';
import type { Metrics } from '../types';
import { api } from '../services/api';

export function useMetrics(refreshInterval = 5000) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await api.getMetrics();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, fetchMetrics]);

  return { metrics, loading, error, refetch: fetchMetrics };
}

// Made with Bob
