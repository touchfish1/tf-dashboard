import { useState, useEffect, useRef } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import {
  ChartPieSlice,
  Terminal,
  Robot,
  ComputerTower,
  GearSix,
  CaretDown,
  Plus,
  Bell,
  Check,
  WarningCircle as WarningIcon,
  ClipboardText,
  FileText,
  SignOut,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  { to: "/audit", label: "审计", icon: ClipboardText },
  { to: "/alerts/rules", label: "告警", icon: Bell },
  { to: "/reports", label: "报告", icon: FileText },
  { to: "/settings", label: "设置", icon: GearSix },
];

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  if (!user) return null;

  const initial = user.displayName.charAt(0).toUpperCase();

  return (
    <div className="relative shrink-0" ref={ref}>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
          {initial}
        </div>
      </Button>
      {open && (
        <div className="absolute top-full right-0 mt-1 w-48 rounded-lg border border-border bg-popover py-2 shadow-lg z-[60]">
          <div className="px-3 pb-1.5">
            <p className="text-xs font-medium text-foreground truncate">
              {user.displayName}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {user.email}
            </p>
          </div>
          <div className="px-3 pb-2">
            <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              {user.role === "admin" ? "管理员" : "查看者"}
            </span>
          </div>
          <div className="border-t border-border" />
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
  const [userOpen, setUserOpen] = useState(false);
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

  // Track page load performance
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
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    document.addEventListener("mousedown", cb);
    return () => document.removeEventListener("mousedown", cb);
  }, []);
  useEffect(() => {
    // Only subscribe to alerts and SSE when user is logged in
    if (!getAccessToken()) return;

    const fetchAlerts = () => {
      alertsApi.unread().then((r) => setUnread(r.count)).catch(() => {});
      alertsApi.list(10).then(setAlertsList).catch(() => {});
    };
    fetchAlerts();

    // SSE connection for live real-time updates
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
        } catch {
          /* ignore parse errors */
        }
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
    <div className="min-h-screen bg-background">
      <ConnectionStatus />
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="flex items-center h-12 px-4 sm:px-6 max-w-[1400px] mx-auto">
          {/* Scrollable nav area + logo */}
          <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none flex-1 min-w-0">
            {/* Logo */}
            <NavLink
              to="/dashboard"
              className="flex items-center gap-2 mr-3 sm:mr-4 shrink-0"
            >
              <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold bg-primary text-primary-foreground">
                T
              </div>
              <span className="text-sm font-medium text-foreground hidden sm:inline">
                tf-dashboard
              </span>
            </NavLink>

            {/* Nav items (without server) */}
            {NAV.filter(n => n.to !== "/server").map(({ to, label, icon: Icon }) => {
              const active = loc.pathname === to;
              return (
                <NavLink key={to} to={to} className="shrink-0">
                  <Button
                    variant={active ? "secondary" : "ghost"}
                    size="sm"
                    className={cn("gap-0.5 sm:gap-1.5", active && "bg-muted")}
                  >
                    <Icon size={16} />
                    <span className="hidden sm:inline">{label}</span>
                  </Button>
                </NavLink>
              );
            })}

            <span className="text-[10px] sm:text-[11px] text-muted-foreground shrink-0 ml-1">
              v0.1.0
            </span>
          </div>

          {/* User menu */}
          <UserMenu />

          {/* Server button + dropdown — OUTSIDE scrollable area */}
          <div className="relative shrink-0 ml-2" ref={dd}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSrvOpen((v) => !v)}
              className={cn(
                "gap-0.5 sm:gap-1.5",
                isSrv && "bg-muted text-foreground"
              )}
            >
              <ComputerTower size={16} />
              <span className="hidden sm:inline">服务器</span>
              <CaretDown
                size={10}
                className={cn(
                  "transition-transform shrink-0",
                  srvOpen && "rotate-180"
                )}
              />
            </Button>
            {srvOpen && (
              <div className="absolute top-full right-0 mt-1 w-44 rounded-lg border border-border bg-popover py-1 shadow-lg z-[60]">
                {servers.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    暂无服务器
                  </div>
                ) : (
                  servers.map((s) => (
                    <NavLink
                      key={s.id}
                      to={`/server/${s.id}`}
                      onClick={() => setSrvOpen(false)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-muted",
                        loc.pathname === `/server/${s.id}`
                          ? "text-foreground bg-muted"
                          : "text-muted-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          s.isActive ? "bg-primary" : "bg-muted-foreground/40"
                        )}
                      />
                      {s.name}
                    </NavLink>
                  ))
                )}
                <div className="border-t border-border mt-1 pt-1">
                  <NavLink
                    to="/settings"
                    onClick={() => setSrvOpen(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus size={12} /> 添加服务器
                  </NavLink>
                </div>
              </div>
            )}
          </div>

          {/* Alert bell */}
          <div className="relative shrink-0" ref={alertRef}>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => { trackAction("导航", "查看通知"); setAlertOpen((v) => !v); }}
              className="relative"
            >
              <Bell size={16} />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Button>
            {alertOpen && (
              <div className="absolute top-full right-0 mt-1 w-80 rounded-lg border border-border bg-popover shadow-lg z-[60] max-h-96 flex flex-col">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="text-xs font-medium text-foreground">通知</span>
                  {unread > 0 && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        trackAction("导航", "全部已读");
                        alertsApi.ackAll().then(() => {
                          setAlertsList([]);
                          setUnread(0);
                        });
                      }}
                    >
                      全部已读
                    </Button>
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
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => {
                            trackAction("导航", "标记已读", a.title);
                            alertsApi.ack(a.id).then(() => {
                              setAlertsList((prev) => prev.filter((x) => x.id !== a.id));
                              setUnread((u) => Math.max(0, u - 1));
                            });
                          }}
                        >
                          <Check size={12} />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <Outlet />
      </main>
    </div>
  );
}
