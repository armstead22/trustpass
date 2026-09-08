import type { Express } from "express";
import type { Server } from "node:http";
import crypto from "node:crypto";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import * as s from "./storage";
import {
  signupSchema, loginSchema, verifyIdentitySchema, registerWebhookSchema,
  partnerAuthSchema, verifyCredentialSchema,
} from "@shared/schema";
import {
  hashPassword, verifyPassword, signAccessToken, signRefreshToken,
  verifyToken, requireAuth, requireAdmin, REFRESH_COOKIE, REFRESH_TTL_MS,
} from "./lib/auth";
import { generateApiKey, hashApiKey } from "./lib/crypto";
import { runKyc } from "./lib/kyc";
import { writeAttestation, stellarExplorerUrl } from "./lib/stellar";
import { sendEmail, emailBody } from "./lib/email";
import { audit } from "./lib/audit";
import { requirePartner } from "./lib/partner-auth";
import { issueCsrfToken, requireCsrf } from "./lib/csrf";

// in-memory OTP store (email -> { code, expires })
const otpStore = new Map<string, { code: string; expires: number }>();

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  /* ---------------- Security middleware ---------------- */
  app.use(helmet());
  app.use(cookieParser());

  const authLimiter = rateLimit({
    windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: "Too many auth attempts, slow down" }),
  });
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: "Too many requests, slow down" }),
    skip: (req) => req.path.startsWith("/api/docs") || req.path.startsWith("/api/openapi"),
  });
  app.use("/api", apiLimiter);
  app.use("/api/auth", authLimiter);

  /* ---------------- Swagger / OpenAPI ---------------- */
  const openapi = buildOpenApiSpec();
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapi));
  app.get("/api/openapi.json", (_req, res) => res.json(openapi));

  /* ====================================================================
     AUTH (user)
     ==================================================================== */

  app.post("/api/auth/signup", async (req, res, next) => {
    try {
      const input = signupSchema.parse(req.body);
      if (s.findUserByEmail(input.email)) {
        return res.status(409).json({ error: "An account with this email already exists" });
      }
      const passwordHash = await hashPassword(input.password);
      const user = s.createUser({ email: input.email, passwordHash, name: input.name });
      // mock email verification code
      const code = String(Math.floor(100000 + Math.random() * 900000));
      otpStore.set(input.email, { code, expires: Date.now() + 10 * 60 * 1000 });
      if (process.env.NODE_ENV !== "production") console.log(`[DEV OTP → ${input.email}] code: ${code}`);
      await sendEmail({ to: input.email, subject: "Verify your TrustPass email", html: emailBody("verify-email", { code }) });
      await sendEmail({ to: input.email, subject: "Welcome to TrustPass", html: emailBody("welcome", { name: input.name }) });
      s.createNotification(user.id, "welcome", "Welcome to TrustPass — verify your email to continue.");
      await audit({ actorId: user.id, actorRole: "user", action: "signup", targetId: user.id });
      res.status(201).json({ id: user.id, email: input.email, message: "Verification code sent to email" });
    } catch (e) { next(e); }
  });

  app.post("/api/auth/verify-email", async (req, res, next) => {
    try {
      const { email, code } = req.body as { email: string; code: string };
      const entry = otpStore.get(email);
      if (!entry || entry.expires < Date.now()) return res.status(400).json({ error: "Code expired or invalid" });
      if (entry.code !== code) return res.status(400).json({ error: "Invalid code" });
      const user = s.findUserByEmail(email);
      if (!user) return res.status(404).json({ error: "User not found" });
      s.setUserEmailVerified(user.id, true);
      otpStore.delete(email);
      await audit({ actorId: user.id, actorRole: "user", action: "email_verified", targetId: user.id });
      res.json({ verified: true });
    } catch (e) { next(e); }
  });

  app.post("/api/auth/login", async (req, res, next) => {
    try {
      const input = loginSchema.parse(req.body);
      const user = s.findUserByEmail(input.email);
      if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      if (user.status === "banned") return res.status(403).json({ error: "Account banned" });
      const access = signAccessToken({ sub: user.id, role: user.role as "user" | "admin" });
      const refresh = signRefreshToken({ sub: user.id, role: user.role as "user" | "admin" });
      res.cookie(REFRESH_COOKIE, refresh, { httpOnly: true, sameSite: "lax", maxAge: REFRESH_TTL_MS });
      const csrfToken = issueCsrfToken(user.id);
      await audit({ actorId: user.id, actorRole: "user", action: "login", targetId: user.id });
      res.json({ accessToken: access, csrfToken, role: user.role, emailVerified: user.emailVerified });
    } catch (e) { next(e); }
  });

  app.post("/api/auth/refresh", async (req, res, next) => {
    try {
      const token = (req.cookies?.[REFRESH_COOKIE] || (req.headers.authorization?.slice(7) ?? "")) as string;
      if (!token) return res.status(401).json({ error: "No refresh token" });
      const payload = verifyToken(token);
      const user = s.getUserById(payload.sub);
      if (!user) return res.status(401).json({ error: "User not found" });
      const access = signAccessToken({ sub: user.id, role: user.role as "user" | "admin" });
      res.json({ accessToken: access });
    } catch (e) { next(e); }
  });

  app.post("/api/auth/logout", requireAuth, requireCsrf, (_req, res) => {
    res.clearCookie(REFRESH_COOKIE);
    res.json({ ok: true });
  });

  // Issue / refresh the CSRF token for the authenticated user.
  app.get("/api/auth/csrf-token", requireAuth, (req, res) => {
    res.json({ csrfToken: issueCsrfToken((req as any).user.sub) });
  });

  app.get("/api/auth/me", requireAuth, async (req, res, next) => {
    try {
      const user = s.getUserById((req as any).user.sub);
      if (!user) return next(Object.assign(new Error("Not found"), { status: 404 }));
      res.json(s.publicUser(user));
    } catch (e) { next(e); }
  });

  /* ====================================================================
     VERIFICATION FLOW (user)
     ==================================================================== */

  app.get("/api/verify/status", requireAuth, async (req, res, next) => {
    try {
      const v = s.getVerificationByUserId((req as any).user.sub);
      res.json(s.publicVerification(v) || { status: "not_started" });
    } catch (e) { next(e); }
  });

  app.post("/api/verify/submit", requireAuth, requireCsrf, async (req, res, next) => {
    try {
      const userId = (req as any).user.sub as number;
      const user = s.getUserById(userId);
      if (!user?.emailVerified) return res.status(400).json({ error: "Verify your email first" });
      if (user.status !== "active") return res.status(403).json({ error: "Account not active" });

      // lockout check
      let v = s.getVerificationByUserId(userId);
      if (v?.lockedUntil && v.lockedUntil > new Date()) {
        return res.status(429).json({ error: "Too many attempts. Try again after 24 hours.", lockedUntil: v.lockedUntil });
      }
      if (!v) v = s.createVerification(userId);

      const input = verifyIdentitySchema.parse(req.body);

      // save profile (encrypted PII)
      s.updateUserProfile(userId, { name: input.legalName, dob: input.dob, country: input.country });

      // store document references (encrypted blob keys — mock S3)
      s.saveDocument(userId, input.docType, "front", `mock-s3://docs/${crypto.randomBytes(8).toString("hex")}`);
      if (input.docBack) s.saveDocument(userId, input.docType, "back", `mock-s3://docs/${crypto.randomBytes(8).toString("hex")}`);

      // run KYC (mock Persona/Jumio)
      const kyc = await runKyc(input);
      await audit({ actorId: userId, actorRole: "user", action: "verification_submitted", targetId: v.id, metadata: { docType: input.docType } });

      if (!kyc.passed) {
        const { attempts, locked } = s.incrementVerificationAttempt(userId) || {};
        s.updateVerification(v.id, { status: "rejected", rejectionReason: kyc.reason });
        const remaining = locked ? 0 : Math.max(0, 3 - (attempts ?? 0));
        s.createNotification(userId, "failed", `Verification failed: ${kyc.reason}`);
        await sendEmail({ to: s.publicUser(user)!.email, subject: "Verification failed", html: emailBody("failed", { reason: kyc.reason || "Unknown", remaining: String(remaining) }) });
        return res.status(422).json({
          passed: false, reason: kyc.reason, attempts: attempts, remaining,
          lockedUntil: locked, checks: kyc.checks,
        });
      }

      // blockchain attestation (mock or real Stellar testnet)
      const userHash = crypto.createHash("sha256").update(String(userId)).digest("hex").slice(0, 16);
      const expiry = new Date(Date.now() + 12 * 30 * 24 * 3600 * 1000); // ~12 months
      const attestation = await writeAttestation({ userHash, level: kyc.level, expiryDate: expiry });

      // CRITICAL: do not mark verified until the Stellar transaction is confirmed on-chain.
      if (!attestation.success) {
        // KYC passed but the blockchain write failed. Roll back to "pending" and alert admin.
        s.updateVerification(v.id, {
          status: "pending",
          level: kyc.level,
          rejectionReason: null,
          attemptCount: 0,
          lockedUntil: null,
        });
        s.createNotification(userId, "pending", "KYC passed — waiting for blockchain confirmation. We'll notify you when your credential is live.");
        await audit({ actorId: userId, actorRole: "user", action: "verification_pending_blockchain", targetId: v.id, metadata: { level: kyc.level, stellarMode: attestation.mode, attempts: attestation.attempts, error: attestation.error } });

        // alert the first admin
        const admin = s.listUsers().find((u) => u.role === "admin");
        if (admin) s.createNotification(admin.id, "pending", `Stellar attestation failed for user ${userId} after ${attestation.attempts} attempts: ${attestation.error}`);

        return res.status(202).json({
          passed: true, kycPassed: true, status: "pending",
          message: "Identity verified. Waiting for blockchain confirmation.",
          stellarMode: attestation.mode, attempts: attestation.attempts, error: attestation.error,
          checks: kyc.checks,
        });
      }

      s.updateVerification(v.id, {
        status: "verified", level: kyc.level, stellarTxHash: attestation.txHash,
        verifiedAt: new Date(), expiresAt: expiry, rejectionReason: null, attemptCount: 0, lockedUntil: null,
      });

      s.createNotification(userId, "verified", `Identity verified. Credential ID: ${attestation.txHash!.slice(0, 16)}…`);
      await sendEmail({ to: s.publicUser(user)!.email, subject: "You're verified", html: emailBody("verified", { name: input.legalName, credentialId: attestation.txHash! }) });
      await audit({ actorId: userId, actorRole: "user", action: "verification_passed", targetId: v.id, metadata: { level: kyc.level, txHash: attestation.txHash, stellarMode: attestation.mode, attempts: attestation.attempts } });

      res.json({ passed: true, status: "verified", level: kyc.level, credentialId: attestation.txHash, stellarMode: attestation.mode, attempts: attestation.attempts, explorerUrl: stellarExplorerUrl(attestation.txHash!), checks: kyc.checks, expiresAt: expiry });
    } catch (e) { next(e); }
  });

  app.post("/api/verify/reverify", requireAuth, requireCsrf, async (req, res, next) => {
    try {
      const userId = (req as any).user.sub as number;
      s.updateVerification(s.getVerificationByUserId(userId)?.id ?? 0, { status: "pending" });
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  /* ====================================================================
     DASHBOARD / PRIVACY / NOTIFICATIONS / GDPR
     ==================================================================== */

  app.get("/api/dashboard", requireAuth, async (req, res, next) => {
    try {
      const userId = (req as any).user.sub as number;
      const user = s.getUserById(userId);
      const v = s.getVerificationByUserId(userId);
      const platforms = s.getConnectedPlatforms(userId);
      const partners = platforms.map((p) => {
        const partner = s.getPartnerById(p.partnerId);
        return { partnerId: p.partnerId, company: partner?.companyName || "Unknown", accessedAt: p.accessedAt, accessType: p.accessType };
      });
      res.json({ user: s.publicUser(user), verification: s.publicVerification(v), connectedPlatforms: partners, notifications: s.listNotifications(userId) });
    } catch (e) { next(e); }
  });

  app.get("/api/privacy/platforms", requireAuth, async (req, res, next) => {
    try {
      const userId = (req as any).user.sub as number;
      const platforms = s.getConnectedPlatforms(userId);
      res.json(platforms.map((p) => {
        const partner = s.getPartnerById(p.partnerId);
        return { partnerId: p.partnerId, company: partner?.companyName || "Unknown", accessedAt: p.accessedAt, accessType: p.accessType };
      }));
    } catch (e) { next(e); }
  });

  app.post("/api/privacy/revoke/:partnerId", requireAuth, requireCsrf, async (req, res, next) => {
    try {
      const userId = (req as any).user.sub as number;
      const partnerId = Number(req.params.partnerId);
      s.revokePlatformAccess(userId, partnerId);
      const partner = s.getPartnerById(partnerId);
      s.createNotification(userId, "revoked", `Revoked access for ${partner?.companyName || "partner"}`);
      await audit({ actorId: userId, actorRole: "user", action: "revoke_platform", targetId: partnerId });
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  app.get("/api/notifications", requireAuth, async (req, res, next) => {
    try {
      res.json(s.listNotifications((req as any).user.sub));
    } catch (e) { next(e); }
  });

  app.post("/api/notifications/:id/read", requireAuth, requireCsrf, (req, res) => {
    s.markNotificationRead(Number(req.params.id));
    res.json({ ok: true });
  });

  app.post("/api/gdpr/export", requireAuth, requireCsrf, async (req, res, next) => {
    try {
      const userId = (req as any).user.sub as number;
      const user = s.getUserById(userId);
      const v = s.getVerificationByUserId(userId);
      res.json({
        user: s.publicUser(user),
        verification: s.publicVerification(v),
        connectedPlatforms: s.getConnectedPlatforms(userId).map((p) => ({ partnerId: p.partnerId, accessType: p.accessType, accessedAt: p.accessedAt })),
        notifications: s.listNotifications(userId),
        exportedAt: new Date().toISOString(),
      });
    } catch (e) { next(e); }
  });

  app.post("/api/gdpr/delete", requireAuth, requireCsrf, async (req, res, next) => {
    try {
      const userId = (req as any).user.sub as number;
      await audit({ actorId: userId, actorRole: "user", action: "gdpr_delete", targetId: userId });
      s.deleteUser(userId);
      res.clearCookie(REFRESH_COOKIE);
      res.json({ ok: true, message: "PII deleted. Anonymized blockchain attestation retained." });
    } catch (e) { next(e); }
  });

  /* ====================================================================
     PARTNER PORTAL (API clients)  /api/v1/*
     ==================================================================== */

  app.post("/api/v1/partner/auth", async (req, res, next) => {
    try {
      const input = partnerAuthSchema.parse(req.body);
      const partner = s.findPartnerByEmail(input.email);
      const hash = hashApiKey(input.apiKey);
      if (!partner || partner.apiKeyHash !== hash) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const access = signAccessToken({ sub: partner.id, role: "partner" });
      res.json({ accessToken: access, partner: s.publicPartner(partner) });
    } catch (e) { next(e); }
  });

  // Partner UI: rotate API key (uses partner API key)
  app.post("/api/v1/apikeys/rotate", requirePartner, async (req, res, next) => {
    try {
      const newKey = generateApiKey();
      s.rotatePartnerApiKey((req as any).partner.id, hashApiKey(newKey));
      await audit({ actorId: (req as any).partner.id, actorRole: "partner", action: "apikey_rotated" });
      res.json({ apiKey: newKey, message: "Save this key — it won't be shown again." });
    } catch (e) { next(e); }
  });

  app.get("/api/v1/usage", requirePartner, async (req, res, next) => {
    try {
      res.json(s.getUsageStats((req as any).partner.id));
    } catch (e) { next(e); }
  });

  app.post("/api/v1/verify", requirePartner, async (req, res, next) => {
    try {
      const input = verifyCredentialSchema.parse(req.body);
      const v = input.credential_id
        ? s.findVerificationByTxHash(input.credential_id)
        : input.email_hash
        ? s.findVerificationByEmailHash(input.email_hash)
        : input.email
        ? (() => { const u = s.findUserByEmail(input.email); return u ? s.getVerificationByUserId(u.id) : undefined; })()
        : undefined;
      if (!v || v.status === "deleted") return res.status(404).json({ error: "Credential not found" });
      const user = s.getUserById(v.userId);
      if (!user) return res.status(404).json({ error: "Credential not found" });

      s.logCredentialAccess(v.userId, (req as any).partner.id, "verify");
      s.createNotification(v.userId, "connected", `${(req as any).partner.companyName} verified your credential`);
      await audit({ actorId: (req as any).partner.id, actorRole: "partner", action: "credential_lookup", targetId: v.userId, metadata: { endpoint: "verify" } });

      // never return raw PII — only verification status, level, expiry
      res.json({
        verified: v.status === "verified",
        status: v.status,
        level: v.level,
        verifiedAt: v.verifiedAt,
        expiresAt: v.expiresAt,
        credentialId: v.stellarTxHash,
      });
    } catch (e) { next(e); }
  });

  app.get("/api/v1/status/:id", requirePartner, async (req, res, next) => {
    try {
      const v = s.findVerificationByTxHash(String(req.params.id));
      if (!v || v.status === "deleted") return res.status(404).json({ error: "Credential not found" });
      s.logCredentialAccess(v.userId, (req as any).partner.id, "status");
      res.json({ status: v.status, level: v.level, expiresAt: v.expiresAt });
    } catch (e) { next(e); }
  });

  app.post("/api/v1/webhook/register", requirePartner, async (req, res, next) => {
    try {
      const input = registerWebhookSchema.parse(req.body);
      const wh = s.registerWebhook((req as any).partner.id, input.url, input.events);
      res.status(201).json({ id: wh.id, url: wh.url, events: JSON.parse(wh.events), secret: wh.secret });
    } catch (e) { next(e); }
  });

  app.get("/api/v1/webhooks", requirePartner, async (req, res, next) => {
    try {
      res.json(s.listWebhooks((req as any).partner.id).map((w) => ({ ...w, events: JSON.parse(w.events) })));
    } catch (e) { next(e); }
  });

  app.delete("/api/v1/webhooks/:id", requirePartner, async (req, res, next) => {
    try {
      s.deleteWebhook(Number(req.params.id), (req as any).partner.id);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  /* ====================================================================
     ADMIN
     ==================================================================== */

  app.get("/api/admin/metrics", requireAuth, requireAdmin, (_req, res) => {
    res.json(s.adminMetrics());
  });

  app.get("/api/admin/users", requireAuth, requireAdmin, (_req, res) => {
    res.json(s.listUsers().map((u) => s.publicUser(u)));
  });

  app.get("/api/admin/verifications", requireAuth, requireAdmin, (_req, res) => {
    res.json(s.listVerifications().map((v) => ({ ...s.publicVerification(v), emailHash: undefined })));
  });

  app.post("/api/admin/verifications/:id", requireAuth, requireCsrf, requireAdmin, async (req, res, next) => {
    try {
      const { action } = req.body as { action: "approve" | "reject" | "flag" };
      const v = s.getVerificationById(Number(req.params.id));
      if (!v) return res.status(404).json({ error: "Not found" });
      const status = action === "approve" ? "verified" : action === "reject" ? "rejected" : "flagged";
      s.updateVerification(v.id, { status, verifiedAt: action === "approve" ? new Date() : undefined });
      await audit({ actorId: (req as any).user.sub, actorRole: "admin", action: `verification_${action}`, targetId: v.id });
      res.json({ ok: true, status });
    } catch (e) { next(e); }
  });

  app.post("/api/admin/users/:id/status", requireAuth, requireCsrf, requireAdmin, async (req, res, next) => {
    try {
      const { status } = req.body as { status: "active" | "suspended" | "banned" };
      s.updateUserStatus(Number(req.params.id), status);
      await audit({ actorId: (req as any).user.sub, actorRole: "admin", action: `user_${status}`, targetId: Number(req.params.id) });
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  app.post("/api/admin/partners/:id/status", requireAuth, requireCsrf, requireAdmin, async (req, res, next) => {
    try {
      const { status } = req.body as { status: "active" | "suspended" };
      s.updatePartnerStatus(Number(req.params.id), status);
      await audit({ actorId: (req as any).user.sub, actorRole: "admin", action: `partner_${status}`, targetId: Number(req.params.id) });
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  app.get("/api/admin/partners", requireAuth, requireAdmin, (_req, res) => {
    res.json(s.listPartners().map((p) => s.publicPartner(p)));
  });

  app.get("/api/admin/audit-logs", requireAuth, requireAdmin, (_req, res) => {
    res.json(s.listAuditLogs());
  });

  return httpServer;
}

/* ---------------- OpenAPI spec ---------------- */
function buildOpenApiSpec() {
  return {
    openapi: "3.1.0",
    info: { title: "TrustPass API", version: "1.0.0", description: "Verify once. Access everywhere." },
    servers: [{ url: "https://hellotrustpass.com/api/v1", description: "Partner API v1" }],
    components: {
      securitySchemes: { ApiKeyAuth: { type: "apiKey", in: "header", name: "X-API-Key" } },
    },
    paths: {
      "/partner/auth": {
        post: { summary: "Authenticate partner (get bearer token)", tags: ["Partner"], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { email: { type: "string" }, apiKey: { type: "string" } } } } } }, responses: { 200: { description: "Access token" } } },
      },
      "/verify": {
        post: { summary: "Verify a credential", security: [{ ApiKeyAuth: [] }], tags: ["Partner"], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { credential_id: { type: "string" }, email_hash: { type: "string" } } } } } }, responses: { 200: { description: "Verification status (no PII)" }, 404: { description: "Credential not found" } } },
      },
      "/status/{id}": {
        get: { summary: "Get credential status", security: [{ ApiKeyAuth: [] }], tags: ["Partner"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Status" } } },
      },
      "/usage": {
        get: { summary: "Get usage stats", security: [{ ApiKeyAuth: [] }], tags: ["Partner"], responses: { 200: { description: "Usage metrics" } } },
      },
      "/webhook/register": {
        post: { summary: "Register a webhook", security: [{ ApiKeyAuth: [] }], tags: ["Partner"], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { url: { type: "string" }, events: { type: "array", items: { type: "string" } } } } } } }, responses: { 201: { description: "Webhook registered" } } },
      },
    },
  };
}
