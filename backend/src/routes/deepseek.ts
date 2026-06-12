import { Hono } from "hono";
import { db } from "../db";
import { deepseekBalance } from "../db/schema";
import { desc, sql } from "drizzle-orm";
import { DeepSeekHistoryQuery, parseQuery } from "../lib/validation";

const router = new Hono();

router.get("/balance", async (c) => {
  const [row] = await db.select()
    .from(deepseekBalance)
    .orderBy(desc(deepseekBalance.recordedAt))
    .limit(1);
  return c.json(row || {});
});

router.get("/history", async (c) => {
  const q = parseQuery(c, DeepSeekHistoryQuery);
  const rows = await db.select()
    .from(deepseekBalance)
    .where(sql`recorded_at >= NOW() - INTERVAL '1 day' * ${q.days}`)
    .orderBy(desc(deepseekBalance.recordedAt))
    .limit(500);
  return c.json(rows);
});

export default router;
