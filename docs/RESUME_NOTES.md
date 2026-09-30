# Resume Notes — Session Handoff

Working branch: `feature/financial-management-monime-payments`

This file tracks what's DONE, what's PENDING, and how to resume. Delete or trim
sections as items are completed.

---

## ✅ Done & pushed (this session)

- **Report card**: watermark on back cover only; uploadable official stamp +
  principal signature (auto background removal, inline storage, resize sliders).
- **Settings**: tab reorder; fixed `CardDescription` crash on Payments tab.
- **Identity templates**: fixed "Set as Default" (backend mapper returns `id`);
  added a role-picker dialog; hardened `defaultForRoles` access.
- **Mobile app (Capacitor)**:
  - Native downloads/exports via a shared helper (`frontend/src/lib/download.ts`):
    `saveBlob` saves directly to the device **Documents** folder (no Share sheet);
    `previewBlob` saves; `openExternal` opens the APK in the system browser.
  - APK build workflow: auto-builds on push (branch added to trigger), artifact
    upload made non-fatal, **auto-incrementing `versionCode`** (from CI run
    number) so updates install as ONE in-place upgrade (no one-by-one).
  - **Release signing set up**: `ANDROID_KEYSTORE_*` secrets added; `build.gradle`
    reads signing from env or `keystore.properties`. Future updates install
    seamlessly over the top (first switch from debug→release needs ONE reinstall).
  - **In-app native-update banner** (`NativeUpdateBanner.tsx`): compares installed
    `versionCode` (via `@capacitor/app`) to latest (`GET /api/v1/app/version`) and
    prompts "Update"; backend `/app/blob-url` webhook now also stores
    `apk_latest_version`.
- **Result-released popup**: now shows **once per release**; localStorage guard
  keyed by student + academic_year + term/year. Re-shows only for a NEW term or
  a new academic year.
- **tsconfig**: resolved `baseUrl` TS 7.0 deprecation (frontend drops baseUrl via
  bundler resolution; backend pins `ignoreDeprecations: "5.0"`).
- **`grades` sync fix** (migration `157_grades_sync_columns.ts`): added missing
  columns (`class_id`, `academic_session_id`, `marks_obtained`, `total_marks`,
  `percentage`, `grade`, `remarks`, `recorded_by`, `recorded_date`, `client_id`)
  so `/api/v1/sync/pull` no longer 500s. Applied to dev DB.
- **Events permissions UI** (`EventsPage.tsx`): edit/publish/duplicate/cancel/
  delete row-actions now shown only to `principal`/`super_admin`/`teacher`;
  parents/students see only "View Details" (backend already returned 403).
- **Academic-session integrity** (migration `158_academic_session_integrity.ts`):
  DB-enforced (1) one active session per tenant (partial unique index) and
  (2) unique `(tenant_id, name)`. Cleans pre-existing dupes non-destructively.
  Applied to dev DB.

### Verified about multi-year data safety (no code change needed)
Changing the academic year in Settings ARCHIVES the old session
(`is_active=false`) and opens a new one — it never deletes/resets history.
All records are year-scoped by `academic_session_id` FK (classes, enrollments,
grades, schedules) or by `academic_year` string (SL results, publications,
fees, exams, promotions). Principals view past years via the **Report Cards**
page year dropdown (Class → Student → Year → view/print/download).

---

## ⏳ PENDING — pick up here when we resume

### ✅ DONE — Current vs previous year clarity on portals
Student & parent dashboards now label the CURRENT academic year on the Results
card ("Current year: 2027/2028") and add a "View previous years" link to
/academic/report-cards (year picker → past report cards). Empty-state text also
names the year ("No results published for 2027/2028 yet"). This makes it obvious
which year's data is shown vs. history.
NOTE (process): promotion alone is NOT a year change — the current/previous
distinction is by academic_year. For a clean boundary, run Settings → Start New
Academic Year (creates the new session + carries classes forward) THEN promote
into the new-session classes. Classes with academic_session_id = null have no
year boundary (see pending item to tie classes to sessions).

### ✅ DONE — Portals auto-update on promotion / role change
- Student & parent dashboards already resolve the "current class" from the
  LATEST ACTIVE enrollment, so a promotion shows the new class automatically on
  next dashboard load (server-computed; verified in studentDashboardService and
  parentDashboardService.childSummary). New year's grades start empty until
  published; prior years stay in the Archive/Report-Cards year picker.
