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

### 2. Private-repo APK delivery envs  (needed for reliable in-app download)
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

### 4. Optional: tap-to-open a saved export
`saveBlob` currently saves to Documents + toasts (no auto-open) because opening
a `file://` reliably needs a FileProvider/`@capacitor-community/file-opener`
plugin. Add that plugin if we want downloads to open in a viewer automatically.

---

## Useful commands
- Frontend build: `cd frontend && npx vite build`
- Backend build:  `cd backend && npx tsup` (then `rm -rf dist/src`)
- Run migrations: `cd backend && npm run db:migrate`
- Cap sync (after native plugin changes): `cd frontend && npx cap sync android`
- Build APK: GitHub → Actions → "Build Android APK" → Run workflow
