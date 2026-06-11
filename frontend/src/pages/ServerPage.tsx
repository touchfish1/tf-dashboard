import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Plus,
  CaretLeft,
  CaretRight,
  HardDriveIcon,
} from "@phosphor-icons/react";
import { serversApi } from "../api";
import type { Server, ServerMetrics, ServerSummary } from "../types";

type TimeRange = "1h" | "24h" | "7d";

const TIME_LIMITS: Record<TimeRange, number> = {
  "1h": 60,
  "24h": 288,
  "7d": 2016,
};

function formatUptime(seconds: number): string {
  if (!seconds || seconds <= 0) return "0m";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

function formatChartTime(iso: string, range: TimeRange): string {
  const d = new Date(iso);
  if (range === "7d") {
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTooltipTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const CHART_TOOLTIP_STYLES: Record<string, React.CSSProperties> = {
  content: {
    backgroundColor: "#18181b",
    border: "1px solid #27272a",
    borderRadius: "8px",
    fontSize: "13px",
  },
  label: { color: "#a1a1aa" },
  item: { color: "#e4e4e7" },
};

// ─── Progress Bar ───────────────────────────────────────────────
function ProgressBar({
  value,
  max,
  color = "bg-blue-500",
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
      <div
        className={`h-full ${color} rounded-full transition-all duration-500`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── Metric Card ────────────────────────────────────────────────
function MetricCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="text-xs text-zinc-500 mb-1 font-medium uppercase tracking-wider">
        {label}
      </div>
      {children}
    </div>
  );
}

// ─── Info Row ───────────────────────────────────────────────────
function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/50 last:border-b-0">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className={`text-xs text-zinc-300 ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}

export default function ServerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [servers, setServers] = useState<Server[]>([]);
  const [metrics, setMetrics] = useState<ServerMetrics[]>([]);
  const [summary, setSummary] = useState<ServerSummary | null>(null);
  const [loadingServers, setLoadingServers] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("1h");

  const selectedId = id ? Number(id) : null;
  const selectedIndex = servers.findIndex((s) => s.id === selectedId);
  const prevServer = selectedIndex > 0 ? servers[selectedIndex - 1] : null;
  const nextServer =
    selectedIndex < servers.length - 1 ? servers[selectedIndex + 1] : null;

  // ── Load server list ─────────────────────────────────────────
  useEffect(() => {
    serversApi
      .list()
      .then((list) => {
        setServers(list);
        setLoadingServers(false);
        if (!selectedId && list.length > 0) {
          navigate(`/server/${list[0].id}`, { replace: true });
        }
        if (list.length === 0) {
          setLoadingServers(false);
        }
      })
      .catch((err) => {
        setError(err.message);
        setLoadingServers(false);
      });
  }, []);

  // ── Load metrics and summary ─────────────────────────────────
  useEffect(() => {
    if (!selectedId) return;

    setLoadingMetrics(true);
    setError(null);

    Promise.all([
      serversApi.metrics(selectedId, TIME_LIMITS[timeRange]),
      serversApi.summary(selectedId),
    ])
      .then(([metricsData, summaryData]) => {
        setMetrics(metricsData);
        setSummary(summaryData);
        setLoadingMetrics(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoadingMetrics(false);
      });
  }, [selectedId, timeRange]);

  const selectedServer = servers.find((s) => s.id === selectedId) ?? null;
  const latestMetrics = metrics.length > 0 ? metrics[metrics.length - 1] : null;
  const chartData = useMemo(() => [...metrics].reverse(), [metrics]);

  // ── Derived values ───────────────────────────────────────────
  const activeServerName = selectedServer?.name ?? "服务器";
  const avgCpu = summary ? parseFloat(summary.avgCpu) : 0;
  const memPct = summary ? parseFloat(summary.latestMem) : 0;
  const diskUsed = summary ? parseFloat(summary.latestDisk) : 0;
  const diskTotal = summary ? parseFloat(summary.totalDisk) : 0;
  const uptimeSeconds = summary?.uptime ?? 0;

  const memUsedGb = latestMetrics
    ? (latestMetrics.memoryUsedMb / 1024).toFixed(1)
    : "0.0";
  const memTotalGb = latestMetrics
    ? (latestMetrics.memoryTotalMb / 1024).toFixed(1)
    : "0.0";

  // ── Initial loading (server list) ────────────────────────────
  if (loadingServers) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400">
          <div className="w-5 h-5 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  // ── No servers ───────────────────────────────────────────────
  if (!loadingServers && servers.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <HardDriveIcon size={48} className="text-zinc-600" />
        <p className="text-zinc-400 text-sm">
          暂无服务器. 请在设置中添加.
        </p>
        <Link
          to="/settings"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
        >
          前往设置
        </Link>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* ── Top Bar ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-zinc-100">Server</h1>
        <div className="flex items-center gap-1 bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
          {(["1h", "24h", "7d"] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors font-medium ${
                timeRange === range
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* ── Server Tabs ──────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 border-b border-zinc-800 mb-5 overflow-x-auto">
        {servers.map((server) => (
          <button
            key={server.id}
            onClick={() => navigate(`/server/${server.id}`)}
            className={`relative px-4 py-2.5 text-sm transition-colors whitespace-nowrap ${
              selectedId === server.id
                ? "bg-zinc-800 text-zinc-100 font-medium"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30"
            }`}
          >
            {server.name}
            {selectedId === server.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
            )}
          </button>
        ))}
        <Link
          to="/settings"
          className="ml-auto flex items-center gap-1 px-3 py-1.5 text-xs text-zinc-500 border border-zinc-700 rounded-md hover:text-zinc-300 hover:border-zinc-500 transition-colors flex-shrink-0"
        >
          <Plus size={14} />
          Add
        </Link>
      </div>

      {/* ── Server Info Line ─────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => prevServer && navigate(`/server/${prevServer.id}`)}
          disabled={!prevServer}
          className="p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous server"
        >
          <CaretLeft size={16} />
        </button>
        <div className="flex items-center gap-2 text-sm text-zinc-400 min-w-0">
          <span className="text-zinc-100 font-medium truncate">
            {activeServerName}
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="shrink-0">Online</span>
          <span className="text-zinc-600 shrink-0">·</span>
          <span className="shrink-0">uptime {formatUptime(uptimeSeconds)}</span>
        </div>
        <button
          onClick={() => nextServer && navigate(`/server/${nextServer.id}`)}
          disabled={!nextServer}
          className="p-1 rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Next server"
        >
          <CaretRight size={16} />
        </button>
      </div>

      {/* ── Metric Cards Row ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* CPU Average */}
        <MetricCard label="CPU 平均">
          {loadingMetrics ? (
            <div className="h-9 flex items-center">
              <div className="w-16 h-5 bg-zinc-800 rounded animate-pulse" />
            </div>
          ) : (
            <div className="font-mono text-2xl text-zinc-100">
              {avgCpu.toFixed(1)}%
            </div>
          )}
        </MetricCard>

        {/* Memory */}
        <MetricCard label="内存">
          {loadingMetrics ? (
            <div className="space-y-2">
              <div className="w-20 h-8 bg-zinc-800 rounded animate-pulse" />
              <div className="w-full h-2 bg-zinc-800 rounded" />
            </div>
          ) : (
            <>
              <div className="font-mono text-2xl text-zinc-100 mb-2">
                {memPct.toFixed(1)}%
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <ProgressBar value={memPct} max={100} color="bg-blue-500" />
                </div>
                <span className="font-mono text-xs text-zinc-500 whitespace-nowrap">
                  {memUsedGb} / {memTotalGb} GB
                </span>
              </div>
            </>
          )}
        </MetricCard>

        {/* Disk */}
        <MetricCard label="磁盘">
          {loadingMetrics ? (
            <div className="space-y-2">
              <div className="w-24 h-8 bg-zinc-800 rounded animate-pulse" />
              <div className="w-full h-2 bg-zinc-800 rounded" />
            </div>
          ) : (
            <>
              <div className="font-mono text-2xl text-zinc-100 mb-2">
                {diskUsed.toFixed(1)} / {diskTotal.toFixed(1)}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <ProgressBar
                    value={diskUsed}
                    max={diskTotal}
                    color="bg-violet-500"
                  />
                </div>
                <span className="font-mono text-xs text-zinc-500 whitespace-nowrap">
                  GB
                </span>
              </div>
            </>
          )}
        </MetricCard>
      </div>

      {/* ── Charts Row ─────────────────────────────────────────── */}
      {!loadingMetrics && chartData.length === 0 && selectedId ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-zinc-500 text-sm">
            暂无指标数据 available for this server.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* CPU Usage Chart */}
          <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-5">
            <h3 className="text-sm font-medium text-zinc-300 mb-4">
              CPU Usage
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  dataKey="collectedAt"
                  tickFormatter={(v: string) => formatChartTime(v, timeRange)}
                  tick={{ fill: "#a1a1aa", fontSize: 12 }}
                  axisLine={{ stroke: "#27272a" }}
                  tickLine={false}
                  minTickGap={40}
                />
                <YAxis
                  tick={{ fill: "#a1a1aa", fontSize: 12 }}
                  axisLine={{ stroke: "#27272a" }}
                  tickLine={false}
                  domain={[0, "auto"]}
                  width={40}
                />
                <Tooltip
                  labelFormatter={(label) =>
                    formatTooltipTime(label as string)
                  }
                  formatter={(value) => [
                    `${Number(value).toFixed(1)}%`,
                    "CPU",
                  ]}
                  contentStyle={CHART_TOOLTIP_STYLES.content}
                  labelStyle={CHART_TOOLTIP_STYLES.label}
                  itemStyle={CHART_TOOLTIP_STYLES.item}
                />
                <Area
                  type="monotone"
                  dataKey="cpuPercent"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#cpuGrad)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: "#10b981" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Memory Usage Chart */}
          <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-5">
            <h3 className="text-sm font-medium text-zinc-300 mb-4">
              Memory Usage
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  dataKey="collectedAt"
                  tickFormatter={(v: string) => formatChartTime(v, timeRange)}
                  tick={{ fill: "#a1a1aa", fontSize: 12 }}
                  axisLine={{ stroke: "#27272a" }}
                  tickLine={false}
                  minTickGap={40}
                />
                <YAxis
                  tick={{ fill: "#a1a1aa", fontSize: 12 }}
                  axisLine={{ stroke: "#27272a" }}
                  tickLine={false}
                  domain={[0, "auto"]}
                  width={40}
                />
                <Tooltip
                  labelFormatter={(label) =>
                    formatTooltipTime(label as string)
                  }
                  formatter={(value) => [
                    `${Number(value).toFixed(1)}%`,
                    "内存",
                  ]}
                  contentStyle={CHART_TOOLTIP_STYLES.content}
                  labelStyle={CHART_TOOLTIP_STYLES.label}
                  itemStyle={CHART_TOOLTIP_STYLES.item}
                />
                <Area
                  type="monotone"
                  dataKey="memoryPercent"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#memGrad)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: "#3b82f6" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Info Row ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Disk Usage Detail */}
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-5">
          <h3 className="text-sm font-medium text-zinc-300 mb-4">
            Disk Usage
          </h3>
          {latestMetrics ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-zinc-400 font-mono">
                    / (root)
                  </span>
                  <span className="text-xs text-zinc-500 font-mono">
                    {diskUsed.toFixed(1)} / {diskTotal.toFixed(1)} GB
                  </span>
                </div>
                <ProgressBar
                  value={diskUsed}
                  max={diskTotal}
                  color="bg-violet-500"
                />
                <div className="mt-1 text-right text-xs text-zinc-600 font-mono">
                  {diskTotal > 0
                    ? ((diskUsed / diskTotal) * 100).toFixed(1)
                    : "0.0"}
                  %
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No disk data available</p>
          )}
        </div>

        {/* System Info */}
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-5">
          <h3 className="text-sm font-medium text-zinc-300 mb-4">
            System Info
          </h3>
          <div>
            <InfoRow label="主机名" value={activeServerName} />
            <InfoRow
              label="运行时间"
              value={formatUptime(uptimeSeconds)}
              mono
            />
            <InfoRow label="操作系统" value="Linux" />
            <InfoRow label="CPU" value="N/A" />
            <InfoRow
              label="内存"
              value={`${memUsedGb} / ${memTotalGb} GB`}
              mono
            />
            <InfoRow
              label="Endpoint"
              value={selectedServer?.metricsUrl ?? "N/A"}
              mono
            />
          </div>
        </div>
      </div>
    </div>
  );
}
