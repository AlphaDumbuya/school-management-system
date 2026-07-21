# WiSkul — Feature Roadmap & Planning Document

> This document covers two major feature pillars plus additional production-ready enhancements identified from a full codebase audit.

---

## PILLAR 1 — Email Templates

The app already has an `EmailService` (Brevo) and a `notification_templates` table. The infrastructure is in place — what's missing is **the actual HTML templates** for every user-facing event. Below is every template needed, organised by module.

---

### 🔐 Auth & Account

| Template ID | Trigger | Recipient | Key Variables |
|---|---|---|---|
| `auth_welcome` | New user account created | New user | `{{firstName}}`, `{{role}}`, `{{schoolName}}`, `{{loginUrl}}`, `{{tempPassword}}` |
| `auth_temp_password` | Teacher/staff created by admin | New staff member | `{{firstName}}`, `{{tempPassword}}`, `{{loginUrl}}`, `{{schoolName}}` |
| `auth_password_reset` | Forgot password request | User | `{{firstName}}`, `{{resetLink}}`, `{{expiryMinutes}}` |
| `auth_password_changed` | Password successfully changed | User | `{{firstName}}`, `{{changeTime}}`, `{{supportEmail}}` |
| `auth_login_new_device` | Login from unrecognized device | User | `{{firstName}}`, `{{deviceInfo}}`, `{{loginTime}}`, `{{ipAddress}}` |
| `auth_account_locked` | Too many failed login attempts | User | `{{firstName}}`, `{{unlockTime}}`, `{{supportEmail}}` |
| `auth_account_deactivated` | Admin deactivates account | User | `{{firstName}}`, `{{reason}}`, `{{contactEmail}}` |

---

### 🎓 Admissions

| Template ID | Trigger | Recipient | Key Variables |
|---|---|---|---|
| `admission_received` | Application submitted | Applicant / Parent | `{{studentName}}`, `{{applicationRef}}`, `{{submittedDate}}`, `{{schoolName}}` |
| `admission_under_review` | Status changes to "under review" | Parent | `{{studentName}}`, `{{applicationRef}}`, `{{estimatedDecision}}` |
| `admission_approved` | Application approved | Parent | `{{studentName}}`, `{{grade}}`, `{{startDate}}`, `{{schoolName}}`, `{{nextStepsUrl}}` |
| `admission_rejected` | Application rejected | Parent | `{{studentName}}`, `{{reason}}`, `{{appealDeadline}}`, `{{supportEmail}}` |
| `admission_waitlisted` | Application waitlisted | Parent | `{{studentName}}`, `{{position}}`, `{{notificationDate}}` |
| `admission_docs_required` | Missing documents flagged | Parent | `{{studentName}}`, `{{missingDocs}}`, `{{deadline}}` |
| `admission_enrollment_complete` | Student fully enrolled | Parent + Student | `{{studentName}}`, `{{studentId}}`, `{{class}}`, `{{term}}`, `{{loginUrl}}` |

---

### 👤 Student Management

| Template ID | Trigger | Recipient | Key Variables |
|---|---|---|---|
| `student_profile_created` | New student profile created | Parent | `{{studentName}}`, `{{studentId}}`, `{{class}}`, `{{schoolName}}` |
| `student_class_changed` | Student moved to new class | Parent + Student | `{{studentName}}`, `{{oldClass}}`, `{{newClass}}`, `{{effectiveDate}}` |
| `student_status_changed` | Student status changes (active/suspended/graduated) | Parent | `{{studentName}}`, `{{status}}`, `{{reason}}`, `{{date}}` |
| `student_graduation` | Student graduates / completes term | Parent + Student | `{{studentName}}`, `{{grade}}`, `{{year}}`, `{{ceremony}}` |

---

### 📅 Attendance

