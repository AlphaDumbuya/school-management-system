# School Management System - Database Schema

## Overview

This document defines the complete PostgreSQL database schema for the School Management System, including tables, columns, constraints, indexes, and relationships.

---

## Database Configuration

**Engine:** PostgreSQL 14+
**Encoding:** UTF-8
**Collation:** en_US.UTF-8
**Character Type:** en_US.UTF-8

**Extensions Required:**
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

---

## Core Tables

### 1. Tenant Table

**Purpose:** Multi-tenant isolation and school information

```sql
CREATE TABLE tenants (
  tenant_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_name VARCHAR(255) NOT NULL,
  logo_url VARCHAR(500),
  contact_info JSONB,
  subscription_tier VARCHAR(50) NOT NULL DEFAULT 'basic',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_subscription_tier CHECK (subscription_tier IN ('basic', 'professional', 'enterprise'))
);

CREATE INDEX idx_tenants_is_active ON tenants(is_active);
CREATE INDEX idx_tenants_created_at ON tenants(created_at);
```

**Columns:**
- `tenant_id`: Unique identifier (UUID)
- `school_name`: School name (required)
- `logo_url`: URL to school logo
- `contact_info`: JSON object with contact details
- `subscription_tier`: Subscription level (basic/professional/enterprise)
- `is_active`: Whether tenant is active
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

---

### 2. User Table

**Purpose:** User accounts and authentication

```sql
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role_id UUID NOT NULL REFERENCES roles(role_id),
  is_active BOOLEAN DEFAULT true,
  is_email_verified BOOLEAN DEFAULT false,
  last_login TIMESTAMP WITH TIME ZONE,
  failed_login_attempts INT DEFAULT 0,
  locked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_username_per_tenant UNIQUE(tenant_id, username),
  CONSTRAINT unique_email_per_tenant UNIQUE(tenant_id, email)
);

CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_role_id ON users(role_id);
```

**Columns:**
- `user_id`: Unique identifier (UUID)
- `tenant_id`: Foreign key to tenant
- `username`: Username (unique per tenant)
- `email`: Email address (unique per tenant)
- `password_hash`: Bcrypt hashed password
- `role_id`: Foreign key to role
- `is_active`: Whether user is active
- `is_email_verified`: Email verification status
- `last_login`: Last login timestamp
- `failed_login_attempts`: Failed login counter
- `locked_until`: Account lockout timestamp
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

---

### 3. Role Table

**Purpose:** Role definitions and permissions

```sql
CREATE TABLE roles (
  role_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  role_name VARCHAR(100) NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]',
  is_custom BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_role_name_per_tenant UNIQUE(tenant_id, role_name)
);

CREATE INDEX idx_roles_tenant_id ON roles(tenant_id);
CREATE INDEX idx_roles_is_active ON roles(is_active);
```

**Columns:**
- `role_id`: Unique identifier (UUID)
- `tenant_id`: Foreign key to tenant
- `role_name`: Role name (unique per tenant)
- `description`: Role description
- `permissions`: JSON array of permission strings
- `is_custom`: Whether role is custom
- `is_active`: Whether role is active
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

**Default Roles:**
```json
[
  {
    "role_name": "Admin",
    "permissions": ["*"]
  },
  {
    "role_name": "Principal",
    "permissions": ["student:*", "grade:*", "attendance:*", "user:read", "report:*"]
  },
  {
    "role_name": "Teacher",
    "permissions": ["grade:read", "grade:write", "attendance:read", "attendance:write", "student:read"]
  },
  {
    "role_name": "Student",
    "permissions": ["student:read_own", "grade:read_own", "attendance:read_own", "fee:read_own"]
  },
  {
    "role_name": "Parent",
    "permissions": ["student:read_child", "grade:read_child", "attendance:read_child", "fee:read_child"]
  },
  {
    "role_name": "Accountant",
    "permissions": ["fee:*", "payment:*", "report:financial"]
  }
]
```

---

### 4. Student Table

**Purpose:** Student information and enrollment

