/**
 * tf-dashboard Backend
 *
 * Hono API server + Cron-based data collectors.
 * Default port: 3000
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { ValidationError } from "./lib/validation";
import { logger, requestLogger } from "./lib/logger";

import authRoute from "./routes/auth";
import { authMiddleware } from "./middleware/auth";
import serversRoute from "./routes/servers";
import opencodeRoute from "./routes/opencode";
import deepseekRoute from "./routes/deepseek";
import settingsRoute from "./routes/settings";
import linksRoute from "./routes/links";
import alertsRoute from "./routes/alerts";
import alertRulesRoute from "./routes/alert-rules";
import uploadRoute from "./routes/upload";
import logsRoute from "./routes/logs";
import auditRoute from "./routes/audit";
import sseRoute from "./routes/sse";
import statusRoute from "./routes/status";
import reportsRoute from "./routes/reports";
import usersRoute from "./routes/users";
import { createPoller } from "./lib/poller-health";
import { cleanupOldData } from "./lib/cleanup";
import { pollAllServers } from "./pollers/servers";
import { pollOpenCodeUsage } from "./pollers/opencode";
import { pollDeepSeekBalance } from "./pollers/deepseek";
import { subscribe, emit } from "./lib/event-bus";
import { evaluateEvent } from "./lib/alert-engine";
import { startReportScheduler, reportCronJobs } from "./lib/reports";
import { rateLimit, clearRateLimitCleanup } from "./middleware/rate-limit";
import { cache, invalidateCache, clearCacheCleanup } from "./middleware/cache";
import { eq, sql } from "drizzle-orm";
import { db, client } from "./db";
import { alertRules, opencodeUsage, settings as settingsTable } from "./db/schema";

const app = new Hono();

// Request logging middleware (runs before all routes)
app.use("*", requestLogger);

// CORS: strict in production (whitelist via CORS_ORIGIN), permissive in dev
app.use("/*", cors({
  origin: process.env.NODE_ENV === "production"
    ? (process.env.CORS_ORIGIN || "").split(",").filter(Boolean)
    : (origin: string) => origin || undefined,
  credentials: true,
}));



// ─── Rate Limiting ──────────────────────────────────────────────
// Applied before auth middleware to block bad actors early.
// Strict: login brute-force protection
app.use("/api/auth/login", rateLimit({ windowMs: 60_000, maxRequests: 10 }));
// Moderate: mutation endpoints
app.use("/api/servers", rateLimit({ windowMs: 60_000, maxRequests: 30 }));
app.use("/api/settings", rateLimit({ windowMs: 60_000, maxRequests: 30 }));
app.use("/api/alert-rules", rateLimit({ windowMs: 60_000, maxRequests: 30 }));
// Default: all other API routes
app.use("/api/*", rateLimit({ windowMs: 60_000, maxRequests: 60 }));

// Auth routes (no auth middleware — they handle their own auth)
app.route("/api/auth", authRoute);

// SSE route handles its own auth (EventSource cannot set custom headers)
app.route("/api/sse", sseRoute);

// Status endpoint (no auth — for monitoring/health check)
app.route("/api/status", statusRoute);

// JWT + API key auth middleware for all remaining /api/* routes
app.use("/api/*", authMiddleware);

// User management routes (admin-only, after auth)
app.route("/api/users", usersRoute);

// ─── Caching (read-heavy GET endpoints) ─────────────────────────
// Applied after auth, before route handlers. Only affects GET requests.
app.use('/api/opencode/summary', cache(30));    // 30s TTL
app.use('/api/opencode/usage', cache(15));      // 15s TTL
app.use('/api/opencode/by-model', cache(30));   // 30s TTL
app.use('/api/opencode/predict', cache(300));   // 5min TTL
app.use('/api/opencode/anomaly', cache(60));    // 60s TTL
app.use('/api/deepseek/balance', cache(15));    // 15s TTL
app.use('/api/servers', cache(10));             // 10s TTL
app.use('/api/servers/:id/metrics', cache(10)); // 10s TTL
app.use('/api/servers/:id/summary', cache(15)); // 15s TTL
app.use('/api/deepseek/history', cache(60));   // 60s TTL
app.use('/api/links', cache(60));              // 60s TTL
app.use('/api/settings', cache(30));            // 30s TTL

// Unified error handler
app.onError((err, c) => {
  const l = c.get("logger") as typeof logger | undefined;
  if (err instanceof ValidationError) {
    (l || logger).warn({ err: err.message, event: "validation_error" });
    return c.json({ error: err.message }, 400);
  }
  (l || logger).error({ err, event: "unhandled_error" }, "Unhandled error");
  return c.json({ error: "internal server error" }, 500);
});

// Health check (no auth required)
app.get("/health", (c) => c.json({ status: "ok", service: "tf-dashboard-backend" }));

// API routes
app.route("/api/servers", serversRoute);
app.route("/api/opencode", opencodeRoute);
app.route("/api/deepseek", deepseekRoute);
app.route("/api/settings", settingsRoute);
app.route("/api/links", linksRoute);
app.route("/api/alerts", alertsRoute);
app.route("/api/alert-rules", alertRulesRoute);
app.route("/api", uploadRoute);

// Audit log query
app.route("/api/audit", auditRoute);

// Report history (scheduled reports query)
app.route("/api/reports", reportsRoute);

// Frontend log ingestion (POST /api/logs)
app.route("/api", logsRoute);

// Serve built frontend in production
app.use("/*", serveStatic({ root: "../frontend/dist" }));

// ─── Cron Schedule ──────────────────────────────────────────────
const INTERVALS = {
  servers: parseInt(process.env.POLL_SERVERS_INTERVAL || "30", 10),
  opencode: parseInt(process.env.POLL_OPENCODE_INTERVAL || "60", 10),
  deepseek: parseInt(process.env.POLL_DEEPSEEK_INTERVAL || "300", 10),
};

async function seedDefaultRules(): Promise<void> {
  try {
    const rows = await db.select({ id: alertRules.id }).from(alertRules).limit(1);
    if (rows.length > 0) return;
  } catch {
    logger.warn({ event: "seed_rules_skipped" }, "alert_rules table not available, skipping seed");
    return;
  }

  const defaults = [
    {
      name: "DeepSeek 余额低（< ¥5）",
      enabled: true,
      conditions: JSON.stringify([{ field: "deepseek_balance", operator: "lt", value: 5 }]),
      matchMode: "all",
      notificationChannels: JSON.stringify([]),
      cooldownMinutes: 360,
      severity: "warning",
    },
    {
      name: "DeepSeek 余额严重不足（< ¥1）",
      enabled: true,
      conditions: JSON.stringify([{ field: "deepseek_balance", operator: "lt", value: 1 }]),
      matchMode: "all",
      notificationChannels: JSON.stringify([]),
      cooldownMinutes: 360,
      severity: "critical",
    },
    {
      name: "服务器离线",
      enabled: true,
      conditions: JSON.stringify([{ field: "server_offline", operator: "true" }]),
      matchMode: "all",
      notificationChannels: JSON.stringify([]),
      cooldownMinutes: 30,
      severity: "warning",
    },
    {
      name: "OpenCode 采集失败",
      enabled: true,
      conditions: JSON.stringify([{ field: "opencode_etl_error", operator: "true" }]),
      matchMode: "all",
      notificationChannels: JSON.stringify([]),
      cooldownMinutes: 60,
      severity: "warning",
    },
  ];

  try {
    await db.insert(alertRules).values(defaults as any[]);
    logger.info({ count: defaults.length, event: "seed_rules_created" }, `已创建 ${defaults.length} 条默认告警规则`);
  } catch (err) {
    logger.warn({ err, event: "seed_rules_failed" }, "创建默认告警规则失败（可能已存在）");
  }
}

// Tracked intervals and cron jobs for graceful shutdown
const pollerIntervals: ReturnType<typeof setInterval>[] = [];
const cronJobs: { stop: () => void }[] = [];

function startPollers(): void {
  createPoller('servers');
  createPoller('opencode');
  createPoller('deepseek');

  setTimeout(() => { pollAllServers(); }, 1000);
  setTimeout(() => { pollOpenCodeUsage(); }, 2000);
  setTimeout(() => { pollDeepSeekBalance(); }, 3000);

  pollerIntervals.push(setInterval(pollAllServers, INTERVALS.servers * 1000));
  pollerIntervals.push(setInterval(pollOpenCodeUsage, INTERVALS.opencode * 1000));
  pollerIntervals.push(setInterval(pollDeepSeekBalance, INTERVALS.deepseek * 1000));

  logger.info({ event: "cron_start", intervals: INTERVALS }, "定时任务已启动");
}

// ─── Start ──────────────────────────────────────────────────────
const port = parseInt(process.env.API_PORT || "3000", 10);
const host = process.env.API_HOST || "0.0.0.0";

logger.info({ event: "server_start", port, host }, "后端服务启动");

// Wire alert engine to event bus (must happen before pollers start)
subscribe((event) => { evaluateEvent(event).catch((err) => logger.error({ err, event: 'alert_engine_error' }, 'Alert engine failed')); });

// Cache invalidation: when pollers update data, bust related cache entries
subscribe((event) => {
  switch (event.type) {
    case 'deepseek_balance':
      invalidateCache('/api/deepseek');
      break;
    case 'server_metrics':
    case 'server_offline':
      invalidateCache('/api/servers');
      break;
    case 'opencode_usage_updated':
      invalidateCache('/api/opencode');
      break;
  }
});

// Seed default alert rules (fire-and-forget, first run only)
seedDefaultRules();

startPollers();

// Start the scheduled report scheduler (reads report_schedule setting)
startReportScheduler();
cronJobs.push(...reportCronJobs);

// Data retention cleanup: run daily at 3am Asia/Shanghai
const { Cron } = await import('croner');
const cleanupCron = new Cron('0 3 * * *', { timezone: 'Asia/Shanghai' }, () => {
  cleanupOldData();
});
cronJobs.push(cleanupCron);
logger.info({ event: 'cleanup_scheduled', schedule: '0 3 * * *' }, '数据清理任务已调度 (每天 03:00 Asia/Shanghai)');

// Monthly budget check: run every hour, emit event for alert engine
const budgetCheckCron = new Cron('0 * * * *', async () => {
  try {
    // Read budget setting
    const [budgetRow] = await db.select().from(settingsTable).where(eq(settingsTable.key, 'monthly_budget')).limit(1);
    const budget = parseFloat(budgetRow?.value || '0');
    if (budget <= 0) return; // No budget configured

    // Sum current month's OpenCode cost
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [costRow] = await db.select({
      totalCost: sql<string>`COALESCE(SUM(cost::numeric), 0)`,
    }).from(opencodeUsage)
      .where(sql`bucket_start >= ${monthStart.toISOString()}`);
    const currentCost = parseFloat(costRow?.totalCost || '0');
    const usagePercent = budget > 0 ? Math.round((currentCost / budget) * 10000) / 100 : 0;

    emit({ type: 'monthly_budget_check', currentCost, budget, usagePercent });
  } catch (err) {
    logger.warn({ err, event: 'budget_check_failed' }, '月度预算检查失败');
  }
});
cronJobs.push(budgetCheckCron);
logger.info({ event: 'budget_check_scheduled' }, '月度预算检查已调度 (每小时)');

// ─── Graceful Shutdown ──────────────────────────────────────────
function shutdown(signal: string) {
  logger.info({ event: "shutdown", signal }, `收到 ${signal} 信号, 开始优雅关闭`);

  // Clear poller intervals
  pollerIntervals.forEach(clearInterval);

  // Stop cron jobs
  cronJobs.forEach((job) => job.stop());

  // Stop rate limiter cleanup interval
  clearRateLimitCleanup();
  // Stop cache cleanup interval
  clearCacheCleanup();

  // Close database connection
  client.end().catch((err: unknown) => {
    logger.error({ err, event: "shutdown_db_error" }, "关闭数据库连接失败");
  });

  // Flush logs and exit
  setTimeout(() => {
    logger.info({ event: "shutdown_complete" }, "服务已关闭");
    process.exit(0);
  }, 2000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export default {
  port,
  host,
  fetch: app.fetch,
};