| Template ID | Trigger | Recipient | Key Variables |
|---|---|---|---|
| `attendance_absent_today` | Student marked absent | Parent | `{{studentName}}`, `{{date}}`, `{{class}}`, `{{schoolName}}` |
| `attendance_late_arrival` | Student marked late/tardy | Parent | `{{studentName}}`, `{{date}}`, `{{arrivalTime}}`, `{{scheduledTime}}` |
| `attendance_low_warning` | Attendance drops below 75% | Parent + Student | `{{studentName}}`, `{{attendanceRate}}`, `{{daysAbsent}}`, `{{threshold}}` |
| `attendance_critical` | Attendance drops below 60% | Parent + Principal | `{{studentName}}`, `{{attendanceRate}}`, `{{daysAbsent}}`, `{{meetingUrl}}` |
| `attendance_perfect_month` | 100% attendance for full month | Student + Parent | `{{studentName}}`, `{{month}}`, `{{award}}` |
| `attendance_weekly_summary` | Weekly report (every Friday) | Parent | `{{studentName}}`, `{{week}}`, `{{daysPresent}}`, `{{daysAbsent}}`, `{{rate}}` |

---

### 📊 Grades & Exams

| Template ID | Trigger | Recipient | Key Variables |
|---|---|---|---|
| `grade_published` | Teacher publishes grades | Student + Parent | `{{studentName}}`, `{{subject}}`, `{{grade}}`, `{{term}}`, `{{class}}` |
| `grade_failing_warning` | Grade falls below passing (40%) | Parent + Teacher | `{{studentName}}`, `{{subject}}`, `{{grade}}`, `{{passingGrade}}` |
| `grade_improved` | Grade improves significantly (+15%) | Parent + Student | `{{studentName}}`, `{{subject}}`, `{{oldGrade}}`, `{{newGrade}}` |
| `exam_scheduled` | New examination scheduled | Students + Parents | `{{examName}}`, `{{subject}}`, `{{date}}`, `{{time}}`, `{{venue}}`, `{{duration}}` |
| `exam_reminder` | 3 days before exam | Student | `{{examName}}`, `{{subject}}`, `{{date}}`, `{{time}}`, `{{venue}}` |
| `exam_result_published` | Exam results available | Student + Parent | `{{studentName}}`, `{{examName}}`, `{{score}}`, `{{grade}}`, `{{rank}}` |
| `assignment_due_reminder` | 24h before assignment deadline | Student | `{{assignmentTitle}}`, `{{subject}}`, `{{deadline}}`, `{{teacher}}` |
| `assignment_graded` | Teacher grades submitted assignment | Student | `{{assignmentTitle}}`, `{{score}}`, `{{feedback}}`, `{{subject}}` |
| `results_term_report` | End of term — full report card | Parent + Student | `{{studentName}}`, `{{term}}`, `{{gpa}}`, `{{rank}}`, `{{reportUrl}}` |

---

### 💰 Finance & Fees

| Template ID | Trigger | Recipient | Key Variables |
|---|---|---|---|
| `fee_invoice_generated` | New invoice created | Parent | `{{studentName}}`, `{{invoiceRef}}`, `{{amount}}`, `{{dueDate}}`, `{{paymentUrl}}` |
| `fee_payment_confirmed` | Payment recorded | Parent | `{{studentName}}`, `{{amount}}`, `{{paymentDate}}`, `{{receiptRef}}`, `{{balance}}` |
| `fee_due_soon` | 7 days before due date | Parent | `{{studentName}}`, `{{amount}}`, `{{dueDate}}`, `{{paymentUrl}}` |
| `fee_overdue` | Fee past due date | Parent | `{{studentName}}`, `{{amount}}`, `{{daysOverdue}}`, `{{lateCharge}}`, `{{paymentUrl}}` |
| `fee_overdue_critical` | Fee 30+ days overdue | Parent + Principal | `{{studentName}}`, `{{amount}}`, `{{daysOverdue}}`, `{{suspensionWarning}}` |
| `fee_partial_payment` | Partial payment received | Parent | `{{studentName}}`, `{{amountPaid}}`, `{{outstanding}}`, `{{nextDue}}` |
| `fee_payment_plan_created` | Payment plan approved | Parent | `{{studentName}}`, `{{totalAmount}}`, `{{installments}}`, `{{firstDue}}` |
| `fee_receipt` | PDF receipt of payment | Parent | `{{studentName}}`, `{{amount}}`, `{{method}}`, `{{ref}}`, `{{receiptUrl}}` |
| `fee_refund_processed` | Refund issued | Parent | `{{studentName}}`, `{{amount}}`, `{{reason}}`, `{{refundDate}}` |

