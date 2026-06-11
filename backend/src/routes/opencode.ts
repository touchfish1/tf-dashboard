import { Hono } from "hono";
import { db } from "../db";
import { opencodeUsage } from "../db/schema";
import { sql } from "drizzle-orm";
import { OpenCodeUsageQuery, parseQuery } from "../lib/validation";

const router = new Hono();

router.get("/summary", async (c) => {
  const [row] = await db.select({
    totalCost: sql<string>`COALESCE(SUM(cost::numeric),0)`,
    totalInput: sql<number>`COALESCE(SUM(tokens_input),0)`,
    totalOutput: sql<number>`COALESCE(SUM(tokens_output),0)`,
    totalSessions: sql<number>`COALESCE(SUM(session_count),0)`,
  }).from(opencodeUsage);
  return c.json(row);
});

router.get("/usage", async (c) => {
  const q = parseQuery(c, OpenCodeUsageQuery);
  const days = q.days;

  if (q.raw === "true") {
    const limit = q.limit;
    const rows = await db.select()
      .from(opencodeUsage)
      .where(sql`bucket_start >= NOW() - INTERVAL '1 day' * ${days}`)
      .orderBy(sql`bucket_start DESC`)
      .limit(limit);
    return c.json(rows);
  }

  const limit = Math.min(days, 365);
  const rows = await db.select({
    bucketStart: sql<string>`DATE(bucket_start)`,
    tokensInput: sql<number>`COALESCE(SUM(tokens_input),0)`,
    tokensOutput: sql<number>`COALESCE(SUM(tokens_output),0)`,
    tokensReasoning: sql<number>`COALESCE(SUM(tokens_reasoning),0)`,
    tokensCacheRead: sql<number>`COALESCE(SUM(tokens_cache_read),0)`,
    tokensCacheWrite: sql<number>`COALESCE(SUM(tokens_cache_write),0)`,
    cost: sql<string>`COALESCE(SUM(cost::numeric),0)`,
    sessionCount: sql<number>`COALESCE(SUM(session_count),0)`,
  })
    .from(opencodeUsage)
    .where(sql`bucket_start >= NOW() - INTERVAL '1 day' * ${days}`)
    .groupBy(sql`DATE(bucket_start)`)
    .orderBy(sql`DATE(bucket_start) DESC`)
    .limit(limit);
  return c.json(rows);
});

router.get("/by-model", async (c) => {
  const q = parseQuery(c, OpenCodeUsageQuery);
  const rows = await db.select({
    model: opencodeUsage.model,
    cost: sql<string>`COALESCE(SUM(cost::numeric),0)`,
    tokensInput: sql<number>`COALESCE(SUM(tokens_input),0)`,
    tokensOutput: sql<number>`COALESCE(SUM(tokens_output),0)`,
  })
    .from(opencodeUsage)
    .where(sql`bucket_start >= NOW() - INTERVAL '1 day' * ${q.days}`)
    .groupBy(opencodeUsage.model)
    .orderBy(sql`COALESCE(SUM(cost::numeric),0) DESC`);
  return c.json(rows);
});

export default router;
