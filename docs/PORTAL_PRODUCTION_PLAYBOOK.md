# Portal Production Playbook

The process and checklist for making every portal page **production-ready**.
It covers security, data correctness, the academic-year transition, error
handling, UX states, offline/mobile, accessibility and verification on real
data. It is not only about the academic year. Each portal is done the same
way. The principal and teacher passes are complete; their findings below are
the reference for the remaining portals.

> **Definition of done for a page:** every box in §2 is ticked, the fixes are
> verified against real data (allow AND deny paths), the page's row in §8 is
> filled in, and the type-check, builds and Android sync pass.

---

## 1. How to run a portal pass

1. **Work in sidebar order, top to bottom**, starting at the portal's Overview /
   Dashboard. Finish a page completely before moving to the next. Pages behind
   the v2 flag (`version: 'v2'` in `Sidebar.tsx`, `V2Route` in `routes.tsx`) are
   hidden in v1. Skip them, and leave them out of guides.
2. **Audit each page in three layers:**
   - the page component and its modals;
   - the frontend service (params, offline fallbacks, `apiClient` shape);
   - every backend endpoint it calls (role checks, scoping, year handling,
     writes, the response shape).
   Shared pages were done in earlier passes, so for those the job is to confirm
   the new role sees the right data and actions, and nothing more.
3. **Fix**, then **verify on real data** with a scratch HTTP script (§7) as the
   portal's role AND a principal. Include the deny paths, and check row counts
   before and after.
4. **Record** the page in §8: what was wrong, what changed, and what was
   verified, with numbers.
5. **Finish the portal** with its Settings tabs, its Guide content and the
   Replay walkthrough (§2.11). Then run the type-check, both builds and
   `npm run android:sync`. Commit or push only when asked.

---

## 2. THE PRODUCTION CHECKLIST (tick every box, per page)

