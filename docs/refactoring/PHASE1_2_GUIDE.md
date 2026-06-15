# PHASE 1.2 IMPLEMENTATION GUIDE: RENAME ADMIN TO PRINCIPAL

**Status:** 🟡 Ready to Start  
**Estimated Time:** 1-2 days  
**Priority:** HIGH  
**Dependencies:** Phase 1.1 Complete

---

## 📋 OVERVIEW

This phase renames the 'admin' role to 'principal' throughout the entire system to better reflect the hierarchical structure of a school management system.

**Rationale:**
- In educational institutions, the "Principal" is the head administrator
- "Admin" will now refer only to the super admin (platform owner)
- This aligns with real-world educational terminology

---

## ⚠️ IMPORTANT CONSIDERATIONS

### What Changes
- ✅ Database role enum values
- ✅ User role assignments in database
- ✅ Backend type definitions and enums
- ✅ Frontend type definitions
- ✅ Route authorization checks
- ✅ Service method role checks
- ✅ Component prop types
- ✅ Protected route configurations
- ✅ Role permission mappings

### What Stays the Same
- ❌ Email addresses (e.g., `admin@school.com` can stay)
- ❌ UI labels that say "Admin Panel" (can be kept for familiarity or changed to "Principal Panel")
- ❌ Variable names that are descriptive (e.g., `isAdmin` could become `isPrincipal` but consider context)
- ❌ Comments using "admin" in a general sense

---

## 🚀 IMPLEMENTATION STEPS

### STEP 1: Analysis (15-30 minutes)

Run the analysis script to see all occurrences:

```bash
cd backend
npm run refactor:admin-to-principal
```

This will output:
- All files containing 'admin' role references
- Number of occurrences per file
- Specific line numbers
- Categorization by directory

**Review the output carefully** and note:
- Which references need to change
- Which references should stay
- Any potential edge cases

---

### STEP 2: Database Migration (10 minutes)

**CRITICAL:** This must be done first and tested thoroughly!

```bash
# 1. Backup the database first!
pg_dump -U your_user school_management > backup_before_admin_rename.sql

# 2. Run the migration
cd backend
npm run db:migrate

# 3. Verify the migration
psql -U your_user -d school_management -c "SELECT role, COUNT(*) FROM users GROUP BY role;"
```

Expected output after migration:
```
     role      | count 
---------------|-------
 super_admin   |   1
 principal     |   X  <-- formerly admin
 teacher       |   Y
 student       |   Z
 ...
```

**Verification Queries:**
```sql
-- Should return 0
SELECT COUNT(*) FROM users WHERE role = 'admin';

-- Should show principal users
SELECT id, email, first_name, last_name, role 
FROM users 
WHERE role = 'principal';

-- Verify role_permissions updated
SELECT role_name, permission_name 
FROM role_permissions 
WHERE role_name = 'principal' 
LIMIT 10;
```

---

### STEP 3: Update Backend Type Definitions (5 minutes)

**File:** `backend/src/types/auth.ts`

**Current:**
```typescript
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',  // ← Remove this
  PRINCIPAL = 'principal',
  TEACHER = 'teacher',
  STUDENT = 'student',
  PARENT = 'parent',
  ACCOUNTANT = 'accountant',
  ADMISSIONS_OFFICER = 'admissions_officer',
}
```

**Updated:**
```typescript
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  PRINCIPAL = 'principal',  // ← Admin is now Principal
  TEACHER = 'teacher',
  STUDENT = 'student',
  PARENT = 'parent',
  ACCOUNTANT = 'accountant',
  ADMISSIONS_OFFICER = 'admissions_officer',
}
```

**Action:**
- Remove the `ADMIN` enum value
- Keep `PRINCIPAL` 
- Update any JSDoc comments

---

### STEP 4: Update Frontend Type Definitions (5 minutes)

**File:** `frontend/src/types/index.ts`

**Current:**
```typescript
export type UserRole = 
  | 'super_admin' 
  | 'admin'  // ← Remove this
  | 'principal' 
  | 'teacher'
  | 'student'
  | 'parent'
  | 'accountant'
  | 'admissions_officer';
```

**Updated:**
```typescript
export type UserRole = 
  | 'super_admin' 
  | 'principal'  // ← Admin is now Principal
  | 'teacher'
  | 'student'
  | 'parent'
  | 'accountant'
  | 'admissions_officer';
```

---

### STEP 5: Update Backend Routes (30-45 minutes)

Update role checks in all route files. Use search and replace carefully:

**Pattern to find:**
```typescript
['admin', 'principal']
```

**Replace with:**
```typescript
['principal']
```

