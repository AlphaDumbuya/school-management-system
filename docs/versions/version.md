# School Management System — Versioning & Release Roadmap

> **Document Status**: Active — Updated September 2026
> **Current Focus**: **Version 1.0.0 — Near-Complete, in final hardening**
> **Parent Location**: `docs/versions/version.md`

---

## 🎯 Executive Strategy & Core Principle

The primary objective is to make **Version 1.0.0 fully complete, battle-tested, and 100% operational for real-world school deployment** while establishing a clean foundation to build **Version 2.0.0** incrementally.

To maintain a flawless user experience:
1. **Zero Half-Baked Features**: Unfinished or deferred features must **NOT** appear in v1.0.0.
2. **Strict UI Navigation Filtering**: All v2.0.0 menu options, links, and pages are strictly hidden/restricted from the v1.0.0 frontend interface via `V2_ENABLED = false` in [routes.tsx](../../frontend/src/router/routes.tsx) and conditional filtering in [Sidebar.tsx](../../frontend/src/components/layout/Sidebar.tsx).
3. **V2 Route Gate**: The `V2Route` wrapper component in `routes.tsx` automatically redirects any V2-gated URL to `/dashboard` when `V2_ENABLED` is `false`, ensuring users never see an incomplete page even if they type the URL directly.

---

## 📦 Version 1.0.0 (MVP Core Release Scope)

Version 1.0.0 focuses on everyday school operations, student enrollment, attendance tracking, classroom management, financial management, identity/events management, and in-app communication.

The V1 sidebar navigation is organized into the following modules:

### V1 Sidebar Module Map

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

### 1. Multi-Role Authentication & Access Control (RBAC)
- Multi-tenant architecture (School Isolation).
- Role-based access for SuperAdmin, Principal, Teacher, Student, Parent, Accountant, and Admissions Officer.
- Secure JWT-based session management and protected routes ([ProtectedRoute.tsx](../../frontend/src/router/ProtectedRoute.tsx)).
- 2FA / Passkeys ([TwoFactorSettings.tsx](../../frontend/src/components/settings/TwoFactorSettings.tsx)).
- School Verification ([VerificationPage.tsx](../../frontend/src/pages/VerificationPage.tsx)).
- Account Restoration for suspended schools ([RestoreAccessPage.tsx](../../frontend/src/pages/RestoreAccessPage.tsx)).

### 2. Academic Operations
- **Classes & Streams**: Grade management, section allocation ([ClassesPage.tsx](../../frontend/src/pages/academic/ClassesPage.tsx)).
- **Subjects**: Subject allocation per class ([SubjectsPage.tsx](../../frontend/src/pages/academic/SubjectsPage.tsx)).
- **Timetables**: Weekly class schedule setup with conflict detection ([TimetablesPage.tsx](../../frontend/src/pages/academic/TimetablesPage.tsx)).
- **Assignments**: Homework creation, instructions, and student assignment tracking ([AssignmentsPage.tsx](../../frontend/src/pages/academic/AssignmentsPage.tsx)).
- **Exam Timetable**: Exam schedule setup and venue allocation ([ExamTimetablePage.tsx](../../frontend/src/pages/academic/ExamTimetablePage.tsx)).
- **Results & Grades**: Full grade entry (single + bulk), automated score calculation, SL grading scale, KPI analytics, transcript management ([ResultsPage.tsx](../../frontend/src/pages/academic/ResultsPage.tsx)).
- **Report Cards**: Sierra Leone booklet-style PDF with affective domain (12 traits), psychomotor domain (12 skills), attendance, teacher comments, promotion status ([ReportCardsPage.tsx](../../frontend/src/pages/academic/ReportCardsPage.tsx)).
- **Promotions**: End-of-year promote/repeat/graduate workflow ([PromotionsPage.tsx](../../frontend/src/pages/academic/PromotionsPage.tsx)).

