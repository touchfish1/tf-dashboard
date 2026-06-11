import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ToastProvider } from "@/components/Toast";
import Layout from "./Layout";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const OpenCodePage = lazy(() => import("./pages/OpenCodePage"));
const DeepSeekPage = lazy(() => import("./pages/DeepSeekPage"));
const ServerPage = lazy(() => import("./pages/ServerPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const AuditLogPage = lazy(() => import("./pages/AuditLogPage"));

function PageFallback() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top bar skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-32" />
      </div>
      {/* Content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-[300px] w-full rounded-xl" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-[300px] w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="text-6xl font-bold text-muted-foreground/30">404</div>
      <p className="text-sm text-muted-foreground">页面不存在</p>
      <a href="/dashboard" className="text-sm text-primary hover:underline">返回总览</a>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <ErrorBoundary>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Suspense fallback={<PageFallback />}><DashboardPage /></Suspense>} />
              <Route path="/opencode" element={<Suspense fallback={<PageFallback />}><OpenCodePage /></Suspense>} />
              <Route path="/deepseek" element={<Suspense fallback={<PageFallback />}><DeepSeekPage /></Suspense>} />
              <Route path="/server" element={<Suspense fallback={<PageFallback />}><ServerPage /></Suspense>} />
              <Route path="/server/:id" element={<Suspense fallback={<PageFallback />}><ServerPage /></Suspense>} />
              <Route path="/settings" element={<Suspense fallback={<PageFallback />}><SettingsPage /></Suspense>} />
              <Route path="/audit" element={<Suspense fallback={<PageFallback />}><AuditLogPage /></Suspense>} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </ErrorBoundary>
      </ToastProvider>
    </BrowserRouter>
  );
}
