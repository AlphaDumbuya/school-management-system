# WiSkul — Page Build Order Roadmap

> **Purpose**: Every page in the app audited and ordered by dependency. Build from top to bottom.
> 
> **Key**: ✅ Fully built & live data | 🟧 Built but V2-gated (code exists, hidden behind `V2_ENABLED = false`) | 🔴 `ComingSoon` placeholder — not yet built
>
> **Last Updated**: September 2026 — Full audit against actual codebase.

---

## V1 Sidebar Module Map

The V1 admin sidebar exposes exactly these modules and pages:

| Module | Pages |
|--------|-------|
| **Dashboard** | Role-based dashboard (Admin, Teacher, Student, Parent, Accountant, Admissions, Super Admin) |
| **Academic** | Classes & Streams, Subjects, Timetables, Assignments, Exam Timetable, Results & Grades, Report Cards, Promotions |
| **Students** | Student Directory, Admissions, Student Profiles, Attendance, Discipline & Conduct |
| **Staff** | Teachers |
| **Finance** | Fee Structures, Invoices, Payments & Receipts |
| **Communication** | Announcements, Support |
| **Identity** | ID Cards, Card Templates |
| **Events** | School Events, Calendar, My Events, Event Analytics |
| **Footer** | Guide & Help, Settings |

---

## Current State of All Pages

