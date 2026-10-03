
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
| 10 | Attendance | `/students/attendance` | `students/AttendancePage.tsx` | ✅ shared (teacher class-scoped). |
| 11 | Teacher Attendance | `/staff/attendance` | `students/AttendancePage.tsx` (`tab='teachers'`) | ✅ shared. |
| 12 | Discipline & Conduct | `/discipline` | `discipline/DisciplinePage.tsx` | ✅ done (year filter + read-only past). |
| 13 | Announcements | `/communication/announcements` | `communication/AnnouncementsPage.tsx` | ✅ done. |
| 14 | Support | `/support` | `SupportPage.tsx` | ✅ N/A (no year dimension). |
| 15 | School Events | `/events/school` | `events/EventsPage.tsx` | 🔎 verify. |
| 16 | Calendar | `/events/calendar` | `events/CalendarPage.tsx` | 🔎 verify. |
| 17 | My Events | `/events/my-events` | `events/MyEventsPage.tsx` | 🔎 verify. |

Legend: ✅ done · 🔧 code change needed · 🔎 confirm only.

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
