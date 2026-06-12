/**
 * Scheduled report generation & delivery engine.
 *
 * Generates daily/weekly HTML reports from DB data and dispatches
 * them via configured notification channels.
 */

import { Cron } from "croner";
import { db } from "../db";
import { opencodeUsage, deepseekBalance, servers, scheduledReports, settings } from "../db/schema";
import { getChannels, dispatchToChannels } from "./notifications";
import { logger } from "./logger";
import { eq, desc, sql } from "drizzle-orm";

interface ReportData {
  periodStart: Date;
  periodEnd: Date;
  type: "daily" | "weekly";
  opencodeCost: string;
  opencodeTokens: { input: number; output: number; reasoning: number };
  deepseekBalance: string;
  serverCount: { total: number; online: number };
  topModels: Array<{ model: string; cost: string }>;
}

interface ReportScheduleConfig {
  enabled?: boolean;
  daily?: string;
  weekly?: string;
  channels?: string[];
}

async function readScheduleConfig(): Promise<ReportScheduleConfig> {
  try {
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "report_schedule"))
      .limit(1);
    return row?.value ? JSON.parse(row.value) : { enabled: false };
  } catch {
    return { enabled: false };
  }
}

async function collectData(periodStart: Date, periodEnd: Date): Promise<ReportData> {
  const [costRow] = await db
    .select({
      totalCost: sql<string>`COALESCE(SUM(cost::numeric), 0)`,
      totalInput: sql<number>`COALESCE(SUM(tokens_input), 0)`,
      totalOutput: sql<number>`COALESCE(SUM(tokens_output), 0)`,
      totalReasoning: sql<number>`COALESCE(SUM(tokens_reasoning), 0)`,
    })
    .from(opencodeUsage)
    .where(sql`bucket_start >= ${periodStart} AND bucket_end <= ${periodEnd}`);

  const topModels = await db
    .select({
      model: opencodeUsage.model,
      cost: sql<string>`ROUND(SUM(cost::numeric)::numeric, 2)`,
    })
    .from(opencodeUsage)
    .where(sql`bucket_start >= ${periodStart} AND bucket_end <= ${periodEnd}`)
    .groupBy(opencodeUsage.model)
    .orderBy(sql`SUM(cost::numeric) DESC`)
    .limit(5);

  const [balance] = await db
    .select({
      total: deepseekBalance.balanceTotal,
    })
    .from(deepseekBalance)
    .orderBy(desc(deepseekBalance.recordedAt))
    .limit(1);

  const allServers = await db.select({ id: servers.id }).from(servers);
  const activeServers = await db
    .select({ id: servers.id })
    .from(servers)
    .where(eq(servers.isActive, true));

  return {
    periodStart,
    periodEnd,
    type: "daily",
    opencodeCost: costRow?.totalCost || "0",
    opencodeTokens: {
      input: costRow?.totalInput || 0,
      output: costRow?.totalOutput || 0,
      reasoning: costRow?.totalReasoning || 0,
    },
    deepseekBalance: balance?.total || "N/A",
    serverCount: {
      total: allServers.length,
      online: activeServers.length,
    },
    topModels: topModels.map((m) => ({
      model: m.model || "unknown",
      cost: m.cost,
    })),
  };
}

