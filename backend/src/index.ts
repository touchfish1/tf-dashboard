/**
 * tf-dashboard Backend
 *
 * Hono API server + Cron-based data collectors.
 * Default port: 3000
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/serve-static";
import { ValidationError } from "./lib/validation";
import { logger, requestLogger } from "./lib/logger";

import serversRoute from "./routes/servers";
import opencodeRoute from "./routes/opencode";
import deepseekRoute from "./routes/deepseek";
import settingsRoute from "./routes/settings";
import linksRoute from "./routes/links";
import alertsRoute from "./routes/alerts";
import uploadRoute from "./routes/upload";
import logsRoute from "./routes/logs";
import auditRoute from "./routes/audit";
import { pollAllServers } from "./pollers/servers";
import { pollOpenCodeUsage } from "./pollers/opencode";
import { pollDeepSeekBalance } from "./pollers/deepseek";

const app = new Hono();

// Request logging middleware (runs before all routes)
app.use("*", requestLogger);

// CORS: only allow localhost/dev origins in development
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
];
app.use("/*", cors({ origin: ALLOWED_ORIGINS, credentials: true }));

// API key auth middleware (all /api/* routes)
const API_KEY = process.env.API_KEY || "";
app.use("/api/*", async (c, next) => {
  if (!API_KEY) return next();
  const provided = c.req.header("x-api-key") || c.req.query("api_key");
  if (provided !== API_KEY) {
    const l = c.get("logger") as typeof logger | undefined;
    (l || logger).warn({ event: "auth_failed" }, "API key auth failed");
    return c.json({ error: "unauthorized" }, 401);
  }
  return next();
});

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
app.route("/api", uploadRoute);

// Audit log query
app.route("/api/audit", auditRoute);

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

function startPollers(): void {
  setTimeout(() => { pollAllServers(); }, 1000);
  setTimeout(() => { pollOpenCodeUsage(); }, 2000);
  setTimeout(() => { pollDeepSeekBalance(); }, 3000);

  setInterval(pollAllServers, INTERVALS.servers * 1000);
  setInterval(pollOpenCodeUsage, INTERVALS.opencode * 1000);
  setInterval(pollDeepSeekBalance, INTERVALS.deepseek * 1000);

  logger.info({ event: "cron_start", intervals: INTERVALS }, "定时任务已启动");
}

// ─── Start ──────────────────────────────────────────────────────
const port = parseInt(process.env.API_PORT || "3000", 10);
const host = process.env.API_HOST || "0.0.0.0";

logger.info({ event: "server_start", port, host }, "后端服务启动");

startPollers();

export default {
  port,
  host,
  fetch: app.fetch,
};
