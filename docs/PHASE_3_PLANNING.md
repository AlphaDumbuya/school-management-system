# Phase 3 Implementation Plan - Core Data Models

**Current Status**: Phase 2 Complete ✅  
**Ready to Start**: Phase 3 - Core Data Models  
**Estimated Duration**: 2 weeks (10 working days)  
**Team Size Recommended**: 2 developers

---

## Phase 3 Overview

Phase 3 focuses on implementing the core data models that form the foundation of the school management system. These models represent the key entities in a school: Students, Guardians/Parents, Classes, Subjects, Teachers, and Enrollments.

**Phase 3 Dependencies**:
- ✅ Phase 1 (Infrastructure) - COMPLETE
- ✅ Phase 2 (Authentication) - COMPLETE
- → Phase 3 (Data Models) - READY TO START

**Phase 3 Outputs**:
- 6 new services (Student, Guardian, Class, Subject, Teacher, Enrollment)
- 6 database tables with proper relationships
- Validation logic for each entity
- Audit logging for all operations
- RESTful API endpoints for CRUD operations
- Unit tests for business logic

---

## Task Breakdown

### 3.1 Implement Student Model and Management

**Estimated Time**: 2 days  
**Dependencies**: Phase 2 Auth (for user_id foreign key), Database setup

**Deliverables**:
1. **Database Table**: `students`
   - Primary Key: `student_id` (VARCHAR, unique)
   - Foreign Key: `user_id` (UUID references users)
   - Fields:
     - `first_name` (VARCHAR)
     - `last_name` (VARCHAR)
     - `date_of_birth` (DATE)
     - `gender` (ENUM: Male, Female, Other)
     - `phone_number` (VARCHAR, optional)
     - `email` (VARCHAR, optional)
     - `address_line_1` (TEXT, optional)
     - `address_line_2` (TEXT, optional)
     - `city` (VARCHAR, optional)
     - `state` (VARCHAR, optional)
     - `postal_code` (VARCHAR, optional)
     - `country` (VARCHAR, optional)
     - `status` (ENUM: active, inactive, withdrawn)
     - `enrollment_date` (DATE)
     - `photo_url` (VARCHAR, optional - for UploadThing)
     - `created_at`, `updated_at`, `created_by`, `updated_by`

2. **StudentService** (`backend/src/services/studentService.ts`)
   - [ ] `createStudent(data)` - Create new student with validation
   - [ ] `getStudentById(studentId)` - Retrieve student by ID
   - [ ] `getStudentByUserId(userId)` - Get student linked to user
   - [ ] `listStudents(filters)` - List students with pagination and filtering
   - [ ] `updateStudent(studentId, data)` - Update student information
   - [ ] `deactivateStudent(studentId)` - Soft delete student
   - [ ] `reactivateStudent(studentId)` - Reactivate student
   - [ ] `validateStudentData(data)` - Validate input data
   - [ ] `generateStudentId()` - Generate unique student ID
   - [ ] `getStudentEnrollments(studentId)` - Get all enrollments for student

3. **Validation Rules**:
   - Required: first_name, last_name, date_of_birth, gender, enrollment_date
   - Date of birth: Must be valid date, not future
   - Email: Valid format if provided
   - Phone: Valid format if provided
   - Student ID: Auto-generated, unique (e.g., STU-2024-001)

4. **API Endpoints**:
   - `POST /api/v1/students` - Create student (teacher, principal, admin)
   - `GET /api/v1/students` - List students with filtering (teacher, principal, admin)
   - `GET /api/v1/students/:studentId` - Get student details (authorized users)
   - `PUT /api/v1/students/:studentId` - Update student (admin, principal, student self)
   - `DELETE /api/v1/students/:studentId` - Deactivate student (admin only)
   - `POST /api/v1/students/:studentId/reactivate` - Reactivate student (admin only)

5. **Testing**:
   - [ ] Unit tests for StudentService
   - [ ] Tests for validation rules
   - [ ] Tests for student creation and update

**Implementation Priority**: 🔴 HIGH (Foundational entity)

---

### 3.2 Implement Guardian/Parent Model

**Estimated Time**: 2 days  
**Dependencies**: Student model (3.1), User system (Phase 2)

