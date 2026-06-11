import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { opencodeApi, deepseekApi, serversApi, linksApi } from "../api";
import type { OpenCodeUsage, OpenCodeSummary, OpenCodeByModel, DeepSeekBalance, Server, ServerSummary, NavLink } from "../types";

const PIE = ["#ec4899", "#06b6d4", "#a78bfa", "#f472b6", "#fbbf24", "#34d399"];
const LINK_COLORS = ["#ec4899", "#06b6d4", "#a78bfa", "#f472b6", "#fbbf24", "#34d399", "#60a5fa", "#f97316"];
const DAYS = [
  { label: "24h", value: 1 },
  { label: "7d", value: 7 },
  { label: "30d", value: 30 },
];

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}
function $c(v: string) { const n = parseFloat(v); return isNaN(n) ? "$0" : n >= 1 ? "$" + n.toFixed(2) : "$" + n.toFixed(4); }
function yuan(v: string) { const n = parseFloat(v); return isNaN(n) ? "¥0" : "¥" + n.toFixed(2); }
function dd(iso: string) { const d = new Date(iso); return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "早上好";
  if (h >= 12 && h < 18) return "下午好";
  return "晚上好";
}

function getTimeStr(): string {
  return new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

export default function DashboardPage() {
  const [days, setDays] = useState(7);
  const [time, setTime] = useState(getTimeStr);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<OpenCodeSummary | null>(null);
  const [usage, setUsage] = useState<OpenCodeUsage[]>([]);
  const [byModel, setByModel] = useState<OpenCodeByModel[]>([]);
  const [balance, setBalance] = useState<DeepSeekBalance | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [ss, setSs] = useState<Record<number, ServerSummary>>({});
  const [links, setLinks] = useState<NavLink[]>([]);

  // ── Clock tick ──
  useEffect(() => {
    const id = setInterval(() => setTime(getTimeStr()), 30_000);
    return () => clearInterval(id);
  }, []);

  // ── Data fetch ──
  useEffect(() => {
    let cancel = false;
    setLoading(true);
    (async () => {
      try {
        const [s, u, bm, bal, sl, lk] = await Promise.all([
          opencodeApi.summary(), opencodeApi.usage(days), opencodeApi.byModel(days),
          deepseekApi.balance(), serversApi.list(), linksApi.list(),
        ]);
        if (cancel) return;
        setSummary(s); setUsage(u); setByModel(bm); setBalance(bal); setServers(sl); setLinks(lk);
        const m: Record<number, ServerSummary> = {};
        await Promise.allSettled(sl.map(srv => serversApi.summary(srv.id, 1).then(r => { m[srv.id] = r; }).catch(() => {})));
        if (!cancel) setSs(m);
      } catch {} finally { if (!cancel) setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [days]);

  // ── Memoized chart data ──
  const chartData = useMemo(() => {
    const m = new Map<string, { d: string; i: number; o: number }>();
    for (const r of usage) {
      const k = r.bucketStart.slice(0, 10);
      let e = m.get(k);
      if (!e) { e = { d: k, i: 0, o: 0 }; m.set(k, e); }
      e.i += r.tokensInput; e.o += r.tokensOutput;
    }
    return [...m.values()].sort((a, b) => a.d.localeCompare(b.d));
  }, [usage]);

  const pieData = useMemo(() => byModel.map(m => ({ ...m, cv: parseFloat(m.cost) })), [byModel]);

  // ── Derived display values ──
  const totalCost = summary ? $c(summary.totalCost) : "-";
  const totalInput = summary ? fmt(summary.totalInput) : "-";
  const totalOutput = summary ? fmt(summary.totalOutput) : "-";
  const balanceStr = balance ? yuan(balance.balanceTotal) : "-";
  const balancePositive = balance && parseFloat(balance.balanceTotal) > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: "60vh" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 animate-spin"
            style={{ borderColor: "var(--color-border)", borderTopColor: "var(--color-accent)" }} />
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* ════════════════════════════════════════════
          1. Top Bar: Greeting + Time + Days Selector
          ════════════════════════════════════════════ */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            {getGreeting()}，
          </span>
          <span className="text-sm font-mono" style={{ color: "var(--color-text-muted)" }}>
            {time}
          </span>
        </div>
        <div className="flex gap-0.5 rounded-lg p-0.5" style={{ background: "var(--color-surface-raised)" }}>
          {DAYS.map(d => (
            <button key={d.value} onClick={() => setDays(d.value)}
              className="px-3 py-1.5 text-xs rounded-md transition-colors"
              style={{
                color: days === d.value ? "var(--color-text-primary)" : "var(--color-text-muted)",
                background: days === d.value ? "var(--color-accent)" : "transparent",
                fontWeight: days === d.value ? 500 : 400,
              }}>{d.label}</button>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════
          2. Navigation Links Grid (visual focal point)
          ════════════════════════════════════════════ */}
      <section>
        {links.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed p-10 text-center transition-colors"
            style={{ borderColor: "var(--color-border)" }}>
            <p className="text-sm mb-3" style={{ color: "var(--color-text-muted)" }}>暂无常用链接</p>
            <Link to="/settings"
              className="inline-flex items-center gap-1 text-xs rounded-lg px-4 py-2 transition-colors"
              style={{
                color: "var(--color-accent)",
                background: "var(--color-surface-raised)",
              }}>
              添加常用链接
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {links.map((link, i) => {
              const color = LINK_COLORS[i % LINK_COLORS.length];
              const letter = link.title.charAt(0).toUpperCase();
              return (
                <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                  className="group rounded-xl p-4 text-center transition-all duration-200"
                  style={{ background: "var(--color-surface-raised)" }}>
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2.5 text-sm font-semibold transition-transform duration-200 group-hover:scale-110"
                    style={{ background: `${color}1a`, color }}
                  >
                    {letter}
                  </div>
                  <span className="text-xs leading-tight block" style={{ color: "var(--color-text-secondary)" }}>
                    {link.title}
                  </span>
                </a>
              );
            })}
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════
          3. Stats Row (compact pills)
          ════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg px-4 py-3" style={{ background: "var(--color-surface-elevated)" }}>
          <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>总费用</span>
          <span className="text-base font-mono font-semibold mt-1 block" style={{ color: "var(--color-accent)" }}>{totalCost}</span>
        </div>
        <div className="rounded-lg px-4 py-3" style={{ background: "var(--color-surface-elevated)" }}>
          <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>输入 Token</span>
          <span className="text-base font-mono font-semibold mt-1 block" style={{ color: "var(--color-text-primary)" }}>{totalInput}</span>
        </div>
        <div className="rounded-lg px-4 py-3" style={{ background: "var(--color-surface-elevated)" }}>
          <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>输出 Token</span>
          <span className="text-base font-mono font-semibold mt-1 block" style={{ color: "var(--color-text-primary)" }}>{totalOutput}</span>
        </div>
        <div className="rounded-lg px-4 py-3" style={{ background: "var(--color-surface-elevated)" }}>
          <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>DeepSeek 余额</span>
          <span className="text-base font-mono font-semibold mt-1 block"
            style={{ color: balancePositive ? "var(--color-accent)" : "var(--color-text-muted)" }}>{balanceStr}</span>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          4. Charts Row (2-col)
          ════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Left: Area Chart */}
        <div className="lg:col-span-2 rounded-lg p-5" style={{ background: "var(--color-surface-elevated)" }}>
          <h2 className="text-xs font-medium mb-4" style={{ color: "var(--color-text-secondary)" }}>用量趋势</h2>
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-xs" style={{ color: "var(--color-text-muted)" }}>暂无数据</div>
          ) : (
            <ResponsiveContainer width="100%" height={192}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="ig" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ec4899" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#ec4899" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="og" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="d" tickFormatter={dd} tick={{ fill: "#5c5c66", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={fmt} tick={{ fill: "#5c5c66", fontSize: 11 }} tickLine={false} axisLine={false} width={50} />
                <Tooltip contentStyle={{ background: "#121214", border: "1px solid #1e1e22", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="i" stroke="#ec4899" strokeWidth={1.5} fill="url(#ig)" />
                <Area type="monotone" dataKey="o" stroke="#06b6d4" strokeWidth={1.5} fill="url(#og)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Right: Pie Chart */}
        <div className="rounded-lg p-5" style={{ background: "var(--color-surface-elevated)" }}>
          <h2 className="text-xs font-medium mb-4" style={{ color: "var(--color-text-secondary)" }}>各模型费用</h2>
          {pieData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-xs" style={{ color: "var(--color-text-muted)" }}>暂无数据</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} dataKey="cv" nameKey="model" cx="50%" cy="50%" innerRadius={36} outerRadius={64} paddingAngle={2}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#121214", border: "1px solid #1e1e22", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: any) => [`$${(v as number).toFixed(4)}`, ""]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {pieData.slice(0, 5).map((m, i) => (
                  <div key={m.model} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE[i % PIE.length] }} />
                      <span className="truncate" style={{ color: "var(--color-text-secondary)" }}>{m.model.split("/").pop()}</span>
                    </div>
                    <span className="font-mono shrink-0 ml-2" style={{ color: "var(--color-text-primary)" }}>{$c(m.cost)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════
          5. Server Status Row
          ════════════════════════════════════════════ */}
      {servers.length > 0 && (
        <div className="rounded-lg p-5" style={{ background: "var(--color-surface-elevated)" }}>
          <h2 className="text-xs font-medium mb-3" style={{ color: "var(--color-text-secondary)" }}>服务器状态</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {servers.map(srv => {
              const sm = ss[srv.id];
              return (
                <div key={srv.id} className="rounded-lg p-3" style={{ background: "var(--color-surface)" }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full"
                      style={{ background: srv.isActive ? "var(--color-accent)" : "var(--color-text-muted)" }} />
                    <span className="text-xs font-medium truncate" style={{ color: "var(--color-text-primary)" }}>{srv.name}</span>
                  </div>
                  <div className="space-y-1.5">
                    <MiniBar label="CPU" value={sm?.latestCpu || "0"} color="var(--color-accent)" />
                    <MiniBar label="MEM" value={sm?.latestMem || "0"} color="#06b6d4" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

function MiniBar({ label, value, color }: { label: string; value: string; color: string }) {
  const pct = Math.min(parseFloat(value), 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] w-6" style={{ color: "var(--color-text-muted)" }}>{label}</span>
      <div className="flex-1 h-1 rounded-full" style={{ background: "var(--color-border)" }}>
        <div className="h-1 rounded-full transition-all"
          style={{ width: `${isNaN(pct) ? 0 : pct}%`, background: color }} />
      </div>
      <span className="text-[11px] font-mono w-8 text-right"
        style={{ color: "var(--color-text-secondary)" }}>{isNaN(pct) ? "-" : pct.toFixed(0) + "%"}</span>
    </div>
  );
}
