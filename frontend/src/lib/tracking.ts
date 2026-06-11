/**
 * Frontend tracking (埋点) for tf-dashboard.
 *
 * Collects: 页面浏览 | 用户操作 | API调用 | 性能指标 | Web Vitals | 环境信息
 * Sends to: POST /api/logs → Pino → OpenObserve
 *
 * 每一条埋点自动附带：浏览器/OS/屏幕/网络/视口等环境信息。
 */

// ─── 环境信息（会话级别，初始化时采集一次）─────────────────────

interface EnvInfo {
  sessionId: string;
  userAgent: string;
  platform: string;
  language: string;
  screen: string;
  viewport: string;
  dpr: number;
  connection: string;
  deviceMemory: string;
  referrer: string;
  timezone: string;
}

function collectEnv(): EnvInfo {
  const conn = (navigator as any).connection;
  return {
    sessionId: (self.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 18)).slice(0, 8),
    userAgent: navigator.userAgent.slice(0, 200),
    platform: (navigator as any).platform || "",
    language: navigator.language,
    screen: `${screen.width}x${screen.height}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    dpr: window.devicePixelRatio || 1,
    connection: conn?.effectiveType || "",
    deviceMemory: String((navigator as any).deviceMemory || ""),
    referrer: document.referrer?.slice(0, 200) || "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

const ENV = collectEnv();
let pageLoadTime = performance.now();
let sessionStart = Date.now();

// ─── 事件类型 ─────────────────────────────────────────────

type TrackEvent =
  | "page_view"
  | "action"
  | "api_call"
  | "error"
  | "performance"
  | "web_vital"
  | "session";

interface TrackPayload {
  event: TrackEvent;
  category?: string;
  action?: string;
  label?: string;
  value?: number;
  path?: string;
  durationMs?: number;
  env: EnvInfo;
  metadata?: Record<string, unknown>;
}

// ─── 页面浏览 ────────────────────────────────────────────

export function trackPageView(path: string): void {
  const loadTime = Math.round(performance.now() - pageLoadTime);
  send({ event: "page_view", path, durationMs: loadTime, env: ENV });
  pageLoadTime = performance.now();
}

// ─── 用户操作 ────────────────────────────────────────────

export function trackAction(category: string, action: string, label?: string, metadata?: Record<string, unknown>): void {
  send({ event: "action", category, action, label, env: ENV, metadata });
}

// ─── API 调用 ────────────────────────────────────────────

export function trackApiCall(endpoint: string, durationMs: number, status: number, method?: string): void {
  send({ event: "api_call", path: endpoint, durationMs, value: status, env: ENV, metadata: { method } });
}

// ─── 性能指标 ────────────────────────────────────────────

export function trackPerformance(name: string, valueMs: number): void {
  send({ event: "performance", action: name, value: valueMs, env: ENV });
}

// ─── Web Vitals（Core Web Vitals：LCP / CLS / INP / FCP / TTFB）─

type VitalName = "LCP" | "CLS" | "INP" | "FCP" | "TTFB";

export function trackWebVital(name: VitalName, value: number, rating?: string): void {
  send({ event: "web_vital", action: name, value, label: rating, env: ENV });
}

/**
 * 使用 PerformanceObserver API 自动采集 Core Web Vitals。
 * 在应用初始化时调用一次即可。
 */
export function initWebVitals(): void {
  try {
    // LCP
    const lcpObs = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      if (entries.length > 0) {
        const entry = entries[entries.length - 1];
        trackWebVital("LCP", entry.startTime);
      }
    });
    lcpObs.observe({ type: "largest-contentful-paint", buffered: true });

    // CLS
    let clsValue = 0;
    const clsObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value || 0;
        }
      }
    });
    clsObs.observe({ type: "layout-shift", buffered: true });
    // CLS 在页面卸载时报告
    if ("onpagehide" in self) {
      addEventListener("pagehide", () => {
        if (clsValue > 0) trackWebVital("CLS", Math.round(clsValue * 1000) / 1000);
      }, { once: true });
    }

    // FCP
    const fcpObs = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      if (entries.length > 0) {
        trackWebVital("FCP", entries[0].startTime);
      }
    });
    fcpObs.observe({ type: "paint", buffered: true });

    // TTFB
    if ("navigation" in performance) {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      if (nav) {
        trackWebVital("TTFB", nav.responseStart - nav.requestStart);
      }
    }
  } catch {
    // PerformanceObserver 不支持时静默跳过
  }
}

// ─── 会话时长 ─────────────────────────────────────────────

let sessionDurationTimer: ReturnType<typeof setInterval> | null = null;

/**
 * 启动会话计时（每 30 秒记录一次会话存活）。
 */
export function startSessionTracking(): void {
  sessionDurationTimer = setInterval(() => {
    const elapsed = Math.round((Date.now() - sessionStart) / 1000);
    send({ event: "session", action: "heartbeat", value: elapsed, env: ENV });
  }, 30000);
}

export function stopSessionTracking(): void {
  if (sessionDurationTimer) clearInterval(sessionDurationTimer);
}

// ─── 视口变化（响应式分析）────────────────────────────────

let viewportTimer: ReturnType<typeof setTimeout> | null = null;

export function initViewportTracking(): void {
  addEventListener("resize", () => {
    if (viewportTimer) clearTimeout(viewportTimer);
    viewportTimer = setTimeout(() => {
      ENV.viewport = `${window.innerWidth}x${window.innerHeight}`;
    }, 500);
  }, { passive: true });
}

// ─── 发送（统一出口）─────────────────────────────────────

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
