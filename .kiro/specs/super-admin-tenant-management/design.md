# Design — Comprehensive Super Admin Tenant Management

## Overview

Make the super admin console a complete, production-grade multi-tenant operations
surface. Everything the platform operator needs to run schools day-to-day —
without ever reaching into a school's academic data or setting a tenant's own
storage credentials.

This builds directly on what already works:
- `TenantService` (CRUD + lifecycle), `SubscriptionService` (plan changes that
  already gate features/limits via `subscriptionGuard.ts`).
- Per-tenant email sender pattern (`schools.email_sender_mode/verified/from_address`)
  — we mirror this exact pattern for UploadThing storage credentials.

### Scope

**Super admin gets:**
1. Real, visible billing — history/invoices, correct SLE currency, renew/extend/expire, suspend-for-nonpayment + restore.
2. Tenant user management — list users; reset/reissue principal password; unlock; disable 2FA; activate/deactivate. Scoped to one tenant.
3. Impersonation — supported "enter school as support" with audit record + return path.
4. Tenant branding & profile — logo, short name, principal info, locale (schools table).
5. Audit trail — super-admin view of tenant lifecycle + impersonation + billing events.
6. Usage vs limits — X/Y users, A/B students per tenant, at-capacity warnings.
7. Restore archived (soft-deleted) tenant.

**Principal (tenant admin) gets, in Settings:**
8. UploadThing storage credentials configuration (own account), mirroring the email-sender UX.

**Explicitly NOT touched:**
- Super admin never sets a tenant's storage credentials (tenant self-serves in Settings; our team assists during setup).
- Super admin never edits academic data (grades, attendance, results) — impersonation is the supported path for hands-on support.

## Architecture

```
Super Admin UI (React)
  PlatformTenantsPage ─┐
  TenantDetailPage ────┼─→ platformService ─→ /api/v1/platform/* ─→ TenantService
  PlatformBillingViews ┘                                          ─→ SubscriptionService
                                                                  ─→ TenantUserService (new)
                                                                  ─→ AuditService (new/wrap)
                                                                  ─→ ImpersonationService (new)

Principal UI (React)
  SettingsPage → StorageSenderSettings → /api/v1/school-config/storage → schools.storage_* cols
```

## Components and Interfaces

### 1. Billing (make it real + visible)

Backend — extend `SubscriptionService` and add platform routes:
- Fix currency: `billing_history.currency` = `'SLE'` (was hardcoded `'USD'`).
- `getBillingHistory(tenantId)` already exists → expose via `GET /platform/tenants/:id/billing`.
- `renewSubscription(tenantId, billingCycle, userId)` — extend `end_date`, write paid `billing_history` row.
- `extendSubscription(tenantId, days, userId)` — manual grace extension.
- `expireSubscription(tenantId, userId)` — force status `expired` (also flips tenant status).
- On `changePlan`, if tenant/subscription was `expired`/`suspended`, restore to `active` (renewal effect). Already writes limits + features → enforcement is live via `subscriptionGuard`.

Routes (`platformRoutes.ts`):
- `GET  /platform/tenants/:id/billing` → history + active subscription
- `POST /platform/tenants/:id/subscription/renew` { billing_cycle }
- `POST /platform/tenants/:id/subscription/extend` { days }
- `POST /platform/tenants/:id/subscription/expire`

Frontend: new **Billing** tab in `TenantDetailPage` (history table in SLE, renew/extend/expire actions, current period + next-renewal display).

### 2. Tenant User Management (new `TenantUserService`)

Methods (all take `tenantId` + operate only within that tenant):
- `listUsers(tenantId, {search, role, status})`
- `resetPassword(tenantId, userId)` → generates temp password, returns it once (super admin relays it); sets a `must_change_password`-style flag if column exists, else just resets hash.
- `setUserStatus(tenantId, userId, 'active'|'inactive')`
- `unlockUser(tenantId, userId)` → clear lockout/failed-attempt fields if present.
- `disableTwoFactor(tenantId, userId)` → null out 2FA secret/enabled (reuse logic from `twoFactorService`/`disable-2fa.js`).

Routes:
- `GET   /platform/tenants/:id/users`
- `POST  /platform/tenants/:id/users/:userId/reset-password`
- `POST  /platform/tenants/:id/users/:userId/status` { status }
- `POST  /platform/tenants/:id/users/:userId/unlock`
- `POST  /platform/tenants/:id/users/:userId/disable-2fa`

Frontend: **Users** tab in `TenantDetailPage` — table with per-row actions + a "reveal temp password" modal (same pattern as registration success modal).

### 3. Impersonation (new `ImpersonationService`)

