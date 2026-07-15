# Implementation Plan: Classes & Streams

## Overview

Build the Classes & Streams page at `/academic/classes`. The page provides full CRUD for school classes using the Admin Dashboard Design System components. The backend API already exists at `/api/v1/classes`. No backend changes are needed.

## Tasks

- [x] 1. API Service Layer
  - Create `frontend/src/services/classesService.ts` wrapping `apiClient` for all class API calls
  - _Requirements: API contract_

  - [x] 1.1 Create `frontend/src/services/classesService.ts` with:
    - `listClasses(params: { page?, limit?, level?, status?, search? })` → calls `GET /api/v1/classes`
    - `getClass(id: string)` → calls `GET /api/v1/classes/:id`
    - `createClass(data: ClassFormData)` → calls `POST /api/v1/classes`
    - `updateClass(id: string, data: Partial<ClassFormData>)` → calls `PUT /api/v1/classes/:id`
    - `deactivateClass(id: string)` → calls `DELETE /api/v1/classes/:id`
    - `getClassStudents(id: string)` → calls `GET /api/v1/classes/:id/students`
    - Export `ClassRecord` and `ClassFormData` TypeScript interfaces

- [x] 2. Class Form Modal
  - Create `frontend/src/pages/academic/components/ClassFormModal.tsx`
  - _Requirements: Add/edit with Zod validation_

  - [x] 2.1 Create `frontend/src/pages/academic/components/ClassFormModal.tsx` — `Modal size="md"` wrapping a React Hook Form + Zod form with fields: Class Name (text, required), Level (select: JSS1/JSS2/JSS3/SSS1/SSS2/SSS3, required), Stream/Section (text, optional), Capacity (number 5–100, required), Room Number (text, optional), Floor (text, optional), Building (text, optional); submit calls `classesService.createClass` or `classesService.updateClass` based on whether an existing class is passed; shows server error in a red alert banner on failure; calls `onSuccess()` and closes on success

- [x] 3. Class Students Modal
  - Create `frontend/src/pages/academic/components/ClassStudentsModal.tsx`
  - _Requirements: View students enrolled in a class_

  - [x] 3.1 Create `frontend/src/pages/academic/components/ClassStudentsModal.tsx` — `Modal size="lg"` with title `"{className} — Students"`; calls `classesService.getClassStudents(classId)` on open via `useQuery`; shows `SkeletonTableRow` while loading; shows `EmptyState message="No students enrolled"` when empty; shows a simple HTML table with columns: Roll Number, Full Name, Status (`StatusBadge`); shows total count in modal subtitle

- [x] 4. Classes Page
  - Create `frontend/src/pages/academic/ClassesPage.tsx` — the main page composing all sections
  - _Requirements: Full list page with KPIs, table, search/filter_

  - [ ] 4.1 Create `frontend/src/pages/academic/ClassesPage.tsx` using `AdminPageTemplate`:
    - Wrap in `MainLayout`
    - Use `PageShell` with `title="Classes & Streams"` and breadcrumbs `[{ label: "Classes & Streams" }]`
    - Fetch classes with `useEntityList` hook pointing to `/api/v1/classes`
    - KPI stat row (4 `KPICard` components): Total Classes, Total Enrolled, Avg Class Size, Avg Capacity Used %
    - `ActionBar` with search, Level multi-select filter, Status filter, and "Add Class" button wrapped in `<RoleGuard roles={['principal', 'super_admin']}>`
    - `DataTable` with columns: Name, Level, Section, Class Teacher, Room, Enrolled/Capacity (with ProgressBar), Status (StatusBadge), Actions
    - Row actions: Edit (opens ClassFormModal pre-populated), View Students (opens ClassStudentsModal), Deactivate (opens ConfirmationDialog)
    - Deactivate calls `classesService.deactivateClass(id)` then `showToast.deleted('Class')` and refetches
    - BulkToolbar with "Deactivate selected" action (principal/super_admin only via RoleGuard)
    - ProgressBar colour logic: `< 75%` → green, `75–89%` → amber, `≥ 90%` → red

  - [x] 4.2 Add ConfirmationDialog for deactivate — renders when a class row's Deactivate action is clicked; calls `classesService.deactivateClass` on confirm; shows `showToast.deleted('Class')` on success

- [x] 5. Route Registration
  - Add the `/academic/classes` route to `frontend/src/router/routes.tsx`
  - _Requirements: Route accessible to principal, super_admin, teacher_

  - [x] 5.1 Add import `import ClassesPage from '@pages/academic/ClassesPage';` and route entry `{ path: 'academic/classes', element: <ProtectedRoute requiredRoles={['principal', 'super_admin', 'teacher']}><ClassesPage /></ProtectedRoute> }` to `frontend/src/router/routes.tsx`

## Notes

- No new npm packages — only packages already in `frontend/package.json`
- Backend endpoint is `/api/v1/classes` — the `classesService` must use `apiClient` from `@lib/apiClient`
- `useEntityList` from `@hooks/admin/useEntityList` handles TanStack Query caching and pagination
- The Sidebar already links to `/academic/classes` — no sidebar changes needed
- Teachers see the list read-only (no Add/Edit/Deactivate buttons) via `RoleGuard`
- ProgressBar capacity fill: `(enrolled_students / capacity) * 100` clamped 0–100
- Levels available: JSS1, JSS2, JSS3, SSS1, SSS2, SSS3

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2", "3"] },
    { "wave": 3, "tasks": ["4"] },
    { "wave": 4, "tasks": ["5"] }
  ]
}
```
