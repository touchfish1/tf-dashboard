export interface NavLink {
  id: number
  title: string
  url: string
  icon: string
  category: string
  sortOrder: number
  createdAt: string
}

export interface Alert {
  id: number
  type: string
  severity: string
  title: string
  message: string
  refId: string | null
  acknowledged: boolean
  createdAt: string
}

export interface DashboardSection {
  id: string
  title: string
  visible: boolean
}

export interface DashboardConfig {
  sections: DashboardSection[]
}

export interface AuditEntry {
  id: number
  timestamp: string
  type: string
  action: string
  actor: string
  resource: string
  resourceId: string | null
  detail: string | null
  ip: string
  userAgent: string
}

export interface RuleCondition {
  field: 'deepseek_balance' | 'server_offline' | 'opencode_etl_error' | 'opencode_cost_anomaly' | 'monthly_budget_pct' | 'cpu_percent' | 'memory_percent'
  operator: 'lt' | 'lte' | 'gt' | 'gte' | 'eq' | 'true'
  value?: number
  unit?: string
}

export interface AlertRule {
  id: number
  name: string
  enabled: boolean
  conditions: RuleCondition[]
  matchMode: 'all' | 'any'
  notificationChannels: string[]
  cooldownMinutes: number
  severity: 'info' | 'warning' | 'critical'
  createdBy: number | null
  createdAt: string
  updatedAt: string
}

export interface ScheduledReport {
  id: number
  type: 'daily' | 'weekly'
  status: 'pending' | 'sent' | 'failed'
  periodStart: string
  periodEnd: string
  sentTo: string[] | null
  error: string | null
  createdAt: string
}

export interface User {
  id: number
  email: string
  displayName: string
  role: 'admin' | 'viewer'
  isActive: boolean
  createdAt: string
  lastLogin: string | null
}
