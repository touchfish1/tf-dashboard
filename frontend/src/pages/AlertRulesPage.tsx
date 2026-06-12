import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  TrashSimple,
  NotePencil,
  X,
  CaretDown,
} from "@phosphor-icons/react";
import { trackAction } from "../lib/tracking";
import { alertRulesApi } from "../api";
import type { AlertRule, RuleCondition } from "../types";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
import { useToast } from "@/components/Toast";

// ─── Lookup maps ────────────────────────────────

const FIELDS: { value: RuleCondition["field"]; label: string }[] = [
  { value: "deepseek_balance", label: "DeepSeek 余额" },
  { value: "server_offline", label: "服务器离线" },
  { value: "opencode_etl_error", label: "OpenCode 采集失败" },
  { value: "opencode_cost_anomaly", label: "OpenCode 费用异常" },
  { value: "monthly_budget_pct", label: "月度预算使用率" },
  { value: "cpu_percent", label: "CPU 使用率" },
  { value: "memory_percent", label: "内存使用率" },
];

const OPERATORS: { value: RuleCondition["operator"]; label: string }[] = [
  { value: "lt", label: "小于" },
  { value: "lte", label: "小于等于" },
  { value: "gt", label: "大于" },
  { value: "gte", label: "大于等于" },
  { value: "eq", label: "等于" },
  { value: "true", label: "发生时触发" },
];

const SEVERITY_OPTIONS: { value: AlertRule["severity"]; label: string }[] = [
  { value: "info", label: "信息" },
  { value: "warning", label: "警告" },
  { value: "critical", label: "严重" },
];

const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive border-destructive/20",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  info: "bg-sky-500/10 text-sky-400 border-sky-500/20",
};

const FIELD_LABEL: Record<string, string> = Object.fromEntries(
  FIELDS.map((f) => [f.value, f.label])
);

const OPERATOR_LABEL: Record<string, string> = Object.fromEntries(
  OPERATORS.map((o) => [o.value, o.label])
);

function conditionSummary(c: RuleCondition): string {
  const field = FIELD_LABEL[c.field] || c.field;
  if (c.operator === "true" || c.field === "server_offline" || c.field === "opencode_etl_error") {
    return `${field} = 发生时触发`;
  }
  const op = OPERATOR_LABEL[c.operator] || c.operator;
  return `${field} ${op} ${c.value ?? "?"}`;
}

const MATCH_MODE_LABEL: Record<string, string> = {
  all: "所有条件满足",
  any: "任一条件满足",
};

// ─── Default form state ─────────────────────────

function emptyForm(): RuleFormData {
  return {
    name: "",
    enabled: true,
    severity: "warning" as AlertRule["severity"],
    matchMode: "all" as "all" | "any",
    conditions: [{ field: "deepseek_balance", operator: "lt", value: 5 }],
    cooldownMinutes: 5,
    notificationChannels: [],
  };
}

interface RuleFormData {
  name: string;
  enabled: boolean;
  severity: AlertRule["severity"];
  matchMode: "all" | "any";
  conditions: RuleCondition[];
  cooldownMinutes: number;
  notificationChannels: string[];
}

// ─── Page component ─────────────────────────────

