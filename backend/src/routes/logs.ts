import { Hono } from "hono";
import { logger } from "../lib/logger";

const router = new Hono();

interface LogEntry {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  data?: Record<string, unknown>;
  source?: string;
}

router.post("/logs", async (c) => {
  const body = await c.req.json<LogEntry | { batch: LogEntry[] } | LogEntry[]>().catch(() => null);
  if (!body) return c.json({ error: "invalid log entry" }, 400);

  const entries: LogEntry[] = Array.isArray(body)
    ? body
    : 'batch' in body
      ? body.batch
      : [body as LogEntry];

  if (entries.length === 0) return c.json({ error: "empty batch" }, 400);

  for (const entry of entries) {
    if (!entry.message) continue;
    const source = entry.source || "frontend";
    const logData = {
      event: "client_log",
      source,
      clientData: entry.data || {},
    };

    switch (entry.level) {
      case "error": logger.error(logData, `[${source}] ${entry.message}`); break;
      case "warn":  logger.warn(logData, `[${source}] ${entry.message}`); break;
      case "debug": logger.debug(logData, `[${source}] ${entry.message}`); break;
      default:      logger.info(logData, `[${source}] ${entry.message}`); break;
    }
  }

  return c.json({ ok: true, count: entries.length });
});

export default router;
