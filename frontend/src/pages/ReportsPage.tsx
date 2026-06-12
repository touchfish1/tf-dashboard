import { useState, useEffect } from "react";
import { reportsApi } from "../api";
import type { ScheduledReport } from "../types";
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
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = {
  daily: "日报",
  weekly: "周报",
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  sent: { label: "已发送", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  failed: { label: "失败", className: "bg-destructive/10 text-destructive border-destructive/20" },
  pending: { label: "待发送", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
};

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtPeriod(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("zh-CN", opts)} - ${e.toLocaleDateString("zh-CN", opts)}`;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    reportsApi
      .list(20)
      .then(setReports)
      .catch((e) => setError(e instanceof Error ? e.message : "加载报告失败"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">报告历史</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>发送记录</CardTitle>
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
          ) : reports.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">暂无报告</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">类型</TableHead>
                  <TableHead>时间段</TableHead>
                  <TableHead className="w-20">状态</TableHead>
                  <TableHead className="w-40">发送渠道</TableHead>
                  <TableHead className="w-28">创建时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((r) => {
                  const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Badge variant="outline" className="text-[11px] font-normal">
                          {TYPE_LABEL[r.type] || r.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fmtPeriod(r.periodStart, r.periodEnd)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[11px] font-normal", sc.className)}>
                          {sc.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.sentTo && r.sentTo.length > 0
                          ? r.sentTo.join(", ")
                          : r.status === "failed" && r.error
                            ? <span className="text-destructive" title={r.error}>发送失败</span>
                            : "-"}
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {fmtTime(r.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
