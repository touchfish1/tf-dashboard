/** Per-record usage (raw from DB) */
export interface OpenCodeUsage {
  id: number
  bucketStart: string
  bucketEnd: string
  model: string
  agent: string
  tokensInput: number
  tokensOutput: number
  tokensReasoning: number
  tokensCacheRead: number
  tokensCacheWrite: number
  cost: string
  sessionCount: number
}

/** Daily-aggregated usage (server-side GROUP BY day) */
export interface OpenCodeDailyUsage {
  bucketStart: string
  tokensInput: number
  tokensOutput: number
  tokensReasoning: number
  tokensCacheRead: number
  tokensCacheWrite: number
  cost: string
  sessionCount: number
}

export interface OpenCodeSummary {
  totalCost: string
  totalInput: number
  totalOutput: number
  totalSessions: number
}

export interface OpenCodeByModel {
  model: string
  cost: string
  tokensInput: number
  tokensOutput: number
}

export interface PredictionPoint {
  date: string
  tokensInput: number
  tokensOutput: number
  cost: number
}

export interface PredictionTrend {
  inputSlope: number
  outputSlope: number
  costSlope: number
  weeklyProjected: {
    tokensInput: number
    tokensOutput: number
    cost: number
  }
}

export interface OpenCodePrediction {
  actual: PredictionPoint[]
  predicted: PredictionPoint[]
  trend: PredictionTrend
}
