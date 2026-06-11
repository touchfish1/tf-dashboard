import { Platform, Dimensions } from 'react-native'
import Constants from 'expo-constants'
import { api } from '@tf-dashboard/shared/api/client'

// ─── Platform ───────────────────────────────────────
const OS = Platform.OS
export type TrackSource = 'app' | 'app_h5' | 'web'

function deviceDesc(): string {
  if (OS === 'web') {
    try {
      const ua = navigator.userAgent || ''
      if (/iPhone/.test(ua)) return 'iOS Safari'
      if (/Android/.test(ua)) return 'Android Browser'
      if (/Edg/.test(ua)) return 'Edge'
      if (/Chrome/.test(ua)) return 'Chrome'
      if (/Firefox/.test(ua)) return 'Firefox'
      if (/Safari/.test(ua)) return 'Safari'
      return 'Web'
    } catch { return 'Web' }
  }
  return OS === 'ios' ? 'iOS App' : OS === 'android' ? 'Android App' : 'App'
}

// ─── Env ────────────────────────────────────────────
export interface TrackEnv {
  source: TrackSource; sessionId: string; platform: string; osVersion: string
  device: string; screen: string; appVersion: string; timezone: string; locale: string
  userAgent?: string
}

function collectEnv(): TrackEnv {
  const dim = Dimensions.get('window')
  const isWeb = OS === 'web'
  let ua: string | undefined
  try { ua = isWeb ? navigator.userAgent?.slice(0, 200) : undefined } catch {}
  return {
    source: isWeb ? 'app_h5' : 'app',
    sessionId: Math.random().toString(36).slice(2, 10),
    platform: OS,
    osVersion: Platform.Version?.toString() || '',
    device: deviceDesc(),
    screen: `${Math.round(dim.width)}x${Math.round(dim.height)}`,
    appVersion: Constants.expoConfig?.version || '0.1.0',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: Constants.locale || 'zh-CN',
    ...(ua ? { userAgent: ua } : {}),
  }
}

const ENV = collectEnv()

// ─── Event types ────────────────────────────────────
export type TrackEvent = 'page_view' | 'action' | 'api_call' | 'error' | 'performance' | 'session'

interface TrackPayload {
  event: TrackEvent; category?: string; action?: string; label?: string
  value?: number; path?: string; durationMs?: number; env: TrackEnv
  metadata?: Record<string, unknown>
}

// ─── Buffer & flush ─────────────────────────────────
let buffer: TrackPayload[] = []
let flushTimer: ReturnType<typeof setInterval> | null = null
let flushIntervalMs = 30000 // default 30s
let sessionStart = Date.now()

function enqueue(payload: TrackPayload): void {
  buffer.push(payload)
}

async function flush(): Promise<void> {
  if (buffer.length === 0) return
  const batch = buffer.splice(0, buffer.length)
  try {
    await api.post('/logs', {
      batch: batch.map((p) => ({
        level: 'info',
        message: `[埋点] ${p.event}${p.action ? ':' + p.action : ''}`,
        data: p,
        source: 'mobile',
      })),
    })
  } catch {
    // Never throw from tracking
  }
}

// ─── Public API ─────────────────────────────────────
export function trackPageView(path: string): void { enqueue({ event: 'page_view', path, env: ENV }) }
export function trackAction(category: string, action: string, label?: string, metadata?: Record<string, unknown>): void {
  enqueue({ event: 'action', category, action, label, env: ENV, metadata })
}
export function trackApiCall(path: string, durationMs: number, status: number, method?: string): void {
  enqueue({ event: 'api_call', path, durationMs, value: status, env: ENV, metadata: { method } })
}
export function trackPerformance(name: string, valueMs: number): void {
  enqueue({ event: 'performance', action: name, value: valueMs, env: ENV })
}
export function trackError(message: string, stack?: string): void {
  enqueue({ event: 'error', action: message, env: ENV, metadata: { stack } })
}

// ─── Session heartbeat (also triggers flush) ────────
export async function startTracking(): Promise<void> {
  // Fetch flush interval from backend settings
  try {
    const res = await api.get<{ value: string | null }>('/settings/tracking_interval')
    if (res.data?.value) {
      const parsed = parseInt(res.data.value, 10)
      if (parsed >= 5000) flushIntervalMs = parsed
    }
  } catch {}

  // Periodic flush
  flushTimer = setInterval(() => { flush() }, flushIntervalMs)

  // Session heartbeat (every flush)
  const hbInterval = setInterval(() => {
    const elapsed = Math.round((Date.now() - sessionStart) / 1000)
    enqueue({ event: 'session', action: 'heartbeat', value: elapsed, env: ENV })
  }, flushIntervalMs)
  // Don't leak the timer ref — flushTimer cleanup also handles hb
  ;(flushTimer as any)._hb = hbInterval
}

export function stopTracking(): void {
  if (flushTimer) {
    clearInterval(flushTimer)
    clearInterval((flushTimer as any)._hb)
    flushTimer = null
  }
  flush() // flush remaining
}

export function getTrackEnv(): TrackEnv { return ENV }
