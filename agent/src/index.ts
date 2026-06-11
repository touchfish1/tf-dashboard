/**
 * tf-dashboard Metrics Agent
 *
 * Lightweight HTTP server exposing:
 *   GET /metrics          - system metrics (CPU, memory, disk, network)
 *   GET /api/opencode/sessions - OpenCode token usage data (via `opencode db`)
 *
 * Default port: 9100
 *
 * Environment variables:
 *   METRICS_PORT        - HTTP server port (default: 9100)
 *   METRICS_HOST        - bind address (default: 0.0.0.0)
 *   OPENCODE_API_KEY    - optional, required by external callers
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { collectMetrics } from "./collector";

const app = new Hono();

app.use("/*", cors());

// Simple API key check
const API_KEY = process.env.OPENCODE_API_KEY || "";

function checkApiKey(c: any): boolean {
  if (!API_KEY) return true;
  const provided = c.req.query("api_key");
  if (provided !== API_KEY) return false;
  return true;
}

// Health check
app.get("/health", (c) => c.json({ status: "ok", service: "tf-dashboard-agent" }));

// System metrics
app.get("/metrics", (c) => {
  try {
    const metrics = collectMetrics();
    return c.json(metrics);
  } catch (err) {
    console.error("Failed to collect metrics:", err);
    return c.json({ error: "metrics collection failed", message: String(err) }, 500);
  }
});

// OpenCode sessions data (proxy to `opencode db`)
app.get("/api/opencode/sessions", async (c) => {
  if (!checkApiKey(c)) return c.json({ error: "unauthorized" }, 401);

  const days = parseInt(c.req.query("days") || "7", 10);
  const limit = parseInt(c.req.query("limit") || "500", 10);

  try {
    const proc = Bun.spawnSync([
      "opencode", "db",
      `SELECT id, model, agent, tokens_input, tokens_output, tokens_reasoning, tokens_cache_read, tokens_cache_write, cost, time_created FROM session WHERE time_created >= (strftime('%s','now','-${days} days'))*1000 ORDER BY time_created DESC LIMIT ${limit}`,
      "--format", "json",
    ]);

    if (!proc.success) {
      const stderr = proc.stderr?.toString() || "unknown error";
      console.error("[opencode] query failed:", stderr);
      return c.json({ error: "query failed", detail: stderr }, 500);
    }

    const raw = proc.stdout?.toString() || "[]";
    const rows = JSON.parse(raw);

    // Normalise model field (JSON string -> extract .id)
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

    return c.json({ sessions });
  } catch (err) {
    console.error("[opencode] endpoint error:", err);
    return c.json({ error: String(err) }, 500);
  }
});

// Start server
const port = parseInt(process.env.METRICS_PORT || "9100", 10);
const host = process.env.METRICS_HOST || "0.0.0.0";

console.log(`📊 tf-dashboard agent starting...`);
console.log(`   System metrics: http://${host}:${port}/metrics`);
console.log(`   OpenCode usage: http://${host}:${port}/api/opencode/sessions`);
console.log(`   Health:         http://${host}:${port}/health`);

export default {
  port,
  host,
  fetch: app.fetch,
};
