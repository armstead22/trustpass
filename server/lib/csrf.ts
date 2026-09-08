/**
 * CSRF protection (double-submit, server-bound token).
 *
 * Threat model note: TrustPass authenticates state-changing requests with a Bearer
 * JWT held in JS memory (NOT a cookie), so classic CSRF is already not exploitable
 * — a cross-origin page cannot read the in-memory token to send it. However, the
 * platform spec requires explicit CSRF protection on all state-changing routes as
 * defense-in-depth. We implement a server-bound anti-CSRF token:
 *
 *   - On login (and via GET /api/auth/csrf-token) the server issues a random token
 *     bound to the user, stored server-side with a TTL.
 *   - The client sends it back as the `X-CSRF-Token` header on every mutating request.
 *   - `requireCsrf` validates the header against the stored token for the authed user.
 *
 * API-key-authenticated partner routes (server-to-server, X-API-Key) are exempt: they
 * do not use cookies or browser sessions, so CSRF does not apply to them.
 */
import crypto from "node:crypto";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const csrfStore = new Map<number, { token: string; expires: number }>();

export function issueCsrfToken(userId: number): string {
  const token = crypto.randomBytes(32).toString("hex");
  csrfStore.set(userId, { token, expires: Date.now() + TOKEN_TTL_MS });
  return token;
}

export function validateCsrfToken(userId: number, token: string | undefined): boolean {
  if (!token) return false;
  const entry = csrfStore.get(userId);
  if (!entry) return false;
  if (entry.expires < Date.now()) {
    csrfStore.delete(userId);
    return false;
  }
  // constant-time comparison (only when lengths match)
  const a = Buffer.from(entry.token);
  const b = Buffer.from(token);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Express middleware: requires a valid X-CSRF-Token header for the authed user. */
export function requireCsrf(req: any, res: any, next: any) {
  const userId = req.user?.sub;
  if (!userId) return res.status(401).json({ error: "Authentication required" });
  if (!validateCsrfToken(userId, req.headers["x-csrf-token"])) {
    return res.status(403).json({ error: "Invalid or missing CSRF token" });
  }
  next();
}
