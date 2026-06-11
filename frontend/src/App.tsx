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

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <ErrorBoundary>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route
                path="/dashboard"
                element={
                  <ErrorBoundary>
                    <Suspense fallback={<PageFallback />}>
                      <DashboardPage />
                    </Suspense>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/opencode"
                element={
                  <ErrorBoundary>
                    <Suspense fallback={<PageFallback />}>
                      <OpenCodePage />
                    </Suspense>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/deepseek"
                element={
                  <ErrorBoundary>
                    <Suspense fallback={<PageFallback />}>
                      <DeepSeekPage />
                    </Suspense>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/server"
                element={
                  <ErrorBoundary>
                    <Suspense fallback={<PageFallback />}>
                      <ServerPage />
                    </Suspense>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/server/:id"
                element={
                  <ErrorBoundary>
                    <Suspense fallback={<PageFallback />}>
                      <ServerPage />
                    </Suspense>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/settings"
                element={
                  <ErrorBoundary>
                    <Suspense fallback={<PageFallback />}>
                      <SettingsPage />
                    </Suspense>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/audit"
                element={
                  <ErrorBoundary>
                    <Suspense fallback={<PageFallback />}>
                      <AuditLogPage />
                    </Suspense>
                  </ErrorBoundary>
                }
              />
            </Route>
          </Routes>
        </ErrorBoundary>
      </ToastProvider>
    </BrowserRouter>
  );
}
