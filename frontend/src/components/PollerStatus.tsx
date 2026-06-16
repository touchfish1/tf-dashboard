import { useState, useEffect, useCallback } from "react";
import { statusApi } from "../api";
import type { PollerStatus as PollerStatusType, StatusResponse } from "../types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ─── Helpers ────────────────────────────────────────

const POLLER_LABELS: Record<string, string> = {
  servers: "服务器轮询器",
  opencode: "OpenCode 轮询器",
  deepseek: "DeepSeek 轮询器",
};

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}天`);
  if (h > 0) parts.push(`${h}时`);
  if (m > 0) parts.push(`${m}分`);
  parts.push(`${s}秒`);
  return parts.join("");
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(1)} ${units[i]}`;
}

// ─── Poller Card ────────────────────────────────────

function PollerCard({ poller }: { poller: PollerStatusType }) {
  const hasError = !!poller.lastError;
  const isHealthy = !hasError && poller.runCount > 0;
  const statusLabel = poller.isRunning ? "运行中" : isHealthy ? "正常" : "异常";
  const statusColor = poller.isRunning
    ? "bg-blue-500"
    : isHealthy
      ? "bg-emerald-500"
      : "bg-red-500";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{POLLER_LABELS[poller.name] || poller.name}</CardTitle>
          <Badge
            variant="secondary"
            className={cn(
              "flex items-center gap-1.5 text-xs",
              hasError && "text-red-400",
              isHealthy && !poller.isRunning && "text-emerald-400",
              poller.isRunning && "text-blue-400"
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", statusColor, poller.isRunning && "animate-pulse")} />
            {statusLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
          <div>
            <span className="text-muted-foreground">上次运行</span>
            <p className="text-foreground font-mono text-xs mt-0.5 tabular-nums">
              {formatTime(poller.lastRunAt)}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">上次成功</span>
            <p className="text-foreground font-mono text-xs mt-0.5 tabular-nums">
              {formatTime(poller.lastSuccessAt)}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">运行次数</span>
            <p className="text-foreground font-mono text-sm mt-0.5 tabular-nums">
              {poller.runCount.toLocaleString()}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">失败次数</span>
            <p className={cn(
              "font-mono text-sm mt-0.5 tabular-nums",
              poller.errorCount > 0 ? "text-red-400" : "text-foreground"
            )}>
              {poller.errorCount.toLocaleString()}
            </p>
          </div>
        </div>
        {hasError && (
          <div className="mt-3 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
            <p className="text-xs text-red-400 leading-relaxed break-all">
              {poller.lastError}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Skeleton ───────────────────────────────────────

function PollerSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                {[0, 1, 2, 3].map((j) => (
                  <div key={j}>
                    <Skeleton className="h-3 w-16 mb-1" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── System Info Card ───────────────────────────────

function SystemInfoCard({ status }: { status: StatusResponse }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>系统信息</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">运行时间</span>
            <p className="text-foreground font-mono mt-0.5 tabular-nums">
              {formatDuration(status.uptime)}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">内存 RSS</span>
            <p className="text-foreground font-mono mt-0.5 tabular-nums">
              {formatBytes(status.memoryUsage.rss)}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">堆内存</span>
            <p className="text-foreground font-mono mt-0.5 tabular-nums">
              {formatBytes(status.memoryUsage.heapUsed)} / {formatBytes(status.memoryUsage.heapTotal)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ─────────────────────────────────

export default function PollerStatus() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      setError(null);
      const data = await statusApi.get();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取状态失败");
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // Auto-refresh every 30s, pause when hidden
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    function start() {
      if (interval) clearInterval(interval);
      interval = setInterval(() => fetchData(false), 30000);
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

  // ── Loading ──
  if (loading) {
    return <PollerSkeleton />;
  }

  // ── Error ──
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="bg-destructive/10 ring-destructive/20 max-w-lg">
          <CardContent className="flex items-center gap-2 text-destructive text-sm">
            <span>⚠</span>
            <span>{error}</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Data ──
  if (!status) return null;

  return (
    <div className="space-y-6">
      {/* Poller cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {status.pollers.map((poller) => (
          <PollerCard key={poller.name} poller={poller} />
        ))}
      </div>

      {/* System info */}
      <SystemInfoCard status={status} />
    </div>
  );
}
