import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { AuthUser, LoginResponse } from "./types";

// ─── Module-level token storage ────────────────

let _accessToken: string | null = null;

export function getAccessToken(): string | null {
  return _accessToken;
}

export function setAccessToken(token: string | null) {
  _accessToken = token;
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

  // On mount: try to restore session via GET /api/auth/me
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      try {
        const res = await fetch("/api/auth/me", {
          credentials: "include",
        });
        if (cancelled) return;
        if (res.ok) {
          const data: AuthUser = await res.json();
          setUser(data);
        }
        // 401 means no session — that's fine, user stays null
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
    _accessToken = data.accessToken;
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
    _accessToken = null;
    setUser(null);
  }, []);

  const isAdmin = user?.role === "admin";

  return (
    <AuthContext.Provider value={{ user, isLoading, isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