---

### 👨‍🏫 Teachers & Staff

| Template ID | Trigger | Recipient | Key Variables |
|---|---|---|---|
| `teacher_account_created` | New teacher account created | Teacher | `{{firstName}}`, `{{employeeId}}`, `{{tempPassword}}`, `{{loginUrl}}`, `{{schoolName}}` |
| `teacher_class_assigned` | Teacher assigned to class/subject | Teacher | `{{firstName}}`, `{{className}}`, `{{subject}}`, `{{students}}`, `{{startDate}}` |
| `teacher_class_removed` | Teacher removed from class | Teacher | `{{firstName}}`, `{{className}}`, `{{subject}}`, `{{reason}}` |
| `teacher_schedule_updated` | Timetable changed | Teacher | `{{firstName}}`, `{{changedDay}}`, `{{oldTime}}`, `{{newTime}}`, `{{subject}}` |
| `teacher_role_promoted` | Promoted (e.g. to Head of Dept.) | Teacher | `{{firstName}}`, `{{oldRole}}`, `{{newRole}}`, `{{effectiveDate}}` |
| `teacher_leave_approved` | Leave request approved | Teacher | `{{firstName}}`, `{{startDate}}`, `{{endDate}}`, `{{approvedBy}}` |
| `teacher_leave_rejected` | Leave request rejected | Teacher | `{{firstName}}`, `{{startDate}}`, `{{endDate}}`, `{{reason}}` |
| `teacher_performance_review` | Review period opens | Teacher | `{{firstName}}`, `{{reviewPeriod}}`, `{{deadline}}`, `{{reviewUrl}}` |

---

### 📐 Discipline & Conduct

| Template ID | Trigger | Recipient | Key Variables |
|---|---|---|---|
| `discipline_infraction_logged` | Behaviour incident recorded | Parent | `{{studentName}}`, `{{incidentType}}`, `{{date}}`, `{{description}}`, `{{consequence}}` |
| `discipline_detention_scheduled` | Student assigned detention | Parent + Student | `{{studentName}}`, `{{date}}`, `{{time}}`, `{{reason}}`, `{{supervisor}}` |
| `discipline_suspension_warning` | Pre-suspension warning issued | Parent | `{{studentName}}`, `{{reason}}`, `{{meetingDate}}`, `{{principalName}}` |
| `discipline_suspension_issued` | Student suspended | Parent + Student | `{{studentName}}`, `{{startDate}}`, `{{endDate}}`, `{{reason}}`, `{{returnConditions}}` |
| `discipline_conduct_report` | Monthly conduct report generated | Parent | `{{studentName}}`, `{{month}}`, `{{incidents}}`, `{{behaviour}}`, `{{reportUrl}}` |
| `discipline_appeal_submitted` | Appeal submitted by parent | Parent + Principal | `{{studentName}}`, `{{appealRef}}`, `{{incidentRef}}`, `{{submittedDate}}` |
| `discipline_appeal_decision` | Appeal decided | Parent | `{{studentName}}`, `{{decision}}`, `{{reason}}`, `{{effectiveDate}}` |
| `discipline_cleared` | All discipline records cleared | Parent + Student | `{{studentName}}`, `{{clearedDate}}`, `{{clearedBy}}` |

---

### 📣 Events & Calendar

