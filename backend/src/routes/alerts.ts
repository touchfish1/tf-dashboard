import { Hono } from "hono";
import { db } from "../db";
import { alerts } from "../db/schema";
import { eq, desc, sql } from "drizzle-orm";

const router = new Hono();

// Get active (unacknowledged) alerts, newest first
router.get("/", async (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 200);
  const rows = await db.select()
    .from(alerts)
    .orderBy(desc(alerts.createdAt))
    .limit(limit);
  return c.json(rows);
});

// Get unacknowledged count
router.get("/unread", async (c) => {
  const [row] = await db.select({
    count: sql<number>`COUNT(*)`,
  })
    .from(alerts)
    .where(eq(alerts.acknowledged, false));
  return c.json({ count: row?.count ?? 0 });
});

// Acknowledge a single alert
router.post("/:id/ack", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "invalid id" }, 400);
  await db.update(alerts).set({ acknowledged: true }).where(eq(alerts.id, id));
  return c.json({ ok: true });
});

// Acknowledge all alerts of a type
router.post("/ack-all", async (c) => {
  const { type } = await c.req.json<{ type?: string }>().catch(() => ({}));
  const cond = type ? eq(alerts.type, type) : sql`true`;
  await db.update(alerts).set({ acknowledged: true }).where(cond);
  return c.json({ ok: true });
});

export default router;
