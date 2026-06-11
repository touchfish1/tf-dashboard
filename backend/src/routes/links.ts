import { Hono } from "hono";
import { db } from "../db";
import { navLinks } from "../db/schema";
import { eq, asc, desc } from "drizzle-orm";
import {
  IdParam, CreateLinkBody, UpdateLinkBody,
  parseParam, parseJson,
} from "../lib/validation";
import { writeAuditLog } from "../lib/audit";

const router = new Hono();

router.get("/", async (c) => {
  const rows = await db.select().from(navLinks).orderBy(asc(navLinks.sortOrder));
  return c.json(rows);
});

router.post("/", async (c) => {
  const body = await parseJson(c, CreateLinkBody);
  const max = await db.select({ m: navLinks.sortOrder }).from(navLinks).orderBy(desc(navLinks.sortOrder)).limit(1);
  const nextOrder = (max?.[0]?.m ?? -1) + 1;
  const [created] = await db.insert(navLinks).values({
    title: body.title, url: body.url, icon: body.icon || "", category: body.category || "", sortOrder: nextOrder,
  }).returning();
  writeAuditLog({ type: "operation", action: "link.create", resource: "links", resourceId: String(created.id), detail: { title: body.title, url: body.url } }, c);
  return c.json(created, 201);
});

router.put("/:id", async (c) => {
  const id = parseParam(c, "id", IdParam) as number;
  const body = await parseJson(c, UpdateLinkBody);
  const [updated] = await db.update(navLinks).set(body).where(eq(navLinks.id, id)).returning();
  if (!updated) return c.json({ error: "not found" }, 404);
  writeAuditLog({ type: "operation", action: "link.update", resource: "links", resourceId: String(id), detail: { title: updated.title } }, c);
  return c.json(updated);
});

router.delete("/:id", async (c) => {
  const id = parseParam(c, "id", IdParam) as number;
  await db.delete(navLinks).where(eq(navLinks.id, id));
  writeAuditLog({ type: "operation", action: "link.delete", resource: "links", resourceId: String(id) }, c);
  return c.json({ ok: true });
});

export default router;
