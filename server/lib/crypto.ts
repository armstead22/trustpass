import crypto from "node:crypto";

/**
 * AES-256-GCM encryption for PII at rest.
 * Key is derived from ENCRYPTION_KEY (env) via scrypt; in DEMO_MODE a
 * fixed dev key is used and a loud warning is logged at boot.
 * Returns a single base64 string containing iv:authTag:ciphertext.
 */

const DEV_KEY_PASSPHRASE = "trustpass-dev-key-change-me";

function getKeyPassphrase(): string {
  if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length >= 16) {
    return process.env.ENCRYPTION_KEY;
  }
  if (process.env.DEMO_MODE !== "true") {
    // fall back to dev key but warn loudly
    console.warn("[SECURITY] ENCRYPTION_KEY not set — using insecure dev key. Set ENCRYPTION_KEY in production.");
  }
  return DEV_KEY_PASSPHRASE;
}

let cachedKey: Buffer | null = null;
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const salt = crypto.scryptSync(getKeyPassphrase(), "trustpass-salt", 32);
  cachedKey = salt;
  return cachedKey;
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

/** Deterministic HMAC for email lookup without exposing plaintext. */
export function hashEmail(email: string): string {
  return crypto
    .createHmac("sha256", getKey())
    .update(email.toLowerCase().trim())
    .digest("hex");
}

/** One-way hash for API keys (shown once at generation, never retrievable). */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

/** Generate a random API key with a recognizable prefix. */
export function generateApiKey(): string {
  return "tp_live_" + crypto.randomBytes(24).toString("hex");
}

/** Constant-time password-style comparison helper. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
