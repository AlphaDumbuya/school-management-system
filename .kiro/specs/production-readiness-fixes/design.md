# Design — Production Readiness Fixes

## Overview

Eight independent fixes/features. Each section below gives the approach, the
files likely touched, and the tenant-isolation note. They can be shipped
one-by-one behind their own commits.

Stack recap: Node/Express/Knex (Postgres/Neon), React 18 + Vite + Tailwind,
react-query, Brevo for email, Capacitor app that loads the live web bundle,
IndexedDB-backed offline layer for the teacher app.

---

## 1. Newsletter welcome email delivery

**Approach:** Diagnose, don't rewrite. The code path exists:
`newsletterRoutes.ts` → `NewsletterService.upsertSubscriber({ optIn:true })`
returns `justSubscribed`, then `emailService.sendNewsletterWelcomeEmail(...)`
using the `sales` platform sender.

Likely causes, in order to check:
- Brevo API key missing/invalid in the deployed env (verify with the existing
  `scripts/verifyBrevoApiKey.ts`).
- `sales` sender identity not verified in Brevo (sender must be a verified
  sender/domain). Compare with `info` sender that DOES work for school welcome.
- The `.catch(console.error)` swallows the real error → temporarily log the full
  provider response to confirm.

**Files:** `backend/src/services/emailService.ts` (sender identity, error log),
`backend/src/routes/newsletterRoutes.ts`, env config, `emailBranding.ts`.

**Fix:** point newsletter welcome at a verified sender (or verify the `sales`
identity), and surface the provider error in logs.

## 2. Data import

**Approach:** New tenant-scoped import endpoints + a reusable frontend importer.
Start with students (highest value), design generically so classes/staff can
reuse it.

- Backend: `POST /api/v1/import/students` accepting multipart CSV/XLSX
  (multer, already used in `uploadRoutes.ts`). Parse (csv-parse / a light XLSX
  reader), validate each row, enforce plan student limit via existing
  `checkSubscriptionLimit`/`SubscriptionService`, insert within a transaction,
  return `{ imported, skipped, errors:[{row, message}] }`.
- Template: `GET /api/v1/import/students/template` returns a CSV with headers.
- Frontend: an `ImportModal` (drag file, preview, run, show summary) wired into
  `StudentDirectoryPage` / `StudentProfilesPage`. Reuse `admissionsService`
  patterns.

**Tenant isolation:** all inserts use `req.user.tenant_id`; never trust a
tenant column in the file.

## 3. Backups

**Approach:** Two layers.
- Platform DB backups: document Neon's automated backup/PITR and the restore
  runbook (ops doc). Minimal code.
- On-demand tenant export bundle: super-admin action
  `POST /api/v1/platform/tenants/:id/backup` that produces a ZIP of the tenant's
  core tables as CSV/JSON (students, staff, classes, finance, attendance). Reuse
  the export serializers from Requirement 4.

**Files:** `platformRoutes.ts`, a new `backupService.ts`, `docs/BACKUPS.md`.

**Tenant isolation:** the bundle is filtered by `tenant_id` for the target
tenant only; super-admin only.

## 4. Data export

**Approach:** A shared export utility + per-page export buttons.
- Backend: `exportService` with `toCsv(rows, columns)` and (where useful)
  `toPdf`. Endpoints per domain, e.g. `GET /api/v1/finance/export?format=csv`,
  `GET /api/v1/students/export`, `GET /api/v1/attendance/export`. Each scoped by
  tenant + role. Currency formatted as `Le`.
- There is prior art: a Phase 22 serialization route
  (`/api/v1/data/serialize/csv`) referenced in tests — evaluate reusing it.
- Frontend: a small `ExportButton` component (CSV/PDF menu) added to data pages,
  triggering a download.

**Tenant isolation:** every export query filters by `req.user.tenant_id`.

## 5. Refresh across pages

**Approach:** A reusable `RefreshButton` that calls
`queryClient.invalidateQueries({ queryKey })` (or a passed `refetch`) with a
spinning state. Standardize page query keys. Add to the shared `PageShell`
header actions so most pages inherit it, plus explicit wiring where pages manage
their own queries.

**Files:** `frontend/src/components/.../PageShell.tsx`, a new `RefreshButton`,
individual pages that need explicit `refetch`.

## 6. Offline modules return no data

**Approach:** Reproduce and trace the attendance offline read path.
- Verify what is cached while ONLINE: does the attendance page pre-cache the
  class roster into IndexedDB? Check the offline spec's sync/cache tasks and the
  `syncRoutes.ts` scope (resolved from the teacher's classes).
- Check the offline READ path: cache key vs. read key mismatch, tenant/class id
  mismatch, or the query not falling back to the cache when offline.
- Likely root cause: students are never pre-cached (only attendance records
  are), or the offline query uses a key that was never written.

**Fix:** ensure the class roster is cached on online load, and the offline read
uses the same key. Then audit the other offline-capable modules for the same
pattern.

**Files:** offline data layer (IndexedDB service), attendance page/hooks,
`syncService.ts`, offline-first spec tasks.

## 7. Update badge dismissal bug

**Approach:** The PWA update flow shows a badge when the service worker reports a
waiting worker. The badge requires a second toggle because state isn't cleared
until the next `controllerchange`/`updatefound` cycle.

**Fix:** on "apply update", call `updateServiceWorker(true)` (or
`registration.waiting.postMessage({type:'SKIP_WAITING'})`) AND immediately clear
the local `needRefresh` state so the badge hides on the first action; let the
reload happen on `controllerchange`.

**Files:** the PWA update hook/component (search `needRefresh` /
`updateServiceWorker` / `registerSW`), likely in `MainLayout` or a
`useServiceWorkerUpdate` hook.

## 8. Professional support with tickets

**Approach:** New ticketing module.
- DB migration: `support_tickets` (id, reference, tenant_id, created_by,
  subject, body, category, priority, status, assigned_to, timestamps) and
  `support_ticket_messages` (thread replies).
- Backend: `supportTicketService` + routes — tenant users create/list/view/reply
  their own tenant's tickets; super-admin/support sees all with filters and can
  change status/assign. Email notifications on create/reply/status change via
  `emailService`.
- Frontend: a `SupportPage` (create + list + thread) for tenant users and a
  panel in the super-admin portal for triage.

**Tenant isolation:** tenant users filtered by `tenant_id`; super-admin has
platform-wide access. Reference numbers unique per platform.

---

## Sequencing

Recommended order by risk/value:
1. Newsletter welcome email (small, config-level).
2. Update badge bug (small, isolated UX).
3. Refresh across pages (shared component, broad but low-risk).
4. Offline attendance data (correctness, needs investigation).
5. Data export (foundation reused by backups).
6. Data import (higher surface area).
7. Backups (reuses export).
8. Support tickets (new module, largest).
