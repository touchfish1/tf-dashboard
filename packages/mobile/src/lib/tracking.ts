import { Platform, Dimensions } from 'react-native'
import Constants from 'expo-constants'

// ─── Platform detection ─────────────────────────────
const OS = Platform.OS // 'ios' | 'android' | 'web'

/** "app" = native, "app_h5" = React Native Web export, "web" = Vite web */
export type TrackSource = 'app' | 'app_h5' | 'web'

/** User-readable device description */
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
  if (OS === 'ios') return 'iOS App'
  if (OS === 'android') return 'Android App'
  return 'App'
}

// ─── Env info ────────────────────────────────────────
export interface TrackEnv {
  source: TrackSource
  sessionId: string
  platform: string
  osVersion: string
  device: string
  screen: string
  appVersion: string
  timezone: string
  locale: string
  /** Browser UA — only on web */
  userAgent?: string
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function collectEnv(): TrackEnv {
  const dim = Dimensions.get('window')
  const isWeb = OS === 'web'
  const source: TrackSource = isWeb ? 'app_h5' : 'app'

  let ua: string | undefined
  try { ua = isWeb ? navigator.userAgent?.slice(0, 200) : undefined } catch {}

  return {
    source,
    sessionId: genId(),
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

// ─── Event types ─────────────────────────────────────
type TrackEvent = 'page_view' | 'action' | 'api_call' | 'error' | 'performance' | 'session'

interface TrackPayload {
  event: TrackEvent
  category?: string
  action?: string
  label?: string
  value?: number
  path?: string
  durationMs?: number
  env: TrackEnv
  metadata?: Record<string, unknown>
}

// ─── Send ────────────────────────────────────────────
function send(payload: TrackPayload): void {
  try {
    const body = JSON.stringify({
      level: 'info',
      message: `[埋点] ${payload.event}${payload.action ? ':' + payload.action : ''}`,
      data: payload,
      source: 'mobile', // distinguishes from web frontend's "frontend" source
    })
    // Use fetch (fire-and-forget)
    const url = '/api/logs'
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Never throw from tracking
  }
}

// ─── Public API ──────────────────────────────────────

/** Page view — call on screen mount */
export function trackPageView(path: string): void {
  send({ event: 'page_view', path, env: ENV })
}

/** User action (button tap, nav, etc.) */
export function trackAction(category: string, action: string, label?: string, metadata?: Record<string, unknown>): void {
  send({ event: 'action', category, action, label, env: ENV, metadata })
}

/** API call timing */
export function trackApiCall(path: string, durationMs: number, status: number, method?: string): void {
  send({ event: 'api_call', path, durationMs, value: status, env: ENV, metadata: { method } })
}

/** Performance metric */
export function trackPerformance(name: string, valueMs: number): void {
  send({ event: 'performance', action: name, value: valueMs, env: ENV })
}

/** Error tracking */
export function trackError(message: string, stack?: string): void {
  send({ event: 'error', action: message, env: ENV, metadata: { stack } })
}

// ─── Session heartbeat ───────────────────────────────
let timer: ReturnType<typeof setInterval> | null = null
let sessionStart = Date.now()

export function startSessionTracking(): void {
  timer = setInterval(() => {
    const elapsed = Math.round((Date.now() - sessionStart) / 1000)
    send({ event: 'session', action: 'heartbeat', value: elapsed, env: ENV })
  }, 30000)
}

export function stopSessionTracking(): void {
  if (timer) clearInterval(timer)
}

/** Get the current env (for attaching to logs) */
export function getTrackEnv(): TrackEnv {
  return ENV
}
