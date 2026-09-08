/**
 * TrustPass seed script.
 * Run:  npm run seed   (tsx server/seed.ts)
 * Creates admin, 3 sample verified users (different levels), 2 partners,
 * plus audit + API usage log entries. Prints demo credentials.
 */
import {
  createUser, findUserByEmail, setUserEmailVerified, createVerification,
  updateVerification, createPartner, listPartners, logApiUsage,
} from "./storage";
import { audit } from "./lib/audit";
import { hashPassword } from "./lib/auth";
import { generateApiKey, hashApiKey } from "./lib/crypto";
import { writeAttestation } from "./lib/stellar";

async function main() {
  const now = Date.now();

  // 1 admin
  const adminEmail = "admin@trustpass.io";
  let admin = findUserByEmail(adminEmail);
  if (!admin) {
    admin = createUser({
      email: adminEmail,
      passwordHash: await hashPassword("admin123"),
      name: "TrustPass Admin",
      role: "admin",
    });
    setUserEmailVerified(admin.id, true);
    await audit({ actorId: 0, actorRole: "system", action: "seed_admin", targetId: admin.id });
    console.log(`✓ Admin created: ${adminEmail} / admin123`);
  }

  // 3 sample verified users
  const sampleUsers = [
    { email: "alex.rivera@example.com", name: "Alex Rivera", country: "United States", level: "basic" as const, docType: "drivers_license" },
    { email: "sarah.chen@example.com", name: "Sarah Chen", country: "Singapore", level: "enhanced" as const, docType: "passport" },
    { email: "marco.rossi@example.com", name: "Marco Rossi", country: "Italy", level: "institutional" as const, docType: "passport" },
  ];
  for (const su of sampleUsers) {
    if (findUserByEmail(su.email)) continue;
    const u = createUser({
      email: su.email,
      passwordHash: await hashPassword("password123"),
      name: su.name,
    });
    setUserEmailVerified(u.id, true);
    const v = createVerification(u.id);
    const expiry = new Date(now + 12 * 30 * 24 * 3600 * 1000);
    const attestation = await writeAttestation({
      userHash: String(u.id),
      level: su.level,
      expiryDate: expiry,
    });
    updateVerification(v.id, {
      status: "verified", level: su.level, stellarTxHash: attestation.txHash!,
      verifiedAt: new Date(now - 10 * 24 * 3600 * 1000), expiresAt: expiry,
    });
    await audit({ actorId: u.id, actorRole: "user", action: "verification_passed", targetId: v.id, metadata: { level: su.level, seeded: true } });
    console.log(`✓ User created: ${su.email} / password123  (${su.level}, credential ${attestation.txHash!.slice(0, 12)}…)`);
  }

  // 2 partners with API keys
  const samplePartners = [
    { company: "NovaExchange", email: "api@novaexchange.io", plan: "growth" },
    { company: "Fintech NeoBank", email: "dev@fintechneo.com", plan: "enterprise" },
  ];
  const partnerKeys: { company: string; key: string }[] = [];
  for (const sp of samplePartners) {
    const key = generateApiKey();
    createPartner({ companyName: sp.company, email: sp.email, apiKeyHash: hashApiKey(key), plan: sp.plan });
    partnerKeys.push({ company: sp.company, key });
    console.log(`✓ Partner created: ${sp.company} (${sp.email})`);
    console.log(`    API key (save once): ${key}`);
  }

  // 5 API usage log entries (spread across partners)
  const partners = listPartners();
  const endpoints = ["/api/v1/verify", "/api/v1/status/abc", "/api/v1/usage", "/api/v1/verify", "/api/v1/webhook/register"];
  for (let i = 0; i < 5; i++) {
    const p = partners[i % partners.length];
    logApiUsage(p.id, endpoints[i], i === 2 ? 200 : (i === 3 ? 404 : 200), 30 + i * 17);
  }

  // 10 audit log entries
  const actions = [
    "signup", "login", "email_verified", "verification_submitted", "verification_passed",
    "login", "credential_lookup", "verification_passed", "apikey_rotated", "admin_login",
  ];
  for (let i = 0; i < 10; i++) {
    await audit({
      actorId: i % 3 === 0 ? (admin?.id ?? 1) : (i + 1),
      actorRole: i % 3 === 0 ? "admin" : "user",
      action: actions[i],
      targetId: i + 1,
      metadata: { seeded: true, index: i },
    });
  }

  console.log("\n=== TrustPass seed complete ===");
  console.log("Admin:    admin@trustpass.io / admin123");
  console.log("Users:    <name>@example.com / password123");
  console.log("Stellar mode: " + (process.env.STELLAR_MODE || "mock"));
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
