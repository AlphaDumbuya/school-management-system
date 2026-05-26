# Phase 2: Database Design and Implementation

## Overview

Phase 2 focuses on designing and implementing the PostgreSQL database schema using Neon. This phase includes:
- Database schema design
- Table creation with relationships
- Index optimization
- Row-Level Security (RLS) implementation
- Database migrations setup
- Seed data creation

**Duration**: Weeks 2-3 (approximately 40-50 hours)

---

## Phase 2.1: Database Schema Design

### Core Tables Design

#### 1. Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL, -- admin, principal, teacher, student, parent, accountant, admissions_officer
  status VARCHAR(50) DEFAULT 'active', -- active, inactive, suspended
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
```

#### 2. Students Table
```sql
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id VARCHAR(50) UNIQUE NOT NULL, -- Auto-generated ID like STU-2024-001
  date_of_birth DATE NOT NULL,
  gender VARCHAR(20),
  phone VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100),
  status VARCHAR(50) DEFAULT 'active', -- active, inactive, withdrawn
  enrollment_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_students_student_id ON students(student_id);
CREATE INDEX idx_students_status ON students(status);
CREATE INDEX idx_students_user_id ON students(user_id);
```

#### 3. Teachers Table
```sql
CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  teacher_id VARCHAR(50) UNIQUE NOT NULL, -- Auto-generated ID like TCH-2024-001
  qualifications TEXT,
  experience_years INTEGER,
  specialization VARCHAR(100),
  phone VARCHAR(20),
  office_location VARCHAR(100),
  status VARCHAR(50) DEFAULT 'active', -- active, inactive, on_leave
  hire_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_teachers_teacher_id ON teachers(teacher_id);
CREATE INDEX idx_teachers_status ON teachers(status);
CREATE INDEX idx_teachers_user_id ON teachers(user_id);
```

#### 4. Academic Sessions Table
```sql
CREATE TABLE academic_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL, -- e.g., "2024-2025"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_academic_sessions_is_active ON academic_sessions(is_active);
```

#### 5. Classes Table
```sql
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL, -- e.g., "10-A"
  level VARCHAR(50) NOT NULL, -- e.g., "10", "11", "12"
  capacity INTEGER NOT NULL,
  academic_session_id UUID NOT NULL REFERENCES academic_sessions(id),
  class_teacher_id UUID REFERENCES teachers(id),
  room_number VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_classes_academic_session_id ON classes(academic_session_id);
CREATE INDEX idx_classes_level ON classes(level);
```

#### 6. Subjects Table
```sql
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL, -- e.g., "MATH101"
  name VARCHAR(100) NOT NULL,
  description TEXT,
  credits INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subjects_code ON subjects(code);
```

#### 7. Class Subjects Table
```sql
CREATE TABLE class_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(class_id, subject_id)
);

CREATE INDEX idx_class_subjects_class_id ON class_subjects(class_id);
CREATE INDEX idx_class_subjects_subject_id ON class_subjects(subject_id);
```

#### 8. Teacher Assignments Table
```sql
CREATE TABLE teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id),
  class_id UUID NOT NULL REFERENCES classes(id),
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_teacher_assignments_teacher_id ON teacher_assignments(teacher_id);
CREATE INDEX idx_teacher_assignments_class_id ON teacher_assignments(class_id);
```

#### 9. Enrollments Table
```sql
CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id),
  academic_session_id UUID NOT NULL REFERENCES academic_sessions(id),
  enrollment_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'active', -- active, inactive, withdrawn
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, class_id, academic_session_id)
);

