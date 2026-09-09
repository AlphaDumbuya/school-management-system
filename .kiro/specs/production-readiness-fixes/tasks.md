# Implementation Plan — Production Readiness Fixes

## Overview

Eight independent production-readiness fixes found during final pre-merge
testing. Ordered by the recommended sequence (small/isolated first, largest
last). Each references its requirement in `requirements.md`. Multi-tenant
isolation must be preserved in every task.

## Task Dependency Graph

Tasks 1–4 are independent. Task 5 (export foundation) enables 5.1 (export UI)
and is reused by 7 (backups). Task 6 enables 6.1; Task 8 enables 8.1.

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1", "2", "3", "4", "5", "6", "8"] },
    { "wave": 2, "tasks": ["5.1", "7", "6.1", "8.1"] }
  ],
  "dependencies": {
    "1": [],
    "2": [],
    "3": [],
    "4": [],
    "5": [],
    "5.1": ["5"],
    "6": [],
    "6.1": ["6"],
    "7": ["5"],
    "8": [],
    "8.1": ["8"]
  }
}
```

## Tasks

- [x] 1. Fix newsletter welcome email delivery
  - Run `scripts/verifyBrevoApiKey.ts` against the deployed env and confirm the
    `sales` sender identity is verified in Brevo
  - Temporarily log the full provider error in the newsletter welcome `.catch`
    to capture the real cause
  - Point the newsletter welcome at a verified sender (or verify `sales`), then
    confirm a real send succeeds
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Fix the update badge not dismissing on first toggle
  - Locate the PWA update hook/component (`needRefresh`, `updateServiceWorker`,
    `registerSW`)
  - On "apply update", trigger SKIP_WAITING/`updateServiceWorker(true)` AND clear
    local `needRefresh` state immediately so the badge hides on the first action
  - Verify the badge does not reappear until a genuinely newer version exists
  - _Requirements: 7.1, 7.2, 7.3_

- [~] 3. Add consistent refresh across data pages
  - Create a reusable `RefreshButton` that invalidates/refetches page queries and
    shows a spinning state
  - Add it to the shared `PageShell` header actions so pages inherit it
  - Wire explicit `refetch`/query-key invalidation on pages that manage their own
    queries; show error state while keeping last good data
  - _Requirements: 5.1, 5.2, 5.3_

- [~] 4. Fix offline modules returning no data (attendance first)
  - Reproduce the attendance-offline empty-students case and trace the IndexedDB
    read path (cache key vs read key, tenant/class id, offline fallback)
  - Ensure the class roster is pre-cached on online load using the same key the
    offline read uses
  - Verify attendance shows cached students offline
  - Audit other offline-capable modules for the same defect and fix them
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 5. Build a shared data export foundation
  - Create `exportService` with `toCsv(rows, columns)` and `toPdf` where useful;
    format currency as `Le`
  - Evaluate reusing the existing Phase 22 `/api/v1/data/serialize/csv` route
  - Add tenant- and role-scoped export endpoints for finance, students, and
    attendance
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [~] 5.1 Add export buttons to data pages
  - Create an `ExportButton` (CSV/PDF menu) component that downloads the file
  - Wire it into finance, students, and attendance pages
  - _Requirements: 4.1, 4.3_

- [ ] 6. Implement student data import
  - Add `POST /api/v1/import/students` (multipart CSV/XLSX) that validates rows,
    enforces the plan student limit, inserts within a transaction scoped to
    `req.user.tenant_id`, and returns `{ imported, skipped, errors }`
  - Add `GET /api/v1/import/students/template` returning a CSV template
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [~] 6.1 Add the import UI
  - Create an `ImportModal` (upload, preview, run, summary of imported/skipped/
    failed) and wire it into the student directory/profiles page
  - _Requirements: 2.1, 2.3, 2.4_

- [~] 7. Implement tenant backups
  - Add `backupService` producing a ZIP of a tenant's core tables (students,
    staff, classes, finance, attendance) as CSV/JSON, reusing the export
    serializers
  - Add super-admin-only `POST /api/v1/platform/tenants/:id/backup`
  - Write `docs/BACKUPS.md` documenting Neon automated backup/PITR + on-demand
    export + restore runbook
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 8. Build the support ticket module (backend)
  - Migration for `support_tickets` and `support_ticket_messages`
  - `supportTicketService` + routes: tenant users create/list/view/reply their
    own tenant's tickets; super-admin/support lists all with filters, assigns,
    and changes status
  - Email notifications on create/reply/status change; unique platform reference
    numbers
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [~] 8.1 Build the support ticket UI
  - Tenant-facing `SupportPage` (create + list + thread) reachable from the app
  - Super-admin triage panel (list across tenants, filters, reply, status/assign)
  - _Requirements: 8.2, 8.3, 8.5_

## Notes

- Triage findings: the newsletter welcome email code EXISTS and is wired
  (`newsletterRoutes.ts` → `emailService.sendNewsletterWelcomeEmail`); Task 1 is
  a delivery/config diagnosis, not new code. A Phase 22 CSV serialization route
  is referenced in tests and should be evaluated for reuse in Tasks 5 and 7.
- Every backend query added here MUST filter by `req.user.tenant_id` for tenant
  users; only super-admin/support endpoints get platform-wide scope.
