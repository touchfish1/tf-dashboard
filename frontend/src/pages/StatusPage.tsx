import PollerStatus from "@/components/PollerStatus";

export default function StatusPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">轮询器状态</h1>
      </div>
      <PollerStatus />
    </div>
  );
}
