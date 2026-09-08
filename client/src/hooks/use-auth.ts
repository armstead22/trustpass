import { useEffect, useState, useCallback } from "react";
import { auth, apiRequest } from "@/lib/queryClient";

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
    if (auth.token) refresh();
    else setLoading(false);
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
