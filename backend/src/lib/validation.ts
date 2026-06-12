import { z } from "zod";

// ─── Common ──────────────────────────────────────────

export const IdParam = z.coerce.number().int().positive();
export const DaysQuery = z.coerce.number().int().min(1).max(365).default(7);
export const LimitQuery = z.coerce.number().int().min(1).max(2000).default(100);

// ─── Servers ─────────────────────────────────────────

export const CreateServerBody = z.object({
  name: z.string().min(1).max(100),
  metricsUrl: z.string().url().max(500),
  labels: z.array(z.string().max(50)).max(20).optional(),
});

export const UpdateServerBody = z.object({
  name: z.string().min(1).max(100).optional(),
  metricsUrl: z.string().url().max(500).optional(),
  labels: z.array(z.string().max(50)).max(20).optional(),
  isActive: z.boolean().optional(),
});

// ─── OpenCode ────────────────────────────────────────

export const OpenCodeUsageQuery = z.object({
  days: DaysQuery,
  raw: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

// ─── DeepSeek ────────────────────────────────────────

export const DeepSeekHistoryQuery = z.object({
  days: DaysQuery,
});

// ─── Settings ────────────────────────────────────────

export const SettingValue = z.object({
  value: z.string().max(10000),
});

export const SettingKey = z.string().min(1).max(200);

// ─── Nav Links ───────────────────────────────────────

export const CreateLinkBody = z.object({
  title: z.string().min(1).max(200),
  url: z.string().url().max(2000),
  icon: z.string().max(50).optional(),
  category: z.string().max(100).optional(),
});

export const UpdateLinkBody = z.object({
  title: z.string().min(1).max(200).optional(),
  url: z.string().url().max(2000).optional(),
  icon: z.string().max(50).optional(),
  category: z.string().max(100).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// ─── Upload ──────────────────────────────────────────

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
];

export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5MB

// ─── Alert Rules ─────────────────────────────────────

export const RuleCondition = z.object({
  field: z.enum(['deepseek_balance', 'server_offline', 'opencode_etl_error', 'opencode_cost_anomaly', 'monthly_budget_pct', 'cpu_percent', 'memory_percent']),
  operator: z.enum(['lt', 'lte', 'gt', 'gte', 'eq', 'true']),
  value: z.number().optional(),
  unit: z.string().optional(),
});

export const CreateAlertRuleBody = z.object({
  name: z.string().min(1).max(200),
  enabled: z.boolean().optional().default(true),
  conditions: z.array(RuleCondition).min(1).max(20),
  matchMode: z.enum(['all', 'any']).optional().default('all'),
  notificationChannels: z.array(z.string()).optional().default([]),
  cooldownMinutes: z.number().int().min(0).max(1440).optional().default(360),
  severity: z.enum(['info', 'warning', 'critical']).optional().default('warning'),
});

export const UpdateAlertRuleBody = z.object({
  name: z.string().min(1).max(200).optional(),
  enabled: z.boolean().optional(),
  conditions: z.array(RuleCondition).min(1).max(20).optional(),
  matchMode: z.enum(['all', 'any']).optional(),
  notificationChannels: z.array(z.string()).optional(),
  cooldownMinutes: z.number().int().min(0).max(1440).optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
});

// ─── Notification Channels (settings KV) ────────────

export const NotificationChannel = z.object({
  type: z.enum(['slack', 'feishu', 'dingtalk', 'wecom', 'webhook_generic']),
  url: z.string().url().max(2000),
  name: z.string().min(1).max(100),
});

export const NotificationChannelsArray = z.array(NotificationChannel).max(20);

// ─── Helper ──────────────────────────────────────────

import type { Context } from "hono";

export function parseParam(c: Context, key: string, schema: z.ZodSchema): unknown {
  const raw = c.req.param(key);
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError(`Invalid param "${key}": ${formatZodError(result.error)}`);
  }
  return result.data;
}

export function parseQuery<T>(c: Context, schema: z.ZodSchema<T>): T {
  const raw = Object.fromEntries(
    Object.entries(c.req.queries()).map(([k, v]) => [k, v[0]])
  );
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError(`Invalid query: ${formatZodError(result.error)}`);
  }
  return result.data;
}

export async function parseJson<T>(c: Context, schema: z.ZodSchema<T>): Promise<T> {
  const raw = await c.req.json();
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError(formatZodError(result.error));
  }
  return result.data;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Extract first meaningful message from Zod error issues */
export function formatZodError(err: unknown): string {
  if (err instanceof z.ZodError) {
    const issues = err.issues.map((i) => {
      const path = i.path.length > 0 ? `${i.path.join(".")}: ` : "";
      return `${path}${i.message}`;
    });
    return issues.join("; ");
  }
  return String(err);
}
