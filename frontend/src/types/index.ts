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
  routes: RouteChaosRule[];
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

// --- AI Analysis types (mirror back-end/proxy/llm/analyzer.go) ---

export interface RouteStatistics {
  path: string;
  requestCount: number;
  averageLatency: number;
  errorRate: number;
  chaosEnabled: boolean;
}

export interface Pattern {
  type: string; // "error_spike" | "latency_increase" | "route_correlation"
  description: string;
  severity: 'low' | 'medium' | 'high';
  affectedRoutes: string[];
}

export interface Recommendation {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  actionItems: string[];
  impact: string;
}

export interface Anomaly {
  metric: string;
  expected: number;
  actual: number;
  deviation: number;
  description: string;
}

export interface AnalysisResponse {
  summary: string;
  patterns: Pattern[];
  recommendations: Recommendation[];
  anomalies: Anomaly[];
  healthScore: number;
  generatedAt: string;
  model: string;
  processingTimeMs: number;
}

export interface ChartDataPoint {
  time: string;
  requests: number;
  chaos: number;
}