| Template ID | Trigger | Recipient | Key Variables |
|---|---|---|---|
| `event_created` | New school event published | All users | `{{eventName}}`, `{{date}}`, `{{time}}`, `{{venue}}`, `{{description}}`, `{{eventUrl}}` |
| `event_reminder` | 24h before event | Registered attendees | `{{eventName}}`, `{{date}}`, `{{time}}`, `{{venue}}` |
| `event_cancelled` | Event cancelled | Registered attendees | `{{eventName}}`, `{{originalDate}}`, `{{reason}}`, `{{refundInfo}}` |
| `event_rescheduled` | Event date/time changed | Registered attendees | `{{eventName}}`, `{{oldDate}}`, `{{newDate}}`, `{{reason}}` |
| `event_registration_confirmed` | User registers for event | Registrant | `{{firstName}}`, `{{eventName}}`, `{{date}}`, `{{seat}}`, `{{qrCode}}` |
| `event_capacity_warning` | Event 90% full | Admins | `{{eventName}}`, `{{registered}}`, `{{capacity}}`, `{{waitlist}}` |

---

### 🆔 Identity & ID Cards

| Template ID | Trigger | Recipient | Key Variables |
|---|---|---|---|
| `id_card_issued` | ID card generated | Student / Staff | `{{firstName}}`, `{{idNumber}}`, `{{validUntil}}`, `{{cardUrl}}` |
| `id_card_expiring` | ID card expiring in 30 days | Card holder | `{{firstName}}`, `{{expiryDate}}`, `{{renewalUrl}}` |
| `id_card_expired` | ID card expired | Card holder + Admin | `{{firstName}}`, `{{expiryDate}}`, `{{renewalUrl}}` |
| `id_card_replaced` | ID card replaced (lost/damaged) | Card holder | `{{firstName}}`, `{{oldId}}`, `{{newId}}`, `{{fee}}` |

---

### 📬 Notifications & System

| Template ID | Trigger | Recipient | Key Variables |
|---|---|---|---|
| `system_announcement` | School-wide announcement | All users | `{{title}}`, `{{message}}`, `{{from}}`, `{{date}}` |
| `system_maintenance` | Scheduled maintenance notice | All users | `{{startTime}}`, `{{endTime}}`, `{{affectedFeatures}}` |
| `system_backup_complete` | Backup succeeded | Super Admin | `{{timestamp}}`, `{{size}}`, `{{location}}` |
| `system_backup_failed` | Backup failed | Super Admin | `{{timestamp}}`, `{{error}}`, `{{retryTime}}` |
| `contact_form_received` | Contact form submitted | WiSkul team | `{{name}}`, `{{email}}`, `{{school}}`, `{{message}}` ✅ *Already built* |
| `contact_form_autoresponse` | Auto-reply to enquirer | Enquirer | `{{name}}` ✅ *Already built* |

---

### 💳 Subscriptions & Platform Billing

| Template ID | Trigger | Recipient | Key Variables |
|---|---|---|---|
| `subscription_invoice_generated` | New invoice generated | Principal | `{{schoolName}}`, `{{invoiceRef}}`, `{{amount}}`, `{{planType}}`, `{{dueDate}}`, `{{billingCycle}}` |
| `subscription_payment_confirmed` | Subscription payment received | Principal | `{{schoolName}}`, `{{receiptRef}}`, `{{amount}}`, `{{planType}}`, `{{paymentDate}}` |
| `subscription_expiration_warning_30d` | Subscription expiring in 30 days | Principal | `{{schoolName}}`, `{{planType}}`, `{{expiryDate}}`, `{{renewalUrl}}` |
| `subscription_expiration_warning_7d` | Subscription expiring in 7 days | Principal | `{{schoolName}}`, `{{planType}}`, `{{expiryDate}}`, `{{renewalUrl}}` |
| `subscription_expired` | Subscription expires | Principal | `{{schoolName}}`, `{{planType}}`, `{{expiryDate}}`, `{{renewUrl}}` |
| `subscription_limit_alert_students` | Student usage hits 90% | Principal | `{{schoolName}}`, `{{currentStudents}}`, `{{maxStudents}}`, `{{upgradeUrl}}` |
| `subscription_limit_alert_staff` | Staff usage hits 90% | Principal | `{{schoolName}}`, `{{currentStaff}}`, `{{maxStaff}}`, `{{upgradeUrl}}` |

