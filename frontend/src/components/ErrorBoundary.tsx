import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { WarningCircle } from "@phosphor-icons/react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;

      const isChunkError =
        this.state.error.message.includes("Loading chunk") ||
        this.state.error.message.includes("dynamically imported");

      return (
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-4 text-center max-w-sm">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <WarningCircle size={24} className="text-destructive" />
            </div>
            <h2 className="text-base font-semibold text-foreground">
              {isChunkError ? "页面加载失败" : "出错了"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isChunkError
                ? "页面资源加载异常，可能由于网络波动或版本更新。"
                : this.state.error.message}
            </p>
            <Button variant="default" onClick={this.handleRetry}>
              重试
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
