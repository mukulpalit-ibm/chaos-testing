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
const USE_MOCK_DATA = false;
const BACKEND_MODE = import.meta.env.VITE_BACKEND_MODE || 'hybrid';

const delay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

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

const mockDiscoveredRoutes: DiscoveredRoute[] = [
  {
    id: 'GET-/mock/users',
    path: '/mock/users',
    method: 'GET',
    requestCount: 428,
    averageLatency: 122,
    errorRate: 1.8,
    lastSeen: Date.now() - 45_000,
  },
  {
    id: 'POST-/mock/orders',
    path: '/mock/orders',
    method: 'POST',
    requestCount: 186,
    averageLatency: 341,
    errorRate: 7.6,
    lastSeen: Date.now() - 15_000,
  },
  {
    id: 'GET-/mock/products',
    path: '/mock/products',
    method: 'GET',
    requestCount: 633,
    averageLatency: 98,
    errorRate: 0.6,
    lastSeen: Date.now() - 10_000,
  },
];

let mockConfig: ChaosConfig = {
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
  routes: [
    {
      ...createDefaultRouteRule('/mock/orders', 'POST'),
      enabled: true,
      latency: {
        enabled: true,
        minDelay: 250,
        maxDelay: 900,
        probability: 0.35,
      },
      errors: {
        enabled: true,
        probability: 0.18,
        statusCodes: [502, 503],
      },
    },
  ],
  updatedAt: Date.now(),
  versionName: 'Initial Mock Config',
};


const mockRequests: Request[] = Array.from({ length: 30 }, (_, i) => {
  const route = mockDiscoveredRoutes[i % mockDiscoveredRoutes.length];
  const routeRule = mockConfig.routes.find(rule => rule.path === route.path && rule.method === route.method);
  const chaosTriggered = Math.random() > 0.68;
  const chaosType = chaosTriggered ? (Math.random() > 0.5 ? 'latency' : 'error') : undefined;
  const isError = chaosType === 'error';

  return {
    id: `req-${i + 1}`,
    timestamp: Date.now() - i * 60_000,
    method: route.method,
    route: route.path,
    status: isError ? [500, 502, 503][Math.floor(Math.random() * 3)] : 200,
    latency:
      chaosType === 'latency'
        ? Math.floor(Math.random() * ((routeRule?.latency.maxDelay || 500) - (routeRule?.latency.minDelay || 100) + 1)) +
          (routeRule?.latency.minDelay || 100)
        : Math.floor(Math.random() * 220) + 40,
    chaosType,
  };
});

const getActiveRouteRules = () => mockConfig.routes.filter(route => route.enabled).length;

const buildMetrics = (): Metrics => {
  const totalRequests = mockRequests.length;
  const injectedRequests = mockRequests.filter(request => request.chaosType).length;
  const successRate =
    totalRequests === 0
      ? 0
      : (mockRequests.filter(request => request.status >= 200 && request.status < 300).length / totalRequests) * 100;
  const averageLatency =
    totalRequests === 0 ? 0 : mockRequests.reduce((sum, request) => sum + request.latency, 0) / totalRequests;

  return {
    totalRequests,
    injectedRequests,
    successRate,
    averageLatency,
    activeRouteRules: getActiveRouteRules(),
  };
};

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

const shouldUseMockOnly = () => USE_MOCK_DATA || BACKEND_MODE === 'mock';

const toBackendRouteKey = (path: string) => {
  // Use path as-is, no transformation
  return path;
};

const mapBackendRoutes = async (): Promise<DiscoveredRoute[]> => {
  const res = await fetch(`${API_BASE}/chaos/routes`);
  if (!res.ok) throw new Error('Failed to fetch discovered routes');

  const data: Array<{ method: string; path: string }> = await res.json();

  return data.map((route, index) => ({
    id: `${route.method}-${route.path}-${index}`,
    path: route.path, // Use backend path as-is, no /api prefix
    method: route.method === 'ANY' ? 'GET' : (route.method as HttpMethod),
    requestCount: 0,
    averageLatency: 0,
    errorRate: 0,
    lastSeen: Date.now(),
  }));
};

