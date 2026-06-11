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
  "server.create": "添加服务器", "server.update": "更新服务器", "server.delete": "删除服务器",
  "link.create": "添加链接", "link.update": "更新链接", "link.delete": "删除链接",
  "settings.update": "修改设置", "settings.delete": "删除设置",
};

function actionLabel(a: string): string { return ACTION_LABELS[a] || a; }
function actionColor(a: string): string {
  if (a.includes("create")) return "text-emerald-400";
  if (a.includes("delete")) return "text-destructive";
  if (a.includes("update")) return "text-amber-400";
  return "text-muted-foreground";
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function DetailJson({ raw }: { raw: string | null }) {
  if (!raw) return <span className="text-muted-foreground">-</span>;
  try {
    const obj = JSON.parse(raw);
    return <span className="text-[11px] font-mono text-muted-foreground truncate block max-w-[200px]">{JSON.stringify(obj)}</span>;
  } catch {
    return <span className="text-[11px] text-muted-foreground">{raw}</span>;
  }
}

const PAGE_SIZE = 50;
const FILTERS = [
  { key: "", label: "全部" },
  { key: "server", label: "服务器" },
  { key: "link", label: "链接" },
  { key: "settings", label: "设置" },
];
const DAY_OPTS = [
  { value: 7, label: "7天" },
  { value: 30, label: "30天" },
  { value: 90, label: "90天" },
];

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [days, setDays] = useState(30);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    auditApi.list(PAGE_SIZE, page * PAGE_SIZE, days, typeFilter)
      .then(setLogs)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page, typeFilter, days]);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">操作审计</h1>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>操作记录</CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex gap-1 bg-muted rounded-lg p-0.5">
                {FILTERS.map((f) => (
                  <Button key={f.key} variant={typeFilter === f.key ? "secondary" : "ghost"} size="xs"
                    onClick={() => { setTypeFilter(f.key); setPage(0); }}>{f.label}</Button>
                ))}
              </div>
              <div className="flex gap-1 bg-muted rounded-lg p-0.5">
                {DAY_OPTS.map((d) => (
                  <Button key={d.value} variant={days === d.value ? "secondary" : "ghost"} size="xs"
                    onClick={() => { setDays(d.value); setPage(0); }}>{d.label}</Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : error ? (
            <div className="p-6 text-sm text-destructive text-center">{error}</div>
          ) : logs.length === 0 ? (
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
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">{fmtTime(log.timestamp)}</TableCell>
                    <TableCell><Badge variant="outline" className={cn("text-[11px] font-normal", actionColor(log.action))}>{actionLabel(log.action)}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.resource}{log.resourceId ? ` #${log.resourceId}` : ""}</TableCell>
                    <TableCell><DetailJson raw={log.detail} /></TableCell>
                    <TableCell className="text-[11px] font-mono text-muted-foreground truncate max-w-[120px]">{log.ip === "unknown" ? "-" : log.ip}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {logs.length > 0 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="text-xs text-muted-foreground">每页 {PAGE_SIZE} 条</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}>上一页</Button>
              <span className="text-xs text-muted-foreground self-center">第 {page + 1} 页</span>
              <Button variant="outline" size="sm" disabled={logs.length < PAGE_SIZE}
                onClick={() => setPage((p) => p + 1)}>下一页</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
