/**
 * Multi-channel Notification Dispatcher
 *
 * Reads webhook channel config from settings (key: "notification_channels")
 * and dispatches alert payloads to each configured channel in the correct format.
 */

import { db } from "../db";
import { settings } from "../db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export interface NotificationChannel {
  type: 'slack' | 'feishu' | 'dingtalk' | 'wecom' | 'webhook_generic';
  url: string;
  name: string;
}

export interface AlertPayload {
  title: string;
  message: string;
  severity: string;
  type: string;
  timestamp: string;
}

/**
 * Read configured notification channels from the settings table.
 * Key: "notification_channels", value is a JSON array of NotificationChannel objects.
 */
export async function getChannels(): Promise<NotificationChannel[]> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, "notification_channels")).limit(1);
    if (!row?.value) return [];
    const parsed = JSON.parse(row.value);
    if (!Array.isArray(parsed)) return [];
    return parsed as NotificationChannel[];
  } catch (err) {
    logger.warn({ err, event: "get_channels_failed" }, "Failed to read notification channels from settings");
    return [];
  }
}

/**
 * Dispatch an alert to all configured notification channels.
 * Each channel send is independent; failures are logged but don't block others.
 */
export async function dispatchToChannels(channels: NotificationChannel[], alert: AlertPayload): Promise<void> {
  const results = await Promise.allSettled(
    channels.map((channel) => sendToChannel(channel, alert))
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const channel = channels[i];
    if (result.status === "rejected") {
      logger.error({ err: result.reason, channel: channel.name, channelType: channel.type, event: "notification_failed" },
        `Notification to ${channel.name} (${channel.type}) failed`);
    } else {
      logger.info({ channel: channel.name, channelType: channel.type, event: "notification_sent" },
        `Notification sent to ${channel.name} (${channel.type})`);
    }
  }
}

/**
 * Send an alert to a single channel with the correct format for that platform.
 */
export async function sendToChannel(channel: NotificationChannel, alert: AlertPayload): Promise<void> {
  const body = formatPayload(channel, alert);

  const resp = await fetch(channel.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${await resp.text().catch(() => "no body")}`);
  }
}

/**
 * Format an alert payload according to the target channel's webhook format.
 */
function formatPayload(channel: NotificationChannel, alert: AlertPayload): Record<string, unknown> {
  switch (channel.type) {
    case "slack":
      return formatSlack(alert);
    case "feishu":
      return formatFeishu(alert);
    case "dingtalk":
      return formatDingTalk(alert);
    case "wecom":
      return formatWecom(alert);
    case "webhook_generic":
      return formatGeneric(alert);
    default:
      // Fallback: send as generic JSON
      return formatGeneric(alert);
  }
}

function severityColor(severity: string): string {
  switch (severity) {
    case "critical": return "red";
    case "warning":  return "yellow";
    case "info":     return "blue";
    default:         return "grey";
  }
}

function formatSlack(alert: AlertPayload): Record<string, unknown> {
  return {
    text: `[${alert.severity.toUpperCase()}] ${alert.title}\n${alert.message}`,
  };
}

function formatFeishu(alert: AlertPayload): Record<string, unknown> {
  return {
    msg_type: "interactive",
    card: {
      header: {
        title: { tag: "plain_text", content: alert.title },
        template: severityColor(alert.severity),
      },
      elements: [
        { tag: "markdown", content: alert.message },
      ],
    },
  };
}

function formatDingTalk(alert: AlertPayload): Record<string, unknown> {
  return {
    msgtype: "markdown",
    markdown: {
      title: alert.title,
      text: `## ${alert.severity}\n${alert.title}\n\n${alert.message}`,
    },
  };
}

function formatWecom(alert: AlertPayload): Record<string, unknown> {
  return {
    msgtype: "markdown",
    markdown: {
      content: `## ${alert.title}\n${alert.message}`,
    },
  };
}

function formatGeneric(alert: AlertPayload): Record<string, unknown> {
  return {
    event: "alert",
    type: alert.type,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    timestamp: alert.timestamp,
  };
}
