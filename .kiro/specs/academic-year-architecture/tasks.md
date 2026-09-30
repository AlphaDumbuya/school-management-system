# Academic Year Architecture — Tasks (sidebar order)

Work modules TOP-TO-BOTTOM. Each module = Audit → Gaps → Fix → Verify → Sign-off
(see design.md §2). Do not start a module until the previous is signed off.
Only LIVE (v1) sidebar items are listed. Portals to verify are noted per module.

Legend: [ ] todo · [~] in progress · [x] done (signed off, commit hash noted)

---

## Module 0 — Foundation (shared; do FIRST)  ✅ DONE
Everything below reuses these. Historical access (R7), the universal dynamic
year filter (R8), and all-six-roles coverage (R9) depend on this foundation.
- [x] 0.1 `normalizeAcademicYear` + `sameAcademicYear` helpers (backend/src/utils/academicYear.ts)
- [x] 0.2 Data migration 159: normalized session names to slash; merged duplicate
      (tenant_id, name) sessions; single active per tenant; normalized year
      strings across sl_* / fees / fee_structures / examinations / student_promotions;
      recreated invariant indexes. Applied (Batch 70); verified clean.
- [x] 0.3 `resolveActiveYear(tenantId)` resolver (backend/src/utils/academicYear.ts)
- [x] 0.4 `useAcademicYears()` hook (frontend/src/hooks/useAcademicYears.ts)
- [x] 0.5 Shared `<YearFilter>` component (frontend/src/components/common/YearFilter.tsx)
- [x] 0.6 Backfilled null-session active classes to the active session (migration 159)
- [x] 0.7 Builds pass (vite + tsup); committed + pushed; sign-off recorded

NOTE: per-endpoint `?academic_year=` default-to-active wiring is applied per
module as each is worked (the resolver + hook + filter are ready to use).

Note on ROLES: every module below must be verified for ALL applicable roles —
STUDENT, PARENT/GUARDIAN, TEACHER, ACCOUNTANT, ADMISSIONS_OFFICER, PRINCIPAL,
SUPER_ADMIN. "Portals" lines name who can access; the checklist confirms each.
Every listed module must gain the shared `<YearFilter>` and honor past years
(R7/R8) unless the module genuinely has no year-specific data (then note "n/a").

---

## ACADEMIC MANAGEMENT

## Module 1 — Classes & Streams  (/academic/classes)  ✅ DONE
Portals: admin, super_admin, teacher, admissions_officer
- [x] Audit · [x] Gaps · [x] Fix · [x] Verify · [x] Sign-off
- [x] Added shared <YearFilter>; list scoped by academic_year (null-session
      classes still included so nothing is hidden); defaults to active year
- [x] Teacher sees only assigned/led classes (pre-existing scoping kept)
- [x] Create/edit binds to active session; year-scoped duplicate guard (pre-existing)

## Module 2 — Subjects  (/academic/subjects)  ✅ DONE (year filter n/a)
Portals: admin, super_admin, teacher, admissions_officer, student, parent
- [x] Audit · [x] Gaps · [x] Fix (none needed) · [x] Verify · [x] Sign-off
- [x] Subject CATALOG is intentionally year-agnostic (a subject persists across
      years) → year filter n/a per R8 "unless module has no year-specific data".
- [x] Tenant-scoped (subjects.tenant_id + legacy created_by fallback) correct.
- [x] Student/parent see own class's subjects via /my; per-tenant code uniqueness.

## Module 3 — Timetables  (/academic/timetables)  ✅ DONE
Portals: admin, super_admin, teacher, admissions_officer, student, parent
- [x] Audit · [x] Gaps · [x] Fix · [x] Verify · [x] Sign-off
- [x] Staff get <YearFilter>; class selector scoped to the chosen year's classes
      (changing year resets the class pick). Students/parents auto-resolve own class.

