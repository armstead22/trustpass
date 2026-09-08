import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { encrypt, decrypt, hashApiKey, generateApiKey, safeEqual, hashEmail } from "../crypto";

describe("API key & encryption utilities", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("generates API keys with the tp_live_ prefix and sufficient entropy", () => {
    const key = generateApiKey();
    expect(key.startsWith("tp_live_")).toBe(true);
    expect(key.length).toBeGreaterThanOrEqual(40);
    // two generations are distinct
    expect(generateApiKey()).not.toBe(key);
  });

  it("hashes API keys one-way (never reversible to the raw key)", () => {
    const key = generateApiKey();
    const h = hashApiKey(key);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain(key);
    // same input -> same hash (deterministic, for lookup)
    expect(hashApiKey(key)).toBe(h);
  });

  it("safeEqual compares strings in constant time", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("AES-256-GCM PII encryption", () => {
  beforeEach(() => vi.stubEnv("ENCRYPTION_KEY", "vitest-encryption-key-16"));

  it("round-trips plaintext PII", () => {
    const original = "Alex Rivera, DOB 1990-01-01, SSN 000-00-0000";
    const ciphertext = encrypt(original);
    expect(ciphertext).not.toContain(original);
    expect(decrypt(ciphertext)).toBe(original);
  });

  it("produces distinct ciphertexts for the same input (random IV)", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("fails to decrypt tampered ciphertext (auth tag mismatch)", () => {
    const ciphertext = encrypt("secret");
    const tampered = ciphertext.slice(0, -2) + "AA";
    expect(() => decrypt(tampered)).toThrow();
  });

  it("hashEmail is deterministic and case-insensitive for lookups", () => {
    expect(hashEmail("User@Example.com")).toBe(hashEmail("user@example.com"));
    expect(hashEmail("user@example.com")).not.toBe(hashEmail("other@example.com"));
  });
});