```sql
CREATE TABLE students (
  student_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  date_of_birth DATE,
  gender VARCHAR(10),
  contact_info JSONB,
  guardians JSONB,
  enrollment_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  gpa DECIMAL(3,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'withdrawn')),
  CONSTRAINT valid_gpa CHECK (gpa >= 0 AND gpa <= 4.0)
);

CREATE INDEX idx_students_tenant_id ON students(tenant_id);
CREATE INDEX idx_students_status ON students(status);
CREATE INDEX idx_students_enrollment_date ON students(enrollment_date);
CREATE INDEX idx_students_name ON students(first_name, last_name);
CREATE INDEX idx_students_email ON students(email);
```

**Columns:**
- `student_id`: Unique identifier (UUID)
- `tenant_id`: Foreign key to tenant
- `first_name`: Student first name
- `last_name`: Student last name
- `email`: Student email
- `date_of_birth`: Date of birth
- `gender`: Gender (M/F/Other)
- `contact_info`: JSON object with contact details
- `guardians`: JSON array of guardian information
- `enrollment_date`: Enrollment date
- `status`: Student status (active/inactive/withdrawn)
- `gpa`: Grade point average
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

---

### 5. Class Table

**Purpose:** Class information and management

```sql
CREATE TABLE classes (
  class_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  class_name VARCHAR(100) NOT NULL,
  academic_level VARCHAR(50),
  capacity INT NOT NULL,
  session_id UUID NOT NULL REFERENCES sessions(session_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_capacity CHECK (capacity > 0)
);

CREATE INDEX idx_classes_tenant_id ON classes(tenant_id);
CREATE INDEX idx_classes_session_id ON classes(session_id);
CREATE INDEX idx_classes_name ON classes(class_name);
```

**Columns:**
- `class_id`: Unique identifier (UUID)
- `tenant_id`: Foreign key to tenant
- `class_name`: Class name
- `academic_level`: Academic level (e.g., Grade 1, Grade 2)
- `capacity`: Maximum capacity
- `session_id`: Foreign key to session
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

---

### 6. Subject Table

**Purpose:** Subject definitions

```sql
CREATE TABLE subjects (
  subject_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  subject_code VARCHAR(50) NOT NULL,
  subject_name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_subject_code_per_tenant UNIQUE(tenant_id, subject_code)
);

CREATE INDEX idx_subjects_tenant_id ON subjects(tenant_id);
CREATE INDEX idx_subjects_name ON subjects(subject_name);
```

**Columns:**
- `subject_id`: Unique identifier (UUID)
- `tenant_id`: Foreign key to tenant
- `subject_code`: Subject code (unique per tenant)
- `subject_name`: Subject name
- `description`: Subject description
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

---

### 7. ClassSubject Table

**Purpose:** Mapping classes to subjects and teachers

```sql
CREATE TABLE class_subjects (
  class_subject_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(user_id),
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_class_subject UNIQUE(class_id, subject_id),
  CONSTRAINT valid_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX idx_class_subjects_class_id ON class_subjects(class_id);
CREATE INDEX idx_class_subjects_subject_id ON class_subjects(subject_id);
CREATE INDEX idx_class_subjects_teacher_id ON class_subjects(teacher_id);
```

**Columns:**
- `class_subject_id`: Unique identifier (UUID)
- `class_id`: Foreign key to class
- `subject_id`: Foreign key to subject
- `teacher_id`: Foreign key to teacher user
- `start_date`: Assignment start date
- `end_date`: Assignment end date
- `created_at`: Creation timestamp

---

### 8. Enrollment Table

**Purpose:** Student enrollment in classes

```sql
CREATE TABLE enrollments (
  enrollment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
  enrollment_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_enrollment UNIQUE(student_id, class_id),
  CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'withdrawn'))
);

CREATE INDEX idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX idx_enrollments_class_id ON enrollments(class_id);
CREATE INDEX idx_enrollments_status ON enrollments(status);
```

**Columns:**
- `enrollment_id`: Unique identifier (UUID)
- `student_id`: Foreign key to student
- `class_id`: Foreign key to class
- `enrollment_date`: Enrollment date
- `status`: Enrollment status
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