**Deliverables**:
1. **Database Table**: `guardians`
   - Primary Key: `guardian_id` (UUID)
   - Foreign Keys: 
     - `user_id` (UUID references users, optional)
     - `student_id` (UUID references students)
   - Fields:
     - `first_name` (VARCHAR)
     - `last_name` (VARCHAR)
     - `relationship` (ENUM: Mother, Father, Guardian, Uncle, Aunt, Grandparent, Other)
     - `phone_number` (VARCHAR)
     - `email` (VARCHAR)
     - `occupation` (VARCHAR, optional)
     - `address_same_as_student` (BOOLEAN)
     - `address_line_1` (TEXT, optional)
     - `address_line_2` (TEXT, optional)
     - `city` (VARCHAR, optional)
     - `state` (VARCHAR, optional)
     - `postal_code` (VARCHAR, optional)
     - `country` (VARCHAR, optional)
     - `is_primary_guardian` (BOOLEAN)
     - `created_at`, `updated_at`, `created_by`, `updated_by`

2. **GuardianService** (`backend/src/services/guardianService.ts`)
   - [ ] `addGuardian(studentId, guardianData)` - Add guardian to student
   - [ ] `getGuardianById(guardianId)` - Get guardian details
   - [ ] `getStudentGuardians(studentId)` - Get all guardians for a student
   - [ ] `updateGuardian(guardianId, data)` - Update guardian info
   - [ ] `removeGuardian(guardianId)` - Remove guardian
   - [ ] `setPrimaryGuardian(guardianId, studentId)` - Set as primary
   - [ ] `validateGuardianData(data)` - Validate input data
   - [ ] `notifyGuardianOfEnrollment(guardianId)` - Send notification (phase 10)

3. **Relationship to Parent Users**:
   - Guardians can be linked to user accounts
   - Parents can have multiple student children
   - Each guardian-student combination tracked in database

4. **API Endpoints**:
   - `POST /api/v1/students/:studentId/guardians` - Add guardian
   - `GET /api/v1/students/:studentId/guardians` - List guardians
   - `GET /api/v1/guardians/:guardianId` - Get guardian details
   - `PUT /api/v1/guardians/:guardianId` - Update guardian
   - `DELETE /api/v1/guardians/:guardianId` - Remove guardian
   - `POST /api/v1/guardians/:guardianId/set-primary` - Set as primary

5. **Validation**:
   - Required: first_name, last_name, phone_number, email, relationship
   - Email: Valid format
   - Phone: Valid format
   - One primary guardian per student (enforced by constraint)

**Implementation Priority**: 🔴 HIGH (Related to student)

---

### 3.3 Implement Class Model and Management

**Estimated Time**: 2 days  
**Dependencies**: Database setup

**Deliverables**:
1. **Database Table**: `classes`
   - Primary Key: `class_id` (UUID)
   - Fields:
     - `name` (VARCHAR) - e.g., "Class 10-A"
     - `level` (VARCHAR) - e.g., "Grade 10"
     - `section` (VARCHAR) - e.g., "A"
     - `capacity` (INTEGER) - max students
     - `academic_session_id` (UUID references academic_sessions)
     - `class_teacher_id` (UUID references users, optional)
     - `room_number` (VARCHAR, optional)
     - `floor` (VARCHAR, optional)
     - `building` (VARCHAR, optional)
     - `status` (ENUM: active, inactive, archived)
     - `created_at`, `updated_at`, `created_by`, `updated_by`

2. **ClassService** (`backend/src/services/classService.ts`)
   - [ ] `createClass(data)` - Create new class
   - [ ] `getClassById(classId)` - Get class details
   - [ ] `listClasses(filters)` - List classes with filtering
   - [ ] `updateClass(classId, data)` - Update class
   - [ ] `deleteClass(classId)` - Soft delete class
   - [ ] `getClassStudents(classId)` - Get enrolled students
   - [ ] `getClassTeachers(classId)` - Get assigned teachers
   - [ ] `validateCapacity(classId)` - Check if capacity allows more students
   - [ ] `validateClassData(data)` - Validate input

3. **Validation Rules**:
   - Required: name, level, capacity
   - Capacity: Must be positive integer (5-100 typical range)
   - Level: Must be valid academic level
   - Name: Unique within academic session
   - Room assignment: Optional but recommended

4. **API Endpoints**:
   - `POST /api/v1/classes` - Create class (admin, principal)
   - `GET /api/v1/classes` - List classes (all authenticated users)
   - `GET /api/v1/classes/:classId` - Get class details
   - `PUT /api/v1/classes/:classId` - Update class (admin, principal)
   - `DELETE /api/v1/classes/:classId` - Delete class (admin only)
   - `GET /api/v1/classes/:classId/students` - Get enrolled students
   - `GET /api/v1/classes/:classId/teachers` - Get assigned teachers

