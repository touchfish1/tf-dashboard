import { db } from "../db";
import { deepseekBalance, settings } from "../db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { emit } from "../lib/event-bus";
import { markPollerStart, markPollerSuccess, markPollerError } from "../lib/poller-health";

const API_BASE = "https://api.deepseek.com";

interface BalanceResponse {
  is_available: boolean;
  balance_infos: Array<{
    currency: string;
    total_balance: string;
    granted_balance: string;
    topped_up_balance: string;
  }>;
}

async function getApiKey(): Promise<string> {
  const envKey = process.env.DEEPSEEK_API_KEY || "";
  if (envKey) return envKey;
  const [row] = await db.select().from(settings).where(eq(settings.key, "deepseek_api_key"));
  return row?.value || "";
}

export async function pollDeepSeekBalance(): Promise<void> {
  markPollerStart('deepseek');
  const apiKey = await getApiKey();
  if (!apiKey) {
    logger.warn({ event: "no_api_key" }, "DeepSeek: 未配置API密钥，跳过");
    markPollerSuccess('deepseek');
    return;
  }

  try {
    const resp = await fetch(`${API_BASE}/user/balance`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      logger.warn({ status: resp.status, event: "http_error" }, `DeepSeek: HTTP ${resp.status}`);
      markPollerSuccess('deepseek');
      return;
    }

    const data: BalanceResponse = await resp.json();

    if (data.balance_infos && data.balance_infos.length > 0) {
      const info = data.balance_infos[0];
      await db.insert(deepseekBalance).values({
        balanceTotal: info.total_balance,
        balanceGranted: info.granted_balance,
        balanceToppedUp: info.topped_up_balance,
        currency: info.currency,
      });
      logger.info({ balance: info.total_balance, currency: info.currency, event: "balance_updated" }, `DeepSeek余额: ¥${info.total_balance}`);
      emit({ type: 'deepseek_balance', balanceTotal: Number(info.total_balance), balanceGranted: Number(info.granted_balance), balanceToppedUp: Number(info.topped_up_balance) });
    }
    markPollerSuccess('deepseek');
  } catch (err) {
    logger.warn({ err, event: "poll_failed" }, "DeepSeek poll failed");
    markPollerError('deepseek', String(err));
  }
}
