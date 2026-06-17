/**
 * In-memory TTL cache middleware for Hono.
 *
 * Caches GET responses with configurable TTL (seconds).
 * Provides manual invalidation by path prefix.
 *
 * Usage:
 *   app.use('/api/opencode/summary', cache(30))
 *   app.use('/api/deepseek/balance', cache(15))
 */

import type { Context, Next } from "hono";

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();
const MAX_CACHE_ENTRIES = 2000;

// Cleanup expired entries every 5 minutes
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt < now) store.delete(key);
  }
}, 300_000);

export function clearCacheCleanup(): void {
  clearInterval(cleanupInterval);
}

export function getCacheKey(c: Context): string {
  return c.req.url;
}

export function cache(ttlSeconds: number) {
  return async (c: Context, next: Next) => {
    // Only cache GET requests
    if (c.req.method !== "GET") {
      await next();
      return;
    }

    const key = getCacheKey(c);
    const entry = store.get(key);

    if (entry && entry.expiresAt > Date.now()) {
      // LRU: re-insert to move to end of Map (most recently used)
      store.delete(key);
      store.set(key, entry);
      // Cache hit
      c.header("X-Cache", "HIT");
      c.header("Cache-Control", `public, max-age=${ttlSeconds}`);
      return c.json(entry.data);
    }

    // Cache miss — intercept c.json to capture response data
    const originalJson = c.json.bind(c);
    c.json = ((data: unknown, ...args: any[]) => {
      // LRU eviction — delete oldest if at capacity
      if (store.size >= MAX_CACHE_ENTRIES) {
        const oldest = store.keys().next().value;
        if (oldest) store.delete(oldest);
      }
      store.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
      c.header("X-Cache", "MISS");
      c.header("Cache-Control", `public, max-age=${ttlSeconds}`);
      return originalJson(data, ...args);
    }) as typeof c.json;

    await next();
  };
}

/**
 * Invalidate all cache entries whose key starts with the given prefix.
 */
export function invalidateCache(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/**
 * Clear the entire cache store.
 */
export function clearCache(): void {
  store.clear();
}
