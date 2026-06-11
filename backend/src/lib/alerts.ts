import { db } from "../db";
import { alerts } from "../db/schema";
import { and, eq, sql } from "drizzle-orm";

type AlertType = "balance_low" | "server_offline" | "opencode_error";
type Severity = "info" | "warning" | "critical";

export async function createAlert(
  type: AlertType,
  title: string,
  message: string,
  severity: Severity = "warning",
  refId?: string
) {
  // Deduplicate: don't create the same alert twice within 6 hours
  const existing = await db.select({ id: alerts.id })
    .from(alerts)
    .where(
      and(
        eq(alerts.type, type),
        eq(alerts.refId, refId || ""),
        eq(alerts.acknowledged, false),
        sql`created_at > NOW() - INTERVAL '6 hours'`
      )
    )
    .limit(1);

  if (existing.length > 0) return;

  await db.insert(alerts).values({
    type,
    severity,
    title,
    message,
    refId: refId || null,
  });
}
