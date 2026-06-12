/**
 * Alert Engine
 *
 * Evaluates alert rules against incoming dashboard events.
 * Deduplicates within cooldown periods, creates alerts via lib/alerts,
 * and dispatches notifications to configured channels.
 */

import { db } from "../db";
import { alerts, alertRules } from "../db/schema";
import { and, eq, gte } from "drizzle-orm";
import { logger } from "./logger";
import { createAlert } from "./alerts";
import { dispatchToChannels } from "./notifications";
import type { DashboardEvent } from "./event-bus";

// ─── Condition DSL ────────────────────────────────────────────────

export interface RuleCondition {
  field: 'deepseek_balance' | 'server_offline' | 'opencode_etl_error' | 'opencode_cost_anomaly' | 'monthly_budget_pct' | 'cpu_percent' | 'memory_percent';
  operator: 'lt' | 'lte' | 'gt' | 'gte' | 'eq' | 'true';
  value?: number;
  unit?: string;
}

interface CachedRule {
  id: number;
  name: string;
  severity: string;
  conditions: RuleCondition[];
  matchMode: 'all' | 'any';
  notificationChannels: Array<{ type: string; url: string; name: string }>;
  cooldownMinutes: number;
}

// ─── Rule cache (refreshed every 60s) ─────────────────────────────

let rulesCache: CachedRule[] = [];
let lastCacheRefresh = 0;
const CACHE_TTL = 60_000; // 60 seconds

async function getEnabledRules(): Promise<CachedRule[]> {
  const now = Date.now();
  if (now - lastCacheRefresh < CACHE_TTL && rulesCache.length > 0) {
    return rulesCache;
  }

  try {
    const rows = await db.select().from(alertRules).where(eq(alertRules.enabled, true));
    rulesCache = rows.map((row) => ({
      id: row.id,
      name: row.name || "Unnamed Rule",
      severity: row.severity || "warning",
      conditions: (row.conditions || []) as RuleCondition[],
      matchMode: (row.matchMode as 'all' | 'any') || "all",
      notificationChannels: (row.notificationChannels || []) as Array<{ type: string; url: string; name: string }>,
      cooldownMinutes: row.cooldownMinutes || 360,
    }));
    lastCacheRefresh = now;
    logger.debug({ ruleCount: rulesCache.length, event: "rules_cache_refreshed" }, `Loaded ${rulesCache.length} alert rules`);
  } catch (err) {
    // If table doesn't exist yet (first run, schema not applied), log and return empty
    logger.warn({ err, event: "rules_load_failed" }, "Failed to load alert rules (table may not exist yet)");
    rulesCache = [];
    lastCacheRefresh = now;
  }

  return rulesCache;
}

/**
 * Force refresh the rule cache (e.g., after rules are updated in settings).
 */
export function refreshRuleCache(): void {
  lastCacheRefresh = 0;
}

// ─── Field → event type mapping ──────────────────────────────────

const FIELD_TO_EVENT_TYPES: Record<string, string[]> = {
  deepseek_balance:     ["deepseek_balance"],
  server_offline:       ["server_offline"],
  opencode_etl_error:   ["opencode_etl_error"],
  opencode_cost_anomaly: ["opencode_cost_anomaly"],
  monthly_budget_pct:   ["monthly_budget_check"],
  cpu_percent:          ["server_metrics"],
  memory_percent:       ["server_metrics"],
};

function isConditionApplicable(condition: RuleCondition, event: DashboardEvent): boolean {
  const types = FIELD_TO_EVENT_TYPES[condition.field];
  return types ? types.includes(event.type) : false;
}

// ─── Condition evaluation ─────────────────────────────────────────

function compare(value: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case 'lt':  return value < threshold;
    case 'lte': return value <= threshold;
    case 'gt':  return value > threshold;
    case 'gte': return value >= threshold;
    case 'eq':  return value === threshold;
    case 'true': return true;
    default:    return false;
  }
}

function evaluateCondition(condition: RuleCondition, event: DashboardEvent): boolean {
  if (condition.operator === 'true') {
    // Presence check: field just needs to match the event type
    return isConditionApplicable(condition, event);
  }

  // Numeric comparison against the relevant event field
  switch (condition.field) {
    case 'deepseek_balance':
      if (event.type !== 'deepseek_balance') return false;
      return compare(event.balanceTotal, condition.operator, condition.value!);

    case 'opencode_cost_anomaly':
      if (event.type !== 'opencode_cost_anomaly') return false;
      return compare(event.todayCost, condition.operator, condition.value!);

    case 'monthly_budget_pct':
      if (event.type !== 'monthly_budget_check') return false;
      return compare(event.usagePercent, condition.operator, condition.value!);

    case 'cpu_percent':
      if (event.type !== 'server_metrics') return false;
      return compare(event.cpuPercent, condition.operator, condition.value!);

    case 'memory_percent':
      if (event.type !== 'server_metrics') return false;
      return compare(event.memoryPercent, condition.operator, condition.value!);

    default:
      // server_offline / opencode_etl_error with non-true operator → evaluate as false
      return false;
  }
}

// ─── Alert type mapping (for backward compat with existing alerts table) ──

