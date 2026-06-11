/** Format token count in human-readable form */
export function formatTokens(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

/** Format cost value from API decimal string. Null-safe. */
export function formatCost(cost: string | number | null | undefined, currency = '¥'): string {
  if (cost == null) return '—'
  const n = typeof cost === 'string' ? parseFloat(cost) : cost
  if (isNaN(n)) return '—'
  return `${currency}${n.toFixed(2)}`
}

/** Format uptime seconds to human-readable */
export function formatUptime(seconds: number | null | undefined): string {
  if (seconds == null) return '—'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  if (d > 0) return `${d}d ${h}h`
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

/** Format percentage string from API. Null-safe. */
export function formatPercent(val: string | number | null | undefined): string {
  if (val == null) return '—'
  const n = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(n)) return '—'
  return `${n.toFixed(1)}%`
}

/** Format bytes to human-readable */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '—'
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)}GB`
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)}MB`
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)}KB`
  return `${bytes}B`
}

/** Parse ISO date to locale date string */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  })
}

/** Parse ISO date to locale date + time */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
