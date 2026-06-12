import { Hono } from "hono";
import { db } from "../db";
import { opencodeUsage } from "../db/schema";
import { sql } from "drizzle-orm";
import { OpenCodeUsageQuery, parseQuery } from "../lib/validation";
import { createAlert } from "../lib/alerts";

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
    tokensCacheRead: sql<number>`COALESCE(SUM(tokens_cache_read),0)`,
    tokensCacheWrite: sql<number>`COALESCE(SUM(tokens_cache_write),0)`,
    sessionCount: sql<number>`COALESCE(SUM(session_count),0)`,
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

// ─── Anomaly detection ─────────────────────────────────────────
router.get("/anomaly", async (c) => {
  // Today's cost
  const [todayRow] = await db.select({
    cost: sql<string>`COALESCE(SUM(cost::numeric),0)`,
  })
    .from(opencodeUsage)
    .where(sql`bucket_start >= CURRENT_DATE AND bucket_start < CURRENT_DATE + INTERVAL '1 day'`);

  // 7-day rolling average (excluding today)
  const avgResult = await db.execute(sql`
    SELECT COALESCE(AVG(daily_cost),0) as avg_cost FROM (
      SELECT SUM(cost::numeric) as daily_cost
      FROM opencode_usage
      WHERE bucket_start >= CURRENT_DATE - INTERVAL '8 days'
        AND bucket_start < CURRENT_DATE
      GROUP BY DATE(bucket_start)
    ) daily
  `);

  const todayCost = parseFloat(todayRow?.cost || "0");
  const avgResultRow = (avgResult as unknown as Array<{ avg_cost: string }> | undefined)?.[0];
  const avgCost = parseFloat(avgResultRow?.avg_cost || "0");
  const ratio = avgCost > 0 ? todayCost / avgCost : 0;

  // Create alert if anomaly detected
  if (ratio > 2 && avgCost > 0.01) {
    await createAlert(
      "system",
      "费用异常增长",
      `今日费用 $${todayCost.toFixed(2)}，是 7 日均值 $${avgCost.toFixed(2)} 的 ${ratio.toFixed(1)} 倍`,
      ratio > 3 ? "critical" : "warning",
      "cost_anomaly"
    );
  }

  return c.json({
    todayCost: parseFloat(todayCost.toFixed(4)),
    avgCost: parseFloat(avgCost.toFixed(4)),
    ratio: parseFloat(ratio.toFixed(2)),
    status: ratio > 2 ? "anomaly" : ratio > 1.5 ? "elevated" : "normal",
  });
});

export default router;