- Teacher role/assignment changes: backend was already live every request
  (attachUserContext re-reads DB role, overrides JWT; /me returns live role).
  Fixed the FRONTEND gap where the cached user only refreshed at app load:
  added authStore.refreshUser() (re-fetches /me; if role changed, clears the
  query cache) and wired App.tsx to refresh on window focus + every 2 min while
  authenticated. So a re-roled/promoted user's sidebar/routes/portal update
  without a manual reload or re-login.

### ✅ DONE — Academic Archive page (unified past-year view)
New admin page at `/reports/academic` ("Academic Archive", principal/super_admin,
now in the sidebar under Reports). Pick any year (from real academic_sessions)
and see one snapshot: headline counts (classes, students enrolled, subjects,
promotions), finance summary (billed/collected/outstanding), the year's classes
with enrolment (+ deep-link to Report Cards for that class/year), result-release
publications, promotion history, and examinations. Backed by
`GET /api/v1/school-config/archive/:academicYear` (academicArchiveService
aggregates finance/publications/promotions/exams read-only). Report Cards page
now honors `?year=&class_id=` deep links from the archive.

### ✅ DONE — Historical (past-year) data access for admins
- New endpoint `GET /api/v1/school-config/academic-sessions` lists the tenant's
  REAL academic years (with is_active) — the authoritative source for year
  pickers (replaces fabricated `new Date()` lists).
- Report Cards page: year dropdown now sourced from real sessions (reaches any
  past year), defaults to the active session, and the class picker is scoped to
  the selected year (`GET /classes?academic_year=YYYY/YYYY`). Switching year
  clears stale class/student picks.
- Classes list API now accepts `academic_year` / `academic_session_id` filters.
- Already year-filterable on the backend (reachable via the same year value):
  results/report-cards, finance ledger (summary/breakdown), examinations,
  promotions history.
- STILL current-only (future enhancement if needed): Students LIST class column
  (active enrollment only — but per-student history is at
  `GET /students/:id/enrollments`), Enrollments list, phase10 dashboards,
  attendance summaries. A shared "Academic Archive" page at the provisioned
  `/reports/academic` route could unify these later.

### ✅ DONE — Guided "Start New Academic Year" workflow
Implemented: backend `academicYearService.startNewAcademicYear` + route
`POST /api/v1/school-config/start-new-year` (archives current session, activates/
creates the new one in a transaction, clones active classes into the new session
with next_class_id remapped, preserves all history). Frontend: "Start New
Academic Year" panel + dialog in Settings → Academic Config (year input + "carry
classes forward" toggle). Student promotion remains the separate reviewed
Promotions flow. Original notes kept below for reference.

### 1. Guided "Start New Academic Year" workflow  (HIGH VALUE)
**Why**: prevents the one real fragility — an admin reusing the SAME class row
across years (which makes report-card year attribution fragile because SL
results key by `class_id` + `academic_year` string). A guided flow makes rolling
over safe and one-click.

**Where**: Settings → Academic Config tab (frontend `SettingsPage.tsx`), backed
by a new endpoint/service action.

**Proposed behaviour**:
- Button "Start New Academic Year" in Settings.
- Step 1: enter/confirm the new year name (e.g. `2027/2028`) + term dates →
  creates a new `academic_sessions` row and makes it active (existing settings
  sync + new unique indexes already enforce single-active + unique name).
- Step 2: offer to **carry classes forward** — create fresh class rows for the
  new session mirroring the previous year's classes (same names/levels, new
  `academic_session_id`), instead of reusing old rows. Reuse `next_class_id`
  mapping where present.
- Step 3: offer to **promote students** into the new session using the existing
  `promotionService.executePromotions` / `autoPromoteClass` (non-destructive:
  closes old enrollments `status='promoted'`, inserts new active ones).
- Make it idempotent + wrapped in a transaction; show a summary
  (classes created, students promoted/repeated/graduated).

**Key files**:
- `backend/src/routes/schoolConfigRoutes.ts` (POST /settings — current year sync)
- `backend/src/services/promotionService.ts` (executePromotions / autoPromoteClass)
- `backend/src/routes/classRoutes.ts` (class create auto-binds to active session)
- `frontend/src/pages/SettingsPage.tsx` (Academic Config tab)

