# Database Migration Fix Plan

## Executive Summary
The database migrations have 8 critical issues identified during migration testing. This document provides a structured fix plan.

## Critical Issues & Fixes

### 1. Migration 010 - Duplicate Table Creations
**Issue:** Migration 010 creates tables that already exist in earlier migrations
**Affected Tables:**
- `academic_sessions` (created in 001, recreation attempt in 010)
- `grading_scales` (created in 003, recreation attempt in 010)
- `notification_preferences` (created in 007, recreation attempt in 010)

**Fix:** Modify 010 to check for existing tables before creating:
- Change `createTable()` to `createTableIfNotExists()`
- OR remove the creates and use table modifications instead

### 2. Migration 005 - String IDs Type Mismatch
**Issue:** Uses STRING for primary keys and foreign keys but should use UUID for consistency
**Affected Tables:**
- `reports` - id: STRING (should be UUID)
- `report_exports` - id: STRING (should be UUID)
- `analytics_snapshots` - id: STRING (should be UUID)
- `report_schedules` - id: STRING (should be UUID)
- `created_by` columns are STRING (should be UUID → users.id)

**Impact:** Foreign key constraints will fail - STRING cannot reference UUID

**Fix:** Replace STRING IDs with UUID throughout migration 005

### 3. Migration 018 & 014 - Duplicate email_templates
**Issue:** Both migrations create `email_templates` table with different schemas
- Migration 014: Uses UUID for id, has tenant_id
- Migration 018: Uses INCREMENTS (INT) for id, no tenant_id, has brevo_template_id

**Fix:** 
- Keep 014 version (UUID-based, tenant-aware)
- Remove email_templates creation from 018
- Add brevo_template_id to 014's email_templates if needed

### 4. Migration 010 - Inconsistent ID Types
**Issue:** Uses INCREMENTS for IDs but should use UUID
**Affected Tables:**
- `school_config_settings` - id: INCREMENTS (should be UUID)
- `notification_configurations` - id: INCREMENTS (should be UUID)  
- `notification_preferences` - id: INCREMENTS (should be UUID)

**Fix:** Replace INCREMENTS with UUID for all new tables in 010

### 5. Migration 003 - Duplicate Academic Sessions
**Issue:** Migration 003 tries to add grading_scale_id to academic_sessions, but migration 010 also modifies it
**Fix:** Consolidate all academic_sessions modifications in single migration

### 6. Foreign Key Type Mismatches
**Issue:** Multiple created_by and foreign keys use wrong types
**Pattern:** STRING columns cannot be FKs to UUID columns

**Fix:** Audit all FK columns and ensure type consistency:
- All user references must be UUID (users.id is UUID)
- All tenant references must be UUID (tenants.id is UUID)
- All ID columns in child tables must match parent ID type

## Migration Execution Plan

### Step 1: Fix Migration 005 (phase7_reporting)
Convert all STRING IDs to UUID:
```
reports.id: STRING → UUID
report_exports.id: STRING → UUID
analytics_snapshots.id: STRING → UUID
report_schedules.id: STRING → UUID
created_by (all): STRING → UUID
```

### Step 2: Fix Migration 010 (phase15_configuration)
- Change `createTable` to `createTableIfNotExists` for:
  - grading_scales
  - academic_sessions
  - notification_preferences
- Convert INCREMENTS to UUID:
  - school_config_settings.id
  - notification_configurations.id
  - (notification_preferences.id if creating)

### Step 3: Fix Migration 014 & 018 (email_templates conflict)
- Consolidate schema in 014
- Remove email_templates creation from 018
- Keep brevo tracking in 018 if needed via different table

### Step 4: Verify All Migrations
- Ensure no table is created in multiple migrations
- Verify all FK column types match referenced table IDs
- Check that all created_by/updated_by are UUID

## Validation Checklist

- [ ] All .id columns use UUID
- [ ] All created_by columns are UUID → users.id
- [ ] All tenant_id columns are UUID → tenants.id
- [ ] No table created in multiple migrations
- [ ] All FK column types match referenced types
- [ ] Migration 001 seeds default tenant
- [ ] Migration 010 uses createTableIfNotExists for conditionals
- [ ] Migration 005 uses UUID throughout
- [ ] email_templates created only once (in 014)

## Testing Steps

1. Reset database: `npx tsx scripts/resetDatabase.ts`
2. Run migrations: `npm run db:migrate`
3. Verify schema created without errors
4. Check table creation order
5. Validate FK constraints with sample data

## Timeline

**Priority 1 (Critical):**
- Fix Migration 005 STRING→UUID
- Fix Migration 010 duplicate creates
- Fix email_templates conflict

**Priority 2 (Important):**
- Fix ID type inconsistencies
- Audit all FK columns

**Priority 3 (Nice to have):**
- Add indexes to FK columns
- Add performance optimizations
