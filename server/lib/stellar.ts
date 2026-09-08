/**
 * Stellar attestation service.
 *
 * Modes (STELLAR_MODE env):
 *   - "mock"     (default): generates a realistic-looking hash, no network.
 *                  Used for local dev / sandbox previews. Clearly labeled.
 *   - "testnet":  submits a REAL transaction to Stellar Testnet via @stellar/stellar-sdk.
 *   - "mainnet":  same as testnet but against Mainnet Horizon (requires funded issuer).
 *
 * The attestation memo is: TRUSTPASS:verified:{userHash}:{level}:{expiryUnix}
 * The returned transaction hash is the user's public "TrustPass Credential ID".
 *
 * FAILURE POLICY (critical):
 *   A verification MUST NOT be marked "verified" until the Stellar transaction is
 *   confirmed on-chain. If submission fails after MAX_ATTEMPTS retries, this function
 *   returns { success: false, error }. The caller must roll the verification back to
 *   "pending" and alert the admin. It NEVER silently substitutes a fake hash — that
 *   would create a "verified in DB, no blockchain record" compliance violation.
 */
import crypto from "node:crypto";
import type { VerificationLevel } from "@shared/schema";

export interface AttestationResult {
  success: boolean;
  txHash?: string;
  mode: "mock" | "testnet" | "mainnet";
  memo: string;
  attempts: number;
  error?: string;
}

type Mode = "mock" | "testnet" | "mainnet";

const MAX_ATTEMPTS = 3;

export function stellarMode(): Mode {
  const m = (process.env.STELLAR_MODE || "mock") as Mode;
  return m === "testnet" || m === "mainnet" ? m : "mock";
}

function buildMemo(userHash: string, level: VerificationLevel, expiryUnix: number): string {
  return `TRUSTPASS:verified:${userHash}:${level}:${expiryUnix}`;
}

/** Sleep helper for exponential backoff between retries. */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Submit one Stellar transaction attempt. Throws on failure. */
async function submitOnce(mode: Mode, memo: string): Promise<string> {
  const stellarMod: any = await import("@stellar/stellar-sdk");
  const { Keypair, TransactionBuilder, Networks, Memo, Operation } = stellarMod;
  const Server = stellarMod.Server;
  const horizonUrl =
    mode === "testnet" ? "https://horizon-testnet.stellar.org" : "https://horizon.stellar.org";
  const network = mode === "testnet" ? Networks.TESTNET : Networks.PUBLIC;
  const secret = process.env.STELLAR_ISSUER_SECRET;
  if (!secret) throw new Error("STELLAR_ISSUER_SECRET is not configured");

  const issuer = Keypair.fromSecret(secret);
  const server = new Server(horizonUrl);
  const account = await server.loadAccount(issuer.publicKey());

  const dataValue = Buffer.from(memo, "utf8").subarray(0, 64);
  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: network,
    memo: Memo.text("TrustPass attestation"),
  })
    .addOperation(Operation.manageData({ name: "trustpass", value: dataValue }))
    .setTimeout(60)
    .build();
  tx.sign(issuer);

  // Confirm the transaction landed on-chain (not just accepted).
  const res = await server.submitTransaction(tx);
  if (!res || !res.hash) throw new Error("Stellar accepted but returned no transaction hash");
  // Poll for confirmation (best-effort): the attestation is only real once confirmed.
  let confirmed = false;
  for (let i = 0; i < 5; i++) {
    try {
      await server.transactions().transaction(res.hash).call();
      confirmed = true;
      break;
    } catch {
      await sleep(1000);
    }
  }
  if (!confirmed) throw new Error("Stellar transaction submitted but not confirmed within timeout");
  return res.hash;
}

export async function writeAttestation(input: {
  userHash: string;
  level: VerificationLevel;
  expiryDate: Date;
}): Promise<AttestationResult> {
  const expiryUnix = Math.floor(input.expiryDate.getTime() / 1000);
  const memo = buildMemo(input.userHash, input.level, expiryUnix);
  const mode = stellarMode();

  // Mock mode: always succeeds (clearly labeled). No network, no real record.
  if (mode === "mock") {
    await new Promise((r) => setTimeout(r, 400));
    return {
      success: true,
      txHash: crypto.randomBytes(32).toString("hex").toUpperCase(),
      mode,
      memo,
      attempts: 1,
    };
  }

  // Real Stellar path: retry with exponential backoff, never fall back to a fake hash.
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const txHash = await submitOnce(mode, memo);
      return { success: true, txHash, mode, memo, attempts: attempt };
    } catch (err: any) {
      lastError = err?.message || String(err);
      console.error(`[STELLAR] attempt ${attempt}/${MAX_ATTEMPTS} failed: ${lastError}`);
      if (attempt < MAX_ATTEMPTS) await sleep(500 * Math.pow(2, attempt - 1)); // 0.5s, 1s, 2s
    }
  }

  // All retries exhausted. Do NOT mark verified. Caller rolls back to "pending".
  return {
    success: false,
    mode,
    memo,
    attempts: MAX_ATTEMPTS,
    error: `Stellar attestation failed after ${MAX_ATTEMPTS} attempts: ${lastError}`,
  };
}

export function stellarExplorerUrl(txHash: string): string {
  const net = stellarMode() === "mainnet" ? "public" : "testnet";
  return `https://stellar.expert/explorer/${net}/tx/${txHash}`;
}
