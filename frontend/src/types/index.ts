export type ChaosType = 'latency' | 'error';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface LatencyRule {
  enabled: boolean;
  minDelay: number;
  maxDelay: number;
  probability: number;
}

export interface ErrorRule {
  enabled: boolean;
  probability: number;
  statusCodes: number[];
}

export interface RouteChaosRule {
  id: string;
  path: string;
  method: HttpMethod;
  enabled: boolean;
  latency: LatencyRule;
  errors: ErrorRule;
}

export interface ChaosConfig {
  enabled: boolean;
  defaultProbability: number;
  latency: LatencyRule;
  errors: ErrorRule;
  routes: RouteChaosRule[];
  updatedAt?: number;
  versionName?: string;
}

export interface Metrics {
  totalRequests: number;
  injectedRequests: number;
  successRate: number;
  averageLatency: number;
  activeRouteRules?: number;
}

export interface Request {
  id: string;
  timestamp: number;
  route: string;
  method: HttpMethod;
  status: number;
  chaosType?: ChaosType;
  latency: number;
}

export interface DiscoveredRoute {
  id: string;
  path: string;
  method: HttpMethod;
  requestCount: number;
  averageLatency: number;
  errorRate: number;
  lastSeen: number;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface RequestFilters {
  search: string;
  method: 'ALL' | HttpMethod;
  chaosType: 'ALL' | ChaosType;
  status: 'ALL' | '2xx' | '4xx' | '5xx';
  route: string;
}

// Made with Bob