### 3. Student Management
- **Student Directory**: Search, filter, and view registered students ([StudentDirectoryPage.tsx](../../frontend/src/pages/students/StudentDirectoryPage.tsx)).
- **Admissions**: Application submission, review, approval, and student onboarding with auto-provisioned portal credentials for student + parent ([AdmissionsPage.tsx](../../frontend/src/pages/students/AdmissionsPage.tsx)).
- **Student Profiles**: Detailed bio, academic placement, guardian details, portal credentials, transcript, and results history ([StudentProfilesPage.tsx](../../frontend/src/pages/students/StudentProfilesPage.tsx)).
- **Attendance**: Daily attendance marking (offline-capable for teachers), bulk mark, analytics, at-risk flagging ([AttendancePage.tsx](../../frontend/src/pages/students/AttendancePage.tsx)).
- **Discipline & Conduct**: Behavioural incident logging, infractions, detention scheduling, conduct reports, appeal workflows ([DisciplinePage.tsx](../../frontend/src/pages/discipline/DisciplinePage.tsx)).

### 4. Staff Management
- **Teachers**: Teacher registration, subject assignments, department categorization, promotion modal ([TeachersPage.tsx](../../frontend/src/pages/staff/TeachersPage.tsx)).

### 5. Financial Management (Monime)
Covers the full fee lifecycle plus online payments via **Monime** (Sierra Leone mobile money, card, bank, and digital wallet in one checkout).
- **Fee Structures**: Configure fees by type/class/term; bill students ([FeesPage.tsx](../../frontend/src/pages/finance/FeesPage.tsx)).
- **Invoices**: Generate invoices, track paid/partial/overdue balances, issue receipts ([InvoicesPage.tsx](../../frontend/src/pages/finance/InvoicesPage.tsx)).
- **Payments & Receipts**: Record payments, Monime hosted checkout, webhooks reconcile payment status automatically ([PaymentsPage.tsx](../../frontend/src/pages/finance/PaymentsPage.tsx), [PaymentReturnPage.tsx](../../frontend/src/pages/finance/PaymentReturnPage.tsx)).
- Portal billing tabs: Student & parent dashboards show outstanding balance, invoices, and a one-tap pay button.

### 6. Communication
- **Announcements**: Create and broadcast announcements to all/teachers/parents/students/class, with scheduling ([AnnouncementsPage.tsx](../../frontend/src/pages/communication/AnnouncementsPage.tsx)).
- **Support**: Browse help topics, submit support tickets; super admin can triage across tenants ([SupportPage.tsx](../../frontend/src/pages/SupportPage.tsx), [SupportTopicPage.tsx](../../frontend/src/pages/SupportTopicPage.tsx)).

### 7. Identity Management
- **ID Cards**: Student and staff ID card generation with batch printing and PDF export ([IdCardsPage.tsx](../../frontend/src/pages/identity/IdCardsPage.tsx)).
- **Card Templates**: Visual template designer with branding, photo, QR code ([TemplatesPage.tsx](../../frontend/src/pages/identity/TemplatesPage.tsx)).

### 8. Events Management
- **School Events**: Event listing, creation, registration ([EventsPage.tsx](../../frontend/src/pages/events/EventsPage.tsx)).
- **Calendar**: Calendar view of all school events ([CalendarPage.tsx](../../frontend/src/pages/events/CalendarPage.tsx)).
- **My Events**: User's registered events ([MyEventsPage.tsx](../../frontend/src/pages/events/MyEventsPage.tsx)).
- **Event Analytics**: Event insights, attendance, registration stats ([EventAnalyticsPage.tsx](../../frontend/src/pages/events/EventAnalyticsPage.tsx)).

### 9. Settings (School Configuration)

The Settings page is the configuration backbone of the entire app. It is organized into the following tabs:

