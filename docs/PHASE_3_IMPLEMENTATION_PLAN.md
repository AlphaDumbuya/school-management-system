# Phase 3 Implementation Plan - Core Data Models

**Status**: IN PROGRESS (Part 1 Complete)  
**Date Started**: June 2, 2026  
**Estimated Duration**: 2-3 weeks  
**Progress**: 32% (Started Phase 3 of 24 phases)

---

## Phase 3 Overview

Phase 3 focuses on implementing the core data models that form the foundation of the School Management System:

1. **Student Management** - Complete student lifecycle
2. **Teacher Management** - Teacher profiles and assignments
3. **Class Management** - Class structures and capacity
4. **Subject Management** - Curriculum and courses
5. **Enrollment Management** - Student-class assignments
6. **Class Subject Assignment** - Subject-class mapping

---

## Part 1: Core Services (✅ COMPLETE)

### Services Implemented

#### 1. StudentService (`backend/src/services/studentService.ts`)
**Responsibilities**:
- Create and manage student profiles
- Handle student enrollment dates and status
- Calculate and track student GPA
- Manage student contact information and guardians
- Track enrollment history

**Methods**:
```typescript
createStudent(data: CreateStudentRequest)
getStudentById(studentId: string)
getStudentsByTenant(tenantId, filters)
updateStudent(studentId, data)
deleteStudent(studentId) // Soft delete
getStudentEnrollments(studentId)
calculateStudentGPA(studentId)
getStudentByEmail(tenantId, email)
isEnrolledInClass(studentId, classId)
```

**Features**:
- ✅ Full CRUD operations
- ✅ Pagination support
- ✅ Age validation (3-30 years)
- ✅ Email uniqueness per tenant
- ✅ GPA calculation and tracking
- ✅ Enrollment history retrieval
- ✅ Soft delete (status = inactive)

#### 2. TeacherService (`backend/src/services/teacherService.ts`)
**Responsibilities**:
- Manage teacher profiles and qualifications
- Track experience and specialization
- Handle teacher-class assignments
- Manage teacher availability and office location

**Methods**:
```typescript
createTeacher(data: CreateTeacherRequest)
getTeacherById(teacherId: string)
getTeachersByTenant(tenantId, filters)
updateTeacher(teacherId, data)
deleteTeacher(teacherId) // Soft delete
getTeacherAssignments(teacherId)
assignTeacher(teacherId, classId, subjectId, startDate)
getTeacherByEmail(tenantId, email)
getTeachersBySpecialization(tenantId, specialization)
```

**Features**:
- ✅ Teacher profile management
- ✅ Qualification tracking (array)
- ✅ Experience years validation (0-60)
- ✅ Specialization management
- ✅ Teacher-class-subject assignments
- ✅ Filter by specialization
- ✅ Soft delete support

#### 3. ClassService (`backend/src/services/classService.ts`)
**Responsibilities**:
- Manage class structures and properties
- Handle subject assignment to classes
- Track class capacity and enrollment
- Generate class statistics

**Methods**:
```typescript
createClass(data: CreateClassRequest)
getClassById(classId: string)
getClassesByTenant(tenantId, filters)
updateClass(classId, data)
getClassSubjects(classId)
addSubjectToClass(classId, subjectId)
removeSubjectFromClass(classId, subjectId)
getClassStats(classId)
getClassStudents(classId, academicSessionId?)
```

**Features**:
- ✅ Class creation with capacity limits (1-200)
- ✅ Academic session association
- ✅ Class teacher assignment
- ✅ Subject management per class
- ✅ Capacity statistics
- ✅ Enrollment statistics
- ✅ Average GPA calculation
- ✅ Student listing per class

#### 4. SubjectService (`backend/src/services/subjectService.ts`)
**Responsibilities**:
- Manage course subjects and curriculum
- Handle subject assignments to classes
- Track subject credits and descriptions
- Link teachers to subjects

**Methods**:
```typescript
createSubject(data: CreateSubjectRequest)
getSubjectById(subjectId: string)
getSubjectsByTenant(tenantId, filters)
updateSubject(subjectId, data)
deleteSubject(subjectId)
getSubjectByCode(tenantId, code)
getClassesForSubject(subjectId)
getTeachersForSubject(subjectId, classId?)
bulkCreateSubjects(tenantId, subjects)
```

**Features**:
- ✅ Subject code uniqueness per tenant
- ✅ Credits validation (0-10)
- ✅ Bulk subject creation
- ✅ Subject search by code/name
- ✅ Class retrieval for subject
- ✅ Teacher retrieval for subject
- ✅ Delete protection (checks grades/assignments)
- ✅ Code auto-uppercase

---

## Part 2: API Routes (TO IMPLEMENT)

### Student Routes (`backend/src/routes/studentRoutes.ts`)