---

## PILLAR 2 — AI-Powered Live Analysis on All Dashboards

> **Concept**: Each dashboard role gets a dedicated AI assistant panel that analyses real data in real time and communicates what is happening, what needs attention, and what trends are emerging — like having a personal analyst watching over the school 24/7.

### Technical Architecture

```
[Dashboard loads]
      |
      v
[Frontend: AIInsightPanel component]
      |  POST /api/v1/ai/analyse/:role
      v
[Backend: aiAnalysisService]
   - Fetches live data for that role (same queries as dashboard)
   - Constructs structured prompt for the AI
   - Calls Gemini API (or OpenAI GPT-4o-mini)
   - Returns: { summary, insights[], urgentActions[], positives[] }
      |
      v
[Frontend renders insights with colour-coded cards]
   - Red: Urgent actions needed
   - Amber: Warnings / trends to watch
   - Green: Positive highlights
   - Blue: Informational insights
```

**Refresh strategy**: On page load + every 5 minutes (with a "Refresh Analysis" button)
**AI Model recommendation**: Google Gemini 1.5 Flash (free tier, very fast, cost-effective)

---

### Dashboard AI Panels

---

#### 🏫 Principal Dashboard — School Intelligence Report

**Data fed to AI**: Total students, attendance rate by class, fee collection %, grade averages by subject, at-risk students list, discipline incidents this week

**Example AI output**:
- 🔴 *"Overall attendance this week is 87% — 4% below last week. Class 9B has the lowest at 71%. Immediate follow-up recommended."*
- 🔴 *"Fee collection is 62% of monthly target. 18 students are 30+ days overdue totalling Le 4.2M."*
- 🟠 *"3 students are simultaneously at academic and attendance risk — they may need counsellor intervention."*
- 🟢 *"Average grades improved by 6% this term compared to the same period last year. Excellent progress."*

**Actions AI can suggest**: Flag students for intervention, bulk-send parent reminders, schedule staff meetings

---

#### 👨‍🏫 Teacher Dashboard — Class Intelligence

**Data fed to AI**: Their assigned classes, attendance per class, grade distributions, assignment submission rates, discipline incidents

**Example AI output**:
- 🔴 *"6 students in Year 10 Maths haven't submitted the last 2 assignments. Deadline follow-up needed."*
- 🟠 *"Fatmata Sesay has missed 4 consecutive classes. A welfare check is recommended."*
- 🟠 *"Class average on the last test was 58%. Consider a revision session before the upcoming exam."*
- 🟢 *"Top performers this month: Mohamed B (92%), Aminata K (89%), Alpha D (87%)."*

---

#### 👧 Student Dashboard — Personal Learning Companion

**Data fed to AI**: Own attendance %, grades per subject, upcoming assignments, upcoming exams, fee balance

**Example AI output**:
- 🟢 *"Your attendance this month is 91% — great! You're on track to maintain your scholarship eligibility."*
- 🟠 *"You have 2 assignments due this week: Biology (tomorrow) and English Essay (Friday)."*
- 🟠 *"Your Science exam is in 3 days. Based on your quiz scores, focus on Chapters 4 and 5."*
- 🔴 *"Your school fee balance of Le 240,000 is due in 8 days. Please remind your parent."*

---

#### 👪 Parent Dashboard — Child Guardian Intelligence

**Data fed to AI**: Child's attendance rate, grades, assignments, discipline records, fee balance, upcoming events

**Example AI output**:
- 🔴 *"Aminata had 3 absences this month — attendance is at 74%, just below the 75% threshold. A teacher meeting is recommended."*
- 🟠 *"Aminata's Maths grade declined by 5% this term. Additional tutoring may help."*
- 🟢 *"Aminata's English grade improved by 8% — excellent progress!"*
- 🔴 *"Outstanding fee of Le 180,000 is due in 5 days. Payment link below."*
- 🔵 *"School Sports Day is Friday July 25. Aminata is registered for the 100m race."*