| Tab | What It Controls |
|-----|-----------------|
| **School Information** | School name, logo, address, phone, email, registration number, principal name |
| **Academic Configuration** | Academic year, terms per year, term start/end dates, class naming convention, max class size |
| **Grading Scale** | Grade boundaries (A/B/C/D/F), GPA weights, passing threshold, display format |
| **Attendance Rules** | Min attendance % for warning/critical alert, late arrival cutoff, attendance unit (days/periods) |
| **Financial Configuration** | Currency code & symbol, display format, late fee policy, payment methods, invoice due date |
| **Communications** | School email, email footer text, notification defaults per event type |
| **Branding** | Primary color, secondary color, school letterhead preview |
| **Security (2FA)** | Two-factor authentication enrollment, passkey management |

### 10. SuperAdmin & Platform Management
- **Tenant Management**: Create, suspend, reactivate schools ([PlatformTenantsPage.tsx](../../frontend/src/pages/PlatformTenantsPage.tsx), [TenantDetailPage.tsx](../../frontend/src/pages/TenantDetailPage.tsx)).
- **Subscriptions**: Plan management and billing ([PlatformSubscriptionsPage.tsx](../../frontend/src/pages/PlatformSubscriptionsPage.tsx)).
- **Platform Analytics**: Growth, revenue, usage metrics ([PlatformAnalyticsPage.tsx](../../frontend/src/pages/PlatformAnalyticsPage.tsx)).
- **Communications**: Newsletter, broadcast to all tenants ([PlatformCommunicationPage.tsx](../../frontend/src/pages/PlatformCommunicationPage.tsx)).
- **Support Triage**: Support ticket triage across all tenants ([PlatformSupportPage.tsx](../../frontend/src/pages/PlatformSupportPage.tsx)).

### 11. Offline-First PWA & Mobile
- **Progressive Web App**: Full offline support for teachers — mark attendance, view classes, sync when online ([SyncIssuesPage.tsx](../../frontend/src/pages/offline/SyncIssuesPage.tsx), 12 offline component files).
- **Capacitor Android Build**: Native Android app shell ([frontend/android/](../../frontend/android/)).

### 12. Public Marketing & Self-Service Onboarding
- **Self-Service Onboarding** ([RegisterPage.tsx](../../frontend/src/pages/RegisterPage.tsx)): School principals can self-register their school workspace via `/register`.
- **Plan Hierarchy & Capacity Limits**:
  - **Freetong (v1.0 Free Core)**: NLe 0 / Free Forever — Up to 250 Students & 20 Staff. Includes all operational v1.0.0 core features.
  - **Combra (v2.0 Pro)**: NLe 500 / mo — Up to 1,000 Students & 75 Staff. Unlocks Payroll, Expense Tracking, and Staff HR & Leave.
  - **Bintumani (v3.0 Enterprise)**: NLe 1,200 / mo — Unlimited Students & Staff. Unlocks Dedicated Support and SLA.
- **Marketing Pages**: [FeaturesPage.tsx](../../frontend/src/pages/FeaturesPage.tsx), [PricingPage.tsx](../../frontend/src/pages/PricingPage.tsx), [LandingPage.tsx](../../frontend/src/pages/LandingPage.tsx).

---

## 🚫 Deferred from v1.0.0 (V2.0.0 Scope)

The following modules are **built in code** but **V2-gated** via `V2_ENABLED = false` in `routes.tsx`. They are intentionally hidden from v1.0.0 users to ensure a clean, polished experience. Setting `V2_ENABLED = true` will immediately expose them.

> **Note**: SMS & WhatsApp messaging has been **completely removed** from the product. In-app communication (Announcements + Support tickets) replaces this functionality in V1.

1. ❌ **Staff HR (Members, Leave, Performance)** — **Not built**:
   - `/staff/members`, `/staff/leave`, `/staff/performance` render `<ComingSoonPage />`.
   - Only `/staff/teachers` (Teacher Profiles) is part of v1.0.0.
   - Backend services for staff leave/performance do not yet exist.

