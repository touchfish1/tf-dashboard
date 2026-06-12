import pino from "pino";
import type { Context, Next } from "hono";
import { createOpenObserveStream } from "./openobserve-transport";

const level = process.env.LOG_LEVEL || "info";

const baseConfig: pino.LoggerOptions = {
  level,
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['x-api-key']",
      "*.key",
      "*.secret",
      "*.password",
      "*.token",
      "*.apiKey",
      "*.api_key",
    ],
    censor: "[REDACTED]",
  },
};

// Build multi-stream destinations
const streams: pino.StreamEntry[] = [];

// 1. stdout — pino-pretty in dev, raw JSON in prod
const isDev = process.env.NODE_ENV !== "production" && process.env.PINO_PRETTY !== "false";
if (isDev) {
  streams.push({
    stream: pino.transport({
      target: "pino-pretty",
      options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" },
    }),
  });
} else {
  streams.push({ stream: process.stdout });
}

// 2. OpenObserve (optional, configured via env vars)
const ooStream = createOpenObserveStream();
if (ooStream) {
  streams.push({ stream: ooStream });
}

export const logger = pino(baseConfig, pino.multistream(streams));

/**
 * Hono middleware: logs each request with full access context.
 * Attaches request-scoped logger to c.var.logger and request metadata to c.var.audit.
 */
export async function requestLogger(c: Context, next: Next) {
  const start = performance.now();
  const method = c.req.method;
  const path = c.req.path;
  const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
  const ua = c.req.header("user-agent") || "";
  const referer = c.req.header("referer") || "";

  const meta = { requestId: crypto.randomUUID().slice(0, 8), method, path, ip, ua, referer };
  const reqLogger = logger.child(meta);
  c.set("logger", reqLogger);
  c.set("requestMeta", meta);

  reqLogger.info({ event: "access", ip, ua: ua.slice(0, 80), referer: referer.slice(0, 120) }, `访问: ${method} ${path}`);

  await next();

  const duration = performance.now() - start;
  const status = c.res.status;

  const detail = { event: "access_end", status, durationMs: Math.round(duration) };
  const msg = `${method} ${path} → ${status} ${duration.toFixed(0)}ms`;
  if (status >= 500) reqLogger.error(detail, `服务端错误: ${method} ${path} → ${status} (${duration.toFixed(0)}ms)`);
  else if (status >= 400) reqLogger.warn(detail, `客户端错误: ${method} ${path} → ${status} (${duration.toFixed(0)}ms)`);
  else reqLogger.info(detail, `请求完成: ${method} ${path} → ${status} (${duration.toFixed(0)}ms)`);
}

/**
 * Get request-scoped logger from Hono context.
 */
export function getLogger(c: Context): pino.Logger {
  return (c.get("logger") as pino.Logger) || logger;
}

/**
 * Get request metadata (IP, UA, etc.) from Hono context.
 */
export function getRequestMeta(c: Context): Record<string, string> {
  return (c.get("requestMeta") as Record<string, string>) || {};
}


