// HTTP Methods
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

// Authentication Types
export type AuthType = 'none' | 'bearer' | 'basic' | 'apiKey' | 'custom' | 'oauth2';

export interface BearerAuth {
  type: 'bearer';
  token: string;
}

export interface BasicAuth {
  type: 'basic';
  username: string;
  password: string;
}

export interface ApiKeyAuth {
  type: 'apiKey';
  key: string;
  value: string;
  in: 'header' | 'query';
}

export interface CustomHeaderAuth {
  type: 'custom';
  headerName: string;
  headerValue: string;
}

export interface OAuth2ClientCredentialsAuth {
  type: 'oauth2';
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
}

export type AuthConfig =
  | { type: 'none' }
  | BearerAuth
  | BasicAuth
  | ApiKeyAuth
  | CustomHeaderAuth
  | OAuth2ClientCredentialsAuth;

// Body types
export type BodyType = 'none' | 'json' | 'xml' | 'text' | 'urlencoded' | 'form-data' | 'raw';

export interface KeyValuePair {
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

// Single Request Definition
export interface ApiRequestDefinition {
  id?: string;
  name: string;
  url: string;
  method: HttpMethod;
  headers: KeyValuePair[];
  queryParams: KeyValuePair[];
  auth: AuthConfig;
  bodyType: BodyType;
  bodyContent?: string;
  timeoutMs?: number;
  insecureSkipTlsVerify?: boolean;
  tags?: Record<string, string>;
  assertions?: CheckAssertion[];
}

// Assertions & Checks
export interface CheckAssertion {
  id: string;
  name: string;
  type: 'statusCode' | 'responseTime' | 'bodyContains' | 'jsonPath' | 'headerExists';
  operator: 'equals' | 'notEquals' | 'lessThan' | 'greaterThan' | 'contains';
  targetValue: string | number;
}

// Load Strategies
export type LoadStrategy =
  | 'constant-vus'
  | 'ramping-vus'
  | 'constant-arrival-rate'
  | 'ramping-arrival-rate'
  | 'shared-iterations'
  | 'per-vu-iterations';

export interface LoadStage {
  id?: string;
  duration: string; // e.g., '10s', '1m', '2h'
  target: number;   // Target VUs or target rate
}

export interface LoadProfileConfig {
  strategy: LoadStrategy;
  vus?: number;
  duration?: string;              // e.g. '120s'
  rampUpDuration?: string;        // e.g. '10s'
  rampDownDuration?: string;      // e.g. '10s'
  stages?: LoadStage[];
  rate?: number;                  // iterations per timeUnit for arrival-rate
  timeUnit?: string;              // e.g. '1s', default '1s'
  preAllocatedVUs?: number;
  maxVUs?: number;
  iterations?: number;            // for shared-iterations and per-vu-iterations
  gracefulStop?: string;          // e.g. '5s'
  gracefulRampDown?: string;      // e.g. '5s'
}

// Performance Thresholds
export interface PerformanceThreshold {
  id?: string;
  metric: 'http_req_duration' | 'http_req_failed' | 'checks' | 'iterations' | string;
  aggregation: 'p50' | 'p90' | 'p95' | 'p99' | 'avg' | 'min' | 'max' | 'rate' | 'count';
  operator: '<' | '<=' | '>' | '>=' | '==' | '!=';
  value: number;
}

// Complete Load Test Configuration
export interface TestConfiguration {
  id?: string;
  name: string;
  description?: string;
  projectId?: string;
  environmentId?: string;
  request: ApiRequestDefinition;
  loadProfile: LoadProfileConfig;
  thresholds: PerformanceThreshold[];
  variables?: Record<string, string>;
}

// Execution Lifecycle Status
export type ExecutionStatus =
  | 'QUEUED'
  | 'VALIDATING'
  | 'RUNNING'
  | 'STOPPING'
  | 'COMPLETED'
  | 'ABORTED'
  | 'ERROR';

// Test Performance Result
export type TestResultVerdict = 'PASSED' | 'FAILED' | 'UNKNOWN';

// Real-Time Telemetry Snapshot
export interface MetricSnapshot {
  timestamp: number;
  elapsedSeconds: number;
  activeVus: number;
  rps: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  totalRequests: number;
  failedRequests: number;
  errorRate: number;
  dataReceivedBytes: number;
  dataSentBytes: number;
  checksPassed: number;
  checksFailed: number;
  droppedIterations?: number;
}

// Execution Summary & Report
export interface ExecutionSummaryReport {
  executionId: string;
  testId?: string;
  testName: string;
  status: ExecutionStatus;
  verdict: TestResultVerdict;
  startedAt: string;
  finishedAt: string;
  durationSeconds: number;
  totalRequests: number;
  failedRequests: number;
  errorRate: number;
  avgRps: number;
  peakRps: number;
  peakVus: number;
  latency: {
    min: number;
    max: number;
    avg: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  dataReceivedBytes: number;
  dataSentBytes: number;
  checks: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
  };
  thresholdResults: Array<{
    threshold: string;
    actualValue: number;
    passed: boolean;
  }>;
  configurationSnapshot: TestConfiguration;
  errorMessage?: string;
}

// Target Security Validation
export interface TargetValidationResult {
  isValid: boolean;
  resolvedIp?: string;
  reason?: string;
  isPrivateNetwork?: boolean;
}