5. **Capacity Management**:
   - Track current enrollment vs. capacity
   - Prevent over-enrollment
   - Alert when capacity reached

**Implementation Priority**: 🔴 HIGH (Foundational)

---

### 3.4 Implement Subject Model and Management

**Estimated Time**: 1.5 days  
**Dependencies**: Database setup

**Deliverables**:
1. **Database Table**: `subjects`
   - Primary Key: `subject_id` (UUID)
   - Fields:
     - `code` (VARCHAR) - e.g., "MATH101"
     - `name` (VARCHAR) - e.g., "Mathematics"
     - `description` (TEXT, optional)
     - `credit_points` (INTEGER, optional) - for grade calculation
     - `max_marks` (INTEGER) - e.g., 100
     - `pass_marks` (INTEGER) - e.g., 40
     - `status` (ENUM: active, inactive, archived)
     - `created_at`, `updated_at`, `created_by`, `updated_by`

2. **Subject Class Assignment Table**: `class_subjects`
   - Composite Key: (class_id, subject_id)
   - Fields:
     - `class_subject_id` (UUID primary key)
     - `class_id` (UUID references classes)
     - `subject_id` (UUID references subjects)
     - `is_mandatory` (BOOLEAN)
     - `created_at`

3. **SubjectService** (`backend/src/services/subjectService.ts`)
   - [ ] `createSubject(data)` - Create new subject
   - [ ] `getSubjectById(subjectId)` - Get subject details
   - [ ] `listSubjects(filters)` - List all subjects
   - [ ] `updateSubject(subjectId, data)` - Update subject
   - [ ] `deleteSubject(subjectId)` - Soft delete subject
   - [ ] `assignSubjectToClass(classId, subjectId)` - Assign subject to class
   - [ ] `removeSubjectFromClass(classId, subjectId)` - Remove from class
   - [ ] `getClassSubjects(classId)` - Get subjects for a class
   - [ ] `validateSubjectData(data)` - Validate input

4. **Validation Rules**:
   - Required: code, name, max_marks, pass_marks
   - Code: Unique and alphanumeric
   - Max marks > Pass marks
   - Pass marks: 0-100 typically

5. **API Endpoints**:
   - `POST /api/v1/subjects` - Create subject (admin, principal)
   - `GET /api/v1/subjects` - List subjects (all authenticated)
   - `GET /api/v1/subjects/:subjectId` - Get subject details
   - `PUT /api/v1/subjects/:subjectId` - Update subject (admin)
   - `DELETE /api/v1/subjects/:subjectId` - Delete subject (admin)
   - `POST /api/v1/classes/:classId/subjects` - Assign to class
   - `GET /api/v1/classes/:classId/subjects` - Get class subjects
   - `DELETE /api/v1/classes/:classId/subjects/:subjectId` - Remove from class

**Implementation Priority**: 🔴 HIGH (Required for grades)

---

### 3.5 Implement Teacher Model and Assignment

**Estimated Time**: 2.5 days  
**Dependencies**: Phase 2 Auth, Subject (3.4), Class (3.3)

**Deliverables**:
1. **Database Table**: `teachers`
   - Primary Key: `teacher_id` (VARCHAR)
   - Foreign Key: `user_id` (UUID references users)
   - Fields:
     - `first_name`, `last_name` (VARCHAR)
     - `employee_id` (VARCHAR, unique)
     - `date_of_joining` (DATE)
     - `department` (VARCHAR, optional)
     - `specialization` (VARCHAR)
     - `qualifications` (TEXT) - comma-separated or JSON
     - `phone_number` (VARCHAR)
     - `email` (VARCHAR)
     - `office_location` (VARCHAR, optional)
     - `bio` (TEXT, optional)
     - `status` (ENUM: active, on_leave, inactive)
     - `created_at`, `updated_at`, `created_by`, `updated_by`

2. **Teacher Assignment Table**: `teacher_assignments`
   - Composite Key: (teacher_id, class_id, subject_id)
   - Fields:
     - `assignment_id` (UUID)
     - `teacher_id` (UUID references teachers)
     - `class_id` (UUID references classes)
     - `subject_id` (UUID references subjects)
     - `academic_session_id` (UUID)
     - `start_date` (DATE)
     - `end_date` (DATE, optional)
     - `is_primary_teacher` (BOOLEAN)
     - `created_at`, `updated_at`

