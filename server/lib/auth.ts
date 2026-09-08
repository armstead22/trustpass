import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";
import { safeEqual } from "./crypto";

const ACCESS_TTL = "15m";
const REFRESH_TTL_SECONDS = 7 * 24 * 3600; // 7 days
const SALT_ROUNDS = 12;

function secret(): string {
  return process.env.JWT_SECRET || (console.warn("[SECURITY] JWT_SECRET not set — using insecure dev secret."), "trustpass-dev-secret-change-me");
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export interface JwtPayload {
  sub: number;       // user or partner id
  role: "user" | "admin" | "partner";
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, secret(), { expiresIn: ACCESS_TTL });
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, secret(), { expiresIn: `${REFRESH_TTL_SECONDS}s` });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, secret()) as unknown as JwtPayload;
}

/** Extract bearer token from Authorization header. */
export function bearerFromRequest(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice(7);
}

/** Middleware: require a valid user or admin JWT. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = bearerFromRequest(req);
  if (!token) {
    return next(new (class extends Error { status = 401; })("Authentication required"));
  }
  try {
    const payload = verifyToken(token);
    (req as any).user = payload;
    next();
  } catch {
    return next(Object.assign(new Error("Invalid or expired token"), { status: 401 }));
  }
}

/** Middleware: require admin role. Must run after requireAuth. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const user = (req as any).user as JwtPayload | undefined;
  if (!user || user.role !== "admin") {
    return next(Object.assign(new Error("Admin access required"), { status: 403 }));
  }
  next();
}

/** Return refresh token as an httpOnly cookie for browsers that support it. */
export const REFRESH_COOKIE = "tp_refresh";
export const REFRESH_TTL_MS = REFRESH_TTL_SECONDS * 1000;
