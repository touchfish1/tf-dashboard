import { db } from "../db";
import { deepseekBalance, settings } from "../db/schema";
import { eq } from "drizzle-orm";
import { createAlert } from "../lib/alerts";

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
  const apiKey = await getApiKey();
  if (!apiKey) {
    console.warn("[deepseek] no API key configured, skipping");
    return;
  }

  try {
    const resp = await fetch(`${API_BASE}/user/balance`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      console.warn(`[deepseek] HTTP ${resp.status}: ${resp.statusText}`);
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
      console.log(`[deepseek] balance: ¥${info.total_balance}`);
      const bal = parseFloat(info.total_balance);
      if (bal > 0 && bal < 5) {
        await createAlert("balance_low", "DeepSeek 余额不足", `当前余额 ¥${bal}，低于 ¥5`, "warning");
      } else if (bal > 0 && bal < 1) {
        await createAlert("balance_low", "DeepSeek 余额即将耗尽", `当前余额 ¥${bal}，请立即充值`, "critical");
      }
    }
  } catch (err) {
    console.warn("[deepseek] poll failed:", err);
  }
}
