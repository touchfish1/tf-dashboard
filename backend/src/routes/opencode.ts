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
    const search = c.req.query("search") || "";
    const rows = await db.select()
      .from(opencodeUsage)
      .where(
        search
          ? sql`bucket_start >= NOW() - INTERVAL '1 day' * ${days} AND (model ILIKE ${`%${search}%`} OR agent ILIKE ${`%${search}%`})`
          : sql`bucket_start >= NOW() - INTERVAL '1 day' * ${days}`
      )
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

// ─── Prediction helper: simple linear regression ────────────────

function linreg(values: number[]) {
  const n = values.length;
  if (n < 3) return { slope: 0, intercept: values[0] || 0, next: (steps: number) => values[0] || 0 };

  const indices = Array.from({ length: n }, (_, i) => i);
  const sumX = indices.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = indices.reduce((a, _, i) => a + i * values[i], 0);
  const sumX2 = indices.reduce((a, _, i) => a + i * i, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return {
    slope,
    intercept,
    next: (steps: number) => Math.max(0, intercept + slope * (n - 1 + steps)),
  };
}

// Get usage prediction for next N days
router.get("/predict", async (c) => {
  const days = Math.min(parseInt(c.req.query("days") || "30", 10), 90);
  const predictDays = Math.min(parseInt(c.req.query("predict") || "7", 10), 30);

  const rows = await db.select({
    bucketStart: sql<string>`DATE(bucket_start)`,
    tokensInput: sql<number>`COALESCE(SUM(tokens_input),0)`,
    tokensOutput: sql<number>`COALESCE(SUM(tokens_output),0)`,
    cost: sql<string>`COALESCE(SUM(cost::numeric),0)`,
  })
    .from(opencodeUsage)
    .where(sql`bucket_start >= NOW() - INTERVAL '1 day' * ${days}`)
    .groupBy(sql`DATE(bucket_start)`)
    .orderBy(sql`DATE(bucket_start) ASC`);

  const actual: { date: string; tokensInput: number; tokensOutput: number; cost: number }[] = rows.map(r => ({
    date: r.bucketStart,
    tokensInput: r.tokensInput,
    tokensOutput: r.tokensOutput,
    cost: parseFloat(r.cost),
  }));

  const inReg = linreg(actual.map((r) => r.tokensInput));
  const outReg = linreg(actual.map((r) => r.tokensOutput));
  const costReg = linreg(actual.map((r) => r.cost));

  const lastDate = actual.length > 0 ? new Date(actual[actual.length - 1].date) : new Date();
  const predicted = Array.from({ length: predictDays }, (_, i) => {
    const d = new Date(lastDate);
    d.setDate(d.getDate() + i + 1);
    return {
      date: d.toISOString().slice(0, 10),
      tokensInput: Math.round(inReg.next(i + 1)),
      tokensOutput: Math.round(outReg.next(i + 1)),
      cost: parseFloat(costReg.next(i + 1).toFixed(4)),
    };
  });

  return c.json({
    actual,
    predicted,
    trend: {
      inputSlope: Math.round(inReg.slope),
      outputSlope: Math.round(outReg.slope),
      costSlope: parseFloat(costReg.slope.toFixed(4)),
      weeklyProjected: {
        tokensInput: Math.round(inReg.next(7) * 7),
        tokensOutput: Math.round(outReg.next(7) * 7),
        cost: parseFloat((costReg.next(7) * 7).toFixed(2)),
      },
    },
  });
});

export default router;
