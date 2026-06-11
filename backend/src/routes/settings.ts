import { Hono } from "hono";
import { db } from "../db";
import { settings } from "../db/schema";
import { eq } from "drizzle-orm";
import { SettingValue, SettingKey, parseJson } from "../lib/validation";

const router = new Hono();

router.get("/", async (c) => {
  const rows = await db.select().from(settings);
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return c.json(map);
});

router.get("/:key", async (c) => {
  const key = c.req.param("key");
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  if (!row) return c.json({ value: null });
  return c.json({ value: row.value });
});

router.put("/:key", async (c) => {
  const key = c.req.param("key");
  const body = await parseJson(c, SettingValue);
  await db.insert(settings).values({ key, value: body.value })
    .onConflictDoUpdate({ target: settings.key, set: { value: body.value, updatedAt: new Date() } });
  return c.json({ ok: true, key, value: body.value });
});

router.delete("/:key", async (c) => {
  const key = c.req.param("key");
  await db.delete(settings).where(eq(settings.key, key));
  return c.json({ ok: true });
});

export default router;
