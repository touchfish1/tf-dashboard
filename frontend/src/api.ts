import type {
  Server, ServerMetrics, ServerSummary,
  OpenCodeUsage, OpenCodeSummary, OpenCodeByModel,
  DeepSeekBalance, NavLink,
} from "./types";

const BASE = "/api";

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`GET ${path}: ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path}: ${res.status}`);
  return res.json();
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${path}: ${res.status}`);
  return res.json();
}

async function del(path: string): Promise<void> {
  const res = await fetch(BASE + path, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE ${path}: ${res.status}`);
}

// ─── Helpers for PUT / PATCH ──────────────────────
async function patchReq<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path}: ${res.status}`);
  return res.json();
}

// ─── Servers ─────────────────────────────────────
export const serversApi = {
  list: () => get<Server[]>("/api/servers"),
  get: (id: number) => get<Server>(`/api/servers/${id}`),
  create: (body: { name: string; metricsUrl: string; labels?: string[] }) =>
    post<Server>("/servers", body),
  update: (id: number, body: { name?: string; metricsUrl?: string; labels?: string[]; isActive?: boolean }) =>
    patchReq<Server>(`/servers/${id}`, body),
  remove: (id: number) => del(`/servers/${id}`),
  metrics: (id: number, limit = 100) =>
    get<ServerMetrics[]>(`/api/servers/${id}/metrics`, { limit: String(limit) }),
  summary: (id: number, days = 1) =>
    get<ServerSummary>(`/api/servers/${id}/summary`, { days: String(days) }),
};

// ─── OpenCode ────────────────────────────────────
export const opencodeApi = {
  summary: () => get<OpenCodeSummary>("/api/opencode/summary"),
  usage: (days = 7) => get<OpenCodeUsage[]>("/api/opencode/usage", { days: String(days) }),
  byModel: (days = 7) => get<OpenCodeByModel[]>("/api/opencode/by-model", { days: String(days) }),
};

// ─── DeepSeek ────────────────────────────────────
export const deepseekApi = {
  balance: () => get<DeepSeekBalance>("/api/deepseek/balance"),
  history: (days = 30) => get<DeepSeekBalance[]>("/api/deepseek/history", { days: String(days) }),
};

// ─── Nav Links ────────────────────────────────────
export const linksApi = {
  list: () => get<NavLink[]>("/api/links"),
  create: (b: { title: string; url: string; icon?: string; category?: string }) =>
    post<NavLink>("/links", b),
  update: (id: number, b: { title?: string; url?: string; category?: string }) =>
    put<NavLink>(`/links/${id}`, b),
  remove: (id: number) => del(`/links/${id}`),
};

// ─── Settings ─────────────────────────────────────
export const settingsApi = {
  getAll: () => get<Record<string, string>>("/api/settings"),
  get: (key: string) => get<{ value: string | null }>(`/api/settings/${key}`),
  set: (key: string, value: string) =>
    fetch(`/api/settings/${key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    }).then((r) => r.json()),
  remove: (key: string) =>
    fetch(`/api/settings/${key}`, { method: "DELETE" }).then((r) => r.json()),
};
