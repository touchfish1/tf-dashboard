import { db } from "../db";
import { alerts, settings } from "../db/schema";
import { and, eq, sql } from "drizzle-orm";
import { logger } from "./logger";

type AlertType = "balance_low" | "server_offline" | "opencode_error" | "system";
type Severity = "info" | "warning" | "critical";

/**
 * Create an alert and push it to configured webhooks.
 */
export async function createAlert(
  type: AlertType,
  title: string,
  message: string,
  severity: Severity = "warning",
  refId?: string
) {
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
    type, severity, title, message, refId: refId || null,
  });

  logger.info({ event: "alert_created", type, severity, title, refId }, `告警: ${title}`);

  // Push to webhook (fire-and-forget)
  pushToWebhook({ type, severity, title, message, refId });
}

/**
 * Get the configured webhook URL from settings.
 */
async function getWebhookUrl(): Promise<string | null> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, "webhook_url")).limit(1);
    return row?.value || null;
  } catch {
    return null;
  }
}

interface WebhookPayload {
  event: "alert";
  type: string;
  severity: string;
  title: string;
  message: string;
  refId?: string;
  timestamp: string;
}

/**
 * Push alert to configured webhook URL.
 * Supports Slack-compatible webhook format and generic JSON webhooks.
 */
async function pushToWebhook(alert: { type: string; severity: string; title: string; message: string; refId?: string }): Promise<void> {
  const url = await getWebhookUrl();
  if (!url) return;

  const payload: WebhookPayload = {
    event: "alert",
    type: alert.type,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    refId: alert.refId,
    timestamp: new Date().toISOString(),
  };

  // Detect Slack webhook (contains hooks.slack.com)
  const isSlack = url.includes("hooks.slack.com");
  const body = isSlack
    ? { text: `[${alert.severity.toUpperCase()}] ${alert.title}\n${alert.message}` }
    : payload;

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}
