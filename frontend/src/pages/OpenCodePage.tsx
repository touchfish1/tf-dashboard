import { useState, useEffect, useMemo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ArrowDown } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { downloadCSV } from "@/lib/export";
import { opencodeApi } from "../api";
import type { OpenCodeUsage } from "../types";

// ─── shadcn components ───────────────────────────

import { Card, CardHeader, CardTitle, CardContent, CardAction } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Helpers ─────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatCost(cost: string | number): string {
  const num = typeof cost === "string" ? parseFloat(cost) : cost;
  return `$${num.toFixed(2)}`;
}

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// ─── Types ───────────────────────────────────────

type TimeRange = 7 | 30 | 90;
type SortKey =
  | "bucketStart"
  | "model"
  | "agent"
  | "tokensInput"
  | "tokensOutput"
  | "cost";
type SortDir = "asc" | "desc";

// ─── Reusable Sub-Components ─────────────────────

function ChartCard({
  title,
  titleRight,
  children,
}: {
  title: string;
  titleRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {titleRight && <CardAction>{titleRight}</CardAction>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function CacheGauge({ ratio }: { ratio: number }) {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const hitLength = circumference * ratio;

  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      {/* Background ring */}
      <circle
        cx="70"
        cy="70"
        r={radius}
        fill="none"
        stroke="#3f3f46"
        strokeWidth="10"
      />
      {/* Hit arc */}
      <circle
        cx="70"
        cy="70"
        r={radius}
        fill="none"
        stroke="#10b981"
        strokeWidth="10"
        strokeDasharray={`${hitLength} ${circumference}`}
        strokeLinecap="round"
        transform="rotate(-90 70 70)"
        className="transition-all duration-700 ease-out"
      />
      {/* Label */}
      <text
        x="70"
        y="64"
        textAnchor="middle"
        className="fill-zinc-100"
        fontSize="28"
        fontWeight="700"
        fontFamily="Geist, system-ui, sans-serif"
        dominantBaseline="central"
      >
        {(ratio * 100).toFixed(1)}%
      </text>
      <text
        x="70"
        y="84"
        textAnchor="middle"
        className="fill-zinc-500"
        fontSize="11"
        fontFamily="Geist, system-ui, sans-serif"
      >
        hit ratio
      </text>
    </svg>
  );
}

const TABLE_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "bucketStart", label: "时间" },
  { key: "model", label: "模型" },
  { key: "agent", label: "Agent" },
  { key: "tokensInput", label: "输入" },
  { key: "tokensOutput", label: "输出" },
  { key: "cost", label: "费用" },
];

function SortableTh({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir | null;
  onClick: () => void;
}) {
  return (
    <TableHead
      onClick={onClick}
      className="cursor-pointer select-none text-muted-foreground hover:text-foreground transition-colors"
    >
      <span className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider">
        {label}
        {active && dir && (
          <ArrowDown
            size={12}
            weight="bold"
            className={`transition-transform duration-200 ${
              dir === "asc" ? "rotate-180" : ""
            }`}
          />
        )}
      </span>
    </TableHead>
  );
}