3. **TeacherService** (`backend/src/services/teacherService.ts`)
   - [ ] `createTeacher(userData, teacherData)` - Create teacher with user account
   - [ ] `getTeacherById(teacherId)` - Get teacher details
   - [ ] `getTeacherByUserId(userId)` - Get teacher by associated user
   - [ ] `listTeachers(filters)` - List teachers
   - [ ] `updateTeacher(teacherId, data)` - Update teacher info
   - [ ] `deactivateTeacher(teacherId)` - Soft delete teacher
   - [ ] `assignTeacherToClass(teacherId, classId, subjectId)` - Assign to class/subject
   - [ ] `removeTeacherFromClass(assignmentId)` - Remove assignment
   - [ ] `getTeacherAssignments(teacherId)` - Get all assignments
   - [ ] `getClassTeachers(classId)` - Get teachers for a class
   - [ ] `checkTeacherConflicts(teacherId, classId, date)` - Check double-booking
   - [ ] `validateTeacherData(data)` - Validate input

4. **Validation Rules**:
   - Required: first_name, last_name, email, specialization, qualifications
   - Email: Unique and valid format
   - Qualifications: Non-empty
   - Date of joining: Not future date
   - No teacher can teach same subject to same class simultaneously

5. **API Endpoints**:
   - `POST /api/v1/teachers` - Create teacher (admin, principal)
   - `GET /api/v1/teachers` - List teachers (all authenticated)
   - `GET /api/v1/teachers/:teacherId` - Get teacher details
   - `PUT /api/v1/teachers/:teacherId` - Update teacher (admin)
   - `DELETE /api/v1/teachers/:teacherId` - Deactivate teacher (admin)
   - `POST /api/v1/teachers/:teacherId/assignments` - Add assignment
   - `GET /api/v1/teachers/:teacherId/assignments` - Get assignments
   - `GET /api/v1/classes/:classId/teachers` - Get class teachers
   - `DELETE /api/v1/teachers/assignments/:assignmentId` - Remove assignment

6. **Teacher-Subject Expertise**:
   - Track qualifications for quality assurance
   - Only assign teachers with relevant qualifications
   - Optional: Add qualification verification workflow

**Implementation Priority**: 🔴 HIGH (Required for scheduling)

---

### 3.6 Implement Enrollment Model

**Estimated Time**: 2.5 days  
**Dependencies**: Student (3.1), Class (3.3)

**Deliverables**:
1. **Database Table**: `enrollments`
   - Primary Key: `enrollment_id` (UUID)
   - Composite Key: (student_id, class_id, academic_session_id) - unique enrollment
   - Fields:
     - `student_id` (UUID references students)
     - `class_id` (UUID references classes)
     - `academic_session_id` (UUID references academic_sessions)
     - `enrollment_date` (DATE)
     - `status` (ENUM: pending, enrolled, dropped, completed)
     - `roll_number` (VARCHAR, optional) - e.g., "01" for classroom roll
     - `admission_number` (VARCHAR, optional)
     - `fees_paid` (DECIMAL)
     - `fees_outstanding` (DECIMAL)
     - `documents` (JSON, optional) - array of file references
     - `notes` (TEXT, optional)
     - `created_at`, `updated_at`, `created_by`, `updated_by`

2. **Enrollment Request Table** (for workflow):
   - `enrollment_requests`
   - Fields:
     - `request_id` (UUID)
     - `student_id` (UUID)
     - `class_id` (UUID)
     - `academic_session_id` (UUID)
     - `status` (ENUM: pending, approved, rejected)
     - `requested_by` (UUID references users)
     - `approved_by` (UUID references users, optional)
     - `rejection_reason` (TEXT, optional)
     - `requested_date` (TIMESTAMP)
     - `response_date` (TIMESTAMP, optional)

3. **EnrollmentService** (`backend/src/services/enrollmentService.ts`)
   - [ ] `requestEnrollment(studentId, classId, sessionId)` - Submit enrollment request
   - [ ] `approveEnrollment(requestId, approvedBy)` - Approve request → create enrollment
   - [ ] `rejectEnrollment(requestId, reason, rejectedBy)` - Reject request
   - [ ] `createEnrollment(data)` - Direct enrollment (admin only)
   - [ ] `getEnrollmentById(enrollmentId)` - Get enrollment details
   - [ ] `getStudentEnrollments(studentId)` - Get all enrollments for student
   - [ ] `getClassEnrollments(classId)` - Get all enrollments in class
   - [ ] `updateEnrollment(enrollmentId, data)` - Update enrollment
   - [ ] `dropEnrollment(enrollmentId, reason)` - Drop from class
   - [ ] `getEnrollmentRequests(filters)` - Get pending requests
   - [ ] `validateEnrollment(studentId, classId)` - Validate before enrollment
   - [ ] `validateCapacity(classId)` - Check class capacity
   - [ ] `generateRollNumber(classId)` - Auto-generate roll number