---

### 9. Grade Table

**Purpose:** Student grades and academic performance

```sql
CREATE TABLE grades (
  grade_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
  grade_value INT NOT NULL,
  letter_grade VARCHAR(2),
  session_id UUID NOT NULL REFERENCES sessions(session_id),
  recorded_by UUID NOT NULL REFERENCES users(user_id),
  recorded_date TIMESTAMP WITH TIME ZONE NOT NULL,
  modified_date TIMESTAMP WITH TIME ZONE,
  modification_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_grade_value CHECK (grade_value >= 0 AND grade_value <= 100),
  CONSTRAINT valid_letter_grade CHECK (letter_grade IN ('A', 'B', 'C', 'D', 'F')),
  CONSTRAINT unique_grade UNIQUE(student_id, subject_id, session_id)
);

CREATE INDEX idx_grades_tenant_id ON grades(tenant_id);
CREATE INDEX idx_grades_student_id ON grades(student_id);
CREATE INDEX idx_grades_subject_id ON grades(subject_id);
CREATE INDEX idx_grades_class_id ON grades(class_id);
CREATE INDEX idx_grades_session_id ON grades(session_id);
CREATE INDEX idx_grades_recorded_date ON grades(recorded_date);
```

**Columns:**
- `grade_id`: Unique identifier (UUID)
- `tenant_id`: Foreign key to tenant
- `student_id`: Foreign key to student
- `subject_id`: Foreign key to subject
- `class_id`: Foreign key to class
- `grade_value`: Numeric grade (0-100)
- `letter_grade`: Letter grade (A-F)
- `session_id`: Foreign key to session
- `recorded_by`: User who recorded the grade
- `recorded_date`: Date grade was recorded
- `modified_date`: Date grade was modified
- `modification_reason`: Reason for modification
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

---

### 10. Attendance Table

**Purpose:** Student attendance tracking

```sql
CREATE TABLE attendance (
  attendance_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL,
  recorded_by UUID NOT NULL REFERENCES users(user_id),
  recorded_date TIMESTAMP WITH TIME ZONE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_status CHECK (status IN ('present', 'absent', 'late')),
  CONSTRAINT unique_attendance UNIQUE(student_id, class_id, session_date)
);

CREATE INDEX idx_attendance_tenant_id ON attendance(tenant_id);
CREATE INDEX idx_attendance_student_id ON attendance(student_id);
CREATE INDEX idx_attendance_class_id ON attendance(class_id);
CREATE INDEX idx_attendance_session_date ON attendance(session_date);
CREATE INDEX idx_attendance_status ON attendance(status);
```

**Columns:**
- `attendance_id`: Unique identifier (UUID)
- `tenant_id`: Foreign key to tenant
- `student_id`: Foreign key to student
- `class_id`: Foreign key to class
- `session_date`: Date of attendance
- `status`: Attendance status (present/absent/late)
- `recorded_by`: User who recorded attendance
- `recorded_date`: Date recorded
- `notes`: Additional notes
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

---

### 11. Schedule Table

**Purpose:** Class schedules and timetables

```sql
CREATE TABLE schedules (
  schedule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(user_id),
  day_of_week INT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location VARCHAR(100),
  session_id UUID NOT NULL REFERENCES sessions(session_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_day CHECK (day_of_week >= 0 AND day_of_week <= 6),
  CONSTRAINT valid_times CHECK (end_time > start_time)
);

CREATE INDEX idx_schedules_tenant_id ON schedules(tenant_id);
CREATE INDEX idx_schedules_class_id ON schedules(class_id);
CREATE INDEX idx_schedules_teacher_id ON schedules(teacher_id);
CREATE INDEX idx_schedules_day_of_week ON schedules(day_of_week);
```

**Columns:**
- `schedule_id`: Unique identifier (UUID)
- `tenant_id`: Foreign key to tenant
- `class_id`: Foreign key to class
- `subject_id`: Foreign key to subject
- `teacher_id`: Foreign key to teacher
- `day_of_week`: Day of week (0=Monday, 6=Sunday)
- `start_time`: Start time
- `end_time`: End time
- `location`: Class location
- `session_id`: Foreign key to session
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

