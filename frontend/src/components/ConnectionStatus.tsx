import { useState, useEffect } from "react";
import { WifiSlash } from "@phosphor-icons/react";

export default function ConnectionStatus() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = () => {
      fetch("/health", { signal: AbortSignal.timeout(5000) })
        .then((r) => {
          if (!cancelled) setOffline(!r.ok);
        })
        .catch(() => {
          if (!cancelled) setOffline(true);
        });
    };

    check();
    const iv = setInterval(check, 15000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 bg-destructive py-1.5 text-[11px] font-medium text-destructive-foreground shadow-lg">
      <WifiSlash size={14} weight="bold" />
      后端服务连接异常，部分功能不可用
    </div>
  );
}
