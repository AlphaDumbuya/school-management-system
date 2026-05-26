# School Management System - Technical Design Document

## Overview

The School Management System is a multi-tenant SaaS application designed to manage all aspects of school operations including student enrollment, academic performance tracking, attendance management, class scheduling, fee collection, and reporting. The system supports multiple user roles with granular permission controls and is built for scalability, security, and data isolation.

**Key Design Principles:**
- Multi-tenant architecture with complete data isolation
- RESTful API design for all features
- JWT-based authentication with role-based access control
- Horizontal scalability through stateless services
- Comprehensive audit trails for compliance
- Property-based testing for core business logic

## Architecture

**High-Level System Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Web Portal   │  │ Mobile App   │  │ Admin Panel  │           │
│  │ (React)      │  │ (React Native)│  │ (React)      │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  API Gateway      │
                    │  (Rate Limiting,  │
                    │   Auth, Routing)  │
                    └─────────┬─────────┘
┌─────────────────────────────────────────────────────────────────┐
│                    Application Layer                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Node.js/Express Microservices                            │   │
│  │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │   │
│  │ │ Auth Service │ │ Academic     │ │ Finance      │      │   │
│  │ │              │ │ Service      │ │ Service      │      │   │
│  │ └──────────────┘ └──────────────┘ └──────────────┘      │   │
│  │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │   │
│  │ │ Enrollment   │ │ Reporting    │ │ Notification │      │   │
│  │ │ Service      │ │ Service      │ │ Service      │      │   │
│  │ └──────────────┘ └──────────────┘ └──────────────┘      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
│  PostgreSQL    │  │  Redis Cache    │  │  Message Queue  │
│  (Multi-tenant)│  │  (Session/Cache)│  │  (RabbitMQ)     │
└────────────────┘  └─────────────────┘  └─────────────────┘
        │
┌───────▼────────────────────────────────────────────────────┐
│  External Integrations                                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ Email        │ │ SMS          │ │ Payment      │       │
│  │ Service      │ │ Service      │ │ Gateway      │       │
│  └──────────────┘ └──────────────┘ └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

**Core Components:**

1. **Authentication Service**
   - JWT token generation and validation
   - Password hashing and verification
   - Session management
   - Multi-factor authentication support

2. **Academic Service**
   - Grade management and calculation
   - Attendance tracking
   - Class and subject management
   - Performance analytics

3. **Enrollment Service**
   - Student registration
   - Class enrollment
   - Enrollment validation
   - Bulk import/export

4. **Finance Service**
   - Fee management
   - Payment processing
   - Invoice generation
   - Financial reporting

5. **Reporting Service**
   - Report generation
   - Data export (PDF, Excel, CSV)
   - Scheduled reports
   - Analytics dashboard

6. **Notification Service**
   - Email notifications
   - SMS notifications
   - In-app notifications
   - Notification preferences

7. **Audit Service**
   - Audit log recording
   - Compliance reporting
   - Data access tracking

## Data Models

**Core Entities:**

```
Tenant
├── tenant_id (UUID, PK)
├── school_name
├── logo_url
├── contact_info
├── subscription_tier
├── created_at
└── updated_at

User
├── user_id (UUID, PK)
├── tenant_id (FK)
├── username (unique per tenant)
├── email
├── password_hash
├── role_id (FK)
├── is_active
├── last_login
├── created_at
└── updated_at

Role
├── role_id (UUID, PK)
├── tenant_id (FK)
├── role_name
├── permissions (JSON array)
├── is_custom
├── created_at
└── updated_at

Student
├── student_id (UUID, PK)
├── tenant_id (FK)
├── first_name
├── last_name
├── date_of_birth
├── gender
├── contact_info (JSON)
├── guardians (JSON array)
├── enrollment_date
├── status (active/inactive/withdrawn)
├── created_at
└── updated_at

Class
├── class_id (UUID, PK)
├── tenant_id (FK)
├── class_name
├── academic_level
├── capacity
├── session_id (FK)
├── created_at
└── updated_at

Subject
├── subject_id (UUID, PK)
├── tenant_id (FK)
├── subject_code
├── subject_name
├── description
├── created_at
└── updated_at

ClassSubject
├── class_subject_id (UUID, PK)
├── class_id (FK)
├── subject_id (FK)
├── teacher_id (FK)
├── start_date
├── end_date
└── created_at

Grade
├── grade_id (UUID, PK)
├── tenant_id (FK)
├── student_id (FK)
├── subject_id (FK)
├── class_id (FK)
├── grade_value (0-100)
├── letter_grade (A-F)
├── session_id (FK)
├── recorded_by (FK to User)
├── recorded_date
├── modified_date
├── modification_reason
├── created_at
└── updated_at

Attendance
├── attendance_id (UUID, PK)
├── tenant_id (FK)
├── student_id (FK)
├── class_id (FK)
├── session_date
├── status (present/absent/late)
├── recorded_by (FK to User)
├── recorded_date
├── notes
├── created_at
└── updated_at

Schedule
├── schedule_id (UUID, PK)
├── tenant_id (FK)
├── class_id (FK)
├── subject_id (FK)
├── teacher_id (FK)
├── day_of_week
├── start_time
├── end_time
├── location
├── session_id (FK)
├── created_at
└── updated_at

Fee
├── fee_id (UUID, PK)
├── tenant_id (FK)
├── fee_type
├── amount
├── due_date
├── created_at
└── updated_at

StudentFee
├── student_fee_id (UUID, PK)
├── student_id (FK)
├── fee_id (FK)
├── assignment_date
├── due_date
├── status (pending/partial/paid)
├── created_at
└── updated_at

Payment
├── payment_id (UUID, PK)
├── tenant_id (FK)
├── student_fee_id (FK)
├── amount
├── payment_date
├── payment_method
├── transaction_id
├── is_late
├── penalty_amount
├── created_at
└── updated_at

AuditLog
├── audit_id (UUID, PK)
├── tenant_id (FK)
├── user_id (FK)
├── action
├── entity_type
├── entity_id
├── old_values (JSON)
├── new_values (JSON)
├── timestamp
└── ip_address

Session
├── session_id (UUID, PK)
├── tenant_id (FK)
├── session_name
├── start_date
├── end_date
├── is_active
├── created_at
└── updated_at
```

