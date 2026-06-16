import type {
  Server, ServerMetrics, ServerSummary,
  OpenCodeUsage, OpenCodeDailyUsage, OpenCodeSummary, OpenCodeByModel,
  OpenCodePrediction,
  DeepSeekBalance, NavLink, Alert, DashboardConfig, DashboardSection,
  AuditEntry,
  AlertRule,
  ScheduledReport,
  User,
} from "./types";
import { trackApiCall } from "./lib/tracking";
import { getAccessToken, setAccessToken } from "./auth";

const BASE = "/api";
const TIMEOUT_MS = 30000;
const MAX_RETRIES = 2;
const RETRYABLE_STATUS = [408, 429, 502, 503, 504];

// ─── In-flight request deduplication ────────────
const inflightMap = new Map<string, Promise<unknown>>();

function dedupKey(method: string, url: string, body?: unknown): string {
  // For mutation requests include body in key; for GET the URL+method is sufficient
  if (body && method !== "GET") {
    return `${method}:${url}:${JSON.stringify(body)}`;
  }
  return `${method}:${url}`;
}

async function dedupFetch<T>(method: string, url: string, body?: unknown): Promise<T> {
  const key = dedupKey(method, url, body);
  const existing = inflightMap.get(key);
  if (existing) {
    return existing as Promise<T>;
  }
  const promise = apiFetchInner<T>(method, url, body).finally(() => {
    // Only remove if this exact promise is still in the map
    if (inflightMap.get(key) === promise) {
      inflightMap.delete(key);
    }
  });
  inflightMap.set(key, promise);
  return promise;
}

async function fetchWithTimeout(path: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(path, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function parseErrorBody(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body.error || body.message || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

async function trackedFetch(method: string, path: string, options?: RequestInit): Promise<Response> {
  const start = performance.now();
  try {
    const res = await fetchWithTimeout(path, options);
    trackApiCall(path, Math.round(performance.now() - start), res.status, method);
    return res;
  } catch (err) {
    trackApiCall(path, Math.round(performance.now() - start), 0, method);
    throw err;
  }
}

async function apiFetchInner<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = path.startsWith("http") ? path : (path.startsWith("/api") ? path : BASE + path);
  const token = getAccessToken();
  const headers: Record<string, string> = body ? { "Content-Type": "application/json" } : {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const options: RequestInit = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await trackedFetch(method, url, options);

    if (res.ok) {
      if (method === "DELETE") return undefined as T;
      return res.json();
    }

    // On 401 with a token: session expired, force re-login
    if (res.status === 401 && token) {
      setAccessToken(null);
      if (!path.includes("/api/auth/me") && !window.location.pathname.startsWith("/login")) {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      }
      throw new Error(`${method} ${path}: Unauthorized`);
    }

    const errMsg = await parseErrorBody(res);

    // Retry on retryable status or network errors (handled by trackedFetch catch)
    if (attempt < MAX_RETRIES && RETRYABLE_STATUS.includes(res.status)) {
      // Honor Retry-After header for 429 (rate limited)
      let delay: number;
      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        if (retryAfter) {
          delay = parseInt(retryAfter, 10) * 1000;
        } else {
          // Exponential backoff starting at 2s for 429
          delay = Math.min(2000 * Math.pow(2, attempt), 8000);
        }
      } else {
        // Default exponential backoff for other retryable statuses
        delay = Math.min(1000 * Math.pow(2, attempt), 4000);
      }
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    throw new Error(`${method} ${path}: ${errMsg}`);
  }

  throw new Error(`${method} ${path}: max retries exceeded`);
}

// ─── Low-level helpers (used by API objects below) ──────────
const get = <T>(path: string, params?: Record<string, string>) => {
  const url = params ? path + "?" + new URLSearchParams(params).toString() : path;
  return dedupFetch<T>("GET", url);
};
const post = <T>(path: string, body: unknown) => dedupFetch<T>("POST", path, body);
const put = <T>(path: string, body: unknown) => dedupFetch<T>("PUT", path, body);
const del = (path: string) => dedupFetch<void>("DELETE", path);
const patchReq = <T>(path: string, body: unknown) => dedupFetch<T>("PATCH", path, body);

// ─── Client-side cache for summary responses ──────
const summaryCache = new Map<string, { data: ServerSummary; expiry: number }>();
const SUMMARY_CACHE_TTL = 30_000; // 30 seconds

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
  summary: (id: number, days = 1) => {
    const key = `summary:${id}:${days}`;
    const cached = summaryCache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return Promise.resolve(cached.data) as Promise<ServerSummary>;
    }
    return get<ServerSummary>(`/api/servers/${id}/summary`, { days: String(days) }).then(data => {
      summaryCache.set(key, { data, expiry: Date.now() + SUMMARY_CACHE_TTL });
      return data;
    });
  },
};