- `POST /platform/tenants/:id/impersonate` → super admin picks a target user (default: the principal). Backend mints a scoped JWT for that user with claims `{ impersonatedBy: superAdminId, impersonation: true }`, logs an audit event, returns token + user.
- Frontend stores the impersonation token, swaps the active session, shows a persistent banner ("You are viewing <School> as support — Exit"), and Exit restores the super admin session (kept in a separate storage key).
- Guard: impersonation tokens are honored by normal `authenticate`; a helper flags them so sensitive irreversible actions can be blocked if desired later.

### 4. Tenant Branding & Profile

- Extend the existing tenant update to also patch `schools` row (logo_url, short_name, principal_name, principal_email, website, city, timezone, language_preference).
- Route: `PUT /platform/tenants/:id/school-profile`.
- Frontend: fold into the **Profile** tab (or a **Branding** sub-section) in `TenantDetailPage`.

### 5. Audit Trail (`AuditService` — wrap existing `audit_logs`)

- `record({ tenantId, actorUserId, action, entityType, entityId, changes, ip, userAgent })`.
- Call it from suspend/activate/delete/restore/changePlan/renew/extend/expire/impersonate/user-actions.
- `GET /platform/audit?tenantId=&action=&limit=&offset=` (super admin, all tenants or filtered).
- Frontend: **Audit** tab in `TenantDetailPage` (per-tenant) + optional platform-wide audit page later.

### 6. Usage vs Limits

- `SubscriptionService.getUsage(tenantId)` → { students:{current,max}, staff:{current,max}, users:{current,max} } (reuse `checkLimit`).
- Expose in `GET /platform/tenants/:id` response (augment) or `GET /platform/tenants/:id/usage`.
- Frontend: usage bars on the **Overview** tab with amber/red at ≥80%/≥100%.

### 7. Restore Archived Tenant

- `TenantService.restoreTenant(tenantId, updatedBy)` → status back to `active`, strip the `-deleted-*`/`(Archived-*)` suffixes if present (store original name/slug in `settings.archived_from` at delete time so restore is clean).
- Route: `POST /platform/tenants/:id/restore`. Requires listing archived tenants (`status=expired` filter already supported).
- Frontend: show archived tenants when status filter = expired; add Restore action.

### 8. UploadThing Storage Credentials (Principal Settings)

Mirror the email-sender pattern exactly.

Migration `120_tenant_storage_provider.ts` — add to `schools`:
- `storage_provider` string default `'platform'` ('platform' | 'own')
- `storage_uploadthing_token` text nullable (encrypted at rest via existing crypto util if available, else stored as-is with a TODO)
- `storage_uploadthing_app_id` string nullable
- `storage_configured` boolean default false

Backend:
- `GET  /school-config/storage` (principal) → { provider, configured, appId, tokenMasked }
- `POST /school-config/storage` { provider, uploadthingToken?, appId? } → validates, stores, sets configured.
- Upload service resolves per-tenant creds: if `storage_provider='own'` and configured, use tenant token; else platform default env token.

Frontend: `StorageSettings` component in `SettingsPage` (principal/super_admin), same card/toggle UX as email sender — never shown to plain roles.

## Data Models

`schools` (added): `storage_provider`, `storage_uploadthing_token`, `storage_uploadthing_app_id`, `storage_configured`.
`billing_history` (existing): currency corrected to SLE going forward.
`tenants.settings` (existing jsonb): store `archived_from: { name, slug }` on soft delete for clean restore.
`audit_logs` (existing): reused; no schema change.

## Error Handling

- All platform routes stay `authenticate + authorize(SUPER_ADMIN)`.
- Storage routes stay principal/super_admin only, tenant-scoped via `getTenantId`.
- Impersonation tokens carry `impersonatedBy`; audit every mint.
- Never echo stored secrets (mask tokens; only reveal generated passwords once).

## Testing Strategy

- Backend build (`tsup`) green after each unit.
- Manual/endpoint checks for: change plan → feature gate flips; renew → end_date extends; reset password → login with temp works; impersonate → session swaps + banner + exit; storage own-mode → uploads use tenant token.
- Frontend build green; diagnostics clean per file.

## Correctness Properties

1. A super admin action on tenant A never mutates tenant B's data (tenant isolation on every query).
2. Changing a plan immediately changes what the tenant can access (features/limits read live).
3. A super admin can never read or set a tenant's storage secret; only the tenant configures it and it's never returned unmasked.
4. Impersonation is always attributable (every session mint writes an audit row with the super admin id).
5. Restore returns a tenant to a usable `active` state with its original name/slug.
