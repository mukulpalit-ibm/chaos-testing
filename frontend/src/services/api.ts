import type {
  ChaosConfig,
  ConfigValidationResult,
  DiscoveredRoute,
  HttpMethod,
  Metrics,
  Request,
  RequestFilters,
  RouteChaosRule,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3999';

const createDefaultRouteRule = (path: string, method: HttpMethod): RouteChaosRule => ({
  id: `${method}-${path}`,
  path,
  method,
  enabled: false,
  latency: {
    enabled: true,
    minDelay: 100,
    maxDelay: 500,
    probability: 0.2,
  },
  errors: {
    enabled: true,
    probability: 0.1,
    statusCodes: [500, 502, 503],
  },
});

const validateConfig = (config: ChaosConfig): ConfigValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  const validateProbability = (value: number, label: string) => {
    if (Number.isNaN(value) || value < 0 || value > 1) {
      errors.push(`${label} must be between 0% and 100%.`);
    }
  };

  validateProbability(config.defaultProbability, 'Default chaos probability');
  validateProbability(config.latency.probability, 'Global latency probability');
  validateProbability(config.errors.probability, 'Global error probability');

  if (config.latency.minDelay > config.latency.maxDelay) {
    errors.push('Global latency min delay must be less than or equal to max delay.');
  }

  if (!config.errors.statusCodes.length) {
    errors.push('At least one global error status code is required when error injection is configured.');
  }

  if (config.defaultProbability > 0.3) {
    warnings.push('Default chaos probability above 30% can produce unrealistic test behavior.');
  }

  config.errors.statusCodes.forEach(code => {
    if (code < 400 || code > 599) {
      errors.push(`Global status code ${code} must be a valid 4xx or 5xx HTTP code.`);
    }
  });

  config.routes.forEach(route => {
    validateProbability(route.latency.probability, `${route.method} ${route.path} latency probability`);
    validateProbability(route.errors.probability, `${route.method} ${route.path} error probability`);

    if (route.latency.minDelay > route.latency.maxDelay) {
      errors.push(`${route.method} ${route.path}: min delay must be less than or equal to max delay.`);
    }

    if (!route.errors.statusCodes.length) {
      errors.push(`${route.method} ${route.path}: provide at least one error status code.`);
    }

    route.errors.statusCodes.forEach(code => {
      if (code < 400 || code > 599) {
        errors.push(`${route.method} ${route.path}: ${code} must be a valid 4xx or 5xx HTTP code.`);
      }
    });

    if (route.enabled && route.errors.enabled && route.errors.probability > 0.3) {
      warnings.push(`${route.method} ${route.path}: error probability above 30% may be too aggressive for initial experiments.`);
    }
  });

  if (!config.enabled) {
    warnings.push('Chaos is globally disabled. Route rules will not take effect until chaos is enabled.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};

const applyRequestFilters = (requests: Request[], filters?: Partial<RequestFilters>) => {
  if (!filters) return requests;

  return requests.filter(request => {
    const search = filters.search?.trim().toLowerCase();
    const matchesSearch =
      !search ||
      request.route.toLowerCase().includes(search) ||
      request.method.toLowerCase().includes(search) ||
      request.status.toString().includes(search);

    const matchesMethod = !filters.method || filters.method === 'ALL' || request.method === filters.method;
    const matchesChaosType =
      !filters.chaosType || filters.chaosType === 'ALL' || request.chaosType === filters.chaosType;
    const matchesRoute = !filters.route || filters.route === 'ALL' || request.route === filters.route;
    const matchesStatus =
      !filters.status ||
      filters.status === 'ALL' ||
      (filters.status === '2xx' && request.status >= 200 && request.status < 300) ||
      (filters.status === '4xx' && request.status >= 400 && request.status < 500) ||
      (filters.status === '5xx' && request.status >= 500 && request.status < 600);

    return matchesSearch && matchesMethod && matchesChaosType && matchesRoute && matchesStatus;
  });
};

const toBackendRouteKey = (path: string) => {
  // Use path as-is, no transformation
  return path;
};

const mapBackendConfig = (backendConfig: Record<
  string,
  {
    enabled: boolean;
    failureRate: number;
    delayRate: number;
    minDelayMs: number;
    maxDelayMs: number;
    errorCodes: number[] | null;
    targetHeader?: string;
    targetValue?: string;
    corruptionRate?: number;
  }
>): ChaosConfig => {
  const routes = Object.entries(backendConfig || {}).map(([path, route]) => {
    const routeRule: RouteChaosRule = {
      id: `ANY-${path}`,
      path: path,
      method: 'ANY' as HttpMethod,
      enabled: route.enabled,
      latency: {
        enabled: route.delayRate > 0,
        minDelay: route.minDelayMs,
        maxDelay: route.maxDelayMs,
        probability: route.delayRate,
      },
      errors: {
        enabled: route.failureRate > 0,
        probability: route.failureRate,
        statusCodes: route.errorCodes && route.errorCodes.length > 0 ? route.errorCodes : [500],
      },
    };
    
    // Include optional backend fields if present
    if (route.targetHeader) {
      routeRule.targetHeader = route.targetHeader;
    }
    if (route.targetValue) {
      routeRule.targetValue = route.targetValue;
    }
    if (route.corruptionRate !== undefined && route.corruptionRate > 0) {
      routeRule.corruptionRate = route.corruptionRate;
    }
    
    return routeRule;
  });

  return {
    enabled: false,
    defaultProbability: 0.1,
    latency: {
      enabled: true,
      minDelay: 100,
      maxDelay: 500,
      probability: 0.3,
    },
    errors: {
      enabled: true,
      probability: 0.1,
      statusCodes: [500, 502, 503],
    },
    routes,
    updatedAt: Date.now(),
  };
};

const updateBackendConfig = async (config: ChaosConfig): Promise<void> => {
  const payload = config.routes.reduce<Record<string, unknown>>((acc, route) => {
    const backendRoute: Record<string, unknown> = {
      enabled: route.enabled,
      failureRate: route.errors.enabled ? route.errors.probability : 0,
      delayRate: route.latency.enabled ? route.latency.probability : 0,
      minDelayMs: route.latency.minDelay,
      maxDelayMs: route.latency.maxDelay,
      errorCodes: route.errors.statusCodes,
    };
    
    // Include optional backend fields if they exist
    if (route.targetHeader !== undefined) {
      backendRoute.targetHeader = route.targetHeader;
    }
    if (route.targetValue !== undefined) {
      backendRoute.targetValue = route.targetValue;
    }
    if (route.corruptionRate !== undefined) {
      backendRoute.corruptionRate = route.corruptionRate;
    }
    
    acc[toBackendRouteKey(route.path)] = backendRoute;
    return acc;
  }, {});

  const res = await fetch(`${API_BASE}/chaos/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error('Failed to update backend config');
};

export const api = {
  getMetrics: async (): Promise<Metrics> => {
    const res = await fetch(`${API_BASE}/chaos/metrics`);
    if (!res.ok) throw new Error('Failed to fetch metrics');
    return res.json();
  },

  getConfig: async (): Promise<ChaosConfig> => {
    const res = await fetch(`${API_BASE}/chaos/config`);
    if (!res.ok) throw new Error('Failed to fetch config');
    const backendConfig = await res.json();
    return mapBackendConfig(backendConfig);
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


  setChaosEnabled: async (enabled: boolean): Promise<void> => {
    // This would need backend support - for now just a placeholder
    console.log('Set chaos enabled:', enabled);
  },

  createRouteRuleFromDiscovery: async (path: string, method: HttpMethod): Promise<RouteChaosRule> => {
    return createDefaultRouteRule(path, method);
  },
};

// Made with Bob
