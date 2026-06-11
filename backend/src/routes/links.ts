import { Hono } from "hono";
import { db } from "../db";
import { navLinks } from "../db/schema";
import { eq, asc } from "drizzle-orm";

const router = new Hono();

router.get("/", async (c) => {
  const rows = await db.select().from(navLinks).orderBy(asc(navLinks.sortOrder));
  return c.json(rows);
});

router.post("/", async (c) => {
  const body = await c.req.json<{ title: string; url: string; icon?: string; category?: string }>();
  const max = await db.select({ m: navLinks.sortOrder }).from(navLinks).orderBy(asc(navLinks.sortOrder)).limit(1);
  const nextOrder = (max?.[0]?.m ?? -1) + 1;
  const [created] = await db.insert(navLinks).values({
    title: body.title, url: body.url, icon: body.icon || "", category: body.category || "", sortOrder: nextOrder,
  }).returning();
  return c.json(created, 201);
});

router.put("/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const body = await c.req.json<{ title?: string; url?: string; icon?: string; category?: string; sortOrder?: number }>();
  const [updated] = await db.update(navLinks).set(body).where(eq(navLinks.id, id)).returning();
  if (!updated) return c.json({ error: "not found" }, 404);
  return c.json(updated);
});

router.delete("/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  await db.delete(navLinks).where(eq(navLinks.id, id));
  return c.json({ ok: true });
});

export default router;
