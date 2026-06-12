import { useQuery } from '@tanstack/react-query'
import * as serversApi from '@tf-dashboard/shared/api/servers'
import * as opencodeApi from '@tf-dashboard/shared/api/opencode'
import * as deepseekApi from '@tf-dashboard/shared/api/deepseek'
import * as linksApi from '@tf-dashboard/shared/api/links'
import * as alertsApi from '@tf-dashboard/shared/api/alerts'

// ─── Servers ────────────────────────────────
export function useServers() {
  return useQuery({ queryKey: ['servers'], queryFn: serversApi.list })
}

export function useServerMetrics(id: number, limit = 60) {
  return useQuery({
    queryKey: ['servers', id, 'metrics', limit],
    queryFn: () => serversApi.metrics(id, limit),
    enabled: !!id,
  })
}

export function useServerSummary(id: number) {
  return useQuery({
    queryKey: ['servers', id, 'summary'],
    queryFn: () => serversApi.summary(id),
    enabled: !!id,
  })
}

// ─── OpenCode ───────────────────────────────
export function useOpenCodeSummary() {
  return useQuery({ queryKey: ['opencode', 'summary'], queryFn: opencodeApi.summary })
}

export function useOpenCodeUsage(days = 7) {
  return useQuery({
    queryKey: ['opencode', 'usage', days],
    queryFn: () => opencodeApi.usage(days),
  })
}

export function useOpenCodeByModel(days = 7) {
  return useQuery({
    queryKey: ['opencode', 'byModel', days],
    queryFn: () => opencodeApi.byModel(days),
  })
}

export function useOpenCodePrediction(days = 30, predictDays = 7) {
  return useQuery({
    queryKey: ['opencode', 'predict', days, predictDays],
    queryFn: () => opencodeApi.predict(days, predictDays),
  })
}

// ─── DeepSeek ───────────────────────────────
export function useDeepSeekBalance() {
  return useQuery({
    queryKey: ['deepseek', 'balance'],
    queryFn: deepseekApi.balance,
    refetchInterval: 300_000, // 5min
  })
}

export function useDeepSeekHistory(days = 30) {
  return useQuery({
    queryKey: ['deepseek', 'history', days],
    queryFn: () => deepseekApi.history(days),
  })
}

// ─── Links ──────────────────────────────────
export function useNavLinks() {
  return useQuery({ queryKey: ['links'], queryFn: linksApi.list })
}

// ─── Alerts (detailed) ──────────────────────
export function useAlerts(limit = 20) {
  return useQuery({
    queryKey: ['alerts', limit],
    queryFn: () => alertsApi.list(limit),
  })
}

export function useAlertsList(limit = 10) {
  return useQuery({
    queryKey: ['alerts', 'list', limit],
    queryFn: () => alertsApi.list(limit),
  })
}

export function useUnreadAlertCount() {
  return useQuery({
    queryKey: ['alerts', 'unread'],
    queryFn: alertsApi.unread,
  })
}

// ─── Anomaly (direct fetch, not in shared API) ─
export function useOpenCodeAnomaly() {
  return useQuery({
    queryKey: ['opencode', 'anomaly'],
    queryFn: async () => {
      const { useSettings } = await import('../store/settings')
      const baseUrl = useSettings.getState().apiUrl.replace(/\/$/, '')
      const res = await fetch(`${baseUrl}/api/opencode/anomaly`)
      if (!res.ok) throw new Error('Failed to fetch anomaly')
      return res.json() as Promise<{ todayCost: number; avgCost: number; ratio: number; status: string }>
    },
  })
}