const mapBackendConfig = async (): Promise<ChaosConfig> => {
  const res = await fetch(`${API_BASE}/chaos/config`);
  if (!res.ok) throw new Error('Failed to fetch config');

  const backendConfig: Record<
    string,
    {
      enabled: boolean;
      failureRate: number;
      delayRate: number;
      minDelayMs: number;
      maxDelayMs: number;
      errorCodes: number[];
    }
  > = await res.json();

  const routes = Object.entries(backendConfig).map(([path, route]) => ({
    id: `ANY-${path}`,
    path: path, // Use backend path as-is, no /api prefix
    method: 'GET' as HttpMethod,
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
      statusCodes: route.errorCodes?.length ? route.errorCodes : [500],
    },
  }));

  return {
    ...structuredClone(mockConfig),
    routes,
    updatedAt: Date.now(),
  };
};

const persistMockConfigVersion = (config: ChaosConfig) => {
  mockConfig = {
    ...structuredClone(config),
    updatedAt: Date.now(),
  };
};

const updateBackendConfig = async (config: ChaosConfig): Promise<void> => {
  const payload = config.routes.reduce<Record<string, unknown>>((acc, route) => {
    acc[toBackendRouteKey(route.path)] = {
      enabled: route.enabled,
      failureRate: route.errors.enabled ? route.errors.probability : 0,
      delayRate: route.latency.enabled ? route.latency.probability : 0,
      minDelayMs: route.latency.minDelay,
      maxDelayMs: route.latency.maxDelay,
      errorCodes: route.errors.statusCodes,
    };
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
    await delay(120);
    return buildMetrics();
  },

  getConfig: async (): Promise<ChaosConfig> => {
    if (shouldUseMockOnly()) {
      await delay();
      return structuredClone(mockConfig);
    }

    try {
      const backendConfig = await mapBackendConfig();
      mockConfig = {
        ...structuredClone(mockConfig),
        routes: backendConfig.routes,
        updatedAt: Date.now(),
      };
      return structuredClone(mockConfig);
    } catch {
      return structuredClone(mockConfig);
    }
  },

  updateConfig: async (config: ChaosConfig): Promise<void> => {
    const validation = validateConfig(config);

    if (!validation.valid) {
      throw new Error(validation.errors.join(' '));
    }

    persistMockConfigVersion(config);

    if (shouldUseMockOnly()) {
      await delay();
      return;
    }

    try {
      await updateBackendConfig(config);
    } catch {
      // Keep frontend state functional even when backend only partially supports the contract.
    }
  },

  validateConfig: async (config: ChaosConfig): Promise<ConfigValidationResult> => {
    await delay(100);
    return validateConfig(config);
  },

  getRequests: async (limit = 50, filters?: Partial<RequestFilters>): Promise<Request[]> => {
    await delay(120);
    return applyRequestFilters(mockRequests, filters).slice(0, limit);
  },

  getDiscoveredRoutes: async (): Promise<DiscoveredRoute[]> => {
    if (shouldUseMockOnly()) {
      await delay();
      return structuredClone(mockDiscoveredRoutes);
    }

    try {
      const backendRoutes = await mapBackendRoutes();
      const merged = [...structuredClone(mockDiscoveredRoutes)];

      backendRoutes.forEach(route => {
        if (!merged.some(existing => existing.path === route.path)) {
          merged.push(route);
        }
      });

      return merged;
    } catch {
      return structuredClone(mockDiscoveredRoutes);
    }
  },


  setChaosEnabled: async (enabled: boolean): Promise<void> => {
    await delay(100);
    mockConfig.enabled = enabled;
    mockConfig.updatedAt = Date.now();
  },

  createRouteRuleFromDiscovery: async (path: string, method: HttpMethod): Promise<RouteChaosRule> => {
    await delay(100);
    const existingRule = mockConfig.routes.find(route => route.path === path && route.method === method);
    if (existingRule) return structuredClone(existingRule);

    const newRule = createDefaultRouteRule(path, method);
    mockConfig.routes = [...mockConfig.routes, newRule];
    mockConfig.updatedAt = Date.now();
    return structuredClone(newRule);
  },
};

// Made with Bob