### 2. Private-repo APK delivery envs  — NOT NEEDED IF SHIPPING VIA PLAY STORE
DECISION: The app will be distributed through the Google Play Store. In that
case Google handles delivery + auto-updates, so the sideload APK plumbing is
NOT required:
  - BLOB_READ_WRITE_TOKEN / APK_URL_WEBHOOK_SECRET / GITHUB_RELEASE_TOKEN → not
    needed (no one sideloads the APK).
  - The in-app native-update banner is now SUPPRESSED on Play builds via
    `VITE_DISTRIBUTION=play` (set that env for the Play build). Play auto-updates.
  - Play App Signing manages the signing key; keep the upload key consistent.
  - Content still updates instantly via Vercel (server.url) regardless of Play.
Only revisit the envs below if you ALSO offer a direct-APK download outside Play.

(Original notes retained for the direct-APK path:)
Repo is PRIVATE, so confirm/set these so the "Download App" button + update
banner always serve the newest APK:
- **GitHub secret** `BLOB_READ_WRITE_TOKEN` (Vercel → Storage → Blob token).
  If missing, CI SKIPS the Blob upload + version report → banner never sees new
  versions. Confirm the last APK build's "Publish APK to Vercel Blob" step RAN
  (not skipped).
- **Vercel env** `APK_URL_WEBHOOK_SECRET` — must MATCH the GitHub secret of the
  same name (so CI can post the new APK URL + version to the backend).
- **Vercel env** `GITHUB_RELEASE_TOKEN` — fine-grained token, read-only Contents
  on this repo (private-repo Release fallback 403s without it).

### 3. Existing users → release-signed APK migration  (one-time)
Current installs are debug-signed. First release-signed APK requires a ONE-TIME
uninstall + reinstall (signature change). After that, all updates are seamless.
Consider a temporary banner message explaining the one-time reinstall.

### ✅ 4. DONE — tap-to-open saved exports
Installed `@capacitor-community/file-opener@8` and wired `saveBlob` to open the
saved file in the device's default viewer after writing to Documents (best-
effort; save still succeeds if open fails). cap sync registered the plugin.

### ✅ 5. DONE — Academic Archive deepened
Added an attendance summary (present/late/excused/absent + rate, scoped to the
session's date window) to the year snapshot, and a per-student full-history
drill-down (enrolments by year + results by year) via
`GET /api/v1/school-config/archive/student/:studentId`, surfaced in the archive
page (student lookup by admission number → modal).

---

## Useful commands
- Frontend build: `cd frontend && npx vite build`
- Backend build:  `cd backend && npx tsup` (then `rm -rf dist/src`)
- Run migrations: `cd backend && npm run db:migrate`
- Cap sync (after native plugin changes): `cd frontend && npx cap sync android`
- Build APK: GitHub → Actions → "Build Android APK" → Run workflow


---

## 🏗️ Academic Year Architecture spec (module-by-module, sidebar order)
Spec at `.kiro/specs/academic-year-architecture/` (requirements/design/tasks).
Goal: every sidebar module 100% production-ready across the year lifecycle and
ALL portals, with historical (past-year) access + a universal dynamic year
filter. Work modules in sidebar order; sign off each before the next.

### ✅ Module 0 — Foundation (DONE)
- `backend/src/utils/academicYear.ts`: `normalizeAcademicYear` (→ "YYYY/YYYY"),
  `sameAcademicYear` (hyphen/slash tolerant), `resolveActiveYear(tenantId)`.
- Migration `159_normalize_academic_years`: normalized `academic_sessions.name`
  to slash, merged duplicate (tenant,name) sessions, enforced single active per
  tenant, normalized year strings across sl_*/fees/fee_structures/examinations/
  student_promotions, backfilled null-session active classes, recreated the
  invariant indexes. Applied to dev DB; verified clean (1 active/tenant, no dups).
- `frontend/src/hooks/useAcademicYears.ts`: real sessions → years[] + activeYear.
- `frontend/src/components/common/YearFilter.tsx`: the ONE dynamic year dropdown
  every page will use (replaces new Date() pickers as each module is worked).
- Builds: vite + tsup clean.

### Next: Module 1 — Classes & Streams (/academic/classes)
Then 2 Subjects, 3 Timetables, 4 Assignments, 5 Exam Timetable, 6 Results,
7 Report Cards, 8 Promotions, 9 Student Directory, 10 Admissions, 11 Student
Profiles, 12 Attendance, 13 Discipline, 14 Teachers, 15 Teacher Attendance,
16 Fee Structures, 17 Payments, 18 My Fees, 19 Announcements, 20 Support,
21 ID Cards, 22 Card Templates, 23–26 Events, 27 Academic Archive.