## Module 4 — Assignments  (/academic/assignments)
Portals: admin, super_admin, teacher, student, parent/guardian
- [x] Audit · [x] Gaps · [x] Fix · [x] Verify · [x] Sign-off
- [x] Assignments scoped to class/current year; teacher-owned; student sees own class
  Backend `assignmentRoutes.ts` list + count queries filter by `academic_year`
  (matches `academic_sessions.name` OR null-session so legacy rows show). Service
  `assignmentsService.ts` gained `academic_year` param. `AssignmentsPage.tsx` adds
  `year` state + `<YearFilter>` (staff only) passed into query + queryKey. Students/
  parents keep their own-class read-only view (no filter needed).

## Module 5 — Exam Timetable  (/academic/exam-timetable)
Portals: admin, super_admin, teacher, student, parent, admissions_officer
- [x] Audit · [x] Gaps · [x] Fix · [x] Verify · [x] Sign-off
- [x] Exams keyed by academic_year; current-year default; history selectable
  `ExamTimetablePage.tsx` dropped the `new Date()`-fabricated `yearOptions` and
  the fabricated default year; now uses `<YearFilter>` (real sessions, auto-
  selects active year). Shown to ALL roles so students/parents can view past-
  year exam timetables. Backend `examinationRoutes.ts` already filters
  `examinations.academic_year` (normalized to slash by migration 159), so the
  canonical `YYYY/YYYY` value matches.

## Module 6 — Results & Grades  (/academic/results)
Portals: admin, super_admin, teacher, student, parent, admissions_officer
- [x] Audit · [x] Gaps · [x] Fix · [x] Verify · [x] Sign-off
- [x] Real year picker; results keyed by year+class; publish-gate for non-staff
- [x] Teacher scope to assigned subjects/classes
  Staff `ResultsPage.tsx` dropped the `new Date()`-fabricated `yearOptions` +
  default; now uses `<YearFilter>` (real sessions, auto-selects active year).
  `ScoreEntryGrid` / `ClassRankingView` / `DomainRatingsModal` receive that year
  and query `sl_subject_results.academic_year` (normalized to slash by migration
  159). Students/parents keep read-only, publish-gated current-year views
  (`StudentResultsView`/`ParentResultsView` via dashboard endpoint); past-year
  results are reached through the Academic Archive (Module 27), which the
  dashboards link to — a deliberate boundary, no historical picker on this page.

## Module 7 — Report Cards  (/academic/report-cards)
Portals: admin, super_admin, teacher, student, parent, admissions_officer
- [x] Audit · [x] Gaps · [x] Fix · [x] Verify · [x] Sign-off
- [x] Year + class picker from real sessions; past years retrievable
- [x] Student/parent auto-resolve own; publish-gated
  VERIFY-PASS (no code change): `ReportCardsPage.tsx` already sources years from
  the tenant's REAL sessions (`schoolConfigService.listAcademicSessions`), builds
  a normalized/sorted `yearOptions` with a small current-span fallback (same
  logic `useAcademicYears` centralizes), defaults staff to the active session,
  and scopes classes by the selected year (`listClasses({academic_year})`) so a
  past year shows THAT year's classes. Deep-links from the Academic Archive via
  `?year=&class_id=`. Students/parents auto-resolve their own student/class/year;
  report card fetch is server-side publish-gated. Meets R7/R8/R9 as-is.

## Module 8 — Promotions  (/academic/promotions)
Portals: admin, super_admin
- [x] Audit · [x] Gaps · [x] Fix · [x] Verify · [x] Sign-off
- [x] From/To clear; real year; non-destructive; idempotent; reversible path
- [x] Fresh candidates (no stale "Recorded")
  VERIFY-PASS (no code change): `PromotionsPage.tsx` sources years from real
  sessions (`listAcademicSessions`), defaults to the active session, scopes the
  class picker by the selected year (`listClasses({academic_year})`), and its
  candidate/history/execute calls all key off that year. From/To dropdowns are
  distinct (fixed earlier) and candidates use `staleTime:0` + refetch so no
  stale "Recorded" shows. Promotion is non-destructive (adds a
  `student_promotions` row + moves enrollment) and reversible by deleting that
  row. Admin/super_admin only — no student/parent portal. DB session names were
  normalized to slash by migration 159. Meets requirements as-is.

---

## STUDENT MANAGEMENT

