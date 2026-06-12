import type { Context, Next } from "hono";
import { Jwt } from "hono/utils/jwt";
import { JWT_SECRET } from "../lib/auth";
import type { JwtPayload } from "../lib/auth";
import { logger } from "../lib/logger";

/**
 * JWT + API key auth middleware.
 *
 * 1. Public GET requests pass through (read-only access to non-settings endpoints)
 * 2. Tries JWT Bearer token first
 * 3. Falls back to x-api-key header / ?api_key= query param
 * 4. Returns 401 if neither is valid
 */
export async function authMiddleware(c: Context, next: Next) {
  // Allow public GET requests (read-only) — except settings and auth endpoints
  if (c.req.method === 'GET' && !c.req.path.startsWith('/api/settings') && !c.req.path.startsWith('/api/auth')) {
    await next();
    return;
  }

  const authHeader = c.req.header("Authorization");

  // Try JWT Bearer token
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const payload = await Jwt.verify(token, JWT_SECRET, "HS256");
      if (payload && typeof payload.userId === "number" && typeof payload.role === "string") {
        c.set("user", {
          userId: payload.userId,
          role: payload.role,
          email: (payload.email as string) || "",
        });
        await next();
        return;
      }
    } catch {
      // Token invalid, fall through to API key check
    }
  }

  // Fallback: check API key
  const API_KEY = process.env.API_KEY || "";
  if (API_KEY) {
    const provided = c.req.header("x-api-key") || c.req.query("api_key");
    if (provided === API_KEY) {
      c.set("user", { userId: null, role: "viewer", email: "api-key-user" });
      await next();
      return;
    }
  }

  // No valid auth
  const l = c.get("logger") as typeof logger | undefined;
  (l || logger).warn({ event: "auth_failed" }, "Authentication failed");
  return c.json({ error: "unauthorized" }, 401);
}

/**
 * Role check middleware factory.
 * Returns a middleware that requires at least one of the specified roles.
 */
export function requireRole(...roles: string[]) {
  return async (c: Context, next: Next) => {
    const user = c.get("user") as { role: string } | undefined;
    if (!user || !roles.includes(user.role)) {
      return c.json({ error: "forbidden" }, 403);
    }
    await next();
  };
}

/**
 * Require admin role.
 */
export const requireAdmin = requireRole("admin");
