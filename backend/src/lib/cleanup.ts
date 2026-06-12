import { db } from "../db";
import { serverMetrics, deepseekBalance, auditLog, alerts } from "../db/schema";
import { lt } from "drizzle-orm";
import { logger } from "./logger";

const DEFAULT_RETENTION_DAYS = {
  serverMetrics: 30,
  deepseekBalance: 90,
  auditLog: 90,
  alerts: 30,
};

export async function cleanupOldData(): Promise<void> {
  const now = new Date();

  const tasks = [
    { name: 'server_metrics', table: serverMetrics, days: DEFAULT_RETENTION_DAYS.serverMetrics, col: serverMetrics.collectedAt },
    { name: 'deepseek_balance', table: deepseekBalance, days: DEFAULT_RETENTION_DAYS.deepseekBalance, col: deepseekBalance.recordedAt },
    { name: 'audit_log', table: auditLog, days: DEFAULT_RETENTION_DAYS.auditLog, col: auditLog.timestamp },
    { name: 'alerts', table: alerts, days: DEFAULT_RETENTION_DAYS.alerts, col: alerts.createdAt },
  ] as const;

  for (const task of tasks) {
    try {
      const cutoff = new Date(now.getTime() - task.days * 24 * 60 * 60 * 1000);
      await db.delete(task.table).where(lt(task.col, cutoff));
      logger.info({ event: 'cleanup_completed', table: task.name, retentionDays: task.days }, `清理完成: ${task.name}`);
    } catch (err) {
      logger.warn({ err, event: 'cleanup_failed', table: task.name }, `清理失败: ${task.name}`);
    }
  }
}
