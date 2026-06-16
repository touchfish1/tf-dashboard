export interface Server {
  id: number;
  name: string;
  metricsUrl: string;
  labels: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServerMetrics {
  id: number;
  serverId: number;
  collectedAt: string;
  cpuPercent: string;
  cpuLoad1m: string;
  cpuLoad5m: string;
  cpuLoad15m: string;
  memoryUsedMb: number;
  memoryTotalMb: number;
  memoryPercent: string;
  diskTotalGb: string;
  diskUsedGb: string;
  networkRxBytes: number;
  networkTxBytes: number;
  uptimeSeconds: number;
}

export interface ServerSummary {
  avgCpu: string;
  maxCpu: string;
  avgMem: string;
  maxMem: string;
  latestCpu: string;
  latestMem: string;
  latestDisk: string;
  totalDisk: string;
  uptime: number;
}

/** Per-record usage (raw from DB) */
export interface OpenCodeUsage {
  id: number;
  bucketStart: string;
  bucketEnd: string;
  model: string;
  agent: string;
  tokensInput: number;
  tokensOutput: number;
  tokensReasoning: number;
  tokensCacheRead: number;
  tokensCacheWrite: number;
  cost: string;
  sessionCount: number;
}

/** Daily-aggregated usage (server-side GROUP BY day) */
export interface OpenCodeDailyUsage {
  bucketStart: string;
  tokensInput: number;
  tokensOutput: number;
  tokensReasoning: number;
  tokensCacheRead: number;
  tokensCacheWrite: number;
  cost: string;
  sessionCount: number;
}

export interface OpenCodeSummary {
  totalCost: string;
  totalInput: number;
  totalOutput: number;
  totalSessions: number;
}

export interface OpenCodeByModel {
  model: string;
  cost: string;
  tokensInput: number;
  tokensOutput: number;
  tokensCacheRead: number;
  tokensCacheWrite: number;
  sessionCount: number;
}

export interface DashboardSection {
  id: string;
  title: string;
  visible: boolean;
}

export interface DashboardConfig {
  sections: DashboardSection[];
}

export interface NavLink {
  id: number;
  title: string;
  url: string;
  icon: string;
  category: string;
  sortOrder: number;
  createdAt: string;
}

export interface Alert {
  id: number;
  type: string;
  severity: string;
  title: string;
  message: string;
  refId: string | null;
  acknowledged: boolean;
  createdAt: string;
}

export interface PredictionPoint {
  date: string;
  tokensInput: number;
  tokensOutput: number;
  cost: number;
}

export interface PredictionTrend {
  inputSlope: number;
  outputSlope: number;
  costSlope: number;
  weeklyProjected: {
    tokensInput: number;
    tokensOutput: number;
    cost: number;
  };
}

export interface OpenCodePrediction {
  actual: PredictionPoint[];
  predicted: PredictionPoint[];
  trend: PredictionTrend;
}

export interface AuditEntry {
  id: number;
  timestamp: string;
  type: string;
  action: string;
  actor: string;
  resource: string;
  resourceId: string | null;
  detail: string | null;
  ip: string;
  userAgent: string;
}

export interface DeepSeekBalance {
  id: number;
  recordedAt: string;
  balanceTotal: string;
  balanceGranted: string;
  balanceToppedUp: string;
  currency: string;
}

// ─── Alert Rules ────────────────────────────────

export interface AlertRule {
  id: number;
  name: string;
  enabled: boolean;
  conditions: RuleCondition[];
  matchMode: 'all' | 'any';
  notificationChannels: string[];
  cooldownMinutes: number;
  severity: 'info' | 'warning' | 'critical';
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface RuleCondition {
  field: 'deepseek_balance' | 'server_offline' | 'opencode_etl_error' | 'opencode_cost_anomaly' | 'monthly_budget_pct' | 'cpu_percent' | 'memory_percent';
  operator: 'lt' | 'lte' | 'gt' | 'gte' | 'eq' | 'true';
  value?: number;
  unit?: string;
}

export interface NotificationChannel {
  type: 'slack' | 'feishu' | 'dingtalk' | 'wecom' | 'webhook_generic';
  url: string;
  name: string;
}

// ─── Reports ──────────────────────────────────────

export interface ScheduledReport {
  id: number;
  type: 'daily' | 'weekly';
  status: 'pending' | 'sent' | 'failed';
  periodStart: string;
  periodEnd: string;
  sentTo: string[] | null;
  error: string | null;
  createdAt: string;
}

// ─── Poller Health / Status ─────────────────────────

export interface PollerStatus {
  name: string;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  runCount: number;
  errorCount: number;
  isRunning: boolean;
}

export interface StatusResponse {
  pollers: PollerStatus[];
  uptime: number;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
  };
}

// ─── Auth ────────────────────────────────────────

export interface AuthUser {
  id: number;
  email: string;
  displayName: string;
  role: "admin" | "viewer";
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

// ─── Users (admin management) ─────────────────────

export interface User {
  id: number;
  email: string;
  displayName: string;
  role: "admin" | "viewer";
  isActive: boolean;
  createdAt: string;
  lastLogin: string | null;
}