2. ❌ **Payroll & Expense Tracking** — **Not built**:
   - `/finance/expenses`, `/finance/payroll`, `/finance/scholarships` render `<ComingSoonPage />`.
   - Fee management, invoicing, and payments are in v1.0.0 (see §5.1). Only payroll and standalone expense tracking remain deferred.

3. ❌ **Internal In-App Messaging & Email Composer** — **Not built**:
   - `/communication/messages` (direct messaging) renders `<ComingSoonPage />`.
   - `/communication/email` (email broadcast composer) renders `<ComingSoonPage />`.
   - Note: The email *sending infrastructure* (Brevo) and 8 HTML templates exist in the backend — only the frontend composer UI is missing.
   - Note: School-wide communication is handled via Announcements (V1) and Support tickets (V1).

4. ❌ **Advanced Reports & Analytics** — **Frontend not built (backend exists)**:
   - `/reports/academic`, `/reports/financial`, `/reports/attendance`, `/reports/enrollment`, `/reports/discipline` all render `<ComingSoonPage />`.
   - Backend services exist: `reportingService.ts`, `analyticsService.ts`, `disciplineAnalyticsService.ts`.
   - These need frontend pages to surface the data.

5. ❌ **QR Code Batch Management** — **Frontend not built (backend exists)**:
   - `/identity/qr-codes` renders `<ComingSoonPage />`.
   - QR verification backend exists (`VerifyIdPage.tsx` is live). Only the batch management UI is missing.

6. ❌ **User Profile Page** — **Not built**:
   - `/profile` renders `<ComingSoonPage />`.
   - Backend endpoint `PATCH /api/v1/users/:id` exists. Needs a simple frontend form.

---

## 🔒 Sidebar & Router Restriction Policy (v1.0.0 UI Protection)

To guarantee that v1.0.0 users do **NOT** see broken, empty, or unreleased pages:

1. **Sidebar Navigation Filtering ([Sidebar.tsx](../../frontend/src/components/layout/Sidebar.tsx))**:
   - Navigation links corresponding to V2.0.0 features (**Staff Leave/HR**, **Payroll/Expenses**, **In-App Messages**, **Advanced Reports**) are conditionally hidden in v1.0.0 builds.
   - **Results & Grades (`/academic/results`)**, **Report Cards (`/academic/report-cards`)**, **Promotions (`/academic/promotions`)**, **Finance (`/finance/fees`, `/finance/invoices`, `/finance/payments`)**, **Announcements**, **Discipline**, **Events**, **ID Cards**, and **Settings** are fully accessible in v1.0.0 builds.

2. **Route Guarding ([routes.tsx](../../frontend/src/router/routes.tsx))**:
   - The `V2Route` wrapper component checks `V2_ENABLED` (currently `false`). Direct navigation attempts to V2.0.0 URLs (e.g. typing `/finance/payroll`, `/communication/messages`, or `/reports/academic` in the address bar) will automatically redirect to `/dashboard`.
   - Two routes (`/profile` and legacy `/students`) render `<ComingSoonPage />` directly — these need to be addressed before final release.

---

## 🏁 v1.0.0 Operational Completion Checklist

Status as of September 2026:

