import { Hono } from "hono";
import { db } from "../db";
import { alertRules } from "../db/schema";
import { eq } from "drizzle-orm";
import {
  IdParam, parseParam, parseJson,
  CreateAlertRuleBody, UpdateAlertRuleBody,
} from "../lib/validation";
import { writeAuditLog } from "../lib/audit";
import { requireAdmin } from "../middleware/auth";

const router = new Hono();

// List all alert rules
router.get("/", async (c) => {
  const rows = await db.select().from(alertRules);
  return c.json(rows);
});

// Get single rule
router.get("/:id", async (c) => {
  const id = parseParam(c, "id", IdParam) as number;
  const [rule] = await db.select().from(alertRules).where(eq(alertRules.id, id));
  if (!rule) return c.json({ error: "not found" }, 404);
  return c.json(rule);
});

// Create alert rule
router.post("/", requireAdmin, async (c) => {
  const body = await parseJson(c, CreateAlertRuleBody);
  const [created] = await db.insert(alertRules).values({
    name: body.name,
    enabled: body.enabled,
    conditions: body.conditions as unknown as string[],
    matchMode: body.matchMode,
    notificationChannels: body.notificationChannels as unknown as string[],
    cooldownMinutes: body.cooldownMinutes,
    severity: body.severity,
  }).returning();
  writeAuditLog({ type: "operation", action: "alert_rule.create", resource: "alert_rules", resourceId: String(created.id), detail: { name: body.name } }, c);
  return c.json(created, 201);
});

// Update alert rule
router.put("/:id", requireAdmin, async (c) => {
  const id = parseParam(c, "id", IdParam) as number;
  const body = await parseJson(c, UpdateAlertRuleBody);
  const [updated] = await db.update(alertRules).set(body).where(eq(alertRules.id, id)).returning();
  if (!updated) return c.json({ error: "not found" }, 404);
  writeAuditLog({ type: "operation", action: "alert_rule.update", resource: "alert_rules", resourceId: String(id), detail: { name: updated.name, changes: Object.keys(body) } }, c);
  return c.json(updated);
});

// Delete alert rule
router.delete("/:id", requireAdmin, async (c) => {
  const id = parseParam(c, "id", IdParam) as number;
  const [deleted] = await db.delete(alertRules).where(eq(alertRules.id, id)).returning();
  if (!deleted) return c.json({ error: "not found" }, 404);
  writeAuditLog({ type: "operation", action: "alert_rule.delete", resource: "alert_rules", resourceId: String(id) }, c);
  return c.json({ ok: true });
});

export default router;