| Page | Route | Status | Notes |
|---|---|---|---|
| Landing Page | `/` | ✅ Done | Public marketing page |
| Features Page | `/features` | ✅ Done | Public marketing page |
| Pricing Page | `/pricing` | ✅ Done | Public marketing page |
| Why WiSkul | `/why` | ✅ Done | Public marketing page |
| Benefits Page | `/benefits` | ✅ Done | Public marketing page |
| Contact Page | `/contact` | ✅ Done | Email sending works (Brevo + platform inbox) |
| Login Page | `/login` | ✅ Done | Auth working, 2FA, passkeys |
| Register Page | `/register` | ✅ Done | Self-service school onboarding |
| Welcome / Onboarding | `/welcome` | ✅ Done | App-mode one-time guide |
| Forgot Password | `/forgot-password` | ✅ Done | |
| Reset Password | `/reset-password` | ✅ Done | |
| Privacy Policy | `/privacy-policy` | ✅ Done | |
| Newsletter Unsubscribe | `/newsletter/unsubscribe` | ✅ Done | |
| Restore Access | `/restore-access` | ✅ Done | Public Monime payment for suspended schools |
| Request Reactivation | `/request-reactivation` | ✅ Done | Public reactivation request |
| Verify ID | `/verify-id` | ✅ Done | Public QR code verification |
| Admin Dashboard | `/admin/dashboard` | ✅ Done | Live data, KPIs populate from DB |
| Teachers Page | `/staff/teachers` | ✅ Done | Full CRUD, list/grid, promotion modal |
| Classes Page | `/academic/classes` | ✅ Done | Full CRUD |
| Subjects Page | `/academic/subjects` | ✅ Done | Full CRUD |
| Timetables Page | `/academic/timetables` | ✅ Done | Scheduling, conflict detection |
| Assignments Page | `/academic/assignments` | ✅ Done | CRUD done |
| Exam Timetable Page | `/academic/exam-timetable` | ✅ Done | CRUD done |
| Results Page | `/academic/results` | ✅ Done | Grading, bulk entry, SL scale, KPIs |
| Report Cards Page | `/academic/report-cards` | ✅ Done | SL booklet PDF, affective/psychomotor domains |
| Promotions Page | `/academic/promotions` | ✅ Done | Promote/repeat/graduate workflow |
| Attendance Page | `/students/attendance` | ✅ Done | Mark/view, bulk, analytics, offline-capable |
| Student Directory | `/students/directory` | ✅ Done | Listing, search, filter |
| Student Profiles | `/students/profiles` | ✅ Done | Profile mgmt, transcript, portal creds |
| Admissions Page | `/students/admissions` | ✅ Done | Application workflow, import |
| Discipline Page | `/discipline` | ✅ Done | Infractions, detention, appeals, conduct reports |
| Events Page | `/events/school` | ✅ Done | Event listing |
| Event Details | `/events/school/:id` | ✅ Done | Single event, registration |
| Calendar Page | `/events/calendar` | ✅ Done | Calendar view |
| My Events | `/events/my-events` | ✅ Done | User's registered events |
| Event Analytics | `/events/analytics` | ✅ Done | Event insights |
| ID Cards Page | `/identity/cards` | ✅ Done | Card generation, batch printing |
| Templates Page | `/identity/templates` | ✅ Done | Card template designer |
| Fees Page | `/finance/fees` | ✅ Done | Fee structures, assign to class/student |
| Invoices Page | `/finance/invoices` | ✅ Done | Generate, track, send |
| Payments Page | `/finance/payments` | ✅ Done | Record, Monime hosted checkout |
| Payment Return | `/finance/pay/return` | ✅ Done | Post-Monime checkout landing |
| Announcements Page | `/communication/announcements` | ✅ Done | Create, broadcast, schedule |
| Settings Page | `/settings` | ✅ Done | 8 config tabs + 2FA + storage + offline |
| Support Page | `/support` | ✅ Done | Help topics + ticket system |
| Support Topic | `/support/:topicId` | ✅ Done | Topic detail + reply |
| Guide Page | `/guide` | ✅ Done | Platform guide for all roles |
| Sync Issues | `/sync-issues` | ✅ Done | Offline sync conflict resolution |
| Verification Page | `/verify-school` | ✅ Done | School identity verification |
| Tenants Page | `/platform/tenants` | ✅ Done | Tenant CRUD, suspend/reactivate |
| Tenant Detail | `/platform/tenants/:id` | ✅ Done | Users, billing, backup, email config |
| Subscriptions | `/platform/subscriptions` | ✅ Done | Plan management, billing |
| Platform Analytics | `/platform/analytics` | ✅ Done | Growth, revenue, usage |
| Platform Comms | `/platform/communications` | ✅ Done | Newsletter, broadcast |
| Platform Support | `/platform/support` | ✅ Done | Support ticket triage |
| Super Admin Dashboard | `/platform/dashboard` | ✅ Done | Live platform data |
| Teacher Dashboard | `/teacher/dashboard` | ✅ Done | Live API data |
| Student Dashboard | `/student/dashboard` | ✅ Done | Live API data |
| Parent Dashboard | `/parent/dashboard` | ✅ Done | Live API data |
| Accountant Dashboard | `/accountant/dashboard` | ✅ Done | Live API data |
| Admissions Dashboard | `/admissions/dashboard` | ✅ Done | Live API data |
| Staff Members | `/staff/members` | 🔴 Coming Soon | V2-gated. Backend not built. |
| Staff Leave | `/staff/leave` | 🔴 Coming Soon | V2-gated. Backend not built. |
| Staff Performance | `/staff/performance` | 🔴 Coming Soon | V2-gated. Backend not built. |
| Expenses | `/finance/expenses` | 🔴 Coming Soon | V2-gated. Backend not built. |
| Payroll | `/finance/payroll` | 🔴 Coming Soon | V2-gated. Backend not built. |
| Scholarships | `/finance/scholarships` | 🔴 Coming Soon | V2-gated. Backend not built. |
| Messages | `/communication/messages` | 🔴 Coming Soon | V2-gated. Backend not built. |
| Email Manager | `/communication/email` | 🔴 Coming Soon | V2-gated. Backend (Brevo) exists, frontend not built. |
| QR Codes | `/identity/qr-codes` | 🔴 Coming Soon | V2-gated. Backend exists, frontend not built. |
| Academic Reports | `/reports/academic` | 🔴 Coming Soon | V2-gated. Backend exists, frontend not built. |
| Financial Reports | `/reports/financial` | 🔴 Coming Soon | V2-gated. Backend exists, frontend not built. |
| Attendance Reports | `/reports/attendance` | 🔴 Coming Soon | V2-gated. Backend exists, frontend not built. |
| Enrollment Reports | `/reports/enrollment` | 🔴 Coming Soon | V2-gated. Backend exists, frontend not built. |
| Discipline Reports | `/reports/discipline` | 🔴 Coming Soon | V2-gated. Backend exists, frontend not built. |
| Profile | `/profile` | 🔴 Coming Soon | Not V2-gated — needs to be built for V1. Backend exists. |
| Legacy `/students` | `/students` | 🔴 Coming Soon | Should redirect to `/students/directory`. Fix needed. |

---

## Build Order

Pages are ordered by **dependency and importance**. Each group must be completed before the next group starts, because later pages depend on earlier ones being functional.

> **Updated September 2026**: Phases 0, B (fees/invoices/payments), C (all dashboards wired), E1 (announcements), F (report cards/promotions), and I (platform management) are **complete**. The remaining work is Phase A (profile page) and V2-scoped phases.

---

### PHASE 0 — School Setup ✅ COMPLETE

#### 0.1 — School Setup & Settings Page `/settings` ✅ DONE

