import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { opencodeApi, deepseekApi, serversApi, linksApi, dashboardConfigApi } from "../api";
import type { OpenCodeDailyUsage, OpenCodeSummary, OpenCodeByModel, DeepSeekBalance, Server, ServerSummary, NavLink, DashboardConfig } from "../types";
import DashboardConfigPanel from "@/components/DashboardConfig";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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

function MiniBar({ label, value, color }: { label: string; value: string; color: string }) {
  const pct = Math.min(parseFloat(value), 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] w-6 text-muted-foreground">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-border">
        <div className="h-1 rounded-full transition-all"
          style={{ width: `${isNaN(pct) ? 0 : pct}%`, background: color }} />
      </div>
      <span className="text-[11px] font-mono w-8 text-right text-muted-foreground">
        {isNaN(pct) ? "-" : pct.toFixed(0) + "%"}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const [days, setDays] = useState(7);
  const [time, setTime] = useState(getTimeStr);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<OpenCodeSummary | null>(null);
  const [usage, setUsage] = useState<OpenCodeDailyUsage[]>([]);
  const [byModel, setByModel] = useState<OpenCodeByModel[]>([]);
  const [balance, setBalance] = useState<DeepSeekBalance | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [ss, setSs] = useState<Record<number, ServerSummary>>({});
  const [links, setLinks] = useState<NavLink[]>([]);
  const [cfg, setCfg] = useState<DashboardConfig | null>(null);

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

  // ── Load dashboard config ──
  useEffect(() => {
    dashboardConfigApi.get().then(setCfg);
  }, []);

  const sectionVisible = (id: string): boolean => {
    return cfg?.sections.find((s) => s.id === id)?.visible ?? true;
  };

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
      <div className="space-y-8">
        {/* Skeleton: Top bar */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-36 rounded-lg" />
        </div>

        {/* Skeleton: Nav links grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} size="sm" className="text-center">
              <CardContent className="flex flex-col items-center gap-2.5 py-4">
                <Skeleton className="w-10 h-10 rounded-full" />
                <Skeleton className="h-3 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Skeleton: Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-1">
                <Skeleton className="h-3 w-20 mb-1" />
                <Skeleton className="h-5 w-24" />
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Skeleton: Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-48 w-full rounded-lg" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-40 w-full rounded-lg" />
            </CardContent>
          </Card>
        </div>

        {/* Skeleton: Server status */}
        <Card>
          <CardHeader>
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-6 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-lg p-3 bg-muted/50">
                  <Skeleton className="h-3 w-16 mb-2" />
                  <Skeleton className="h-2 w-full mb-1" />
                  <Skeleton className="h-2 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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
          <span className="text-sm text-muted-foreground">
            {getGreeting()}，
          </span>
          <span className="text-sm font-mono text-muted-foreground">
            {time}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <DashboardConfigPanel onConfigChange={setCfg} />
          <div className="flex gap-1 bg-muted rounded-lg p-0.5">
            {DAYS.map(d => (
              <Button
                key={d.value}
                variant={days === d.value ? "default" : "ghost"}
                size="xs"
                onClick={() => setDays(d.value)}
              >
                {d.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
           2. Navigation Links Grid (visual focal point)
           ════════════════════════════════════════════ */}
      {sectionVisible("links") && <section>
        {links.length === 0 ? (
          <Card className="border-2 border-dashed p-10 text-center">
            <CardContent className="flex flex-col items-center gap-3 px-0">
              <p className="text-sm text-muted-foreground">暂无常用链接</p>
              <Link to="/settings"
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-4 py-2 text-xs text-foreground hover:bg-muted transition-colors">
                添加常用链接
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {links.map((link, i) => {
              const color = LINK_COLORS[i % LINK_COLORS.length];
              const letter = link.title.charAt(0).toUpperCase();
              return (
                <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                  className="block group">
                  <Card size="sm" className="text-center transition-all duration-200 hover:ring-2 hover:ring-primary/50">
                    <CardContent className="flex flex-col items-center gap-2.5 py-4">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-transform duration-200 group-hover:scale-110"
                        style={{ background: `${color}1a`, color }}
                      >
                        {letter}
                      </div>
                      <CardDescription className="text-xs leading-tight">
                        {link.title}
                      </CardDescription>
                    </CardContent>
                  </Card>
                </a>
              );
            })}
          </div>
        )}
      </section>}

      {sectionVisible("stats") && <>
      {/* ════════════════════════════════════════════
           3. Stats Row (compact cards)
           ════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="text-[11px] font-medium uppercase tracking-wider">
              总费用
            </CardDescription>
            <CardTitle className="text-base font-mono font-semibold text-primary">
              {totalCost}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="text-[11px] font-medium uppercase tracking-wider">
              输入 Token
            </CardDescription>
            <CardTitle className="text-base font-mono font-semibold">
              {totalInput}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="text-[11px] font-medium uppercase tracking-wider">
              输出 Token
            </CardDescription>
            <CardTitle className="text-base font-mono font-semibold">
              {totalOutput}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="text-[11px] font-medium uppercase tracking-wider">
              DeepSeek 余额
            </CardDescription>
            <CardTitle className={cn("text-base font-mono font-semibold", balancePositive ? "text-primary" : "text-muted-foreground")}>
              {balanceStr}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
      </>}

      {/* ════════════════════════════════════════════
           4. Charts Row (2-col)
           ════════════════════════════════════════════ */}
      {sectionVisible("charts") && <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Left: Area Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-xs font-medium text-muted-foreground">用量趋势</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-xs text-muted-foreground">暂无数据</div>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.006 300)" vertical={false} />
                  <XAxis dataKey="d" tickFormatter={dd} tick={{ fill: "oklch(0.65 0.01 300)", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={fmt} tick={{ fill: "oklch(0.65 0.01 300)", fontSize: 11 }} tickLine={false} axisLine={false} width={50} />
                  <Tooltip contentStyle={{ background: "oklch(0.16 0.004 300)", border: "1px solid oklch(0.25 0.006 300)", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="i" stroke="#ec4899" strokeWidth={1.5} fill="url(#ig)" />
                  <Area type="monotone" dataKey="o" stroke="#06b6d4" strokeWidth={1.5} fill="url(#og)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Right: Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-medium text-muted-foreground">各模型费用</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-xs text-muted-foreground">暂无数据</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={pieData} dataKey="cv" nameKey="model" cx="50%" cy="50%" innerRadius={36} outerRadius={64} paddingAngle={2}>
                      {pieData.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "oklch(0.16 0.004 300)", border: "1px solid oklch(0.25 0.006 300)", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: any) => [`$${(v as number).toFixed(4)}`, ""]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-1.5">
                  {pieData.slice(0, 5).map((m, i) => (
                    <div key={m.model} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE[i % PIE.length] }} />
                        <span className="truncate text-muted-foreground">{m.model.split("/").pop()}</span>
                      </div>
                      <span className="font-mono shrink-0 ml-2 text-foreground">{$c(m.cost)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      </>}

      {/* ════════════════════════════════════════════
           5. Server Status Row
           ════════════════════════════════════════════ */}
      {sectionVisible("servers") && servers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-medium text-muted-foreground">服务器状态</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {servers.map(srv => {
                const sm = ss[srv.id];
                return (
                  <Link
                    key={srv.id}
                    to={`/server/${srv.id}`}
                    className="rounded-lg p-3 bg-muted/50 block hover:bg-muted/80 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className={cn("w-1.5 h-1.5 rounded-full", srv.isActive ? "bg-primary" : "bg-muted-foreground")} />
                      <span className="text-xs font-medium truncate text-foreground">{srv.name}</span>
                      <Badge variant={srv.isActive ? "default" : "secondary"} className="ml-auto text-[10px] h-4 px-1.5">
                        {srv.isActive ? "在线" : "离线"}
                      </Badge>
                    </div>
                    <div className="space-y-1.5">
                      <MiniBar label="CPU" value={sm?.latestCpu || "0"} color="#ec4899" />
                      <MiniBar label="MEM" value={sm?.latestMem || "0"} color="#06b6d4" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
