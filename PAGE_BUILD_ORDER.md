# WiSkul — Page Build Order Roadmap

> **Purpose**: Every page in the app audited and ordered by dependency. Build from top to bottom.
> 
> **Key**: ✅ Fully built & live data | 🟡 Built but mock data (needs API wiring) | 🔴 `ComingSoon` placeholder | 🔵 Needs full rebuild

---

## Current State of All Pages

| Page | Route | Status | Notes |
|---|---|---|---|
| Landing Page | `/` | ✅ Done | Public marketing page |
| Features Page | `/features` | ✅ Done | Public marketing page |
| Pricing Page | `/pricing` | ✅ Done | Public marketing page |
| Why WiSkul | `/why` | ✅ Done | Public marketing page |
| Benefits Page | `/benefits` | ✅ Done | Public marketing page |
| Contact Page | `/contact` | ✅ Done | Email sending works |
| Login Page | `/login` | ✅ Done | Auth working |
| Admin Dashboard | `/admin/dashboard` | 🟡 Mostly done | Live data connected, KPI cards need to populate |
| Teachers Page | `/staff/teachers` | ✅ Done | Full CRUD, list/grid |
| Classes Page | `/academic/classes` | ✅ Done | Full CRUD |
| Subjects Page | `/academic/subjects` | ✅ Done | Full CRUD |
| Timetables Page | `/academic/timetables` | ✅ Done | Scheduling working |
| Assignments Page | `/academic/assignments` | ✅ Done | CRUD done |
| Examinations Page | `/academic/examinations` | ✅ Done | CRUD done |
| Results Page | `/academic/results` | ✅ Done | Grading done |
| Attendance Page | `/students/attendance` | ✅ Done | Mark/view attendance |
| Student Directory | `/students/directory` | ✅ Done | Listing done |
| Student Profiles | `/students/profiles` | ✅ Done | Profile management |
| Admissions Page | `/students/admissions` | ✅ Done | Application workflow |
| Discipline Page | `/discipline` | ✅ Done | Infractions, detention, appeals |
| Events Page | `/events/school` | ✅ Done | Event listing |
| Event Details | `/events/school/:id` | ✅ Done | Single event |
| Calendar Page | `/events/calendar` | ✅ Done | Calendar view |
| My Events | `/events/my-events` | ✅ Done | User events |
| Event Analytics | `/events/analytics` | ✅ Done | Event insights |
| ID Cards Page | `/identity/cards` | ✅ Done | Card generation |
| Templates Page | `/identity/templates` | ✅ Done | Card templates |
| SMS/WhatsApp | `/communication/sms` | ✅ Done | Messaging dashboard |
| Teacher Dashboard | `/teacher/dashboard` | 🟡 Mock data | Needs live API wiring |
| Student Dashboard | `/student/dashboard` | 🟡 Mock data | Needs live API wiring |
| Parent Dashboard | `/parent/dashboard` | 🟡 Mock data | Needs live API wiring |
| Accountant Dashboard | `/accountant/dashboard` | 🟡 Mock data | Needs live API wiring |
| Admissions Dashboard | `/admissions/dashboard` | 🟡 Mock data | Needs live API wiring |
| Super Admin Dashboard | `/platform/dashboard` | 🟡 Mock data | Needs live API wiring |
| Report Cards | `/academic/report-cards` | 🔴 Coming Soon | NEW |
| Promotions | `/academic/promotions` | 🔴 Coming Soon | NEW |
| Staff Members | `/staff/members` | 🔴 Coming Soon | NEW |
| Staff Leave | `/staff/leave` | 🔴 Coming Soon | NEW |
| Staff Performance | `/staff/performance` | 🔴 Coming Soon | NEW |
| Fees Management | `/finance/fees` | 🔴 Coming Soon | NEW — most critical |
| Invoices | `/finance/invoices` | 🔴 Coming Soon | NEW |
| Payments | `/finance/payments` | 🔴 Coming Soon | NEW |
| Expenses | `/finance/expenses` | 🔴 Coming Soon | NEW |
| Payroll | `/finance/payroll` | 🔴 Coming Soon | NEW |
| Scholarships | `/finance/scholarships` | 🔴 Coming Soon | NEW |
| Announcements | `/communication/announcements` | 🔴 Coming Soon | NEW — high priority |
| Messages | `/communication/messages` | 🔴 Coming Soon | NEW — in-app DMs |
| Email Manager | `/communication/email` | 🔴 Coming Soon | NEW |
| QR Codes | `/identity/qr-codes` | 🔴 Coming Soon | NEW |
| Academic Reports | `/reports/academic` | 🔴 Coming Soon | NEW |
| Financial Reports | `/reports/financial` | 🔴 Coming Soon | NEW |
| Attendance Reports | `/reports/attendance` | 🔴 Coming Soon | NEW |
| Enrollment Reports | `/reports/enrollment` | 🔴 Coming Soon | NEW |
| Discipline Reports | `/reports/discipline` | 🔴 Coming Soon | NEW |
| Tenants | `/platform/tenants` | 🔴 Coming Soon | NEW (super admin) |
| Subscriptions | `/platform/subscriptions` | 🔴 Coming Soon | NEW (super admin) |
| Platform Analytics | `/platform/analytics` | 🔴 Coming Soon | NEW (super admin) |
| Settings | `/settings` | 🔴 Coming Soon | NEW — every user |
| Profile | `/profile` | 🔴 Coming Soon | NEW — every user |

