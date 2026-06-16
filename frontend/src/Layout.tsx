import { useState, useEffect, useRef } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import {
  ChartPieSlice,
  Terminal,
  Robot,
  ComputerTower,
  Users,
  GearSix,
  CaretDown,
  Plus,
  Bell,
  Check,
  WarningCircle as WarningIcon,
  ClipboardText,
  FileText,
  SignOut,
  Gauge,
  SunDim,
  MoonStars,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Server as ServerType, Alert } from "./types";
import { serversApi, alertsApi } from "./api";
import { useAuth, getAccessToken } from "./auth";
import ConnectionStatus from "@/components/ConnectionStatus";
import { trackPageView, trackPerformance, trackAction, startSessionTracking, stopSessionTracking, initViewportTracking, initClickTracking, initFormTracking, initScrollTracking, initVisibilityTracking, initOutboundTracking, startBatchSender, stopBatchSender } from "./lib/tracking";

const NAV = [
  { to: "/dashboard", label: "总览", icon: ChartPieSlice },
  { to: "/opencode", label: "OpenCode", icon: Terminal },
  { to: "/deepseek", label: "DeepSeek", icon: Robot },
  { to: "/server", label: "服务器", icon: ComputerTower },
  { to: "/status", label: "状态", icon: Gauge },
  { to: "/audit", label: "审计", icon: ClipboardText },
  { to: "/alerts/rules", label: "告警", icon: Bell },
  { to: "/reports", label: "报告", icon: FileText },
  { to: "/users", label: "用户", icon: Users },
];