CREATE INDEX idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX idx_enrollments_class_id ON enrollments(class_id);
CREATE INDEX idx_enrollments_status ON enrollments(status);
```

#### 10. Grades Table
```sql
CREATE TABLE grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id),
  teacher_id UUID NOT NULL REFERENCES teachers(id),
  grade_value DECIMAL(5, 2) NOT NULL, -- 0-100
  grade_letter VARCHAR(2), -- A, B, C, D, F
  exam_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'draft', -- draft, submitted, finalized
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_grades_student_id ON grades(student_id);
CREATE INDEX idx_grades_subject_id ON grades(subject_id);
CREATE INDEX idx_grades_status ON grades(status);
```

#### 11. Attendance Table
```sql
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id),
  attendance_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL, -- present, absent, late
  marked_by UUID REFERENCES teachers(id),
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_attendance_student_id ON attendance(student_id);
CREATE INDEX idx_attendance_class_id ON attendance(class_id);
CREATE INDEX idx_attendance_date ON attendance(attendance_date);
CREATE INDEX idx_attendance_status ON attendance(status);
```

#### 12. Schedules Table
```sql
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id),
  subject_id UUID NOT NULL REFERENCES subjects(id),
  teacher_id UUID NOT NULL REFERENCES teachers(id),
  day_of_week VARCHAR(20) NOT NULL, -- Monday, Tuesday, etc.
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room_number VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_schedules_class_id ON schedules(class_id);
CREATE INDEX idx_schedules_teacher_id ON schedules(teacher_id);
```

#### 13. Fee Types Table
```sql
CREATE TABLE fee_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL, -- Tuition, Lab Fee, etc.
  description TEXT,
  amount DECIMAL(10, 2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fee_types_is_active ON fee_types(is_active);
```

#### 14. Fees Table
```sql
CREATE TABLE fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_type_id UUID NOT NULL REFERENCES fee_types(id),
  amount DECIMAL(10, 2) NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, partial, paid, overdue
  academic_session_id UUID REFERENCES academic_sessions(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fees_student_id ON fees(student_id);
CREATE INDEX idx_fees_status ON fees(status);
CREATE INDEX idx_fees_due_date ON fees(due_date);
```

#### 15. Payments Table
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method VARCHAR(50) NOT NULL, -- cash, check, online, bank_transfer
  reference_number VARCHAR(100),
  status VARCHAR(50) DEFAULT 'completed', -- pending, completed, failed, refunded
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_student_id ON payments(student_id);
CREATE INDEX idx_payments_payment_date ON payments(payment_date);
CREATE INDEX idx_payments_status ON payments(status);
```

#### 16. Audit Logs Table
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL, -- create, update, delete, login, etc.
  entity_type VARCHAR(100) NOT NULL, -- students, grades, payments, etc.
  entity_id UUID,
  changes JSONB, -- Store what changed
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

#### 17. Notifications Table
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- email, sms, in_app
  subject VARCHAR(255),
  message TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, sent, failed, read
  sent_at TIMESTAMP,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status);
```

---

## Phase 2.2: Database Implementation Steps

### Step 1: Create Database in Neon

```bash
# Connect to Neon using psql
psql postgresql://user:password@host/school_management

# Create all tables (run the SQL above)
```

### Step 2: Set Up Migrations with Knex.js

```bash
# Install Knex.js
npm install knex --save-dev

# Initialize Knex
npx knex init

# Create migration for initial schema
npx knex migrate:make initial_schema
```

### Step 3: Implement Row-Level Security (RLS)

```sql
-- Enable RLS on sensitive tables
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for students (students can only see their own records)
CREATE POLICY student_own_records ON students
  FOR SELECT
  USING (user_id = current_user_id());

-- Create RLS policies for teachers (teachers can see their assigned classes)
CREATE POLICY teacher_class_records ON grades
  FOR SELECT
  USING (teacher_id IN (
    SELECT id FROM teachers WHERE user_id = current_user_id()
  ));
```

### Step 4: Create Indexes for Performance

All indexes are included in the table definitions above.

### Step 5: Set Up Seed Data

Create seed scripts for:
- Academic sessions
- Users (admin, teachers, students, parents)
- Classes and subjects
- Enrollments
- Sample grades and attendance

---

## Phase 2.3: Database Connection in Backend

### Create Database Service

Create `backend/src/services/database.ts`:

```typescript
import pg from 'pg';
import { logger } from '@utils/logger';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DATABASE_POOL_SIZE || '20'),
  idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '300000'),
  connectionTimeoutMillis: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '30000'),
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
});

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

export const getClient = () => {
  return pool.connect();
};

export const closePool = () => {
  return pool.end();
};
```

---

## Checklist for Phase 2 Completion

- [ ] All 17 tables created in Neon
- [ ] All indexes created for performance
- [ ] Foreign key relationships verified
- [ ] Row-Level Security (RLS) policies implemented
- [ ] Database migrations set up with Knex.js
- [ ] Seed data scripts created
- [ ] Database connection tested from backend
- [ ] Health check endpoint verifies database connection
- [ ] Backup configuration verified in Neon
- [ ] Documentation updated

---

## Next Steps

After Phase 2 completion:
1. Move to Phase 3: Backend Architecture and API Framework
2. Create API endpoints for CRUD operations
3. Implement authentication and authorization
4. Set up API documentation with Swagger

---

## Troubleshooting

### Connection Issues
- Verify DATABASE_URL in .env
- Check Neon dashboard for connection details
- Test with: `psql [connection_string]`

### Migration Issues
- Check migration files are in correct format
- Verify SQL syntax
- Check Knex configuration

### Performance Issues
- Review indexes are created
- Check query execution plans
- Monitor connection pool usage