## API Endpoints

**Authentication Endpoints:**
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh JWT token
- `POST /api/v1/auth/logout` - User logout
- `POST /api/v1/auth/password-reset` - Request password reset
- `POST /api/v1/auth/password-reset/confirm` - Confirm password reset

**Student Endpoints:**
- `GET /api/v1/students` - List students (with pagination)
- `POST /api/v1/students` - Create new student
- `GET /api/v1/students/:id` - Get student details
- `PUT /api/v1/students/:id` - Update student
- `DELETE /api/v1/students/:id` - Deactivate student
- `POST /api/v1/students/bulk-import` - Bulk import students
- `GET /api/v1/students/:id/grades` - Get student grades
- `GET /api/v1/students/:id/attendance` - Get student attendance
- `GET /api/v1/students/:id/fees` - Get student fees

**Class Endpoints:**
- `GET /api/v1/classes` - List classes
- `POST /api/v1/classes` - Create class
- `GET /api/v1/classes/:id` - Get class details
- `PUT /api/v1/classes/:id` - Update class
- `GET /api/v1/classes/:id/students` - Get enrolled students
- `POST /api/v1/classes/:id/enroll` - Enroll student
- `DELETE /api/v1/classes/:id/students/:studentId` - Remove student

**Grade Endpoints:**
- `GET /api/v1/grades` - List grades (filtered)
- `POST /api/v1/grades` - Record grade
- `PUT /api/v1/grades/:id` - Update grade
- `GET /api/v1/grades/student/:studentId` - Get student grades
- `GET /api/v1/grades/class/:classId` - Get class grades
- `POST /api/v1/grades/bulk-entry` - Bulk grade entry

**Attendance Endpoints:**
- `GET /api/v1/attendance` - List attendance records
- `POST /api/v1/attendance` - Record attendance
- `PUT /api/v1/attendance/:id` - Update attendance
- `GET /api/v1/attendance/student/:studentId` - Get student attendance
- `GET /api/v1/attendance/class/:classId` - Get class attendance
- `POST /api/v1/attendance/bulk-import` - Bulk import attendance

**Schedule Endpoints:**
- `GET /api/v1/schedules` - List schedules
- `POST /api/v1/schedules` - Create schedule
- `PUT /api/v1/schedules/:id` - Update schedule
- `DELETE /api/v1/schedules/:id` - Delete schedule
- `GET /api/v1/schedules/class/:classId` - Get class schedule
- `GET /api/v1/schedules/teacher/:teacherId` - Get teacher schedule

**Fee Endpoints:**
- `GET /api/v1/fees` - List fees
- `POST /api/v1/fees` - Create fee
- `GET /api/v1/fees/student/:studentId` - Get student fees
- `POST /api/v1/payments` - Record payment
- `GET /api/v1/payments/student/:studentId` - Get student payments
- `GET /api/v1/payments/:id/receipt` - Generate receipt

**Report Endpoints:**
- `POST /api/v1/reports/generate` - Generate report
- `GET /api/v1/reports/:id` - Get report
- `POST /api/v1/reports/:id/export` - Export report
- `POST /api/v1/reports/schedule` - Schedule report

