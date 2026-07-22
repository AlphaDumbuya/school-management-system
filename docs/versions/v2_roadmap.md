# Version 2.0.0 — Comprehensive Module & Feature Roadmap

> **Document Status**: Planned Scope & Architecture Backlog  
> **Parent Location**: `docs/versions/v2_roadmap.md`  
> **Master Reference**: [docs/versions/version.md](file:///c:/Users/alpha/Desktop/My%20Projects/school-management-system/docs/versions/version.md)  

---

## 📌 Executive Summary

Version 2.0.0 is the **Expansion Phase** for the School Management System. While Version 1.0.0 focuses on everyday school operations, enrollment, timetables, and attendance, **Version 2.0.0** introduces financial management, grading/report cards, omni-channel messaging, staff HR, and deep analytics.

---

## 🚀 Version 2.0.0 Modules & Detailed Specifications

### 1. 💬 Communications Suite (SMS & WhatsApp)
- **Twilio & WhatsApp Business API**: Omni-channel messaging engine ([SMSWhatsAppDashboard.tsx](file:///c:/Users/alpha/Desktop/My%20Projects/school-management-system/frontend/src/pages/SMSWhatsAppDashboard.tsx)).
- **Automated Triggers**: SMS/WhatsApp alerts for attendance absences, fee due dates, exam announcements, and emergency notices.
- **Bulk SMS Dispatcher**: Custom targeted broadcasts by class, stream, or role.
- **Delivery Logs & Webhooks**: Real-time status tracking for sent/failed messages.

### 2. 📊 Academic Grading & Results Engine
- **Grade Entry & Calculation**: Score entry for Continuous Assessment (CA) and Exams ([ResultsPage.tsx](file:///c:/Users/alpha/Desktop/My%20Projects/school-management-system/frontend/src/pages/academic/ResultsPage.tsx)).
- **Grading Scales**: Customizable letter grade boundaries (A+, A, B, C, D, F) per school tenant.
- **Student Profile Academics Tab**: Academic transcript view embedded in student profile cards ([StudentProfilesPage.tsx](file:///c:/Users/alpha/Desktop/My%20Projects/school-management-system/frontend/src/pages/students/StudentProfilesPage.tsx)).
- **Class Ranking & GPA Calculation**: Automated term GPA and position-in-class rankings.

### 3. 📄 Terminal Report Cards & Student Promotions
- **PDF Report Card Generator**: Printable term report cards featuring subject marks, teacher remarks, attendance summaries, and principal signature block.
- **End-of-Year Promotion Engine**: Bulk advancement of students from one grade level to the next based on passing criteria.

### 4. 💳 Financial & Fee Management
- **Fee Structures**: Termly tuition, activity, transportation, and registration fee schedules (`/finance/fees`).
- **Student Invoicing & Receipts**: Automatic invoice generation upon term registration (`/finance/invoices`).
- **Online & Local Payment Gateways**: Integration with mobile money (M-Pesa, Orange Money), card processing, and bank teller upload receipt verification (`/finance/payments`).
- **Student Profile Billing Tab**: Outstanding balance, paid fees, and unpaid invoice tracking embedded in student profiles.
- **Payroll & Expense Tracking**: Staff salary disbursements and school operational expense logging (`/finance/payroll`, `/finance/expenses`).

### 5. 👥 Staff HR & Performance Management
- **Non-Teaching Staff Directory**: Administrative and support staff management (`/staff/members`).
- **Staff Leave System**: Leave application, approval workflows, and leave balance tracking (`/staff/leave`).
- **Performance Appraisals**: Head of Department (HOD) and Principal teacher performance reviews (`/staff/performance`).

### 6. 📈 Advanced Reports & Intelligence
- **Academic Performance Reports**: Subject pass rates, grade distribution charts (`/reports/academic`).
- **Financial Reports**: Revenue vs Expenses, collection rate analytics (`/reports/financial`).
- **Attendance & Enrollment Reports**: Chronic absenteeism flags, enrollment growth breakdown (`/reports/attendance`, `/reports/enrollment`).

---

## 🔗 Cross-References & Version Controls

- **Master Versioning Strategy**: [docs/versions/version.md](file:///c:/Users/alpha/Desktop/My%20Projects/school-management-system/docs/versions/version.md)
- **Version 1.0.0 Checklist**: [docs/versions/v1_checklist.md](file:///c:/Users/alpha/Desktop/My%20Projects/school-management-system/docs/versions/v1_checklist.md)
- **Frontend Navigation Gate**: `ENABLE_V2_FEATURES = false` in [Sidebar.tsx](file:///c:/Users/alpha/Desktop/My%20Projects/school-management-system/frontend/src/components/layout/Sidebar.tsx) and `<V2Route>` in [routes.tsx](file:///c:/Users/alpha/Desktop/My%20Projects/school-management-system/frontend/src/router/routes.tsx).
