# Implementation Plan — Comprehensive Super Admin Tenant Management

- [x] 1. Backend: billing service + routes (real, SLE currency)
  - Fixed `billing_history.currency` to SLE; added renew/extend/expire to `SubscriptionService`; restore-on-change.
  - Added platform routes: GET billing, POST renew/extend/expire.
  - _Requirements: 1_

- [x] 2. Backend: TenantUserService + routes
  - list/reset-password/status/unlock/disable-2fa, all tenant-scoped.
  - _Requirements: 2_

- [x] 3. Backend: PlatformAuditService wrapper + wired into all lifecycle/billing/user actions
  - _Requirements: 5_

- [x] 4. Backend: ImpersonationService + route (scoped JWT + audit)
  - _Requirements: 3_

- [x] 5. Backend: usage endpoint + school-profile update/read + restore + settings.archived_from on delete
  - _Requirements: 4, 6, 7_

- [x] 6. Backend: migration 120 storage cols + school-config storage routes + per-tenant upload cred resolver
  - _Requirements: 8_

- [x] 7. Frontend: platformService methods for all new endpoints
  - _Requirements: 1,2,3,4,5,6,7_

- [x] 8. Frontend: TenantDetailPage tabs — Billing, Users, Audit; Overview usage bars; restore in Danger Zone
  - _Requirements: 1,2,4,5,6,7_

- [x] 9. Frontend: impersonation banner + session swap/exit
  - _Requirements: 3_

- [x] 10. Frontend: StorageSettings in SettingsPage (principal) mirroring email sender
  - _Requirements: 8_

- [x] 11. Build backend + frontend green; diagnostics clean; commit + push
  - _Requirements: all_
```
Backend build: green (tsup). Frontend build: green (vite). Migration 120 applied to dev DB.
```

## Notes / Follow-ups (not blocking)
- Branding (logo/short name) editing UI in the Profile tab can be added next; backend `school-profile` GET/PUT endpoints are ready.
- Platform-wide audit page (all tenants) is deferred; per-tenant Audit tab is live.