function renderHtmlReport(data: ReportData): string {
  const isDaily = data.type === "daily";
  const periodLabel = isDaily ? "日报" : "周报";
  const dateStr = `${data.periodStart.toISOString().slice(0, 10)} ~ ${data.periodEnd.toISOString().slice(0, 10)}`;

  const modelRows = data.topModels
    .map(
      (m) =>
        `<tr><td style="padding:4px 8px;border:1px solid #333">${escapeHtml(m.model)}</td><td style="padding:4px 8px;border:1px solid #333;text-align:right">¥${m.cost}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
body{font-family:-apple-system,sans-serif;background:#1a1a2e;color:#e0e0e0;padding:20px}
h1{color:#a78bfa;font-size:20px}
h2{color:#c084fc;font-size:16px;margin-top:20px}
.card{background:#16213e;border-radius:8px;padding:16px;margin:12px 0}
table{border-collapse:collapse;width:100%}
td,th{padding:6px 10px;border:1px solid #2a2a4a;text-align:left}
th{background:#2a2a4a;color:#a78bfa;font-size:12px}
</style></head>
<body>
<h1>tf-dashboard ${periodLabel}</h1>
<p style="color:#888">${dateStr}</p>
<div class="card">
<h2>📊 Token 用量</h2>
<table>
<tr><td>总费用</td><td><strong>¥${data.opencodeCost}</strong></td></tr>
<tr><td>输入 Tokens</td><td>${data.opencodeTokens.input.toLocaleString()}</td></tr>
<tr><td>输出 Tokens</td><td>${data.opencodeTokens.output.toLocaleString()}</td></tr>
<tr><td>推理 Tokens</td><td>${data.opencodeTokens.reasoning.toLocaleString()}</td></tr>
</table>
</div>
<div class="card">
<h2>🏆 Top 5 模型费用</h2>
<table>
<tr><th>模型</th><th>费用</th></tr>
${modelRows}
</table>
</div>
<div class="card">
<h2>🖥️ 服务器状态</h2>
<table>
<tr><td>总数</td><td>${data.serverCount.total}</td></tr>
<tr><td>在线</td><td>${data.serverCount.online}</td></tr>
</table>
</div>
<div class="card">
<h2>💰 DeepSeek 余额</h2>
<p>¥${data.deepseekBalance}</p>
</div>
</body></html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildTextSummary(data: ReportData): string {
  const label = data.type === "daily" ? "日报" : "周报";
  const start = data.periodStart.toISOString().slice(0, 10);
  const end = data.periodEnd.toISOString().slice(0, 10);
  return [
    `【tf-dashboard ${label}】${start} ~ ${end}`,
    `总费用: ¥${data.opencodeCost}`,
    `输入/输出/推理 Tokens: ${data.opencodeTokens.input.toLocaleString()} / ${data.opencodeTokens.output.toLocaleString()} / ${data.opencodeTokens.reasoning.toLocaleString()}`,
    `服务器在线: ${data.serverCount.online}/${data.serverCount.total}`,
    `DeepSeek 余额: ¥${data.deepseekBalance}`,
  ].join("\n");
}

export async function generateReport(type: "daily" | "weekly"): Promise<void> {
  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - (type === "daily" ? 1 : 7));
  const reportLabel = type === "daily" ? "日报" : "周报";

  try {
    const data = await collectData(periodStart, now);
    data.type = type;

    const html = renderHtmlReport(data);
    const textSummary = buildTextSummary(data);

    const config = await readScheduleConfig();
    const allChannels = await getChannels();

    let targetChannels = allChannels;
    if (config.channels && config.channels.length > 0) {
      const allowed = new Set(config.channels);
      targetChannels = allChannels.filter((c) => allowed.has(c.name));
    }

    if (targetChannels.length === 0) {
      logger.warn({ event: "report_no_channels", type }, `${reportLabel}: 无匹配通知渠道`);
      return;
    }

    const sentTo = targetChannels.map((c) => c.name);

    await dispatchToChannels(targetChannels, {
      title: `tf-dashboard ${reportLabel}`,
      message: textSummary,
      type: "report",
      severity: "info",
      timestamp: now.toISOString(),
    });

    await db.insert(scheduledReports).values({
      type,
      status: "sent",
      periodStart,
      periodEnd: now,
      content: html,
      sentTo,
    });

    logger.info(
      { event: "report_sent", type, channels: sentTo.length },
      `${reportLabel}已发送到 ${sentTo.length} 个渠道`,
    );
  } catch (err) {
    logger.error({ err, event: "report_failed", type }, `${reportLabel}生成失败`);

    await db
      .insert(scheduledReports)
      .values({
        type,
        status: "failed",
        periodStart,
        periodEnd: now,
        error: String(err),
      })
      .catch(() => {});
  }
}

/**
 * Exported array of cron jobs for graceful shutdown tracking.
 * Index.ts pushes these into its own cronJobs list during startup.
 */
export const reportCronJobs: { stop: () => void }[] = [];

export function startReportScheduler(): void {
  const init = async () => {
    try {
      const config = await readScheduleConfig();

      if (!config.enabled) {
        logger.info({ event: "report_scheduler_disabled" }, "定期报告: 未启用");
        return;
      }

      if (config.daily) {
        const dailyJob = new Cron(config.daily, { timezone: "Asia/Shanghai" }, () => {
          generateReport("daily").catch((err) =>
            logger.error({ err, event: "scheduled_report_error" }, "日报执行失败"),
          );
        });
        reportCronJobs.push(dailyJob);
        logger.info(
          { schedule: config.daily, event: "report_scheduled" },
          `日报已调度: ${config.daily}`,
        );
      }

      if (config.weekly) {
        const weeklyJob = new Cron(config.weekly, { timezone: "Asia/Shanghai" }, () => {
          generateReport("weekly").catch((err) =>
            logger.error({ err, event: "scheduled_report_error" }, "周报执行失败"),
          );
        });
        reportCronJobs.push(weeklyJob);
        logger.info(
          { schedule: config.weekly, event: "report_scheduled" },
          `周报已调度: ${config.weekly}`,
        );
      }
    } catch (err) {
      logger.warn(
        { err, event: "report_scheduler_init_failed" },
        "定期报告调度器初始化失败",
      );
    }
  };

  // Fire-and-forget: delay slightly to let pollers start first
  setTimeout(init, 5000);
}
