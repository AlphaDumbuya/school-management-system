# Academic Year Architecture — Requirements

## Purpose

Make every sidebar module behave correctly across the **academic-year lifecycle**
(a year runs, a new year starts, students are promoted) and across **all portals**
(admin/principal, super_admin, teacher, accountant, admissions_officer, student,
parent/guardian). Each module is brought to **100% production-ready**, one at a
time, in **sidebar order**, so we never destabilize the whole app at once.

This spec is the CONTRACT every module must satisfy before it is signed off.

## Scope

- ONLY the live (v1) sidebar items, worked top-to-bottom (see tasks.md).
- v2 items (behind `V2_ENABLED=false`) are OUT OF SCOPE until enabled.
- All portals that can see a module must be verified for that module.

## Vocabulary

- **Academic session**: a row in `academic_sessions` (id, tenant_id, name,
  start_date, end_date, is_active). `name` is the human year string.
- **Academic year (string)**: canonical format **`YYYY/YYYY`** (e.g. `2026/2027`).
  Some legacy data uses `YYYY-YYYY` (hyphen) — this MUST be normalized.
- **Current/active year**: the tenant's single `academic_sessions` row with
  `is_active = true`.
- **Year-scoped data**: any record that belongs to a specific year, keyed either
  by `academic_session_id` (FK) or by the `academic_year` string.

## Global Requirements (apply to EVERY module)

### R1 — Single source of truth for "current year"
1.1 There is exactly ONE active session per tenant (DB-enforced).
1.2 The year string format is canonical `YYYY/YYYY` everywhere it is stored or
    compared. No module fabricates years from `new Date()` for its picker.
1.3 Any UI year selector is populated from the real `academic_sessions`
    (via `GET /api/v1/school-config/academic-sessions`), defaulting to the
    active session.

### R2 — Correct year scoping in every query
2.1 Reads that are year-specific MUST filter by the correct session id or year
    string; they must not accidentally mix years or show lifetime totals when a
    single year is expected.
2.2 Writes MUST stamp the correct year (session id and/or year string) so the
    record lands in the right year.
2.3 History is never overwritten: a new year's data occupies new rows; prior
    years remain intact and retrievable.

### R3 — Year transition (Start New Year + Promotion) integrity
3.1 Starting a new year archives the old session and activates the new one
    without deleting data.
3.2 Classes carry forward into the new session as new rows (no class row reused
    across years).
3.3 Promotion moves students into the NEW session's classes (closes old
    enrollment `status='promoted'`, opens a new active one), non-destructively.
3.4 After transition, every portal shows the NEW year as "current" and treats
    the prior year as history.

### R4 — All portals correct
4.1 For each module, every role that can access it sees data scoped to THEIR
    correct context and year:
    - student → own current-year data (+ history via report cards/archive)
    - parent/guardian → each ward's current-year data (+ history)
    - teacher → their assigned classes' current-year data
    - accountant → finance data for the selected/active year
    - admissions_officer → admissions/enrollment data
    - principal/super_admin → full tenant, any year selectable
4.2 A role NEVER sees another tenant's data, another student's private data, or
    actions it cannot perform (no dead buttons that 403).

### R5 — Auto-refresh without re-login
5.1 Role/enrollment/year changes reflect in portals without a manual re-login
    (backend reads live; frontend refreshes identity on focus/interval).

### R6 — Production quality bar (every module)
6.1 Frontend (`vite build`) and backend (`tsup`) both compile with no new errors.
6.2 No stale caches masking data (correct `staleTime`/invalidation where a
    change must show promptly).
6.3 Empty/loading/error states are handled and name the year where relevant.
6.4 Tenant-scoped + role-guarded on the backend (defense in depth), not only UI.
6.5 No data loss on year change; reversible/auditable where destructive.

### R7 — Historical (past-year) data is a first-class citizen
7.1 EVERY page that shows year-specific data MUST let the user view PAST years,
    not just the current one. Old academic data is never hidden or lost — it is
    reachable through the page's own year filter.
7.2 A student can view their OWN past data (results, report cards, attendance,
    fees, class placements) for any year they were enrolled.
7.3 A parent/guardian can view each ward's past data for any year.
7.4 Staff (teacher within scope, accountant, admissions, principal/super_admin)
    can view historical data for the years relevant to their role.
7.5 Backend endpoints for year-specific reads MUST accept a year/session
    parameter and return that year's data (not only the active year); when no
    year is given they default to the active year.
7.6 Historical reads are READ-ONLY where the year is locked/archived (no
    accidental edits to a closed year), but always viewable.

### R8 — Universal dynamic year filter (every relevant page)
8.1 Every page listing year-specific data has a YEAR FILTER control.
8.2 The filter options are DYNAMIC — sourced from the tenant's real
    `academic_sessions` (via the shared hook), NEVER a `new Date()`-fabricated
    list, and NEVER hard-coded years.
8.3 The filter shows only years that exist for the tenant (plus a sensible
    current-year fallback for a brand-new school), and defaults to the ACTIVE
    year on load.
8.4 Changing the filter re-scopes ALL of that page's data to the chosen year
    (charts, tables, KPIs, exports) — no mixed-year residue.
8.5 The control is consistent across the app (same shared component/hook), so
    it looks and behaves the same on every page and in every portal.

### R9 — All six roles/portals covered, every module
9.1 Every module fix is verified for EACH role that can access it:
    STUDENT, PARENT/GUARDIAN, TEACHER, ACCOUNTANT, ADMISSIONS_OFFICER,
    PRINCIPAL, and SUPER_ADMIN (administrator).
9.2 A change "takes effect as applied" in every portal — i.e. after a year
    change, promotion, or role change, each portal reflects it without a manual
    re-login (per R5), and each portal's year filter reflects the real years.
9.3 No portal is left behind: if a module is signed off, ALL its portals are
    confirmed, not just the admin view.

## Acceptance (per module)

A module is DONE only when its checklist in tasks.md is fully ticked, both
builds pass, changes are committed + pushed, and RESUME_NOTES.md records the
sign-off with the date and commit hash.
