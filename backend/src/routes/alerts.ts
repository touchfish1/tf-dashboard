import { Hono } from "hono";
import { db } from "../db";
import { alerts } from "../db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { sendToChannel, type NotificationChannel } from "../lib/notifications";

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

// Test a notification channel (uses proper platform-specific formatting)
router.post("/test", async (c) => {
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
  const url = typeof body?.url === 'string' ? body.url : '';
  const type = body?.type as NotificationChannel['type'] | undefined;
  const name = typeof body?.name === 'string' ? body.name : '';
  if (!url || !type) return c.json({ error: "url and type are required" }, 400);
  try {
    const channel: NotificationChannel = { url, type, name: name || "test" };
    await sendToChannel(channel, {
      title: "测试通知",
      message: "这是一条来自 tf-dashboard 的测试通知，如果您看到这条消息，说明通知渠道配置正确。",
      severity: "info",
      type: "test",
      timestamp: new Date().toISOString(),
    });
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
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
  const { type } = await c.req.json<{ type?: string }>().catch(() => ({ type: undefined as string | undefined }));
  const cond = type ? eq(alerts.type, type) : sql`true`;
  await db.update(alerts).set({ acknowledged: true }).where(cond);
  return c.json({ ok: true });
});

export default router;
