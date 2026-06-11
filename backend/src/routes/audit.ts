import { Hono } from "hono";
import { db } from "../db";
import { auditLog } from "../db/schema";
import { desc, and, gte, like, eq, sql } from "drizzle-orm";

const router = new Hono();

router.get("/", async (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 500);
  const offset = Math.max(parseInt(c.req.query("offset") || "0", 10), 0);
  const actionFilter = c.req.query("action") || "";
  const typeFilter = c.req.query("type") || "";
  const days = Math.min(parseInt(c.req.query("days") || "30", 10), 365);

  const conditions: ReturnType<typeof gte>[] = [
    gte(auditLog.timestamp, sql`NOW() - INTERVAL '1 day' * ${days}`),
  ];
  if (actionFilter) conditions.push(like(auditLog.action, `%${actionFilter}%`) as any);
  if (typeFilter) conditions.push(eq(auditLog.type, typeFilter) as any);

  const rows = await db.select()
    .from(auditLog)
    .where(and(...conditions))
    .orderBy(desc(auditLog.timestamp))
    .limit(limit)
    .offset(offset);

  return c.json(rows);
});

export default router;
