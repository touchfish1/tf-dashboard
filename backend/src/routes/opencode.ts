import { Hono } from "hono";
import { db } from "../db";
import { opencodeUsage } from "../db/schema";
import { desc, sql } from "drizzle-orm";

const router = new Hono();

// Get aggregated usage summary
router.get("/summary", async (c) => {
  const [row] = await db.select({
    totalCost: sql<string>`COALESCE(SUM(cost::numeric),0)`,
    totalInput: sql<number>`COALESCE(SUM(tokens_input),0)`,
    totalOutput: sql<number>`COALESCE(SUM(tokens_output),0)`,
    totalSessions: sql<number>`COALESCE(SUM(session_count),0)`,
  }).from(opencodeUsage);
  return c.json(row);
});

// Get usage by time range
router.get("/usage", async (c) => {
  const days = parseInt(c.req.query("days") || "7", 10);
  const limit = Math.min(parseInt(c.req.query("limit") || "500", 10), 2000);
  const rows = await db.select()
    .from(opencodeUsage)
    .where(sql`bucket_start >= NOW() - INTERVAL '1 day' * ${days}`)
    .orderBy(desc(opencodeUsage.bucketStart))
    .limit(limit);
  return c.json(rows);
});

// Get cost by model
router.get("/by-model", async (c) => {
  const days = parseInt(c.req.query("days") || "7", 10);
  const rows = await db.select({
    model: opencodeUsage.model,
    cost: sql<string>`COALESCE(SUM(cost::numeric),0)`,
    tokensInput: sql<number>`COALESCE(SUM(tokens_input),0)`,
    tokensOutput: sql<number>`COALESCE(SUM(tokens_output),0)`,
  })
    .from(opencodeUsage)
    .where(sql`bucket_start >= NOW() - INTERVAL '1 day' * ${days}`)
    .groupBy(opencodeUsage.model)
    .orderBy(sql`COALESCE(SUM(cost::numeric),0) DESC`);
  return c.json(rows);
});

export default router;
