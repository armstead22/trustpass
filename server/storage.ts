import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc, and, sql, isNull } from "drizzle-orm";
import crypto from "node:crypto";
import * as schema from "@shared/schema";
import {
  users,
  verifications,
  documents,
  partners,
  apiUsageLogs,
  credentialAccessLog,
  auditLogs,
  notifications,
  webhooks,
} from "@shared/schema";
import { encrypt, decrypt, hashEmail } from "./lib/crypto";

const dbPath = process.env.DB_PATH || "data.db";
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite);
export { schema };

// Create tables on boot (idempotent)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, email_enc TEXT NOT NULL, email_hash TEXT NOT NULL UNIQUE,
    name_enc TEXT NOT NULL, dob_enc TEXT, country TEXT, password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user', email_verified INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending', level TEXT, stellar_tx_hash TEXT,
    verified_at INTEGER, expires_at INTEGER, rejection_reason TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0, locked_until INTEGER, created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
    doc_type TEXT NOT NULL, side TEXT NOT NULL, encrypted_key TEXT NOT NULL, uploaded_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS partners (
    id INTEGER PRIMARY KEY AUTOINCREMENT, company_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
    api_key_hash TEXT NOT NULL, plan TEXT NOT NULL DEFAULT 'starter',
    status TEXT NOT NULL DEFAULT 'active', created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS api_usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, partner_id INTEGER NOT NULL REFERENCES partners(id),
    endpoint TEXT NOT NULL, response_code INTEGER NOT NULL, latency_ms INTEGER NOT NULL, created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS credential_access_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
    partner_id INTEGER NOT NULL REFERENCES partners(id), access_type TEXT NOT NULL, accessed_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id INTEGER, actor_role TEXT NOT NULL,
    action TEXT NOT NULL, target_id INTEGER, metadata TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL, message TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS webhooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT, partner_id INTEGER NOT NULL REFERENCES partners(id),
    url TEXT NOT NULL, secret TEXT NOT NULL, events TEXT NOT NULL DEFAULT '[]',
    active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
  );