// ─── State Visuals ───────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Top bar skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-7 w-28 rounded-lg" />
      </div>
      {/* Row 1: Token Usage + Cost Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
      {/* Row 2: Cost by Agent + Cache Hit Ratio */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-[320px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-[320px] w-full" />
          </CardContent>
        </Card>
      </div>
      {/* Table skeleton */}
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-[420px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-destructive"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            {message}
          </p>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">
            暂无用量数据 for the selected period.
          </p>
          <p className="text-xs text-muted-foreground/60">
            请尝试更长的时间范围 or 检查数据源.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Themed tooltip style ────────────────────────

const tooltipContentStyle: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
};

const tooltipLabelStyle: React.CSSProperties = {
  color: "var(--foreground)",
  marginBottom: 4,
};

// ─── Main Component ──────────────────────────────

export default function OpenCodePage() {
  const [days, setDays] = useState<TimeRange>(7);
  const [data, setData] = useState<OpenCodeUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir | null>(null);
  const [page, setPage] = useState(0);

  const PAGE_SIZE = 10;

  useEffect(() => {
    setLoading(true);
    setError(null);
    setPage(0);
    opencodeApi
      .usageRaw(days, 200)
      .then((res) => setData(res))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [days, retry]);

  // ── Derived data ─────────────────────────────

  const dailyData = useMemo(() => {
    const map = new Map<
      string,
      {
        day: string;
        label: string;
        tokensInput: number;
        tokensOutput: number;
        tokensReasoning: number;
        cost: number;
      }
    >();
    for (const row of data) {
      const day = row.bucketStart.slice(0, 10);
      let entry = map.get(day);
      if (!entry) {
        entry = {
          day,
          label: formatDateLabel(day),
          tokensInput: 0,
          tokensOutput: 0,
          tokensReasoning: 0,
          cost: 0,
        };
        map.set(day, entry);
      }
      entry.tokensInput += row.tokensInput;
      entry.tokensOutput += row.tokensOutput;
      entry.tokensReasoning += row.tokensReasoning;
      entry.cost += parseFloat(row.cost);
    }
    return [...map.values()].sort((a, b) => a.day.localeCompare(b.day));
  }, [data]);

  const agentData = useMemo(() => {
    const map = new Map<string, { agent: string; cost: number }>();
    for (const row of data) {
      const agent = row.agent || "Unknown";
      let entry = map.get(agent);
      if (!entry) {
        entry = { agent, cost: 0 };
        map.set(agent, entry);
      }
      entry.cost += parseFloat(row.cost);
    }
    return [...map.values()]
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 8);
  }, [data]);

  const cacheMetrics = useMemo(() => {
    let read = 0;
    let write = 0;
    for (const row of data) {
      read += row.tokensCacheRead;
      write += row.tokensCacheWrite;
    }
    const total = read + write;
    return { read, write, total, ratio: total > 0 ? read / total : 0 };
  }, [data]);

  // ── Sort & paginate ──────────────────────────

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDir) return data;
    return [...data].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "bucketStart":
          cmp = a.bucketStart.localeCompare(b.bucketStart);
          break;
        case "model":
          cmp = a.model.localeCompare(b.model);
          break;
        case "agent":
          cmp = a.agent.localeCompare(b.agent);
          break;
        case "tokensInput":
          cmp = a.tokensInput - b.tokensInput;
          break;
        case "tokensOutput":
          cmp = a.tokensOutput - b.tokensOutput;
          break;
        case "cost":
          cmp = parseFloat(a.cost) - parseFloat(b.cost);
          break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [data, sortKey, sortDir]);

  const pageCount = Math.ceil(sortedData.length / PAGE_SIZE);
  const pageData = sortedData.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE,
  );

  const handleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey(null);
      setSortDir(null);
    }
    setPage(0);
  };

  const handleTimeRange = (d: TimeRange) => {
    setDays(d);
    setPage(0);
  };

  // ── Guard clauses ────────────────────────────

  if (loading) return <LoadingSkeleton />;
  if (error)
    return <ErrorState message={error} onRetry={() => setRetry((c) => c + 1)} />;
  if (data.length === 0) return <EmptyState />;

  // ── Render ───────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Top Bar ─────────────────────────────── */}
      <header className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-foreground">OpenCode Usage</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="xs"
            onClick={() => {
              const rows = data.map((r) => [
                r.bucketStart, r.model, r.agent,
                String(r.tokensInput), String(r.tokensOutput), String(r.tokensReasoning),
                r.cost, String(r.sessionCount),
              ]);
              downloadCSV("opencode-usage.csv",
                ["时间", "模型", "Agent", "输入Token", "输出Token", "推理Token", "费用", "会话数"],
                rows,
              );
            }}
          >
            导出 CSV
          </Button>
          <div className="inline-flex gap-1 bg-muted rounded-lg p-0.5">
          {([7, 30, 90] as TimeRange[]).map((d) => (
            <Button
              key={d}
              variant={days === d ? "secondary" : "ghost"}
              size="xs"
              onClick={() => handleTimeRange(d)}
            >
              {d}d
            </Button>
          ))}
          </div>
        </div>
      </header>

      {/* ── Row 1: Token Usage + Cost Trend ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Token Usage (Daily) */}
        <ChartCard title="每日用量">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="inputArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="outputArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="reasonArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="label"
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatTokens}
              />
              <Tooltip
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={{ padding: "2px 0" }}
                formatter={(value: any) => formatTokens(value)}
              />
              <Area
                name="输入"
                type="monotone"
                dataKey="tokensInput"
                stackId="1"
                stroke="#3b82f6"
                strokeWidth={1.5}
                fill="url(#inputArea)"
              />
              <Area
                name="输出"
                type="monotone"
                dataKey="tokensOutput"
                stackId="1"
                stroke="#8b5cf6"
                strokeWidth={1.5}
                fill="url(#outputArea)"
              />
              <Area
                name="Reasoning"
                type="monotone"
                dataKey="tokensReasoning"
                stackId="1"
                stroke="#f59e0b"
                strokeWidth={1.5}
                fill="url(#reasonArea)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Cost Trend */}
        <ChartCard title="费用趋势">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyData}>
              <defs>
                <linearGradient id="costBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `$${v.toFixed(2)}`}
              />
              <Tooltip
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                formatter={(value: any) => `$${(value ?? 0).toFixed(2)}`}
              />
              <Bar
                dataKey="cost"
                fill="url(#costBar)"
                radius={[3, 3, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── Row 2: Cost by Agent + Cache Hit Ratio ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost by Agent */}
        <ChartCard title="各 Agent 费用">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={agentData}
              layout="vertical"
              margin={{ left: 8, right: 8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                horizontal={false}
              />
              <XAxis
                type="number"
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `$${v.toFixed(2)}`}
              />
              <YAxis
                type="category"
                dataKey="agent"
                stroke="var(--foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={120}
              />
              <Tooltip
                contentStyle={tooltipContentStyle}
                formatter={(value: any) => `$${(value ?? 0).toFixed(2)}`}
              />
              <Bar
                dataKey="cost"
                radius={[0, 3, 3, 0]}
                maxBarSize={20}
              >
                {agentData.map((_, idx) => (
                  <Cell
                    key={idx}
                    fill={`hsl(${215 - idx * 18}, 65%, ${58 - idx * 4}%)`}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Cache Hit Ratio */}
        <ChartCard title="缓存命中率">
          <div className="flex flex-col items-center justify-center h-[320px]">
            <CacheGauge ratio={cacheMetrics.ratio} />
            <div className="mt-4 grid grid-cols-2 gap-8">
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Cache Read</div>
                <div className="text-sm font-semibold text-emerald-400 font-mono">
                  {formatTokens(cacheMetrics.read)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Cache Write</div>
                <div className="text-sm font-semibold text-foreground font-mono">
                  {formatTokens(cacheMetrics.write)}
                </div>
              </div>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* ── Row 3: Sessions Table ──────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>会话</CardTitle>
          <CardAction>
            <Badge variant="outline" className="font-mono">
              {sortedData.length} session
              {sortedData.length !== 1 ? "s" : ""}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {TABLE_COLUMNS.map((col) => (
                  <SortableTh
                    key={col.key}
                    label={col.label}
                    active={sortKey === col.key}
                    dir={sortKey === col.key ? sortDir : null}
                    onClick={() => handleSort(col.key)}
                  />
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageData.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {formatDateTime(row.bucketStart)}
                  </TableCell>
                  <TableCell className="text-foreground">{row.model}</TableCell>
                  <TableCell className="text-foreground">{row.agent}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                    {formatTokens(row.tokensInput)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                    {formatTokens(row.tokensOutput)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-foreground">
                    {formatCost(row.cost)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-border px-(--card-spacing) py-(--card-spacing)">
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {pageCount}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
