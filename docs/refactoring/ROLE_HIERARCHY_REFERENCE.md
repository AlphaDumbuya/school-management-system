# ROLE HIERARCHY & PERMISSIONS REFERENCE
## Quick Guide for Development

---

## ROLE HIERARCHY

```
┌─────────────────────────────────────────────┐
│         LEVEL 1: SUPER ADMIN                │
│         (Platform Owner)                    │
│  • Manages all schools (tenants)            │
│  • Platform-wide settings                   │
│  • Billing & subscriptions                  │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│         LEVEL 2: PRINCIPAL                  │
│         (School Administrator)              │
│  • Highest authority in school              │
│  • All school operations                    │
│  • Staff & student management               │
└─────────────────────────────────────────────┘
                    ↓
┌──────────────────────┬──────────────────────┐
│  LEVEL 3:            │  LEVEL 3:            │
│  ADMISSIONS OFFICER  │  ACCOUNTANT          │
│  • Student enrollment│  • Financial ops     │
│  • Applications      │  • Fees & payroll    │
│  • Documents         │  • Expenses          │
└──────────────────────┴──────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│         LEVEL 4: TEACHER                    │
│  • Class management                         │
│  • Grading & attendance                     │
│  • Learning materials                       │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│         LEVEL 5: PARENT                     │
│  • Monitor child progress                   │
│  • View grades & attendance                 │
│  • Fee management                           │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│         LEVEL 6: STUDENT                    │
│  • View grades & attendance                 │
│  • Access learning materials                │
│  • Submit assignments                       │
└─────────────────────────────────────────────┘
```

---

## PERMISSION MATRIX

### Module: Academic Management

| Feature | Super Admin | Principal | Admissions | Accountant | Teacher | Parent | Student |
|---------|-------------|-----------|------------|------------|---------|--------|---------|
| Classes & Streams | ✅ View/Edit | ✅ Create/Edit/Delete | ❌ | ❌ | 👁️ View Assigned | ❌ | ❌ |
| Subjects | ✅ View/Edit | ✅ Create/Edit/Delete | ❌ | ❌ | 👁️ View Assigned | ❌ | ❌ |
| Timetables | ✅ View/Edit | ✅ Create/Approve | ❌ | ❌ | 👁️ View | ❌ | ❌ |
| Assignments | ✅ View | 👁️ View | ❌ | ❌ | ✅ Create/Grade | 👁️ View | 👁️ View/Submit |
| Examinations | ✅ View/Edit | ✅ Create/Approve | ❌ | ❌ | ✅ Create/Grade | ❌ | ❌ |
| Results | ✅ View/Edit | ✅ Publish/Lock | ❌ | ❌ | ✅ Enter | 👁️ View | 👁️ View |
| Report Cards | ✅ View | ✅ Generate | ❌ | ❌ | ✅ Generate | 👁️ Download | 👁️ Download |
| Promotions | ✅ Manage | ✅ Execute | ❌ | ❌ | ❌ | ❌ | ❌ |

### Module: Student Management

| Feature | Super Admin | Principal | Admissions | Accountant | Teacher | Parent | Student |
|---------|-------------|-----------|------------|------------|---------|--------|---------|
| Student Directory | ✅ Full Access | ✅ Full Access | ✅ View/Edit | ❌ | 👁️ View | ❌ | ❌ |
| Admissions | ✅ View | ✅ Approve | ✅ Manage | ❌ | ❌ | ❌ | ❌ |
| Profiles | ✅ Edit | ✅ Edit | ✅ Edit | ❌ | 👁️ View | 👁️ View Child | 👁️ View Own |
| Attendance | ✅ View/Edit | ✅ View/Edit | ❌ | ❌ | ✅ Mark | 👁️ View Child | 👁️ View Own |
| Discipline | ✅ View/Edit | ✅ Approve | ❌ | ❌ | ✅ Report | 👁️ View Child | 👁️ View Own |

### Module: Staff Management

