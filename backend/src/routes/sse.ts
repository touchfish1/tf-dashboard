/**
 * SSE (Server-Sent Events) route
 *
 * Streams dashboard events in real-time to connected clients.
 * Uses Hono's built-in streamSSE helper for proper SSE formatting.
 *
 * Auth: self-contained (not relying on global authMiddleware) because
 * EventSource cannot set custom headers — JWT tokens are passed via ?token=
 * query parameter instead.
 */

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { subscribe } from "../lib/event-bus";
import { verifyAccessToken } from "../lib/auth";
import { logger } from "../lib/logger";

const router = new Hono();

/**
 * GET /api/sse — SSE stream endpoint
 *
 * Auth (checked in order):
 *   1. ?token=<jwt> query param  — for EventSource connections
 *   2. Authorization: Bearer <token> header — for programmatic use
 *   3. ?api_key= or x-api-key   — for API key users
 */
router.get("/", async (c) => {
  // ── Auth ──────────────────────────────────────────────────────
  let userId: number | null = null;
  let role = "viewer";
  let email = "";

  const tokenFromQuery = c.req.query("token");
  const authHeader = c.req.header("Authorization");
  const apiKeyHeader = c.req.header("x-api-key");
  const apiKeyQuery = c.req.query("api_key");

  // Try JWT from query param (primary path for EventSource)
  if (tokenFromQuery) {
    const payload = await verifyAccessToken(tokenFromQuery);
    if (payload) {
      userId = payload.userId;
      role = payload.role;
      email = payload.email;
    } else {
      return c.json({ error: "unauthorized" }, 401);
    }
  }
  // Try JWT from Authorization header
  else if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const payload = await verifyAccessToken(token);
    if (payload) {
      userId = payload.userId;
      role = payload.role;
      email = payload.email;
    } else {
      return c.json({ error: "unauthorized" }, 401);
    }
  }
  // Try API key
  else {
    const API_KEY = process.env.API_KEY || "";
    if (!API_KEY) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const provided = apiKeyQuery || apiKeyHeader;
    if (provided !== API_KEY) {
      return c.json({ error: "unauthorized" }, 401);
    }
    // API key user — leave userId as null
  }

  c.set("user", { userId, role, email });

  // ── SSE stream ────────────────────────────────────────────────
  logger.info({ event: "sse_connect", userId, role }, "SSE client connected");

  return streamSSE(c, async (stream) => {
    let resolveWait: (() => void) | null = null;
    let keepAliveId: ReturnType<typeof setInterval> | null = null;

    // Subscribe to all dashboard events
    const unsub = subscribe((event) => {
      stream.writeSSE({
        data: JSON.stringify(event),
        event: event.type,
      }).catch(() => {
        // Stream closed, ignore write errors
      });
    });

    // Handle client disconnect
    stream.onAbort(() => {
      logger.info({ event: "sse_disconnect", userId }, "SSE client disconnected");
      unsub();
      if (keepAliveId) clearInterval(keepAliveId);
      if (resolveWait) resolveWait();
    });

    // Keepalive comment every 15s to prevent proxy timeouts
    keepAliveId = setInterval(() => {
      stream.writeSSE({ data: "" }).catch(() => {
        if (keepAliveId) clearInterval(keepAliveId);
      });
    }, 15000);

    // Wait until client disconnects (resolved by onAbort)
    await new Promise<void>((resolve) => {
      resolveWait = resolve;
    });
  });
});

export default router;