---

## Build Order

Pages are ordered by **dependency and importance**. Each group must be completed before the next group starts, because later pages depend on earlier ones being functional.

---

---

### PHASE 0 — School Setup (Must Be Completed Before Anything Else)
> **This is the absolute first phase.** Until the school is configured, ID numbers will be wrong, grades won't calculate, fees won't show the right currency, and terms won't be set. This must be done before any other feature.

#### 0.1 — School Setup & Settings Page `/settings` 🔥 Admin/Principal First

**Why this is Phase 0**: The Settings page is not just user preferences — it is the **configuration backbone** of the entire app. The following features all depend on settings being configured first:

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

**Backend ready**: `phase15SchoolConfigService.ts` + `school_config_settings` table ✅, `phase15GradingConfigService.ts` + `grading_scales` table ✅

**The Settings page has two sections:**

##### Section 1 — School Configuration (Admin/Principal only)
Organized as a tabbed settings panel:

**Tab: School Information**
- School name, short name, motto
- Logo upload (replaces default WiSkul logo on pages)
- Address, city, country
- Phone, email, website
- Registration number / accreditation status
- Founded year, principal name

**Tab: Academic Configuration**
- Current academic year (e.g. `2026/2027`)
- Number of terms per year (2 or 3)
- Term 1/2/3 start and end dates
- Class naming convention (e.g. `JSS 1`, `Grade 7`, `Year 7`, `Form 1`)
- Max class size (default capacity per class)

