/**
 * Email + SMS adapters — MOCK implementations.
 *
 * Production: SendGrid / Resend (email) and Twilio (SMS).
 * Here we log to the console and store nothing sensitive.
 * Replace send() / sendOtp() with the real provider calls.
 */

export interface OutboundEmail {
  to: string;
  subject: string;
  html: string;
}

const SENT_LOG: OutboundEmail[] = [];

export async function sendEmail(email: OutboundEmail): Promise<void> {
  SENT_LOG.push(email);
  if (process.env.EMAIL_PROVIDER !== "none") {
    console.log(`[EMAIL(mock) → ${email.to}] ${email.subject}`);
  }
}

export async function sendOtp(to: string, code: string): Promise<void> {
  console.log(`[SMS(mock) → ${to}] verification code: ${code}`);
}

export function sentLog(): OutboundEmail[] {
  return SENT_LOG;
}

export function emailBody(kind: string, data: Record<string, string>): string {
  switch (kind) {
    case "welcome":
      return `<p>Welcome to TrustPass, ${data.name}! Please verify your email to continue.</p>`;
    case "verify-email":
      return `<p>Your TrustPass verification code is <strong>${data.code}</strong>. It expires in 10 minutes.</p>`;
    case "verified":
      return `<p>Congratulations ${data.name}, your identity is verified. Your TrustPass Credential ID is <strong>${data.credentialId}</strong>.</p>`;
    case "failed":
      return `<p>Your verification attempt failed: ${data.reason}. You have ${data.remaining} attempts remaining.</p>`;
    case "expiring":
      return `<p>Your TrustPass credential expires on ${data.expiry}. Re-verify to stay active.</p>`;
    case "expired":
      return `<p>Your TrustPass credential has expired. Please re-verify your identity.</p>`;
    case "revoked":
      return `<p>${data.partner} no longer has access to your TrustPass credential.</p>`;
    case "connected":
      return `<p>${data.partner} accessed your TrustPass credential for verification.</p>`;
    default:
      return "<p>TrustPass notification.</p>";
  }
}
