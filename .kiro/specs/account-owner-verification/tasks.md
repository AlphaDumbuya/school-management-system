# Implementation Plan — Account Owner Verification (Simple Instant)

## Overview

Instant, entry-based school verification: the account owner enters the EMIS code + government-ID
details; WiSkul validates formats (sensible ranges) and matches the ID name to the registration
name; on success the tenant is verified instantly (badge + profile photo, gated features unlock).
No uploads, no admin review, no vendor. Pluggable slot left for a stronger tier later.

## Tasks

- [x] 1. DB: migration 125 (verification state + verification_records)
  - Added users columns (verification_status default 'unverified', verified_at, profile_photo_url)
    and verification_records (tenant-isolated, one row per tenant). Migration ran (batch 41).
  - _Requirements: 5.4, 8.2, 8.4_

- [x] 2. Backend: verificationService (validation + name match + verify)
  - Format validators (EMIS 4–20 alnum; per-ID-type ID number; year 1900..now), token-set name
    match (case/accents/whitespace/order/middle-name tolerant), instant verify() + audit,
    getStatus(), setProfilePhoto(). Owner-only, tenant-scoped, AppError codes per design.
  - _Requirements: 1.3, 1.4, 3.1, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 7.2_

- [x] 3. Backend: routes
  - `/api/v1/verification/{status,verify,profile-photo}` (owner-only), mounted in index.ts.
  - _Requirements: 3.7, 5.1, 7.1, 8.1_

- [x] 4. Backend: gating middleware
  - `requireVerifiedSchool` middleware → 403 SCHOOL_VERIFICATION_REQUIRED when tenant unverified
    (resolves tenant's owner status). Ready to apply to the gated set; deliberately not yet wired
    to live billing/staff routes to avoid locking existing tenants until the frontend flow ships.
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 5. Frontend: verificationService + VerificationPage
  - verificationService (status/verify/profile-photo). VerificationPage at /verify-school: rationale
    panel → confirm name + EMIS + gov-ID form (inline validation mirroring backend) → instant result
    → profile-photo step. Auto-fills EMIS/district/founded-year/owner-name from School Settings.
  - _Requirements: 2.1, 2.2, 2.3, 3.x, 5.1, 7.1_

- [x] 6. Frontend: verified badge, dashboard CTA, EMIS in Settings
  - VerifiedBadge component; VerifySchoolBanner CTA on the principal dashboard (unverified only).
    Added EMIS Code field to School Settings (schools.emis_code, migration 126) end-to-end so it
    persists and prefills verification.
  - _Requirements: 6.2, 7.3, 7.4, 8.1_

- [x] 7. Build green + migrate + docs + commit/push
  - Backend + frontend builds green; migrations 125 + 126 applied; docs/SCHOOL_VERIFICATION.md
    (flow, fields, soft-nudge rollout, honest limitation + future tier). Committed + pushed.
  - _Requirements: 8.3_

## Notes

- Honest limitation: instant verification proves format + name match, not registry existence. A
  stronger EMIS-lookup / super-admin tier can be added later via the pluggable slot (design).
- DECISION (rollout): verification is a SOFT nudge, not a hard gate. No live features are blocked.
  Unverified owners see a recurring, closable "not verified" reminder popup each session + a
  dashboard banner; both stop once verified. The `requireVerifiedSchool` middleware is built and
  ready but intentionally NOT applied to any route, so no existing tenant is locked out. Gating can
  be switched on later per-route without further design changes.
- Only the account owner (tenant owner / principal) is in scope this release.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2"] },
    { "wave": 3, "tasks": ["3", "4"] },
    { "wave": 4, "tasks": ["5", "6"] },
    { "wave": 5, "tasks": ["7"] }
  ]
}
```
