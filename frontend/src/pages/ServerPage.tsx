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
import { cn } from "@/lib/utils";
import { downloadCSV } from "@/lib/export";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
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
    backgroundColor: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    fontSize: "13px",
  },
  label: { color: "var(--muted-foreground)" },
  item: { color: "var(--foreground)" },
};

// ─── Progress Bar ───────────────────────────────────────────────
function ProgressBar({
  value,
  max,
  color = "bg-primary",
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
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
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
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
    <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs text-foreground ${mono ? "font-mono" : ""}`}>
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

  // Overview: summaries for all servers (for health score)
  const [allSummaries, setAllSummaries] = useState<Record<number, ServerSummary>>({});

  // ── Load server list ─────────────────────────────────────────
  useEffect(() => {
    serversApi
      .list()
      .then((list) => {
        setServers(list);
        setLoadingServers(false);
        // Fetch summaries for all servers (for overview / health score)
        const m: Record<number, ServerSummary> = {};
        Promise.allSettled(list.map((s) =>
          serversApi.summary(s.id, 1).then((r) => { m[s.id] = r; }).catch(() => {})
        )).then(() => setAllSummaries(m));
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
        <div className="flex items-center gap-3 text-muted-foreground">
          <Skeleton className="w-5 h-5 rounded-full" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  // ── No servers ───────────────────────────────────────────────
  if (!loadingServers && servers.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <HardDriveIcon size={48} className="text-muted-foreground" />
        <p className="text-muted-foreground text-sm">
          暂无服务器. 请在设置中添加.
        </p>
        <Link to="/settings">
          <Button>前往设置</Button>
        </Link>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-destructive text-sm">{error}</p>
      </div>
    );
  }

  // ── Server overview (no ID selected) ─────────────────────────
  if (!selectedId && servers.length > 0) {
    // Group servers by labels
    const groups = new Map<string, Server[]>();
    groups.set("未分类", []);
    for (const srv of servers) {
      if (srv.labels && srv.labels.length > 0) {
        for (const label of srv.labels) {
          if (!groups.has(label)) groups.set(label, []);
          groups.get(label)!.push(srv);
        }
      } else {
        groups.get("未分类")!.push(srv);
      }
    }

    const calcHealth = (srv: Server): { score: number; color: string } => {
      const sm = allSummaries[srv.id];
      const cpu = sm ? parseFloat(sm.latestCpu) : 0;
      const mem = sm ? parseFloat(sm.latestMem) : 0;
      const disk = sm ? parseFloat(sm.latestDisk) : 0;
      const score = Math.round(
        Math.max(0, 100 - cpu) * 0.4 +
        Math.max(0, 100 - mem) * 0.3 +
        Math.max(0, 100 - Math.min(disk / 500 * 100, 100)) * 0.3
      );
      const color = score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-red-400";
      return { score, color };
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">服务器总览</h1>
          <div className="text-xs text-muted-foreground">
            共 {servers.length} 台服务器
          </div>
        </div>

        {Array.from(groups.entries()).map(([groupName, groupServers]) => (
          groupServers.length === 0 ? null : (
            <Card key={groupName}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {groupName === "未分类" ? (
                    <span className="text-sm font-medium">未分类</span>
                  ) : (
                    <Badge variant="secondary" className="text-xs">{groupName}</Badge>
                  )}
                  <span className="text-xs text-muted-foreground font-normal">{groupServers.length} 台</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {groupServers.map((srv) => {
                    const sm = allSummaries[srv.id];
                    const health = calcHealth(srv);
                    const cpu = sm ? parseFloat(sm.latestCpu) : 0;
                    const mem = sm ? parseFloat(sm.latestMem) : 0;
                    return (
                      <Link
                        key={srv.id}
                        to={`/server/${srv.id}`}
                        className="block rounded-lg border border-border bg-card p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={cn("w-2 h-2 rounded-full shrink-0", srv.isActive ? "bg-emerald-500" : "bg-muted-foreground")} />
                            <span className="text-sm font-medium text-foreground truncate">{srv.name}</span>
                          </div>
                          <span className={cn("text-lg font-bold font-mono", health.color)}>{health.score}</span>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] w-6 text-muted-foreground">CPU</span>
                            <div className="flex-1 h-1 rounded-full bg-border">
                              <div className="h-1 rounded-full transition-all" style={{ width: `${Math.min(cpu, 100)}%`, background: cpu > 80 ? "#ef4444" : cpu > 60 ? "#f59e0b" : "#22c55e" }} />
                            </div>
                            <span className="text-[11px] font-mono w-8 text-right text-muted-foreground">{isNaN(cpu) ? "-" : cpu.toFixed(0) + "%"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] w-6 text-muted-foreground">MEM</span>
                            <div className="flex-1 h-1 rounded-full bg-border">
                              <div className="h-1 rounded-full transition-all" style={{ width: `${Math.min(mem, 100)}%`, background: mem > 80 ? "#ef4444" : mem > 60 ? "#f59e0b" : "#3b82f6" }} />
                            </div>
                            <span className="text-[11px] font-mono w-8 text-right text-muted-foreground">{isNaN(mem) ? "-" : mem.toFixed(0) + "%"}</span>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          {srv.labels?.map((l) => (
                            <span key={l} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{l}</span>
                          ))}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* ── Top Bar ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-foreground">Server</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                const rows = metrics.map((m) => [
                  m.collectedAt,
                  m.cpuPercent, m.memoryPercent,
                  String(m.memoryUsedMb), String(m.memoryTotalMb),
                  m.diskUsedGb, m.diskTotalGb,
                ]);
                downloadCSV("server-metrics.csv",
                  ["时间", "CPU%", "内存%", "内存使用MB", "内存总量MB", "磁盘使用GB", "磁盘总量GB"],
                  rows,
                );
              }}
              disabled={metrics.length === 0}
            >
              导出 CSV
            </Button>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5 border border-border">
          {(["1h", "24h", "7d"] as TimeRange[]).map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setTimeRange(range)}
            >
              {range}
            </Button>
          ))}
          </div>
        </div>
      </div>

      {/* ── Server Tabs ──────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 border-b border-border mb-5 overflow-x-auto">
        {servers.map((server) => (
          <button
            key={server.id}
            onClick={() => navigate(`/server/${server.id}`)}
            className={cn(
              "relative px-4 py-2.5 text-sm transition-colors whitespace-nowrap",
              selectedId === server.id
                ? "bg-muted text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            )}
          >
            {server.name}
            {selectedId === server.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
        <Link to="/settings" className="ml-auto flex-shrink-0">
          <Button variant="outline" size="xs">
            <Plus size={14} />
            Add
          </Button>
        </Link>
      </div>

      {/* ── Server Info Line ─────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => prevServer && navigate(`/server/${prevServer.id}`)}
          disabled={!prevServer}
          aria-label="Previous server"
        >
          <CaretLeft size={16} />
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
          <span className="text-foreground font-medium truncate">
            {activeServerName}
          </span>
          <Badge variant="outline" className="gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            Online
          </Badge>
          <span className="text-muted-foreground/50 shrink-0">·</span>
          <span className="shrink-0">uptime {formatUptime(uptimeSeconds)}</span>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => nextServer && navigate(`/server/${nextServer.id}`)}
          disabled={!nextServer}
          aria-label="Next server"
        >
          <CaretRight size={16} />
        </Button>
      </div>

      {/* ── Metric Cards Row ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* CPU Average */}
        <MetricCard label="CPU 平均">
          {loadingMetrics ? (
            <div className="h-9 flex items-center">
              <Skeleton className="w-16 h-5" />
            </div>
          ) : (
            <div className="font-mono text-2xl text-foreground">
              {avgCpu.toFixed(1)}%
            </div>
          )}
        </MetricCard>

        {/* Memory */}
        <MetricCard label="内存">
          {loadingMetrics ? (
            <div className="space-y-2">
              <Skeleton className="w-20 h-8" />
              <Skeleton className="w-full h-2" />
            </div>
          ) : (
            <>
              <div className="font-mono text-2xl text-foreground mb-2">
                {memPct.toFixed(1)}%
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <ProgressBar value={memPct} max={100} color="bg-chart-2" />
                </div>
                <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
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
              <Skeleton className="w-24 h-8" />
              <Skeleton className="w-full h-2" />
            </div>
          ) : (
            <>
              <div className="font-mono text-2xl text-foreground mb-2">
                {diskUsed.toFixed(1)} / {diskTotal.toFixed(1)}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <ProgressBar
                    value={diskUsed}
                    max={diskTotal}
                    color="bg-chart-3"
                  />
                </div>
                <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                  GB
                </span>
              </div>
            </>
          )}
        </MetricCard>
      </div>

      {/* ── Charts Row ─────────────────────────────────────────── */}
      {!loadingMetrics && chartData.length === 0 && selectedId ? (
        <Card className="mb-6">
          <CardContent className="flex items-center justify-center py-16">
            <p className="text-muted-foreground text-sm">
              暂无指标数据 available for this server.
            </p>
          </CardContent>
        </Card>
      ) : (<>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* CPU Usage Chart */}
          <Card>
            <CardHeader>
              <CardTitle>CPU Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="collectedAt"
                    tickFormatter={(v: string) => formatChartTime(v, timeRange)}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    axisLine={{ stroke: "var(--border)" }}
                    tickLine={false}
                    minTickGap={40}
                  />
                  <YAxis
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    axisLine={{ stroke: "var(--border)" }}
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
            </CardContent>
          </Card>

          {/* Memory Usage Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Memory Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="collectedAt"
                    tickFormatter={(v: string) => formatChartTime(v, timeRange)}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    axisLine={{ stroke: "var(--border)" }}
                    tickLine={false}
                    minTickGap={40}
                  />
                  <YAxis
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    axisLine={{ stroke: "var(--border)" }}
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
            </CardContent>
          </Card>
        </div>

        {/* ── CPU Load & Network I/O ──────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* CPU Load Chart */}
          <Card>
            <CardHeader>
              <CardTitle>CPU Load</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="load1Grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="load5Grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="collectedAt"
                    tickFormatter={(v: string) => formatChartTime(v, timeRange)}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    axisLine={{ stroke: "var(--border)" }}
                    tickLine={false}
                    minTickGap={40}
                  />
                  <YAxis
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    axisLine={{ stroke: "var(--border)" }}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip
                    labelFormatter={(label) => formatTooltipTime(label as string)}
                    formatter={(value) => [Number(value).toFixed(2), "Load"]}
                    contentStyle={CHART_TOOLTIP_STYLES.content}
                    labelStyle={CHART_TOOLTIP_STYLES.label}
                    itemStyle={CHART_TOOLTIP_STYLES.item}
                  />
                  <Area type="monotone" dataKey="cpuLoad1m" stroke="#f59e0b" strokeWidth={1.5} fill="url(#load1Grad)" dot={false} activeDot={{ r: 3, fill: "#f59e0b" }} />
                  <Area type="monotone" dataKey="cpuLoad5m" stroke="#10b981" strokeWidth={1.5} fill="url(#load5Grad)" dot={false} activeDot={{ r: 3, fill: "#10b981" }} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Network I/O Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Network I/O</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="rxGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="txGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="collectedAt"
                    tickFormatter={(v: string) => formatChartTime(v, timeRange)}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    axisLine={{ stroke: "var(--border)" }}
                    tickLine={false}
                    minTickGap={40}
                  />
                  <YAxis
                    tickFormatter={(v: number) => formatBytes(v)}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    axisLine={{ stroke: "var(--border)" }}
                    tickLine={false}
                    width={60}
                  />
                  <Tooltip
                    labelFormatter={(label) => formatTooltipTime(label as string)}
                    formatter={(value) => [formatBytes(value as number), ""]}
                    contentStyle={CHART_TOOLTIP_STYLES.content}
                    labelStyle={CHART_TOOLTIP_STYLES.label}
                    itemStyle={CHART_TOOLTIP_STYLES.item}
                  />
                  <Area type="monotone" dataKey="networkRxBytes" name="RX" stroke="#3b82f6" strokeWidth={1.5} fill="url(#rxGrad)" dot={false} activeDot={{ r: 3, fill: "#3b82f6" }} />
                  <Area type="monotone" dataKey="networkTxBytes" name="TX" stroke="#8b5cf6" strokeWidth={1.5} fill="url(#txGrad)" dot={false} activeDot={{ r: 3, fill: "#8b5cf6" }} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </>)}

      {/* ── Disk & System Info ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Disk Usage Detail */}
        <Card>
          <CardHeader>
            <CardTitle>Disk Usage</CardTitle>
          </CardHeader>
          <CardContent>
            {latestMetrics ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-muted-foreground font-mono">
                      / (root)
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {diskUsed.toFixed(1)} / {diskTotal.toFixed(1)} GB
                    </span>
                  </div>
                  <ProgressBar
                    value={diskUsed}
                    max={diskTotal}
                    color="bg-chart-3"
                  />
                  <div className="mt-1 text-right text-xs text-muted-foreground font-mono">
                    {diskTotal > 0
                      ? ((diskUsed / diskTotal) * 100).toFixed(1)
                      : "0.0"}
                    %
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No disk data available
              </p>
            )}
          </CardContent>
        </Card>

        {/* System Info */}
        <Card>
          <CardHeader>
            <CardTitle>System Info</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
