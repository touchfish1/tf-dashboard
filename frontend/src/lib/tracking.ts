/**
 * Frontend tracking (埋点) for tf-dashboard.
 *
 * Tracks page views, user actions, and performance metrics.
 * Events are sent to the backend /api/logs endpoint, which
 * flows into Pino → OpenObserve for centralized log analysis.
 *
 * Tracking is fire-and-forget: failures never affect the UI.
 */

type TrackEvent =
  | "page_view"
  | "action"
  | "api_call"
  | "error"
  | "performance";

interface TrackPayload {
  event: TrackEvent;
  category?: string;
  action?: string;
  label?: string;
  value?: number;
  path?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

const SESSION_ID = crypto.randomUUID().slice(0, 8);
let pageLoadTime = performance.now();

/**
 * Track a page view — called on route changes.
 */
export function trackPageView(path: string): void {
  const loadTime = Math.round(performance.now() - pageLoadTime);
  send({ event: "page_view", path, durationMs: loadTime, metadata: { sessionId: SESSION_ID } });
  pageLoadTime = performance.now();
}

/**
 * Track a user action — button click, form submit, etc.
 */
export function trackAction(category: string, action: string, label?: string, metadata?: Record<string, unknown>): void {
  send({ event: "action", category, action, label, metadata: { ...metadata, sessionId: SESSION_ID } });
}

/**
 * Track an API call duration.
 */
export function trackApiCall(endpoint: string, durationMs: number, status: number, method?: string): void {
  send({ event: "api_call", path: endpoint, durationMs, value: status, metadata: { method } });
}

/**
 * Track a frontend performance metric.
 */
export function trackPerformance(name: string, valueMs: number): void {
  send({ event: "performance", action: name, value: valueMs });
}

function send(payload: TrackPayload): void {
  try {
    const body = JSON.stringify({
      level: "info",
      message: `[埋点] ${payload.event}${payload.action ? ":" + payload.action : ""}`,
      data: payload,
      source: "frontend",
    });
    navigator.sendBeacon("/api/logs", body);
  } catch {
    // Never throw from tracking
  }
}
