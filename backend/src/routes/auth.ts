import { Hono } from "hono";
import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import { db } from "../db";
import { users, refreshTokens } from "../db/schema";
import { parseJson } from "../lib/validation";
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  generateRefreshToken,
  hashToken,
  REFRESH_TOKEN_DAYS,
} from "../lib/auth";
import { writeAuditLog } from "../lib/audit";
import { logger } from "../lib/logger";

const router = new Hono();

// ─── Schemas ──────────────────────────────────────────────────────

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const ChangePasswordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

// ─── POST /login ──────────────────────────────────────────────────

router.post("/login", async (c) => {
  const body = await parseJson(c, LoginBody);

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, body.email));

  if (!user) {
    return c.json({ error: "invalid email or password" }, 401);
  }

  if (!user.isActive) {
    return c.json({ error: "account is disabled" }, 403);
  }

  const valid = await verifyPassword(body.password, user.passwordHash);
  if (!valid) {
    return c.json({ error: "invalid email or password" }, 401);
  }

  // Update last login
  await db
    .update(users)
    .set({ lastLogin: new Date() })
    .where(eq(users.id, user.id));

  // Generate tokens
  const accessToken = await signAccessToken({
    userId: user.id,
    role: user.role,
    email: user.email,
  });

  const refreshTokenValue = generateRefreshToken();
  const tokenHash = await hashToken(refreshTokenValue);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  // Set httpOnly refresh cookie
  const isProd = process.env.NODE_ENV === "production";
  setCookie(c, "refresh_token", refreshTokenValue, {
    httpOnly: true,
    secure: isProd,
    path: "/api/auth",
    sameSite: "Lax",
    maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60,
  });

  writeAuditLog(
    {
      type: "access",
      action: "auth.login",
      resource: "auth",
      resourceId: String(user.id),
      detail: { email: user.email },
    },
    c,
  );

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    },
    accessToken,
  });
});

// ─── POST /logout ─────────────────────────────────────────────────

router.post("/logout", async (c) => {
  const token = getCookie(c, "refresh_token");
  if (token) {
    const tokenHash = await hashToken(token);
    await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
  }

  deleteCookie(c, "refresh_token", { path: "/api/auth" });

  return c.json({ ok: true });
});

// ─── POST /refresh ────────────────────────────────────────────────

router.post("/refresh", async (c) => {
  const token = getCookie(c, "refresh_token");
  if (!token) {
    return c.json({ error: "no refresh token" }, 401);
  }

  const tokenHash = await hashToken(token);

  // Look up token with user join
  const [row] = await db
    .select({
      tokenId: refreshTokens.id,
      userId: users.id,
      email: users.email,
      role: users.role,
      displayName: users.displayName,
      expiresAt: refreshTokens.expiresAt,
    })
    .from(refreshTokens)
    .innerJoin(users, eq(refreshTokens.userId, users.id))
    .where(and(eq(refreshTokens.tokenHash, tokenHash), eq(users.isActive, true)));

  if (!row) {
    return c.json({ error: "invalid refresh token" }, 401);
  }

  if (new Date() > row.expiresAt) {
    await db.delete(refreshTokens).where(eq(refreshTokens.id, row.tokenId));
    return c.json({ error: "refresh token expired" }, 401);
  }

  // Delete old token (rotation)
  await db.delete(refreshTokens).where(eq(refreshTokens.id, row.tokenId));

  // Generate new tokens
  const accessToken = await signAccessToken({
    userId: row.userId,
    role: row.role,
    email: row.email,
  });

  const newRefreshToken = generateRefreshToken();
  const newHash = await hashToken(newRefreshToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);

  await db.insert(refreshTokens).values({
    userId: row.userId,
    tokenHash: newHash,
    expiresAt,
  });

  const isProd = process.env.NODE_ENV === "production";
  setCookie(c, "refresh_token", newRefreshToken, {
    httpOnly: true,
    secure: isProd,
    path: "/api/auth",
    sameSite: "Lax",
    maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60,
  });

  return c.json({ accessToken });
});

// ─── GET /me ──────────────────────────────────────────────────────

router.get("/me", async (c) => {
  const authUser = c.get("user") as { userId: number; role: string; email: string } | undefined;
  if (!authUser) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const [user] = await db
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
    .where(eq(users.id, authUser.userId));

  if (!user) {
    return c.json({ error: "user not found" }, 404);
  }

  return c.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  });
});

// ─── PUT /change-password ─────────────────────────────────────────

router.put("/change-password", async (c) => {
  const authUser = c.get("user") as { userId: number } | undefined;
  if (!authUser) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const body = await parseJson(c, ChangePasswordBody);

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, authUser.userId));

  if (!user) {
    return c.json({ error: "user not found" }, 404);
  }

  const valid = await verifyPassword(body.currentPassword, user.passwordHash);
  if (!valid) {
    return c.json({ error: "current password is incorrect" }, 403);
  }

  const newHash = await hashPassword(body.newPassword);
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));

  writeAuditLog(
    {
      type: "operation",
      action: "auth.change_password",
      resource: "auth",
      resourceId: String(user.id),
    },
    c,
  );

  return c.json({ ok: true });
});

// ─── POST /seed-admin ─────────────────────────────────────────────

router.post("/seed-admin", async (c) => {
  // Only works if no users exist
  const [existing] = await db.select({ count: sql<number>`COUNT(*)` }).from(users);
  if (existing && Number(existing.count) > 0) {
    return c.json({ error: "users already exist" }, 400);
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    return c.json({ error: "ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment" }, 400);
  }

  const passwordHash = await hashPassword(adminPassword);
  await db.insert(users).values({
    email: adminEmail,
    passwordHash,
    displayName: "Admin",
    role: "admin",
  });

  logger.info({ event: "seed_admin_created", email: adminEmail }, "Initial admin user created");

  return c.json({ created: true }, 201);
});

export default router;
