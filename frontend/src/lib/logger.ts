/**
 * Frontend logger for tf-dashboard.
 *
 * - Logs to browser console with structured format in development
 * - Sends error/warn logs to backend /api/logs for server-side collection
 * - Catches unhandled errors and promise rejections globally
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
  source: "frontend";
  url?: string;
  userAgent?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel =
  (typeof window !== "undefined" &&
    (new URLSearchParams(window.location.search).get("logLevel") as LogLevel)) ||
  "info";

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function createEntry(level: LogLevel, message: string, data?: Record<string, unknown>): LogEntry {
  return {
    level,
    message,
    data,
    timestamp: new Date().toISOString(),
    source: "frontend",
    url: typeof window !== "undefined" ? window.location.href : undefined,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
  };
}

function toConsole(entry: LogEntry): void {
  const prefix = `[${entry.timestamp.slice(11, 19)}]`;
  switch (entry.level) {
    case "error":
      console.error(prefix, entry.message, entry.data || "");
      break;
    case "warn":
      console.warn(prefix, entry.message, entry.data || "");
      break;
    case "info":
      console.info(prefix, entry.message, entry.data || "");
      break;
    case "debug":
      console.debug(prefix, entry.message, entry.data || "");
      break;
  }
}

async function sendToBackend(entry: LogEntry): Promise<void> {
  if (typeof fetch === "undefined") return;
  // Fire-and-forget: don't block or throw
  try {
    await fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level: entry.level,
        message: entry.message,
        data: entry.data,
        source: "frontend",
      }),
      // Keepalive ensures the request completes even if page unloads
      keepalive: true,
    });
  } catch {
    // Silently ignore — logging shouldn't break the app
  }
}

function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;
  const entry = createEntry(level, message, data);
  toConsole(entry);
  // Only send warn/error to backend (reduce noise)
  if (level === "warn" || level === "error") {
    sendToBackend(entry);
  }
}

export const logger = {
  debug: (msg: string, data?: Record<string, unknown>) => log("debug", msg, data),
  info: (msg: string, data?: Record<string, unknown>) => log("info", msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => log("warn", msg, data),
  error: (msg: string, data?: Record<string, unknown>) => log("error", msg, data),
};

/**
 * Install global error handlers to capture uncaught exceptions
 * and unhandled promise rejections.
 */
export function installGlobalErrorHandler(): void {
  if (typeof window === "undefined") return;

  window.onerror = (msg, source, line, col, err) => {
    logger.error("未捕获的异常", {
      message: String(msg),
      source: source || "unknown",
      line,
      col,
      error: err?.message,
      stack: err?.stack,
    });
    return false;
  };

  window.onunhandledrejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    logger.error("未处理的Promise异常", {
      message: reason?.message || String(reason),
      stack: reason?.stack,
    });
  };
}
