export interface Server {
  id: number
  name: string
  metricsUrl: string
  labels: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ServerMetrics {
  id: number
  serverId: number
  collectedAt: string
  cpuPercent: string
  cpuLoad1m: string
  cpuLoad5m: string
  cpuLoad15m: string
  memoryUsedMb: number
  memoryTotalMb: number
  memoryPercent: string
  diskTotalGb: string
  diskUsedGb: string
  networkRxBytes: number
  networkTxBytes: number
  uptimeSeconds: number
}

export interface ServerSummary {
  avgCpu: string
  maxCpu: string
  avgMem: string
  maxMem: string
  latestCpu: string
  latestMem: string
  latestDisk: string
  totalDisk: string
  uptime: number
}
