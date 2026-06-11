import { Hono } from "hono";
import { db } from "../db";
import { settings } from "../db/schema";
import { eq } from "drizzle-orm";

const router = new Hono();

// Get all settings
router.get("/", async (c) => {
  const rows = await db.select().from(settings);
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return c.json(map);
});

// Get single setting
router.get("/:key", async (c) => {
  const key = c.req.param("key");
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  if (!row) return c.json({ value: null });
  return c.json({ value: row.value });
});

// Set a setting
router.put("/:key", async (c) => {
  const key = c.req.param("key");
  const { value } = await c.req.json<{ value: string }>();
  await db.insert(settings).values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
  return c.json({ ok: true, key, value });
});

// Delete a setting
router.delete("/:key", async (c) => {
  const key = c.req.param("key");
  await db.delete(settings).where(eq(settings.key, key));
  return c.json({ ok: true });
});

export default router;