**Status**: Fully built. `SettingsPage.tsx` has all 8 config tabs plus 2FA, storage, and offline preferences.

| Setting | Affects |
|---|---|  
| School name & logo | Every page header, ID cards, report cards, emails |
| Academic year & terms | Grades, exams, attendance, timetables, results |
| Grading scale (A=90%, B=80%) | Results page, report cards, student dashboard |
| **ID number format** (STU-2026-001) | Every student/staff ID generated |
| Currency (NLe, USD) | All fee pages, accountant dashboard, invoices |
| Passing grade threshold (e.g. 40%) | Grade warnings, at-risk detection |
| Min attendance % threshold (e.g. 75%) | Attendance warnings, dashboard alerts |
| Term dates (start/end per term) | Academic calendar, exam scheduling |
| School time zone | All timestamps, timetables, scheduling |
| Late arrival cutoff time | Attendance marking (present vs late) |
| Max class size | Admissions capacity alerts |
| Branding colors | ID card backgrounds, email headers |
| School address, phone, email | All communications, ID cards, report cards |
| Principal/head teacher name | Report cards, official letters |

**Backend**: `phase15SchoolConfigService.ts` + `school_config_settings` table ✅, `phase15GradingConfigService.ts` + `grading_scales` table ✅

---

### PHASE A — Foundation 🔴 STILL NEEDED

#### A1 — Profile Page `/profile` 🔴 Coming Soon

**Why needed**: Every user should be able to view and edit their own profile (name, phone, avatar, password). Currently renders `<ComingSoonPage />`.

**What to build**:
- View own profile (name, email, role, avatar, school)
- Edit name, phone, avatar upload
- Change password form (old + new + confirm)
- Last login info, session management

**Backend ready**: `PATCH /api/v1/users/:id` ✅

> **Note**: The `SettingsPage.tsx` already has some profile editing logic (it manages user profile data). The `/profile` route could be a lighter-weight version or the Settings page could be split.

---

### PHASE B — Financial Core ✅ COMPLETE (V1 scope)

#### B1 — Fees Management `/finance/fees` ✅ DONE
#### B2 — Invoices Page `/finance/invoices` ✅ DONE
#### B3 — Payments Page `/finance/payments` ✅ DONE (with Monime hosted checkout)

#### B4 — Expenses Page `/finance/expenses` 🔴 V2-gated (backend not built)
#### B5 — Payroll Page `/finance/payroll` 🔴 V2-gated (backend not built)
#### B6 — Scholarships Page `/finance/scholarships` 🔴 V2-gated (backend not built)

---

### PHASE C — All Dashboards ✅ COMPLETE

All 7 dashboards are built and pulling live data from the API. No mock data remains.

| Dashboard | Status |
|-----------|--------|
| C1 — Admin (Principal) Dashboard | ✅ Live data |
| C2 — Accountant Dashboard | ✅ Live data |
| C3 — Admissions Dashboard | ✅ Live data |
| C4 — Teacher Dashboard | ✅ Live data |
| C5 — Student Dashboard | ✅ Live data |
| C6 — Parent Dashboard | ✅ Live data |
| C7 — Super Admin Dashboard | ✅ Live data |

---

### PHASE D — Staff Management 🔴 V2-gated (not built)

#### D1 — Staff Members Page `/staff/members` 🔴
#### D2 — Staff Leave Page `/staff/leave` 🔴
#### D3 — Staff Performance Page `/staff/performance` 🔴

All three render `<ComingSoonPage />` and are V2-gated. Backend services do not exist yet. Only Teacher Profiles (`/staff/teachers`) is in V1.

---

### PHASE E — Communication Hub (partially complete)

#### E1 — Announcements Page `/communication/announcements` ✅ DONE

Create, broadcast, schedule announcements. Fully operational.

#### E2 — Messages Page `/communication/messages` 🔴 V2-gated (backend not built)
#### E3 — Email Manager `/communication/email` 🔴 V2-gated (backend exists, frontend not built)

---

### PHASE F — Academic Completions ✅ COMPLETE

#### F1 — Report Cards Page `/academic/report-cards` ✅ DONE

SL booklet-style PDF report card generation with affective domain (12 traits), psychomotor domain (12 skills), automated attendance, teacher comments, and promotion status.

#### F2 — Promotions Page `/academic/promotions` ✅ DONE

End-of-year promotion workflow with promote/repeat/graduate, bulk promote, criteria setting.

---

### PHASE G — Reports & Analytics 🔴 V2-gated (frontend not built, backend exists)