| Feature | Super Admin | Principal | Admissions | Accountant | Teacher | Parent | Student |
|---------|-------------|-----------|------------|------------|---------|--------|---------|
| Teachers | ✅ Full Access | ✅ Manage | ❌ | ❌ | ❌ | ❌ | ❌ |
| Staff | ✅ Full Access | ✅ Manage | ❌ | ❌ | ❌ | ❌ | ❌ |
| Leave | ✅ View | ✅ Approve | ❌ | ❌ | ✅ Request | ❌ | ❌ |
| Performance | ✅ View | ✅ Evaluate | ❌ | ❌ | 👁️ View Own | ❌ | ❌ |

### Module: Financial Management

| Feature | Super Admin | Principal | Admissions | Accountant | Teacher | Parent | Student |
|---------|-------------|-----------|------------|------------|---------|--------|---------|
| Fee Structures | ✅ View/Edit | ✅ Approve | ❌ | ✅ Create/Edit | ❌ | ❌ | ❌ |
| Invoices | ✅ View | ✅ View | ❌ | ✅ Generate | ❌ | 👁️ View Own | ❌ |
| Payments | ✅ View | ✅ View | ❌ | ✅ Record | ❌ | 👁️ View/Pay | ❌ |
| Expenses | ✅ View | ✅ View/Approve | ❌ | ✅ Record | ❌ | ❌ | ❌ |
| Payroll | ✅ View | ✅ View/Approve | ❌ | ✅ Process | 👁️ View Own | ❌ | ❌ |
| Scholarships | ✅ View/Edit | ✅ Approve | ❌ | ✅ Manage | ❌ | 👁️ View Child | 👁️ View Own |

### Module: Communication

| Feature | Super Admin | Principal | Admissions | Accountant | Teacher | Parent | Student |
|---------|-------------|-----------|------------|------------|---------|--------|---------|
| Announcements | ✅ Full Access | ✅ Create | ✅ View | ✅ View | 👁️ View | 👁️ View | 👁️ View |
| Messages | ✅ Full Access | ✅ Full Access | ✅ Send | ✅ Send | ✅ Send | ✅ Send | 👁️ Receive |
| SMS Config | ✅ Configure | ✅ Use | ✅ Use | ✅ Use | ❌ | ❌ | ❌ |
| Email Config | ✅ Configure | ✅ Use | ✅ Use | ✅ Use | ❌ | ❌ | ❌ |

### Module: Identity Management

| Feature | Super Admin | Principal | Admissions | Accountant | Teacher | Parent | Student |
|---------|-------------|-----------|------------|------------|---------|--------|---------|
| ID Cards | ✅ Full Access | ✅ Generate/Approve | ✅ Generate | ❌ | 👁️ Download Own | 👁️ Download Child | 👁️ Download Own |
| QR Codes | ✅ Full Access | ✅ Generate | ✅ Generate | ❌ | 👁️ View Own | 👁️ View Child | 👁️ View Own |

### Module: Events Management

| Feature | Super Admin | Principal | Admissions | Accountant | Teacher | Parent | Student |
|---------|-------------|-----------|------------|------------|---------|--------|---------|
| Create Events | ✅ Yes | ✅ Yes | ❌ | ❌ | ✅ Assigned Only | ❌ | ❌ |
| View Events | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All |
| RSVP | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| Manage | ✅ All | ✅ All | ❌ | ❌ | ✅ Assigned Only | ❌ | ❌ |

### Module: Reports & Analytics

| Feature | Super Admin | Principal | Admissions | Accountant | Teacher | Parent | Student |
|---------|-------------|-----------|------------|------------|---------|--------|---------|
| Academic Reports | ✅ All Schools | ✅ School | ❌ | ❌ | 👁️ Assigned Classes | ❌ | ❌ |
| Financial Reports | ✅ All Schools | ✅ School | ❌ | ✅ Generate | ❌ | ❌ | ❌ |
| Attendance Reports | ✅ All Schools | ✅ School | ❌ | ❌ | 👁️ Assigned Classes | ❌ | ❌ |
| Enrollment Reports | ✅ All Schools | ✅ School | ✅ Generate | ❌ | ❌ | ❌ | ❌ |
| Discipline Reports | ✅ All Schools | ✅ School | ❌ | ❌ | 👁️ View | ❌ | ❌ |

