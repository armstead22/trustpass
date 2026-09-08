import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as s from "../storage";

beforeEach(() => {
  vi.stubEnv("DB_PATH", ":memory:");
  vi.resetModules();
});
afterEach(() => vi.unstubAllEnvs());

async function freshStorage() {
  return await import("../storage");
}

describe("Verification flow storage layer", () => {
  it("creates a verification record in pending status", async () => {
    const storage = await freshStorage();
    const user = storage.createUser({ email: "v@x.io", passwordHash: "hash", name: "V" });
    const v = storage.createVerification(user.id);
    expect(v.status).toBe("pending");
    expect(storage.getVerificationByUserId(user.id)!.status).toBe("pending");
  });

  it("transitions pending -> verified only after attestation", async () => {
    const storage = await freshStorage();
    const user = storage.createUser({ email: "v2@x.io", passwordHash: "hash", name: "V2" });
    const v = storage.createVerification(user.id);
    storage.updateVerification(v.id, { status: "verified", level: "enhanced", stellarTxHash: "ABC123" });
    const pub = storage.publicVerification(storage.getVerificationByUserId(user.id))!;
    expect(pub.status).toBe("verified");
    expect(pub.credentialId).toBe("ABC123");
  });

  it("counts attempts and locks out after 3 failures for 24h", async () => {
    const storage = await freshStorage();
    const user = storage.createUser({ email: "v3@x.io", passwordHash: "hash", name: "V3" });
    storage.createVerification(user.id);
    let r = storage.incrementVerificationAttempt(user.id);
    expect(r.attempts).toBe(1);
    expect(r.locked).toBeNull();
    r = storage.incrementVerificationAttempt(user.id);
    expect(r.attempts).toBe(2);
    expect(r.locked).toBeNull();
    r = storage.incrementVerificationAttempt(user.id);
    expect(r.attempts).toBe(3);
    expect(r.locked).toBeTruthy(); // Date set -> locked for 24h
    const v = storage.getVerificationByUserId(user.id)!;
    expect(v.lockedUntil).toBeTruthy();
    expect(v.lockedUntil!.getTime()).toBeGreaterThan(Date.now() + 23 * 3600 * 1000);
  });

  it("GDPR delete removes PII but retains anonymized verification record", async () => {
    const storage = await freshStorage();
    const user = storage.createUser({ email: "gdpr@x.io", passwordHash: "hash", name: "GDPR User" });
    const v = storage.createVerification(user.id);
    storage.updateVerification(v.id, { status: "verified", stellarTxHash: "TX-RECORD" });
    storage.deleteUser(user.id);
    // user row is anonymized (PII wiped), not hard-deleted
    const deletedUser = storage.getUserById(user.id);
    expect(deletedUser).toBeTruthy();
    expect(deletedUser!.status).toBe("deleted");
    const pub = storage.publicUser(deletedUser)!;
    expect(pub.email).toBe("[deleted]");
    expect(pub.name).toBe("[deleted]");
    // but the on-chain attestation record is retained (anonymized)
    const retained = storage.getVerificationById(v.id);
    expect(retained).toBeTruthy();
    expect(retained!.stellarTxHash).toBe("TX-RECORD");
  });
});