#### G1 — Academic Reports `/reports/academic` 🔴 (backend: `reportingService.ts` ✅)
#### G2 — Financial Reports `/reports/financial` 🔴 (backend: finance analytics ✅)
#### G3 — Attendance Reports `/reports/attendance` 🔴 (backend: attendance analytics ✅)
#### G4 — Enrollment Reports `/reports/enrollment` 🔴 (backend: admissions stats ✅)
#### G5 — Discipline Reports `/reports/discipline` 🔴 (backend: `disciplineAnalyticsService.ts` ✅)

All 5 report pages render `<ComingSoonPage />` and are V2-gated. The backend services exist — only the frontend pages need to be built.

---

### PHASE H — Identity Extras 🔴 V2-gated (frontend not built, backend exists)

#### H1 — QR Codes Page `/identity/qr-codes` 🔴 (backend: `idCardService.ts` QR logic ✅, `VerifyIdPage.tsx` live ✅)

Batch QR code management page needs building. QR verification is already live at `/verify-id`.

---

### PHASE I — Platform Management ✅ COMPLETE

#### I1 — Tenants Page `/platform/tenants` ✅ DONE
#### I2 — Subscriptions Page `/platform/subscriptions` ✅ DONE
#### I3 — Platform Analytics `/platform/analytics` ✅ DONE
Plus: Platform Communications ✅, Platform Support ✅, Tenant Detail ✅

---

### PHASE J — Email Templates (Pillar 1 from FEATURE_ROADMAP.md)

**Status**: 8 HTML templates already exist in `backend/src/services/email-templates/`. The full template library (60+ templates per the roadmap) and the email composer frontend (`/communication/email`) are V2 scope.

### PHASE K — AI Dashboard Analysis (Pillar 2 from FEATURE_ROADMAP.md)

**Status**: Not started. V2 scope.

---

## Complete Build Order Summary (Updated Sep 2026)

```
PHASE 0  →  Settings Page                    ✅ DONE
    ↓
PHASE A  →  Profile Page                     🔴 NEEDED (V1 gap)
    ↓
PHASE B  →  Fees, Invoices, Payments          ✅ DONE
            Expenses, Payroll, Scholarships   🔴 V2-gated
    ↓
PHASE C  →  Wire ALL dashboards to live data  ✅ DONE
    ↓
PHASE D  →  Staff Members, Leave, Performance 🔴 V2-gated
    ↓
PHASE E  →  Announcements                     ✅ DONE
            Messages, Email Manager          🔴 V2-gated
    ↓
PHASE F  →  Report Cards, Promotions         ✅ DONE
    ↓
PHASE G  →  Academic, Financial, Attendance,  🔴 V2-gated
            Enrollment, Discipline Reports      (backend ready, frontend needed)
    ↓
PHASE H  →  QR Codes                         🔴 V2-gated
                                              (backend ready, frontend needed)
    ↓
PHASE I  →  Tenants, Subscriptions,          ✅ DONE
            Platform Analytics, Comms, Support
    ↓
PHASE J  →  Email Templates (full library)   V2 scope
    ↓
PHASE K  →  AI Dashboard Analysis            V2 scope
```

---

## Total Page Count (Updated Sep 2026)

| Status | Count |
|---|---|
| ✅ Fully done & live | 70+ pages |
| 🔴 Coming Soon — V2 scope (backend exists, frontend needed) | 7 pages |
| 🔴 Coming Soon — V2 scope (full stack needed) | 6 pages |
| 🔴 Coming Soon — V1 gap (needs building now) | 2 pages |
| **Total routes** | **85+** |

### V1 Remaining Work (2 items)

| Page | Route | Effort | Backend Ready? |
|------|-------|--------|-----------------|
| Profile | `/profile` | ~2 hrs | ✅ Yes |
| Legacy students redirect | `/students` | ~1 min | N/A |

### Settings Page Tabs (Phase 0)

| Tab | Critical Before | Status |
|---|---|---|
| School Information | ID cards, report cards, emails | ✅ |
| Academic Configuration | All academic modules | ✅ |
| **ID Number Format** | Every student/teacher ID | ✅ |
| Grading Scale | Results, report cards, at-risk alerts | ✅ |
| Attendance Rules | Attendance page, dashboard warnings | ✅ |
| Financial Configuration | ALL finance pages | ✅ |
| Communications | All emails | ✅ |
| Branding | ID cards, email headers | ✅ |

> **Rule**: A school cannot fully use any other feature until Phase 0 is complete. ✅ Phase 0 is complete.

