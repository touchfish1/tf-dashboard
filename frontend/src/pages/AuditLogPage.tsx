import { useState, useEffect } from "react";
import { auditApi } from "../api";
import type { AuditEntry } from "../types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACTION_LABELS: Record<string, string> = {
  "server.create": "添加服务器",
  "server.update": "更新服务器",
  "server.delete": "删除服务器",
  "link.create": "添加链接",
  "link.update": "更新链接",
  "link.delete": "删除链接",
  "settings.update": "修改设置",
  "settings.delete": "删除设置",
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] || action;
}

function actionColor(action: string): string {
  if (action.includes("create")) return "text-emerald-400";
  if (action.includes("delete")) return "text-destructive";
  if (action.includes("update")) return "text-amber-400";
  return "text-muted-foreground";
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function DetailJson({ raw }: { raw: string | null }) {
  if (!raw) return <span className="text-muted-foreground">-</span>;
  try {
    const obj = JSON.parse(raw);
    return (
      <span className="text-[11px] font-mono text-muted-foreground truncate block max-w-[200px]">
        {JSON.stringify(obj)}
      </span>
    );
  } catch {
    return <span className="text-[11px] text-muted-foreground">{raw}</span>;
  }
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    setLoading(true);
    setError(null);
    auditApi.list(200)
      .then(setLogs)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === "all"
    ? logs
    : logs.filter((l) => l.action.startsWith(filter));

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">操作审计</h1>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>操作记录</CardTitle>
            <div className="flex gap-1 bg-muted rounded-lg p-0.5">
              {(["all", "server", "link", "settings"] as const).map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? "secondary" : "ghost"}
                  size="xs"
                  onClick={() => setFilter(f)}
                >
                  {f === "all" ? "全部" : f === "server" ? "服务器" : f === "link" ? "链接" : "设置"}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-6 text-sm text-destructive text-center">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">暂无操作记录</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">时间</TableHead>
                  <TableHead>操作</TableHead>
                  <TableHead>资源</TableHead>
                  <TableHead>详情</TableHead>
                  <TableHead className="w-28">来源 IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {fmtTime(log.timestamp)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("text-[11px] font-normal", actionColor(log.action))}
                      >
                        {actionLabel(log.action)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log.resource}
                      {log.resourceId ? ` #${log.resourceId}` : ""}
                    </TableCell>
                    <TableCell>
                      <DetailJson raw={log.detail} />
                    </TableCell>
                    <TableCell className="text-[11px] font-mono text-muted-foreground truncate max-w-[120px]">
                      {log.ip === "unknown" ? "-" : log.ip}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
