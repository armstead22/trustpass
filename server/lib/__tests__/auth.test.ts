import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { hashPassword, verifyPassword, signAccessToken, signRefreshToken, verifyToken } from "../auth";

const SECRET = "test-secret-for-vitest-32charslong!!";

describe("Auth: password hashing & JWT", () => {
  beforeEach(() => {
    vi.stubEnv("JWT_SECRET", SECRET);
    vi.stubEnv("JWT_ACCESS_TTL_MIN", "15");
    vi.stubEnv("JWT_REFRESH_TTL_DAYS", "7");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("hashes passwords with bcrypt and never stores plaintext", async () => {
    const hash = await hashPassword("mySecret123");
    expect(hash).not.toBe("mySecret123");
    expect(hash.startsWith("$2")).toBe(true);
  });

  it("verifies correct passwords and rejects wrong ones", async () => {
    const hash = await hashPassword("correct-password");
    expect(await verifyPassword("correct-password", hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("signs and verifies access tokens with correct payload", () => {
    const token = signAccessToken({ sub: 42, role: "admin" });
    expect(token.split(".")).toHaveLength(3);
    const payload = verifyToken(token);
    expect(payload.sub).toBe(42);
    expect(payload.role).toBe("admin");
  });

  it("signs refresh tokens with longer TTL", () => {
    const access = signAccessToken({ sub: 1, role: "user" });
    const refresh = signRefreshToken({ sub: 1, role: "user" });
    const accessPayload = verifyToken(access);
    const refreshPayload = verifyToken(refresh);
    expect(refreshPayload.exp!).toBeGreaterThan(accessPayload.exp!);
    expect(refreshPayload.exp! - accessPayload.exp!).toBeGreaterThan(6 * 24 * 3600); // ~7d vs 15m
  });

  it("rejects tokens signed with a different secret", () => {
    const token = signAccessToken({ sub: 1, role: "user" });
    vi.stubEnv("JWT_SECRET", SECRET + "tampered");
    expect(() => verifyToken(token)).toThrow();
  });

  it("rejects malformed tokens", () => {
    expect(() => verifyToken("not-a-jwt")).toThrow();
    expect(() => verifyToken("")).toThrow();
  });
});