function ThemeToggle() {
  const [theme, setTheme] = useState<"paper" | "rubbing">(() => {
    try {
      const saved = localStorage.getItem("tf-theme");
      if (saved === "paper" || saved === "rubbing") return saved;
    } catch {}
    return "paper";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("theme-paper", "theme-rubbing");
    root.classList.add(`theme-${theme}`);
    try { localStorage.setItem("tf-theme", theme); } catch {}
  }, [theme]);

  return (
    <button
      type="button"
      onClick={() => setTheme((t) => (t === "paper" ? "rubbing" : "paper"))}
      className="flex items-center gap-1.5 px-2 py-1 text-xs transition-colors hover:text-foreground/80 text-foreground/50"
      title={theme === "paper" ? "切换拓片主题" : "切换宣纸主题"}
    >
      {theme === "paper" ? <MoonStars size={14} /> : <SunDim size={14} />}
      <span className="hidden sm:inline font-heading">{theme === "paper" ? "拓片" : "宣纸"}</span>
    </button>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  if (!user) return null;

  const initial = user.displayName.charAt(0).toUpperCase();

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 w-7 items-center justify-center rounded-sm text-xs font-bold border border-border hover:bg-muted transition-colors"
        style={{ fontFamily: '"Songti SC", "STSong", serif' }}
      >
        {initial}
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 w-48 border border-border bg-popover py-2 z-[60] shadow-lg">
          <div className="px-3 pb-1.5">
            <p className="text-xs font-medium text-foreground truncate">
              {user.displayName}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {user.email}
            </p>
          </div>
          <div className="px-3 pb-2">
            <span className="inline-flex items-center border border-current px-2 py-0.5 text-[10px] text-primary">
              {user.role === "admin" ? "管理员" : "查看者"}
            </span>
          </div>
          <div className="border-t border-border mx-3" />
          <button
            onClick={() => {
              logout();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <SignOut size={14} />
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const loc = useLocation();
  const [servers, setServers] = useState<ServerType[]>([]);
  const [srvOpen, setSrvOpen] = useState(false);
  const [alertsList, setAlertsList] = useState<Alert[]>([]);
  const [alertOpen, setAlertOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const dd = useRef<HTMLDivElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    serversApi.list().then(setServers).catch(() => {});
  }, []);

  useEffect(() => {
    trackPageView(loc.pathname);
  }, [loc.pathname]);

  useEffect(() => {
    startBatchSender();
    startSessionTracking();
    initViewportTracking();
    initClickTracking();
    initFormTracking();
    initScrollTracking();
    initVisibilityTracking();
    initOutboundTracking();
    return () => { stopSessionTracking(); stopBatchSender(); };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "performance" in window) {
      const entries = performance.getEntriesByType("navigation");
      if (entries.length > 0) {
        const nav = entries[0] as PerformanceNavigationTiming;
        trackPerformance("页面加载", Math.round(nav.loadEventEnd - nav.startTime));
        trackPerformance("DOM就绪", Math.round(nav.domContentLoadedEventEnd - nav.startTime));
      }
    }
  }, []);

  useEffect(() => {
    const cb = (e: MouseEvent) => {
      if (dd.current && !dd.current.contains(e.target as Node)) setSrvOpen(false);
      if (alertRef.current && !alertRef.current.contains(e.target as Node)) setAlertOpen(false);
    };
    document.addEventListener("mousedown", cb);
    return () => document.removeEventListener("mousedown", cb);
  }, []);

  useEffect(() => {
    if (!getAccessToken()) return;

    const fetchAlerts = () => {
      alertsApi.unread().then((r) => setUnread(r.count)).catch(() => {});
      alertsApi.list(10).then(setAlertsList).catch(() => {});
    };
    fetchAlerts();

    let es: EventSource | null = null;
    let fallbackPollId: ReturnType<typeof setInterval> | null = null;
    let reconnectFailures = 0;

    function initSSE() {
      const token = getAccessToken();
      const url = token ? `/api/sse?token=${token}` : "/api/sse";
      es = new EventSource(url);

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (
            [
              "server_offline",
              "deepseek_balance",
              "opencode_etl_error",
              "opencode_cost_anomaly",
              "server_metrics",
              "opencode_usage_updated",
              "monthly_budget_check",
            ].includes(data.type)
          ) {
            fetchAlerts();
          }
          if (["opencode_usage_updated", "server_metrics", "deepseek_balance"].includes(data.type)) {
            window.dispatchEvent(new CustomEvent("tf:data-update", { detail: { type: data.type } }));
          }
        } catch {}
      };

      es.onerror = () => {
        es?.close();
        reconnectFailures++;
        if (reconnectFailures >= 3) {
          if (!fallbackPollId) {
            fallbackPollId = setInterval(fetchAlerts, 60000);
          }
        }
      };

      es.onopen = () => {
        reconnectFailures = 0;
      };
    }

    initSSE();

    return () => {
      es?.close();
      if (fallbackPollId) clearInterval(fallbackPollId);
    };
  }, []);

  const isSrv = loc.pathname.startsWith("/server");

  const severityColor: Record<string, string> = {
    critical: "text-destructive",
    warning: "text-amber-400",
    info: "text-muted-foreground",
  };

  return (
    <div className="flex min-h-screen bg-background relative" style={{ zIndex: 1 }}>
      <ConnectionStatus />

      {/* ═══ 侧栏 · Sidebar ═══ */}
      <aside className="hidden md:flex flex-col w-48 shrink-0 border-r border-border bg-sidebar relative">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-12 border-b border-border/50 shrink-0">
          <div className="flex items-center justify-center w-7 h-7 text-xs font-bold border border-primary text-primary" style={{ fontFamily: '"Songti SC", "STSong", serif' }}>
            T
          </div>
          <span className="text-sm font-heading text-foreground tracking-wide">tf-dashboard</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = loc.pathname === to || (to === "/server" && isSrv);
            return (
              <NavLink
                key={to}
                to={to}
                className={cn(
                  "relative flex items-center gap-2.5 px-4 py-2 text-xs transition-colors",
                  active
                    ? "text-primary bg-muted/60"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-[15%] bottom-[15%] w-[3px] bg-primary rounded-r-sm" />
                )}
                <Icon size={16} weight={active ? "fill" : "regular"} />
                <span className="font-heading tracking-wide">{label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Server dropdown in sidebar */}
        <div ref={dd} className="border-t border-border/50">
          <button
            type="button"
            onClick={() => setSrvOpen((v) => !v)}
            className={cn(
              "flex items-center gap-2.5 w-full px-4 py-2 text-xs transition-colors",
              isSrv ? "text-primary bg-muted/60" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            )}
          >
            <ComputerTower size={16} weight={isSrv ? "fill" : "regular"} />
            <span className="flex-1 text-left font-heading tracking-wide">服务器</span>
            <CaretDown size={10} className={cn("transition-transform", srvOpen && "rotate-180")} />
          </button>
          {srvOpen && (
            <div className="pb-1">
              {servers.length === 0 ? (
                <div className="px-9 py-1.5 text-[11px] text-muted-foreground">暂无服务器</div>
              ) : (
                servers.map((s) => (
                  <NavLink
                    key={s.id}
                    to={`/server/${s.id}`}
                    onClick={() => setSrvOpen(false)}
                    className={cn(
                      "flex items-center gap-2 px-9 py-1.5 text-[11px] transition-colors",
                      loc.pathname === `/server/${s.id}`
                        ? "text-foreground bg-muted/50"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
                    )}
                  >
                    <span className={cn("w-1 h-1 shrink-0 bg-current opacity-40")} />
                    {s.name}
                  </NavLink>
                ))
              )}
              <NavLink
                to="/settings"
                onClick={() => setSrvOpen(false)}
                className="flex items-center gap-2 px-9 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus size={10} /> 添加服务器
              </NavLink>
            </div>
          )}
        </div>

        {/* Settings */}
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2.5 px-4 py-2 text-xs transition-colors border-t border-border/50",
              isActive
                ? "text-primary bg-muted/60"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute left-0 top-[15%] bottom-[15%] w-[3px] bg-primary rounded-r-sm" />
              )}
              <GearSix size={16} weight={isActive ? "fill" : "regular"} />
              <span className="font-heading tracking-wide">设置</span>
            </>
          )}
        </NavLink>
      </aside>

      {/* ═══ 主区域 · Main area ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ─── 顶栏 · Top bar ─── */}
        <header className="flex items-center justify-end gap-2 h-12 px-4 sm:px-6 border-b border-border bg-background/80 relative z-10">
          <ThemeToggle />

          {/* Alert bell */}
          <div className="relative shrink-0" ref={alertRef}>
            <button
              type="button"
              onClick={() => { trackAction("导航", "查看通知"); setAlertOpen((v) => !v); }}
              className="relative flex items-center justify-center w-7 h-7 text-foreground/50 hover:text-foreground transition-colors"
            >
              <Bell size={14} />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-3.5 h-3.5 bg-primary text-primary-foreground text-[8px] font-bold">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
            {alertOpen && (
              <div className="absolute top-full right-0 mt-1 w-80 border border-border bg-popover z-[60] max-h-96 flex flex-col shadow-lg">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="text-xs font-heading text-foreground">通知</span>
                  {unread > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        trackAction("导航", "全部已读");
                        alertsApi.ackAll().then(() => {
                          setAlertsList([]);
                          setUnread(0);
                        });
                      }}
                      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      全部已读
                    </button>
                  )}
                </div>
                <div className="overflow-y-auto flex-1">
                  {alertsList.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                      暂无通知
                    </div>
                  ) : (
                    alertsList.filter((a) => !a.acknowledged).map((a) => (
                      <div
                        key={a.id}
                        className="flex items-start gap-2 px-3 py-2.5 border-b border-border/50 hover:bg-muted/50 transition-colors"
                      >
                        <WarningIcon
                          size={14}
                          className={cn("mt-0.5 shrink-0", severityColor[a.severity] || "text-muted-foreground")}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-foreground truncate">{a.title}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{a.message}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            trackAction("导航", "标记已读", a.title);
                            alertsApi.ack(a.id).then(() => {
                              setAlertsList((prev) => prev.filter((x) => x.id !== a.id));
                              setUnread((u) => Math.max(0, u - 1));
                            });
                          }}
                          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Check size={12} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User menu */}
          <UserMenu />
        </header>

        {/* ─── 内容 · Content ─── */}
        <main className="flex-1 px-4 sm:px-6 py-4 sm:py-6 overflow-y-auto relative" style={{ zIndex: 1 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