```
POST   /api/v1/students              - Create new student
GET    /api/v1/students              - List students (with pagination)
GET    /api/v1/students/:id          - Get student by ID
PUT    /api/v1/students/:id          - Update student
DELETE /api/v1/students/:id          - Deactivate student
GET    /api/v1/students/:id/enrollments - Get student enrollments
GET    /api/v1/students/:id/gpa      - Get student GPA
POST   /api/v1/students/bulk/import  - Bulk import students (CSV/Excel)
```

### Teacher Routes (`backend/src/routes/teacherRoutes.ts`)

```
POST   /api/v1/teachers              - Create new teacher
GET    /api/v1/teachers              - List teachers
GET    /api/v1/teachers/:id          - Get teacher by ID
PUT    /api/v1/teachers/:id          - Update teacher
DELETE /api/v1/teachers/:id          - Deactivate teacher
GET    /api/v1/teachers/:id/assignments - Get teacher assignments
POST   /api/v1/teachers/:id/assign   - Assign teacher to class
```

### Class Routes (`backend/src/routes/classRoutes.ts`)

```
POST   /api/v1/classes               - Create new class
GET    /api/v1/classes               - List classes
GET    /api/v1/classes/:id           - Get class by ID
PUT    /api/v1/classes/:id           - Update class
GET    /api/v1/classes/:id/subjects  - Get class subjects
POST   /api/v1/classes/:id/subjects  - Add subject to class
DELETE /api/v1/classes/:id/subjects/:sid - Remove subject from class
GET    /api/v1/classes/:id/students  - Get class students
GET    /api/v1/classes/:id/stats     - Get class statistics
```

### Subject Routes (`backend/src/routes/subjectRoutes.ts`)

```
POST   /api/v1/subjects              - Create new subject
GET    /api/v1/subjects              - List subjects
GET    /api/v1/subjects/:id          - Get subject by ID
PUT    /api/v1/subjects/:id          - Update subject
DELETE /api/v1/subjects/:id          - Delete subject
GET    /api/v1/subjects/:id/classes  - Get classes offering subject
GET    /api/v1/subjects/:id/teachers - Get teachers teaching subject
POST   /api/v1/subjects/bulk/create  - Bulk create subjects
```

### Enrollment Routes (`backend/src/routes/enrollmentRoutes.ts`)

```
POST   /api/v1/enrollments           - Create enrollment
GET    /api/v1/enrollments           - List enrollments
GET    /api/v1/enrollments/:id       - Get enrollment details
PUT    /api/v1/enrollments/:id       - Update enrollment
DELETE /api/v1/enrollments/:id       - Cancel enrollment (soft delete)
```

---

## Part 3: Testing (TO IMPLEMENT)

### Test Files to Create

1. **`backend/src/services/__tests__/studentService.test.ts`** (~200 lines)
   - Create, read, update, delete
   - Pagination and filtering
   - GPA calculation
   - Enrollment tracking
   - Validation tests

2. **`backend/src/services/__tests__/teacherService.test.ts`** (~200 lines)
   - Create, read, update, delete
   - Assignment management
   - Specialization filtering
   - Validation tests

3. **`backend/src/services/__tests__/classService.test.ts`** (~200 lines)
   - Class creation and management
   - Subject assignment
   - Statistics calculation
   - Capacity management
   - Validation tests

4. **`backend/src/services/__tests__/subjectService.test.ts`** (~150 lines)
   - Subject CRUD
   - Code uniqueness
   - Bulk creation
   - Deletion protection
   - Validation tests

---

## Implementation Checklist

### Part 1: Services ✅ COMPLETE
- [x] StudentService implementation
- [x] TeacherService implementation
- [x] ClassService implementation
- [x] SubjectService implementation
- [x] All services tested locally
- [x] Documentation completed
- [x] Git commit and push

### Part 2: API Routes (IN PROGRESS)
- [ ] StudentRoutes implementation
- [ ] TeacherRoutes implementation
- [ ] ClassRoutes implementation
- [ ] SubjectRoutes implementation
- [ ] EnrollmentRoutes implementation
- [ ] Route integration into Express app
- [ ] Authorization middleware application

### Part 3: Comprehensive Testing (NEXT)
- [ ] StudentService tests
- [ ] TeacherService tests
- [ ] ClassService tests
- [ ] SubjectService tests
- [ ] API route tests
- [ ] Integration tests
- [ ] Test coverage >80%

### Part 4: Documentation (NEXT)
- [ ] API endpoint documentation
- [ ] Database schema documentation
- [ ] Example API usage
- [ ] Phase 3 completion summary

---

## Database Dependencies