function eventTypeToAlertType(eventType: string): string {
  switch (eventType) {
    case 'deepseek_balance':     return 'balance_low';
    case 'server_offline':       return 'server_offline';
    case 'opencode_etl_error':   return 'opencode_error';
    case 'opencode_cost_anomaly': return 'opencode_error';
    default:                     return 'system';
  }
}

// ─── Cooldown check ───────────────────────────────────────────────

async function isInCooldown(ruleId: number, _eventType: string, cooldownMinutes: number): Promise<boolean> {
  if (cooldownMinutes <= 0) return false;

  try {
    const refId = `rule-${ruleId}`;
    const since = new Date(Date.now() - cooldownMinutes * 60_000);
    const existing = await db.select({ id: alerts.id })
      .from(alerts)
      .where(
        and(
          eq(alerts.refId, refId),
          eq(alerts.acknowledged, false),
          gte(alerts.createdAt, since)
        )
      )
      .limit(1);

    return existing.length > 0;
  } catch {
    return false;
  }
}

// ─── Main evaluation entry point ─────────────────────────────────

/**
 * Evaluate all enabled rules against an incoming event.
 * Creates alerts and dispatches notifications for matching rules.
 */
export async function evaluateEvent(event: DashboardEvent): Promise<void> {
  try {
    const rules = await getEnabledRules();

    for (const rule of rules) {
      try {
        // Find applicable conditions for this event
        const applicableConditions = rule.conditions.filter((c) => isConditionApplicable(c, event));

        if (applicableConditions.length === 0) continue; // Rule not relevant for this event

        // Evaluate
        let ruleFires: boolean;
        if (rule.matchMode === 'all') {
          ruleFires = applicableConditions.every((c) => evaluateCondition(c, event));
        } else {
          ruleFires = applicableConditions.some((c) => evaluateCondition(c, event));
        }

        if (!ruleFires) continue;

        // Cooldown check
        const inCooldown = await isInCooldown(rule.id, event.type, rule.cooldownMinutes);
        if (inCooldown) {
          logger.debug({ ruleId: rule.id, ruleName: rule.name, event: "rule_cooldown" },
            `Rule "${rule.name}" skipped due to cooldown (${rule.cooldownMinutes}min)`);
          continue;
        }

        // Build alert payload
        const refId = `rule-${rule.id}`;
        const alertType = eventTypeToAlertType(event.type);
        const title = rule.name;
        const message = formatAlertMessage(rule, event);
        const severity = rule.severity;

        // Create alert via existing lib/alerts (which has its own 6h dedup)
        await createAlert(alertType as any, title, message, severity as any, refId);

        // Dispatch notifications to rule's configured channels
        if (rule.notificationChannels && rule.notificationChannels.length > 0) {
          const channels = rule.notificationChannels.map((ch) => ({
            type: ch.type as any,
            url: ch.url,
            name: ch.name,
          }));
          await dispatchToChannels(channels, {
            title,
            message,
            severity,
            type: alertType,
            timestamp: new Date().toISOString(),
          });
        }

        logger.info({ ruleId: rule.id, ruleName: rule.name, eventType: event.type, severity, event: "rule_fired" },
          `Rule "${rule.name}" fired for ${event.type}`);
      } catch (ruleErr) {
        logger.error({ ruleId: rule.id, ruleName: rule.name, err: ruleErr, event: "rule_eval_error" },
          `Error evaluating rule "${rule.name}"`);
      }
    }
  } catch (err) {
    logger.error({ err, event: "alert_engine_error" }, "Alert engine evaluation failed");
  }
}

// ─── Message formatting ───────────────────────────────────────────

function formatAlertMessage(rule: CachedRule, event: DashboardEvent): string {
  // Build a human-readable message based on the event
  switch (event.type) {
    case 'deepseek_balance':
      return `当前余额 ¥${event.balanceTotal}（已充值: ¥${event.balanceToppedUp}, 已赠送: ¥${event.balanceGranted}）`;

    case 'server_offline':
      return `服务器 "${event.serverName}" (ID: ${event.serverId}) 无法连接`;

    case 'server_metrics': {
      const parts: string[] = [];
      for (const c of rule.conditions) {
        if (c.field === 'cpu_percent' && isConditionApplicable(c, event)) {
          parts.push(`CPU: ${event.cpuPercent}%`);
        }
        if (c.field === 'memory_percent' && isConditionApplicable(c, event)) {
          parts.push(`内存: ${event.memoryPercent}%`);
        }
      }
      return `服务器 "${event.serverName}" - ${parts.join(', ')}`;
    }

    case 'opencode_etl_error':
      return `OpenCode 数据采集错误: ${event.error}`;

    case 'opencode_cost_anomaly':
      return `今日费用 ¥${event.todayCost}，日均 ¥${event.avgCost}，异常倍数 ${event.ratio.toFixed(2)}x`;

    case 'monthly_budget_check':
      return `本月已使用 ¥${event.currentCost} / 预算 ¥${event.budget} (${(event.usagePercent * 100).toFixed(1)}%)`;

    default:
      return JSON.stringify(event);
  }
}