**Tab: ID Number Format** ← *(User's request)*
- Student ID prefix (e.g. `STU`, `WIS`, `SMS`)
- Staff/teacher ID prefix (e.g. `TCH`, `STA`)
- Include year in ID? (Yes/No) — e.g. `STU-2026-001`
- Separator character (`-`, `/`, `_`, or none)
- Number padding (3 digits = 001, 4 digits = 0001)
- Live preview: `STU-2026-0042`
- Reset counter on new academic year? (Yes/No)

**Tab: Grading Scale**
- Grade boundaries (add/edit/remove)
  - e.g. A+ = 95–100, A = 90–94, B+ = 85–89 …
- GPA weight per grade (A=4.0, B=3.0 …)
- Passing grade threshold (e.g. 40%)
- Grade display format (letter / percentage / both)

**Tab: Attendance Rules**
- Minimum attendance % before warning (default 75%)
- Minimum attendance % before critical alert (default 60%)
- Late arrival cutoff time (e.g. 08:30 AM = tardy)
- Attendance counted in (days / periods / hours)

**Tab: Financial Configuration**
- Currency code and symbol (NLe, USD, GBP, etc.)
- Currency display format (NLe 5,000 vs 5,000 NLe)
- Late fee policy (% per month, or flat fee)
- Payment methods accepted (cash, bank transfer, mobile money)
- Invoice due date default (e.g. 30 days from issue)

**Tab: Communications**
- School email (used as sender in all emails)
- SMS sender name (shown on SMS)
- WhatsApp number (for parent communication)
- Email footer text (address, unsubscribe link)
- Notification defaults (which events trigger email/SMS)

**Tab: Branding**
- Primary color (used in ID cards, email headers, reports)
- Secondary color
- School letterhead preview

##### Section 2 — My Preferences (All users)
- Display language (English / Krio)
- Date format (DD/MM/YYYY vs MM/DD/YYYY vs YYYY-MM-DD)
- Time format (12h / 24h)
- Dark/Light mode toggle
- Notification preferences per event type (email / SMS / in-app)
- Privacy settings (who can see my profile photo, etc.)

---

### PHASE A — Foundation (After School Setup)
> These unlock every other role dashboard and are depended on by all features.

#### A1 — Profile Page `/profile` ⚡ Every User

**Why first**: Every user sees their own profile. The edit form here feeds `first_name`, `last_name`, `email`, `avatar`, and password into the DB. Every dashboard depends on a working user profile.

**What to build**:
- View own profile (name, email, role, avatar, school)
- Edit name, phone, avatar upload
- Change password form (old + new + confirm)
- Last login info, session management

**Backend ready**: `PATCH /api/v1/users/:id` ✅

---

### PHASE B — Financial Core (Most Critical Module)
> Every other dashboard links to finance. Parents, students, teachers all need to see fee data. Build this before wiring any dashboard.

#### B1 — Fees Management `/finance/fees` 🔴

**Why before others**: Fees is the data source for the Accountant dashboard, Parent dashboard fee panel, Student dashboard fee panel, and the Admin KPI "Outstanding Fees". Nothing else can show real financial data until this exists.

**What to build**:
- Fee structures table (create, edit, assign to class/student)
- Fee categories (tuition, transport, uniform, etc.)
- Assign fee to student / bulk assign to class
- Fee status overview (paid, unpaid, partial)
- List/Grid toggle (same pattern as Teachers page)

**Backend ready**: `phase8FinancialRoutes.ts` ✅

---

#### B2 — Invoices Page `/finance/invoices` 🔴

**Why next**: Invoices are generated from fee structures. Parents need to see invoices. Accountant dashboard needs invoice counts.

**What to build**:
- Generate invoice for student
- Bulk generate for entire class or year
- Invoice status (draft, sent, paid, overdue)
- Send invoice via email button
- Invoice detail/PDF preview modal

**Backend ready**: `phase8FinancialRoutes.ts` ✅

---

#### B3 — Payments Page `/finance/payments` 🔴

**Why third**: After invoices exist, payments record money coming in.

**What to build**:
- Record payment (cash, bank transfer, mobile money)
- Link payment to invoice/student
- Payment history table with filters
- Receipt generation
- Partial payment recording

**Backend ready**: `phase8FinancialRoutes.ts` ✅

---

#### B4 — Expenses Page `/finance/expenses` 🔴

**What to build**:
- Log school expenses (salaries, supplies, utilities, etc.)
- Category management
- Monthly expense summary chart
- Export to CSV/PDF

---

#### B5 — Payroll Page `/finance/payroll` 🔴

**What to build**:
- View all staff salaries
- Generate payroll for period
- Mark payroll as paid
- Payslip download/email

---

#### B6 — Scholarships Page `/finance/scholarships` 🔴

**What to build**:
- Create scholarship (name, amount, criteria)
- Assign to student (reduces their fee balance)
- View all scholarship recipients

---

### PHASE C — Wire All Dashboards to Live Data
> All dashboards currently use mock data. Now that Finance is built, wire everything to real APIs.

#### C1 — Admin (Principal) Dashboard `/admin/dashboard` 🟡 → ✅

**Fix required**: The KPI cards show 0. The backend SQL fix has been applied. Confirm that:
- Total Students, Teachers, Classes populate from DB
- Outstanding Fees pulls from fees table
- Attendance chart shows real data
- Financial summary shows payments vs target

---

#### C2 — Accountant Dashboard `/accountant/dashboard` 🟡 → ✅

**Mock → Live**:
- Wire fee collection totals from `/api/v1/dashboards/accountant/*` (build these endpoints if not there)
- Real payment history list
- Real overdue accounts list
- Fee collection chart by month

---

#### C3 — Admissions Dashboard `/admissions/dashboard` 🟡 → ✅

**Mock → Live**:
- Real pending applications count
- Real approval/rejection rates
- Real class capacity percentages
- Recent applications list from DB

---

#### C4 — Teacher Dashboard `/teacher/dashboard` 🟡 → ✅

**Mock → Live**:
- Load teacher's assigned classes from DB
- Real student counts per class
- Real assignment submission stats
- Real recent absences in their class

---

#### C5 — Student Dashboard `/student/dashboard` 🟡 → ✅

**Mock → Live**:
- Real grades from results table
- Real attendance percentage
- Real upcoming assignments
- Real fee balance

---

#### C6 — Parent Dashboard `/parent/dashboard` 🟡 → ✅

**Mock → Live**:
- Load parent's linked children from DB
- Real grades, attendance, fees per child
- Real upcoming events
- Real discipline records

---

#### C7 — Super Admin Dashboard `/platform/dashboard` 🟡 → ✅

**Mock → Live**:
- Real tenant list and status
- Real system health metrics
- Real revenue across tenants
- Real user counts

---

### PHASE D — Staff Management

#### D1 — Staff Members Page `/staff/members` 🔴

**Why after dashboards**: Principals need a way to view non-teacher staff (admin, security, support staff). This is separate from teachers.

**What to build**:
- Staff directory (admin officers, support staff, cleaners, etc.)
- Same List/Grid pattern as Teachers page
- Add/Edit/Deactivate staff
- Role assignment
- Department grouping

---

#### D2 — Staff Leave Page `/staff/leave` 🔴

**What to build**:
- Teacher/staff submits leave request (dates, reason, type)
- Principal approves/rejects
- Leave calendar view
- Leave balance tracker per staff
- Email notification on decision

---

#### D3 — Staff Performance Page `/staff/performance` 🔴

**What to build**:
- Performance review cycles
- Rating criteria (punctuality, teaching quality, conduct)
- Review submission by principal
- Historical review records
- Performance trend chart

---

### PHASE E — Communication Hub

#### E1 — Announcements Page `/communication/announcements` 🔴

**Why high priority**: This is how the school communicates with everyone. It feeds the notification centre and in-app bell.

**What to build**:
- Create announcement (title, body, audience: all/teachers/parents/students/class)
- Schedule for later
- Announcement list with read/unread indicators
- Pin important announcements
- Bulk send as email/SMS button

---

#### E2 — Messages Page `/communication/messages` 🔴

**What to build**:
- Direct messaging between roles (e.g. parent → teacher, teacher → principal)
- Conversation thread view
- Unread count badge
- File attachment support (PDF, image)
- Real-time or polling-based refresh

---

#### E3 — Email Manager `/communication/email` 🔴

**What to build**:
- Compose email to individual/group/class/all
- Use saved templates from email template library
- Sent email history with delivery status
- Preview email before sending
- Schedule future emails

---

### PHASE F — Academic Completions

#### F1 — Report Cards Page `/academic/report-cards` 🔴

**Why after results exist**: Report cards pull from the results and grades tables. Those are already built.

**What to build**:
- Generate report card per student per term
- Show all subjects, grades, attendance, conduct
- Teacher/class teacher comments section
- Download as PDF
- Bulk generate for entire class
- Email to parents button

---

#### F2 — Promotions Page `/academic/promotions` 🔴

**What to build**:
- End-of-year promotion workflow
- Set promotion criteria (min GPA, attendance %)
- Review each student: Promote / Repeat / Graduate
- Bulk promote entire class
- Generate promotion letter PDF

---

### PHASE G — Reports & Analytics

> These pages aggregate data from all other modules. Build last.

#### G1 — Academic Reports `/reports/academic` 🔴

**What to build**:
- Grade distribution by class/subject/term
- Top performers table
- Failing students list with intervention flag
- Subject pass rate charts
- Export CSV/PDF

---

#### G2 — Financial Reports `/reports/financial` 🔴

**What to build**:
- Revenue vs target by month
- Fee collection rate by class
- Outstanding debt list
- Expense breakdown pie chart
- Payment method breakdown
- Export CSV/PDF

---

#### G3 — Attendance Reports `/reports/attendance` 🔴

**What to build**:
- Attendance rate by class, week, month
- Chronic absentee list (< 75%)
- Daily attendance heatmap
- Trends over time
- Export CSV/PDF

---

#### G4 — Enrollment Reports `/reports/enrollment` 🔴

**What to build**:
- Applications per term/year
- Approval/rejection rates
- Class fill rates and capacity
- Student retention rate
- Export CSV/PDF

---

#### G5 — Discipline Reports `/reports/discipline` 🔴

**What to build**:
- Incidents by type over time
- Top repeated offenders (anonymized option)
- Detention/suspension counts
- Resolution rates
- Export CSV/PDF

---

### PHASE H — Identity Extras

#### H1 — QR Codes Page `/identity/qr-codes` 🔴

**What to build**:
- Generate QR codes for student/staff IDs
- Batch generate for entire class
- QR scanner integration for attendance
- Download QR sheet PDF

---

### PHASE I — Platform Management (Super Admin Only)

#### I1 — Tenants Page `/platform/tenants` 🔴

**What to build**:
- List all school tenants with status
- Tenant detail view (users, storage, last active)
- Create new tenant (onboard a new school)
- Suspend/reactivate tenant
- Tenant-specific settings override

---

#### I2 — Subscriptions Page `/platform/subscriptions` 🔴

**What to build**:
- View all active subscriptions
- Billing periods and renewal dates
- Upgrade/downgrade plan
- Invoice generation for subscription billing
- Payment history per tenant

---

#### I3 — Platform Analytics `/platform/analytics` 🔴

**What to build**:
- Total active schools, users, students across platform
- Revenue dashboard (MRR, ARR, churn)
- Feature usage heatmap
- System performance metrics
- Growth trends

---

## Complete Build Order Summary


```
PHASE 0  →  Settings Page (School Setup — ALL 8 config tabs)
    ↓
PHASE A  →  Profile Page
    ↓
PHASE B  →  Fees, Invoices, Payments, Expenses, Payroll, Scholarships
    ↓
PHASE C  →  Wire ALL dashboards to live data (Admin, Accountant, Admissions, Teacher, Student, Parent, Super Admin)
    ↓
PHASE D  →  Staff Members, Staff Leave, Staff Performance
    ↓
PHASE E  →  Announcements, Messages, Email Manager
    ↓
PHASE F  →  Report Cards, Promotions
    ↓
PHASE G  →  Academic Reports, Financial Reports, Attendance Reports, Enrollment Reports, Discipline Reports
    ↓
PHASE H  →  QR Codes
    ↓
PHASE I  →  Tenants, Subscriptions, Platform Analytics
    ↓
PHASE J  →  Email Templates (Pillar 1 from FEATURE_ROADMAP.md)
    ↓
PHASE K  →  AI Dashboard Analysis (Pillar 2 from FEATURE_ROADMAP.md)
```

---

## Total Page Count

| Status | Count |
|---|---|
| ✅ Fully done | 26 pages |
| 🟡 Built but mock data | 7 dashboards |
| 🔴 Coming Soon (to build) | 21 pages |
| **Total** | **54 pages** |

### Settings Page Tabs (Phase 0)

| Tab | Critical Before |
|---|---|
| School Information | ID cards, report cards, emails |
| Academic Configuration | All academic modules |
| **ID Number Format** | Every student/teacher ID |
| Grading Scale | Results, report cards, at-risk alerts |
| Attendance Rules | Attendance page, dashboard warnings |
| Financial Configuration | ALL finance pages |
| Communications | All emails and SMS |
| Branding | ID cards, email headers |

> **Rule**: A school cannot fully use any other feature until Phase 0 is complete.

