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

export interface DeepSeekBalance {
  id: number;
  recordedAt: string;
  balanceTotal: string;
  balanceGranted: string;
  balanceToppedUp: string;
  currency: string;
}
