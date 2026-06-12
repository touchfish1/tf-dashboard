import { useState, useEffect, useCallback } from "react";
import type { DeepSeekBalance } from "../types";
import { deepseekApi, settingsApi } from "../api";
import { Button } from "@/components/ui/button";
import { trackAction } from "../lib/tracking";
import { downloadCSV } from "@/lib/export";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { WarningCircle } from "@phosphor-icons/react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Types ───────────────────────────────────────────

interface ChartDataPoint extends DeepSeekBalance {
  balanceTotalNum: number;
  isTopUp: boolean;
}

// ─── Format helpers ──────────────────────────────────

function formatYuan(val: string | number): string {
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "¥0.00";
  return `¥${num.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ─── Custom Tooltip ──────────────────────────────────

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: ChartDataPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl text-sm">
      <p className="text-muted-foreground text-xs mb-1">
        {new Date(data.recordedAt).toLocaleString("zh-CN", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
      <p className="text-card-foreground font-mono font-medium">
        {formatYuan(data.balanceTotal)}
      </p>
      {data.isTopUp && (
        <p className="text-emerald-400 text-xs mt-0.5 flex items-center gap-1">
          <span className="text-[10px]">↑</span> Top-up
        </p>
      )}
    </div>
  );
}

// ─── Top-up Dot ──────────────────────────────────────

function TopUpDot({
  cx,
  cy,
  payload,
}: {
  cx?: number;
  cy?: number;
  payload?: ChartDataPoint;
}) {
  if (!payload?.isTopUp || cx == null || cy == null) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill="#22c55e"
      stroke="#09090b"
      strokeWidth={2}
    />
  );
}

// ─── Balance Card ────────────────────────────────────

function BalanceCard({
  label,
  value,
  large,
}: {
  label: string;
  value: string;
  large?: boolean;
}) {
  return (
    <Card className="transition-colors hover:ring-foreground/20">
      <CardContent className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span
          className={`font-mono text-card-foreground ${
            large ? "text-3xl font-bold" : "text-xl font-semibold"
          }`}
        >
          {value}
        </span>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ──────────────────────────────────

export default function DeepSeekPage() {
  const [balance, setBalance] = useState<DeepSeekBalance | null>(null);
  const [history, setHistory] = useState<DeepSeekBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  const fetchData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      setError(null);
      const [bal, hist] = await Promise.all([
        deepseekApi.balance(),
        deepseekApi.history(30),
      ]);
      setBalance(bal);
      setHistory(hist);
      setLastUpdate(new Date());
    } catch (err) {
      if (!isInitial) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } else {
        setError(err instanceof Error ? err.message : "Failed to load data");
      }
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  // Load key status + initial data
  useEffect(() => {
    settingsApi.get("deepseek_api_key").then((res) => {
      setHasKey(!!res.value);
    }).catch(() => setHasKey(false));
    fetchData(true);
  }, [fetchData]);

  // Auto-refresh every 60 seconds (skip when tab is hidden)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    function start() {
      if (interval) clearInterval(interval);
      interval = setInterval(() => fetchData(false), 60000);
    }
    function stop() {
      if (interval) { clearInterval(interval); interval = null; }
    }
    function onVisibility() {
      if (document.hidden) stop(); else start();
    }
    document.addEventListener("visibilitychange", onVisibility);
    start();
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchData]);

  // ─── Derived state ────────────────────────────────

  const noKeyWarning = hasKey === false;

  // Chart data with top-up detection
  const chartData: ChartDataPoint[] = history.map((item, i) => {
    const prev = i > 0 ? parseFloat(history[i - 1].balanceTotal) : 0;
    const current = parseFloat(item.balanceTotal);
    return {
      ...item,
      balanceTotalNum: current,
      isTopUp: i > 0 && current - prev > 1,
    };
  });

  // ─── Render: Loading ──────────────────────────────

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        {/* Top bar skeleton */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-44" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-28" />
          </div>
        </div>

        {/* Balance cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="flex flex-col gap-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className={i === 0 ? "h-9 w-28" : "h-7 w-20"} />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Chart skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-72 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Render: Error ────────────────────────────────

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="bg-destructive/10 ring-destructive/20">
          <CardContent className="text-destructive text-sm">
            {error}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Render: Empty / No API Key ───────────────────

  if (noKeyWarning) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="bg-amber-500/10 ring-amber-500/30 max-w-lg">
          <CardContent className="flex items-start gap-3">
            <WarningCircle size={20} className="mt-0.5 shrink-0 text-amber-400" />
            <p className="text-sm leading-relaxed text-amber-400">
              未配置 DeepSeek API 密钥，请在设置页面中配置。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Render: Data ─────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">DeepSeek API</h1>
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="secondary" className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </Badge>
          {lastUpdate && (
            <span className="text-muted-foreground tabular-nums">
              updated {formatTime(lastUpdate)}
            </span>
          )}
          <Button
            variant="outline"
            size="xs"
            onClick={() => {
              trackAction("DeepSeek", "导出CSV");
              const rows = history.map((h) => [
                h.recordedAt,
                h.balanceTotal,
                h.balanceGranted,
                h.balanceToppedUp,
              ]);
              downloadCSV("deepseek-balance.csv", ["时间", "总余额", "赠送余额", "充值余额"], rows);
            }}
          >
            导出 CSV
          </Button>
        </div>
      </div>

      {/* ── Balance Cards ── */}
      {balance && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <BalanceCard
          label="总余额"
          value={formatYuan(balance.balanceTotal)}
          large
        />
        <BalanceCard
          label="赠送余额"
          value={formatYuan(balance.balanceGranted)}
        />
        <BalanceCard
          label="充值余额"
          value={formatYuan(balance.balanceToppedUp)}
        />
      </div>
      )}

      {/* ── Balance History Chart ── */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Balance History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient
                      id="balanceGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#27272a"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="recordedAt"
                    tickFormatter={formatDate}
                    stroke="#52525b"
                    tick={{ fill: "#52525b", fontSize: 12 }}
                    axisLine={{ stroke: "#27272a" }}
                    tickLine={false}
                    minTickGap={40}
                  />
                  <YAxis
                    tickFormatter={(v: number) => `¥${v.toFixed(2)}`}
                    stroke="#52525b"
                    tick={{ fill: "#52525b", fontSize: 12 }}
                    axisLine={{ stroke: "#27272a" }}
                    tickLine={false}
                    width={72}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="balanceTotalNum"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fill="url(#balanceGradient)"
                    dot={<TopUpDot />}
                    activeDot={{
                      r: 4,
                      fill: "#8b5cf6",
                      stroke: "#09090b",
                      strokeWidth: 2,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
