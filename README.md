# TrustPass — Blockchain Identity Verification

**Verify once. Access everywhere.** TrustPass is a blockchain-based KYC platform: users verify their identity once and reuse that verified credential across exchanges, fintechs, and DeFi — without re-uploading documents. Attestations are anchored on the Stellar blockchain.

> ⚠️ **Demo mode:** KYC (Persona/Jumio), email (SendGrid), SMS (Twilio), and Stellar attestation are **clearly-labeled mocks** by default. PII encryption, auth, rate limiting, CSRF, and the audit log are **real**. Stellar is switchable to Testnet via one env var.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite + Tailwind + shadcn/ui (Inter font) |
| Backend | Node.js + Express + TypeScript |
| Database | SQLite (demo) / PostgreSQL (prod via docker-compose) |
| Cache | Redis (prod, session/cache) |
| Blockchain | Stellar SDK — `manageData` attestation on Testnet |
| Auth | JWT access (15m) + refresh (7d, httpOnly cookie) |
| Security | AES-256-GCM PII encryption, bcrypt(12), Helmet, rate limiting, CSRF, audit log |
| Docs | Swagger UI at `/api/docs`, OpenAPI 3.1 at `/api/openapi.json` |

---

## Quick start

```bash
npm install
cp .env.example .env        # review the defaults
npm run db:seed             # seed admin, 3 users, 2 partners, audit + usage logs
npm run dev                 # http://localhost:5000
```

Run the test suite:

```bash
npm test                   # 30 vitest tests: auth, crypto, CSRF, Stellar failure handling, partner lookup, verification flow
```

### Demo credentials (from seed)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@trustpass.io` | `admin123` |
| User (basic) | `alex.rivera@example.com` | `password123` |
| User (enhanced) | `sarah.chen@example.com` | `password123` |
| User (institutional) | `marco.rossi@example.com` | `password123` |

Partner API keys are printed to the console during `npm run db:seed` (shown once, hashed at rest thereafter).

---

## Pages

`/` landing · `/signup` · `/login` · `/verify` (multi-step KYC) · `/dashboard` · `/dashboard/privacy` · `/partner/login` · `/partner/dashboard` · `/partner/docs` · `/admin` · `/404`

---

## Security

- **AES-256-GCM** encryption of all PII at rest (key derived via scrypt from `ENCRYPTION_KEY`).
- **bcrypt** password hashing (salt rounds 12). Passwords are never retrievable.
- **API keys** are SHA-256 hashed at rest and shown **once** at generation (`tp_live_<48 hex>`).
- **Rate limiting**: 20 req/min per IP on auth routes, 100 req/min on API routes.
- **CORS allowlist** (no wildcards in production) + **Helmet** security headers.
- **CSRF protection** on all state-changing routes (server-bound double-submit token, `X-CSRF-Token` header).
- **Input sanitization / validation** via Zod on every route (SQL-injection + XSS hardening).
- **Immutable audit log** for every sensitive action.
- **GDPR**: users can export all data and delete their account (PII wiped; anonymized on-chain attestation retained).

### Blockchain failure handling (critical)

A user is **never** marked "verified" until the Stellar transaction is confirmed on-chain. If submission fails, TrustPass:

1. Retries up to **3 times** with exponential backoff.
2. Rolls the verification status back to **`pending`** (not `verified`).
3. Alerts the admin and notifies the user that their credential is awaiting blockchain confirmation.

It never silently substitutes a fake transaction hash — that would create a "verified in DB, no blockchain record" compliance violation.

---

## Stellar integration

The attestation memo format is:

```
TRUSTPASS:verified:{userHash}:{level}:{expiryUnix}
```

The returned transaction hash is the user's public **Credential ID**. Partners verify it independently on [Stellar Explorer](https://stellar.expert/explorer/testnet).

Switch networks with one env var:

```bash
STELLAR_MODE=mock       # default — fake tx hash, no network
STELLAR_MODE=testnet   # real transaction on Stellar Testnet (set STELLAR_ISSUER_SECRET)
STELLAR_MODE=mainnet   # production
```

---

## Partner API (v1)

Businesses authenticate with an API key in the `X-API-Key` header (server-to-server; exempt from CSRF).

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/partner/auth` | Exchange API key for a JWT (partner dashboard) |
| `POST` | `/api/v1/verify` | Verify a user by `credential_id` or `email_hash` |
| `GET` | `/api/v1/status/:id` | Status by credential ID |
| `POST` | `/api/v1/webhook/register` | Register a webhook URL |
| `DELETE` | `/api/v1/webhooks/:id` | Delete a webhook |
| `POST` | `/api/v1/apikeys/rotate` | Rotate API key (new key shown once) |
| `GET` | `/api/v1/usage` | Usage stats + limits |

Partner lookups **never return raw PII** — only `verified`, `status`, `level`, `expiresAt`, and `credentialId`.

Full interactive docs: **[http://localhost:5000/api/docs](http://localhost:5000/api/docs)**

```bash
curl -X POST http://localhost:5000/api/v1/verify \
  -H "X-API-Key: tp_live_xxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"credential_id":"ABC123...","purpose":"onboarding"}'
```

---

## Production (Docker)

```bash
docker compose up --build   # Postgres + Redis + app
```

Configure all secrets via `.env` (see `.env.example`). Set `STELLAR_MODE=testnet`, `ENCRYPTION_KEY`, `JWT_SECRET`, and KYC/email/SMS provider keys before going live.

---

## What's mocked vs. real

| Component | Status | Swap-in env vars |
|---|---|---|
| KYC (Persona/Jumio) | 🔶 Mock | `KYC_PROVIDER`, `PERSONA_API_KEY` |
| Email (SendGrid) | 🔶 Mock | `SENDGRID_API_KEY`, `EMAIL_FROM` |
| SMS / OTP (Twilio) | 🔶 Mock | `TWILIO_*` |
| Document storage (S3) | 🔶 Mock S3 keys | `S3_*` / `CLOUDINARY_URL` |
| Stellar attestation | 🔶 Mock (Testnet-ready) | `STELLAR_MODE=testnet`, `STELLAR_ISSUER_SECRET` |
| PII encryption | ✅ Real | `ENCRYPTION_KEY` |
| Auth / JWT / refresh | ✅ Real | `JWT_SECRET` |
| Rate limiting / Helmet / CSRF | ✅ Real | — |
| Audit log | ✅ Real | — |
| GDPR export / delete | ✅ Real | — |

---

## Project structure

```
shared/schema.ts          Drizzle schema + Zod validators (9 tables)
server/
  lib/crypto.ts           AES-256-GCM PII, API key hashing, safe compare
  lib/auth.ts             bcrypt, JWT access/refresh, requireAuth/requireAdmin
  lib/csrf.ts             CSRF token issue/validate/middleware
  lib/stellar.ts          Stellar attestation (mock + testnet, retry+rollback)
  lib/kyc.ts              Mock Persona/Jumio
  lib/email.ts            Mock SendGrid/Twilio
  lib/audit.ts            Immutable audit logging
  storage.ts              SQLite data layer (all CRUD)
  routes.ts               API routes + Swagger + security middleware
  seed.ts                 Demo data
client/src/               React frontend (pages, components, hooks)
```
