import { Hono } from "hono";
import { db } from "../db";
import { servers, serverMetrics } from "../db/schema";
import { eq, desc, sql } from "drizzle-orm";
import {
  IdParam, DaysQuery, LimitQuery,
  CreateServerBody, UpdateServerBody,
  parseParam, parseJson,
} from "../lib/validation";
import { writeAuditLog } from "../lib/audit";

const router = new Hono();

router.get("/", async (c) => {
  const all = await db.select().from(servers);
  return c.json(all);
});

router.get("/:id", async (c) => {
  const id = parseParam(c, "id", IdParam) as number;
  const [server] = await db.select().from(servers).where(eq(servers.id, id));
  if (!server) return c.json({ error: "not found" }, 404);
  return c.json(server);
});

router.post("/", async (c) => {
  const body = await parseJson(c, CreateServerBody);
  const [created] = await db.insert(servers).values({
    name: body.name,
    metricsUrl: body.metricsUrl,
    labels: body.labels || [],
  }).returning();
  writeAuditLog({ type: "operation", action: "server.create", resource: "servers", resourceId: String(created.id), detail: { name: body.name } }, c);
  return c.json(created, 201);
});

router.patch("/:id", async (c) => {
  const id = parseParam(c, "id", IdParam) as number;
  const body = await parseJson(c, UpdateServerBody);
  const [updated] = await db.update(servers).set(body).where(eq(servers.id, id)).returning();
  if (!updated) return c.json({ error: "not found" }, 404);
  writeAuditLog({ type: "operation", action: "server.update", resource: "servers", resourceId: String(id), detail: { name: updated.name, changes: Object.keys(body) } }, c);
  return c.json(updated);
});

router.delete("/:id", async (c) => {
  const id = parseParam(c, "id", IdParam) as number;
  await db.delete(servers).where(eq(servers.id, id));
  writeAuditLog({ type: "operation", action: "server.delete", resource: "servers", resourceId: String(id) }, c);
  return c.json({ ok: true });
});

router.get("/:id/metrics", async (c) => {
  const id = parseParam(c, "id", IdParam) as number;
  const limit = Math.min(parseInt(c.req.query("limit") || "100", 10), 1000);
  const rows = await db.select()
    .from(serverMetrics)
    .where(eq(serverMetrics.serverId, id))
    .orderBy(desc(serverMetrics.collectedAt))
    .limit(limit);
  return c.json(rows);
});

router.get("/:id/summary", async (c) => {
  const id = parseParam(c, "id", IdParam) as number;
  const days = parseInt(c.req.query("days") || "1", 10);
  const [row] = await db.select({
    avgCpu: sql<string>`ROUND(AVG(cpu_percent::numeric),1)`,
    maxCpu: sql<string>`ROUND(MAX(cpu_percent::numeric),1)`,
    avgMem: sql<string>`ROUND(AVG(memory_percent::numeric),1)`,
    maxMem: sql<string>`ROUND(MAX(memory_percent::numeric),1)`,
    latestCpu: sql<string>`ROUND((SELECT cpu_percent::numeric FROM server_metrics WHERE server_id=${id} ORDER BY collected_at DESC LIMIT 1),1)`,
    latestMem: sql<string>`ROUND((SELECT memory_percent::numeric FROM server_metrics WHERE server_id=${id} ORDER BY collected_at DESC LIMIT 1),1)`,
    latestDisk: sql<string>`ROUND((SELECT disk_used_gb::numeric FROM server_metrics WHERE server_id=${id} ORDER BY collected_at DESC LIMIT 1),1)`,
    totalDisk: sql<string>`ROUND((SELECT disk_total_gb::numeric FROM server_metrics WHERE server_id=${id} ORDER BY collected_at DESC LIMIT 1),1)`,
    uptime: sql<number>`(SELECT uptime_seconds FROM server_metrics WHERE server_id=${id} ORDER BY collected_at DESC LIMIT 1)`,
  })
    .from(serverMetrics)
    .where(sql`server_id = ${id} AND collected_at >= NOW() - INTERVAL '1 day' * ${days}`);
  return c.json(row);
});

export default router;
