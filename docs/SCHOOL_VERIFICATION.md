# School Verification (account owner)

Simple, instant, entry-based verification for the school **account owner** (principal). No file
uploads, no third-party vendor, no waiting for review.

## Flow

1. Owner opens **Verify School** (`/verify-school`) — sees a short "why verify" rationale.
2. Enters: **EMIS code** + government-ID (type, number, name-as-printed). School level / district /
   year established are optional. The form **auto-fills** from School Settings (EMIS code, founded
   year, district, owner name).
3. Backend validates each field's **format** (sensible ranges, not rigid) and confirms the ID
   **name matches** the registration name (case/accents/whitespace/order/middle-name tolerant).
4. If both pass → **verified instantly**: Verified School badge, prompt for a profile photo.

## Fields & format rules

- **EMIS code**: 4–20 letters/digits.
- **ID number**: passport 6–12 alnum; national ID / driver's licence 5–20 alnum/`-`.
- **Year established** (optional): 4-digit, 1900–current year.

## Rollout behavior (soft nudge — NOT a hard gate)

- No live features are blocked. Unverified owners get:
  - a **recurring, closable reminder popup** each browser session (stops once verified), and
  - a **dashboard banner** CTA.
- All existing owners are `unverified` after migration 125, so they are all prompted automatically.
- **Billing plan changes are hard-gated**: `POST /school-config/subscription/change-plan` requires
  a verified school (`requireVerifiedSchool` → 403 `SCHOOL_VERIFICATION_REQUIRED`). Viewing billing
  history / subscription stays open; only changing/upgrading the plan is blocked until verified.
  Super admins are never gated (they aren't tenant owners). The Settings UI catches the 403 and
  redirects the owner to `/verify-school`.
- The same `requireVerifiedSchool` middleware can be applied to more routes later (e.g. invite/
  create staff, issue/print ID cards, bulk export, bulk delete) without further design changes.

## Data

- `users.verification_status` ('unverified' | 'verified'), `verified_at`, `profile_photo_url`.
- `verification_records` (one per tenant): emis_code, school_level, district, year_established,
  id_type, id_number, id_name, name_match, status, last_reason. Tenant-isolated.
- `schools.emis_code` (migration 126) — captured in School Settings, prefills verification.
- No biometric data, no uploaded document files.

## Honest limitation & future tier

Instant verification proves the EMIS code is **well-formatted** and the **name matches** — it does
not prove the school exists in a government registry (no public EMIS/MBSSE API). A stronger tier
(EMIS lookup API or super-admin spot-check) can be added later via the pluggable slot without
changing the instant flow.
