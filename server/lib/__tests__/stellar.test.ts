import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeAttestation, stellarMode } from "../stellar";

describe("Stellar attestation failure handling", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("mock mode always succeeds and is clearly labeled", async () => {
    vi.stubEnv("STELLAR_MODE", "mock");
    const result = await writeAttestation({ userHash: "abc123", level: "basic", expiryDate: new Date(Date.now() + 1e9) });
    expect(result.success).toBe(true);
    expect(result.mode).toBe("mock");
    expect(result.txHash).toMatch(/^[0-9A-F]{64}$/);
    expect(result.attempts).toBe(1);
  });

  it("does NOT silently fall back to a fake hash when Stellar fails", async () => {
    vi.stubEnv("STELLAR_MODE", "testnet");
    // No STELLAR_ISSUER_SECRET configured -> submitOnce throws immediately on every attempt.
    delete process.env.STELLAR_ISSUER_SECRET;
    const result = await writeAttestation({ userHash: "abc123", level: "enhanced", expiryDate: new Date(Date.now() + 1e9) });
    expect(result.success).toBe(false);
    expect(result.txHash).toBeUndefined();
    expect(result.attempts).toBe(3); // retried 3 times
    expect(result.error).toContain("STELLAR_ISSUER_SECRET");
    expect(result.error).toContain("3 attempts");
  });

  it("retries up to 3 times before giving up", async () => {
    vi.stubEnv("STELLAR_MODE", "testnet");
    delete process.env.STELLAR_ISSUER_SECRET;
    const start = Date.now();
    const result = await writeAttestation({ userHash: "xyz", level: "basic", expiryDate: new Date(Date.now() + 1e9) });
    const elapsed = Date.now() - start;
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(3);
    // backoff between attempts: ~0.5s + 1s = at least 1.4s of sleeps
    expect(elapsed).toBeGreaterThanOrEqual(1400);
  });

  it("memo follows the TRUSTPASS:verified:{hash}:{level}:{expiry} format", async () => {
    vi.stubEnv("STELLAR_MODE", "mock");
    const expiry = new Date(2000000000 * 1000); // deterministic
    const result = await writeAttestation({ userHash: "deadbeef", level: "institutional", expiryDate: expiry });
    expect(result.memo).toBe(`TRUSTPASS:verified:deadbeef:institutional:${Math.floor(expiry.getTime() / 1000)}`);
  });
});