---

### 12. Fee Table

**Purpose:** Fee definitions

```sql
CREATE TABLE fees (
  fee_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  fee_type VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_amount CHECK (amount > 0),
  CONSTRAINT valid_fee_type CHECK (fee_type IN ('tuition', 'activity', 'library', 'transport', 'other'))
);

CREATE INDEX idx_fees_tenant_id ON fees(tenant_id);
CREATE INDEX idx_fees_fee_type ON fees(fee_type);
```

**Columns:**
- `fee_id`: Unique identifier (UUID)
- `tenant_id`: Foreign key to tenant
- `fee_type`: Type of fee
- `amount`: Fee amount
- `due_date`: Due date
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

---

### 13. StudentFee Table

**Purpose:** Student fee assignments

```sql
CREATE TABLE student_fees (
  student_fee_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  fee_id UUID NOT NULL REFERENCES fees(fee_id) ON DELETE CASCADE,
  assignment_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_status CHECK (status IN ('pending', 'partial', 'paid')),
  CONSTRAINT unique_student_fee UNIQUE(student_id, fee_id)
);

CREATE INDEX idx_student_fees_student_id ON student_fees(student_id);
CREATE INDEX idx_student_fees_fee_id ON student_fees(fee_id);
CREATE INDEX idx_student_fees_status ON student_fees(status);
CREATE INDEX idx_student_fees_due_date ON student_fees(due_date);
```

**Columns:**
- `student_fee_id`: Unique identifier (UUID)
- `student_id`: Foreign key to student
- `fee_id`: Foreign key to fee
- `assignment_date`: Date fee was assigned
- `due_date`: Due date
- `status`: Payment status
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

---

### 14. Payment Table

**Purpose:** Payment records

```sql
CREATE TABLE payments (
  payment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  student_fee_id UUID NOT NULL REFERENCES student_fees(student_fee_id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  transaction_id VARCHAR(100),
  is_late BOOLEAN DEFAULT false,
  penalty_amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_amount CHECK (amount > 0),
  CONSTRAINT valid_payment_method CHECK (payment_method IN ('credit_card', 'debit_card', 'bank_transfer', 'cash', 'check'))
);

CREATE INDEX idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX idx_payments_student_fee_id ON payments(student_fee_id);
CREATE INDEX idx_payments_payment_date ON payments(payment_date);
CREATE INDEX idx_payments_transaction_id ON payments(transaction_id);
```

**Columns:**
- `payment_id`: Unique identifier (UUID)
- `tenant_id`: Foreign key to tenant
- `student_fee_id`: Foreign key to student fee
- `amount`: Payment amount
- `payment_date`: Payment date
- `payment_method`: Payment method
- `transaction_id`: External transaction ID
- `is_late`: Whether payment is late
- `penalty_amount`: Late payment penalty
- `created_at`: Creation timestamp

---

### 15. AuditLog Table

**Purpose:** Audit trail for compliance

```sql
CREATE TABLE audit_logs (
  audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(user_id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ip_address INET,
  user_agent TEXT,
  
  CONSTRAINT valid_action CHECK (action IN ('create', 'read', 'update', 'delete', 'login', 'logout'))
);

CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
```

**Columns:**
- `audit_id`: Unique identifier (UUID)
- `tenant_id`: Foreign key to tenant
- `user_id`: Foreign key to user
- `action`: Action performed
- `entity_type`: Type of entity
- `entity_id`: ID of entity
- `old_values`: Previous values (JSON)
- `new_values`: New values (JSON)
- `timestamp`: Action timestamp
- `ip_address`: IP address
- `user_agent`: User agent string

---

### 16. Session Table

**Purpose:** Academic sessions/terms

```sql
CREATE TABLE sessions (
  session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  session_name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_dates CHECK (end_date >= start_date),
  CONSTRAINT unique_session_name UNIQUE(tenant_id, session_name)
);

CREATE INDEX idx_sessions_tenant_id ON sessions(tenant_id);
CREATE INDEX idx_sessions_is_active ON sessions(is_active);
CREATE INDEX idx_sessions_start_date ON sessions(start_date);
```