### Module: Platform Management

| Feature | Super Admin | Principal | Admissions | Accountant | Teacher | Parent | Student |
|---------|-------------|-----------|------------|------------|---------|--------|---------|
| Tenants | ✅ Full Control | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Subscriptions | ✅ Manage All | 👁️ View Own | ❌ | ❌ | ❌ | ❌ | ❌ |
| Platform Analytics | ✅ Full Access | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Gateway Config | ✅ Configure | 👁️ View | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## LEGEND

| Symbol | Meaning |
|--------|---------|
| ✅ | Full access (Create, Read, Update, Delete) |
| 👁️ | Read-only or limited access |
| ❌ | No access |

---

## ROLE-BASED ROUTING

### Dashboard Routes
```typescript
const DASHBOARD_ROUTES = {
  super_admin: '/platform/dashboard',
  principal: '/dashboard',
  admissions_officer: '/admissions/dashboard',
  accountant: '/finance/dashboard',
  teacher: '/teacher/dashboard',
  parent: '/parent/dashboard',
  student: '/student/dashboard',
};
```

### Landing Pages After Login
```typescript
const LANDING_PAGES = {
  super_admin: '/platform/tenants',
  principal: '/dashboard',
  admissions_officer: '/students/admissions',
  accountant: '/finance/fees',
  teacher: '/academic/classes',
  parent: '/parent/children',
  student: '/student/dashboard',
};
```

---

## MIDDLEWARE CHECKS

### Backend Route Protection
```typescript
// Example: Principal-only route
router.get('/academic/promotions', 
  authMiddleware,
  rbacMiddleware(['super_admin', 'principal']),
  promotionController.list
);

// Example: Multi-role access
router.get('/students/attendance',
  authMiddleware,
  rbacMiddleware(['super_admin', 'principal', 'teacher', 'parent', 'student']),
  attendanceController.view
);
```

### Frontend Component Protection
```typescript
// Example: Conditional rendering
{canAccess(['super_admin', 'principal']) && (
  <Button onClick={handleDelete}>Delete</Button>
)}

// Example: Route protection
<ProtectedRoute 
  roles={['super_admin', 'principal', 'accountant']} 
  component={FinancePage}
/>
```

---

## COMMON PATTERNS

### Data Filtering by Role

```typescript
// Teacher: Only sees their assigned classes
if (user.role === 'teacher') {
  classes = classes.filter(c => c.teacher_id === user.id);
}

// Parent: Only sees their children's data
if (user.role === 'parent') {
  students = students.filter(s => s.parent_id === user.id);
}

// Student: Only sees their own data
if (user.role === 'student') {
  data = data.filter(d => d.student_id === user.id);
}
```

### Hierarchical Access

```typescript
// Higher roles can access lower role data
const canAccessData = (userRole: string, targetRole: string) => {
  const hierarchy = {
    super_admin: 6,
    principal: 5,
    admissions_officer: 4,
    accountant: 4,
    teacher: 3,
    parent: 2,
    student: 1,
  };
  
  return hierarchy[userRole] >= hierarchy[targetRole];
};
```

---

## IMPLEMENTATION CHECKLIST

### For Each New Feature

- [ ] Define permissions in specification
- [ ] Update RBAC middleware
- [ ] Implement backend authorization
- [ ] Add frontend route protection
- [ ] Implement UI conditional rendering
- [ ] Add data filtering by role
- [ ] Write permission tests
- [ ] Update documentation
- [ ] Test with each role
- [ ] Verify tenant isolation (if applicable)

---

## TESTING SCENARIOS

### Test Each Role Can:
1. ✅ Access only permitted routes
2. ✅ See only permitted menu items
3. ✅ Perform only permitted actions
4. ✅ View only permitted data
5. ✅ Redirect correctly on unauthorized access

### Test Each Role Cannot:
1. ✅ Access higher-level routes
2. ✅ See restricted menu items
3. ✅ Perform unauthorized actions
4. ✅ View other users' private data
5. ✅ Bypass role restrictions via API

---

*Document Version: 1.0*  
*Last Updated: June 13, 2026*
