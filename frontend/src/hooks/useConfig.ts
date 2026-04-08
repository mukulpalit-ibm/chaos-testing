import { useCallback, useEffect, useState } from 'react';
import type { ChaosConfig, ConfigValidationResult, DiscoveredRoute, HttpMethod } from '../types';
import { api } from '../services/api';

const emptyValidation: ConfigValidationResult = {
  valid: true,
  errors: [],
  warnings: [],
};

export function useConfig() {
  const [config, setConfig] = useState<ChaosConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<ConfigValidationResult>(emptyValidation);
  const [routes, setRoutes] = useState<DiscoveredRoute[]>([]);

  const refreshSupportingData = useCallback(async () => {
    const routeData = await api.getDiscoveredRoutes();
    setRoutes(routeData);
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const [configData, routeData] = await Promise.all([
        api.getConfig(),
        api.getDiscoveredRoutes(),
      ]);

      setConfig(configData);
      setRoutes(routeData);
      setValidation(await api.validateConfig(configData));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const validate = useCallback(async (draft: ChaosConfig) => {
    try {
      const result = await api.validateConfig(draft);
      setValidation(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to validate config';
      setError(message);
      return {
        valid: false,
        errors: [message],
        warnings: [],
      };
    }
  }, []);

  const saveConfig = useCallback(async (newConfig: ChaosConfig) => {
    setSaving(true);

    try {
      const validationResult = await api.validateConfig(newConfig);
      setValidation(validationResult);

      if (!validationResult.valid) {
        setError(validationResult.errors.join(' '));
        return false;
      }

      await api.updateConfig(newConfig);
      const refreshedConfig = await api.getConfig();
      setConfig(refreshedConfig);
      await refreshSupportingData();
      setValidation(await api.validateConfig(refreshedConfig));
      setError(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save config');
      return false;
    } finally {
      setSaving(false);
    }
  }, [refreshSupportingData]);

  const addRouteRuleFromDiscovery = useCallback(async (path: string, method: HttpMethod) => {
    try {
      const routeRule = await api.createRouteRuleFromDiscovery(path, method);
      setConfig(current => {
        if (!current) return current;
        const exists = current.routes.some(route => route.path === path && route.method === method);

        return exists
          ? current
          : {
              ...current,
              routes: [...current.routes, routeRule],
            };
      });
      setError(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add route rule');
      return false;
    }
  }, []);

  return {
    config,
    loading,
    saving,
    error,
    validation,
    routes,
    saveConfig,
    validate,
    addRouteRuleFromDiscovery,
    refetch: fetchConfig,
  };
}

// Made with Bob
