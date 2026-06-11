import { Hono } from "hono";
import { logger } from "../lib/logger";

const router = new Hono();

interface LogEntry {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  data?: Record<string, unknown>;
  source?: string;
}

// Accept frontend/browser logs via POST /logs
router.post("/logs", async (c) => {
  const body = await c.req.json<LogEntry>().catch(() => null);
  if (!body || !body.message) {
    return c.json({ error: "invalid log entry" }, 400);
  }

  const source = body.source || "frontend";
  const entry = {
    event: "client_log",
    source,
    clientData: body.data || {},
  };

  switch (body.level) {
    case "error":
      logger.error(entry, `[${source}] ${body.message}`);
      break;
    case "warn":
      logger.warn(entry, `[${source}] ${body.message}`);
      break;
    case "debug":
      logger.debug(entry, `[${source}] ${body.message}`);
      break;
    default:
      logger.info(entry, `[${source}] ${body.message}`);
  }

  return c.json({ ok: true });
});

export default router;
