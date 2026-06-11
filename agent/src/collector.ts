/**
 * System metrics collector for tf-dashboard agent.
 * Reads Linux /proc filesystem to gather CPU, memory, disk, network, and OS info.
 */

export interface Metrics {
  hostname: string;
  uptime_seconds: number;
  cpu: {
    percent: number;
    load_1m: number;
    load_5m: number;
    load_15m: number;
  };
  memory: {
    total_mb: number;
    used_mb: number;
    available_mb: number;
    percent: number;
  };
  disk: Array<{
    mount: string;
    device: string;
    total_gb: number;
    used_gb: number;
    percent: number;
  }>;
  network: {
    rx_bytes: number;
    tx_bytes: number;
  };
  os: {
    platform: string;
    distro: string;
    kernel: string;
  };
  cpu_info: {
    model: string;
    cores: number;
    threads: number;
  };
  timestamp: string;
}

// CPU stats cache for calculating delta
let prevCpuStats = { idle: 0n, total: 0n };

/**
 * Read a file from the filesystem.
 * Uses fs.readFileSync for /proc virtual files (Bun.file() reports size 0).
 */
function readFile(path: string): string {
  try {
    const { readFileSync } = require("fs");
    return readFileSync(path, "utf-8");
  } catch {
    return "";
  }
}

function readFileLines(path: string): string[] {
  const content = readFile(path);
  return content ? content.trim().split("\n") : [];
}

function getHostname(): string {
  const h = readFile("/proc/sys/kernel/hostname").trim();
  return h || "unknown";
}

function getUptime(): number {
  const uptime = readFile("/proc/uptime").trim();
  if (!uptime) return 0;
  return parseFloat(uptime.split(/\s+/)[0]) || 0;
}

/**
 * Parse /proc/stat for CPU usage.
 * Returns percent and load averages.
 */
function getCpuMetrics(): { percent: number; load_1m: number; load_5m: number; load_15m: number } {
  // Load averages from /proc/loadavg
  const loadavg = readFile("/proc/loadavg").trim();
  let load_1m = 0, load_5m = 0, load_15m = 0;
  if (loadavg) {
    const parts = loadavg.split(/\s+/);
    load_1m = parseFloat(parts[0]) || 0;
    load_5m = parseFloat(parts[1]) || 0;
    load_15m = parseFloat(parts[2]) || 0;
  }

  // CPU percent from /proc/stat
  const statLine = readFileLines("/proc/stat").find(l => l.startsWith("cpu "));
  if (!statLine) return { percent: 0, load_1m, load_5m, load_15m };

  const parts = statLine.split(/\s+/).slice(1).map(s => BigInt(s || "0"));
  if (parts.length < 4) return { percent: 0, load_1m, load_5m, load_15m };

  const idle = parts[3] + (parts[4] || 0n); // idle + iowait
  const total = parts.reduce((a, b) => a + b, 0n);

  if (prevCpuStats.total === 0n) {
    prevCpuStats = { idle, total };
    return { percent: 0, load_1m, load_5m, load_15m };
  }

  const idleDelta = Number(idle - prevCpuStats.idle);
  const totalDelta = Number(total - prevCpuStats.total);
  prevCpuStats = { idle, total };

  const percent = totalDelta > 0 ? Math.round(((totalDelta - idleDelta) / totalDelta) * 100 * 100) / 100 : 0;

  return { percent, load_1m, load_5m, load_15m };
}

/**
 * Parse /proc/meminfo for memory metrics.
 */
function getMemoryMetrics(): { total_mb: number; used_mb: number; available_mb: number; percent: number } {
  const lines = readFileLines("/proc/meminfo");
  let totalKb = 0, availableKb = 0;

  for (const line of lines) {
    if (line.startsWith("MemTotal:")) totalKb = parseInt(line.split(/\s+/)[1]) || 0;
    if (line.startsWith("MemAvailable:")) availableKb = parseInt(line.split(/\s+/)[1]) || 0;
  }

  const totalMb = Math.round(totalKb / 1024);
  const availableMb = Math.round(availableKb / 1024);
  const usedMb = totalMb - availableMb;
  const percent = totalMb > 0 ? Math.round((usedMb / totalMb) * 100 * 100) / 100 : 0;

  return { total_mb: totalMb, used_mb: usedMb, available_mb: availableMb, percent };
}