**Columns:**
- `session_id`: Unique identifier (UUID)
- `tenant_id`: Foreign key to tenant
- `session_name`: Session name
- `start_date`: Start date
- `end_date`: End date
- `is_active`: Whether session is active
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

---

## Views

### StudentGradesSummary View

```sql
CREATE VIEW student_grades_summary AS
SELECT
  s.student_id,
  s.first_name,
  s.last_name,
  COUNT(g.grade_id) as total_grades,
  AVG(g.grade_value) as average_grade,
  MIN(g.grade_value) as lowest_grade,
  MAX(g.grade_value) as highest_grade,
  s.gpa
FROM students s
LEFT JOIN grades g ON s.student_id = g.student_id
GROUP BY s.student_id, s.first_name, s.last_name, s.gpa;
```

### StudentAttendanceSummary View

```sql
CREATE VIEW student_attendance_summary AS
SELECT
  s.student_id,
  s.first_name,
  s.last_name,
  COUNT(a.attendance_id) as total_sessions,
  SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
  SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
  SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_count,
  ROUND(100.0 * SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) / COUNT(a.attendance_id), 2) as attendance_percentage
FROM students s
LEFT JOIN attendance a ON s.student_id = a.student_id
GROUP BY s.student_id, s.first_name, s.last_name;
```

### StudentFinancialSummary View

```sql
CREATE VIEW student_financial_summary AS
SELECT
  s.student_id,
  s.first_name,
  s.last_name,
  SUM(sf.fee_id IS NOT NULL)::INT as total_fees,
  SUM(CASE WHEN sf.status = 'paid' THEN 1 ELSE 0 END) as paid_fees,
  SUM(CASE WHEN sf.status = 'pending' THEN 1 ELSE 0 END) as pending_fees,
  SUM(CASE WHEN sf.status = 'partial' THEN 1 ELSE 0 END) as partial_fees,
  COALESCE(SUM(p.amount), 0) as total_paid,
  COALESCE(SUM(CASE WHEN sf.status IN ('pending', 'partial') THEN f.amount ELSE 0 END), 0) as outstanding_balance
FROM students s
LEFT JOIN student_fees sf ON s.student_id = sf.student_id
LEFT JOIN fees f ON sf.fee_id = f.fee_id
LEFT JOIN payments p ON sf.student_fee_id = p.student_fee_id
GROUP BY s.student_id, s.first_name, s.last_name;
```

---

## Triggers

### Update Updated_At Timestamp

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grades_updated_at BEFORE UPDATE ON grades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add similar triggers for other tables
```

### Audit Log Trigger

```sql
CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    tenant_id,
    user_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    timestamp
  ) VALUES (
    NEW.tenant_id,
    current_user_id(),
    TG_ARGV[0],
    TG_TABLE_NAME,
    NEW.id,
    to_jsonb(OLD),
    to_jsonb(NEW),
    CURRENT_TIMESTAMP
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## Row-Level Security (RLS)

### Enable RLS on All Tables

```sql
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for tenant isolation
CREATE POLICY tenant_isolation_students ON students
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_grades ON grades
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Add similar policies for other tables
```

---

## Indexes Summary

**Performance Indexes:**
- Tenant ID indexes on all tables (multi-tenant queries)
- Foreign key indexes (join performance)
- Status indexes (filtering)
- Date indexes (range queries)
- Name/email indexes (search)

**Total Indexes:** 50+

---

## Constraints Summary

**Primary Keys:** 16 tables
**Foreign Keys:** 30+ relationships
**Unique Constraints:** 15+
**Check Constraints:** 20+

---

## Backup & Recovery

**Backup Strategy:**
- Full backup: Daily at 02:00 UTC
- Incremental backup: Hourly
- Point-in-time recovery: 30 days
- Cross-region backup: Daily

**Backup Commands:**
```bash
# Full backup
pg_dump -U postgres -h localhost sms_db > backup.sql

# Restore
psql -U postgres -h localhost sms_db < backup.sql
```

