
# Academic-Year Architecture — Portal Playbook

How every portal page should behave when the **academic year changes** (via
_Start New Academic Year_) and when the **user's role changes**. This codifies
the patterns we applied across the **principal portal** so we can repeat them
for the teacher, accountant, admissions, student and parent portals.

> TL;DR: the **current year opens by default**, **past years are read-only
> history**, every list refetches when the year changes, and every action is
> gated by `role` **and** `viewingPast`. Nothing invents years — only real
> `academic_sessions` appear in pickers.

---

## 1. The two shared building blocks (never re-implement these)

### `useAcademicYears()` — `frontend/src/hooks/useAcademicYears.ts`
Single source of year options for the whole app.

```ts
const { years, activeYear, isLoading } = useAcademicYears();
```
- `years: string[]` — real `"YYYY/YYYY"` sessions, newest first. Never a guess.
- `activeYear: string` — the tenant's active session. **`''` while loading** (so
  pickers don't lock onto the wrong year before the real one arrives).
- After a rollover, `activeYear` becomes the new year automatically — any page
  that derives its year from `activeYear` follows the school with no extra code.

### `<YearFilter>` — `frontend/src/components/common/YearFilter.tsx`
```tsx
<YearFilter value={year} onChange={setYear} />                 // single-year page
<YearFilter value={year} onChange={setYear} includeAllOption /> // list/history page
```
- Controlled by the page's state; self-defaults to `activeYear` on first load
  (unless `includeAllOption` or `noAutoSelect`).
- **"All years" value is the empty string `''`** (not null). The active year is
  labelled ` (current)` in the dropdown.

---

## 2. Per-page frontend convention

Pick ONE of two idioms depending on whether the page offers "All years".

### Idiom A — single-year page (most pages)
```tsx
const { canAccess } = useAuth();
const canManage = canAccess(['principal', 'super_admin']); // whoever may edit

const [pickedYear, setYear] = useState('');
const { activeYear } = useAcademicYears();
const year = pickedYear || activeYear;                 // the one year shown
const viewingPast = !!year && !!activeYear && year !== activeYear;

// Past years are history even for managers:
const canManageHere = canManage && !viewingPast;
```

### Idiom B — list/history page that allows "All years"
```tsx
const [pickedYear, setYear] = useState<string | null>(null);
const { activeYear } = useAcademicYears();
const year = pickedYear ?? activeYear;                 // '' = All years
const yearReady = pickedYear !== null || !!activeYear;
const viewingPast = !!year && !!activeYear && year < activeYear; // strictly earlier
```

### Query keys + `enabled` guard (mandatory)
Put `year` in the query key so a year change refetches, and guard so nothing
loads before the active year is known:
```tsx
// Idiom A
useQuery({ queryKey: ['classes', { ...filters, year }], enabled: !!year, queryFn: () =>
  svc.list({ academic_year: year || undefined }) });

// Idiom B
useQuery({ queryKey: ['payments', year], enabled: yearReady, queryFn: () =>
  svc.list(year || undefined) });
```

### Read-only history banner (mandatory on year-scoped pages)
```tsx
{viewingPast && (
  <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
    <span>Showing <strong>{year}</strong> … as history. The current year is {activeYear}.</span>
    <button type="button" onClick={() => setYear(activeYear)} className="text-xs font-bold text-blue-700 hover:underline dark:text-blue-300">
      Back to {activeYear}
    </button>
  </div>
)}
```
Idiom B banners also handle the "All years" case (`pickedYear === '' && !!activeYear`).

### Action gating (role AND past-year)
- Hide create / Edit / Delete / Deactivate / status actions when
  `!canManageHere` (Idiom A) or `viewingPast` (Idiom B).
- Use `<RoleGuard roles={[...]}>` for role, and wrap with `!viewingPast` for the
  year, e.g. `{!viewingPast && <RoleGuard roles={['principal','super_admin']}>…</RoleGuard>}`.
- Because `canAccess` derives from `useAuth().user.role`, a **role change
  re-renders these gates automatically** — no manual refresh needed.
- Timetable-style pages use a local `EditGuard` = `viewingPast ? null : <RoleGuard …>`.

---

## 3. Backend convention

### Reads — scope by the requested year, default to active
`backend/src/utils/academicYear.ts`:
- `resolveActiveYear(tenantId)` → the default year for reads with no year param.
- `resolveYearScope(tenantId, req.query.academic_year)` → `{ classIds, from, to } | null`
  (`null` = no/`all` year → unscoped). Match records by class first, else a date
  window `[session.start, nextSession.start)`.
