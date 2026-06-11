import { Hono } from "hono";
import { getAuditLogs } from "../lib/audit";

const router = new Hono();

router.get("/", async (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") || "100", 10), 500);
  const offset = Math.max(parseInt(c.req.query("offset") || "0", 10), 0);
  const rows = await getAuditLogs(limit, offset);
  return c.json(rows);
});

export default router;
