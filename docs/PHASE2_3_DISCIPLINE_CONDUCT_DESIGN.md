# Phase 2.3: Discipline & Conduct Module - Design & Database Schema

**Status**: ✅ DATABASE SCHEMA COMPLETE  
**Date**: July 13, 2026  
**Migration**: 025_phase2_3_discipline_conduct.ts

## Overview

Phase 2.3 implements a comprehensive Discipline & Conduct management system for schools to track, record, and manage student behavior, infractions, and disciplinary actions. The module includes complete audit trails, parent notifications, appeal processes, and analytics.

## Core Features

### 1. Conduct Rules & Policies
- Define school conduct policies and expectations
- Categorize rules (attendance, academic, behavior, respect, safety)
- Set severity levels (minor → critical)
- Configure tiered consequences
- Automatic point tracking towards suspension/expulsion

### 2. Infraction Management
- Record student infractions with full context
- Evidence tracking (photos, videos, documents)
- Automatic parent notifications
- Status tracking (recorded → acknowledged → resolved)
- Appeal capability for disputed infractions

### 3. Discipline Actions
- Assign appropriate consequences to infractions
- Action types: warning, detention, suspension, expulsion, counseling
- Duration tracking and follow-up management
- Automatic parent notifications
- Condition setting and compliance tracking

### 4. Detention System
- Schedule detentions (after-school, weekend, lunch, before-school)
- Attendance tracking
- Supervisor assignment
- Parent notifications
- Rescheduling management

### 5. Behavioral Notes
- Record positive and negative behavioral observations
- Teacher comments and commendations
- Optional student/parent visibility
- Confidential note capability
- Rating system (1-5)

### 6. Appeals Process
- Student or parent can appeal disciplinary actions
- Evidence submission
- Multiple review stages
- Decision tracking (upheld, reduced, overturned)
- Escalation capability

### 7. Conduct Reports
- Periodic conduct summaries by term/semester
- Aggregate infractions and points
- Teacher comments and assessments
- Student strengths and improvement areas
- Parent sharing and acknowledgment

### 8. Analytics & Reporting
- Class-level conduct analytics
- Infraction trending
- Behavioral improvement tracking
- Risk identification
- No-show and absence patterns

## Database Schema

### 11 Core Tables (10 for data + 1 for audit)

```
├── conduct_rules
├── infraction_types
├── student_infractions
├── discipline_actions
├── detention_records
├── behavioral_notes
├── discipline_appeals
├── conduct_reports
├── conduct_analytics
└── discipline_audit_logs
```

### Table Relationships

```
conduct_rules (1) ──→ (many) infraction_types
                          ↓
infraction_types (1) ──→ (many) student_infractions
                                  ↓
                    student_infractions (1) ──→ (many) discipline_actions
                                              ↓
                                 discipline_actions (1) ──→ (many) detention_records
                                                      ↓
                                        discipline_actions (1) ──→ (many) discipline_appeals
```

## Table Details

### 1. conduct_rules
Defines school conduct policies and expected behaviors.

| Column | Type | Purpose |
|--------|------|---------|
| rule_id | UUID | Primary key |
| tenant_id | UUID | Multi-tenancy |
| name | String | Policy name (e.g., "Disrespect to Authority") |
| description | Text | Detailed explanation |
| category | Enum | attendance, academic, behavior, respect, safety |
| severity_level | Enum | minor, moderate, serious, critical |
| points_value | Integer | Points towards suspension (10-100) |
| consequences | JSON | Tiered consequences by occurrence |
| requires_parent_notification | Boolean | Automatic parent alert trigger |
| requires_documentation | Boolean | Evidence requirements |
| active | Boolean | Soft delete capability |
| created_by | UUID | System/admin reference |

**Indexes**: (tenant_id, name), (tenant_id, severity_level), (tenant_id, category)

### 2. infraction_types
Specific types of infractions that violate conduct rules.

| Column | Type | Purpose |
|--------|------|---------|
| infraction_type_id | UUID | Primary key |
| rule_id | UUID | FK to conduct_rules |
| name | String | Specific infraction (e.g., "Talking back to teacher") |
| code | String | Short code (e.g., "DISRESPECT_VERBAL") |
| default_points | Integer | Points for this infraction |
| is_repeatable | Boolean | Can occur multiple times |
| max_occurrences_before_escalation | Integer | Escalation threshold |
| active | Boolean | Enable/disable |

### 3. student_infractions
Individual infraction records for specific students.