**Files to update:**
- `backend/src/routes/phase10DashboardRoutes.ts` (multiple occurrences)
- `backend/src/routes/userRoutes.ts`
- `backend/src/routes/studentRoutes.ts`
- `backend/src/routes/phase9NotificationRoutes.ts`
- `backend/src/routes/phase12ExportRoutes.ts`
- `backend/src/routes/phase17SecurityPrivacyRoutes.ts`
- Any other route files with admin checks

**Example change:**
```typescript
// Before
if (!['admin', 'principal'].includes(req.user?.role)) {
  return res.status(403).json({ error: 'Forbidden' });
}

// After  
if (!['principal'].includes(req.user?.role)) {
  return res.status(403).json({ error: 'Forbidden' });
}

// OR (cleaner)
if (req.user?.role !== 'principal') {
  return res.status(403).json({ error: 'Forbidden' });
}
```

---

### STEP 6: Update Frontend Routes (20-30 minutes)

**File:** `frontend/src/router/routes.tsx`

Update all `requiredRoles` props:

**Pattern to find:**
```tsx
requiredRoles={['admin', 'principal']}
```

**Replace with:**
```tsx
requiredRoles={['principal']}
```

**Files to update:**
- `frontend/src/router/routes.tsx` (main routes file)
- Any component-level protected route wrappers

**Example:**
```tsx
// Before
<ProtectedRoute requiredRoles={['admin', 'principal']}>
  <AdminDashboard />
</ProtectedRoute>

// After
<ProtectedRoute requiredRoles={['principal']}>
  <AdminDashboard />
</ProtectedRoute>
```

---

### STEP 7: Update Frontend Components (30-45 minutes)

Update components that check user roles:

**Files likely to need updates:**
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/pages/AdminDashboard.tsx`
- `frontend/src/hooks/useAuth.ts`
- `frontend/src/hooks/useRealtimeDashboard.ts`

**Example changes:**

```tsx
// Before
const isAdmin = user?.role === 'admin';

// After
const isPrincipal = user?.role === 'principal';
```

```tsx
// Before
roles: ['super_admin', 'admin', 'principal', 'teacher']

// After
roles: ['super_admin', 'principal', 'teacher']
```

---

### STEP 8: Update Service Methods (15-20 minutes)

**Files to check:**
- `backend/src/services/dashboardService.ts`
- `backend/src/services/userService.ts`
- Any other services with role checks

**Pattern:**
```typescript
// Before
if (['admin', 'principal'].includes(user.role)) {
  // ...
}

// After
if (user.role === 'principal' || user.role === 'super_admin') {
  // ...
}
```

---

### STEP 9: Update API Endpoints and Comments (20-30 minutes)

**Update:**
1. API route comments
2. JSDoc documentation
3. Inline code comments
4. README files

**Example:**
```typescript
/**
 * GET /api/v1/dashboards/admin/metrics
 * Get comprehensive principal dashboard metrics (KPIs)
 * Role: principal
 */
```

---

### STEP 10: Update Frontend API Configurations (10 minutes)

**File:** `frontend/src/config/api.config.ts`

**Note:** API endpoint URLs can stay as `/admin/` for backward compatibility OR be changed to `/principal/`. 

**Option A (No URL change - Recommended for Phase 1.2):**
```typescript
DASHBOARDS: {
  ADMIN_METRICS: '/api/v1/dashboards/admin/metrics',  // Keep URLs same
  ADMIN_COMPLETE: '/api/v1/dashboards/admin/complete',
  // ... but update comments to say "principal"
}
```

**Option B (Full URL refactor - Consider for later):**
```typescript
DASHBOARDS: {
  PRINCIPAL_METRICS: '/api/v1/dashboards/principal/metrics',
  PRINCIPAL_COMPLETE: '/api/v1/dashboards/principal/complete',
  // ... requires backend route changes too
}
```

**Recommendation:** Keep URLs as-is for Phase 1.2, update later if needed.

---

### STEP 11: Testing (45-60 minutes)

#### A. Unit Tests
Run existing tests:
```bash
# Backend
cd backend
npm test

# Frontend
cd frontend
npm test
```

Fix any failing tests related to role changes.

#### B. Integration Testing

1. **Login as Principal:**
   - Email: `admin@school.com` (can keep same email)
   - Should redirect to principal dashboard
   - Verify role shown as "Principal" in UI

2. **Check Dashboard Access:**
   - Principal should access `/admin/dashboard` ✅
   - Teacher should NOT access principal routes ❌
   - Super Admin should access everything ✅

3. **Check API Endpoints:**
   ```bash
   # Should work for principal
   curl -H "Authorization: Bearer PRINCIPAL_TOKEN" \
     http://localhost:3000/api/v1/dashboards/admin/metrics
   
   # Should fail for teacher
   curl -H "Authorization: Bearer TEACHER_TOKEN" \
     http://localhost:3000/api/v1/dashboards/admin/metrics
   ```

4. **Verify Sidebar Navigation:**
   - Check all menu items show correctly for principal
   - Verify role-based visibility works

#### C. Database Verification
```sql
-- Verify no 'admin' roles remain
SELECT COUNT(*) FROM users WHERE role = 'admin';
-- Should return 0

