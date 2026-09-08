import { describe, it, expect, beforeEach } from "vitest";
import { issueCsrfToken, validateCsrfToken } from "../csrf";

describe("CSRF protection", () => {
  it("issues and validates a matching token", () => {
    const token = issueCsrfToken(1);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(validateCsrfToken(1, token)).toBe(true);
  });

  it("rejects a missing token", () => {
    issueCsrfToken(2);
    expect(validateCsrfToken(2, undefined)).toBe(false);
    expect(validateCsrfToken(2, "")).toBe(false);
  });

  it("rejects a mismatched token", () => {
    const token = issueCsrfToken(3);
    expect(validateCsrfToken(3, "0".repeat(64))).toBe(false);
    expect(validateCsrfToken(3, token.slice(0, 60) + "0000")).toBe(false);
  });

  it("rejects a token for the wrong user", () => {
    const token = issueCsrfToken(4);
    expect(validateCsrfToken(999, token)).toBe(false);
  });

  it("rejects constant-time equality edge cases (different length)", () => {
    issueCsrfToken(5);
    expect(validateCsrfToken(5, "short")).toBe(false);
  });
});
