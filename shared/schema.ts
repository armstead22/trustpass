import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/* ============================================================
   TrustPass Data Model (SQLite via better-sqlite3 + Drizzle)
   PII fields (email, name, dob) are stored AES-256-GCM encrypted;
   a deterministic email_hash is kept alongside for lookups.
   Arrays (events) are JSON text columns parsed in app code.
   ============================================================ */

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  emailEnc: text("email_enc").notNull(),            // AES-256-GCM ciphertext
  emailHash: text("email_hash").notNull().unique(),  // HMAC(email) for lookup
  nameEnc: text("name_enc").notNull(),              // AES-256-GCM ciphertext
  dobEnc: text("dob_enc"),                          // AES-256-GCM ciphertext
  country: text("country"),
  passwordHash: text("password_hash").notNull(),    // bcrypt(12)
  role: text("role").notNull().default("user"),     // user | admin
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("active"), // active | suspended | banned
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const verifications = sqliteTable("verifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  status: text("status").notNull().default("pending"), // pending | verified | rejected | expired
  level: text("level"),                              // basic | enhanced | institutional
  stellarTxHash: text("stellar_tx_hash"),
  verifiedAt: integer("verified_at", { mode: "timestamp" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  rejectionReason: text("rejection_reason"),
  attemptCount: integer("attempt_count").notNull().default(0),
  lockedUntil: integer("locked_until", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  docType: text("doc_type").notNull(),              // passport | drivers_license | national_id
  side: text("side").notNull(),                      // front | back
  encryptedKey: text("encrypted_key").notNull(),    // reference to encrypted blob (mock S3 key)
  uploadedAt: integer("uploaded_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const partners = sqliteTable("partners", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyName: text("company_name").notNull(),
  email: text("email").notNull().unique(),
  apiKeyHash: text("api_key_hash").notNull(),        // SHA-256 hash of API key (shown once only)
  plan: text("plan").notNull().default("starter"),   // starter | growth | enterprise
  status: text("status").notNull().default("active"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const apiUsageLogs = sqliteTable("api_usage_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  partnerId: integer("partner_id").notNull().references(() => partners.id),
  endpoint: text("endpoint").notNull(),
  responseCode: integer("response_code").notNull(),
  latencyMs: integer("latency_ms").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const credentialAccessLog = sqliteTable("credential_access_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  partnerId: integer("partner_id").notNull().references(() => partners.id),
  accessType: text("access_type").notNull(),         // verify | status | revoked
  accessedAt: integer("accessed_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actorId: integer("actor_id"),                       // null = system
  actorRole: text("actor_role").notNull(),             // user | admin | partner | system
  action: text("action").notNull(),
  targetId: integer("target_id"),
  metadata: text("metadata").notNull().default("{}"), // JSON
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type").notNull(),                       // welcome | verified | failed | expiring | expired | revoked | connected
  message: text("message").notNull(),
  read: integer("read", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const webhooks = sqliteTable("webhooks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  partnerId: integer("partner_id").notNull().references(() => partners.id),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  events: text("events").notNull().default("[]"),     // JSON array
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

/* ---------------- Validation schemas ---------------- */

export const signupSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2, "Name is required"),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const verifyIdentitySchema = z.object({
  legalName: z.string().min(2, "Legal name is required"),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  country: z.string().min(2, "Country is required"),
  docType: z.enum(["passport", "drivers_license", "national_id"]),
  // base64 data URLs for the document images + selfie
  docFront: z.string().min(50, "Front of ID required"),
  docBack: z.string().optional(),
  selfie: z.string().min(50, "Selfie required"),
});
export type VerifyIdentityInput = z.infer<typeof verifyIdentitySchema>;

export const registerWebhookSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  events: z.array(z.string()).default([]),
});

export const partnerAuthSchema = z.object({
  email: z.string().email(),
  apiKey: z.string().min(10),
});

export const verifyCredentialSchema = z.object({
  credential_id: z.string().optional(),
  email_hash: z.string().optional(),
  email: z.string().email().optional(),
}).refine((d) => d.credential_id || d.email_hash || d.email, {
  message: "Provide credential_id, email_hash, or email",
});

export const ROLE = {
  USER: "user",
  ADMIN: "admin",
} as const;

export const VERIFICATION_LEVELS = ["basic", "enhanced", "institutional"] as const;
export type VerificationLevel = (typeof VERIFICATION_LEVELS)[number];
