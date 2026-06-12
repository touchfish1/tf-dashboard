import { db } from "../db";
import { servers, serverMetrics } from "../db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { emit } from "../lib/event-bus";
import { markPollerStart, markPollerSuccess, markPollerError } from "../lib/poller-health";

interface ServerMetricsResponse {
  hostname: string;
  uptime_seconds: number;
  cpu: { percent: number; load_1m: number; load_5m: number; load_15m: number };
  memory: { total_mb: number; used_mb: number; available_mb: number; percent: number };
  disk: Array<{ mount: string; device: string; total_gb: number; used_gb: number; percent: number }>;
  network: { rx_bytes: number; tx_bytes: number };
  timestamp: string;
}

/**
 * SSRF protection: validate metrics URL before fetching.
 * Allows http/https only, blocks cloud metadata endpoints.
 * localhost/private IPs are allowed (admin-configured, not user input).
 */
export function isValidMetricsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    if (parsed.hostname === "169.254.169.254") return false;
    return true;
  } catch {
    return false;
  }
}

export async function pollAllServers(): Promise<void> {
  markPollerStart('servers');
  try {
    const activeServers = await db.select().from(servers).where(eq(servers.isActive, true));

    await Promise.allSettled(activeServers.map(async (server) => {
      if (!isValidMetricsUrl(server.metricsUrl)) {
        logger.warn({ server: server.name, url: server.metricsUrl, event: "ssrf_blocked" }, "SSRF拦截");
        return;
      }
      try {
        const resp = await fetch(server.metricsUrl, { signal: AbortSignal.timeout(5000) });
        if (!resp.ok) {
          logger.warn({ server: server.name, status: resp.status, event: "http_error" }, `HTTP ${resp.status}`);
          return;
        }
        const data: ServerMetricsResponse = await resp.json();

        const totalDiskGb = data.disk.reduce((sum, d) => sum + d.total_gb, 0);
        const usedDiskGb = data.disk.reduce((sum, d) => sum + d.used_gb, 0);

        await db.insert(serverMetrics).values({
          serverId: server.id,
          cpuPercent: String(data.cpu.percent),
          cpuLoad1m: String(data.cpu.load_1m),
          cpuLoad5m: String(data.cpu.load_5m),
          cpuLoad15m: String(data.cpu.load_15m),
          memoryUsedMb: data.memory.used_mb,
          memoryTotalMb: data.memory.total_mb,
          memoryPercent: String(data.memory.percent),
          diskTotalGb: String(Math.round(totalDiskGb * 100) / 100),
          diskUsedGb: String(Math.round(usedDiskGb * 100) / 100),
          networkRxBytes: data.network.rx_bytes,
          networkTxBytes: data.network.tx_bytes,
          uptimeSeconds: data.uptime_seconds,
        });

        logger.info({ server: server.name, cpu: data.cpu.percent, memory: data.memory.percent, event: "metrics_collected" }, `${server.name}: 采集成功`);
        emit({ type: 'server_metrics', serverId: server.id, serverName: server.name, cpuPercent: data.cpu.percent, memoryPercent: data.memory.percent, isOnline: true });
      } catch (err) {
        logger.warn({ server: server.name, err, event: "fetch_failed" }, `${server.name}: ${err}`);
        emit({ type: 'server_offline', serverId: server.id, serverName: server.name });
      }
    }));
    markPollerSuccess('servers');
  } catch (err) {
    logger.error({ err, event: "poller_failed" }, "获取服务器列表失败");
    markPollerError('servers', String(err));
  }
}