**User Management Endpoints:**
- `GET /api/v1/users` - List users
- `POST /api/v1/users` - Create user
- `PUT /api/v1/users/:id` - Update user
- `DELETE /api/v1/users/:id` - Deactivate user
- `GET /api/v1/roles` - List roles
- `POST /api/v1/roles` - Create role
- `PUT /api/v1/roles/:id` - Update role

**Audit Endpoints:**
- `GET /api/v1/audit-logs` - List audit logs
- `GET /api/v1/audit-logs/:id` - Get audit log details

## Authentication and Authorization

**JWT Token Structure:**
```json
{
  "sub": "user_id",
  "tenant_id": "tenant_id",
  "role": "teacher",
  "permissions": ["grade:read", "grade:write", "attendance:read"],
  "iat": 1234567890,
  "exp": 1234571490,
  "iss": "school-management-system"
}
```

**Role-Based Access Control:**

| Role | Permissions |
|------|-------------|
| Admin | All permissions |
| Principal | Academic management, user management, reporting (no system config) |
| Teacher | Grade entry, attendance marking, view assigned classes |
| Student | View own grades, attendance, schedule, fees |
| Parent | View child's grades, attendance, schedule, fees |
| Accountant | Fee management, payment recording, financial reports |

**Authentication Flow:**
1. User submits credentials
2. System validates against password hash
3. JWT token generated with user claims
4. Token returned to client
5. Client includes token in Authorization header for subsequent requests
6. Server validates token signature and expiration
7. Token refresh endpoint allows extending session without re-login

## Multi-Tenant Data Isolation

**Isolation Strategy:**

1. **Row-Level Security (RLS)**
   - All queries filtered by `tenant_id`
   - Database policies enforce tenant isolation
   - Prevent accidental cross-tenant data access

2. **Application-Level Isolation**
   - Extract `tenant_id` from JWT token
   - Include `tenant_id` in all queries
   - Validate `tenant_id` matches authenticated user

3. **Database Schema**
   - `tenant_id` as foreign key in all tables
   - Composite indexes on (tenant_id, entity_id)
   - Separate schemas per tenant (optional for extreme isolation)

4. **Audit Trail**
   - All data modifications logged with tenant context
   - Audit logs include user, timestamp, and changes
   - Compliance reporting by tenant

## Error Handling

**Error Response Format:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input provided",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ],
    "timestamp": "2024-01-15T10:30:00Z",
    "request_id": "req_123456"
  }
}
```

**Error Codes:**
- `VALIDATION_ERROR` (400) - Input validation failed
- `AUTHENTICATION_ERROR` (401) - Authentication failed
- `AUTHORIZATION_ERROR` (403) - User lacks permission
- `NOT_FOUND` (404) - Resource not found
- `CONFLICT` (409) - Resource conflict (e.g., duplicate)
- `RATE_LIMIT_EXCEEDED` (429) - Rate limit exceeded
- `INTERNAL_ERROR` (500) - Server error
- `SERVICE_UNAVAILABLE` (503) - Service temporarily unavailable

## Testing Strategy

**Unit Testing:**
- Test individual functions and methods
- Mock external dependencies
- Focus on business logic validation
- Minimum 80% code coverage

**Integration Testing:**
- Test API endpoints with representative data
- Test database interactions
- Test external service integrations
- Test error scenarios

**Property-Based Testing (PBT):**
- Grade round-trip: Serialization/deserialization preserves data
- Attendance calculations: Idempotence of attendance percentage
- Fee calculations: Metamorphic properties for partial payments
- Schedule conflicts: Invariant that no teacher teaches two classes simultaneously
- Data import: Round-trip for bulk import/export operations

**Performance Testing:**
- Query performance: <2 seconds for 10,000 students
- Report generation: <5 seconds for standard reports
- Concurrent users: Support 100+ concurrent users
- Load testing with realistic data volumes

## Backup and Disaster Recovery

**Backup Strategy:**
- Daily automated backups at configured time
- Point-in-time recovery capability
- Backup verification and integrity checks
- Encrypted backup storage
- Retention policy: 30 days daily, 12 months monthly

**Disaster Recovery:**
- RTO (Recovery Time Objective): 4 hours
- RPO (Recovery Point Objective): 1 hour
- Automated failover to standby database
- Regular DR drills and testing
- Documented recovery procedures

## Performance Optimization

**Database Optimization:**
- Composite indexes on frequently queried columns
- Query optimization and execution plan analysis
- Connection pooling for efficient resource usage
- Caching frequently accessed data in Redis

**API Optimization:**
- Pagination for large result sets
- Field filtering to reduce payload size
- Compression (gzip) for responses
- Rate limiting to prevent abuse

**Scalability:**
- Stateless application servers for horizontal scaling
- Load balancing across multiple instances
- Database read replicas for reporting queries
- Message queue for asynchronous operations

This design document provides a comprehensive technical foundation for implementing the School Management System as a scalable, secure, multi-tenant SaaS application.