/**
 * Parse `df` output for disk metrics.
 */
function getDiskMetrics(): Array<{ mount: string; device: string; total_gb: number; used_gb: number; percent: number }> {
  const result = Bun.spawnSync(["df", "-B1", "--exclude-type=tmpfs", "--exclude-type=devtmpfs", "--exclude-type=squashfs", "--exclude-type=overlay"]);
  const output = result.stdout?.toString() || "";
  const lines = output.trim().split("\n").slice(1); // skip header

  const disks: Array<{ mount: string; device: string; total_gb: number; used_gb: number; percent: number }> = [];

  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts.length < 6) continue;
    const device = parts[0];
    const totalBytes = BigInt(parts[1] || "0");
    const usedBytes = BigInt(parts[2] || "0");
    const mount = parts[5];
    const totalGb = Math.round(Number(totalBytes / 1073741824n) * 100) / 100;
    const usedGb = Math.round(Number(usedBytes / 1073741824n) * 100) / 100;
    const percent = totalGb > 0 ? Math.round((usedGb / totalGb) * 100 * 100) / 100 : 0;
    disks.push({ mount, device, total_gb: totalGb, used_gb: usedGb, percent });
  }

  return disks;
}

/**
 * Parse /proc/net/dev for network bytes.
 */
function getNetworkMetrics(): { rx_bytes: number; tx_bytes: number } {
  const lines = readFileLines("/proc/net/dev");
  let rx = 0n, tx = 0n;

  for (const line of lines) {
    // Skip headers and loopback
    if (!line.includes(":") || line.includes("lo:")) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length < 10) continue;
    rx += BigInt(parts[1] || "0");
    tx += BigInt(parts[9] || "0");
  }

  return {
    rx_bytes: Number(rx),
    tx_bytes: Number(tx),
  };
}

/**
 * Get OS info from /etc/os-release and uname.
 */
function getOsInfo(): { platform: string; distro: string; kernel: string } {
  const platform = process.platform;

  // Distro from /etc/os-release
  const osRelease = readFile("/etc/os-release");
  let distro = "unknown";
  const nameMatch = osRelease.match(/^PRETTY_NAME="(.+)"$/m);
  if (nameMatch) {
    distro = nameMatch[1];
  } else {
    const idMatch = osRelease.match(/^ID="?(.+?)"?$/m);
    if (idMatch) distro = idMatch[1];
  }

  // Kernel from uname
  const uname = Bun.spawnSync(["uname", "-r"]);
  const kernel = (uname.stdout?.toString() || "").trim() || "unknown";

  return { platform, distro, kernel };
}

/**
 * Get CPU info from /proc/cpuinfo.
 */
function getCpuInfo(): { model: string; cores: number; threads: number } {
  const lines = readFileLines("/proc/cpuinfo");
  let model = "unknown";
  let threads = 0;
  let coreIds = new Set<string>();

  for (const line of lines) {
    if (line.startsWith("model name")) {
      const m = line.split(":")[1]?.trim();
      if (m) model = m;
    }
    if (line.startsWith("processor")) {
      threads++;
    }
    if (line.startsWith("core id")) {
      const id = line.split(":")[1]?.trim();
      if (id) coreIds.add(id);
    }
  }

  const cores = coreIds.size > 0 ? coreIds.size : threads;

  return { model, cores, threads };
}

/**
 * Collect all system metrics.
 */
export function collectMetrics(): Metrics {
  const cpu = getCpuMetrics();
  const memory = getMemoryMetrics();
  const disk = getDiskMetrics();
  const network = getNetworkMetrics();
  const os = getOsInfo();
  const cpuInfo = getCpuInfo();
  const hostname = getHostname();
  const uptime = getUptime();

  return {
    hostname,
    uptime_seconds: Math.floor(uptime),
    cpu,
    memory,
    disk,
    network,
    os,
    cpu_info: cpuInfo,
    timestamp: new Date().toISOString(),
  };
}
