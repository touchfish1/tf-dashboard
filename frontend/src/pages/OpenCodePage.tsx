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
import { opencodeApi } from "../api";
import type { OpenCodeUsage } from "../types";

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
    <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
        {titleRight}
      </div>
      {children}
    </div>
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
    <th
      onClick={onClick}
      className="py-2.5 px-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer select-none hover:text-zinc-300 transition-colors"
    >
      <span className="inline-flex items-center gap-1">
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
    </th>
  );
}

// ─── State Visuals ───────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-6 bg-zinc-950">
      <div className="flex items-center justify-between">
        <div className="h-7 w-44 bg-zinc-800 rounded-md animate-pulse" />
        <div className="h-7 w-28 bg-zinc-800 rounded-lg animate-pulse" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-[350px] bg-zinc-900/30 border border-zinc-800 rounded-xl animate-pulse" />
        <div className="h-[350px] bg-zinc-900/30 border border-zinc-800 rounded-xl animate-pulse" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-[370px] bg-zinc-900/30 border border-zinc-800 rounded-xl animate-pulse" />
        <div className="h-[370px] bg-zinc-900/30 border border-zinc-800 rounded-xl animate-pulse" />
      </div>
      <div className="h-[420px] bg-zinc-900/30 border border-zinc-800 rounded-xl animate-pulse" />
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
    <div className="p-6 bg-zinc-950">
      <div className="flex flex-col items-center justify-center h-96 gap-3">
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ef4444"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="text-sm text-zinc-400 max-w-md text-center">{message}</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 text-xs font-medium rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-6 bg-zinc-950">
      <div className="flex flex-col items-center justify-center h-96 gap-3">
        <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#71717a"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <p className="text-sm text-zinc-500">
          暂无用量数据 for the selected period.
        </p>
        <p className="text-xs text-zinc-600">
          请尝试更长的时间范围 or 检查数据源.
        </p>
      </div>
    </div>
  );
}

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
      .usage(days)
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
    <div className="p-6 space-y-6 bg-zinc-950">
      {/* ── Top Bar ─────────────────────────────── */}
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-100">OpenCode Usage</h1>
        <div className="flex gap-1 bg-zinc-900 rounded-lg p-0.5">
          {([7, 30, 90] as TimeRange[]).map((d) => (
            <button
              key={d}
              onClick={() => handleTimeRange(d)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                days === d
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {d}d
            </button>
          ))}
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
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="label"
                stroke="#71717a"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: "#27272a" }}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#71717a"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatTokens}
              />
              <Tooltip
                contentStyle={{
                  background: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: 8,
                  fontSize: 12,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                }}
                labelStyle={{ color: "#e4e4e7", marginBottom: 4 }}
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
                stroke="#27272a"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                stroke="#71717a"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: "#27272a" }}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#71717a"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `$${v.toFixed(2)}`}
              />
              <Tooltip
                contentStyle={{
                  background: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: 8,
                  fontSize: 12,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                }}
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
                stroke="#27272a"
                horizontal={false}
              />
              <XAxis
                type="number"
                stroke="#71717a"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `$${v.toFixed(2)}`}
              />
              <YAxis
                type="category"
                dataKey="agent"
                stroke="#d4d4d8"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={120}
              />
              <Tooltip
                contentStyle={{
                  background: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: 8,
                  fontSize: 12,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                }}
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
                <div className="text-xs text-zinc-500 mb-1">Cache Read</div>
                <div className="text-sm font-semibold text-emerald-400 font-mono">
                  {formatTokens(cacheMetrics.read)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-zinc-500 mb-1">Cache Write</div>
                <div className="text-sm font-semibold text-zinc-300 font-mono">
                  {formatTokens(cacheMetrics.write)}
                </div>
              </div>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* ── Row 3: Sessions Table ──────────────── */}
      <ChartCard
        title="会话"
        titleRight={
          <span className="text-xs text-zinc-500">
            {sortedData.length} session
            {sortedData.length !== 1 ? "s" : ""}
          </span>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                {TABLE_COLUMNS.map((col) => (
                  <SortableTh
                    key={col.key}
                    label={col.label}
                    active={sortKey === col.key}
                    dir={sortKey === col.key ? sortDir : null}
                    onClick={() => handleSort(col.key)}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {pageData.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors"
                >
                  <td className="py-2.5 px-3 text-zinc-300 whitespace-nowrap">
                    {formatDateTime(row.bucketStart)}
                  </td>
                  <td className="py-2.5 px-3 text-zinc-300">{row.model}</td>
                  <td className="py-2.5 px-3 text-zinc-300">{row.agent}</td>
                  <td className="py-2.5 px-3 text-zinc-400 text-right font-mono tabular-nums">
                    {formatTokens(row.tokensInput)}
                  </td>
                  <td className="py-2.5 px-3 text-zinc-400 text-right font-mono tabular-nums">
                    {formatTokens(row.tokensOutput)}
                  </td>
                  <td className="py-2.5 px-3 text-zinc-300 text-right font-mono tabular-nums">
                    {formatCost(row.cost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-800">
          <span className="text-xs text-zinc-500">
            Page {page + 1} of {pageCount}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </ChartCard>
    </div>
  );
}