export default function AlertRulesPage() {
  const { toast } = useToast();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [formData, setFormData] = useState<RuleFormData>(emptyForm());
  const [saving, setSaving] = useState(false);

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await alertRulesApi.list();
      setRules(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载告警规则失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  // ── Dialog open / close ──────────────────────

  const openAddDialog = () => {
    setEditingRule(null);
    setFormData(emptyForm());
    setDialogOpen(true);
  };

  const openEditDialog = (rule: AlertRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      enabled: rule.enabled,
      severity: rule.severity,
      matchMode: rule.matchMode,
      conditions: rule.conditions.map((c) => ({ ...c })),
      cooldownMinutes: rule.cooldownMinutes,
      notificationChannels: [...rule.notificationChannels],
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingRule(null);
  };

  // ── Form actions ─────────────────────────────

  const updateCondition = (idx: number, key: keyof RuleCondition, value: unknown) => {
    const conditions = formData.conditions.map((c) => ({ ...c }));

    if (key === "field") {
      const field = value as RuleCondition["field"];
      let op = conditions[idx].operator;
      let val = conditions[idx].value;

      if (field === "server_offline" || field === "opencode_etl_error") {
        op = "true";
        val = undefined;
      } else if (op === "true") {
        op = "lt";
      }

      conditions[idx] = { field, operator: op, value: val } as RuleCondition;
    } else if (key === "operator") {
      const operator = value as RuleCondition["operator"];
      conditions[idx] = {
        ...conditions[idx],
        operator,
        value: operator === "true" ? undefined : conditions[idx].value,
      };
    } else if (key === "value") {
      conditions[idx] = { ...conditions[idx], value: value as number | undefined };
    }

    setFormData({ ...formData, conditions });
  };

  const addCondition = () => {
    setFormData({
      ...formData,
      conditions: [
        ...formData.conditions,
        { field: "deepseek_balance", operator: "lt", value: 5 },
      ],
    });
  };

  const removeCondition = (idx: number) => {
    if (formData.conditions.length <= 1) return;
    setFormData({
      ...formData,
      conditions: formData.conditions.filter((_, i) => i !== idx),
    });
  };

  const changeChannels = (channels: string[]) => {
    setFormData({ ...formData, notificationChannels: channels });
  };

  // ── Save / Delete / Toggle ───────────────────

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast("error", "请输入规则名称");
      return;
    }
    if (formData.conditions.length === 0) {
      toast("error", "至少需要一个条件");
      return;
    }

    trackAction("告警规则", editingRule ? "编辑规则" : "添加规则", formData.name.trim());
    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        enabled: formData.enabled,
        severity: formData.severity,
        matchMode: formData.matchMode,
        conditions: formData.conditions,
        cooldownMinutes: formData.cooldownMinutes,
        notificationChannels: formData.notificationChannels,
      };

      if (editingRule) {
        await alertRulesApi.update(editingRule.id, payload);
        toast("success", "规则已更新");
      } else {
        await alertRulesApi.create(payload);
        toast("success", "规则已添加");
      }

      closeDialog();
      await loadRules();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rule: AlertRule) => {
    if (!confirm(`确定要删除规则「${rule.name}」吗？`)) return;
    trackAction("告警规则", "删除规则", rule.name);
    try {
      await alertRulesApi.remove(rule.id);
      await loadRules();
      toast("success", "规则已删除");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "删除失败");
    }
  };

  const handleToggle = async (rule: AlertRule) => {
    trackAction("告警规则", rule.enabled ? "禁用规则" : "启用规则", rule.name);
    try {
      await alertRulesApi.update(rule.id, { enabled: !rule.enabled });
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r))
      );
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "操作失败");
    }
  };

  // ── Render ───────────────────────────────────

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">告警规则</h1>
        <Button onClick={openAddDialog}>
          <Plus size={14} weight="bold" />
          添加规则
        </Button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">加载中...</div>
      ) : error ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : rules.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            暂无告警规则
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onEdit={() => openEditDialog(rule)}
              onDelete={() => handleDelete(rule)}
              onToggle={() => handleToggle(rule)}
            />
          ))}
        </div>
      )}

      {/* ── Rule form dialog ───────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? "编辑规则" : "添加规则"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label>规则名称</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如: DeepSeek 余额不足"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Severity */}
              <div className="space-y-1.5">
                <Label>严重级别</Label>
                <Select
                  value={formData.severity}
                  onValueChange={(v) => setFormData({ ...formData, severity: v as AlertRule["severity"] })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Cooldown */}
              <div className="space-y-1.5">
                <Label>冷却时间(分钟)</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.cooldownMinutes}
                  onChange={(e) =>
                    setFormData({ ...formData, cooldownMinutes: Number(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            {/* Match mode */}
            <div className="space-y-1.5">
              <Label>条件匹配方式</Label>
              <div className="flex gap-1 p-0.5 rounded-lg bg-muted w-fit">
                {(["all", "any"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setFormData({ ...formData, matchMode: mode })}
                    className={`px-3 py-1 text-xs rounded-md transition-colors cursor-pointer ${
                      formData.matchMode === mode
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {MATCH_MODE_LABEL[mode]}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Conditions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>条件</Label>
                <Button variant="outline" size="xs" onClick={addCondition}>
                  <Plus size={12} />
                  添加条件
                </Button>
              </div>

              {formData.conditions.map((cond, idx) => (
                <ConditionRow
                  key={idx}
                  condition={cond}
                  index={idx}
                  onChange={updateCondition}
                  onRemove={removeCondition}
                  canRemove={formData.conditions.length > 1}
                />
              ))}
            </div>

            <Separator />

            {/* Notification channels */}
            <ChannelTagsInput
              value={formData.notificationChannels}
              onChange={changeChannels}
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving || !formData.name.trim()}>
              {saving ? "保存中..." : editingRule ? "更新" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────

function RuleCard({
  rule,
  onEdit,
  onDelete,
  onToggle,
}: {
  rule: AlertRule;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            {/* Top row: name + badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-foreground truncate">
                {rule.name}
              </span>
              <Badge
                variant="outline"
                className={SEVERITY_STYLE[rule.severity] || ""}
              >
                {SEVERITY_OPTIONS.find((s) => s.value === rule.severity)?.label ||
                  rule.severity}
              </Badge>
              <Badge
                variant="outline"
                className={
                  rule.enabled
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-muted/10 text-muted-foreground border-border"
                }
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    rule.enabled ? "bg-emerald-500" : "bg-muted-foreground"
                  }`}
                />
                {rule.enabled ? "已启用" : "已禁用"}
              </Badge>
            </div>

            {/* Conditions summary */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">
                {MATCH_MODE_LABEL[rule.matchMode]}
              </span>
              <CaretDown size={10} className="text-muted-foreground -rotate-90" />
              {rule.conditions.map((c, i) => (
                <span key={i} className="text-xs text-muted-foreground">
                  {conditionSummary(c)}
                  {i < rule.conditions.length - 1 && (
                    <span className="mx-1 text-muted-foreground/50">
                      {rule.matchMode === "all" ? "且" : "或"}
                    </span>
                  )}
                </span>
              ))}
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>冷却: {rule.cooldownMinutes}分钟</span>
              {rule.notificationChannels.length > 0 && (
                <span>通知: {rule.notificationChannels.join(", ")}</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggle}
              title={rule.enabled ? "禁用" : "启用"}
            >
              <span
                className={`w-3 h-3 rounded-sm border ${
                  rule.enabled
                    ? "bg-emerald-500 border-emerald-500"
                    : "bg-transparent border-muted-foreground"
                }`}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onEdit}
              title="编辑"
            >
              <NotePencil size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onDelete}
              title="删除"
              className="text-destructive hover:text-destructive/80"
            >
              <TrashSimple size={16} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ConditionRow({
  condition,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  condition: RuleCondition;
  index: number;
  onChange: (idx: number, key: keyof RuleCondition, value: unknown) => void;
  onRemove: (idx: number) => void;
  canRemove: boolean;
}) {
  const isNoValueField =
    condition.field === "server_offline" || condition.field === "opencode_etl_error";
  const showValueInput = !isNoValueField && condition.operator !== "true";

  return (
    <div className="flex items-start gap-2 p-2.5 rounded-lg border border-border bg-muted/30">
      <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: isNoValueField ? "1fr auto" : showValueInput ? "1fr 1fr 1fr" : "1fr 1fr auto" }}>
        {/* Field select */}
        <Select
          value={condition.field}
          onValueChange={(v) => onChange(index, "field", v)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELDS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Operator select (hidden for boolean-only fields) */}
        {!isNoValueField && (
          <Select
            value={condition.operator}
            onValueChange={(v) => onChange(index, "operator", v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPERATORS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Value input */}
        {showValueInput && (
          <Input
            type="number"
            step="any"
            value={condition.value ?? ""}
            onChange={(e) =>
              onChange(
                index,
                "value",
                e.target.value ? Number(e.target.value) : undefined
              )
            }
            placeholder="阈值"
          />
        )}
      </div>

      {/* Remove button */}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onRemove(index)}
        disabled={!canRemove}
        className="text-destructive hover:text-destructive/80 shrink-0 mt-0.5"
        title="删除条件"
      >
        <TrashSimple size={14} />
      </Button>
    </div>
  );
}

function ChannelTagsInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
      setInput("");
    }
  };

  const handleBlur = () => {
    if (input.trim()) {
      addTag(input);
      setInput("");
    }
  };

  return (
    <div className="space-y-1.5">
      <Label>通知渠道</Label>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter((t) => t !== tag))}
                className="hover:text-foreground cursor-pointer"
              >
                <X size={10} weight="bold" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder="输入渠道名称后按 Enter 添加"
      />
      <p className="text-xs text-muted-foreground">
        输入在设置中配置的通知渠道名称，按 Enter 添加
      </p>
    </div>
  );
}