4. **Validation Rules**:
   - Student must exist and be active
   - Class must exist and be active
   - Student cannot enroll in same class twice in same session
   - Class must have available capacity
   - Academic session must be active
   - Age restrictions if defined (e.g., minimum age for certain classes)

5. **Enrollment Workflow**:
   1. Student/Parent submits enrollment request
   2. Admin/Principal reviews request
   3. Admin approves/rejects with reason
   4. If approved, enrollment record created
   5. Roll number auto-assigned
   6. Notification sent to student/parent (Phase 10)

6. **API Endpoints**:
   - `POST /api/v1/enrollments` - Create direct enrollment (admin)
   - `POST /api/v1/enrollments/request` - Submit enrollment request (student/parent)
   - `GET /api/v1/enrollments` - List enrollments (filtered by permission)
   - `GET /api/v1/enrollments/:enrollmentId` - Get enrollment details
   - `GET /api/v1/students/:studentId/enrollments` - Get student enrollments
   - `GET /api/v1/classes/:classId/enrollments` - Get class enrollments
   - `PUT /api/v1/enrollments/:enrollmentId` - Update enrollment
   - `POST /api/v1/enrollments/:enrollmentId/drop` - Drop from class
   - `GET /api/v1/enrollment-requests` - List requests (admin/principal)
   - `POST /api/v1/enrollment-requests/:requestId/approve` - Approve request
   - `POST /api/v1/enrollment-requests/:requestId/reject` - Reject request

7. **Audit Trail**:
   - Track all enrollment changes
   - Record who approved/rejected
   - Record drop reasons
   - Full history available for compliance

**Implementation Priority**: 🔴 HIGH (Critical for student management)

---

## Implementation Order

**Week 1**:
- Day 1-2: Task 3.1 (Student model) ← Start here
- Day 3-4: Task 3.3 (Class model)
- Day 5: Task 3.4 (Subject model)

**Week 2**:
- Day 6-7: Task 3.5 (Teacher model and assignments)
- Day 8-9: Task 3.2 (Guardian model)
- Day 10: Task 3.6 (Enrollment model and workflow)

---

## Technical Requirements

### Database Design
- [ ] Create 6 new tables with proper relationships
- [ ] Create indexes on frequently queried fields
- [ ] Create composite unique constraints where needed
- [ ] Set up cascade delete/update policies

### Service Layer
- [ ] Implement all 6 services with full CRUD operations
- [ ] Add validation logic to each service
- [ ] Implement query filtering and pagination
- [ ] Add proper error handling and logging

### API Layer
- [ ] Create routes for each service
- [ ] Implement proper authorization checks
- [ ] Add request validation middleware
- [ ] Document all endpoints

### Testing
- [ ] Unit tests for each service
- [ ] Integration tests for workflows
- [ ] Validation tests for business rules
- [ ] Authorization tests

---

## Success Criteria

✅ All 6 services implemented with full CRUD operations  
✅ All database relationships properly configured  
✅ All validation rules enforced  
✅ All audit logging in place  
✅ Comprehensive test coverage  
✅ API documentation complete  
✅ Zero authentication/authorization issues  
✅ All endpoints working in Postman/API client  

---

## Next Phase (Phase 4)

After Phase 3 completion, Phase 4 will build on these models to implement:
- Student enrollment workflows
- Bulk import/export functionality
- Enrollment reporting

---

## Resources & Tools

**Tools to Use**:
- TypeScript for type safety
- Knex.js for migrations and queries
- Jest/Vitest for unit testing
- Postman for API testing

**Documentation**:
- Refer to existing auth and RBAC services as patterns
- Follow established code structure and conventions
- Review PHASE_2_VERIFICATION for security patterns

---

## Questions or Clarifications Needed?

Before starting Phase 3, confirm:
1. [ ] Database connection working properly
2. [ ] Can run and pass Phase 2 tests
3. [ ] Understand the 6 models needed
4. [ ] Team familiar with existing code patterns
5. [ ] Development environment ready

**Ready to begin Phase 3?** → Start with Task 3.1 (Student Model)

