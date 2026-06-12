import { Hono } from "hono";
import { db } from "../db";
import { settings } from "../db/schema";
import { eq } from "drizzle-orm";
import { SettingValue, SettingKey, parseJson } from "../lib/validation";
import { writeAuditLog } from "../lib/audit";
import { requireAdmin } from "../middleware/auth";

const router = new Hono();

const SENSITIVE_KEYS = ["deepseek_api_key", "opencode_api_key"];

function maskValue(key: string, value: string): string {
  return SENSITIVE_KEYS.includes(key) && value.length > 6
    ? value.slice(0, 4) + "****" + value.slice(-2)
    : value;
}

router.get("/", async (c) => {
  const rows = await db.select().from(settings);
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = maskValue(row.key, row.value);
  }
  return c.json(map);
});

router.get("/:key", async (c) => {
  const key = c.req.param("key") || "";
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  if (!row) return c.json({ value: null });
  return c.json({ value: row.value });
});

router.put("/:key", requireAdmin, async (c) => {
  const key = c.req.param("key") || "";
  const body = await parseJson(c, SettingValue);
  await db.insert(settings).values({ key, value: body.value })
    .onConflictDoUpdate({ target: settings.key, set: { value: body.value, updatedAt: new Date() } });
  writeAuditLog({ type: "operation", action: "settings.update", resource: "settings", resourceId: key, detail: { key } }, c);
  return c.json({ ok: true, key, value: body.value });
});

router.delete("/:key", requireAdmin, async (c) => {
  const key = c.req.param("key") || "";
  await db.delete(settings).where(eq(settings.key, key));
  return c.json({ ok: true });
});

export default router;
