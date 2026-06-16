import { useState, useEffect } from "react";
import {
  TrashSimple,
  NotePencil,
  Plus,
  CheckCircle,
  WarningCircle,
} from "@phosphor-icons/react";
import { trackAction } from "../lib/tracking";
import { linksApi, serversApi, settingsApi } from "../api";
import type { NavLink, Server, NotificationChannel } from "../types";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { useToast } from "@/components/Toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export default function SettingsPage() {
  const { toast } = useToast();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formLabels, setFormLabels] = useState("");
  const [editingServer, setEditingServer] = useState<Server | null>(null);

  // DeepSeek API key state
  const [dsKey, setDsKey] = useState("");
  const [dsKeySaved, setDsKeySaved] = useState(false);
  const [dsKeySaving, setDsKeySaving] = useState(false);
  const [dsKeyMasked, setDsKeyMasked] = useState(true);

  // OpenCode API config state
  const [ocUrl, setOcUrl] = useState("");
  const [ocUrlSaved, setOcUrlSaved] = useState(false);
  const [ocKey, setOcKey] = useState("");
  const [ocKeySaved, setOcKeySaved] = useState(false);
  const [ocKeyMasked, setOcKeyMasked] = useState(true);
  const [ocSaving, setOcSaving] = useState(false);

  // Link management state
  const [links, setLinks] = useState<NavLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(true);
  const [linksError, setLinksError] = useState<string | null>(null);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkSaving, setLinkSaving] = useState(false);
  const [linkFormTitle, setLinkFormTitle] = useState("");
  const [linkFormUrl, setLinkFormUrl] = useState("");
  const [linkFormCategory, setLinkFormCategory] = useState("");

  const [editingLink, setEditingLink] = useState<NavLink | null>(null);

  // Background state
  const [bgUrl, setBgUrl] = useState("");
  const [bgUrlSaved, setBgUrlSaved] = useState(false);
  const [bgOpacity, setBgOpacity] = useState("30");
  const [bgSaving, setBgSaving] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);
  const [monthlyBudgetInput, setMonthlyBudgetInput] = useState("");

  // Notification channels state
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const [channelSaving, setChannelSaving] = useState(false);
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null);
  const [channelFormName, setChannelFormName] = useState("");
  const [channelFormType, setChannelFormType] = useState<NotificationChannel["type"]>("slack");
  const [channelFormUrl, setChannelFormUrl] = useState("");
  const [channelTesting, setChannelTesting] = useState(false);

  const CHANNEL_TYPE_LABEL: Record<NotificationChannel["type"], string> = {
    slack: "Slack",
    feishu: "飞书",
    dingtalk: "钉钉",
    wecom: "企业微信",
    webhook_generic: "通用 Webhook",
  };

  // Report schedule state
  const [reportEnabled, setReportEnabled] = useState(false);
  const [reportDailyTime, setReportDailyTime] = useState("08:00");
  const [reportWeeklyTime, setReportWeeklyTime] = useState("09:00");
  const [reportWeeklyDay, setReportWeeklyDay] = useState("1");
  const [reportChannels, setReportChannels] = useState("");
  const [reportScheduleSaving, setReportScheduleSaving] = useState(false);

  useEffect(() => {
    loadServers();
    loadLinks();
    loadDsKey();
    loadOcConfig();
    loadBg();
    loadChannels();
    loadReportSchedule();
    settingsApi.get("monthly_budget").then((r) => setMonthlyBudgetInput(r.value || "")).catch(() => {});
  }, []);

  // ── DeepSeek ────────────────────────────────────

  const loadDsKey = async () => {
    try {
      const { value } = await settingsApi.get("deepseek_api_key");
      setDsKey(value || "");
      setDsKeySaved(!!value);
    } catch { /* silent */ }
  };

  const handleSaveDsKey = async () => {
    trackAction("设置", "保存DeepSeek密钥");
    setDsKeySaving(true);
    try {
      await settingsApi.set("deepseek_api_key", dsKey);
      setDsKeySaved(true);
      setDsKeyMasked(true);
      toast("success", "DeepSeek API 密钥已保存");
    } catch {
      toast("error", "保存失败");
    } finally {
      setDsKeySaving(false);
    }
  };

  // ── OpenCode ────────────────────────────────────

  const loadOcConfig = async () => {
    try {
      const [urlRes, keyRes] = await Promise.all([
        settingsApi.get("opencode_api_url"),
        settingsApi.get("opencode_api_key"),
      ]);
      setOcUrl(urlRes.value || "");
      setOcUrlSaved(!!urlRes.value);
      setOcKey(keyRes.value || "");
      setOcKeySaved(!!keyRes.value);
    } catch { /* silent */ }
  };

  const handleSaveOcConfig = async () => {
    trackAction("设置", "保存OpenCode配置");
    setOcSaving(true);
    try {
      await Promise.all([
        settingsApi.set("opencode_api_url", ocUrl),
        settingsApi.set("opencode_api_key", ocKey),
      ]);
      setOcUrlSaved(true);
      setOcKeySaved(true);
      setOcKeyMasked(true);
      toast("success", "OpenCode 配置已保存");
    } catch {
      toast("error", "保存失败");
    } finally {
      setOcSaving(false);
    }
  };

  // ── Background ───────────────────────────────────

  const loadBg = async () => {
    try {
      const [urlRes, opRes] = await Promise.all([
        settingsApi.get("bg_image_url"),
        settingsApi.get("bg_image_opacity"),
      ]);
      if (urlRes.value) { setBgUrl(urlRes.value); setBgUrlSaved(true); }
      if (opRes.value) setBgOpacity(opRes.value);
    } catch { /* silent */ }
  };

  const handleSaveBg = async () => {
    trackAction("设置", "保存背景设置");
    setBgSaving(true);
    try {
      await settingsApi.set("bg_image_url", bgUrl);
      await settingsApi.set("bg_image_opacity", bgOpacity);
      setBgUrlSaved(true);
      toast("success", "背景设置已保存");
    } catch { toast("error", "保存失败"); }
    finally { setBgSaving(false); }
  };

  const handleUploadBg = async (file: File) => {
    trackAction("设置", "上传背景图片", file.name);
    if (!file.type.startsWith("image/")) { toast("error", "只支持图片文件"); return; }
    if (file.size > 5 * 1024 * 1024) { toast("error", "文件不能超过 5MB"); return; }
    setBgUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (data.url) {
        setBgUrl(data.url);
        setBgUrlSaved(true);
        await settingsApi.set("bg_image_url", data.url);
      }
    } catch { toast("error", "上传失败"); }
    finally { setBgUploading(false); }
  };

  // ── Notification Channels ──────────────────────

  const loadChannels = async () => {
    setChannelsLoading(true);
    setChannelsError(null);
    try {
      const { value } = await settingsApi.get("notification_channels");
      if (value) {
        setChannels(JSON.parse(value) as NotificationChannel[]);
      } else {
        setChannels([]);
      }
    } catch (e) {
      setChannelsError(e instanceof Error ? e.message : "加载通知渠道失败");
    } finally {
      setChannelsLoading(false);
    }
  };

  const openChannelAdd = () => {
    setEditingChannel(null);
    setChannelFormName("");
    setChannelFormType("slack");
    setChannelFormUrl("");
    setChannelDialogOpen(true);
  };

  const openChannelEdit = (ch: NotificationChannel) => {
    setEditingChannel(ch);
    setChannelFormName(ch.name);
    setChannelFormType(ch.type);
    setChannelFormUrl(ch.url);
    setChannelDialogOpen(true);
  };

  const closeChannelDialog = () => {
    setChannelDialogOpen(false);
    setEditingChannel(null);
    setChannelFormName("");
    setChannelFormType("slack");
    setChannelFormUrl("");
  };

  const handleSaveChannel = async () => {
    if (!channelFormName.trim() || !channelFormUrl.trim()) {
      toast("error", "请填写完整的渠道信息");
      return;
    }
    trackAction("通知渠道", editingChannel ? "编辑渠道" : "添加渠道", channelFormName.trim());
    setChannelSaving(true);
    try {
      const newChannel: NotificationChannel = {
        name: channelFormName.trim(),
        type: channelFormType,
        url: channelFormUrl.trim(),
      };
      let updated: NotificationChannel[];
      if (editingChannel) {
        updated = channels.map((c) =>
          c.name === editingChannel.name && c.type === editingChannel.type ? newChannel : c
        );
      } else {
        updated = [...channels, newChannel];
      }
      await settingsApi.set("notification_channels", JSON.stringify(updated));
      setChannels(updated);
      closeChannelDialog();
      toast("success", editingChannel ? "渠道已更新" : "渠道已添加");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "保存失败");
    } finally {
      setChannelSaving(false);
    }
  };

  const handleDeleteChannel = async (ch: NotificationChannel) => {
    if (!confirm(`确定要删除通知渠道「${ch.name}」吗？`)) return;
    trackAction("通知渠道", "删除渠道", ch.name);
    try {
      const updated = channels.filter(
        (c) => !(c.name === ch.name && c.type === ch.type)
      );
      await settingsApi.set("notification_channels", JSON.stringify(updated));
      setChannels(updated);
      toast("success", "渠道已删除");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "删除失败");
    }
  };

  // ── Report Schedule ────────────────────────────

  const loadReportSchedule = async () => {
    try {
      const { value } = await settingsApi.get("report_schedule");
      if (value) {
        const cfg = JSON.parse(value);
        setReportEnabled(cfg.enabled ?? false);
        if (cfg.daily) {
          const { time } = cronToTime(cfg.daily);
          setReportDailyTime(time);
        }
        if (cfg.weekly) {
          const { time, day } = cronToTime(cfg.weekly);
          setReportWeeklyTime(time);
          if (day) setReportWeeklyDay(String(day));
        }
        if (cfg.channels) setReportChannels(cfg.channels.join(", "));
      }
    } catch { /* silent */ }
  };

  const handleSaveReportSchedule = async () => {
    trackAction("设置", "保存报告设置");
    setReportScheduleSaving(true);
    try {
      await settingsApi.set("report_schedule", JSON.stringify({
        enabled: reportEnabled,
        daily: timeToCron(reportDailyTime),
        weekly: timeToCron(reportWeeklyTime, parseInt(reportWeeklyDay)),
        channels: reportChannels.split(",").map(s => s.trim()).filter(Boolean),
      }));
      toast("success", "报告设置已保存");
    } catch {
      toast("error", "保存失败");
    } finally {
      setReportScheduleSaving(false);
    }
  };

  const handleTestChannel = async () => {
    if (!channelFormUrl.trim()) {
      toast("error", "请先填写 Webhook URL");
      return;
    }
    trackAction("通知渠道", "测试发送", channelFormUrl.trim());
    setChannelTesting(true);
    try {
      // Use backend endpoint for proper platform-specific formatting
      const res = await fetch("/api/alerts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: channelFormUrl.trim(),
          type: editingChannel?.type || channelFormType,
          name: channelFormName.trim() || undefined,
        }),
      });
      if (res.ok) {
        toast("success", "测试消息已发送");
      } else {
        const body = await res.json().catch(() => ({}));
        toast("error", body.error || `发送失败 (HTTP ${res.status})`);
      }
    } catch {
      toast("error", "发送失败，请检查 URL 是否正确");
    } finally {
      setChannelTesting(false);
    }
  };

  const loadServers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await serversApi.list();
      setServers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load servers");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formName.trim() || !formUrl.trim()) return;
    trackAction("服务器管理", editingServer ? "编辑服务器" : "添加服务器", formName.trim());
    setSaving(true);
    try {
      const labels = formLabels.trim()
        ? formLabels.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;
      if (editingServer) {
        await serversApi.update(editingServer.id, {
          name: formName.trim(),
          metricsUrl: formUrl.trim(),
          labels,
        });
      } else {
        await serversApi.create({
          name: formName.trim(),
          metricsUrl: formUrl.trim(),
          labels,
        });
      }
      setShowForm(false);
      setEditingServer(null);
      setFormName("");
      setFormUrl("");
      setFormLabels("");
      await loadServers();
      toast("success", editingServer ? "服务器已更新" : "服务器已添加");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "保存服务器失败");
    } finally {
      setSaving(false);
    }
  };

  const handleEditServer = (srv: Server) => {
    setEditingServer(srv);
    setFormName(srv.name);
    setFormUrl(srv.metricsUrl);
    setFormLabels((srv.labels || []).join(", "));
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this server?")) return;
    trackAction("服务器管理", "删除服务器", String(id));
    try {
      await serversApi.remove(id);
      await loadServers();
      toast("success", "服务器已删除");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "删除服务器失败");
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingServer(null);
    setFormName("");
    setFormUrl("");
    setFormLabels("");
  };

  // ── Links ────────────────────────────────────────

  const loadLinks = async () => {
    setLinksLoading(true);
    setLinksError(null);
    try {
      const data = await linksApi.list();
      setLinks(data);
    } catch (e) {
      setLinksError(e instanceof Error ? e.message : "Failed to load links");
    } finally {
      setLinksLoading(false);
    }
  };

  const handleAddLink = async () => {
    if (!linkFormTitle.trim() || !linkFormUrl.trim()) return;
    trackAction("网址导航", editingLink ? "编辑链接" : "添加链接", linkFormTitle.trim());
    setLinkSaving(true);
    try {
      if (editingLink) {
        await linksApi.update(editingLink.id, {
          title: linkFormTitle.trim(),
          url: linkFormUrl.trim(),
          category: linkFormCategory.trim() || undefined,
        });
      } else {
        await linksApi.create({
          title: linkFormTitle.trim(),
          url: linkFormUrl.trim(),
          category: linkFormCategory.trim() || undefined,
        });
      }
      setShowLinkForm(false);
      setEditingLink(null);
      setLinkFormTitle("");
      setLinkFormUrl("");
      setLinkFormCategory("");
      await loadLinks();
      toast("success", editingLink ? "链接已更新" : "链接已添加");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "保存链接失败");
    } finally {
      setLinkSaving(false);
    }
  };

  const handleEditLink = (link: NavLink) => {
    setEditingLink(link);
    setLinkFormTitle(link.title);
    setLinkFormUrl(link.url);
    setLinkFormCategory(link.category || "");
    setShowLinkForm(true);
  };

  const handleDeleteLink = async (id: number) => {
    if (!confirm("确定要删除这个链接吗？")) return;
    trackAction("网址导航", "删除链接", String(id));
    try {
      await linksApi.remove(id);
      await loadLinks();
      toast("success", "链接已删除");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "删除链接失败");
    }
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-lg font-semibold text-foreground">Settings</h1>

      {/* ── Section 1: Data Sources ──────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Data Sources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <DataSourceItem
            label="OpenCode 数据库路径"
            value="~/.local/share/opencode/opencode.db"
            connected
          />

          <Separator />

          <div className="space-y-1.5">
            <Label>DeepSeek API 密钥</Label>
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Input
                  type={dsKeyMasked && dsKeySaved ? "password" : "text"}
                  value={dsKey}
                  onChange={(e) => { setDsKey(e.target.value); setDsKeySaved(false); }}
                  placeholder="输入 DeepSeek API 密钥"
                  className="pr-9 font-mono"
                />
                {dsKeySaved && dsKey && (
                  <button
                    onClick={() => setDsKeyMasked(!dsKeyMasked)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {dsKeyMasked ? "显示" : "隐藏"}
                  </button>
                )}
              </div>
              <Button
                onClick={handleSaveDsKey}
                disabled={dsKeySaving || !dsKey.trim()}
              >
                {dsKeySaving ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label>OpenCode API 地址</Label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Input
                  type="text"
                  value={ocUrl}
                  onChange={(e) => { setOcUrl(e.target.value); setOcUrlSaved(false); }}
                  placeholder="https://example.com/api/opencode/usage"
                  className="font-mono"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>OpenCode API 密钥</Label>
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Input
                  type={ocKeyMasked && ocKeySaved ? "password" : "text"}
                  value={ocKey}
                  onChange={(e) => { setOcKey(e.target.value); setOcKeySaved(false); }}
                  placeholder="输入 OpenCode API 密钥"
                  className="pr-9 font-mono"
                />
                {ocKeySaved && ocKey && (
                  <button
                    onClick={() => setOcKeyMasked(!ocKeyMasked)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {ocKeyMasked ? "显示" : "隐藏"}
                  </button>
                )}
              </div>
              <Button
                onClick={handleSaveOcConfig}
                disabled={ocSaving}
              >
                {ocSaving ? "保存中..." : "保存"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              留空则使用本地 SQLite 数据。Agent 内置端点：<code className="text-muted-foreground/70">http://&lt;agent-host&gt;:9100/api/opencode/sessions</code>
            </p>
          </div>

          <Separator />

          <DataSourceItem
            label="PostgreSQL 连接"
            value="postgresql://zhangyuan@100.125.148.23:5432/tf_dashboard"
            connected
          />

          <Separator />

          {/* 背景图片设置 */}
          <div className="space-y-1.5">
            <Label>背景图片</Label>
            <div className="flex items-start gap-4">
              <label
                className="flex flex-col items-center justify-center w-32 h-20 rounded-lg border-2 border-dashed border-border bg-muted/50 cursor-pointer transition-colors hover:bg-muted"
                style={bgUrl ? { backgroundImage: `url(${bgUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
              >
                {!bgUrl && (
                  <div className="text-center">
                    <span className="text-xs text-muted-foreground">
                      {bgUploading ? "上传中..." : "点击上传"}
                    </span>
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadBg(f); }} />
              </label>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">透明度 {bgOpacity}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="range" min="5" max="80" value={bgOpacity}
                    onChange={(e) => setBgOpacity(e.target.value)}
                    className="flex-1 h-1.5 rounded-full cursor-pointer accent-primary" />
                  <Button onClick={handleSaveBg} disabled={bgSaving} size="sm">
                    {bgSaving ? "保存中..." : "保存"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* 每月预算 */}
          <div className="space-y-1.5">
            <Label>每月预算 (USD)</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number" min="0" step="10"
                value={monthlyBudgetInput}
                onChange={(e) => setMonthlyBudgetInput(e.target.value)}
                placeholder="例如: 100"
                className="w-32 font-mono"
              />
              <Button
                onClick={async () => {
                  trackAction("设置", "保存预算");
                  await settingsApi.set("monthly_budget", monthlyBudgetInput);
                  toast("success", "预算已保存");
                }}
                size="sm"
              >
                保存
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Servers Management ────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Servers</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowForm((v) => !v)}
          >
            <Plus size={14} weight="bold" />
            Add Server
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Server Form */}
          {showForm && (
            <Card size="sm" className="mb-4">
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label>Name</Label>
                    <Input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="sv-01"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Metrics URL</Label>
                    <Input
                      type="text"
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                      placeholder="http://192.168.1.10:9100/metrics"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Labels</Label>
                    <Input
                      type="text"
                      value={formLabels}
                      onChange={(e) => setFormLabels(e.target.value)}
                      placeholder="prod,web"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={handleCancelForm}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saving || !formName.trim() || !formUrl.trim()}
                  >
                    {saving ? "保存中..." : editingServer ? "更新" : "保存"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Server Table */}
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-destructive">{error}</div>
          ) : servers.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              暂无服务器
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right w-16">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {servers.map((server) => (
                  <TableRow key={server.id}>
                    <TableCell className="font-medium">{server.name}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {server.metricsUrl}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          server.isActive
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-muted/10 text-muted-foreground border-border"
                        }
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            server.isActive ? "bg-emerald-500" : "bg-muted-foreground"
                          }`}
                        />
                        {server.isActive ? "Online" : "Offline"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleEditServer(server)}
                          title="编辑"
                        >
                          <NotePencil size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDelete(server.id)}
                          title="删除"
                          className="text-destructive hover:text-destructive/80"
                        >
                          <TrashSimple size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Section 3: 网址导航 (Link Management) ──── */}
      <Card>
        <CardHeader>
          <CardTitle>网址导航</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLinkForm((v) => !v)}
          >
            <Plus size={14} weight="bold" />
            添加链接
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Link Form */}
          {showLinkForm && (
            <Card size="sm" className="mb-4">
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label>名称</Label>
                    <Input
                      type="text"
                      value={linkFormTitle}
                      onChange={(e) => setLinkFormTitle(e.target.value)}
                      placeholder="DeepSeek"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>网址</Label>
                    <Input
                      type="text"
                      value={linkFormUrl}
                      onChange={(e) => setLinkFormUrl(e.target.value)}
                      placeholder="https://chat.deepseek.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>分类</Label>
                    <Input
                      type="text"
                      value={linkFormCategory}
                      onChange={(e) => setLinkFormCategory(e.target.value)}
                      placeholder="AI"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowLinkForm(false);
                      setEditingLink(null);
                      setLinkFormTitle("");
                      setLinkFormUrl("");
                      setLinkFormCategory("");
                    }}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleAddLink}
                    disabled={linkSaving || !linkFormTitle.trim() || !linkFormUrl.trim()}
                  >
                    {linkSaving ? "保存中..." : editingLink ? "更新" : "保存"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Link Table */}
          {linksLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : linksError ? (
            <div className="p-8 text-center text-sm text-destructive">{linksError}</div>
          ) : links.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              暂无链接
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>网址</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead className="text-right w-16">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell className="font-medium">
                      {link.icon && (
                        <span className="mr-2">{link.icon}</span>
                      )}
                      {link.title}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-foreground transition-colors"
                      >
                        {link.url}
                      </a>
                    </TableCell>
                    <TableCell>
                      {link.category && (
                        <Badge variant="secondary">{link.category}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleEditLink(link)}
                          title="编辑"
                        >
                          <NotePencil size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDeleteLink(link.id)}
                          title="删除"
                          className="text-destructive hover:text-destructive/80"
                        >
                          <TrashSimple size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Section 4: Polling Intervals ────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Polling Intervals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <IntervalField label="后台刷新(秒)" settingKey="interval_refetch" placeholder="30" />
            <IntervalField label="OpenCode 采集(秒)" settingKey="interval_opencode" placeholder="60" />
            <IntervalField label="DeepSeek 轮询(秒)" settingKey="interval_deepseek" placeholder="300" />
          </div>
        </CardContent>
      </Card>

      {/* ── Section 5: Notification Channels ───────── */}
      <Card>
        <CardHeader>
          <CardTitle>通知渠道</CardTitle>
          <Button variant="outline" size="sm" onClick={openChannelAdd}>
            <Plus size={14} weight="bold" />
            添加渠道
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {channelsLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">加载中...</div>
          ) : channelsError ? (
            <div className="p-8 text-center text-sm text-destructive">{channelsError}</div>
          ) : channels.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">暂无通知渠道</div>
          ) : (
            <div className="space-y-2">
              {channels.map((ch, idx) => (
                <div
                  key={`${ch.type}-${ch.name}-${idx}`}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-muted/30"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {ch.name}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        {CHANNEL_TYPE_LABEL[ch.type] || ch.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate font-mono">
                      {ch.url}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openChannelEdit(ch)}
                      title="编辑"
                    >
                      <NotePencil size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDeleteChannel(ch)}
                      title="删除"
                      className="text-destructive hover:text-destructive/80"
                    >
                      <TrashSimple size={16} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Channel Dialog ─────────────────────────── */}
      <Dialog open={channelDialogOpen} onOpenChange={setChannelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingChannel ? "编辑通知渠道" : "添加通知渠道"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>渠道名称</Label>
              <Input
                value={channelFormName}
                onChange={(e) => setChannelFormName(e.target.value)}
                placeholder="例如: 运维群"
              />
            </div>
            <div className="space-y-1.5">
              <Label>渠道类型</Label>
              <Select
                value={channelFormType}
                onValueChange={(v) => setChannelFormType(v as NotificationChannel["type"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CHANNEL_TYPE_LABEL) as NotificationChannel["type"][]).map(
                    (key) => (
                      <SelectItem key={key} value={key}>
                        {CHANNEL_TYPE_LABEL[key]}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Webhook URL</Label>
              <Input
                value={channelFormUrl}
                onChange={(e) => setChannelFormUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                className="font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleTestChannel}
              disabled={channelTesting || !channelFormUrl.trim()}
              size="sm"
            >
              {channelTesting ? "发送中..." : "测试发送"}
            </Button>
            <div className="flex-1" />
            <Button variant="ghost" onClick={closeChannelDialog}>
              取消
            </Button>
            <Button
              onClick={handleSaveChannel}
              disabled={channelSaving || !channelFormName.trim() || !channelFormUrl.trim()}
            >
              {channelSaving ? "保存中..." : editingChannel ? "更新" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Section 6: Report Schedule ──────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>定期报告</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Enable toggle */}
          <div className="space-y-1.5">
            <Label>启用报告</Label>
            <div className="flex items-center gap-2">
              <Button
                variant={reportEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => setReportEnabled(true)}
              >
                启用
              </Button>
              <Button
                variant={!reportEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => setReportEnabled(false)}
              >
                禁用
              </Button>
            </div>
          </div>

          <Separator />

          {/* Daily report time */}
          <div className="space-y-1.5">
            <Label>日报发送时间</Label>
            <Input
              type="time"
              value={reportDailyTime}
              onChange={(e) => setReportDailyTime(e.target.value)}
              className="w-32"
            />
          </div>

          {/* Weekly report time */}
          <div className="space-y-1.5">
            <Label>周报发送时间</Label>
            <div className="flex items-center gap-3">
              <Input
                type="time"
                value={reportWeeklyTime}
                onChange={(e) => setReportWeeklyTime(e.target.value)}
                className="w-32"
              />
              <Select
                value={reportWeeklyDay}
                onValueChange={(v) => setReportWeeklyDay(v ?? "1")}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {DAY_LABELS[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Notification channels */}
          <div className="space-y-1.5">
            <Label>通知渠道</Label>
            <Input
              value={reportChannels}
              onChange={(e) => setReportChannels(e.target.value)}
              placeholder={'渠道名以逗号分隔，在「通知渠道」中配置'}
            />
            <p className="text-xs text-muted-foreground">
              渠道名以逗号分隔，在「通知渠道」中配置
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleSaveReportSchedule}
              disabled={reportScheduleSaving}
            >
              {reportScheduleSaving ? "保存中..." : "保存"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 7: About ────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-sm text-card-foreground font-medium">
            tf-dashboard v0.1.0
          </p>
          <p className="text-xs text-muted-foreground">
            技术栈 Bun + Hono + React + TypeScript + PostgreSQL
          </p>
          <p className="text-xs text-muted-foreground">
            Data: OpenCode SQLite · DeepSeek API · HTTP /metrics
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────

function DataSourceItem({
  label,
  value,
  connected,
}: {
  label: string;
  value: string;
  connected: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <Input value={value} readOnly className="font-mono truncate" />
        <Badge
          variant="outline"
          className={
            connected
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shrink-0"
              : "bg-destructive/10 text-destructive border-destructive/20 shrink-0"
          }
        >
          {connected ? (
            <CheckCircle size={12} weight="fill" />
          ) : (
            <WarningCircle size={12} weight="fill" />
          )}
          {connected ? "已连接" : "未连接"}
        </Badge>
      </div>
    </div>
  );
}

function IntervalField({ label, settingKey, placeholder }: { label: string; settingKey: string; placeholder: string }) {
  const [val, setVal] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { settingsApi.get(settingKey).then((r) => setVal(r.value || "")).catch(() => {}); }, []);
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input value={val} onChange={(e) => { setVal(e.target.value); setSaved(false); }} placeholder={placeholder} className="w-24 font-mono" />
        <Button size="sm" disabled={saving || !val} onClick={async () => {
          setSaving(true);
          await settingsApi.set(settingKey, val);
          setSaved(true);
          setSaving(false);
        }}>{saving ? "..." : saved ? "已保存" : "保存"}</Button>
      </div>
    </div>
  );
}

// ─── Cron Helpers ──────────────────────────────────

const DAY_LABELS: Record<number, string> = {
  1: "周一", 2: "周二", 3: "周三", 4: "周四", 5: "周五", 6: "周六", 7: "周日",
};

function timeToCron(time: string, day?: number): string {
  const [h, m] = time.split(":");
  if (day !== undefined) {
    return `${m} ${h} * * ${day}`;
  }
  return `${m} ${h} * * *`;
}

function cronToTime(cron: string): { time: string; day?: number } {
  const parts = cron.split(" ");
  const time = `${parts[1]}:${parts[0]}`;
  if (parts[4] !== "*") {
    return { time, day: parseInt(parts[4]) };
  }
  return { time };
}
