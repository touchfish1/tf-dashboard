import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { AuthUser, LoginResponse } from "./types";

// ─── Token persistence ──────────────────────────
// sessionStorage survives page refresh (F5) but is cleared when tab closes.
// The httpOnly refresh_token cookie is used as fallback when token expires.

const TOKEN_KEY = "tf_at";

function loadToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function saveToken(token: string | null) {
  _accessToken = token;
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // storage unavailable — token lives in memory only
  }
}

let _accessToken: string | null = loadToken();

export function getAccessToken(): string | null {
  return _accessToken;
}

export function setAccessToken(token: string | null) {
  saveToken(token);
}

// ─── Auth context ──────────────────────────────

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// ─── Provider ──────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: restore session from sessionStorage token or refresh cookie
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      try {
        if (_accessToken) {
          // Token from sessionStorage — try /me directly (fast path)
          const meRes = await fetch("/api/auth/me", {
            credentials: "include",
            headers: { Authorization: `Bearer ${_accessToken}` },
          });
          if (cancelled) return;
          if (meRes.ok) {
            const data: AuthUser = await meRes.json();
            setUser(data);
            if (!cancelled) setIsLoading(false);
            return;
          }
          // Token expired — clear it and fall through to refresh
          saveToken(null);
        }

        // Fallback: try httpOnly refresh_token cookie
        const refreshRes = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
        });
        if (cancelled) return;
        if (refreshRes.ok) {
          const { accessToken } = await refreshRes.json();
          saveToken(accessToken);
          const meRes = await fetch("/api/auth/me", {
            credentials: "include",
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (cancelled) return;
          if (meRes.ok) {
            const data: AuthUser = await meRes.json();
            setUser(data);
          }
        }
      } catch {
        // Network error — user stays null
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    });

    if (!res.ok) {
      let msg = "Login failed";
      try {
        const body = await res.json();
        msg = body.error || body.message || msg;
      } catch {
        msg = `HTTP ${res.status}`;
      }
      throw new Error(msg);
    }

    const data: LoginResponse = await res.json();
    saveToken(data.accessToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: _accessToken
          ? { Authorization: `Bearer ${_accessToken}` }
          : undefined,
      });
    } catch {
      // Best-effort; clear local state regardless
    }
    saveToken(null);
    setUser(null);
  }, []);

  const isAdmin = user?.role === "admin";

  return (
    <AuthContext.Provider value={{ user, isLoading, isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
