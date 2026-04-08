export type ChaosType = 'latency' | 'error' | 'corruption';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'ANY';

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
  // Optional backend-specific fields
  targetHeader?: string;
  targetValue?: string;
  corruptionRate?: number;
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
  /** Timestamp in milliseconds since Unix epoch */
  timestamp: number;
  route: string;
  method: HttpMethod;
  status: number;
  chaosType?: ChaosType;
  /** Latency in milliseconds */
  latency: number;
}

export interface DiscoveredRoute {
  id: string;
  path: string;
  method: HttpMethod;
  requestCount: number;
  /** Average latency in milliseconds */
  averageLatency: number;
  /** Error rate as percentage (0-100) */
  errorRate: number;
  /** Timestamp in milliseconds since Unix epoch */
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
