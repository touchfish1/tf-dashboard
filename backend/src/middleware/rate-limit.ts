/**
 * In-memory sliding window rate limiter middleware for Hono.
 *
 * No external dependencies — uses a plain Map with periodic cleanup.
 *
 * Usage:
 *   app.use('/api/auth/login', rateLimit({ windowMs: 60_000, maxRequests: 10 }))
 *   app.use('/api/*', rateLimit({ windowMs: 60_000, maxRequests: 60 }))
 */

import type { Context, Next } from "hono";

interface RateLimitConfig {
  windowMs: number;     // time window in milliseconds
  maxRequests: number;  // max requests per window
}

const defaults: RateLimitConfig = { windowMs: 60_000, maxRequests: 60 };

// Store: Map<key, { count: number, resetAt: number }>
const store = new Map<string, { count: number; resetAt: number }>();

// Cleanup old entries every 5 minutes
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, val] of store) {
    if (val.resetAt < now) store.delete(key);
  }
}, 300_000);

// Allow cleanup interval to be cleared during shutdown
export function clearRateLimitCleanup(): void {
  clearInterval(cleanupInterval);
}

export function rateLimit(config?: Partial<RateLimitConfig>) {
  const { windowMs, maxRequests } = { ...defaults, ...config };

  return async (c: Context, next: Next) => {
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
      || c.req.header("x-real-ip")
      || "unknown";
    const key = `rl:${ip}`;
    const now = Date.now();

    let entry = store.get(key);
    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    // Set rate limit headers
    c.header("X-RateLimit-Limit", String(maxRequests));
    c.header("X-RateLimit-Remaining", String(Math.max(0, maxRequests - entry.count)));
    c.header("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > maxRequests) {
      return c.json({ error: "too many requests" }, 429);
    }

    await next();
  };
}
