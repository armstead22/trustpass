import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { generateApiKey, hashApiKey } from "../lib/crypto";
import * as s from "../storage";

// Use an isolated in-memory DB for each test run so we never touch dev data.
beforeEach(() => {
  vi.stubEnv("DB_PATH", ":memory:");
  vi.resetModules();
});
afterEach(() => vi.unstubAllEnvs());

// Re-import storage after resetting modules so it binds to the in-memory DB.
async function freshStorage() {
  const mod = await import("../storage");
  return mod;
}

describe("Partner API key validation & credential lookup", () => {
  it("looks up a partner by a valid (hashed) API key", async () => {
    const storage = await freshStorage();
    const apiKey = generateApiKey();
    const partner = storage.createPartner({
      companyName: "Test Exchange",
      email: "api@testexchange.io",
      apiKeyHash: hashApiKey(apiKey),
      plan: "growth",
    });
    expect(partner.id).toBeGreaterThan(0);
    const found = storage.findPartnerByApiKeyHash(hashApiKey(apiKey));
    expect(found).toBeTruthy();
    expect(found!.companyName).toBe("Test Exchange");
    expect(found!.status).toBe("active");
  });

  it("returns undefined for an unknown API key", async () => {
    const storage = await freshStorage();
    storage.createPartner({ companyName: "X", email: "x@x.io", apiKeyHash: hashApiKey(generateApiKey()) });
    expect(storage.findPartnerByApiKeyHash(hashApiKey(generateApiKey()))).toBeUndefined();
  });

  it("never stores or returns the raw API key, only its SHA-256 hash", async () => {
    const storage = await freshStorage();
    const apiKey = generateApiKey();
    storage.createPartner({ companyName: "Secured", email: "s@x.io", apiKeyHash: hashApiKey(apiKey) });
    const found = storage.findPartnerByApiKeyHash(hashApiKey(apiKey))!;
    // publicPartner must not leak the hash or the raw key
    const pub = storage.publicPartner(found);
    expect(JSON.stringify(pub)).not.toContain(apiKey);
    expect(JSON.stringify(pub)).not.toContain(hashApiKey(apiKey));
  });

  it("rotating an API key invalidates the old key and validates the new one", async () => {
    const storage = await freshStorage();
    const oldKey = generateApiKey();
    const partner = storage.createPartner({ companyName: "Rotate", email: "r@x.io", apiKeyHash: hashApiKey(oldKey) });
    const newKey = generateApiKey();
    storage.rotatePartnerApiKey(partner.id, hashApiKey(newKey));
    expect(storage.findPartnerByApiKeyHash(hashApiKey(oldKey))).toBeUndefined();
    expect(storage.findPartnerByApiKeyHash(hashApiKey(newKey))).toBeTruthy();
  });
});
