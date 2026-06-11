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
} from "@phosphor-icons/react";
import type { Server as ServerType } from "./types";
import { serversApi, settingsApi } from "./api";

const NAV = [
  { to: "/dashboard", label: "总览", icon: ChartPieSlice },
  { to: "/opencode", label: "OpenCode", icon: Terminal },
  { to: "/deepseek", label: "DeepSeek", icon: Robot },
  { to: "/server", label: "服务器", icon: ComputerTower },
  { to: "/settings", label: "设置", icon: GearSix },
];

export default function Layout() {
  const loc = useLocation();
  const [servers, setServers] = useState<ServerType[]>([]);
  const [srvOpen, setSrvOpen] = useState(false);
  const dd = useRef<HTMLDivElement>(null);
  const [bgUrl, setBgUrl] = useState("");
  const [bgOpacity, setBgOpacity] = useState("30");

  useEffect(() => { serversApi.list().then(setServers).catch(() => {}); }, []);
  useEffect(() => {
    settingsApi.get("bg_image_url").then(r => { if (r.value) setBgUrl(r.value); }).catch(() => {});
    settingsApi.get("bg_image_opacity").then(r => { if (r.value) setBgOpacity(r.value); }).catch(() => {});
  }, []);
  useEffect(() => {
    const cb = (e: MouseEvent) => { if (dd.current && !dd.current.contains(e.target as Node)) setSrvOpen(false); };
    document.addEventListener("mousedown", cb);
    return () => document.removeEventListener("mousedown", cb);
  }, []);

  const isSrv = loc.pathname.startsWith("/server");

  return (
    <div className="min-h-screen relative" style={{ background: "var(--color-surface)" }}>
      {/* 背景图片 */}
      {bgUrl && (
        <div className="fixed inset-0 pointer-events-none z-0"
          style={{
            backgroundImage: `url(${bgUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            opacity: parseInt(bgOpacity) / 100,
          }} />
      )}
      <div className="relative z-10">
      <header className="sticky top-0 z-50 border-b" style={{ borderColor: "var(--color-border)", background: "color-mix(in srgb, var(--color-surface) 88%, transparent)", backdropFilter: "blur(12px)" }}>
        <div className="flex items-center h-12 px-6 max-w-[1400px] mx-auto gap-1">
          <NavLink to="/dashboard" className="flex items-center gap-2 mr-4 shrink-0">
            <div className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold" style={{ background: "var(--color-accent)", color: "var(--color-surface)" }}>T</div>
            <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>tf-dashboard</span>
          </NavLink>

          {NAV.map(({ to, label, icon: Icon }) => {
            if (to === "/server") {
              return (
                <div key={to} className="relative" ref={dd}>
                  <button onClick={() => setSrvOpen(v => !v)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[13px] transition-colors"
                    style={{ color: isSrv ? "var(--color-text-primary)" : "var(--color-text-muted)", background: isSrv ? "var(--color-surface-raised)" : "transparent" }}>
                    <ComputerTower size={14} />
                    <span>服务器</span>
                    <CaretDown size={10} className={`transition-transform ${srvOpen ? "rotate-180" : ""}`} />
                  </button>
                  {srvOpen && (
                    <div className="absolute top-full left-0 mt-1 w-44 rounded-lg border py-1 shadow-lg z-50"
                      style={{ background: "var(--color-surface-elevated)", borderColor: "var(--color-border)" }}>
                      {servers.length === 0 ? (
                        <div className="px-3 py-2 text-xs" style={{ color: "var(--color-text-muted)" }}>暂无服务器</div>
                      ) : servers.map(s => (
                        <NavLink key={s.id} to={`/server/${s.id}`} onClick={() => setSrvOpen(false)}
                          className="flex items-center gap-2 px-3 py-1.5 text-[13px] transition-colors"
                          style={{ color: loc.pathname === `/server/${s.id}` ? "var(--color-text-primary)" : "var(--color-text-secondary)", background: loc.pathname === `/server/${s.id}` ? "var(--color-surface-raised)" : "transparent" }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.isActive ? "var(--color-accent)" : "var(--color-text-muted)" }} />
                          {s.name}
                        </NavLink>
                      ))}
                      <div className="border-t mt-1 pt-1" style={{ borderColor: "var(--color-border)" }}>
                        <NavLink to="/settings" onClick={() => setSrvOpen(false)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors" style={{ color: "var(--color-text-muted)" }}>
                          <Plus size={12} /> 添加服务器
                        </NavLink>
                      </div>
                    </div>
                  )}
                </div>
              );
            }
            const active = loc.pathname === to;
            return (
              <NavLink key={to} to={to}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[13px] transition-colors"
                style={{ color: active ? "var(--color-text-primary)" : "var(--color-text-muted)", background: active ? "var(--color-surface-raised)" : "transparent" }}>
                <Icon size={14} />
                <span>{label}</span>
              </NavLink>
            );
          })}

          <div className="ml-auto text-[11px]" style={{ color: "var(--color-text-muted)" }}>v0.1.0</div>
        </div>
      </header>
      <main className="max-w-[1400px] mx-auto px-6 py-6"><Outlet /></main>
      </div>
    </div>
  );
}
