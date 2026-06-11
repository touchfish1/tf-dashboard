/**
 * tf-dashboard Backend
 *
 * Hono API server + Cron-based data collectors.
 * Default port: 3000
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/serve-static";

import serversRoute from "./routes/servers";
import opencodeRoute from "./routes/opencode";
import deepseekRoute from "./routes/deepseek";
import settingsRoute from "./routes/settings";
import linksRoute from "./routes/links";
import { pollAllServers } from "./pollers/servers";
import { pollOpenCodeUsage } from "./pollers/opencode";
import { pollDeepSeekBalance } from "./pollers/deepseek";

const app = new Hono();

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
  // Skip auth if no key configured (local dev)
  if (!API_KEY) return next();
  const provided = c.req.header("x-api-key") || c.req.query("api_key");
  if (provided !== API_KEY) return c.json({ error: "unauthorized" }, 401);
  return next();
});

// Health check (no auth required)
app.get("/health", (c) => c.json({ status: "ok", service: "tf-dashboard-backend" }));

// API routes
app.route("/api/servers", serversRoute);
app.route("/api/opencode", opencodeRoute);
app.route("/api/deepseek", deepseekRoute);
app.route("/api/settings", settingsRoute);
app.route("/api/links", linksRoute);

// Serve built frontend in production
app.use("/*", serveStatic({ root: "../frontend/dist" }));

// ─── Cron Schedule ──────────────────────────────────────────────
const INTERVALS = {
  servers: parseInt(process.env.POLL_SERVERS_INTERVAL || "30", 10),
  opencode: parseInt(process.env.POLL_OPENCODE_INTERVAL || "60", 10),
  deepseek: parseInt(process.env.POLL_DEEPSEEK_INTERVAL || "300", 10),
};

function startPollers(): void {
  // Initial run after startup
  setTimeout(() => { pollAllServers(); }, 1000);
  setTimeout(() => { pollOpenCodeUsage(); }, 2000);
  setTimeout(() => { pollDeepSeekBalance(); }, 3000);

  // Periodic runs
  setInterval(pollAllServers, INTERVALS.servers * 1000);
  setInterval(pollOpenCodeUsage, INTERVALS.opencode * 1000);
  setInterval(pollDeepSeekBalance, INTERVALS.deepseek * 1000);

  console.log(`[cron] server metrics: every ${INTERVALS.servers}s`);
  console.log(`[cron] opencode ETL:   every ${INTERVALS.opencode}s`);
  console.log(`[cron] deepseek poll:  every ${INTERVALS.deepseek}s`);
}

// ─── Start ──────────────────────────────────────────────────────
const port = parseInt(process.env.API_PORT || "3000", 10);
const host = process.env.API_HOST || "0.0.0.0";

console.log(`🖥️  tf-dashboard backend starting...`);
console.log(`   API: http://${host}:${port}`);
console.log(`   DB:  postgresql://zhangyuan@100.125.148.23:5432/tf_dashboard`);

startPollers();

export default {
  port,
  host,
  fetch: app.fetch,
};