- `applyYearScope(q, scope, classCol, dateCol)` → applies it to a Knex query.
  Pass `classCol = null` for tables with no class column (date-window only).

```ts
const scope = await resolveYearScope(req.user.tenant_id, req.query.academic_year);
query = applyYearScope(query, scope, 'bn.class_id', 'bn.note_date');
```

### Writes — past years are read-only
Throw a **409 with code `PAST_YEAR_READ_ONLY`** on any mutation targeting a
non-active year:
```ts
const PAST_YEAR_ERROR = () =>
  new AppError('This belongs to a past academic year and is read-only.', 409, 'PAST_YEAR_READ_ONLY');
// … if (isPastYear) throw PAST_YEAR_ERROR();
```
Already applied in: `classRoutes`, `assignmentRoutes`, `timetableRoutes`,
`feeStructureRoutes`, `studentRoutes` (class move). **Exception:** Results stays
editable in past years (late corrections / promotions) — with the amber warning.

---

## 4. Hard rules (do not break)

1. The **current year opens by default**; past years are **read-only history**.
2. Only **real** years in pickers (no calendar guesses except a brand-new school).
3. Use the shared `useAcademicYears`, `<YearFilter>`, and `SearchBar`
   (`@components/admin/table/SearchBar`) — never ad-hoc copies.
4. **Custom dialogs only** — `ConfirmationDialog`
   (`@components/admin/feedback/ConfirmationDialog`), never `window.confirm/alert/prompt`.
5. Don't break working pages. Verify with `tsc` + build before committing.
6. Run `npm run android:sync` before pushing.
7. Tenant-global data (Subjects, Card Templates) has **no** year dimension — do
   NOT add a year filter there.

---

## 5. FINAL PRODUCTION CHECKLIST (per page)

> This is a **final production check**, not just "add a filter". The rule:
> **when the academic year changes, EVERYTHING on the page becomes that year's
> data.** No piece of UI may keep showing current-year numbers while the rest
> switched. Treat a year switch like loading a different page.
>
> **Process pages in sidebar order, top to bottom** (start at the Overview /
> Dashboard, finish it fully, then move to the next item). Reference a
> completed principal page while doing each one — e.g. `AdminDashboard.tsx`
> (overview), `ClassesPage.tsx` (list), `PaymentsPage.tsx` (KPIs + charts).

Tick EVERY box before calling a page done:

### Year wiring
- [ ] Imports `useAcademicYears` + `<YearFilter>`; `<YearFilter>` is in the header.
- [ ] `pickedYear` state + derived `year` + `viewingPast` (correct idiom A/B).
- [ ] `onChange` resets dependent local state too (page number, selected rows,
      expanded sections, sub-tab filters) — not just the year.

### Everything resets to the selected year (the core check)
- [ ] **KPIs / stat cards** recompute for the year (totals, counts, rates).
- [ ] **Charts / graphs / donuts / trends** reload for the year.
- [ ] **Tables / lists / grids** show only that year's rows.
- [ ] **Dropdown/filter OPTIONS** are year-scoped (e.g. class/section pickers
      list that year's classes, with that year's counts) — no stale options.
