import { db } from "../db";
import { auditLog } from "../db/schema";
import { desc } from "drizzle-orm";
import type { Context } from "hono";
import { getRequestMeta } from "./logger";

type AuditType = "operation" | "access";
type AuditAction =
  | "server.create" | "server.update" | "server.delete"
  | "link.create" | "link.update" | "link.delete"
  | "settings.update" | "settings.delete"
  | "alert.create" | "alert.ack"
  | "upload.file";

interface AuditInput {
  type: AuditType;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  detail?: Record<string, unknown>;
  status?: number;
  durationMs?: number;
}

/**
 * Write an audit log entry, auto-enriching with request context if available.
 */
export async function writeAuditLog(input: AuditInput, c?: Context): Promise<void> {
  const meta = c ? getRequestMeta(c) : {};

  await db.insert(auditLog).values({
    type: input.type,
    action: input.action,
    resource: input.resource,
    resourceId: input.resourceId || null,
    detail: input.detail ? JSON.stringify(input.detail) : null,
    ip: meta.ip || null,
    userAgent: meta.ua ? meta.ua.slice(0, 200) : null,
    status: input.status ?? null,
    durationMs: input.durationMs ?? null,
  }).catch(() => {
    // Audit logging must never break the main flow
  });
}

/**
 * Query recent audit logs.
 */
export async function getAuditLogs(limit = 100, offset = 0) {
  return db.select()
    .from(auditLog)
    .orderBy(desc(auditLog.timestamp))
    .limit(limit)
    .offset(offset);
}
