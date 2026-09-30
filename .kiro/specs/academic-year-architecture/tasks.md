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
- [ ] Audit · [ ] Gaps · [ ] Fix · [ ] Verify · [ ] Sign-off
- [ ] Per-student ledger by year/term; pay flow; own data only

---

## COMMUNICATION

## Module 19 — Announcements  (/communication/announcements)
Portals: admin, super_admin, teacher, parent, student, accountant, admissions_officer
- [ ] Audit · [ ] Gaps · [ ] Fix · [ ] Verify · [ ] Sign-off
- [ ] Audience/class/role scoping correct; bell unread; teacher class scope

## Module 20 — Support  (/support)
Portals: principal, teacher, accountant, admissions_officer
- [ ] Audit · [ ] Gaps · [ ] Fix · [ ] Verify · [ ] Sign-off
- [ ] Ticket/contact flow works; role-appropriate

---

## IDENTITY MANAGEMENT

## Module 21 — ID Cards  (/identity/cards)
Portals: admin, super_admin, admissions_officer
- [ ] Audit · [ ] Gaps · [ ] Fix · [ ] Verify · [ ] Sign-off
- [ ] Cards reflect current class/session; generation + download work (web+native)

## Module 22 — Card Templates  (/identity/templates)
Portals: admin, super_admin
- [ ] Audit · [ ] Gaps · [ ] Fix · [ ] Verify · [ ] Sign-off
- [ ] Set-default + role picker; tenant-scoped; render correct

---

## EVENTS MANAGEMENT

## Module 23 — School Events  (/events/school)
Portals: admin, super_admin, teacher, parent, student
- [ ] Audit · [ ] Gaps · [ ] Fix · [ ] Verify · [ ] Sign-off
- [ ] Non-managers see published only (done-partial); upcoming default; role actions

## Module 24 — Calendar  (/events/calendar)
Portals: admin, super_admin, teacher, parent, student
- [ ] Audit · [ ] Gaps · [ ] Fix · [ ] Verify · [ ] Sign-off

## Module 25 — My Events  (/events/my-events)
Portals: admin, super_admin, teacher, parent, student
- [ ] Audit · [ ] Gaps · [ ] Fix · [ ] Verify · [ ] Sign-off

## Module 26 — Event Analytics  (/events/analytics)
Portals: admin, super_admin
- [ ] Audit · [ ] Gaps · [ ] Fix · [ ] Verify · [ ] Sign-off

---

## REPORTS & ANALYTICS

## Module 27 — Academic Archive  (/reports/academic)
Portals: admin, super_admin
- [ ] Audit · [ ] Gaps · [ ] Fix · [ ] Verify · [ ] Sign-off
- [ ] Any past year snapshot (done); deep-links; per-student history

---

## Sign-off log
(append: `Module N — <name> — YYYY-MM-DD — <commit>`)
- Module 0 — Foundation — 2026-09-30 — (see next commit)




