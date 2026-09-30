# Academic Year Architecture — Design

This document defines the SHARED contract, the standard per-module method, and
the foundation utilities that every module in tasks.md reuses. It is the
"how" that makes the requirements repeatable and safe.

## 1. Foundation (built/verified once, reused by all modules)

### 1.1 Canonical year + sessions (already partly in place)
- `academic_sessions` is the source of truth. Migration `158_academic_session_integrity`
  enforces: at most one `is_active` per tenant, unique `(tenant_id, name)`.
- `GET /api/v1/school-config/academic-sessions` lists real years (active first).
- `startNewAcademicYear` (schoolConfigRoutes + academicYearService) archives the
  old session, activates/creates the new one, clones classes forward.

### 1.2 Canonical format helper (BACKEND) — `normalizeAcademicYear`
- Convert any stored variant to `YYYY/YYYY`:
  - `2026/2027` → unchanged
  - `2026-2027` → `2026/2027`
  - `2026` → `2026/2027`
- Provide a matcher that treats hyphen/slash as equal for legacy rows during
  the transition (so a query for `2026/2027` also finds `2026-2027`).
- A one-time data migration normalizes existing `academic_sessions.name`,
  `sl_subject_results.academic_year`, `sl_report_publications.academic_year`,
  `fees.academic_year`, `fee_structures.academic_year`, `examinations.academic_year`,
  `student_promotions.academic_year` to slash format.

### 1.3 Current-year resolver (BACKEND) — `resolveActiveYear(tenantId)`
- Returns `{ sessionId, yearString }` for the tenant's active session.
- Used as the default when a caller doesn't specify a year.

### 1.4 Year picker (FRONTEND) — reusable hook `useAcademicYears()`
- Fetches `academic-sessions`, returns `{ years[], activeYear, isLoading }`.
- Every module's year dropdown uses this — NO `new Date()` fabrication.

### 1.5 Shared `<YearFilter>` component (FRONTEND) — the ONE control on every page
- A single, consistent dropdown built on `useAcademicYears()`.
- Props: `value`, `onChange`, optional `includeAllOption` (for list pages that
  can show "All years"), and a compact style so it drops into any page header.
- Behaviour: options are the tenant's REAL years (dynamic), defaults to the
  ACTIVE year, shows a friendly label. Used identically across all portals so
  the UX is uniform. Replaces every ad-hoc/`new Date()` year `<select>`.
- Student/parent pages that auto-resolve their own context still render it so a
  user can switch to a PAST year of their own data (R7).

### 1.6 Historical access pattern (BACKEND + FRONTEND)
- Every year-specific GET accepts `?academic_year=` (or `?academic_session_id=`)
  and defaults to the active year when omitted (R7.5).
- Student/parent endpoints resolve the caller's OWN identity, then honor the
  requested year within the set of years they were enrolled (no cross-student
  leakage). A student switching to a past year sees THAT year's own data.
- Closed/locked years are viewable but read-only (R7.6).

## 2. Per-module method (identical for all modules)

Each module goes through these 5 phases; do NOT start the next module until the
current one is signed off.

**Phase A — Audit (read-only)**
- Map the module: frontend page(s) + every portal view, backend route(s)+service,
  DB tables, and how year is (or isn't) applied.
- Produce a short findings note per portal (admin/teacher/student/parent/
  accountant/admissions as applicable).

**Phase B — Gap list**
- List concrete defects against the R1–R6 requirements. Classify each as:
  data-loss risk / correctness / portal-scoping / caching / UX.

**Phase C — Fix**
- Implement the smallest correct change. Prefer reusing the foundation helpers.
- Backend: tenant-scope + role-guard + correct year filter/stamp.
- Frontend: real year picker, correct query keys + invalidation, empty/error states.

**Phase D — Verify**
- `cd frontend && npx vite build` → clean.
- `cd backend && npx tsup` → clean (then `rm -rf dist/src`).
- Manually reason through each portal against the module checklist.

**Phase E — Sign-off**
- Commit + push. Update RESUME_NOTES.md: module name, date, commit hash, and the
  ticked checklist. Only then move to the next module.

## 3. Standard module checklist (applied to each)

For the module under work, confirm ALL that apply:

Year handling & history:
- [ ] Page has the shared `<YearFilter>` (dynamic real years, active default).
- [ ] Changing the year re-scopes ALL data on the page (tables/charts/KPIs/exports).
- [ ] Year-specific reads filter by correct session id / year string.
- [ ] Backend GET accepts a year param; defaults to active year when omitted.
- [ ] Writes stamp the correct year (session id and/or string).
- [ ] PAST years are viewable (history) and not overwritten; closed years read-only.

Per-portal verification (confirm EACH role that can access this module):
- [ ] STUDENT: own data, current year default, can switch to own PAST years.
- [ ] PARENT/GUARDIAN: per-ward data, current default, can switch past years.
- [ ] TEACHER: assigned classes only, current default, can view past where allowed.
- [ ] ACCOUNTANT (if applicable): year-scoped finance, past years selectable.
- [ ] ADMISSIONS_OFFICER (if applicable): correct enrollment/year.
- [ ] PRINCIPAL: full tenant, any year selectable.
- [ ] SUPER_ADMIN (administrator): full tenant, any year selectable.
- [ ] Change "takes effect as applied" in every portal (no re-login needed).

Quality:
- [ ] No dead buttons (UI hides actions a role can't perform; backend 403 stays).
- [ ] Caching: changes show promptly (staleTime/invalidation correct).
- [ ] Empty/loading/error states handled; name the year where relevant.
- [ ] Tenant-scoped + role-guarded on the backend.
- [ ] `vite build` + `tsup` both clean.

## 4. Cross-cutting invariants (never regress)

- One active session per tenant (DB index).
- Year strings canonical `YYYY/YYYY`.
- Enrollments/classes/grades keyed by `academic_session_id`;
  results/publications/fees/exams/promotions keyed by `academic_year` string —
  bridged by `session.name === year string`.
- Promotion + Start-New-Year are non-destructive (history preserved).
- Portals follow the latest ACTIVE enrollment for "current class".

## 5. Rollback / safety

- Every DB migration is additive/guarded (`hasColumn`/`hasTable`), and data
  normalization keeps a copy or is idempotent + reversible where feasible.
- No destructive change ships without the audit trail (e.g. student_promotions).