`);

/* ---- user-facing helpers (decrypt PII on read) ---- */

export function createUser(input: {
  email: string; passwordHash: string; name: string; role?: string;
}) {
  return db.insert(users).values({
    emailEnc: encrypt(input.email.toLowerCase()),
    emailHash: hashEmail(input.email),
    nameEnc: encrypt(input.name),
    passwordHash: input.passwordHash,
    role: input.role || "user",
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning().get();
}

export function findUserByEmail(email: string) {
  const h = hashEmail(email);
  return db.select().from(users).where(eq(users.emailHash, h)).get();
}

export function getUserById(id: number) {
  return db.select().from(users).where(eq(users.id, id)).get();
}

export function listUsers() {
  return db.select().from(users).orderBy(desc(users.createdAt)).all();
}

export function setUserEmailVerified(id: number, verified: boolean) {
  return db.update(users).set({ emailVerified: verified, updatedAt: new Date() }).where(eq(users.id, id)).run();
}

export function updateUserStatus(id: number, status: string) {
  return db.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, id)).run();
}

export function updateUserProfile(id: number, data: { name: string; dob: string; country: string }) {
  return db.update(users).set({
    nameEnc: encrypt(data.name),
    dobEnc: encrypt(data.dob),
    country: data.country,
    updatedAt: new Date(),
  }).where(eq(users.id, id)).run();
}

export function deleteUser(id: number) {
  // GDPR right to be forgotten: wipe PII, keep anonymized verification record
  db.delete(documents).where(eq(documents.userId, id)).run();
  db.delete(notifications).where(eq(notifications.userId, id)).run();
  db.update(verifications).set({ status: "deleted" }).where(eq(verifications.userId, id)).run();
  db.update(users).set({
    emailEnc: encrypt("deleted@removed.local"),
    nameEnc: encrypt("Deleted User"),
    dobEnc: null, country: null,
    status: "deleted",
    updatedAt: new Date(),
  }).where(eq(users.id, id)).run();
}

/** Decrypt a user row into a safe view (no password hash). */
export function publicUser(u: typeof users.$inferSelect | undefined | null) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.status === "deleted" ? "[deleted]" : decrypt(u.emailEnc),
    name: u.status === "deleted" ? "[deleted]" : decrypt(u.nameEnc),
    dob: u.dobEnc ? decrypt(u.dobEnc) : null,
    country: u.country,
    role: u.role,
    emailVerified: u.emailVerified,
    status: u.status,
    createdAt: u.createdAt,
  };
}

/* ---- verifications ---- */

export function createVerification(userId: number) {
  return db.insert(verifications).values({
    userId, status: "pending", attemptCount: 0, createdAt: new Date(),
  }).returning().get();
}

export function getVerificationByUserId(userId: number) {
  return db.select().from(verifications).where(eq(verifications.userId, userId)).get();
}

export function getVerificationById(id: number) {
  return db.select().from(verifications).where(eq(verifications.id, id)).get();
}

export function findVerificationByTxHash(txHash: string) {
  return db.select().from(verifications).where(eq(verifications.stellarTxHash, txHash)).get();
}

export function findVerificationByEmailHash(emailHash: string) {
  const u = db.select().from(users).where(eq(users.emailHash, emailHash)).get();
  if (!u) return undefined;
  return getVerificationByUserId(u.id);
}

export function listVerifications() {
  return db.select().from(verifications).orderBy(desc(verifications.createdAt)).all();
}

export function updateVerification(id: number, data: Partial<typeof verifications.$inferInsert>) {
  return db.update(verifications).set(data).where(eq(verifications.id, id)).run();
}

export function incrementVerificationAttempt(userId: number) {
  const v = getVerificationByUserId(userId);
  if (!v) return null;
  const attempts = v.attemptCount + 1;
  const locked = attempts >= 3 ? new Date(Date.now() + 24 * 3600 * 1000) : null;
  db.update(verifications).set({ attemptCount: attempts, lockedUntil: locked }).where(eq(verifications.id, v.id)).run();
  return { attempts, locked };
}

export function publicVerification(v: typeof verifications.$inferSelect | undefined) {
  if (!v) return null;
  return {
    id: v.id, userId: v.userId, status: v.status, level: v.level,
    credentialId: v.stellarTxHash, stellarTxHash: v.stellarTxHash,
    verifiedAt: v.verifiedAt, expiresAt: v.expiresAt,
    rejectionReason: v.rejectionReason, attemptCount: v.attemptCount,
    lockedUntil: v.lockedUntil, createdAt: v.createdAt,
  };
}

/* ---- documents ---- */

export function saveDocument(userId: number, docType: string, side: string, encryptedKey: string) {
  return db.insert(documents).values({ userId, docType, side, encryptedKey, uploadedAt: new Date() }).returning().get();
}

/* ---- partners ---- */

export function createPartner(input: { companyName: string; email: string; apiKeyHash: string; plan?: string }) {
  return db.insert(partners).values({
    companyName: input.companyName, email: input.email, apiKeyHash: input.apiKeyHash,
    plan: input.plan || "starter", createdAt: new Date(),
  }).returning().get();
}

export function findPartnerByEmail(email: string) {
  return db.select().from(partners).where(eq(partners.email, email.toLowerCase())).get();
}

export function findPartnerByApiKeyHash(hash: string) {
  return db.select().from(partners).where(eq(partners.apiKeyHash, hash)).get();
}

export function getPartnerById(id: number) {
  return db.select().from(partners).where(eq(partners.id, id)).get();
}

export function listPartners() {
  return db.select().from(partners).orderBy(desc(partners.createdAt)).all();
}

export function updatePartnerStatus(id: number, status: string) {
  return db.update(partners).set({ status }).where(eq(partners.id, id)).run();
}

export function rotatePartnerApiKey(id: number, newHash: string) {
  return db.update(partners).set({ apiKeyHash: newHash }).where(eq(partners.id, id)).run();
}

export function publicPartner(p: typeof partners.$inferSelect | undefined) {
  if (!p) return null;
  // NOTE: apiKeyHash is intentionally never exposed — keys are shown once at generation only.
  return {
    id: p.id, companyName: p.companyName, email: p.email, plan: p.plan,
    status: p.status, createdAt: p.createdAt,
  };
}

/* ---- api usage ---- */

export function logApiUsage(partnerId: number, endpoint: string, responseCode: number, latencyMs: number) {
  return db.insert(apiUsageLogs).values({ partnerId, endpoint, responseCode, latencyMs, createdAt: new Date() }).run();
}

export function getUsageStats(partnerId: number) {
  const rows = db.select().from(apiUsageLogs).where(eq(apiUsageLogs.partnerId, partnerId)).all();
  const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const monthRows = rows.filter((r) => (r.createdAt?.getTime() ?? 0) >= thisMonth);
  const totalLatency = monthRows.reduce((s, r) => s + r.latencyMs, 0);
  return {
    totalCalls: rows.length,
    callsThisMonth: monthRows.length,
    avgResponseMs: monthRows.length ? Math.round(totalLatency / monthRows.length) : 0,
    recent: rows.slice(-10).reverse(),
  };
}

/* ---- credential access log ---- */

export function logCredentialAccess(userId: number, partnerId: number, accessType: string) {
  return db.insert(credentialAccessLog).values({ userId, partnerId, accessType, accessedAt: new Date() }).returning().get();
}

export function getConnectedPlatforms(userId: number) {
  return db.select().from(credentialAccessLog).where(eq(credentialAccessLog.userId, userId)).all();
}

export function revokePlatformAccess(userId: number, partnerId: number) {
  db.delete(credentialAccessLog).where(and(eq(credentialAccessLog.userId, userId), eq(credentialAccessLog.partnerId, partnerId))).run();
}

/* ---- audit logs ---- */

export function listAuditLogs(limit = 50) {
  return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit).all();
}

/* ---- notifications ---- */

export function createNotification(userId: number, type: string, message: string) {
  return db.insert(notifications).values({ userId, type, message, read: false, createdAt: new Date() }).returning().get();
}

export function listNotifications(userId: number) {
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(20).all();
}

export function markNotificationRead(id: number) {
  return db.update(notifications).set({ read: true }).where(eq(notifications.id, id)).run();
}

/* ---- webhooks ---- */

export function registerWebhook(partnerId: number, url: string, events: string[]) {
  const secret = crypto.randomBytes(24).toString("hex");
  return db.insert(webhooks).values({ partnerId, url, secret, events: JSON.stringify(events), active: true, createdAt: new Date() }).returning().get();
}

export function listWebhooks(partnerId: number) {
  return db.select().from(webhooks).where(eq(webhooks.partnerId, partnerId)).all();
}

export function deleteWebhook(id: number, partnerId: number) {
  return db.delete(webhooks).where(and(eq(webhooks.id, id), eq(webhooks.partnerId, partnerId))).run();
}

/* ---- admin metrics ---- */

export function adminMetrics() {
  const verified = db.select().from(verifications).where(eq(verifications.status, "verified")).all().length;
  const totalUsers = db.select().from(users).all().length;
  const startOfDay = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime();
  const verificationsToday = listVerifications().filter((v) => (v.createdAt?.getTime() ?? 0) >= startOfDay).length;
  const apiCallsToday = db.select().from(apiUsageLogs).all().filter((r) => (r.createdAt?.getTime() ?? 0) >= startOfDay).length;
  const rejected = listVerifications().filter((v) => v.status === "rejected").length;
  const allV = listVerifications().length;
  const rejectionRate = allV ? Math.round((rejected / allV) * 100) : 0;
  return {
    totalVerifiedUsers: verified,
    totalUsers,
    verificationsToday,
    apiCallsToday,
    rejectionRate,
  };
}

// re-export encrypt/decrypt for services/tests
export { encrypt, decrypt, hashEmail };