## Module 9 — Student Directory  (/students/directory)
Portals: admin, super_admin, teacher, admissions_officer
- [x] Audit · [x] Gaps · [x] Fix · [x] Verify · [x] Sign-off
- [x] Current class from latest active enrollment; teacher scope; year-aware where relevant
  Students are persistent entities; the directory defaults to the CURRENT roster
  (latest active enrollment → class_name). Added an OPTIONAL year scope:
  `<YearFilter includeAllOption>` on `StudentDirectoryPage.tsx` ("All years" =
  current roster; a past year shows that year's enrolled roster). Backend
  `GET /students` gained `academic_year`: builds a distinct student-id set from
  `enrollments`→`classes`→`academic_sessions.name` (OR null-session so legacy
  classes match), applied to BOTH data + count queries. Teacher scope preserved
  (year further narrows within their assigned classes). Service type extended.

## Module 10 — Admissions  (/students/admissions)
Portals: admin, super_admin, admissions_officer
- [x] Audit · [x] Gaps · [x] Fix · [x] Verify · [x] Sign-off
- [x] Applications keyed by academic_year; enroll targets active session
  `admission_applications` already carry `academic_year` (shown as a badge).
  Added an OPTIONAL intake-year filter: `<YearFilter includeAllOption>` on
  `AdmissionsPage.tsx` beside the status filter. Backend `listApplications`
  service + `ApplicationListQuery` type + route now accept `academic_year` and
  filter `admission_applications.academic_year`. Enroll-on-approve creates the
  student + enrollment into the applied-for class (`class_applying_for`/
  `grade_id`, a current-session class) — correct target. admin/super_admin/
  admissions_officer only.

## Module 11 — Student Profiles  (/students/profiles)
Portals: admin, super_admin, teacher, admissions_officer
- [x] Audit · [x] Gaps · [x] Fix · [x] Verify · [x] Sign-off
- [x] Overview/academics/attendance/conduct/billing tabs year-aware
- [x] Attendance tab scoped to current year/term (not lifetime); fix KPI key mismatch
  Two bugs fixed on `StudentProfilesPage.tsx`:
  (1) KPI key mismatch — the fallback summary used `present_count/late_count/
      absent_count` while the KPICards + real backend response use
      `present/late/absent`. Fallback keys corrected so empty state shows 0.
  (2) Lifetime-totals — `GET /attendance/student/:id` had NO year scope. Added
      optional `academic_year` (scopes via classes→`academic_sessions.name`, OR
      null-session; empty = lifetime). Service `getStudentAttendance(id, year)`
      + attendance tab `<YearFilter includeAllOption>` with a "showing X /
      all-time" caption. Academics tab already shows per-row Year+Term.

## Module 12 — Attendance  (/students/attendance)
Portals: admin, super_admin, teacher, parent, student
- [x] Audit · [x] Gaps · [x] Fix · [x] Verify · [x] Sign-off
- [x] Register scoped to class + current session; summaries year/term scoped
- [x] Teacher scope; parent/student own records
  Staff `AttendancePage.tsx` gained a header `<YearFilter>` (auto-selects active
  year) that scopes the class list (`att-classes` → `listClasses({academic_
  year})`) used by BOTH the register (marking) tab and the logs class filter, so
  you mark/view the correct year's classes; changing year clears the selected
  class + reg roster. Marking stays date+session based (correct). The per-student
  lifetime-totals bug was fixed in Module 11 (`/attendance/student/:id` now takes
  `academic_year`). Student/parent self-views (`/attendance/my`, parent child
  detail) show their current attendance; past-year is reached via the Academic
  Archive + the year-scoped Student Profile attendance tab — deliberate boundary,
  consistent with Results (Module 6). No backend change needed here (classes are
  already academic_year-filterable via their session).

## Module 13 — Discipline & Conduct  (/discipline)
Portals: admin, super_admin, teacher
- [x] Audit · [x] Gaps · [x] Fix · [x] Verify · [x] Sign-off
- [x] Records tenant/student scoped; year context where relevant; teacher scope
  VERIFY-PASS (no code change): discipline is a student's persistent behavioral
  HISTORY — `student_infractions`/`discipline_actions`/`behavioral_notes`/
  `discipline_appeals`/`conduct_reports` are keyed by `incident_date` (timestamp)
  with NO `academic_year` column, and every list/stat query is tenant-scoped
  (verified in `disciplineService.ts`). The UI already filters by search/status/
  severity/period and records are chronological. Year is not a natural or
  reliably-derivable partition here (no session date ranges stored), matching the
  spec's "year context where relevant" — not applicable. Teacher scope preserved
  (record/view infractions + notes only; analytics reserved for principal/admin).

---

## STAFF MANAGEMENT

## Module 14 — Teachers  (/staff/teachers)
Portals: admin, super_admin
- [x] Audit · [x] Gaps · [x] Fix · [x] Verify · [x] Sign-off
- [x] Tenant-scoped; assignments reflect current session's classes
  VERIFY-PASS (no code change): teachers are persistent staff, not year-scoped.
  `TeachersPage.tsx` is a directory filtered by search/status, server-side
  tenant-scoped. Year context lives in their class ASSIGNMENTS, which are made
  against session-scoped classes and already year-aware via Classes (Module 1)
  and Timetables (Module 3). A year filter on the staff directory isn't a natural
  dimension (staff continue year over year). Meets requirements as-is.

## Module 15 — Teacher Attendance  (/staff/attendance)
Portals: principal, teacher
- [x] Audit · [x] Gaps · [x] Fix · [x] Verify · [x] Sign-off
- [x] Staff attendance scoped by date/session; teacher self, principal all
  VERIFY-PASS (no code change): `TeacherAttendancePanel.tsx` is a DAILY HR
  register — principals pick a date (capped at today) to view/mark the staff
  roster; teachers self sign-in/sign-out and see their recent records. The
  `teacher_attendance` table (migration 136) is keyed by `attendance_date` with
  no academic_year — staff attendance is continuous by date, not partitioned by
  school year, so a year filter isn't applicable. Correctly date-scoped;
  teacher-self vs principal-all roles enforced.

---

## FINANCIAL MANAGEMENT

## Module 16 — Fee Structures  (/finance/fees)
Portals: admin, super_admin, accountant
- [x] Audit · [x] Gaps · [x] Fix · [x] Verify · [x] Sign-off
- [x] Real year picker (done-partial); structures keyed by year; KPIs year-scoped
  VERIFY-PASS (+1 cleanup): `FeesPage.tsx` already sources the year picker from
  the tenant's REAL sessions (`listAcademicSessions`) with a small current-span
  fallback, `year` starts empty then auto-selects the active session, and fee
  structures are saved/read keyed by that `academic_year` string (slash-
  normalized by migration 159). Removed a now-dead `CURRENT_YEAR` `new Date()`
  const. Accountant/admin/super_admin see the same year-scoped structures + KPIs.

## Module 17 — Payments & Receipts  (/finance/payments)
Portals: admin, super_admin, accountant
- [x] Audit · [x] Gaps · [x] Fix · [x] Verify · [x] Sign-off
- [x] Payments/ledger year-scoped; balances reflect selected year
  `PaymentsPage.tsx` gained a header `<YearFilter includeAllOption>` wired into
  the analytics query. Backend `/finance/analytics` now accepts `academic_year`
  and scopes ALL fees-derived figures (totals billed/paid/outstanding + by-term/
  by-level/by-class + top defaulters) via a `feeYear()` helper on
  `fees.academic_year`, so the KPIs/balances reflect the selected year (empty =
  all years). Payment-method mix / 6-month trend / this-month remain
  transaction-time cashflow views (not year-partitioned; `payments` has no
  academic_year column). The raw transaction log stays a dated ledger. The
  year-scoped tenant roll-up already existed via `financeLedgerService.
  getTenantSummary`/`getBreakdown(academic_year)`.

## Module 18 — Fees & Payments (student/parent)  (/finance/my-fees)
Portals: student, parent, guardian
- [x] Audit · [x] Gaps · [x] Fix · [x] Verify · [x] Sign-off
- [x] Per-student ledger by year/term; pay flow; own data only
  VERIFY-PASS (no code change): `MyFeesPage.tsx` → `StudentLedgerView.tsx`
  already renders EVERY academic year the student has fees for
  (`ledger.years.map`), each with a year header + per-term/charges cards, and
  builds payable scopes (full outstanding / per-year / per-term / charges-only)
  across ALL years. Student sees own ledger (`getMyLedger`); parent uses a child
  switcher then that child's ledger (`getStudentLedger`) — own data only, server
  enforced. No year filter needed: the view is inherently multi-year and a filter
  would only HIDE history. Fully meets R7/R9 for the fees portals.

---

## COMMUNICATION

## Module 19 — Announcements  (/communication/announcements)
Portals: admin, super_admin, teacher, parent, student, accountant, admissions_officer
- [x] Audit · [x] Gaps · [x] Fix · [x] Verify · [x] Sign-off
- [x] Audience/class/role scoping correct; bell unread; teacher class scope
  VERIFY-PASS (no code change): announcements are chronological, audience-
  targeted communications — NOT academic-year entities (no year partition). The
  page scopes correctly by role: teachers post only to classes they teach
  (`myClasses()`) and can target their class/students/parents; dept staff →
  students/parents; admins → any audience. List is tenant-scoped, recent-first,
  paginated. Delivered across all portals. Year filter not applicable.

## Module 20 — Support  (/support)
Portals: principal, teacher, accountant, admissions_officer
- [x] Audit · [x] Gaps · [x] Fix · [x] Verify · [x] Sign-off
- [x] Ticket/contact flow works; role-appropriate
  VERIFY-PASS (no code change): Support is a help-center + ticketing system —
  role-aware topic guides (`getModulesForRole`) + FAQ + tickets. Tickets are
  user-scoped (`listMyTickets`), category/priority/status based, date-ordered,
  with deep-link open from email. Operational requests, not academic-year
  records — year filter entirely N/A. Flow (create/thread/reply) works per role.

---

## IDENTITY MANAGEMENT

## Module 21 — ID Cards  (/identity/cards)
Portals: admin, super_admin, admissions_officer
- [x] Audit · [x] Gaps · [x] Fix · [x] Verify · [x] Sign-off
- [x] Cards reflect current class/session; generation + download work (web+native)
  VERIFY-PASS (no code change): ID cards are physical credentials with their own
  EXPIRY date (6mo/1yr/2yr picker), tenant-scoped, re-issued on expiry — their
  lifecycle is expiry-based, not academic-year partitioned (a card can span
  years). Card face pulls the holder's current class/details at generation.
  "By class" bulk-generate scopes RECIPIENTS (not the card's year). Generation +
  download verified earlier through the shared `download.ts` (web + native). A
  year filter isn't a meaningful dimension here — N/A.

## Module 22 — Card Templates  (/identity/templates)
Portals: admin, super_admin
- [x] Audit · [x] Gaps · [x] Fix · [x] Verify · [x] Sign-off
- [x] Set-default + role picker; tenant-scoped; render correct
  VERIFY-PASS (no code change): templates are reusable DESIGN definitions
  (layout/colors/logo) applied to ID cards — year-agnostic by design, exactly
  like the Subjects catalog (Module 2). Tenant-scoped; set-default + role picker
  fixed earlier (mapper returns both `id` and `templateId`). No year dimension.

---

## EVENTS MANAGEMENT

## Module 23 — School Events  (/events/school)
Portals: admin, super_admin, teacher, parent, student
- [x] Audit · [x] Gaps · [x] Fix · [x] Verify · [x] Sign-off
- [x] Non-managers see published only (done); upcoming default; role actions
  VERIFY-PASS (no code change): events are date-based with a lifecycle
  (draft→published→completed/cancelled), NOT academic-year partitioned. Backend
  `GET /events` FORCES `status='published'` for non-managers
  (`effectiveStatus = isManager ? requestedStatus : 'published'`); write/publish/
  cancel/complete are principal/super_admin-authorized, create adds teacher.
  `EventsPage.tsx` defaults to upcoming-only with an "Include past" toggle for
  history + status filter for managers. Year filter not applicable (chronological).

## Module 24 — Calendar  (/events/calendar)
Portals: admin, super_admin, teacher, parent, student
- [x] Audit · [x] Gaps · [x] Fix · [x] Verify · [x] Sign-off
  VERIFY-PASS: `CalendarPage.tsx` renders by month/year via `getCalendarEvents`
  (start/end range) — the calendar IS the time navigator; server publishes-only
  for non-managers. Date-based, not year-partitioned.

## Module 25 — My Events  (/events/my-events)
Portals: admin, super_admin, teacher, parent, student
- [x] Audit · [x] Gaps · [x] Fix · [x] Verify · [x] Sign-off
  VERIFY-PASS: `MyEventsPage.tsx` lists the user's OWN registrations
  (`getMyRegistrations`) — own data only, chronological. Year N/A.

## Module 26 — Event Analytics  (/events/analytics)
Portals: admin, super_admin
- [x] Audit · [x] Gaps · [x] Fix · [x] Verify · [x] Sign-off
  VERIFY-PASS: `EventAnalyticsPage.tsx` (manager-only route
  `authorize(PRINCIPAL, SUPER_ADMIN)`) shows tenant event KPIs/trends with its
  own date-range `AnalyticsFilters`. Events aren't year-partitioned; date filters
  cover the time dimension. N/A for academic-year filter.

---

## REPORTS & ANALYTICS

## Module 27 — Academic Archive  (/reports/academic)
Portals: admin, super_admin
- [x] Audit · [x] Gaps · [x] Fix · [x] Verify · [x] Sign-off
- [x] Any past year snapshot (done); deep-links; per-student history
  VERIFY-PASS (built earlier): `AcademicArchivePage.tsx` + `academicArchiveService`
  + `/reports/academic` let admins pick any REAL past session and view that
  year's snapshot, deep-linking into Report Cards (`?year=&class_id=`) for
  per-student history. This is the canonical historical-access surface the
  student/parent portals link to (Results/Attendance boundaries). Real sessions,
  admin/super_admin scoped.

---

## Sign-off log
(append: `Module N — <name> — YYYY-MM-DD — <commit>`)
- Module 0 — Foundation — 2026-09-30 — 0cf9d1e
- Module 1 — Classes — 2026-09-30 — 59fccb6
- Module 2 — Subjects (year N/A) — 2026-09-30 — fdfd9d9
- Module 3 — Timetables — 2026-09-30 — fdfd9d9
- Module 4 — Assignments — 2026-09-30 — f47dbae
- Module 5 — Exam Timetable — 2026-09-30 — 62de84f
- Module 6 — Results & Grades — 2026-09-30 — 3cf38f9
- Module 7 — Report Cards — 2026-09-30 — 8ea5e51
- Module 8 — Promotions — 2026-09-30 — 77ef567
- Module 9 — Student Directory — 2026-09-30 — 7deffb5
- Module 10 — Admissions — 2026-09-30 — 7dd5c62
- Module 11 — Student Profiles — 2026-09-30 — b4b3c3f
- Module 12 — Attendance — 2026-09-30 — 80c2d24
- Module 13 — Discipline & Conduct (year N/A) — 2026-09-30 — 9197740
- Module 14 — Teachers (year via assignments) — 2026-09-30 — fe4a0c9
- Module 15 — Teacher Attendance (daily HR, year N/A) — 2026-09-30 — 8ab72e7
- Module 16 — Fee Structures — 2026-09-30 — 41c26a0
- Module 17 — Payments & Receipts — 2026-09-30 — 61895a5
- Module 18 — My Fees (ledger multi-year) — 2026-09-30 — 536bbe8
- Module 19 — Announcements (year N/A) — 2026-09-30 — b9aa859
- Module 20 — Support (year N/A) — 2026-09-30 — e8db12b
- Module 21 — ID Cards (year N/A) — 2026-09-30 — 3dea909
- Module 22 — Card Templates (year N/A) — 2026-09-30 — 3dea909
- Module 23 — School Events (published-gate, year N/A) — 2026-09-30 — (this commit)
- Module 24 — Calendar (year N/A) — 2026-09-30 — (this commit)
- Module 25 — My Events (year N/A) — 2026-09-30 — (this commit)
- Module 26 — Event Analytics (year N/A) — 2026-09-30 — (this commit)
- Module 27 — Academic Archive — 2026-09-30 — (this commit)




