import { useEffect, useState, useCallback } from "react";
import { auth, apiRequest, API_BASE } from "@/lib/queryClient";

export interface CurrentUser {
  id: number;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
  status: string;
  country?: string;
}

export function useAuth() {
  const [, force] = useState(0);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = auth.onChange(() => force((n) => n + 1));
    return () => { unsub(); };
  }, []);

  const refresh = useCallback(async () => {
    if (!auth.token) { setUser(null); setLoading(false); return null; }
    try {
      const res = await apiRequest("GET", "/api/auth/me");
      const u = await res.json();
      setUser(u);
      return u;
    } catch {
      auth.set(null);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // On boot, try to refresh the access token using the httpOnly refresh cookie.
    // This allows sessions to survive page reloads.
    if (!auth.token) {
      (async () => {
        try {
          const res = await fetch(`${API_BASE}/api/auth/refresh`, {
            method: "POST",
            credentials: "include",
          });
          if (res.ok) {
            const data = await res.json();
            if (data.accessToken) {
              auth.set(data.accessToken);
              // Fetch CSRF token for the refreshed session
              try {
                const csrfRes = await fetch(`${API_BASE}/api/auth/csrf-token`, {
                  headers: { Authorization: `Bearer ${data.accessToken}` },
                });
                if (csrfRes.ok) {
                  const csrfData = await csrfRes.json();
                  auth.setCsrf(csrfData.csrfToken);
                }
              } catch {}
            }
          }
        } catch {
          // No refresh token cookie or expired — silently continue as logged out
        }
        setLoading(false);
      })();
    } else {
      refresh();
    }
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/login", { email, password });
    const data = await res.json();
    auth.set(data.accessToken);
    auth.setCsrf(data.csrfToken);
    const u = await refresh();
    return { user: u, emailVerified: data.emailVerified, role: data.role };
  }, [refresh]);

  const logout = useCallback(async () => {
    try { await apiRequest("POST", "/api/auth/logout"); } catch {}
    auth.clear();
    setUser(null);
  }, []);

  return { user, loading, refresh, login, logout };
}