### 2.1 Access & security (server-side, never just hidden buttons)
- [ ] Every endpoint is **tenant-scoped** (`tenant_id` from `req.user`, never from the body/query for non-super-admins).
- [ ] **Role checks on the server** (`authorize(...)` or a router-level guard). A whole module that is staff-only gets a router guard (e.g. `staffOnly` in `disciplineRoutes`), so no GET is left open to students or parents.
- [ ] **Own-data scope** for non-admin roles:
  - Teacher: their classes (teach or lead) and the students in them (`utils/teacherScope.ts`).
  - Student: themselves.
  - Parent: their linked children (`guardians.user_id`).
  - Writes need a *current* relationship (e.g. a student currently in the teacher's class). Reads may include past ones.
- [ ] **IDOR by id:** opening or editing a record by a guessed id is checked for ownership or scope (an infraction must belong to the `:studentId`; a note can only be edited by its author; a draft event only opens for its organiser).
- [ ] **Passthrough bodies are whitelisted.** Zod `.passthrough()` and `{...req.body}` must never let a user change `recorded_by`, `student_id`, `tenant_id`, `role`, `status` or similar.
- [ ] **Confidential / draft / unpublished** data is hidden from roles that shouldn't see it (colleagues' confidential records, other people's drafts, unpublished results).
- [ ] **Credentials & PII:** temporary passwords only for roles that hand them out. Viewing a page never has side effects (e.g. provisioning accounts).
- [ ] Probe it: another class or record → 403/404; another role → 403; a student or parent token on staff modules → 403.

### 2.2 Data correctness
- [ ] **KPIs and stat cards come from the server** over the WHOLE filtered set (`stats` / `summary` in the response), never counted from the visible page.
- [ ] Counts are real joins (e.g. submissions from `assignment_submissions`), not columns that are never filled.
- [ ] **Right id for the table:** some tables key students by `students.id`, discipline tables by `users.id`. Resolve incoming ids (students.id / users.id / admission no.) before writing.
- [ ] Inserts use `.returning(...)`. Never insert a placeholder primary key.
- [ ] Required lookup data exists, or is provisioned on first use (e.g. the default infraction catalogue), so a fresh school never hits "X not found".
- [ ] Rosters use the right enrolment statuses: `enrolled, active` for the current year; historic statuses (`completed, promoted, repeated, graduated`) for a past year.

### 2.3 Academic year & transition (details and code in §4–§5)
- [ ] `<YearFilter>` in the header (if the data is yearly). Current year by default, and it **follows a rollover** (`noAutoSelect`, current year stored as `''`/`null`).
- [ ] **Everything** on the page resets to the selected year: KPIs, charts, tables, dropdown options, secondary widgets, empty states. A year switch also resets page, selection and sub-filters.
- [ ] Every year-scoped query has `year` in its key and an `enabled` guard.
- [ ] Past year = read-only: a history banner with "Back to {activeYear}"; create/edit/delete hidden (including row menus and modals); the **server returns 409 `PAST_YEAR_READ_ONLY`**. Exception: Results (editable, with an amber warning).
- [ ] Transition-aware: while students still sit in last year's classes (`pending_transition`), show the amber "{year} is being set up" notice. Pickers never offer last year's copy of a class for new work.
- [ ] Tenant-global data (Subjects, Card Templates) and personal/all-time data (My Events, tickets) have NO year filter.

### 2.3a Promotions & reassignments follow automatically
When the school promotes, repeats or graduates a student, or moves a teacher to
other classes, every affected portal updates by itself. No re-login, no manual fix.
- [ ] The page reads class membership **live** from `enrollments` (students, parents) and `teacher_assignments` / `classes.class_teacher_id` (teachers) on every request. Never use a class id cached in the auth store, the JWT, a profile snapshot or localStorage.
- [ ] Student/parent pages use `studentYearScope` / `viewerYearClasses` (`utils/studentScope.ts`): the current year is the new class, and last year (or the earlier class in a mid-year promotion) moves to history automatically.
- [ ] Mid-year promotion (two classes in one year): that year shows both classes, and records stay on the class they were made in.
- [ ] **Repeated** student: shows the same class level in the new year; last year stays as history.
- [x] **Graduation has two kinds** (`promotionService.graduationKind`, mirrored in `PromotionsPage`):
  - *Stage graduation* (Nursery 3 → Class 1, Class 6 → JSS 1, JSS 3 → SSS 1): the child stays in the school. It's a promotion into the next stage's class: `next_class_id`, else the single active-year class at that level, else the principal must pick one (several SSS 1 streams). Even if the class is flagged `is_final_year`, the child is never marked graduated.
  - *Leaving the school* (SSS 3, or a custom final class with no recognised level): the enrolment closes and `students.status = 'graduated'`. Only these classes offer "🎓 Graduate (leaves the school)" on Promotions.
- [x] **Graduated (left)** student: Overview, Results, Timetable, Assignments and Exam Timetable say "🎓 You graduated from SSS 3 in {year}", not "You weren't in a class" (`studentYearScope().graduated` → `meta.graduated` / dashboard `graduated`). History stays readable by picking a past year. Parents see the same with the child's name. The login stays active (read-only history) until the school decides otherwise.
- [x] **Parents with several children:** every parent page resolves **each child on its own** for the selected year (never "the family's class"). Siblings can be in different classes, one promoted mid-year, one graduated, one not yet moved into the new year. The child switcher shows each child's status that year. Data endpoints take a verified `child_id`; with none, the parent's first child is used, never a merge that mixes children. Promotions show for each child on the next load.
- [ ] Teacher moved off a class: it leaves their current-year pickers and lists right away. The years they taught it stay readable as history.
- [ ] Teacher given a new class: it shows up on the next load, with no re-login needed.
- [ ] Offline teacher app: after a sync, reassigned classes are added or removed from the local cache, and queued writes for a class they no longer teach are rejected with a clear message.
- [ ] **Staff role changes** (teacher → principal/accountant/admissions, designation such as HOD or Form Master, demotion): the portal switches within one live-sync tick (`useLiveSync` → `refreshUser` → cache cleared → `ProtectedRoute` sends them to their new dashboard). The **server** authorises on the live DB role, never the token's: a demoted user loses access on their next request, not when the 30-minute token expires.
- [x] **Teacher + duty** (a form or subject teacher who is also the Bursar or Admissions Officer): `users.staff_duties` (`['accountant']`, `['admissions_officer']` or both). The main role stays `teacher`, so their classes, registers and teacher scoping never change. On the duty's own API modules (`dutyForPath` in `utils/staffDuties.ts`: finance prefixes, `/students/:id/fees…`, admissions, enrollments, their dashboards) the request **acts as that role**, and `authorize()` also lets a duty through when the main role isn't allowed. Anywhere else the main role applies. `/auth/me` returns `staffDuties`, `canAccess` honours them, and the sidebar adds "Finance Overview" / "Admissions Overview". Adding or removing a duty is live on the next request (it's read from the DB, like the role). A new finance or admissions API module must be added to `dutyForPath`'s prefixes, or duty holders get 403 there.
- [ ] Every write that changes membership or roles is under a `STRUCTURAL_PREFIXES` route (`utils/liveSync.ts`), so open apps refetch. A new route that moves people must be added there.
- [ ] Verify once per portal with a real promotion: promote a test student on Promotions, then reload each student, parent and teacher page without logging out.

**Done (cross-portal):**
- `authenticate` no longer overwrites the live role with the token's on the per-route repeat call, and `authorize` loads the live role and status itself when a router has no `attachUserContext`. Before, `authorize` checked the JWT role, so a demoted principal kept principal rights for up to 30 minutes. Verified: a principal with a stale "teacher" token is allowed, and a teacher with a stale "principal" token gets 403.
- Offline sync scope is **current classes only**: ended assignments and past-session classes are excluded. Before, Ibrahim's device also held his 2026/27 classes. `/sync/pull` returns the full `scope`. The device drops classes, timetable slots and students outside it, replaces enrolments (so a promoted student leaves the old register), and re-pulls in full when a new class appears. `syncClient.pull` was typed one level too deep, so frontend errors went 234 → 220.

### 2.4 Dates & time
- [ ] "Today" is the **school's day**: `tenantToday()` (`utils/schoolDate.ts`, using `tenants.timezone`) on the server, and the device's local date (not `toISOString()`) in the browser.
- [ ] No future dates where they make no sense (attendance, incidents, notes): `max` on the input plus a server check.
- [ ] A record's date can't move it into another academic year after creation (lock the date, or re-check).

### 2.5 Workflows & real-world edge cases
- [ ] No dead ends: if a principal acted first (marked a teacher absent, closed something), the other user still has a way forward.
- [ ] Conflicts (double submit, "already done") return a clear 409 message the UI shows.
- [ ] People who left or were deactivated still appear in their history (rosters, registers, reports).
- [ ] Draft → publish flows: a draft is visible to its author and to admins only; the UI wording says who publishes.
- [ ] Side effects (emails, parent notifications) are best-effort, never fail the main write, respect `is_confidential`, and go to real recipients (`guardians.user_id`).

### 2.6 Error handling (no silent failures, no hangs)
- [ ] **`apiClient` never throws**: it returns `{ success:false, error }`. So:
  - queries: treat `success === false` as an error (throw in `queryFn`, or show a `loadError`), never as "no records";
  - mutations: `assertOk` / `if (res.success === false) throw`. Toast the **server's message**. Roll back optimistic UI (e.g. `setLoadedKey('')`).
- [ ] Express 4 doesn't catch async errors. Handlers call `next(err)`; legacy modules that rethrow are registered via `asyncSafeApp(app)` (`utils/asyncRoutes.ts`). A bad request must get 400/404, not hang.
- [ ] Never `await` a function that returns a knex builder (it executes the query). Resolve the inputs first, then apply them synchronously.
- [ ] Counting over a query that has `ORDER BY` or a `select *` → `clone().clearSelect().clearOrder().count()` (Postgres 42803).

### 2.7 UX states & role-aware wording
- [ ] Loading, empty and error states for every query. An error has a Retry.
- [ ] Empty states name the year and role ("No attendance in 2026/2027", "You aren't assigned to any class in {year} yet"). A teacher is never told to use a principal-only feature.
- [ ] Don't offer actions the server will reject for this role (Edit/Publish/Delete buttons that would 403).
- [ ] Forms validate what the server validates (e.g. the password rules checklist), so errors aren't only discovered on save.

### 2.8 Offline & mobile (Capacitor app)
- [ ] Offline fallbacks never leak other years or classes. They trust a successful-but-empty online answer, and filter cached data by year.
- [ ] Offline writes (registers, assignments) say "saved offline, will sync". Nothing claims "saved" unless the server or the offline queue has it.
- [ ] Destructive device actions (clear cache) use `ConfirmationDialog` and keep un-synced work.
- [ ] Touch targets are visible on mobile (no hover-only controls). Native `<select>` options are readable.

### 2.9 Accessibility & conventions
- [ ] Icon-only buttons have `aria-label`. Toggles use `aria-pressed`/`aria-expanded`. Modals use `role="dialog"` + `aria-modal`, and Esc closes them.
- [ ] Shared components only: `SearchBar`, `YearFilter`, `ConfirmationDialog` (never `window.confirm/alert/prompt`), `KPICard`, `EmptyState`.

### 2.10 Verification & release
- [ ] Verified on real data with a scratch HTTP script (§7) as the role AND a principal, including the deny paths. Row counts are checked before and after, and any test rows are deleted.
- [ ] Writes that would message real people (parent notifications, emails) are not triggered in tests. Pick non-notifying paths.
- [ ] Type-check: no new errors on changed lines; totals at or below the baseline (§7).
- [ ] Backend `npx tsup` builds, the frontend builds, and `npm run android:sync` is done.

### 2.11 Per portal (once, at the end of the pass)
- [ ] **Settings:** only the tabs the role should see; no admin cards showing placeholder data; profile/password validation matches the server.
- [ ] **Guide** (`lib/onboarding.ts` → `GuidePage.tsx`): covers every v1 page in the role's sidebar, includes "Good to know" rules and FAQs, and every claim is checked against the code.
- [ ] **Replay walkthrough:** the steps match the current pages and routes; replay opens reliably from the Guide.

---

## 3. Known pitfalls (found in earlier passes — check for these first)

| Pitfall | Where it bit us | Fix pattern |
|---|---|---|
| A GET route with no role check exposed a whole module | Discipline: students and parents could list every infraction | Router-level guard (`staffOnly`) |
| Teacher scope used every year's classes | Directory, announcements (posting to last year's class) | Year-aware scope; *current* classes for writes |
| `students.id` sent where the FK is `users.id` | Discipline recording never worked | `resolveDisciplineStudent` |
| Hard-coded codes with no lookup rows | Infraction types "not found" in every school | Provision defaults on first use |
| Passthrough body allowed tampering | Note edit could change `recorded_by` / `student_id` | Field whitelist |
| `{success:false}` treated as success | Attendance marks, discipline modals, lists showing "empty" | `assertOk`, `loadError` |
| Async errors hang in Express 4 | Support tickets (no response, ever) | `asyncSafeApp` / `next(err)` |
| `await` on a knex builder | Attendance list 500 `query.clone is not a function` | Resolve first, apply sync |
| Count with ORDER BY | Infraction/action/note lists 500 (42803) | `clearSelect().clearOrder()` |
| Server UTC "today" | Teacher sign-in on the wrong day near midnight | `tenantToday()` |
| Picking the current year pinned it | Most pages after a rollover | `''`/`null` = current + `noAutoSelect` |
| KPIs counted from one page | Attendance, subjects, assignments | Server `stats` |
| Actions the server rejects | Teachers offered Edit/Publish on events, Edit on timetables | Gate by the role the server allows |
| Drafts visible to everyone | School events | `drafts_only_by` + 404 on detail |
| Case-sensitive email uniqueness | Profile update | Lower-case + `LOWER(email)` check |
| Settings card showing defaults to non-admins | Display Settings | Render admin-only |
| "Trailing digits" read the year as part of the number | `generateNextId` with no separator: TCH260005 → TCH26260006 → TCH2626260007 (students/admissions too) | Parse only after `prefix + year + separator`; strip repeated years from already-bad IDs |

---

## 4. Shared building blocks (never re-implement these)

| Need | Use | File |
|---|---|---|
| Year options / active year | `useAcademicYears()` | `frontend/src/hooks/useAcademicYears.ts` |
| Year picker | `<YearFilter>` | `frontend/src/components/common/YearFilter.tsx` |
| Server: default year | `resolveActiveYear(tenantId)` | `backend/src/utils/academicYear.ts` |
| Server: year scope | `resolveYearScope` + `applyYearScope` | `backend/src/utils/academicYear.ts` |
| Teacher scope | `teacherIdFor`, `teacherClassIdsFor`, `teacherCanAccessStudent` | `backend/src/utils/teacherScope.ts` |
| Discipline subject + rules | `resolveDisciplineStudent`, `resolveForWrite`, `assertWritableDate`, `assertRecordWritable`, `resolveInfractionType` | `backend/src/utils/disciplineScope.ts` |
| School "today" / past-year date | `tenantToday`, `tenantTimezone`, `isPastYearDate` | `backend/src/utils/schoolDate.ts` |
| Async-safe legacy routes | `asyncSafeApp(app)` | `backend/src/utils/asyncRoutes.ts` |
| Confirm destructive actions | `ConfirmationDialog` | `frontend/src/components/admin/feedback/ConfirmationDialog.tsx` |
| Search inputs | `SearchBar` | `frontend/src/components/admin/table/SearchBar.tsx` |
| Role guide + walkthrough | `getRoleGuide()` content | `frontend/src/lib/onboarding.ts` |

### `useAcademicYears()`
```ts
const { years, activeYear, isLoading } = useAcademicYears();
```
- `years: string[]`: real `"YYYY/YYYY"` sessions, newest first. Never a guess.
- `activeYear`: the tenant's active session. It is **`''` while loading**.
- After a rollover `activeYear` becomes the new year automatically.

### `<YearFilter>`
```tsx
<YearFilter value={year} onChange={changeYear} noAutoSelect />                  // single-year page
<YearFilter value={year} onChange={changeYear} includeAllOption />              // list/history page
```
"All years" is `''`. The active year is labelled ` (current)`.

---

## 5. Academic-year conventions (code)

### Idiom A — single-year page
```tsx
const [pickedYear, setPickedYear] = useState('');            // '' = CURRENT year
const { activeYear } = useAcademicYears();
const year = pickedYear || activeYear;
const viewingPast = !!year && !!activeYear && year !== activeYear;
const changeYear = (y: string) => {
  setPickedYear(!y || y === activeYear ? '' : y);           // follow a rollover
  setPage(1); setSelection([]); /* …reset dependent state */
};
const canManageHere = canManage && !viewingPast;
// <YearFilter value={year} onChange={changeYear} noAutoSelect />
```

### Idiom B — list/history page with "All years"
```tsx
const [pickedYear, setPickedYear] = useState<string | null>(null); // null = current, '' = all
const year = pickedYear ?? activeYear;
const yearReady = pickedYear !== null || !!activeYear;
const viewingPast = !!year && !!activeYear && year < activeYear;
const viewingAll = pickedYear === '' && !!activeYear;
const changeYear = (y: string) => setPickedYear(y === activeYear ? null : y);
```

### Query keys + `enabled`
```tsx
useQuery({ queryKey: ['x', { ...filters, year }], enabled: !!year /* or yearReady */,
  queryFn: () => svc.list({ academic_year: year || undefined }) });
```

### History banner
```tsx
{viewingPast && (
  <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
    <span>Showing <strong>{year}</strong> … as history.</span>
    <button type="button" onClick={() => changeYear(activeYear)} className="text-xs font-bold text-blue-700 hover:underline dark:text-blue-300">Back to {activeYear}</button>
  </div>
)}
```

### Backend reads
```ts
const scope = await resolveYearScope(tenantId, req.query.academic_year); // null = no year
query = applyYearScope(query, scope, 'x.class_id', 'x.some_date');        // classCol null = date window only
```
- Legacy classes with no session belong to the **active year only**. An unknown year returns nothing. A school with no sessions at all stays unfiltered.

### Backend writes
```ts
throw new AppError('This belongs to a past academic year and is read-only.', 409, 'PAST_YEAR_READ_ONLY');
```
Applied in: classes, assignments, timetables, exam timetable, fee structures, students (class move), attendance, teacher attendance, discipline, announcements. **Exception:** Results.

### #0 Overview template (dashboards)
- Classes come from the selected year's session only (no fallback to every class).
- Current-year counts use live statuses; past years use historic statuses.
- `pending_transition` (students still in last year's copies via `carried_from_id`) shows the amber notice.
- Past year: live widgets (quick actions, today's schedule, announcements) are hidden; activity is relabelled "Activity in {year}".

---

## 6. Hard rules (do not break)

1. Current year opens by default; past years are read-only history (except Results).
2. Only real years in pickers.
3. Shared components only (§4). Never `window.confirm/alert/prompt`.
4. Role checks live on the server. The UI only mirrors them.
5. Don't break working pages: type-check and build before committing.
6. `npm run android:sync` before any push. Commit or push only when asked.
7. Never commit `.kiro/specs/academic-year-architecture/tasks.md` or secret files.
8. Tenant-global data (Subjects, Card Templates) has no year dimension.
9. Guides only describe what the code actually does, and skip v2-gated pages.

---

## 7. Verification recipe

**Scratch HTTP test** (in `backend/scratch/`, deleted afterwards):
```ts
import 'dotenv/config';
import express from 'express';
import { db } from '../src/utils/database.js';
import { JWTService } from '../src/services/jwtService.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import someRoutes from '../src/routes/someRoutes.js';

const app = express(); app.use(express.json());
app.use('/api/v1/some', someRoutes); app.use(errorHandler);
const server = app.listen(0);
const u = await db('users').where({ email: 'ibrahim@gmail.com' }).first();
const t = JWTService.generateAccessToken({ userId: u.id, email: u.email, role: u.role } as any);
// fetch(`http://127.0.0.1:${port}/api/v1/some/...`, { headers: { Authorization: `Bearer ${t}`, 'X-Tenant-ID': u.tenant_id } })
// … log status + key numbers; count rows before/after; delete anything created; server.close(); db.destroy();
```
Run it with `cd backend && npx --yes tsx@4.19.2 --tsconfig tsconfig.json scratch/x.ts < /dev/null`.
Legacy `registerPhaseXXRoutes(app, db)` modules need `asyncSafeApp(app)`.

**Test accounts (dev tenant):**
- Teacher `ibrahim@gmail.com` (Class 6 + JSS 3, both years).
- Principal `a20mihd006@gmail.com`.
- Sessions 2026/2027 (past) and 2027/2028 (active).
- Students: James (Class 6) and Alpha (JSS 3 in 2026/27, promoted).

**Type-check:** `node ../node_modules/typescript/bin/tsc --noEmit -p .` (from `frontend/` or `backend/`; `npx tsc` fails). Baselines after the teacher pass are frontend **234** and backend **500**. Totals must not rise, and changed lines must be clean.

**Build:** backend `npx tsup && rm -rf dist/src`; frontend + Android `npm run android:sync`.

---

## 8. Portal status

### Principal — ✅ done
Classes, Subjects, Timetables, Exam Timetable, Assignments, Results, Report Cards,
Promotions, Student Directory, Student Profiles, Attendance, Discipline, Fees,
Invoices, Payments, ID Cards, Events, Event Analytics, Announcements, Academic
Archive, Admin dashboard, Settings, Help Center.

### Teacher — ✅ done (commits `a1d1dba`, `058be09`)
Sidebar order; each row is the audit record for that page.

| # | Sidebar item (teacher order) | Route | File | Status |
|---|---|---|---|---|
| 0 | Overview / Dashboard | `/teacher/dashboard` | `frontend/src/pages/Phase13TeacherDashboard.tsx` | ✅ **Done & verified on real data** — see notes below. |
| 1 | Classes & Streams | `/academic/classes` | `academic/ClassesPage.tsx` | ✅ **Done & verified on real data** — see notes below. |
| 2 | Subjects | `/academic/subjects` | `academic/SubjectsPage.tsx` | ✅ **Done & verified** — tenant-global (the `subjects` table has no year column), so no year filter. Teacher read-only (all writes 403). KPIs now come from server `stats` over the whole list; before, core/elective/active counted only the visible page. |
| 3 | Timetables | `/academic/timetables` | `academic/TimetablesPage.tsx` | ✅ **Done & verified** — fixed a role leak where clicking a filled slot opened the edit modal for teachers (now `canEdit = canManage && !viewingPast`, and teachers get no pointer/hover). A selection not in the year's class list is dropped. Follows a rollover (`noAutoSelect`, `''` = current). Teacher-aware empty states ("no classes assigned for {year}") and aria-labels on the mobile icon buttons. Real data: teacher sees both years' grids for their classes (6 and 4 slots, copied forward) and gets 403 on another class and on PUT. |
| 4 | Assignments | `/academic/assignments` | `academic/AssignmentsPage.tsx` | ✅ **Done & verified** — fixed a role leak where students/parents saw **Edit** in the detail modal (now `canEditHere = canManage && !viewingPast`). Fixed the legacy-class leak (no-session assignments showed in past years) using the same session resolution as Classes; an unknown year returns nothing. Submission counts now come from `assignment_submissions`; before, the "N / M graded" column and the Submissions KPI were always 0. Server `stats` cover the whole set. Year-follow (`noAutoSelect`), year-aware empty state, no "Create" prompt in a past year. Delete says "closed" when the API closes rather than deletes. Real data: teacher's essay shows in 2026/2027 only; 2027/2028 and 1999/2000 are empty. Students/parents send no year on purpose: they're scoped to their current enrolment. |
| 5 | Exam Timetable | `/academic/exam-timetable` | `academic/ExamTimetablePage.tsx` | ✅ **Done & verified** — same role leak as Timetables: clicking an exam opened the edit modal for teachers (now `canEdit`). **Backend had no past-year write guard**: added `assertExamCurrentYear` (409 `PAST_YEAR_READ_ONLY`) on POST/PUT/DELETE, covering both a past-session class and a non-current `academic_year`. A stale class selection is dropped. Manual empty date rows reset per class and term. Year-follow and teacher/year-aware empty states. Real data: teacher sees 1 exam in 2026/2027 and 0 in 2027/2028; teacher POST is 403; principal POST into a past year is 409 with no row inserted. |
| 6 | Results & Grades | `/academic/results` | `academic/ResultsPage.tsx` | ✅ **Done & verified** — **Past-year results were invisible.** The score grid, class ranking, class size ("No. in Form") and average age only counted `active` enrolments, so after a rollover (students `promoted`/`completed`) a past year showed an empty class. Late corrections, the reason Results stays editable, were impossible. New `rosterStatuses(classId)` in `slReportCardService` uses historic statuses for a past-session class. **Scope gaps closed:** `/grid` now checks the subject too (a teacher could read unpublished scores of subjects they don't teach), and `/ranking` now enforces teacher class scope (any class id worked). Both now return 403. Year-follow (`noAutoSelect`, `''` = current); score entry explains "no classes / no subjects this year". Real data: past JSS 3 now shows the promoted student's 90/80; other subject and other class both 403. Writes to past years stay allowed, with the amber warning (by design). |
| 7 | Report Cards | `/academic/report-cards` | `academic/ReportCardsPage.tsx` | ✅ **Done & verified** — gains from #6: a past-year card's "No. in Form" and class average age use the historic roster (they read 0 after a rollover before). **Denied cards are no longer blank.** The API returns `{success:false}` for "not your class", "teachers not permitted" or "not published", and the page rendered nothing. It now shows the reason. Teacher-worded draft banner ("until the principal publishes"), not the principal's Settings instruction. Year-follow (`''` = current), and empty states for "no classes this year". Real data: teacher opens 2026/2027 Class 6 (completed student, 3 subjects, 80/90) and JSS 3 (promoted, 10 subjects); another class is 403 "only your assigned classes". |
| 8 | Student Directory | `/students/directory` | `students/StudentDirectoryPage.tsx` | ✅ **Done & verified** — **Teacher scope wasn't year-aware.** It used the teacher's classes across ALL years and active enrolments only. In a past year, students since promoted vanished, and a student could appear under another teacher's class. A chosen year now means the teacher's classes of that year plus everyone who was in them (historic statuses), each shown in the teacher's own class. No year still means current students. Year names are matched normalised. Frontend was already correct (teacher read-only, `canManageHere`). Real data: teacher 2026/2027 shows Alpha@JSS 3 (promoted, previously missing) and James@Class 6; 2027/2028 and no year show James only. Principal view unchanged. |
| 9 | Student Profiles | `/students/profiles` | `students/StudentProfilesPage.tsx` | ✅ **Done & verified** — **The page had no year filter.** It now has one page-level `YearFilter` (current year by default and follows a rollover, plus "All years") in the header. It drives the list, class options, and every tab: Results (`/report-cards/student/:id/summary?academic_year`), Attendance (the tab's own picker was removed), and Conduct (discipline stats, infractions and actions take `academic_year` → `resolveYearScope`). A past or all-years view shows a history banner. Changing the year resets the class filter and page. Account actions (reset password, parent account) stay visible because they are account-level, not yearly. **Teacher scope:** `utils/teacherScope.ts`. GET `/students/:id` is 403 for a student the teacher never taught. Login provisioning only runs for roles that can see credentials (it used to run on every view). The SL summary and attendance are teacher-scoped too. **Conduct tab used the wrong id.** Discipline `student_id` is an FK to `users.id`, so the tab now queries by `student.user_id`. **Pre-existing 500s fixed:** infraction and action lists counted over a query with ORDER BY and `si.*` (Postgres 42803), so they now use `clearSelect().clearOrder()`. **Attendance:** a year with no records is no longer `at_risk`. Real data (teacher): 2026/2027 shows Alpha@JSS 3 and James@Class 6. Alpha has 19 results and 18 attendance days; James has 3 results and 11 days. 2027/2028 shows James only, with 0 results and 0 days (not at risk). All discipline endpoints return 200 in both years. Principal: 5 students in each year (all have enrolments in both). (The `students.id` vs `users.id` question for recording infractions was confirmed and fixed in #12.) |
| 10 | Attendance | `/students/attendance` | `students/AttendancePage.tsx` | ✅ **Done & verified** — **Year wiring:** picking the current year pinned it, so the page didn't follow a rollover. It now uses `''` = current, `noAutoSelect`, and a `changeYear` that also clears the class filter, register class, all-students mode, page and the open edit modal. **KPIs** used to count only the 20 rows on screen. GET `/attendance` now returns `stats` over the whole filtered set. **Backend year scope:** the year name was matched exactly (`2026-2027` matched nothing), and class-less (all-students) rows dropped out. It now uses `resolveYearScope` + `applyYearScope` on the list, analytics and export. Don't `await` a function that returns a knex builder: it runs the query (this caused a 500, `query.clone is not a function`). **Past years read-only:** the Edit column is hidden. PUT `/:id`, POST `/` and POST `/bulk` return 409 `PAST_YEAR_READ_ONLY` for a past-session class. **Silent failures:** mark, mark-all and edit used to treat `{success:false}` as saved. They now throw (`assertOk`), show the server message, and reload the sheet to undo the optimistic mark. **Transition:** amber banner from the classes `pending_transition`. **Empty states:** past-year ("No attendance in {year}"), teacher with no classes, teacher wording (no "All Enrolled Students" hint), plus a logs error state with retry. Register date can't be in the future. aria-labels on status, note and edit buttons. Real data: teacher 2026/2027 has 29 records (rate 66%, Class 6 + JSS 3); 2027/2028 has 0; `2026-2027` gives 29 (was 0); 1999/2000 has 0. Principal 2026/2027 has 49. A past record PUT and a past-class bulk mark (principal and teacher) return 409. A teacher marking Nursery 2 gets 403. Row count unchanged (51 → 51). |
| 11 | Teacher Attendance | `/staff/attendance` | `components/attendance/TeacherAttendancePanel.tsx` + `routes/teacherAttendanceRoutes.ts` | ✅ **Done & verified** — **Year (teacher "My attendance"):** the tab had no year filter and showed a fixed last-90-rows list. It now has a `YearFilter` (`''` = current, `noAutoSelect`), and GET `/teachers/my?academic_year` uses the year's date window (no class column) plus a server `stats` summary (rate, present, late, absent/excused). Past year: history banner, sign-in card hidden. **Principal register:** the roster returns `read_only` for a past-year date (banner, inputs disabled). PUT returns 409 `PAST_YEAR_READ_ONLY`. **Production fixes (beyond the year):** (1) **Timezone.** "Today" was the server's UTC date, so a sign-in near midnight landed on the wrong day for non-UTC schools. It now uses `tenants.timezone` (cached 5 min). The frontend uses the device's local date, not `toISOString()`. (2) **Dead end.** If the principal marked a teacher before they arrived, the teacher could neither sign in (409) nor sign out. Check-in now records the arrival on that record, keeping the principal's remarks, and the panel offers "Arrived? Sign in". (3) **History.** A teacher who has since left vanished from past dates' registers. The roster now includes anyone with a record that day, labelled "no longer active". (4) The "Today" badge was always green, even for absent; it now uses status colours. Real data: `/my` 200 for each year with stats; roster 2026-09-22 read_only=true (5 teachers, 1 marked); 2026-10-02 read_only=false. PUT past date 409, future date 400. Teacher → roster 403; principal → `/my` 403. Rows 2 → 2. The arrival-on-a-principal-mark path was type-checked but not exercised (it writes data). |
| 12 | Discipline & Conduct | `/discipline` | `discipline/DisciplinePage.tsx` + `routes/disciplineRoutes.ts` + new `utils/disciplineScope.ts`, `utils/schoolDate.ts` | ✅ **Done & verified** — **Recording never worked.** Both tables were empty in every tenant. There were four stacked bugs. (1) The form sends `students.id`, but the service looked it up in `users` (with a non-existent `users.student_id` column), and the FK needs `users.id`. (2) The form sends codes like `tardiness`, but no tenant had any `infraction_types` or `conduct_rules`, so it was always "type not found". (3) Insert with `infraction_id: ''` and no `returning` (uuid error). (4) Notes had the same id and insert bugs. Now `resolveDisciplineStudent` maps students.id, users.id or an admission number to users.id. `resolveInfractionType` provisions the default catalogue (11 types, points → severity) per school on first use, transaction-safe. Inserts use `returning('*')`. Parent notifications are best-effort, skip confidential records, and go to `guardians.user_id` (the old `student_guardians` table doesn't exist). **Security:** (a) Every logged-in account (students, parents, accountants) could list the whole school's infractions and notes, because the GET routes had no role check. `staffOnly` now gates the router (admissions officers get GET only, for the profile tab). (b) A teacher could record or read conduct for ANY student. Writes now require the student to be in one of the teacher's current classes (filed under that class). Reads require the student to be or have been in one of their classes. All 8 `/:studentId` routes use `studentParam`. (c) A teacher could edit any colleague's note, and the passthrough body allowed changing `recorded_by`, `student_id` or `tenant_id`. Edits are now own-notes only, with a field whitelist; infraction PUT is whitelisted too. (d) Teachers no longer see colleagues' confidential records; a confidential note can't be shared with the student. **Year:** `''` = current with `noAutoSelect`. Tabs are keyed by year + filters, so the page resets. New records with a past-year or future date return 409/400 (school timezone). Edit, acknowledge, resolve, delete and share on a past-year record return 409. Note dates are locked once recorded. **Other:** `/notes/summary/:id` was unreachable (shadowed by `/notes/:id`); `getStudentNotes`/`getTeacherNotes` counts were 42803 (ORDER BY). Modals treated `{success:false}` as saved; they now show the server message. Lists show load errors instead of "no records". Role- and year-aware empty states. Default dates are local, not UTC. Real data: student and parent → 403. Teacher → another class's student read and record 403; future date 400; past-year date 409; unknown type 400. Recording for James (by students.id) → 201, stored as users.id, class set; it shows in teacher and principal 2027/2028 lists and the profile tab, and 2026/2027 has 0. The note is created; the teacher's edit with tamper fields keeps `recorded_by`/`student_id`; another teacher's edit → 403. Test rows and the provisioned type were deleted afterwards (counts back to 0/0/0/0; notifications 14 → 14). |
| 13 | Announcements | `/communication/announcements` | `communication/AnnouncementsPage.tsx` + `services/announcementService.ts` | ✅ **Done & verified** — **Transition:** a teacher's class list (compose dropdown and POST check) used every class in every year. After a rollover it listed "Class 6" twice, and a post to last year's copy reached no-one, since those enrolments are closed. `getTeacherCurrentClassIds` now limits posting to the active year (legacy no-session classes included); a past-year class returns 409 `PAST_YEAR_READ_ONLY`, and the dropdown query is keyed by the active year. **Past-year posts read-only server-side:** edit/delete of a post created before the active year starts returns 409 (it was only hidden in the UI). The list flags `is_history`, so the "All years" view (which mixes years) hides Edit/Delete on old posts. **Year wiring:** picking the current year pinned it, so it now maps to `null` (follows a rollover). **Errors:** a failed load used to show "No announcements yet" (apiClient never throws); it now shows the server message with Retry. "Mark all read" failures show a toast. **UX:** class-scoped posts show their class ("Class 6 · Parents"). Teacher empty states: "post to one of your classes", or "no classes this year yet". aria-labels on the Edit/Delete icon buttons. Real data: teacher `/my-classes` gives Class 6 and JSS 3 (current only). Teacher posts to past Class 6 → 409; Nursery 2 → 403; school-wide → 400 CLASS_REQUIRED. Teacher posts to current Class 6 → 201, listed in 2027/2028 as "Class 6", not in 2026/2027. Own edit 200; another teacher's edit/delete → 403. Own delete removes it (count 0 → 0). |
| 14 | Support | `/support` | `SupportPage.tsx` + `routes/phase21HelpSupportRoutes.ts` | ✅ **Done & verified** — no year dimension (tickets are account-level). **Requests hung forever on any error.** The phase 18–22 route modules register async handlers straight on `app` and rethrow, and Express 4 doesn't catch async rejections. A ticket with a missing field or a wrong id never got a response (unhandled rejection, then client/Vercel timeout). New `utils/asyncRoutes.ts` (`asyncSafeApp`) registers those five modules through a proxy that forwards rejections to `errorHandler`. **Ticket rules:** a requester could set any status on their own ticket and post hidden "internal" replies. Non-admins may now only close a ticket, their replies are always public, and replies are capped at 10k characters. **Frontend:** the ticket list and thread treated `{success:false}` as "no tickets"; they now show the error state. Ticket access was already owner-scoped (IDOR guard). Real data: missing fields → 400, unknown ticket get/reply/status → 404 (all three used to hang), list → 200. |
| 15 | School Events | `/events/school` | `events/EventsPage.tsx` + `routes/eventRoutes.ts` | ✅ **Done & verified** — year wiring already done (principal pass). **Teachers saw every draft.** The list returned all statuses to "managers", so a teacher saw the principal's and colleagues' unannounced drafts, and could open them by id. Teachers now see published events plus their own drafts (`drafts_only_by`, applied to the list and the KPI summary). GET `/:id` returns 404 for someone else's draft. **Role leak:** teachers were offered Edit/Publish/Duplicate/Cancel/Delete row actions that the server rejects (403, principal-only). Split into `canCreateEvents` (teachers create drafts) and `canManageEvents` (admins). Real data: tenant has 4 drafts + 1 published. Teacher list 1 (was 5), summary total 1; principal 5. Teacher opens a draft they didn't create → 404; principal → 200. |
| 16 | Calendar | `/events/calendar` | `events/CalendarPage.tsx` | ✅ **Done** — month navigation, no year filter needed; the endpoint returns published events only. A failed load showed "No events this month"; there's now an error banner with Retry. |
| 17 | My Events | `/events/my-events` | `events/MyEventsPage.tsx` | ✅ **Done** — personal registrations, all time (no year filter by design). A failed load showed an empty list; it now surfaces the error in the table. |

Legend: ✅ done · 🔧 code change needed · 🔎 confirm only.

**Teacher Settings, Guide and walkthrough (header menu, not in the sidebar list):**
- **Settings** (Profile, Security, Offline & Storage). (1) The "Display Settings (Global Configuration)" card showed teachers *placeholder defaults*, because non-admins never load school settings; it is now admin-only. (2) The password form only checked length, while the server needs upper case, lower case, a number and a symbol. It now has a live checklist mirroring `PasswordService`, plus a "you'll be signed out" note. (3) PUT `/auth/users/:id` now trims and lower-cases email before the uniqueness check, which is case-insensitive. Before, `IBRAHIM@…` could create a second login identity. It also validates email format and non-blank names. (4) Offline & Storage now confirms "Clear offline cache" with a `ConfirmationDialog` (it used to clear on one tap), handles storage errors instead of spinning forever, and explains offline registers. (5) Teacher-specific subtitle, and aria-labels on the password show/hide buttons. Verified: invalid email → 400; blank name → 400; colleague's email in another case → 409; editing another user or your own role → 403; teacher row unchanged.
- **Guide** (`lib/onboarding.ts` TEACHER, rendered by `GuidePage.tsx`). Rewritten to cover every v1 teacher page. Leave, Messages and Attendance Reports are v2-gated and left out. It adds a "Your teaching rhythm" roadmap (day / week / term), "Good to know" rules (own-class scope, one year at a time with the Results exception, the principal publishes, offline), 12 page sections, and 6 FAQs. New optional `setupTitle`, `setupIntro`, `keyRules` and `faqs` fields keep the principal's roadmap unchanged. Every claim was checked against the code (e.g. assignment *grading* isn't in the UI, so the guide says "follow up on submissions").
- **Replay walkthrough.** The teacher steps grew from 5 to 10 (sign-in, register, assignments, scores, report cards, conduct, announcements, past years, security). Replay now goes straight to the role's dashboard and also leaves a one-shot `sessionStorage` flag, so a slow dashboard load or redirect can't miss the open event. The modal has `role="dialog"`, Esc to skip and arrow-key navigation.

**#0 Overview — how it handles the year transition** (template for other dashboards):
- Classes come from the selected year's session only. There is no "fall back to
  every class": right after a rollover, a teacher with no assignments in the new
  year sees an empty year with a clear message, not last year's classes posing as
  current. A year that doesn't exist shows nothing.
- Student counts use live statuses (`enrolled`/`active`) for the current year and
  historic statuses (`promoted`/`graduated`/`completed`/`repeated` too) for a past
  year. Without that, every past-year class shows 0 students.
- Transition in progress (`pending_transition`): students still enrolled in last
  year's copies of the teacher's classes (`carried_from_id`) produce an amber
  "{year} is being set up" notice until the principal moves them.
- The overview follows the school automatically. `YearFilter` uses `noAutoSelect`
  and the current year is stored as `''`, so after Start New Academic Year it
  moves to the new year instead of staying on the year that was active on load. A
  picked year that is later removed falls back to the current year.
- Past year = read-only record: Quick Actions, per-class Scores/Attendance
  shortcuts and the announcements widget are hidden. Today's schedule is
  suppressed and activity is relabelled "Activity in {year}". Empty states name
  the year.

**#1 Classes & Streams — what was fixed** (also benefits the principal view):
- **Offline-cache leak (affects every class picker).** `classesService.listClasses`
  used to swap an EMPTY online answer for the teacher's offline cache, which
  holds every year's classes. A past year (or a new year with no assignments)
  then showed other years' classes. It now trusts a successful online answer
  even when empty, and falls back to the cache only offline. That cache read is
  filtered by year, level, status and search.
- **Offline year filter.** `schoolConfigService.listAcademicSessions` remembers the
  school's sessions per tenant (`getCachedAcademicSessions()`), so cached classes
  can be matched to a year without a connection.
- **Legacy-class leak.** Backend `GET /classes` matches the year against real
  sessions (normalised). Classes with no session count as the active year only,
  never inside a past year. An unknown year returns nothing. A school with no
  sessions at all stays unfiltered.
- **KPIs from the whole year.** The response now includes `stats` (total, enrolled,
  average size, capacity %) across the filtered set, not just the current page.
  The page uses it and computes from the page only when offline. Capacity 0 no
  longer produces NaN.
- **Transition-aware.** `pending_transition` counts students still actively
  enrolled in last year's copies (`carried_from_id`) of the listed classes. The
  page shows an amber notice; principals are pointed to the Overview to finish.
- **Year switch resets everything.** Page, row selection and teacher level
  options are all keyed by year, and a level that doesn't exist in the new year
  is cleared. `noAutoSelect`, with the current year stored as `''`, makes the
  page follow a rollover.
- Year-aware empty states. No "Add" prompt or bulk toolbar in a past year. Bulk
  deactivate now reports partial failures instead of always saying it worked.

Teacher scoping to keep: teachers see only their assigned classes
(`classesService.listClasses`, `canMarkAllStudents` false on Attendance,
`recordedBy = user.id` on Discipline). A role change flips these automatically
because the gates read `useAuth().user.role`.

### Student — next (work order) · then Parent → Accountant → Admissions

Student sidebar, top to bottom. **Messages** is v2 (hidden) and skipped. For
each page, apply §2 as the student role: own data only, published data only
(results, report cards, events), read-only throughout, and the student's own
year (their class's session). Most pages are shared components already done for
principal and teacher; verify what a *student* sees and can do.

| # | Sidebar item (student order) | Route | Status |
|---|---|---|---|
| 0 | Overview / Dashboard | `/student/dashboard` | ✅ **Done & verified** — `Phase13StudentDashboard.tsx` + `services/studentDashboardService.ts` (backend). **No year at all before:** the class was "the most recent active enrolment" (any year), attendance KPIs, the donut and the recent list were *lifetime* while grades were one year, and "today's classes" used the server's UTC weekday. Now `GET /dashboards/student?academic_year` (default = the active year) resolves the student's class OF THAT YEAR (historic statuses for a past year, so a promoted student can look back). Grades are published-only for that class/year. Attendance uses `resolveYearScope` + `applyYearScope` for that year. The timetable is that class's. "Today" is the school's weekday (`tenantTimezone`), current year only. Fees stay account-level (balances from any year are payable, and this is labelled). **Transition:** if the school has rolled over but the student is still active in last year's class, the response carries `pending_transition` and the page shows the amber "{year} is being set up" notice instead of passing last year's class off as current. **Frontend:** `YearFilter` (`''` = current, `noAutoSelect`), history banner, live widgets (announcements, today's classes) hidden in a past year, and the KPI becomes "Subjects Taken". Year-aware empty states ("You weren't in a class in {year}", "No results published for {year} yet"). Load errors use the server message plus Retry; tabs have `role="tab"`. **Fix:** "Excused" was always 0 (counted as present); it's now its own count, still counted as attended. Date keys come from local parts (DATE columns are local-midnight). Real data: James default/2027-28 Class 6, 0 days, weekly 6; 2026-27 (past) Class 6, 11 days at 91%; 1999/2000 not enrolled. Alpha 2026-27 15 days at 80%, fees outstanding Le 3,619 in every year. A teacher token → 403. **Follow-ups from user testing:** (1) *"The current year still shows past-year data."* Fees and announcements leaked across years. Fees on the dashboard are now the selected year only. Billed/paid/outstanding come from the finance ledger (`financeLedgerService.getStudentLedger`, the same projection staff use), so the KPI, chart and Fees-tab ledger agree; the invoice sum said Le 3,619 vs the ledger's Le 1,812. Other years' unpaid balance comes back per year in `fees.other_years`. `StudentLedgerView` takes `academicYear`; `/finance/my-fees` still shows every year. `AnnouncementsWidget` defaults to the current academic year (fixed for every dashboard). (2) *"Grades and other tabs are empty for past years."* A year can hold **several classes**: Alpha went JSS 3 → promoted → SSS 3 Commercial within 2026/27, and results and timetable live on JSS 3. The year resolver now returns every class that year (shared `utils/studentScope.ts` → `studentYearScope`). Grades are gated per class by that class's publication. The timetable comes from the latest class that has one. There's a Class column for multi-class years, and the banner reads "JSS 3 → SSS 3 Commercial". (3) *Arrears wording.* "You still owe Le 1,812.00 in school fees from 2026/2027 (last year). This balance has not been cleared and must still be paid…" with a "Pay Le X now" button, a matching amber banner on every tab of the current-year dashboard, and a KPI hint naming the year. Real data per tab: Alpha 2026/27 grades 9 (JSS 3 first term published; second term unpublished, so hidden), 15 attendance days, JSS 3 timetable (4 slots), fees Le 1,819 / 7 / 1,812; 2027/28 everything 0, with "Le 1,812 from 2026/2027". James 2026/27 11 days, 6-slot timetable, 0 grades (unpublished, correctly hidden). ⚠ Data note for the Accountant pass: Alpha's invoice `INV-2026-617050` (Le 3,619, no `academic_year`) doesn't match her ledger charges (Le 1,819). |
| 1 | Subjects | `/academic/subjects` | ✅ **Done & verified** — `GET /subjects/my`  (student/parent view) used "the most recent active enrolment" with no year, so it ignored history and after a rollover showed last year's class. It now takes `?academic_year` (default = the active year) and unions subjects across **every class that year** via `studentYearScope`. During an unfinished rollover it uses the class the student is still in, and says so (`meta.pending_transition` → amber notice). A past year keeps subjects that have since been retired. The response carries `meta` (year, classes, past, transition). Student and parent ids now come from the shared `studentIdForUser` / `childIdForParent` (guardian link verified). **Frontend:** viewers get a `YearFilter` (`''` = current, `noAutoSelect`), a history banner, "Subjects in Class 6 · 2027/2028" as the subtitle, year-aware empty states, and a load-error banner (`{success:false}` used to read as "no subjects"). **Role leak fixed:** the grid view's empty state showed "Add your first subject" to students and parents; it's now principal-only. Staff keep the tenant-global catalogue (no year). Real data: James 2026/27 9 subjects, 2027/28 6, 1999/2000 0. Alpha 2026/27 11 (JSS 3 + SSS 3 Commercial), 2027/28 2. Student POST /subjects → 403. The dashboard re-checked after the refactor (unchanged). |
| 2 | Timetables | `/academic/timetables` | ✅ **Done & verified** — **Security:** `GET /timetable/weekly/:classId` had no student or parent check, so any logged-in student or parent could read any class's timetable by id. Students now need an enrolment (any status) in that class; parents need a linked child in it. Otherwise 403. **Year:** the student view had no year and took "the latest active class". It now has a `YearFilter` (`''` = current) and resolves the class *for that year* via the dashboard's `timetable_class` (the class that year that has a timetable, e.g. JSS 3 for Alpha's 2026/27), with a history banner naming the class. **Periods were wrong for students:** with no class list, the level fell back to SSS, so a Class 6 pupil saw SSS periods. The level now comes from the weekly response (`class_level`). Subtitle "Class 6 · weekly schedule · 2027/2028"; amber notice during an unfinished rollover; denied or failed loads show the error (it used to be a blank grid); year-aware empty states. Parents keep their child switcher (year support is covered in the Parent pass). Real data: James 2026/27 and 2027/28 Class 6, 6 slots, level CLASS6. Alpha 2026/27 JSS 3 (4 slots); 2027/28 SSS 3 Commercial (0, empty state). Student → Nursery 2 403; James's parent → his class 200, Nursery 2 403; teacher → Nursery 2 still 403. |
| 3 | Assignments | `/academic/assignments` | ✅ **Done & verified** — **Security:** `GET /assignments/:id` only checked teacher ownership, so any student or parent could read any assignment by id. Now a student needs an enrolment (any status) in that class, and a parent needs a linked child in it; otherwise 403. Drafts are 404 to them and are left out of their list. **Year:** the student and parent list used "any active enrolment" with no year, so past classes vanished after a rollover. It now takes `?academic_year` (default = the active year) and scopes to **every class that year** via `studentYearScope` (the class still held during an unfinished rollover is used and flagged). The response carries `meta`. Parents can pass a verified `child_id`. **Own work:** class-wide submission and grading counts are staff data, so they are removed for these viewers. A student (or a parent's selected child) gets their own submission instead (`my_submission_status`, `my_marks`, `my_feedback`), shown as a "My Submission" column (Graded · 8/10, Handed in, Late, Not handed in) and a section in the detail modal. The KPI becomes "Handed In". "Overdue" uses the school's today (`tenantToday`, was `CURRENT_DATE`), leaves out work already handed in, and is 0 in a past year (history). **Frontend:** `YearFilter` for everyone (`''` = current, `noAutoSelect`), a history banner ("JSS 3 → SSS 3 Commercial · nothing here is due any more"), an amber rollover notice, a parent child switcher, the subtitle "JSS 3 · 2026/2027", year-aware empty states, and a load error (`{success:false}` used to read as "no assignments"). There is no Draft filter for viewers. Due dates read the calendar day (no timezone shift). Students hand work in to the teacher; there is no online submission endpoint, and the banner says so. Real data: James 2026/27 1 (Algebraic, Class 6); 2027/28 0. Alpha 2026/27 2 (JSS 3); 2027/28 0. James → JSS 3 assignment 403, Alpha → Class 6 403. Alpha's parent → JSS 3 200, Class 6 403. A temporary graded submission showed as graded 8 with feedback for the student and parent, and the Handed In KPI was 1; the row was removed afterwards. Principal (3, class-wide counts) and teacher (1) are unchanged. |
| 4 | Exam Timetable | `/academic/exam-timetable` | ✅ **Done & verified** — **Security:** `GET /examinations/:id` had no student or parent check. It now needs an enrolment (any status) in the exam's class for the student or a linked child; school-wide exams (no class) are allowed. **Year:** the student view had no year. The page pinned the active year and took the class from the dashboard profile, so after a rollover or for a past year it showed nothing useful. The list now resolves, server-side, **every class the student had in the requested year** (shared `viewerYearClasses` in `utils/studentScope.ts`, also used by Assignments now) and only that year's exams. A `class_id` outside their scope returns nothing. Parents can pass a verified `child_id`. The response carries `meta`. During an unfinished rollover, last year's class is **not** used (its exams are over): the year shows empty with an amber "still listed in {class}" notice. `academic_year` is normalised for staff too ("2026-2027" works). **Frontend:** `YearFilter` for students and parents (`''` = current, `noAutoSelect`), the dashboard-profile dependency removed, a history banner naming the classes, the subtitle "Class 6 · 2026/2027", the class name on each exam when the year had several classes, a "Cancelled" marker, a "You weren't in a class in {year}" state, and a load error with Retry. **Timezone fix (all roles):** the Morning/Afternoon session used local hours on UTC-stored times (the grid and the edit modal), so a browser outside UTC could file an exam under the wrong session. Both now read UTC, matching `composeExamDateTime`. Real data: James 2026/27 first term → Agricultural Science (Class 6); 2027/28 empty. Alpha 2026/27 → none (JSS 3 + SSS 3 Commercial have no exams); 2027/28 empty. Alpha and her parent → the Class 6 exam by id 403; James and his parent → 200. Principal, teacher and the Assignments list are unchanged after the refactor. |
| 5 | Results & Grades | `/academic/results` | ✅ **Done & verified** — `StudentResultsView` gets a `YearFilter` (`''` = current), a history banner, a rollover notice, "not in a class in {year}" and "no results released for {year}" states, and a load error with Retry. A multi-class year gets a Class column, and the ranking uses the class the results were recorded in, with a picker when there are several (dashboard grades now carry `class_id` and `class_year`). `ClassRankingView` shows refused or failed loads instead of "No ranked results". **Security:** seven legacy endpoints, unused by the UI, let any student or parent read the whole school's marks: `GET /results`, `/results/summary`, `/grades`, `/grades/class/:id`, `/grades/:id` and `/grades/student/:id/gpa` are now staff-only. `/grades/student/:id` allows only the student themself or a linked parent (before, parents could read anyone). The ranking's parent link check now covers the legacy `guardian` role. Verified: student and parent get 403 on all of these, 200 on their own or their child's record, and 403 on another student's. The teacher is unchanged. |
| 6 | Report Cards | `/academic/report-cards` | ✅ **Done & verified** — the student view was pinned to the dashboard's current class and year (no history). It now has a `YearFilter` (`''` = current). The card's class comes from that year's classes, preferring the one with released results (Alpha 2026/27 → JSS 3, not SSS 3 Commercial), with a class picker for multi-class years, a history banner, and graduated / not-in-a-class / load-error states. Real data: Alpha's own JSS 3 2026/27 card is 200 with `published_terms = [first_term]` (second term hidden); James's card is 403. |
| 7 | Attendance | `/students/attendance` | ✅ **Done & verified** — `GET /attendance/my` was **lifetime**: a new year opened on last year's absences. It now takes `?academic_year` (default = active) through `studentYearScope` + `applyYearScope`, and returns `meta`. Counting now matches the dashboard and report card: by distinct day with the best status, and excused counts as attended (before, sessions were counted as days and excused lowered the rate). Frontend: `YearFilter`, history banner, rollover notice, subtitle with the classes, the at-risk warning only in the current year, year-aware or graduated empty states, and a load error with Retry. Real data: Alpha 2026/27 15 days at 80%, 2027/28 0; James 2026/27 11 days at 91%. Identical to the dashboard. A parent calling `/my` gets 403. |
| 8 | Fees & Payments | `/finance/my-fees` | ✅ **Done & verified** — opens on the **current year** (`''` = current, follows a rollover; it waits for the active year so it never flashes all years), with "All years" (`'all'`) as an option in the `YearFilter`. Other years' unpaid balances stay visible as "still payable" with Pay (`StudentLedgerView academicYear`). Same for the parent's child view. The ledger shows the server's reason on a refused load. Security confirmed: `/ledger/me` 200; another student's `/ledger/student/:id` 403; Monime and the fee pay routes refuse other students or children. |
| 9 | Announcements | `/communication/announcements` | ✅ **Done** — student and parent class targeting used active enrolments only, so after a promotion last year's class announcements disappeared from last year's history. It now uses every class they are or were in; lists are already year-scoped by date, so the current year is unaffected. Audience rules (all / student / parent + class) unchanged. |
| 10 | School Events | `/events/school` | ✅ **Done & verified** — **Draft leak:** the list's "own drafts only" rule applied to teachers only, so **students and parents saw every unpublished draft** (4 of 5 events in the test school). It now applies to every non-admin. **Audience:** `visibility` / `visible_to_roles` were stored but never enforced. Non-admins now get public events, role-specific events naming their role (parent ≡ guardian), and private ones they organise or registered for (`eventService.viewerMaySee`), in the list, by id, in search (which returned everything) and on register (drafts and role-restricted events give 404). Real data: student, parent and teacher see 1 event (was 5); a draft by id is 404; the principal still sees 5. |
| 11 | Calendar | `/events/calendar` | ✅ **Done & verified** — the calendar and "upcoming" showed only public events, so role-specific events for students and parents never appeared. All three views (list, calendar, upcoming) now share one audience rule (`audienceWhere` in `eventService`): admins see every published event; everyone else sees public, role-specific naming their role, and ones they organise or registered for. Verified with a temporary published "students only" event (deleted afterwards): principal and student see it in the calendar, upcoming, list and by id; parent and teacher see it nowhere (404 by id). |
| 12 | My Events | `/events/my-events` | ✅ **Done** — personal registrations, all-time, no year (by design). |
| — | Settings, Guide & Replay walkthrough | `/settings`, `/guide` | ✅ **Guide rewritten** (`lib/onboarding.ts` STUDENT). It was 3 lines, and "Check results" pointed at the dashboard. Now an 8-step walkthrough (Overview, Timetables & Subjects, Assignments with how hand-in works, Exams, Results & Report Cards with release gating, Attendance, Fees with arrears and Pay, Security), "Your school year" rhythm, four key rules (own records only, one year at a time and auto-move on promotion, results when released, moving up a stage vs graduating), seven sections and five FAQs. Replay uses the same steps. Settings is shared and was hardened in the teacher pass. |

Student-specific things to probe:
- Another student's id on every `/:studentId` or `?student_id` endpoint → 403.
- Unpublished results and report cards are hidden.
- No staff actions anywhere (create/edit/mark), and no staff-only modules (discipline, directory) reachable by URL.
- Fees show only their own invoices; online payment works end to end.
- Year: the student sees their own class's year. Promoted students see last year as history.

### Remaining portal order

| Order | Portal | Status |
|---|---|---|
| 1 | Student | ✅ done (pushed `f89a75d`) |
| 2 | Parent | ✅ done (pushed `036435a`) |
| — | Staff onboarding (prerequisite for 3 and 4) | ✅ done (see below) |
| 3 | Accountant (finance) | ✅ done (this branch) |
| 4 | Admissions | ✅ done (this branch) |

### Parent — after Student (work order)

Parent sidebar, top to bottom. **Messages** is v2 (hidden) and skipped. The
parent sees the same shared pages as a student, but for **each linked child**
(`guardians.user_id` → `guardians.student_id`). Apply §2 as the parent role.

| # | Sidebar item (parent order) | Route | Status |
|---|---|---|---|
| 0 | Overview / Dashboard (child switcher) | `/parent/dashboard` | ✅ **Done & verified** — **Multi-child, multi-year, promotion-aware.** The service was not year-aware at all: "the most recent active enrolment" per child, lifetime attendance, invoice-sum fees, and grades from one class only. Now **each child is resolved independently for the selected year by the student portal's own code** (`studentDashboardService.getDashboard(…, { studentId })`). So siblings in different classes, a child promoted mid-year (`year_classes`, grades per class with publish gating), a graduated child (`graduated`), and a child not yet moved into the new year (`pending_transition`) are each right, and a promotion shows on the next load. `GET /dashboards/parent?academic_year` returns per-child `year_classes`, `enrolled_in_year`, `pending_transition`, `graduated`, this year's `outstanding_fees` plus `other_years_outstanding` / `other_years` / `total_owed`. Aggregate stats average only over children at school that year (`children_in_year`). `/dashboards/parent/child/:id?academic_year` returns the full student-portal payload plus `schedule`, with the guardian link verified (another parent's child is 403). The legacy non-year code was removed. **Frontend:** `YearFilter` (`''` = current); history banner; arrears banner naming each child, amount and year, with Pay. Child chips show each child's status that year ("JSS 3 → SSS 3 Commercial", "🎓 Graduated", "moving up", "Not enrolled in {year}"), and the selection is kept across year switches. Per-child notices cover graduated, rollover, not enrolled and moved up mid-year. Results have a Class column for multi-class years and released-only wording; attendance is the year's full list with calendar-day dates; the fees tab is the year's ledger (other years still payable); announcements are per year; the comparison chart covers only children at school that year; load errors have Retry. `MyFeesPage` "Total Outstanding (all children)" now uses `total_owed` (every year). Real data: Alpha 2026/27 JSS 3 → SSS 3 Commercial, 9 grades, 15 days at 80%, fees Le 1,819 / 1,812 owed; 2027/28 SSS 3 Commercial, 0, with Le 1,812 from earlier years. James 2026/27 Class 6, 11 days at 91%, 6-slot timetable. **Two children** (temporary guardian link, removed afterwards): both resolved independently; average attendance 86%; 2027/28 total owed Le 1,812 from Alpha's arrears. |
| 1 | Subjects | `/academic/subjects` | ✅ **Done & verified** (built in Student #1) — child switcher plus a verified `child_id`, per child per year. Alpha's parent: 2026/27 11 subjects, 2027/28 2; another child's id → 0 (not linked). |
| 2 | Timetables | `/academic/timetables` | ✅ **Done** — the parent view took `child.class_id` from the year-blind summary and had **no year picker**. It now loads the **selected child's year view** (`getChildDetail(child, year)`) and uses that year's class with a timetable (`timetable_class`), so a sibling promoted mid-year or moving up gets the right one. `YearFilter`, history banner, rollover / graduated / not-in-a-class wording with the child's name, and switching child resets the class. Backend check confirmed: the parent of Alpha gets JSS 3 → 200, Class 6 → 403. |
| 3 | Assignments | `/academic/assignments` | ✅ **Done & verified** (built in Student #3) — the switcher always sends the selected child's verified `child_id`, so siblings are never merged. Own-child submission status, per year. |
| 4 | Exam Timetable | `/academic/exam-timetable` | ✅ **Done & verified** (built in Student #4) — per child (`child_id`) per year; another child's exam by id → 403. |
| 5 | Results & Grades | `/academic/results` | ✅ **Done** — `ParentResultsView` rewritten in line with the student view: `YearFilter`; a child chip showing each child's status that year; a Class column for multi-class years; ranking in the class the results were recorded in (with a picker); graduated, rollover, not-in-a-class and not-yet-released states; load error with Retry. Verified: the parent's own child's JSS 3 ranking → 200, Class 6 ranking → 403. |
| 6 | Report Cards | `/academic/report-cards` | ✅ **Done & verified** — the parent view was pinned to the active year and the child's "current" class. It now uses the same year flow as students, for the **selected child** (`getChildDetail`): a year picker, the child's classes that year (preferring the one with released results), a class picker, a history banner, graduated / not-in-a-class / error states, and switching child resets the picks. Own child's JSS 3 card is 200 with `[first_term]`; another child's card is 403. |
| 7 | Attendance | `/students/attendance` | ✅ **Done** — `ParentAttendanceView` was lifetime. It's now per year and per child: `YearFilter`; subtitle with the child's classes; the "today" arrival / departure banner only in the current year when the child has a class, using the device's calendar day instead of UTC; history and rollover notices; graduated / not-in-a-class / error empty states. Counts come from the shared builder (by day, excused counts as attended). |
| 8 | Fees & Payments | `/finance/my-fees` | ✅ **Done** — current year by default with All years; child switcher; "Total Outstanding (all children)" = `total_owed` across every year (before, it was a year-blind invoice sum). Parents can only pay for a linked child (verified in the student pass). |
| 9 | Announcements | `/communication/announcements` | ✅ **Done** (Student #9) — parent audience plus every class their children are or were in, year-scoped. The dashboard widget follows the selected year. |
| 10 | School Events | `/events/school` | ✅ **Done & verified** (Student #10) — no drafts; role-specific events only when they name `parent` (≡ guardian). |
| 11 | Calendar | `/events/calendar` | ✅ **Done & verified** (Student #11) — the shared audience rule; a "students only" event is hidden from parents. |
| 12 | My Events | `/events/my-events` | ✅ **Done** — personal, all-time. |
| — | Settings, Guide & Replay walkthrough | `/settings`, `/guide` | ✅ **Guide rewritten** (`lib/onboarding.ts` PARENT, was 3 lines): a 7-step walkthrough (Overview, one child at a time, timetable/homework/exams, results & report cards, attendance with today's arrival, fees with arrears and Pay, security), "Staying involved" rhythm, five key rules (own children only, each child in their own class, one year at a time with auto-move on promotion, moving up a stage vs graduating, results when released), seven sections, five FAQs. Replay uses the same steps. |

Parent-specific things to probe:
- **Child scope:** only linked children. Another family's child id on any endpoint → 403/404. An unlinked guardian sees an empty state, not an error.
- **Child switcher:** every page follows the selected child (classes, timetable, results, attendance, fees). Switching child resets page state, like a year switch.
- **Multiple children** in different classes or years, including a promoted or graduated child (history) and a child whose class isn't moved into the new year yet.
- **Fees:** each child's invoices and balances are kept apart; Pay goes to the right invoice and the school's Monime account; receipts; a failed or cancelled payment is shown clearly.
- Only published results, report cards and events. Announcements addressed to parents or the child's class only.
- `guardian` is a legacy alias of `parent`: both must behave the same.

### Accountant pass, part 1: finance integrity (✅ done & verified)

- **Overview** (`/accountant/dashboard`): `YearFilter` (current year by default), history banner, arrears from other years with Collect, recent payments for the year with status (only completed ones count), the class each student was in THAT year (`joinClass` in `/finance/analytics`), load error with Retry. Verified: 2026/27 Le 1,819 / 7 / 1,812; 2027/28 0 with Le 1,812 arrears; teacher and student 403.
- **Security:** students and parents could record manual (cash) payments for themselves through `POST /payments`. It's now staff-only (portal users pay through Monime). `/payments/:id/receipt` is staff-only. Teachers no longer read invoices. `/payments/bulk` checks every fee is in the tenant.
- **Recording:** `POST /finance/payments/record`: one payment spread across fees (oldest first) in ONE transaction, with an idempotency key (`payments.idempotency_key`, unique per tenant). Two parallel identical submits → one payment. Future dates and unknown methods → 400. `tenant_id` is set (manual payments were missing from tenant stats).
- **Refund:** locked transaction, numeric maths (pg strings were concatenated: "500" + "200"), payment → `refunded`, twice → 409, online payments → 409 (refund at the provider). `paymentInTenant` joined text to uuid, so every refund was a 404.
- **Invoices:** bulk-invoice runs one locked transaction per student and no longer swallows insert errors (that's how `INV-2026-617050`, Le 3,619 with 0 line items, was made; it is now voided). New invoices go to the active year only (past year → 409). `POST /finance/invoices/:id/void {reason}`: blocked once paid; the fees are released for re-invoicing. The legacy generate path now looks students up in `students`, sets tenant/year, and skips paid, deleted or already-invoiced fees.
- **Fee structures:** amounts are validated (0…10bn, cents), percentages must be whole numbers 0–100, the year is canonical "YYYY/YYYY" (else 400), a due date is required, and the upsert runs in one transaction. Billing takes an advisory lock (two parallel bills → one set of fees) and dedupe ignores deleted rows. Unbill touches only this structure's unpaid, uninvoiced charges and soft-deletes them. A billed structure can't be deleted. **UI:** the bill/unbill toast always said "No new charges" (read `res.data.data`). Fixed. KPI is now "Total Billed" from the ledger.
- **Audit trail:** finance code passed camelCase (`entityType`) to `logAudit`, which read snake_case, so every finance audit insert failed (NOT NULL). `logAudit` now accepts both. Payments, refunds and voids are audited. BE errors 500 → 479.
- Shared `ConfirmationDialog` takes optional `children` (a required-reason field) and `confirmDisabled`. Migration `164_finance_integrity`.

The comprehensive bursar build is split into specs: `.kiro/specs/bursar-finance-phase-a|b|c`.

### Accountant pass, part 2: Bursar Phase A, fee side (✅ done & verified)

Spec `.kiro/specs/bursar-finance-phase-a`. Migration `165_bursar_finance_a`, services in `backend/src/services/finance/`, routes in `bursarFinanceRoutes.ts`. Those routes are mounted at `/api/v1/finance` **before** `schoolExpenseRoutes`, whose `router.use` guard is staff-only and would otherwise block the family reads.

- **Balance identity:** `fee.balance = amount − payments + refunds − active adjustments`. Discounts, waivers, applied credit and late-fee waivers are `fee_adjustments` rows (each auditable and reversible) and are never counted as collected. KPIs: `totalDiscounts`, `totalCreditApplied`, `overdueAmount`; collected = billed − discounts − credit − outstanding.
- **Discounts & Scholarships** (`/finance/discounts`):
  - Discount types: sibling (from the Nth child, families matched by parent account), staff child, scholarship/bursary, custom; percent or fixed; tuition or all charges.
  - Grants per year or term. The principal's grants approve themselves; the bursar's need approval above `fin_discount_approval_threshold`.
  - Revoke puts the amounts back on the fees. Grants are re-applied after billing.
- **Late fees:**
  - The daily job marks fees overdue (school's today) and, if `fin_late_fee_enabled`, adds ONE late fee per fee, fixed or %, after the grace days, with an optional cap.
  - A partial unique index means it can never charge twice. Students keeping to an instalment plan are skipped.
  - Runs via Vercel Cron `/api/v1/cron/finance-daily` (needs **`CRON_SECRET`**), node-cron on long-running servers, or "Run overdue check". Late fees can be waived with a reason.
- **Arrears & Aging** (`/finance/aging`): Not yet due / 1–30 / 31–60 / 61–90 / 90+ per student and class, filters, export, and reminders (one student or everyone listed). Dashboard: cash received today and this month, overdue now, discounts, and approvals waiting.
- **Receipts:**
  - `RCP-YYYY-NNNNNN`, sequential per school, stored, shared by every row of one submission, and back-filled.
  - `balance_after` means a reprint shows the balance at the time. The PDF lists what the payment covered and is stamped REFUNDED when refunded.
  - Manual payments are emailed automatically (`fin_email_manual_receipts`). Re-send and bulk email are available. Families can view payment history and download PDFs.
- **Credit:** an overpayment needs "Keep the extra as account credit". Credit notes, apply credit to fees, and refund credit are available. Applied credit isn't new cash.
- **Instalment plans:**
  - Even split or custom rows that add up to what's owed. Status is derived (payments applied to the oldest instalment first).
  - The minimum-payment policy accepts the next instalment. Families see the schedule.
- **Statement of account:** brought forward from earlier years, every charge, discount, late fee, payment and refund with a running balance, and the closing balance. Available as JSON and PDF, to staff and to a linked parent or the student. `reconciles` checks it against the live balances.
- **Promotions** warn (without blocking) about students in the class who still owe fees.
- **Verified:**
  - 10% scholarship applied on billing (Tuition 1000 → 900 ×3).
  - Le 150 bursar waiver pending, bursar approve → 403, principal approve → Le 150 applied.
  - Overview billed 3,200, discounts 450, collected 0.
  - Overpayment without the flag → 400; with it → receipt `RCP-2026-000002` and Le 50 credit.
  - PDF receipt: student and their parent 200, another parent 403.
  - Statement reconciles (before and after revoke and credit apply).
  - Plan of 2 instalments.
  - Late fee run twice → 3 charged, then 0.
  - Aging buckets correct.
  - Cron without the secret → 401.
  - All test rows removed and Alpha's fees unchanged.

### Accountant pass, part 3: Bursar Phase B, school-side money (✅ done & verified)

Spec `.kiro/specs/bursar-finance-phase-b`. Migration `166_bursar_finance_b`, services `finance/{expenseService,pettyCashService,budgetService,payrollService}.ts`, routes `bursarFinanceBRoutes.ts` (mounted before `schoolExpenseRoutes`).

- **Expenses** (`/finance/expenses`, now v1):
  - fixed categories; vendor, method, reference, department and receipt (photo or PDF via the shared camera);
  - the year comes from the date; past year → 409; future dates → 400;
  - **void with a reason, never delete**;
  - petty-cash and payroll expenses are linked and can only be voided from their source;
  - by-category totals with budget bars, fees-vs-expenses, export.
- **Petty Cash** (`/finance/petty-cash`): funds with a float and a "Low" flag; top up / spend (with receipt, also posted as an expense) / return to bank; the balance is locked, so two parallel spends of 200 on a 300 balance → one 201 and one 409; void (a spend's expense is voided with it).
- **Budget** (`/finance/budgets`): lines per category (optional department), the principal approves, editing reopens it; live budget vs actual (near ≥ 90%, over > 100%) and unbudgeted spend; recording an expense warns when it goes over budget.
- **Payroll** (`/finance/payroll`):
  - Staff pay: basic salary, allowances (taxable or not), recurring deductions and bank details for every teacher, admin and support staff member.
  - PAYE: Sierra Leone monthly bands, first Le 600 at 0%, then 15/20/25%, 30% above Le 2,400.
  - NASSIT: 5% employee, 10% employer, of basic pay, deducted before PAYE. The principal can edit these rates.
  - Run lifecycle: draft (recalculate, bonus or overtime, one-off deductions) → **principal approves** → mark paid. Paying records **Salaries = gross** and **Statutory = employer NASSIT** as expenses. Paying twice → 409; cancel voids the expenses.
  - Payslip PDF, email to staff, **My Payslips** for staff (own payslips only, approved and paid runs), run export for the NRA and NASSIT.
- **Verified:**
  - PAYE: 500 → 0, 1,000 → 60, 2,400 → 360, 5,000 → 1,140.
  - Basic 3,000 + 500 transport − 50 union → gross 3,500, NASSIT 150 / 300, taxable 3,350, PAYE 645, net 2,655. A Le 200 bonus → PAYE 705, net 2,795.
  - Bursar approving → 403; paying before approval → 409.
  - Teacher downloads their own payslip PDF → 200; someone else's → 403.
  - Budget Utilities 251/200 over; petty cash overdraw refused.
  - All test rows removed.

### Accountant pass, part 4: Bursar Phase C, accounting (✅ done & verified)

Spec `.kiro/specs/bursar-finance-phase-c`. Migration `167_bursar_finance_c` (gl_accounts, gl_entries, gl_lines, bank_statement_lines, bank_matches). Services `finance/{glService,glReportService,bankRecService,financeAuditService}.ts`, routes `bursarFinanceCRoutes.ts`.

- **Posting by reconciliation** (`glService.sync`): every fee, payment, refund, discount/waiver, credit note, credit refund, expense, petty-cash top-up/return and paid payroll run has an *expected* set of lines; the sync posts only the difference. Idempotent, and edits / voids / refunds / cancellations post a correcting entry. Runs before accounting reads (15 s throttle), under a per-school advisory lock, and in the daily finance cron after late fees. Fees billed before their academic year starts are dated on the year's first day.
- **Chart of Accounts** (`/finance/accounts`): standard chart created on first open; custom expense categories get their own account (5200+); add accounts (an asset can be marked "holds money" to reconcile it); Fees receivable, Student credit and Petty cash are control accounts (no manual posting).
- **Journal** (`/finance/journal`): server-paged, by source; manual journals with templates (opening balance, cash banked, PAYE/NASSIT remittance, bank charges, donation); balanced or refused; reverse once with a reason (never edit or delete). The principal closes the books up to a date; later changes to old records post on the first open day.
- **Financial Statements** (`/finance/reports`): trial balance, income statement, balance sheet, cash flow (direct), general ledger, by academic year or dates, CSV/Excel/PDF; books check (balanced; Fees receivable = students' balances; Student credit = credit balances; Petty cash = fund balances).
- **Bank Reconciliation** (`/finance/bank-reconciliation`): CSV import with column mapping (duplicates skipped), auto-match (equal amount within 7 days, reference preferred), manual one-to-many matching, ignore, add a missing item to the books, undo an import, difference against the statement balance.
- **Finance Audit Log** (`/finance/audit-log`): school-scoped (through the acting user), by area, person, dates, text; server-paged.
- **Verified** (44 HTTP checks on real data, migration rolled back afterwards so Vercel runs it on deploy): chart 28 accounts; second sync posts 0; integrity checks agree (Fees receivable 1,812); expense + void → correction, Utilities back to 0; custom category → account 5200; petty cash 800 after top-up 1,000 / spend 200; unbalanced, control-account and future-dated journals → 400; second reversal and reversing an automatic entry → 409; trial balance 11,819 = 11,819; balance sheet assets = liabilities + equity; cash flow opening + change = closing; CSV and PDF exports; bank import 3, re-import skipped 3, auto-match 2, bank charge booked and matched, reconciled; undo blocked while matched; closed period → 409; teacher → 403.

### Accountant pass, part 5: family connection and final gaps (✅ done & verified)

Migration `168_bursar_finance_final` (additive): `payroll_runs.paid_from`, `petty_cash_entries.money_account`, `discount_grants.credit_shortfall` + `credited_amount`, `finance_notices` (one row per reminder sent).

- **Family side:** the ledger's `paid` is cash only. Discounts and applied credit are separate lines. Families get `GET /finance/students/:id/discounts` and see credit history. The principal KPI `collected` subtracts discounts. Students and parents are notified in-app and by email (`notifyFamily(…, { emailTenantId })`) for discounts added, late fees, refunds and instalment reminders. Payments received are in-app only, because the receipt email already exists.
- **Instalment reminders:** `planService.remindDue`, run from the daily late-fee job, sends one "due within 3 days" and one "overdue" reminder per instalment. `claimNotice` dedupes them.
- **Payroll:** a non-principal can't change their own pay profile or payslip (403 `OWN_PAY`). "Mark paid" records which account paid it (bank, cash or mobile money), the books credit that account, and each staff member with a login is notified.
- **Petty cash:** top-ups and returns say which account the money came from or went to, and the books use it. The fallback is bank.
- **Discounts:** "Find staff children" on staff-child rules matches a guardian's login, email or phone (last 8 digits) to a teacher, bursar, admissions officer, principal or support staff. The bursar confirms each match. Optional "credit what's already paid": the part of a discount on paid fees becomes account credit, capped at the fees (billed − discounts − credit other grants already gave). It is stored on the grant so it is never doubled. Revoking a grant does not take that credit back, and the dialog says so.
- **Budget:** saving notifies the principal that it needs approval.
- **Monime refunds:** the provider API has no refund call. The refund dialog and the Guide/Support say to refund in the Monime dashboard first, then record it here.
- **Guide:** a teacher with the Bursar/Admissions duty gets those guide sections, rules and FAQs (`getRoleGuide(role, staffDuties)`).
- **Tests:** `bursarFinance.unit.test.ts` (PAYE bands, payslip maths, band validation, money-account mapping, categories) and the ledger property tests: 29 pass.
- **Verified** (26 HTTP checks on real data, email stubbed, test rows removed, migration rolled back so Vercel runs it on deploy):
  - OWN_PAY 403 for own pay, but not for others or the principal.
  - Top-up from cash → Dr 1030 / Cr 1000. Return to mobile → Dr 1020 / Cr 1030. Unknown account → bank.
  - Payroll paid from cash → Cr 1000 and the expense method is cash.
  - Staff-child finder matched Alpha to Ibrahim by phone. The sibling finder is unchanged.
  - Credit shortfall: Le 100 credited. Without the flag, the shortfall is only reported. The approve path is capped at Le 400.
  - Reminders: 1 overdue and 1 due soon, then 0 on a re-run. They reach the parent in-app and by email.
  - Budget notice reaches the principal. The parent can see the discounts list.

### Staff onboarding — ✅ done & verified (before Accountant and Admissions)

Before this, a school had no way to hire an accountant or admissions officer,
other than giving a teacher the Bursar/Administrator designation.

- **Professional staff share one hiring flow.** Teachers, accountants (Bursar) and admissions officers all go through **Add Staff Member** (`TeacherFormModal`) and live in one directory, **Teaching & Admin Staff** (`/staff/teachers`). They have the same `users` + `teachers` record, staff ID, full profile (qualifications, experience, hire date, employment type, photo) and temporary password. The form's **Job** checkboxes are Teaching / Accountant (Bursar) / Admissions Officer:
  - Teaching ticked → `primary_role:'teacher'`, plus `staff_duties` for any other job ticked (teacher + duty, §2.3a). Class, subject and form-class fields show only when Teaching is ticked.
  - Teaching not ticked → exactly one job, which becomes the role (`accountant` → designation `bursar`; `admissions_officer` → `administrator`). No classes are linked, even if the client sends them.
  - Editing can switch jobs (accountant ↔ teacher) or add/remove duties; the person is notified and their portal switches live.
- The directory has a **staff type** filter (`?staff_type=teaching|accountant|admissions_officer|leadership`; accountant and admissions include teachers holding that duty) and a Job badge per row.
- **Support staff** (security, cleaners, cooks, drivers, gardeners, maintenance): easy onboarding with no login, in the `support_staff` table (migration 163), page **Support Staff** (`/staff/members`, `/api/v1/staff`, principal only). Staff IDs are `SUP-0001`…; each record has a job type, phone, emergency contact, photo and status.
- **Staff Attendance** covers every professional staff role (`STAFF_ROLES` in `teacherAttendanceRoutes.ts`). Accountants and admissions officers get only the self sign-in tab.
- **Promote & Assign** uses the same job checkboxes (shared `StaffJobPicker.tsx`): add Bursar/Admissions on top of teaching, or untick Teaching to make it their full-time job (their form class and current-year lessons are dropped, with a warning). Bursar/Administrator are no longer offered as teaching titles. Verified: teacher → teacher + `['accountant']` keeps the lesson; → full-time admissions officer gets `administrator` and 0 lessons.
- **Shared camera** (`components/admin/forms/CameraCapture.tsx`, used by every `FileUploader enableCamera`): full screen, opens on the back camera with a Flip button (falls back to cycling lenses), a lens picker, flash and zoom where supported, a self-timer, a passport-crop face oval (logo: square frame), a rule-of-thirds grid, and a live level from the motion sensor. The capture is auto-straightened by the phone's tilt, with a Straighten slider in the review; the saved photo matches the review exactly (including front-camera mirroring). Clear permission/no-camera errors with a "Camera app" fallback. Android manifest now declares `CAMERA` (optional feature). `/storage` sends `Cross-Origin-Resource-Policy: cross-origin` (helmet blocked uploaded photos from showing), and the uploader keeps the photo inline if the stored URL can't be displayed.
- Migrations: `162_users_staff_duties` (`users.staff_duties jsonb default []`), `163_support_staff`.
- **Fixed on the way:** `generateNextId` read the year as part of the number when there was no separator, so every new staff/student/admission ID repeated the year (`TCH26260006`, `TCH2626260007`). It now parses only the sequence after the prefix and year, and reads already-bad IDs correctly.
- **Verified** (scratch HTTP on real data, rows deleted afterwards): a full-time accountant → role accountant, designation bursar, 0 classes, ID `TCH260006`; an admissions officer → `administrator`; a teacher with `['accountant','bogus']` → `['accountant']`. Directory filters return the right people. Access: the accountant and the teacher + Bursar get fee structures and the accountant dashboard → 200; the admissions officer, and the teacher once the duty is switched to admissions, → 403 on finance and 200 on admissions; a plain teacher → 403 on both. `/auth/me` returns `staffDuties`. An accountant can sign in on Staff Attendance (201). Support staff: create `SUP-0001`, edit, list with per-job stats, 400 on a missing name, a teacher → 403.

### Accountant (finance) — after Parent (work order)

Accountant sidebar, top to bottom (v1). Scholarships (duplicate of Discounts),
Email Notifications and the old Reports → Financial Reports are v2 (hidden).

| # | Sidebar item (accountant order) | Route | Status |
|---|---|---|---|
| 0 | Overview / Dashboard | `/accountant/dashboard` | ✅ year-aware (part 1); now also a "Finance work areas" grid linking every finance page, with pay runs awaiting approval / to pay |
| 1 | Staff Attendance | `/staff/attendance` | ✅ self sign-in (staff onboarding pass) |
| 2 | Fee Structures | `/finance/fees` | ✅ part 1 |
| 3 | Invoices | `/finance/invoices` | ✅ part 1 |
| 4 | Payments & Receipts | `/finance/payments` | ✅ parts 1–2 |
| 5 | Arrears & Aging | `/finance/aging` | ✅ Phase A |
| 6 | Discounts & Scholarships | `/finance/discounts` | ✅ Phase A |
| 7 | Expenses | `/finance/expenses` | ✅ Phase B |
| 8 | Petty Cash | `/finance/petty-cash` | ✅ Phase B |
| 9 | Budget | `/finance/budgets` | ✅ Phase B |
| 10 | Payroll | `/finance/payroll` | ✅ Phase B |
| 11 | Financial Statements | `/finance/reports` | ✅ Phase C |
| 12 | Journal | `/finance/journal` | ✅ Phase C |
| 13 | Chart of Accounts | `/finance/accounts` | ✅ Phase C |
| 14 | Bank Reconciliation | `/finance/bank-reconciliation` | ✅ Phase C |
| 15 | Finance Audit Log | `/finance/audit-log` | ✅ Phase C |
| 16 | My Payslips | `/finance/my-payslips` | ✅ Phase B |
| 17 | Announcements | `/communication/announcements` | ✅ posts to all / parents / students (school-wide); a teacher-bursar now also receives "Accountants" posts |
| 18 | Support | `/support` | ✅ own tickets |
| — | Settings, Guide & Replay walkthrough | `/settings`, `/guide` | ✅ see below |

**Connections fixed in the final accountant pass:**
- `GET /students` rejected `accountant` (403), so the student search in Record Payment and Give a discount never worked for a pure accountant. Now allowed (tenant-scoped, read-only list).
- A teacher with the Bursar duty stays `teacher` on `/students` and `/classes` (not duty modules), so finance pickers showed only their own classes. Finance pages now send `?scope=finance`; `utils/financeLookup.isFinanceLookup` widens the list only for accountant/principal or a teacher whose live `staff_duties` include `accountant`. Teacher pages stay class-scoped, and a plain teacher sending `scope=finance` is not widened.
- Announcements addressed to "Accountants" now reach a teacher-bursar (`announcementService.viewerDuties`).
- Finance notifications (bell, `core.notifyFinanceStaff`, best-effort): discount waiting for approval → principal; pay run drafted → principal; pay run approved → bursar; online (Monime) payment received → bursar. "Bursar" includes teachers with the duty.
- Sidebar re-filters when the role or duties change (memo deps).
- **Settings:** Profile, Security and a read-only **Payment Policy** tab (also for a teacher-bursar) loaded through `GET /school-config/settings`; saving stays principal-only (403). Accountant subtitle.
- **Guide** (`lib/onboarding.ts` ACCOUNTANT, was 3 steps): 10-step walkthrough, "Your finance rhythm" (day / week / month / new year), five key rules (money is never deleted, the principal decides the big things, one year at a time, the books post themselves, online payments record themselves), 13 sections covering every v1 page, six FAQs. New Guide icons: Coins, Receipt, Timer, Percent, Scale, Landmark, History.
- **Verified** (18 HTTP checks, temporary accountant + temporary Bursar duty, all removed): accountant lists 5/5 students; teacher-bursar finance lists 5 students / 4 classes vs 1 / 2 on teacher pages; plain teacher not widened; "Accountants" post reaches accountant and teacher-bursar, not a plain teacher; waiver → principal notified with a Discounts link; policy readable, not writable; dashboard and Phase B/C endpoints 200.
- **Final accountant fixes (user review):**
  - **Staff attendance:** self sign-in is today only and closes at the school's `staff_signin_closes_at` (default 18:00, school time; principal sets it in Attendance Rules, validated HH:MM) → 409 `SIGN_IN_CLOSED`. A day the principal marked absent/excused can't be overridden by a self sign-in (409 `MARKED_BY_PRINCIPAL`). `/my` returns `sign_in {open, closes_at}`; the panel shows today's date, refreshes every minute (an overnight tab moves to the new day) and explains when sign-in is closed. Past days stay principal-only (403).
  - **Smart student search** (`GET /finance/students/search?q=`, `studentLookupService.search`): every word must match a name, admission no., email, class, or a guardian's name / email / phone digits; exact admission no. first, then names starting with the word, current students before leavers, then who owes most. Shared `StudentPicker` (debounced, arrow keys / Enter / Esc, highlighted matches, class, guardian, owed) used by Record Payment and Give a discount.
  - **Bursar student profile** (`GET /finance/students/:id/profile`): name, admission no., photo, class, status, contacts, guardians (tap to call / email, parent login yes/no), billed / owed this year, owed in total, credit, last payment. No credentials, medical, address, results, attendance or discipline. New default **Profile** tab in the Student Account window, with "Send a fee reminder".
  - **Discounts:** a percentage on fees not billed yet always waits for the principal (was auto-approved at "Le 0"); term and Tuition matching tolerate old `first_term` / `tuition` rows; `/finance/bulk-bill` normalises year, term and type and applies approved discounts; unbill now removes discounted (unpaid) charges and takes their discount lines back; `applied_amount` ignores deleted fees; per-student lock + duplicate check inside the transaction (two parallel identical grants → one); one-off waivers can repeat except the same one within 5 minutes; leavers can't get new discounts; sibling candidates = children enrolled that year, grouped by parent account or guardian phone, oldest by real date of birth; revoke: bursar withdraws pending or revokes their own within-limit discount, only the principal revokes what they approved (403), past years read-only (409); the requester is notified of approve / reject; the response reports `unbilled` and `shortfall` (already-paid fees) for clear toasts. UI: Withdraw / Revoke on the list and the student's Discounts tab (year-aware), busy "Give" for siblings, distinct-student KPI, client checks (custom reason, % ≤ 100).
  - **Help Center:** accountant quick actions and six bursar FAQs; new "School fees & finance" ticket category (Billing now says it's the WiSkul subscription); articles: Start here (bursar), Fee structures and billing, Invoices and reminders, Record payments & receipts (rewritten: smart search, methods, credit, refunds), A student's account, Discounts, Arrears & late fees, Expenses / petty cash / budget, Payroll, The books, Bank reconciliation, Staff sign-in. Guide updated to match.
  - **Verified** (28 HTTP checks, temporary accountant, fee and grants, all removed): search by 3 letters / admission no. / full name / parent phone digits, teacher 403; profile without sensitive fields, teacher 403; within-limit waiver Le 50 on an old-style `first_term`/`tuition` fee (500 → 450); repeat → 409; parallel → 201 + 409; unbilled % → waits; withdraw; own revoke; Le 200 above limit → principal approves, bursar notified, bursar revoke 403, principal 200; principal-marked absent → sign-in 409; after closing time → 409; staff past day 403; bad closing time 400.
- **Known limits:** `GET /students/:id` (full profile) stays closed to accountants on purpose; finance uses the Student Account modal. A teacher-bursar gets the TEACHER guide (their main role). Monime refunds are done at the provider. `CRON_SECRET` must be set in Vercel for the daily late-fee + books job.

Accountant-specific things to probe:
- **Money integrity:** amounts in Leones with consistent rounding. A balance never goes negative from double-recorded payments. Recording is idempotent (double submit), and webhooks are idempotent and verified. Totals and KPIs come from the server over the whole year.
- **Year:** fee structures are per year (they start fresh each year). Invoices and payments are filtered by year. Past years are read-only (no new invoices or edits into a closed year), but outstanding balances from last year are still visible and collectable as intended.
- **Roles:** the accountant manages finance only. No access to academics, discipline or staff management by URL; school-config Settings tabs stay principal-only.
- **Audit trail:** who recorded or voided a payment. Voids and refunds need a reason and use `ConfirmationDialog`.
- Reminders don't double-send. Receipts and exports (CSV/PDF) match on-screen totals.

### Admissions pass: pipeline and enrolment (✅ done & verified)

Migration `169_admissions_pipeline` (additive): on `admission_applications` interview date/location, assessment score, documents checklist (jsonb), `student_id` (unique: one student per application), enrolled class/date, withdrawal reason, `emailed_decisions`; new `admission_application_events` (timeline). Existing enrolled applications are linked to their students. Service `services/admissions/admissionPipelineService.ts`; routes `admissionsRoutes.ts`. The legacy `admissionRoutes.ts` (shadowed GETs, PATCH path that created duplicate students) is no longer mounted.

- **Stages:** pending (New) → under_review → interview_scheduled → approved | waitlist | rejected | withdrawn; reopen rejected / withdrawn / approved → under_review. Every move is checked on the server (`TRANSITIONS`, 409 `INVALID_TRANSITION`) and written to the timeline. Reject and withdraw need a reason; an interview needs a date.
- **Approve ≠ enrol.** `POST /admissions/:id/enrol` creates the student once: transaction + per-application lock, current-year class only (400 `INVALID_CLASS` for last year's copy), capacity check (409 `CLASS_FULL` unless confirmed), plan limit, enrolment with `academic_session_id`, parent linked, student + parent sign-ins returned once. A retry or double click returns the same student.
- **Emails:** interview invitation, approved / waitlist / rejected each sent once (`emailed_decisions`), enrolment confirmation without passwords. Withdrawals and notes never emailed.
- **Office:** walk-in form uses this year's classes with places left, documents checklist, optional "Accept and enrol now"; edit until enrolled; notes; duplicate warning (same name + birthday, applications and students); principal-only delete, never for an enrolled application (409 `ENROLLED_KEEP`), audited.
- **Public form:** same child + birthday + phone in the open intake returns the first application (no second row or email); admissions staff (officers, duty teachers, principal) get an in-app notice.
- **Page:** stage chips with server counts, KPIs, search (child, number, parent, phone, email), class / source filters, year (all years option), server paging in grid and list, filtered export, `?status=` / `?open=` deep links; application modal with Details / Documents / Timeline and only the allowed actions.
- **Verified** (40 HTTP checks on real data, emails stubbed, test rows removed, migration rolled back so Vercel runs it): illegal moves refused; interview + decision emails once; approve creates no student; last-year class refused; enrol → student, session-tagged enrolment, guardian, sign-ins; enrol again and two parallel enrols → one student; walk-in enrol-now; edit / delete guards; withdraw + reopen; duplicate flag; list counts, search, status filter, export; overview active-year default and all years; public duplicate submit; officer notified; admissions staff cards 403.
- **Cross-portal (follow-up):** `GET /students` used to run `syncEnrolledApplicationsToStudents`, which turned every non-rejected application (even New ones) into a student on each Student Directory load. Removed: Enrol is the only way an application becomes a student. Enrolling now bills the terms already billed to the class (officer can untick, e.g. a late joiner; class due dates; approved discounts applied; same lock as Fee Structures → Bill), notifies the bursar (what was and wasn't billed) and the class teacher. Verified 7 more checks (no ghost student, billing, bursar notice, roster).
- **Hardening (release pass):**
  - Public form: shared rate limiter (Redis when `REDIS_URL` is set), database caps that hold on every serverless instance (5 online applications per family per day, 120 per school per hour → 429), duplicate re-checked under the numbering lock (a double click gives one application), honeypot field rendered, optional Cloudflare Turnstile (`TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`; CSP allows `challenges.cloudflare.com`). Verified 8 checks with Cloudflare's test keys.
  - Interview times in emails and the timeline use the school's timezone.
  - Vercel preview builds no longer run migrations against the shared production database (`PREVIEW_DATABASE_ISOLATED=1` once previews have their own `DATABASE_URL`).
  - Component tests `ApplicationDetailModal.test.tsx` (7): allowed actions per stage, reject needs a reason, enrol bills the chosen terms, full class guard, last-year class not preselected.
  - Brevo email check passes 6/6 with the local `.env`.
- **Data:** `ADM-2026-00001` (approved by the old code, never a student) was marked Withdrawn with a note; Reopen it if it was a different child.
- **Release checklist (needs the Vercel / GitHub owner):** merge the PR (runs migrations 168 + 169, already applied to the shared DB); in Vercel Production set `CRON_SECRET`, confirm `BREVO_API_KEY` / `BREVO_SENDER_EMAIL` / `BREVO_SENDER_NAME`, optionally `REDIS_URL` and the two Turnstile keys; one browser click-through as admissions officer, principal and a parent.

### Admissions — last (work order)

Admissions-officer sidebar, top to bottom. Email Notifications and Enrollment
Reports are v2 (hidden) and skipped.

| # | Sidebar item (admissions order) | Route | Status |
|---|---|---|---|
| 0 | Overview / Dashboard (pipeline) | `/admissions/dashboard` | ✅ year-aware (active year default, YearFilter); KPIs (applications / this month / online, to review, acceptance rate, enrolled), upcoming interviews, approved-not-enrolled, pipeline / recent / by-class tabs; every tile deep-links `?status=` / `?open=`; error + Retry |
| 1 | Classes & Streams | `/academic/classes` | ✅ view-only, all classes of the year (`listAllClasses`), office wording |
| 2 | Subjects | `/academic/subjects` | ✅ view-only (writes 403) |
| 3 | Timetables | `/academic/timetables` | ✅ view-only, office empty states |
| 4 | Exam Timetable | `/academic/exam-timetable` | ✅ view-only (writes 403) |
| 5 | Results & Grades | `/academic/results` | ✅ Class Ranking only, "view only" title; score/rating tabs hidden (grid + scores 403) |
| 6 | Report Cards | `/academic/report-cards` | ✅ view; draft banner says the principal publishes |
| 7 | Student Directory | `/students/directory` | ✅ (existing manager rights; delete is principal) |
| 8 | Admissions | `/students/admissions` | ✅ rebuilt (part below) |
| 9 | Student Profiles | `/students/profiles` | ✅ password reset now asks to confirm |
| 10 | Announcements | `/communication/announcements` | ✅ school-wide to everyone / students / parents (existing) |
| 11 | Support | `/support` | ✅ admissions FAQs + shortcuts; help article rewritten (enrol step) |
| 12 | ID Cards | `/identity/cards` | ✅ students only for this role (server 403 `STUDENTS_ONLY` on generate/bulk; UI hides staff targets; by-class uses this year's classes) |
| — | Settings, Guide & Replay walkthrough | `/settings`, `/guide` | ✅ Settings: profile + security; Guide rewritten (5-step walkthrough, 8 sections, rules, FAQs; merged for duty teachers) |

Admissions-specific things to probe:
- **Pipeline integrity:** status moves follow the allowed order. Approve → enrol creates exactly one student (no duplicates on retry). Decisions email the applicant once. Admission numbers follow the school's ID format.
- **Year:** applications target the active year (or the next one, if the school allows it). Enrolling puts the student into a **current-year** class, never last year's copy.
- **Read-only academics:** classes, timetables, results and report cards are view-only for admissions. No score entry or class edits, enforced on the server.
- **Student data:** Directory and Profiles may show credentials only where the role is meant to hand them out. Discipline is read-only for this role (`staffOnly` allows GET).
- **ID cards:** generate only for enrolled current-year students. Bulk generation reports failures.
- The public application form: validation, file upload limits, spam/duplicate protection, and the tenant is resolved from the school slug.
