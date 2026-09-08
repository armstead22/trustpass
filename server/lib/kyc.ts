/**
 * KYC adapter — MOCK implementation.
 *
 * In production this calls Persona or Jumio for document scanning +
 * biometric selfie match. Here we simulate the API with deterministic,
 * clearly-labeled fake responses so the full app works end-to-end.
 *
 * Swap by implementing the same interface against the real vendor SDK:
 *   PersonaClient.verifyInquiry(...) / JumioClient.submit(...)
 */
import type { VerifyIdentityInput } from "@shared/schema";

export interface KycResult {
  passed: boolean;
  reason?: string;
  level: "basic" | "enhanced" | "institutional";
  // mock evidence fields
  checks: { name: string; result: "pass" | "fail" | "review"; detail: string }[];
}

const REVIEW_TRIGGERS = ["test", "fake", "sample", "example", "john doe"];

export async function runKyc(input: VerifyIdentityInput): Promise<KycResult> {
  // simulate network/processing latency
  await new Promise((r) => setTimeout(r, 600));

  const lower = `${input.legalName} ${input.country}`.toLowerCase();
  const looksFake = REVIEW_TRIGGERS.some((t) => lower.includes(t));

  // document + selfie "checks" (simulated)
  const checks = [
    { name: "Document authenticity", result: "pass" as const, detail: "MRZ parsed, no tamper detected (mock)" },
    { name: "MRZ / data consistency", result: "pass" as const, detail: "Name + DOB fields consistent (mock)" },
    { name: "Face match (selfie ↔ ID)", result: looksFake ? "review" as const : "pass" as const, detail: looksFake ? "Low confidence match (mock)" : "High confidence match (mock)" },
    { name: "Liveness check", result: "pass" as const, detail: "Selfie motion captured (mock)" },
    { name: "Watchlist / sanctions screen", result: "pass" as const, detail: "No matches (mock)" },
  ];

  if (looksFake) {
    return {
      passed: false,
      reason: "Biometric match confidence below threshold — please retake selfie",
      level: "basic",
      checks,
    };
  }

  const level = input.docType === "passport" ? "enhanced" : "basic";
  return { passed: true, level, checks };
}
