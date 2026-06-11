import { Hono } from "hono";
import { cors } from "hono/cors";
import { collectMetrics } from "./collector";
import { logger } from "./lib/logger";

const app = new Hono();

app.use("/*", cors());

// Simple API key check
const API_KEY = process.env.OPENCODE_API_KEY || "";

function checkApiKey(c: any): boolean {
  if (!API_KEY) return true;
  const provided = c.req.query("api_key");
  if (provided !== API_KEY) {
    logger.warn({ event: "auth_failed", clientIp: c.req.header("x-forwarded-for") || "unknown" }, "API key auth failed");
    return false;
  }
  return true;
}

// Health check
app.get("/health", (c) => c.json({ status: "ok", service: "tf-dashboard-agent" }));

// System metrics
app.get("/metrics", (c) => {
  try {
    const metrics = collectMetrics();
    logger.info({ cpu: metrics.cpu.percent, memory: metrics.memory.percent, event: "metrics_collected" }, "Metrics collected");
    return c.json(metrics);
  } catch (err) {
    logger.error({ err, event: "metrics_failed" }, "Failed to collect metrics");
    return c.json({ error: "metrics collection failed", message: String(err) }, 500);
  }
});

// OpenCode sessions data (proxy to `opencode db`)
app.get("/api/opencode/sessions", async (c) => {
  if (!checkApiKey(c)) return c.json({ error: "unauthorized" }, 401);

  const days = parseInt(c.req.query("days") || "7", 10);
  const limit = parseInt(c.req.query("limit") || "500", 10);

  const which = Bun.spawnSync(["which", "opencode"]);
  if (!which.success) {
    logger.warn({ event: "cli_not_found" }, "OpenCode CLI 不可用");
    return c.json({ error: "opencode CLI not available in this environment" }, 501);
  }

  try {
    const proc = Bun.spawnSync([
      "opencode", "db",
      `SELECT id, model, agent, tokens_input, tokens_output, tokens_reasoning, tokens_cache_read, tokens_cache_write, cost, time_created FROM session WHERE time_created >= (strftime('%s','now','-${days} days'))*1000 ORDER BY time_created DESC LIMIT ${limit}`,
      "--format", "json",
    ]);

    if (!proc.success) {
      const stderr = proc.stderr?.toString() || "unknown error";
      logger.error({ event: "query_failed", detail: stderr }, "OpenCode query failed");
      return c.json({ error: "query failed", detail: stderr }, 500);
    }

    const raw = proc.stdout?.toString() || "[]";
    const rows = JSON.parse(raw);

    const sessions = rows.map((row: any) => {
      let model = row.model;
      if (typeof model === "string" && model.startsWith("{")) {
        try { model = JSON.parse(model).id || model; } catch {}
      }
      return {
        model,
        agent: row.agent || "unknown",
        tokens_input: row.tokens_input || 0,
        tokens_output: row.tokens_output || 0,
        tokens_reasoning: row.tokens_reasoning || 0,
        tokens_cache_read: row.tokens_cache_read || 0,
        tokens_cache_write: row.tokens_cache_write || 0,
        cost: row.cost || 0,
        time_created: row.time_created || 0,
      };
    });

    logger.info({ sessionCount: sessions.length, days, event: "sessions_fetched" }, `Returned ${sessions.length} sessions`);
    return c.json({ sessions });
  } catch (err) {
    logger.error({ err, event: "sessions_error" }, "OpenCode endpoint error");
    return c.json({ error: String(err) }, 500);
  }
});

// Start server
const port = parseInt(process.env.METRICS_PORT || "9100", 10);
const host = process.env.METRICS_HOST || "0.0.0.0";

  logger.info({ port, host, event: "server_start" }, "Agent服务启动");

export default {
  port,
  host,
  fetch: app.fetch,
};
