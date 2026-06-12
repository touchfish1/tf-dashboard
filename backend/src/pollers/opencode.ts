import { db } from "../db";
import { opencodeUsage, settings } from "../db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { emit } from "../lib/event-bus";
import { markPollerStart, markPollerSuccess, markPollerError } from "../lib/poller-health";

const DB_PATH = process.env.OPENCODE_DB_PATH || `${process.env.HOME}/.local/share/opencode/opencode.db`;

interface SessionRow {
  model: string;
  agent: string;
  tokens_input: number;
  tokens_output: number;
  tokens_reasoning: number;
  tokens_cache_read: number;
  tokens_cache_write: number;
  cost: number;
  time_created: number;
}

interface ApiResponse {
  sessions: SessionRow[];
}

async function getApiConfig(): Promise<{ url: string; key: string } | null> {
  const [urlRow, keyRow] = await Promise.all([
    db.select().from(settings).where(eq(settings.key, "opencode_api_url")).limit(1),
    db.select().from(settings).where(eq(settings.key, "opencode_api_key")).limit(1),
  ]);
  const url = urlRow?.[0]?.value || "";
  if (!url) return null;
  const key = keyRow?.[0]?.value || "";
  return { url, key };
}

function getLocalSessions(): SessionRow[] {
  const { existsSync } = require("fs");
  if (!existsSync(DB_PATH)) {
    logger.warn({ dbPath: DB_PATH, event: "db_not_found" }, `数据库未找到: ${DB_PATH}`);
    return [];
  }
  const { Database } = require("bun:sqlite");
  const sqlite = new Database(DB_PATH, { readonly: true });
  const rows = sqlite.query(`
    SELECT
      COALESCE(json_extract(model, '$.id'), model) as model,
      COALESCE(agent, 'unknown') as agent,
      tokens_input, tokens_output, tokens_reasoning,
      tokens_cache_read, tokens_cache_write,
      cost, time_created
    FROM session
    WHERE time_created >= (strftime('%s', 'now', '-7 days')) * 1000
    ORDER BY time_created DESC
  `).all() as SessionRow[];
  sqlite.close();
  return rows;
}

async function getApiSessions(api: { url: string; key: string }): Promise<SessionRow[]> {
  const url = new URL(api.url);
  url.searchParams.set("api_key", api.key);
  const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data: ApiResponse = await resp.json();
  if (!Array.isArray(data.sessions)) {
    throw new Error("response missing 'sessions' array");
  }
  return data.sessions;
}

async function aggregateAndStore(rows: SessionRow[]): Promise<void> {
  if (rows.length === 0) {
    logger.info({ event: "no_data" }, "OpenCode: 无新会话需要聚合");
    return;
  }

  const buckets = new Map<string, {
    model: string; agent: string; count: number;
    ti: number; to: number; tr: number; tcr: number; tcw: number;
    cost: number;
  }>();

  for (const row of rows) {
    const hour = new Date(row.time_created).toISOString().slice(0, 13) + ":00:00Z";
    const key = `${hour}|${row.model}|${row.agent}`;

    const existing = buckets.get(key);
    if (existing) {
      existing.ti += row.tokens_input;
      existing.to += row.tokens_output;
      existing.tr += row.tokens_reasoning;
      existing.tcr += row.tokens_cache_read;
      existing.tcw += row.tokens_cache_write;
      existing.cost += row.cost;
      existing.count++;
    } else {
      buckets.set(key, {
        model: row.model, agent: row.agent, count: 1,
        ti: row.tokens_input, to: row.tokens_output, tr: row.tokens_reasoning,
        tcr: row.tokens_cache_read, tcw: row.tokens_cache_write,
        cost: row.cost,
      });
    }
  }

  const values = Array.from(buckets.entries()).map(([key, bucket]) => {
    const [hourStr] = key.split("|");
    const start = new Date(hourStr);
    const end = new Date(start.getTime() + 3600000);
    return {
      bucketStart: start,
      bucketEnd: end,
      model: bucket.model,
      agent: bucket.agent,
      tokensInput: bucket.ti,
      tokensOutput: bucket.to,
      tokensReasoning: bucket.tr,
      tokensCacheRead: bucket.tcr,
      tokensCacheWrite: bucket.tcw,
      cost: String(Math.round(bucket.cost * 1000000) / 1000000),
      sessionCount: bucket.count,
    };
  });

  if (values.length > 0) {
    await db.insert(opencodeUsage).values(values).onConflictDoNothing().catch((err) => {
      logger.warn({ err, event: 'opencode_batch_upsert_failed' }, 'OpenCode 批量插入失败');
    });
  }

  logger.info({ sessionCount: rows.length, bucketCount: buckets.size, event: "aggregated" }, `聚合完成: ${rows.length} 会话 → ${buckets.size} 桶`);
}

export async function pollOpenCodeUsage(): Promise<void> {
  markPollerStart('opencode');
  try {
    const api = await getApiConfig();
    let rows: SessionRow[];

    if (api) {
      logger.info({ source: "api", url: api.url, event: "fetch_start" }, "OpenCode: fetching from API");
      rows = await getApiSessions(api);
    } else {
      logger.info({ source: "local", event: "fetch_start" }, "OpenCode: reading from local SQLite");
      rows = getLocalSessions();
    }

    await aggregateAndStore(rows);
    markPollerSuccess('opencode');
  } catch (err) {
    logger.error({ err, event: "etl_failed" }, "OpenCode ETL failed");
    emit({ type: 'opencode_etl_error', error: String(err) });
    markPollerError('opencode', String(err));
  }
}
