import { Hono } from "hono";
import { db } from "../db";
import { deepseekBalance } from "../db/schema";
import { desc, sql } from "drizzle-orm";

const router = new Hono();

// Get latest balance
router.get("/balance", async (c) => {
  const [row] = await db.select()
    .from(deepseekBalance)
    .orderBy(desc(deepseekBalance.recordedAt))
    .limit(1);
  return c.json(row || {});
});

// Get balance history
router.get("/history", async (c) => {
  const days = parseInt(c.req.query("days") || "30", 10);
  const rows = await db.select()
    .from(deepseekBalance)
    .where(sql`recorded_at >= NOW() - INTERVAL '1 day' * ${days}`)
    .orderBy(desc(deepseekBalance.recordedAt));
  return c.json(rows);
});

export default router;
