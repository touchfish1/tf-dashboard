import { ArrowsClockwise } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  onClick: () => void;
  loading?: boolean;
  lastUpdated?: Date | null;
}

export default function RefreshButton({ onClick, loading, lastUpdated }: Props) {
  const ago = lastUpdated
    ? formatAgo(lastUpdated)
    : null;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {ago && <span>更新于 {ago}</span>}
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onClick}
        disabled={loading}
        className={cn(loading && "animate-spin")}
      >
        <ArrowsClockwise size={14} />
      </Button>
    </div>
  );
}

function formatAgo(date: Date): string {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return `${sec}秒前`;
  if (sec < 3600) return `${Math.floor(sec / 60)}分钟前`;
  return `${Math.floor(sec / 3600)}小时前`;
}