- [x] **Sidebar Restriction Verification**: All V2 links (Staff HR, Payroll/Expenses, Messages, Reports) are disabled/hidden via `V2_ENABLED = false` and sidebar filtering. SMS & WhatsApp has been removed entirely from the sidebar.
- [x] **Auth & RBAC**: Multi-tenant JWT auth, 7 roles, protected routes, 2FA, passkeys.
- [x] **Student Admission → Class Assignment → Profile Creation**: Full workflow operational.
- [x] **Teacher Assignment → Timetable Creation → Class Assignment**: Full workflow operational.
- [x] **Single & Bulk Grade Entry → Auto-grade calculation (A–F) → Academic Transcript**: Operational with Sierra Leone grading scale.
- [x] **Daily Student Attendance Marking**: Operational with bulk mark and analytics.
- [x] **ID Card Generation & PDF Export**: Operational with template designer and batch printing.
- [x] **PDF Report Cards (SL Booklet Style)**: Operational — affective/psychomotor domains, attendance, comments.
- [x] **Student Promotions**: Operational — promote/repeat/graduate workflow.
- [x] **Fee & Payment Management (Monime)**: Operational — fees, invoices, payments, hosted checkout, webhooks.
- [x] **Platform Management (Super Admin)**: Operational — tenants, subscriptions, analytics, communications, support.
- [x] **Settings Page**: Operational — 8 config tabs + 2FA + storage + offline.
- [x] **Discipline Module**: Operational — infractions, detention, appeals, conduct reports.
- [x] **Events Module**: Operational — events, calendar, my-events, analytics.
- [x] **Announcements**: Operational — create, broadcast, schedule.
- [x] **Offline-First PWA**: Operational — teacher offline attendance + sync.
- [x] **Support System**: Operational — help topics + ticket system.
- [x] **Database & Migration Audit**: 76 migrations, all execute cleanly on production.
- [x] **Production Deployment**: Live on Vercel (serverless) with Docker/K8s configs for self-hosting.
- [ ] **End-to-End Workflow Testing (comprehensive)**: Manual smoke testing needed before public launch.
- [ ] **Test Coverage Expansion**: Only 13 test files for 148 services — needs significant expansion.
- [ ] **Build `/profile` page**: Simple user profile editor (backend endpoint exists).
- [ ] **Fix legacy `/students` route**: Should redirect to `/students/directory` instead of Coming Soon.
- [ ] **Wire `PageShell` tabs**: Stale TODO — `PageTabs` component exists but `PageShell` still uses inline placeholder.

---

## 🗺️ Roadmap Beyond v1.0.0

For full feature specifications, data models, and architecture plans for Version 2.0.0, refer to:  
👉 **[FEATURE_ROADMAP.md](../../.kiro/specs/Roadmap/FEATURE_ROADMAP.md)** and **[PAGE_BUILD_ORDER.md](../../.kiro/specs/Page_Order/PAGE_BUILD_ORDER.md)**

```
┌──────────────────────────────────────────────────────────────────┐
│                      RELEASE TIMELINE (Updated Sep 2026)         │
├──────────────────────────────────────┬───────────────────────────┤
│ VERSION 1.0.0 (MVP) — ~98% COMPLETE │ VERSION 2.0.0 (NEXT)      │
├──────────────────────────────────────┼───────────────────────────┤
│ ✅ Auth & RBAC + 2FA + Passkeys     │ 🔲 Staff HR (Members,      │
│ ✅ Dashboard (7 role-based)          │      Leave, Performance)  │
│ ✅ Academic (Classes, Subjects,     │ 🔲 Payroll & Expenses      │
│    Timetables, Assignments, Exams,  │ 🔲 Scholarships             │
│    Results, Report Cards, Promotions)│ 🔲 In-App Messaging        │
│ ✅ Students (Directory, Admissions, │ 🔲 Email Broadcast Composer │
│    Profiles, Attendance, Discipline) │ 🔲 Advanced Reports (5)    │
│ ✅ Staff (Teachers)                 │ 🔲 QR Code Batch Manager   │
│ ✅ Finance (Fees, Invoices,         │ 🔲 User Profile Page       │
│    Payments — Monime)               │ 🔲 AI Dashboard Analysis   │
│ ✅ Communication (Announcements,    │ 🔲 Email Template Library  │
│    Support)                         │                           │
│ ✅ Identity (ID Cards, Templates)  │                           │
│ ✅ Events (Events, Calendar,         │                           │
│    My Events, Analytics)            │                           │
│ ✅ Settings (8 config tabs)         │                           │
│ ✅ Platform Management (Super Admin) │                           │
│ ✅ School Verification & Restore    │                           │
│ ✅ Offline-First PWA + Android      │                           │
└──────────────────────────────────────┴───────────────────────────┘
```
```
