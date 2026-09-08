import { QueryClient, QueryFunction } from "@tanstack/react-query";

export const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

/* In-memory auth token store (localStorage/sessionStorage are blocked in
   the sandboxed preview iframe, so we keep the JWT in module memory). */
let authToken: string | null = null;
let partnerApiKey: string | null = null;
let csrfToken: string | null = null;
const listeners = new Set<() => void>();

export const auth = {
  get token() { return authToken; },
  set(token: string | null) { authToken = token; listeners.forEach((l) => l()); },
  get partnerKey() { return partnerApiKey; },
  setPartnerKey(key: string | null) { partnerApiKey = key; listeners.forEach((l) => l()); },
  get csrf() { return csrfToken; },
  setCsrf(token: string | null) { csrfToken = token; listeners.forEach((l) => l()); },
  clear() { authToken = null; partnerApiKey = null; csrfToken = null; listeners.forEach((l) => l()); },
  onChange(fn: () => void) { listeners.add(fn); return () => listeners.delete(fn); },
};

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

async function refreshCsrf(): Promise<string | null> {
  if (!authToken) return null;
  try {
    const res = await fetch(`${API_BASE}/api/auth/csrf-token`, { headers: { Authorization: `Bearer ${authToken}` } });
    if (!res.ok) return null;
    const data = await res.json();
    csrfToken = data.csrfToken;
    return csrfToken;
  } catch { return null; }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (data) headers["Content-Type"] = "application/json";
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  if (partnerApiKey) headers["X-API-Key"] = partnerApiKey;
  if (MUTATING.has(method.toUpperCase()) && csrfToken) headers["X-CSRF-Token"] = csrfToken;
  let res = await fetch(`${API_BASE}${url}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });
  // Auto-refresh an expired/missing CSRF token once and retry.
  if (res.status === 403 && MUTATING.has(method.toUpperCase()) && authToken) {
    const fresh = await refreshCsrf();
    if (fresh) {
      headers["X-CSRF-Token"] = fresh;
      res = await fetch(`${API_BASE}${url}`, { method, headers, body: data ? JSON.stringify(data) : undefined });
    }
  }
  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers: Record<string, string> = {};
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    if (partnerApiKey) headers["X-API-Key"] = partnerApiKey;
    const res = await fetch(`${API_BASE}${queryKey.join("/")}`, { headers });
    if (unauthorizedBehavior === "returnNull" && res.status === 401) return null;
    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: { retry: false },
  },
});
