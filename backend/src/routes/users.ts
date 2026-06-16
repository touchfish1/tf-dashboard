import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { IdParam, parseParam, parseJson } from "../lib/validation";
import { hashPassword } from "../lib/auth";
import { writeAuditLog } from "../lib/audit";
import { requireAdmin } from "../middleware/auth";

const router = new Hono();

// ─── Schemas ──────────────────────────────────────────────────────

const CreateUserBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1),
  role: z.enum(["admin", "viewer"]),
});

const UpdateUserBody = z.object({
  displayName: z.string().min(1).optional(),
  role: z.enum(["admin", "viewer"]).optional(),
  isActive: z.boolean().optional(),
});

// ─── GET /api/users — List all users ──────────────────────────────

router.get("/", requireAdmin, async (c) => {
  const all = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
      lastLogin: users.lastLogin,
    })
    .from(users)
    .orderBy(users.id);

  return c.json(all);
});

// ─── POST /api/users — Create a new user ─────────────────────────

router.post("/", requireAdmin, async (c) => {
  const body = await parseJson(c, CreateUserBody);

  // Check for duplicate email
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, body.email))
    .limit(1);

  if (existing) {
    return c.json({ error: "email already exists" }, 409);
  }

  const passwordHash = await hashPassword(body.password);

  const [created] = await db
    .insert(users)
    .values({
      email: body.email,
      passwordHash,
      displayName: body.displayName,
      role: body.role,
    })
    .returning();

  writeAuditLog(
    {
      type: "operation",
      action: "user.create",
      resource: "users",
      resourceId: String(created.id),
      detail: { email: body.email, role: body.role },
    },
    c,
  );

  return c.json(
    {
      id: created.id,
      email: created.email,
      displayName: created.displayName,
      role: created.role,
      isActive: created.isActive,
      createdAt: created.createdAt,
      lastLogin: created.lastLogin,
    },
    201,
  );
});

// ─── PATCH /api/users/:id — Update user fields ───────────────────

router.patch("/:id", requireAdmin, async (c) => {
  const id = parseParam(c, "id", IdParam) as number;
  const body = await parseJson(c, UpdateUserBody);

  const [updated] = await db
    .update(users)
    .set(body)
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
      lastLogin: users.lastLogin,
    });

  if (!updated) {
    return c.json({ error: "user not found" }, 404);
  }

  writeAuditLog(
    {
      type: "operation",
      action: "user.update",
      resource: "users",
      resourceId: String(id),
      detail: { changes: Object.keys(body) },
    },
    c,
  );

  return c.json(updated);
});

// ─── DELETE /api/users/:id — Delete a user (prevent self-delete) ─

router.delete("/:id", requireAdmin, async (c) => {
  const id = parseParam(c, "id", IdParam) as number;

  const authUser = c.get("user") as { userId: number } | undefined;

  // Prevent deleting self
  if (authUser?.userId === id) {
    return c.json({ error: "cannot delete yourself" }, 403);
  }

  const [deleted] = await db
    .delete(users)
    .where(eq(users.id, id))
    .returning({ id: users.id, email: users.email });

  if (!deleted) {
    return c.json({ error: "user not found" }, 404);
  }

  writeAuditLog(
    {
      type: "operation",
      action: "user.delete",
      resource: "users",
      resourceId: String(id),
      detail: { email: deleted.email },
    },
    c,
  );

  return c.json({ ok: true });
});

export default router;