- [ ] **Secondary widgets** (recent activity, schedules, "top X", distributions)
      reflect the year — or are explicitly hidden for a past year if they only
      mean "right now" (e.g. today's schedule, live attendance).
- [ ] **Empty states** read correctly for a past year ("No … in {year}"), not
      the generic "create your first …".
- [ ] No current-year value leaks when viewing a past year (verify by eye:
      switch years and confirm every number/section changes).

### Query hygiene
- [ ] EVERY year-scoped query includes `year` in its queryKey.
- [ ] EVERY such query has the `enabled` guard (`!!year` or `yearReady`) so
      nothing loads with the wrong/blank year first.
- [ ] Dependent/cascading queries (options that feed filters) are year-scoped too.

### Read-only history + roles
- [ ] Read-only history banner with a "Back to {activeYear}" link.
- [ ] Create / Edit / Delete / status / reminder / generate actions gated by
      role **and** `!viewingPast`.
- [ ] A **role change** re-gates automatically (gates read `useAuth().user.role`).
      Confirm no action is wrongly visible after switching role.
- [ ] Deep-link / modal actions (row menus, detail-modal buttons) are also
      hidden in a past year.

### Backend
- [ ] Reads default to the active year and accept `academic_year`, scoped via
      `resolveActiveYear` / `resolveYearScope` / `applyYearScope`.
- [ ] The response is fully year-scoped (every aggregate, not just the list).
- [ ] Writes throw 409 `PAST_YEAR_READ_ONLY` for a non-active year (except
      Results, which stays editable with the amber warning).

### General production checks (not year-specific — every page)
- [ ] **Security / isolation:** every endpoint is tenant-scoped, and role checks
      are on the SERVER (not just hidden buttons). Teachers only reach their own
      classes, students and records. Probe another class or record → 403/404.
- [ ] **Dates & time:** "today" is the school's day (`tenants.timezone` / the
      device's local date), not server UTC. No future dates where they make no
      sense. Times show in local time.
- [ ] **Real-world edge cases:** deactivated or left users still appear in their
      history. Conflicts (double submit, already done, someone else already
      marked it) give a clear message and a way forward, not a dead end.
- [ ] **Data integrity:** counts and KPIs come from the server over the whole
      set. No optimistic UI left showing a value the server rejected.
- [ ] **Loading / empty / error states** exist for every query, with role-aware
      wording (a teacher is never told to use a principal-only feature).
- [ ] **Offline / slow network:** a failed or offline request shows a message.
      Nothing claims "saved" unless the server (or the offline queue) has it.
- [ ] **Verified on real data** with scratch HTTP calls as teacher AND principal,
      including the deny paths, with row counts checked before and after.

### Robustness & conventions
- [ ] All mutations handle failure (try/catch or `res.success === false`) with a
      user-facing toast — no silent failures, no unhandled rejections.
- [ ] No `window.confirm/alert/prompt`; destructive actions use `ConfirmationDialog`.
- [ ] Shared `SearchBar` (not an ad-hoc input); icon-only buttons have aria-labels;
      touch targets visible on mobile (no hover-only controls).
- [ ] `tsc` clean (changed files), both apps build, `npm run android:sync` done.
- [ ] `tsc` clean (changed files), both apps build, android synced.

---

## 6. Portal status

### Principal — ✅ done
Classes, Subjects (tenant-global), Timetables, Exam Timetable, Assignments,
Results, Report Cards, Promotions, Student Directory, Student Profiles,
Attendance, Discipline, Fees, Invoices, Payments, ID Cards, Events, Event
Analytics, Announcements, Academic Archive, Admin dashboard.

### Teacher — in progress

**Work order: top-to-bottom in the teacher sidebar, starting at the overview
(dashboard).** Tick each page off before moving to the next. Most pages are the
**same shared components** already done in the principal pass, so the job there
is to _verify_ the teacher sees the correct read-only / class-scoped behaviour;
the dashboard is the one page that needs new code.

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
| 9 | Student Profiles | `/students/profiles` | `students/StudentProfilesPage.tsx` | ✅ **Done & verified** — **The page had no year filter.** It now has one page-level `YearFilter` (current year by default and follows a rollover, plus "All years") in the header. It drives the list, class options, and every tab: Results (`/report-cards/student/:id/summary?academic_year`), Attendance (the tab's own picker was removed), and Conduct (discipline stats, infractions and actions take `academic_year` → `resolveYearScope`). A past or all-years view shows a history banner. Changing the year resets the class filter and page. Account actions (reset password, parent account) stay visible because they are account-level, not yearly. **Teacher scope:** `utils/teacherScope.ts`. GET `/students/:id` is 403 for a student the teacher never taught. Login provisioning only runs for roles that can see credentials (it used to run on every view). The SL summary and attendance are teacher-scoped too. **Conduct tab used the wrong id.** Discipline `student_id` is an FK to `users.id`, so the tab now queries by `student.user_id`. **Pre-existing 500s fixed:** infraction and action lists counted over a query with ORDER BY and `si.*` (Postgres 42803), so they now use `clearSelect().clearOrder()`. **Attendance:** a year with no records is no longer `at_risk`. Real data (teacher): 2026/2027 shows Alpha@JSS 3 and James@Class 6. Alpha has 19 results and 18 attendance days; James has 3 results and 11 days. 2027/2028 shows James only, with 0 results and 0 days (not at risk). All discipline endpoints return 200 in both years. Principal: 5 students in each year (all have enrolments in both). ⚠ For #12: check whether `InfractionFormModal` sends `students.id` where the FK needs `users.id`. |
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

### Accountant / Admissions / Student / Parent — not started
Repeat §2–§5 for each portal's pages. Most are shared components; focus on each
portal's **dashboard** and any portal-only pages (e.g. `/finance/my-fees`).