Phase 3 requires these tables (already created in migrations):
- `students` - Student profiles
- `teachers` - Teacher profiles
- `classes` - Class definitions
- `subjects` - Subject catalog
- `enrollments` - Student-class assignments
- `class_subjects` - Class-subject mapping
- `teacher_assignments` - Teacher-class-subject assignments
- `academic_sessions` - Academic year definitions
- `users` - User accounts (for tenant/auth context)

---

## Security & Access Control

### Role-Based Access

**Admin/Principal**:
- Create/read/update/delete all students, teachers, classes, subjects
- View all enrollments and assignments
- Bulk import students

**Teacher**:
- Read own assigned classes and students
- Read subject details
- Cannot create/delete students or teachers

**Student/Parent**:
- Read own profile
- Read own/child's enrollments and grades
- Cannot modify any data

**Accountant**:
- Read student information (for billing)
- Cannot modify student data

### Authorization Middleware

All routes will use:
```typescript
router.post('/students', authenticate, authorize('admin', 'principal'), ...)
router.get('/students/:id', authenticate, ...)
```

---

## Performance Considerations

### Indexing
- `students.tenant_id` - For tenant filtering
- `students.status` - For active/inactive filtering
- `students.email` - For email lookup
- `teachers.tenant_id` - For tenant filtering
- `classes.academic_session_id` - For session filtering
- `enrollments.student_id` - For student lookups
- `enrollments.class_id` - For class lookups

### Query Optimization
- Use pagination on all list endpoints (default limit: 10, max: 100)
- Implement search on name/code fields
- Join tables efficiently in class/student statistics
- Cache GPA calculations

### Response Times Target
- Create operations: <500ms
- Read operations: <100ms
- List operations (pagination): <200ms
- Bulk operations: <5s for 1000 records

---

## Integration Points

### With Phase 2 (Authentication)
- All Phase 3 endpoints require authentication
- User context used for audit logging
- Role-based access control enforced

### With Existing Infrastructure
- Express middleware integration
- Error handling via AppError
- Logging via Winston
- Database via Knex.js
- Type safety via TypeScript

---

## Next Steps After Phase 3

**Phase 4**: Student Enrollment and Management
- Enrollment workflow implementation
- Bulk student import
- Enrollment data export
- Audit trail for student records

**Phase 5**: Academic Management - Grades
- Grade model and storage
- Grade entry interface
- Grade calculation and statistics
- Grade finalization and locking

---

## Commit Strategy

Each part will be committed with descriptive messages:

```bash
# Part 1: Services
git commit -m "feat(core-data): implement Phase 3 Part 1 - Core Services"

# Part 2: Routes
git commit -m "feat(core-data): implement Phase 3 Part 2 - API Routes"

# Part 3: Testing
git commit -m "test(core-data): implement Phase 3 Part 3 - Comprehensive Tests"

# Final: Documentation
git commit -m "docs: add Phase 3 implementation documentation"
```

---

## Code Quality Standards

All Phase 3 code will follow:
- ✅ TypeScript strict mode
- ✅ 80%+ test coverage
- ✅ Professional error handling
- ✅ Comprehensive logging
- ✅ Security best practices
- ✅ Performance optimization
- ✅ Clean code principles
- ✅ SOLID principles

---

## Timeline

**Part 1 - Services**: COMPLETE ✅
- StudentService, TeacherService, ClassService, SubjectService
- 1,200+ lines of production code
- Commit: 78a1e90

**Part 2 - Routes**: IN PROGRESS
- Student, Teacher, Class, Subject, Enrollment routes
- Estimated: 1,500+ lines of code
- Authorization middleware application
- Estimated duration: 2-3 hours

**Part 3 - Testing**: PENDING
- Unit tests for all services
- API route tests
- Integration tests
- Estimated: 800+ lines of tests
- Estimated duration: 3-4 hours

**Part 4 - Documentation**: PENDING
- Implementation guide
- API documentation
- Phase 3 summary
- Estimated duration: 2 hours

**Total Phase 3 Duration**: 2-3 weeks

---

## Success Criteria

Phase 3 will be considered complete when:

- [x] All 4 core services implemented
- [ ] All 5 API route files created
- [ ] All authorization/authentication applied
- [ ] 80%+ test coverage achieved
- [ ] All tests passing
- [ ] Complete documentation
- [ ] Zero critical security issues
- [ ] Performance targets met
- [ ] Code review complete
- [ ] Merged to main branch

---

**Current Status**: Part 1 Complete (78a1e90) ✅  
**Next Action**: Implement API Routes (Part 2)  
**Overall Progress**: 32% (Started Phase 3)

---

## References

- **Specification**: `.kiro/specs/school-management-system/database-schema.md`
- **API Spec**: `.kiro/specs/school-management-system/api-specification.md`
- **Requirements**: `.kiro/specs/school-management-system/requirements.md`
- **Security**: `.kiro/specs/school-management-system/security-compliance.md`
