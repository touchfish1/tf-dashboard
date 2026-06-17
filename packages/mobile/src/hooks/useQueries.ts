import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as serversApi from '@tf-dashboard/shared/api/servers'
import * as opencodeApi from '@tf-dashboard/shared/api/opencode'
import * as deepseekApi from '@tf-dashboard/shared/api/deepseek'
import * as linksApi from '@tf-dashboard/shared/api/links'
import * as alertsApi from '@tf-dashboard/shared/api/alerts'
import * as auditApi from '@tf-dashboard/shared/api/audit'
import * as alertRulesApi from '@tf-dashboard/shared/api/alert-rules'
import * as reportsApi from '@tf-dashboard/shared/api/reports'
import * as usersApi from '@tf-dashboard/shared/api/users'

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
    refetchInterval: 300_000,
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

// ─── Alerts ─────────────────────────────────
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

export function useAckAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => alertsApi.ack(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] })
      qc.invalidateQueries({ queryKey: ['alerts', 'unread'] })
    },
  })
}

// ─── Audit ──────────────────────────────────
export function useAuditLogs(limit = 50, offset = 0, days = 30, type = '') {
  return useQuery({
    queryKey: ['audit', limit, offset, days, type],
    queryFn: () => auditApi.list(limit, offset, days, type),
  })
}

// ─── Alert Rules ────────────────────────────
export function useAlertRules() {
  return useQuery({
    queryKey: ['alert-rules'],
    queryFn: alertRulesApi.list,
  })
}

export function useCreateAlertRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Parameters<typeof alertRulesApi.create>[0]) => alertRulesApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alert-rules'] }),
  })
}

export function useUpdateAlertRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: Parameters<typeof alertRulesApi.update>[1] }) =>
      alertRulesApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alert-rules'] }),
  })
}

export function useDeleteAlertRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => alertRulesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alert-rules'] }),
  })
}

// ─── Reports ────────────────────────────────
export function useReports(limit = 20) {
  return useQuery({
    queryKey: ['reports', limit],
    queryFn: () => reportsApi.list(limit),
  })
}

// ─── Users ──────────────────────────────────
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Parameters<typeof usersApi.create>[0]) => usersApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: Parameters<typeof usersApi.update>[1] }) =>
      usersApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => usersApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
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