| Column | Type | Purpose |
|--------|------|---------|
| infraction_id | UUID | Primary key |
| student_id | UUID | FK to students |
| infraction_type_id | UUID | FK to infraction_types |
| recorded_by | UUID | Teacher/admin who recorded |
| incident_date | Timestamp | When incident occurred |
| incident_description | Text | Detailed account |
| incident_location | String | Where it happened |
| status | Enum | recorded, acknowledged, resolved, appealed |
| severity_override | Integer | Can adjust severity if needed |
| evidence_type | Enum | photo, video, document, none |
| evidence_urls | JSON | URLs to evidence files |
| is_confidential | Boolean | Restrict viewing |
| parent_notified | Boolean | Alert sent to parents |

**Indexes**: (tenant_id, student_id), (tenant_id, incident_date), (tenant_id, status)

### 4. discipline_actions
Disciplinary consequences assigned to infractions.

| Column | Type | Purpose |
|--------|------|---------|
| action_id | UUID | Primary key |
| infraction_id | UUID | FK to student_infractions |
| action_type | Enum | warning, detention, suspension, expulsion, counseling |
| action_subtype | String | in_school_suspension, out_of_school_suspension, etc |
| assigned_by | UUID | Principal/admin assigning |
| start_date | Timestamp | When action begins |
| end_date | Timestamp | When action ends (suspension period) |
| duration_days | Integer | Length of action |
| status | Enum | active, completed, appealed, cancelled |
| conditions | Text | Special requirements/conditions |
| requires_follow_up | Boolean | Schedule follow-up meeting |
| follow_up_date | Timestamp | When to follow up |
| follow_up_assigned_to | UUID | Who conducts follow-up |

### 5. detention_records
Specific detention sessions assigned and tracked.

| Column | Type | Purpose |
|--------|------|---------|
| detention_id | UUID | Primary key |
| action_id | UUID | FK to discipline_actions |
| detention_type | Enum | after_school, weekend, lunch, before_school |
| scheduled_date | Timestamp | When detention occurs |
| start_time | Time | Detention start time |
| end_time | Time | Detention end time |
| location | String | Where detention occurs |
| supervised_by | UUID | Supervisor assigned |
| status | Enum | scheduled, attended, absent, incomplete, rescheduled |
| attended_date | Timestamp | When actually attended |
| supervisor_notes | Text | Notes from supervisor |

### 6. behavioral_notes
Teacher observations of student behavior (positive and negative).

| Column | Type | Purpose |
|--------|------|---------|
| note_id | UUID | Primary key |
| student_id | UUID | FK to students |
| recorded_by | UUID | Teacher recording note |
| note_type | Enum | positive, concern, observation, commendation |
| content | Text | The observation |
| category | Enum | academic, social, emotional, behavioral |
| rating | Integer | 1-5 rating of behavior |
| note_date | Timestamp | When observed |
| parent_notified | Boolean | Alert sent to parent |
| is_shared_with_student | Boolean | Student can see |
| is_confidential | Boolean | Only for staff viewing |

### 7. discipline_appeals
Student/parent appeals of disciplinary actions.

| Column | Type | Purpose |
|--------|------|---------|
| appeal_id | UUID | Primary key |
| action_id | UUID | FK to discipline_actions |
| submitted_by | UUID | Student or parent submitting |
| submitted_by_type | Enum | student, parent, guardian |
| appeal_reason | Text | Why appealing |
| status | Enum | pending, under_review, approved, rejected, escalated |
| evidence | JSON | Supporting documents/files |
| submitted_date | Timestamp | When appeal submitted |
| reviewed_by | UUID | Who reviewed |
| review_notes | Text | Review comments |
| decision_type | Enum | upheld, reduced, overturned |
| modified_action | Text | Updated action if changed |

### 8. conduct_reports
Periodic conduct summaries for students.

| Column | Type | Purpose |
|--------|------|---------|
| report_id | UUID | Primary key |
| student_id | UUID | FK to students |
| report_period | Enum | term, semester, year, custom |
| period_start_date | Date | Report period start |
| period_end_date | Date | Report period end |
| total_infractions | Integer | Count of infractions |
| total_points | Integer | Accumulated points |
| behavioral_rating | Integer | 1-10 overall rating |
| strengths | Text | Positive observations |
| areas_for_improvement | Text | Areas to work on |
| teacher_comments | Text | Detailed feedback |
| overall_assessment | Text | Summary assessment |
| parent_shared | Boolean | Shared with parent |
| parent_acknowledged | Boolean | Parent confirmed receipt |

### 9. conduct_analytics
Aggregate class/school level conduct data.