-- Verify principals exist
SELECT COUNT(*) FROM users WHERE role = 'principal';
-- Should return previous admin count

-- Check permissions
SELECT * FROM role_permissions 
WHERE role_name = 'principal' 
ORDER BY permission_name;
```

---

### STEP 12: Documentation Updates (20-30 minutes)

Update documentation files:

1. **README.md** - Update role descriptions
2. **API Documentation** - Update role requirements
3. **User Guides** - Update screenshots and references
4. **Setup Guides** - Update seed data examples
5. **Comments** - Update inline comments

**Files to update:**
- `docs/SETUP_STEPS.md`
- `docs/LOCAL_SETUP_GUIDE.md`
- `docs/PHASE_*.md` files
- `README.md`
- `.env.example` (update example emails if needed)

---

## 🧪 TEST CHECKLIST

- [ ] Database migration runs successfully
- [ ] No users have 'admin' role in database
- [ ] Principal users can log in
- [ ] Principal can access dashboard
- [ ] Principal can access authorized routes
- [ ] Teacher/Student CANNOT access principal routes
- [ ] Super Admin can access everything
- [ ] Sidebar navigation displays correctly
- [ ] API endpoints respect new role checks
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] TypeScript compiles without errors
- [ ] No console errors in browser
- [ ] Audit logs work correctly
- [ ] Role permissions function properly

---

## 🔄 ROLLBACK PLAN

If something goes wrong:

```bash
# 1. Rollback database migration
cd backend
knex migrate:rollback

# 2. Restore from backup if needed
psql -U your_user -d school_management < backup_before_admin_rename.sql

# 3. Revert code changes
git checkout backend/src/types/auth.ts
git checkout frontend/src/types/index.ts
# ... revert other files

# 4. Restart services
npm run dev
```

---

## 📊 FILES TO MODIFY

### Critical (Must Change)
- ✅ `backend/src/database/migrations/020_rename_admin_to_principal.ts` (new)
- ✅ `backend/src/types/auth.ts`
- ✅ `frontend/src/types/index.ts`
- ✅ `backend/src/routes/*.ts` (all route files with admin checks)
- ✅ `frontend/src/router/routes.tsx`

### Important (Should Change)
- ⚠️ `backend/src/services/*.ts` (services with role checks)
- ⚠️ `frontend/src/components/layout/Sidebar.tsx`
- ⚠️ `frontend/src/pages/AdminDashboard.tsx`
- ⚠️ `frontend/src/hooks/useAuth.ts`

### Optional (Can Change Later)
- 🔹 API endpoint URLs (`/admin/` → `/principal/`)
- 🔹 UI labels ("Admin Panel" → "Principal Panel")
- 🔹 Test files
- 🔹 Documentation

---

## 🎯 SUCCESS CRITERIA

Phase 1.2 is complete when:

1. ✅ Database has no 'admin' role users
2. ✅ All 'admin' users migrated to 'principal'
3. ✅ Backend types updated
4. ✅ Frontend types updated
5. ✅ All routes updated
6. ✅ All tests pass
7. ✅ Manual testing successful
8. ✅ Documentation updated
9. ✅ No TypeScript errors
10. ✅ Rollback plan tested

---

## 📝 NOTES

- **Estimated Total Time:** 4-6 hours of focused work
- **Best Time to Do This:** Outside business hours or in a maintenance window
- **Database Downtime:** ~5-10 minutes during migration
- **Testing Time:** Allow extra time for thorough testing
- **Rollback Time:** ~30 minutes if needed

---

## 🆘 TROUBLESHOOTING

### Issue: Migration fails
**Solution:** Check PostgreSQL version supports ALTER TYPE ADD VALUE

### Issue: Some users can't log in
**Solution:** Verify JWT tokens don't cache old roles, may need re-login

### Issue: TypeScript errors after changes
**Solution:** Run `npm run build` to see specific errors, update imports

### Issue: 403 Forbidden errors
**Solution:** Check route authorization arrays include 'principal'

### Issue: Tests failing
**Solution:** Update test fixtures to use 'principal' instead of 'admin'

---

## 📞 SUPPORT

If you encounter issues:
1. Check this guide thoroughly
2. Review the refactoring script output
3. Verify database migration completed
4. Check application logs
5. Rollback if necessary

---

**Next Phase:** Phase 1.3 - Enhance Admissions Officer

**Document Version:** 1.0  
**Created:** June 13, 2026  
**Last Updated:** June 13, 2026
