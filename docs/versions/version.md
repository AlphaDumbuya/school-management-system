# School Management System — Versioning & Release Roadmap

> **Document Status**: Active  
> **Current Focus Target**: **Version 1.0.0 (MVP Operational Release)**  
> **Parent Location**: `docs/versions/version.md`  

---

## 🎯 Executive Strategy & Core Principle

The primary objective is to make **Version 1.0.0 fully complete, battle-tested, and 100% operational for real-world school deployment** while establishing a clean foundation to build **Version 2.0.0** incrementally.

To maintain a flawless user experience:
1. **Zero Half-Baked Features**: Unfinished or deferred features must **NOT** appear in v1.0.0.
2. **Strict UI Navigation Filtering**: All v2.0.0 menu options, links, and pages are strictly hidden/restricted from the v1.0.0 frontend interface ([Sidebar.tsx](file:///c:/Users/alpha/Desktop/My%20Projects/school-management-system/frontend/src/components/layout/Sidebar.tsx), [routes.tsx](file:///c:/Users/alpha/Desktop/My%20Projects/school-management-system/frontend/src/router/routes.tsx)).

---

## 📦 Version 1.0.0 (MVP Core Release Scope)

Version 1.0.0 focuses on everyday school operations, student enrollment, attendance tracking, classroom management, and basic identity/events management.

### 1. Multi-Role Authentication & Access Control (RBAC)
- Multi-tenant architecture (School Isolation).
- Role-based access for SuperAdmin, Principal, Teacher, Student, Parent, Accountant, and Admissions Officer.
- Secure JWT-based session management and protected routes ([ProtectedRoute.tsx](file:///c:/Users/alpha/Desktop/My%20Projects/school-management-system/frontend/src/router/ProtectedRoute.tsx)).

### 2. Student Administration
- **Student Directory**: Search, filter, and view registered students ([StudentDirectoryPage.tsx](file:///c:/Users/alpha/Desktop/My%20Projects/school-management-system/frontend/src/pages/students/StudentDirectoryPage.tsx)).
- **Admissions Workflow**: Application submission, review, approval, and student onboarding ([AdmissionsPage.tsx](file:///c:/Users/alpha/Desktop/My%20Projects/school-management-system/frontend/src/pages/students/AdmissionsPage.tsx)).
- **Student Profiles**: Detailed bio, academic placement, guardian details ([StudentProfilesPage.tsx](file:///c:/Users/alpha/Desktop/My%20Projects/school-management-system/frontend/src/pages/students/StudentProfilesPage.tsx)).
- **Daily Attendance**: Mark student daily attendance and view history ([AttendancePage.tsx](file:///c:/Users/alpha/Desktop/My%20Projects/school-management-system/frontend/src/pages/students/AttendancePage.tsx)).

### 3. Academic Operations Core
- **Classes & Streams**: Grade management, section allocation ([ClassesPage.tsx](file:///c:/Users/alpha/Desktop/My%20Projects/school-management-system/frontend/src/pages/academic/ClassesPage.tsx)).
- **Subject Management**: Subject allocation per class ([SubjectsPage.tsx](file:///c:/Users/alpha/Desktop/My%20Projects/school-management-system/frontend/src/pages/academic/SubjectsPage.tsx)).
- **Timetable Scheduling**: Weekly class schedule setup ([TimetablesPage.tsx](file:///c:/Users/alpha/Desktop/My%20Projects/school-management-system/frontend/src/pages/academic/TimetablesPage.tsx)).
- **Assignments**: Homework creation, instructions, and student assignment tracking ([AssignmentsPage.tsx](file:///c:/Users/alpha/Desktop/My%20Projects/school-management-system/frontend/src/pages/academic/AssignmentsPage.tsx)).
- **Examinations Schedule**: Exam timetable setup and venue allocation ([ExaminationsPage.tsx](file:///c:/Users/alpha/Desktop/My%20Projects/school-management-system/frontend/src/pages/academic/ExaminationsPage.tsx)).

### 4. Staff Directory
- **Teacher Profiles**: Teacher registration, subject assignments, and department categorization ([TeachersPage.tsx](file:///c:/Users/alpha/Desktop/My%20Projects/school-management-system/frontend/src/pages/staff/TeachersPage.tsx)).

### 5. Identity & Events
- **ID Card Management**: Student and staff ID card template design & batch printing ([IdCardsPage.tsx](file:///c:/Users/alpha/Desktop/My%20Projects/school-management-system/frontend/src/pages/identity/IdCardsPage.tsx)).
- **School Calendar & Events**: School event publishing, event details, and calendar view ([EventsPage.tsx](file:///c:/Users/alpha/Desktop/My%20Projects/school-management-system/frontend/src/pages/events/EventsPage.tsx)).

### 6. SuperAdmin & Platform Management
- Tenant creation, subscription plan management, and platform configuration ([PlatformTenantsPage.tsx](file:///c:/Users/alpha/Desktop/My%20Projects/school-management-system/frontend/src/pages/PlatformTenantsPage.tsx)).

### 7. Public Marketing & Self-Service Onboarding Alignment
To ensure market traction while maintaining complete honesty with school administrators:
- **Self-Service Onboarding ([RegisterPage.tsx](file:///c:/Users/alpha/Desktop/My%20Projects/school-management-system/frontend/src/pages/RegisterPage.tsx))**: School principals can self-register their school workspace via `/register` without SuperAdmin manual intervention.
- **Plan Hierarchy & Capacity Limits**:
  - **Freetong (v1.0 Free Core)**: NLe 0 / Free Forever — Up to 250 Students & 20 Staff. Includes all operational v1.0.0 core features.
  - **Combra (v2.0 Pro)**: NLe 500 / mo — Up to 1,000 Students & 75 Staff. Unlocks Fee Invoicing, PDF Report Cards, and Promotions Engine.
  - **Bintumani (v3.0 Enterprise)**: NLe 1,200 / mo — Unlimited Students & Staff. Unlocks Bulk SMS, WhatsApp Business API, and Dedicated Support.
- **Marketing Page Categorization ([FeaturesPage.tsx](file:///c:/Users/alpha/Desktop/My%20Projects/school-management-system/frontend/src/pages/FeaturesPage.tsx), [PricingPage.tsx](file:///c:/Users/alpha/Desktop/My%20Projects/school-management-system/frontend/src/pages/PricingPage.tsx))**:
  - Section 1 showcases **v1.0 Operational Modules (100% Free)**.
  - Section 2 showcases **Upcoming Version Roadmap** items clearly labeled **"Coming in v2"** or **"Coming in v3"**.

---

## 🚫 Excluded from v1.0.0 (Deferred to Version 2.0.0)

Per user direction, the following modules are explicitly removed from v1.0.0 and moved to v2.0.0:

1. ❌ **SMS & WhatsApp Messaging Suite**:
   - Deferred to v2.0.0 (`/communication/sms`, `SMSWhatsAppDashboard.tsx`). All SMS broadcasting, Twilio/WhatsApp gateways, and automated message triggers move to v2.0.0.
2. ❌ **Grades & Exam Results**:
   - Deferred to v2.0.0 (`/academic/results`). Exam scheduling and assignment creation remain in v1.0.0, but grade calculation, grading scales, and results publication move to v2.0.0.
3. ❌ **Financial & Fee Management**:
   - Fee structures, student invoicing, online payments, expense tracking, and payroll (`/finance/*`) deferred to v2.0.0.
4. ❌ **Report Cards & Promotions Engine**:
   - Terminal PDF report card generation (`/academic/report-cards`) and student class advancement (`/academic/promotions`) deferred to v2.0.0.
5. ❌ **Staff HR & Performance**:
   - Staff leave applications and performance appraisal tracking (`/staff/leave`, `/staff/performance`) deferred to v2.0.0.
6. ❌ **Internal In-App Messaging & Email**:
   - Direct messaging, email broadcasts, and internal chat system (`/communication/messages`, `/communication/email`) deferred to v2.0.0.
7. ❌ **Advanced Reports & Analytics**:
   - Academic performance, attendance trends, and financial reports (`/reports/*`) deferred to v2.0.0.

---

## 🔒 Sidebar & Router Restriction Policy (v1.0.0 UI Protection)

To guarantee that v1.0.0 users do **NOT** see broken, empty, or unreleased pages:

1. **Sidebar Navigation Filtering ([Sidebar.tsx](file:///c:/Users/alpha/Desktop/My%20Projects/school-management-system/frontend/src/components/layout/Sidebar.tsx))**:
   - Navigation links corresponding to v2.0.0 features (**SMS & WhatsApp**, **Grades & Results**, **Finance**, **Report Cards**, **Staff Leave**, **In-App Messages**, **Reports**) must be conditionally hidden in v1.0.0 builds using feature flag gating or list filtering.
   - Only v1.0.0 operational links will be visible in the user's sidebar.

2. **Route Guarding ([routes.tsx](file:///c:/Users/alpha/Desktop/My%20Projects/school-management-system/frontend/src/router/routes.tsx))**:
   - Direct navigation attempts to v2.0.0 URLs (e.g. typing `/communication/sms`, `/academic/results`, or `/finance/fees` in the address bar) will automatically redirect to `/dashboard` or show a clean, branded "Module Available in v2.0" notice.

---

## 🏁 v1.0.0 Operational Completion Checklist

Before releasing v1.0.0 to users:

- [ ] **Sidebar Restriction Verification**: Ensure all v2 links (SMS/WhatsApp, Grades/Results, Finance, HR, Reports) are disabled/hidden in [Sidebar.tsx](file:///c:/Users/alpha/Desktop/My%20Projects/school-management-system/frontend/src/components/layout/Sidebar.tsx).
- [ ] **End-to-End Workflow Testing**:
  - [ ] Tenant creation (SuperAdmin) -> School configuration.
  - [ ] Student Admission -> Class Assignment -> Profile Creation.
  - [ ] Teacher Assignment -> Timetable Creation -> Class Assignment creation.
  - [ ] Daily Student Attendance Marking.
  - [ ] ID Card Generation & PDF Export.
- [ ] **Database & Migration Audit**: Verify backend schema migrations execute without error on production database instances.
- [ ] **Error Handling & Production Hardening**: Confirm clean 404/403 states and disable debug trace dumps in production log outputs.

---

## 🗺️ Roadmap Beyond v1.0.0

For full feature specifications, data models, and architecture plans for Version 2.0.0, refer to:  
👉 **[docs/versions/v2_roadmap.md](file:///c:/Users/alpha/Desktop/My%20Projects/school-management-system/docs/versions/v2_roadmap.md)**

```
┌────────────────────────────────────────────────────────┐
│                      RELEASE TIMELINE                  │
├──────────────────────────┬─────────────────────────────┤
│ VERSION 1.0.0 (MVP)      │ VERSION 2.0.0 (NEXT PHASE)  │
├──────────────────────────┼─────────────────────────────┤
│ • Auth & RBAC            │ • SMS & WhatsApp Suite      │
│ • Student Directory      │ • Grades & Results Engine   │
│ • Admissions Workflow    │ • Report Cards Generator    │
│ • Daily Attendance       │ • Fee & Invoice Management  │
│ • Classes & Timetables   │ • Online Payment Gateway    │
│ • Assignments & Exam Sched│ • Student Promotions       │
│ • Teacher Directory      │ • Staff Leave & Performance │
│ • ID Cards & Events      │ • Deep Analytics & Reports  │
│ • Platform & Tenants     │ • Mobile App API Extensions │
└──────────────────────────┴─────────────────────────────┘
```