| Column | Type | Purpose |
|--------|------|---------|
| analytics_id | UUID | Primary key |
| class_id | UUID | FK to classes (optional for school-wide) |
| analytics_date | Date | Calculation date |
| total_students | Integer | Total students analyzed |
| students_with_infractions | Integer | How many have records |
| total_infractions | Integer | Count of infractions |
| total_detentions | Integer | Count of detentions |
| total_suspensions | Integer | Count of suspensions |
| infractions_by_type | JSON | Breakdown by infraction type |
| infractions_by_severity | JSON | Breakdown by severity |
| average_behavior_rating | Decimal | Average rating |
| pending_appeals | Integer | Open appeals count |

### 10. discipline_audit_logs
Complete audit trail of all discipline system actions.

| Column | Type | Purpose |
|--------|------|---------|
| log_id | UUID | Primary key |
| tenant_id | UUID | Multi-tenancy |
| entity_type | String | What was changed (infraction, action, appeal) |
| entity_id | UUID | Which record |
| user_id | UUID | Who made change |
| action | Enum | created, updated, deleted, approved |
| changes | JSON | Before/after values |
| ip_address | String | Source IP |
| user_agent | String | Browser info |
| timestamp | Timestamp | When change occurred |

**Indexes**: (tenant_id, entity_type, entity_id), (tenant_id, timestamp)

## Key Features

### 1. Automatic Parent Notifications
- Triggered by configured rules
- Customizable message templates
- Multi-channel (in-app, email, SMS)
- Delivery confirmation tracking

### 2. Points-Based System
- Each infraction type has point value
- Cumulative points trigger escalation
- Configurable thresholds (e.g., 50 points = suspension)
- Automatic action recommendation

### 3. Evidence Tracking
- Support for multiple evidence types
- File storage integration
- Evidence chain of custody
- Admissibility considerations

### 4. Appeal Process
- Structured appeal workflow
- Multiple review stages
- Evidence submission capability
- Decision tracking and modifications

### 5. Multi-level Notifications
- Infraction recording → In-app alert
- 24-hour escalation → Email to parent
- Serious actions → SMS urgent alert
- Appeals/decisions → Immediate notification

### 6. Soft Deletes & Audit Trail
- No permanent deletion (compliance)
- Complete change history
- User/timestamp tracking
- IP and browser logging

## Integration Points

### With Other Modules
- **Identity Management (2.1)**: Student/staff identification
- **Events Management (2.2)**: Event attendance vs. disciplinary attendance
- **Admissions (1.3)**: Student admission prerequisites
- **Notifications (Phase 9)**: Parent communications
- **Reporting (Phase 7)**: Conduct report generation
- **Dashboard (Phase 10)**: Conduct metrics and alerts
- **Audit (Phase 18)**: Compliance and audit logging

## Security Considerations

1. **RBAC Enforcement**
   - Teachers: Can record infractions, view own class
   - Principals: Can assign actions, approve appeals
   - Super Admin: Full access

2. **Data Confidentiality**
   - Mark sensitive records as confidential
   - Restrict viewing permissions
   - Parent notification controls

3. **Audit Trail**
   - All changes logged with user/timestamp
   - Cannot delete infractions (soft delete only)
   - Export audit reports for compliance

4. **Parent Access**
   - View own child's records (if not confidential)
   - Submit appeals
   - Acknowledge receipt of reports

## Performance Optimization

- **Indexes on frequent queries**:
  - By student_id for individual records
  - By status for active actions
  - By date for reports/analytics
  
- **Materialized analytics** at class level
- **Archive old detention records** to improve query speed
- **Batch processing** for report generation

## Implementation Roadmap

### Phase 2.3 Backend Services (Next)
1. **DisciplineService** (Core)
2. **InfractionService** (Recording)
3. **DisciplineActionService** (Consequences)
4. **DetentionService** (Detention tracking)
5. **AppealService** (Appeal management)
6. **ConductReportService** (Report generation)
7. **DisciplineAnalyticsService** (Analytics)

### Phase 2.3 API Routes
- 30+ endpoints for complete discipline management
- Full CRUD operations
- Appeal workflow endpoints
- Report generation endpoints
- Analytics endpoints

### Phase 2.3 Scheduled Jobs
- Daily appeal notifications
- Weekly detention reminders
- Monthly conduct report generation
- Quarterly analytics aggregation
- Appeal deadline enforcement

### Phase 2.3 Frontend Components
- Infraction recording form
- Discipline action assignment UI
- Detention calendar
- Appeal submission interface
- Conduct reports view
- Analytics dashboards

## Configuration

Schools can configure:
- Points thresholds for actions
- Detention scheduling rules
- Appeal window duration
- Parent notification triggers
- Report generation frequency
- Evidence requirements

---

**Next Step**: Implement Phase 2.3 Backend Services (7 services, ~2,500 lines)
