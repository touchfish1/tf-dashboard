import { useState, useEffect } from "react";
import { Sliders, X, Check } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { dashboardConfigApi } from "@/api";
import type { DashboardConfig, DashboardSection } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  onConfigChange: (config: DashboardConfig) => void;
}

export default function DashboardConfig({ onConfigChange }: Props) {
  const [open, setOpen] = useState(false);
  const [sections, setSections] = useState<DashboardSection[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dashboardConfigApi.get().then((cfg) => setSections(cfg.sections));
  }, []);

  const toggle = (id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s))
    );
  };

  const save = async () => {
    setSaving(true);
    const config: DashboardConfig = { sections };
    await dashboardConfigApi.save(config);
    onConfigChange(config);
    setSaving(false);
    setOpen(false);
  };

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <Sliders size={14} />
        <span className="hidden sm:inline">配置</span>
      </Button>
    );
  }

  return (
    <Card className="w-64 shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between py-2.5 px-3">
        <CardTitle className="text-xs font-medium">面板配置</CardTitle>
        <button
          onClick={() => setOpen(false)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={14} />
        </button>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0 space-y-1">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => toggle(s.id)}
            className={cn(
              "flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs transition-colors text-left",
              s.visible
                ? "text-foreground hover:bg-muted"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <div
              className={cn(
                "w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors",
                s.visible
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-border"
              )}
            >
              {s.visible && <Check size={10} weight="bold" />}
            </div>
            {s.title}
          </button>
        ))}
        <Button
          size="xs"
          className="w-full mt-2"
          onClick={save}
          disabled={saving}
        >
          {saving ? "保存中..." : "保存"}
        </Button>
      </CardContent>
    </Card>
  );
}
