/**
 * Server metrics poller.
 * Periodically fetches /metrics from each registered server and stores in PostgreSQL.
 */

import { db } from "../db";
import { servers, serverMetrics } from "../db/schema";
import { eq } from "drizzle-orm";

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
function isValidMetricsUrl(url: string): boolean {
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
  try {
    const activeServers = await db.select().from(servers).where(eq(servers.isActive, true));

    for (const server of activeServers) {
      if (!isValidMetricsUrl(server.metricsUrl)) {
        console.warn(`[poller] ${server.name}: blocked SSRF attempt: ${server.metricsUrl}`);
        continue;
      }
      try {
        const resp = await fetch(server.metricsUrl, { signal: AbortSignal.timeout(5000) });
        if (!resp.ok) {
          console.warn(`[poller] ${server.name}: HTTP ${resp.status}`);
          continue;
        }
        const data: ServerMetricsResponse = await resp.json();

        // Sum total disk across all mounts
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

        console.log(`[poller] ${server.name}: OK`);
      } catch (err) {
        console.warn(`[poller] ${server.name}: ${err}`);
      }
    }
  } catch (err) {
    console.error("[poller] failed to fetch server list:", err);
  }
}