// ─── OpenCode ────────────────────────────────────
export const opencodeApi = {
  summary: () => get<OpenCodeSummary>("/api/opencode/summary"),
  /** Daily-aggregated usage (server-side group by day) */
  usage: (days = 7) => get<OpenCodeDailyUsage[]>("/api/opencode/usage", { days: String(days) }),
  /** Per-record raw usage (for detail table) */
  usageRaw: (days = 7, limit = 200, search = "") =>
    get<OpenCodeUsage[]>("/api/opencode/usage", { days: String(days), raw: "true", limit: String(limit), ...(search ? { search } : {}) }),
  byModel: (days = 7) => get<OpenCodeByModel[]>("/api/opencode/by-model", { days: String(days) }),
  predict: (days = 30, predict = 7) =>
    get<OpenCodePrediction>("/api/opencode/predict", { days: String(days), predict: String(predict) }),
  anomaly: () => get<{ todayCost: number; avgCost: number; ratio: number; status: string }>("/api/opencode/anomaly"),
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

// ─── Audit Logs ────────────────────────────────────
export const auditApi = {
  list: (limit = 50, offset = 0, days = 30, type = "") =>
    get<AuditEntry[]>("/api/audit", { limit: String(limit), offset: String(offset), days: String(days), ...(type ? { type } : {}) }),
};

// ─── Alerts ────────────────────────────────────────
export const alertsApi = {
  list: (limit = 50) => get<Alert[]>(`/api/alerts?limit=${limit}`),
  unread: () => get<{ count: number }>("/api/alerts/unread"),
  ack: (id: number) => post(`/alerts/${id}/ack`, {}),
  ackAll: (type?: string) => post("/alerts/ack-all", type ? { type } : {}),
};

// ─── Alert Rules ───────────────────────────────────
export const alertRulesApi = {
  list: () => get<AlertRule[]>("/api/alert-rules"),
  get: (id: number) => get<AlertRule>(`/api/alert-rules/${id}`),
  create: (body: Partial<AlertRule>) => post<AlertRule>("/alert-rules", body),
  update: (id: number, body: Partial<AlertRule>) => put<AlertRule>(`/alert-rules/${id}`, body),
  remove: (id: number) => del(`/alert-rules/${id}`),
};

const DEFAULT_SECTIONS: DashboardSection[] = [
  { id: "links", title: "常用链接", visible: true },
  { id: "stats", title: "统计概览", visible: true },
  { id: "charts", title: "用量图表", visible: true },
  { id: "prediction", title: "用量预测", visible: true },
  { id: "servers", title: "服务器状态", visible: true },
];

const DEFAULT_CONFIG: DashboardConfig = { sections: DEFAULT_SECTIONS };

export const dashboardConfigApi = {
  async get(): Promise<DashboardConfig> {
    try {
      const res = await settingsApi.get("dashboard_config");
      if (!res.value) return DEFAULT_CONFIG;
      return JSON.parse(res.value) as DashboardConfig;
    } catch {
      return DEFAULT_CONFIG;
    }
  },
  async save(config: DashboardConfig): Promise<void> {
    await settingsApi.set("dashboard_config", JSON.stringify(config));
  },
};

// ─── Status / Health ────────────────────────────────
export const statusApi = {
  get: () => get<StatusResponse>("/api/status"),
};

// ─── Reports ───────────────────────────────────────
export const reportsApi = {
  list: (limit = 20) => get<ScheduledReport[]>('/api/reports', { limit: String(limit) }),
};

// ─── Users (admin management) ─────────────────────
export const usersApi = {
  list: () => get<User[]>("/api/users"),
  create: (body: { email: string; password: string; displayName: string; role: string }) =>
    post<User>("/users", body),
  update: (id: number, body: { displayName?: string; role?: string; isActive?: boolean }) =>
    patchReq<User>(`/users/${id}`, body),
  remove: (id: number) => del(`/users/${id}`),
};

// ─── Settings ─────────────────────────────────────
export const settingsApi = {
  getAll: () => get<Record<string, string>>("/api/settings"),
  get: (key: string) => get<{ value: string | null }>(`/api/settings/${key}`),
  set: (key: string, value: string) => put(`/settings/${key}`, { value }),
  remove: (key: string) => del(`/settings/${key}`),
};
