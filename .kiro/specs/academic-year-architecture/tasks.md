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

## Module 1 — Classes & Streams  (/academic/classes)
Portals: admin, super_admin, teacher, admissions_officer
- [ ] Audit · [ ] Gaps · [ ] Fix · [ ] Verify · [ ] Sign-off
- [ ] Classes are session-scoped; list can filter by year; active session default
- [ ] Teacher sees only assigned/led classes (current year)
- [ ] Create/edit binds to active session; no cross-year duplicate collisions

## Module 2 — Subjects  (/academic/subjects)
Portals: admin, super_admin, teacher, admissions_officer, student, parent
- [ ] Audit · [ ] Gaps · [ ] Fix · [ ] Verify · [ ] Sign-off
- [ ] Tenant-scoped catalog correct; student/parent see own class subjects
- [ ] Per-tenant code uniqueness (no global collision)

## Module 3 — Timetables  (/academic/timetables)
Portals: admin, super_admin, teacher, admissions_officer, student, parent
- [ ] Audit · [ ] Gaps · [ ] Fix · [ ] Verify · [ ] Sign-off
- [ ] Schedules scoped to current session's classes; student/parent see own class

## Module 4 — Assignments  (/academic/assignments)
Portals: admin, super_admin, teacher, student, parent/guardian
- [ ] Audit · [ ] Gaps · [ ] Fix · [ ] Verify · [ ] Sign-off
- [ ] Assignments scoped to class/current year; teacher-owned; student sees own class

## Module 5 — Exam Timetable  (/academic/exam-timetable)
Portals: admin, super_admin, teacher, student, parent, admissions_officer
- [ ] Audit · [ ] Gaps · [ ] Fix · [ ] Verify · [ ] Sign-off
- [ ] Exams keyed by academic_year; current-year default; history selectable

## Module 6 — Results & Grades  (/academic/results)
Portals: admin, super_admin, teacher, student, parent, admissions_officer
- [ ] Audit · [ ] Gaps · [ ] Fix · [ ] Verify · [ ] Sign-off
- [ ] Real year picker; results keyed by year+class; publish-gate for non-staff
- [ ] Teacher scope to assigned subjects/classes

## Module 7 — Report Cards  (/academic/report-cards)
Portals: admin, super_admin, teacher, student, parent, admissions_officer
- [ ] Audit · [ ] Gaps · [ ] Fix · [ ] Verify · [ ] Sign-off
- [ ] Year + class picker from real sessions; past years retrievable
- [ ] Student/parent auto-resolve own; publish-gated

## Module 8 — Promotions  (/academic/promotions)
Portals: admin, super_admin
- [ ] Audit · [ ] Gaps · [ ] Fix · [ ] Verify · [ ] Sign-off
- [ ] From/To clear; real year; non-destructive; idempotent; reversible path
- [ ] Fresh candidates (no stale "Recorded")

---

## STUDENT MANAGEMENT

## Module 9 — Student Directory  (/students/directory)
Portals: admin, super_admin, teacher, admissions_officer
- [ ] Audit · [ ] Gaps · [ ] Fix · [ ] Verify · [ ] Sign-off
- [ ] Current class from latest active enrollment; teacher scope; year-aware where relevant

## Module 10 — Admissions  (/students/admissions)
Portals: admin, super_admin, admissions_officer
- [ ] Audit · [ ] Gaps · [ ] Fix · [ ] Verify · [ ] Sign-off
- [ ] Applications keyed by academic_year; enroll targets active session

## Module 11 — Student Profiles  (/students/profiles)
Portals: admin, super_admin, teacher, admissions_officer
- [ ] Audit · [ ] Gaps · [ ] Fix · [ ] Verify · [ ] Sign-off
- [ ] Overview/academics/attendance/conduct/billing tabs year-aware
- [ ] Attendance tab scoped to current year/term (not lifetime); fix KPI key mismatch

## Module 12 — Attendance  (/students/attendance)
Portals: admin, super_admin, teacher, parent, student
- [ ] Audit · [ ] Gaps · [ ] Fix · [ ] Verify · [ ] Sign-off
- [ ] Register scoped to class + current session; summaries year/term scoped
- [ ] Teacher scope; parent/student own records

## Module 13 — Discipline & Conduct  (/discipline)
Portals: admin, super_admin, teacher
- [ ] Audit · [ ] Gaps · [ ] Fix · [ ] Verify · [ ] Sign-off
- [ ] Records tenant/student scoped; year context where relevant; teacher scope

---

## STAFF MANAGEMENT

## Module 14 — Teachers  (/staff/teachers)
Portals: admin, super_admin
- [ ] Audit · [ ] Gaps · [ ] Fix · [ ] Verify · [ ] Sign-off
- [ ] Tenant-scoped; assignments reflect current session's classes

## Module 15 — Teacher Attendance  (/staff/attendance)
Portals: principal, teacher
- [ ] Audit · [ ] Gaps · [ ] Fix · [ ] Verify · [ ] Sign-off
- [ ] Staff attendance scoped by date/session; teacher self, principal all

---

## FINANCIAL MANAGEMENT

## Module 16 — Fee Structures  (/finance/fees)
Portals: admin, super_admin, accountant
- [ ] Audit · [ ] Gaps · [ ] Fix · [ ] Verify · [ ] Sign-off
- [ ] Real year picker (done-partial); structures keyed by year; KPIs year-scoped

## Module 17 — Payments & Receipts  (/finance/payments)
Portals: admin, super_admin, accountant
- [ ] Audit · [ ] Gaps · [ ] Fix · [ ] Verify · [ ] Sign-off
- [ ] Payments/ledger year-scoped; balances reflect selected year

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
