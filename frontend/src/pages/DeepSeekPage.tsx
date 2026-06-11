import { useState, useEffect, useCallback } from "react";
import type { DeepSeekBalance } from "../types";
import { deepseekApi, settingsApi } from "../api";
import {
  LineChart,
  Line,
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { WarningCircle } from "@phosphor-icons/react";

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
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 shadow-xl text-sm">
      <p className="text-zinc-400 text-xs mb-1">
        {new Date(data.recordedAt).toLocaleString("zh-CN", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
      <p className="text-zinc-100 font-mono font-medium">
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
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col gap-1 transition-colors hover:border-zinc-700">
      <span className="text-zinc-400 text-sm">{label}</span>
      <span
        className={`font-mono text-zinc-100 ${
          large ? "text-3xl font-bold" : "text-xl font-semibold"
        }`}
      >
        {value}
      </span>
    </div>
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

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchData(false), 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ─── Derived state ────────────────────────────────

  // Directly check settings table for key existence,
  // instead of inferring from balance data (poller may not have run yet).
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
      <div className="flex items-center justify-center h-full text-zinc-400 text-sm">
        Loading...
      </div>
    );
  }

  // ─── Render: Error ────────────────────────────────

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-red-900/20 border border-red-800/30 rounded-lg px-6 py-4 text-red-400 text-sm">
          {error}
        </div>
      </div>
    );
  }

  // ─── Render: Empty / No API Key ───────────────────

  if (noKeyWarning) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3 text-amber-400 max-w-lg">
          <WarningCircle size={20} className="mt-0.5 shrink-0" />
          <p className="text-sm leading-relaxed">
            未配置 DeepSeek API 密钥，请在设置页面中配置。
          </p>
        </div>
      </div>
    );
  }

  // ─── Render: Data ─────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-100">DeepSeek API</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </span>
          {lastUpdate && (
            <span className="text-zinc-500 tabular-nums">
              updated {formatTime(lastUpdate)}
            </span>
          )}
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
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <h2 className="text-sm font-medium text-zinc-300 mb-4">
            Balance History
          </h2>
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
        </div>
      )}
    </div>
  );
}