---

#### 💰 Accountant Dashboard — Financial Intelligence

**Data fed to AI**: Total fees outstanding, payment trends, overdue accounts, collection rates vs targets, pending refunds

**Example AI output**:
- 🔴 *"Fee collection is Le 2.4M vs a target of Le 3.8M (63%). Le 1.4M needs to be collected in 12 days."*
- 🔴 *"24 students are 30+ days overdue. Combined outstanding: Le 4.2M. Sending automated reminders is recommended."*
- 🟠 *"3 refund requests totalling Le 340,000 are pending review."*
- 🟢 *"Revenue trend: +18% vs same period last term. Strong collection momentum."*
- 🔵 *"Payment volume peaks on Mondays — consider scheduling payment campaigns early in the week."*

---

#### 📋 Admissions Dashboard — Pipeline Intelligence

**Data fed to AI**: Pending applications, approval rates, enrollment by class, capacity per class, documents status

**Example AI output**:
- 🔴 *"14 applications have been waiting for review for 5+ days. Approval backlog is growing."*
- 🔴 *"Class 7A is at 94% capacity — only 2 seats remain. Consider opening a second section."*
- 🟠 *"3 applicants submitted incomplete documents 10+ days ago and have not responded."*
- 🟢 *"Approval rate this term is 78% — higher than the 68% average of last term."*

---

#### 🛡️ Super Admin Dashboard — Platform Intelligence

**Data fed to AI**: Active tenants, system health, DB storage, API response times, user activity

**Example AI output**:
- 🟢 *"All 4 active schools are healthy and operational."*
- 🟠 *"Kossoh Secondary School has not logged in for 7 days — check if they need support."*
- 🟠 *"Database storage is at 62%. At current growth rate, you'll reach 85% in approximately 3 months. Plan archiving."*
- 🔵 *"12 new users were created this week across all tenants — normal growth."*

---

## PILLAR 3 — Other Production-Ready Features (Recommended)

These were identified during the codebase audit as high-value, logical next steps:

---

### 📱 SMS & WhatsApp Alerts
- `smsWhatsAppRoutes.ts` backend already built — needs Twilio or Africa's Talking activation
- Critical alerts (absence, overdue fee, suspension) sent via WhatsApp Business API
- Short-form SMS versions of every email template above

### 🖨️ PDF Report Cards & Auto-Email
- Auto-generate PDF report cards at end of term
- Email to parents automatically (template: `results_term_report`)
- Also: print-ready ID card PDF from `IdCardsPage` (partially built)

### 📆 Parent-Teacher Meeting Scheduler
- Parents book appointments from the Parent Dashboard
- Teacher confirms or declines
- Email confirmations both ways (templates: `meeting_booked`, `meeting_confirmed`, `meeting_cancelled`)

### 🔔 In-App Notification Centre
- Real-time bell icon with unread count
- Notifications link to relevant page
- Mark all as read / dismiss
- Feeds from all events: attendance, grades, fees, discipline, events

### 📈 Exportable Analytics Reports
- Attendance by class, fee collection summary, grade distribution, discipline trends
- Date range filter, export to CSV / Excel / PDF
- Accessible from Principal and Accountant dashboards

### 🗓️ Academic Year & Term Management
- Admin configures sessions, terms, and holidays
- Auto-calculates working days excluding holidays
- Term start/end triggers automated emails to all users

---

## Implementation Priority Order

| # | Feature | Effort | Impact |
|---|---|---|---|
| 1 | Email templates — Auth, Admission, Fees, Attendance, Discipline | Medium | Very High |
| 2 | AI analysis panel on all dashboards (Gemini integration) | High | Very High |
| 3 | In-app notification centre | Medium | High |
| 4 | PDF report cards + auto-email | Medium | High |
| 5 | SMS/WhatsApp activation | Low | High |
| 6 | Parent-Teacher meeting scheduler | Medium | Medium |
| 7 | Exportable analytics reports | Medium | Medium |
| 8 | Academic year & term management | Low | High |
