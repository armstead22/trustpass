import type { Request, Response, NextFunction } from "express";
import { hashApiKey } from "./crypto";
import { findPartnerByApiKeyHash, logApiUsage } from "../storage";

/**
 * Partner API authentication. Accepts either:
 *   - Authorization: Bearer <api_key>
 *   - X-API-Key: <api_key>
 * The key is hashed (SHA-256) and compared to stored hashes; the raw key
 * is never persisted. Every call is logged to api_usage_logs with latency.
 */
export async function requirePartner(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const headerVal = req.headers["x-api-key"];
  const raw = (Array.isArray(headerVal) ? headerVal[0] : headerVal) ?? bearerFromHeader(req);
  const apiKey = raw ?? null;
  const done = (code: number) => {
    const partnerId = (req as any).partner?.id ?? 0;
    if (partnerId) logApiUsage(partnerId, req.path, code, Date.now() - start);
  };

  if (!apiKey) {
    done(401);
    return res.status(401).json({ error: "API key required" });
  }
  const hash = hashApiKey(apiKey);
  const partner = findPartnerByApiKeyHash(hash);
  if (!partner) {
    done(401);
    return res.status(401).json({ error: "Invalid API key" });
  }
  if (partner.status !== "active") {
    done(403);
    return res.status(403).json({ error: "Partner account suspended" });
  }
  (req as any).partner = partner;
  next();
}

function bearerFromHeader(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return null;
  return h.slice(7);
}
