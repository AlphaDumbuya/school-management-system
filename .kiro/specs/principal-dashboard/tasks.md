# Implementation Plan: Principal Dashboard Rebuild

## Overview

Rebuild `frontend/src/pages/AdminDashboard.tsx` in-place, replacing ad-hoc inline HTML with Design System components while preserving every existing behaviour. Implementation proceeds section-by-section: helper utilities first, then the page top-down, with property/unit tests as sub-tasks after each logical unit.

All code is TypeScript/React. No new npm packages are introduced.

---

## Tasks

- [x] 1. Create helper utilities module
  - Create `frontend/src/pages/adminDashboardHelpers.ts` with three pure functions:
    - `formatCurrency(value: number | undefined | null): string` — returns `"Le 0"` for nullish/NaN values, otherwise `"Le ${value.toLocaleString()}"`
    - `toChartSeries(chartData: ChartData): { series: ChartSeries[]; labels: string[] }` — maps `dataset.label` → `series.name`, `dataset.data` → `series.data`, preserves `labels`
    - `isChartEmpty(chartData: ChartData | undefined): boolean` — true when `chartData` is undefined, `labels` is empty, or all `datasets` have zero-length `data`
  - Import `ChartData` from `@hooks/useDashboard`, import `ChartSeries` type from `@components/admin/charts/ChartCard`
  - _Requirements: 8.8, 12.1–12.6_

  - [ ]* 1.1 Write unit/property tests for helper utilities
    - Test file: `frontend/src/pages/__tests__/adminDashboardHelpers.test.ts`
    - `formatCurrency`: test with `0`, `1250000`, `undefined`, `null`, `NaN`, negative values
    - `toChartSeries`: test with 0 datasets, 1 dataset, multiple datasets; verify `series[i].name === datasets[i].label` and `series[i].data` deeply equals `datasets[i].data` for each entry; verify labels preserved
    - `isChartEmpty`: test with undefined, empty labels array, populated labels with empty datasets, fully populated data
    - Attendance rate thresholds (separate lookup function if extracted): `74.9`→`red`, `75`→`amber`, `89.9`→`amber`, `90`→`green`
    - **Property 7: Currency formatting invariant — Validates: Requirements 12.1, 12.6**
    - **Property 8: ChartData → ChartSeries round-trip — Validates: Requirements 8.8**
    - _Requirements: 8.8, 12.1–12.6_

- [x] 2. Implement the page skeleton and initial load state
  - Open `frontend/src/pages/AdminDashboard.tsx` and replace the entire file content
  - Add imports: `PageShell`, `PageHeader` from `@components/admin/layout`; `Button` from `@components/ui/button`; `SkeletonCard`, `SkeletonChart`, `ErrorState` from `@components/admin/feedback`; `RoleGuard` from `@components/admin/common/RoleGuard`; `KPICard` from `@components/dashboard/KPICard`; `RefreshCw`, `Download`, `Users`, `Briefcase`, `BookOpen`, `DollarSign` from `lucide-react`; `useNavigate` from `react-router-dom`; helper functions from `./adminDashboardHelpers`
  - Wire `useAuth()` for `user` and `useDashboard()` for `{ dashboard, loading, error, refreshDashboard }`
  - Derive `isInitialLoad = loading && dashboard === null`
  - Implement mount effect: call `refreshDashboard()` once + `setInterval(refreshDashboard, 300_000)` with cleanup
  - Wrap page content in `PageShell` with `title="Principal Dashboard"` and `subtitle={\`Welcome back, ${user?.firstName} ${user?.lastName}\`}`
  - Add `PageHeader` actions: Refresh `Button` (variant default, `disabled={loading}`, `RefreshCw` icon with `animate-spin` when loading); Export `Button` (variant outline, `Download` icon, `onClick={() => window.print()}`)
  - When `error && !dashboard`: render `ErrorState` with `message={error ?? 'Failed to load dashboard data'}` and `onRetry={refreshDashboard}`; `return` early from the normal page body
  - Preserve `export const AdminDashboard` named export and `export default AdminDashboard`
  - _Requirements: 1.1–1.7, 2.3, 3.1–3.3, 13.2–13.3_

  - [ ]* 2.1 Write rendering tests for page shell and header
    - Test file: `frontend/src/pages/__tests__/AdminDashboard.test.tsx`
    - Mock `useDashboard`, `useAuth`, `useNavigate`
    - Test: title "Principal Dashboard" present when dashboard loaded
    - Test: subtitle contains user's firstName and lastName
    - **Property 1: Subtitle contains authenticated user's full name — Validates: Requirements 1.3**
    - **Property 2: Error message propagation — Validates: Requirements 3.1, 3.2**
    - Test: `ErrorState` rendered when `error="Network error"` and `dashboard=null`; normal sections absent
    - Test: `ErrorState` NOT rendered when `error` is set but `dashboard` is populated
    - _Requirements: 1.2, 1.3, 3.1–3.4_

- [x] 3. Implement KPI Stat Row
  - Below the error guard, implement the KPI row: `<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">`
  - When `isInitialLoad`: render `<SkeletonCard />` four times
  - When NOT `isInitialLoad`: render four `KPICard` components:
    - `title="Total Students"`, `value={dashboard?.metrics?.totalStudents ?? 0}`, `icon={<Users size={32} />}`, `color="blue"`
    - `title="Total Teachers"`, `value={dashboard?.metrics?.totalTeachers ?? 0}`, `icon={<Briefcase size={32} />}`, `color="green"`
    - `title="Total Classes"`, `value={dashboard?.metrics?.totalClasses ?? 0}`, `icon={<BookOpen size={32} />}`, `color="purple"`
    - `title="Outstanding Fees"`, `value={formatCurrency(dashboard?.metrics?.outstandingFees)}`, `icon={<DollarSign size={32} />}`, `color="red"`
  - _Requirements: 4.1–4.7_

  - [ ]* 3.1 Write tests for KPI Stat Row
    - Test: 4 SkeletonCard rendered during initial load (`loading=true`, `dashboard=null`)
    - Test: 4 KPICard rendered with correct values when dashboard populated (fixture with known values)
    - Test: Outstanding Fees KPICard value starts with "Le " for a known outstandingFees number
    - **Property 3: KPI values match metrics fields — Validates: Requirements 4.2–4.5**
    - _Requirements: 4.1–4.6_

- [x] 4. Implement Alerts Panel
  - Add `dismissedAlerts` state: `const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())`
  - Derive `visibleAlerts = (dashboard?.alerts ?? []).filter(a => !dismissedAlerts.has(a.id))`
  - Derive `shownAlerts = visibleAlerts.slice(0, 3)` and `hasMoreAlerts = visibleAlerts.length > 3`
  - Implement `handleDismissAlert = (id: string) => setDismissedAlerts(prev => new Set([...prev, id]))`
  - Render the Alerts_Panel section only when `visibleAlerts.length > 0`:
    - Section heading `"System Alerts"`
    - Map `shownAlerts` to alert cards: each is a `<div>` with `border-l-4` coloured by severity:
      - `info` → `border-blue-500 bg-blue-50`
      - `warning` → `border-amber-500 bg-amber-50`
      - `error` | `critical` → `border-red-500 bg-red-50`
    - Each card shows `alert.title` (bold) and `alert.message`
    - If `alert.actionUrl`: render an `<a href={alert.actionUrl}>` action link
    - If `alert.dismissible`: render a dismiss `<button aria-label="Dismiss alert">×</button>` calling `handleDismissAlert(alert.id)`
  - When `hasMoreAlerts`: render a "View all" text link below the cards
  - _Requirements: 5.1–5.10_

  - [ ]* 4.1 Write tests for Alerts Panel
    - Test: non-dismissed alerts shown; dismissed alerts absent
    - **Property 4: Alert dismissal filter invariant — Validates: Requirements 5.1**
    - **Property 5: Visible alerts capped at 3 — Validates: Requirements 5.2, 5.3**
    - **Property 6: Alert severity → border colour mapping — Validates: Requirements 5.5**
    - Test: "View all" link present when >3 non-dismissed alerts, absent when ≤3
    - Test: section absent when all alerts dismissed
    - Test: clicking × on a dismissible alert removes it from DOM
    - _Requirements: 5.1–5.9_

- [x] 5. Implement Financial Summary Card
  - Import `ProgressBar` and `StatusBadge` from `@components/admin/feedback`
  - Render `Financial_Card` as a white card (`bg-white rounded-xl border border-gray-200 shadow-sm p-6`):
    - Heading: `"Financial Summary"`
    - `thisMonthCollected`: `<p className="text-2xl font-bold text-green-600">{formatCurrency(dashboard?.financialSummary?.thisMonthCollected)}</p>`
    - `ProgressBar` with `value={dashboard?.financialSummary?.collectionRate ?? 0}`, `color="green"`, `showValue={true}`, label `"of monthly target"` below
    - `outstandingBalance`: label + `<span className="text-red-600">{formatCurrency(...)}</span>`
    - `overdueAmount`: label + `<span className="text-red-600">{formatCurrency(...)}</span>`
    - Trend badge: `<StatusBadge status={(dashboard?.financialSummary?.trend ?? 0) > 0 ? 'active' : 'overdue'} />`
  - _Requirements: 6.1–6.7_

  - [ ]* 5.1 Write tests for Financial Card
    - Test: `thisMonthCollected` rendered with "Le " prefix and green styling
    - Test: `ProgressBar` receives correct `value` prop from `collectionRate`
    - Test: positive `trend` → `StatusBadge` with `status="active"` (success variant); zero/negative → `status="overdue"` (warning)
    - _Requirements: 6.2, 6.3, 6.7_

- [x] 6. Implement System Health Panel with RoleGuard
  - Wrap the existing `SystemHealthPanel` component (`@components/dashboard/SystemHealthPanel`) inside `<RoleGuard roles={['principal']}>`:
    ```tsx
    <RoleGuard roles={['principal']}>
      {dashboard?.systemHealth && (
        <SystemHealthPanel
          databaseStatus={dashboard.systemHealth.databaseStatus}
          lastBackup={dashboard.systemHealth.lastBackup}
          apiResponseTime={dashboard.systemHealth.apiResponseTime}
          storageUsage={dashboard.systemHealth.storageUsage}
          activeUsers={dashboard.systemHealth.activeUsers}
        />
      )}
    </RoleGuard>
    ```
  - Place Financial_Card and System_Health_Panel in a `<div className="grid grid-cols-1 gap-6 mb-8 lg:grid-cols-3">` where Financial_Card has class `lg:col-span-1` and the RoleGuard wrapper has class `lg:col-span-2`
  - _Requirements: 7.1–7.7_

  - [ ]* 6.1 Write tests for System Health role gating
    - **Property 13: System Health Panel role-gating — Validates: Requirements 7.1**
    - Test: Panel present when `user.role="principal"` and `dashboard.systemHealth` defined
    - Test: Panel absent when `user.role="teacher"` (any non-principal role)
    - _Requirements: 7.1_

- [x] 7. Implement Charts Grid
  - Import `ChartCard as ChartCard_DS` from `@components/admin/charts/ChartCard`; import `EmptyState` from `@components/admin/feedback`
  - Render Charts_Grid: `<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">`
  - For each of the four charts, follow this pattern:
    ```tsx
    {isInitialLoad
      ? <SkeletonChart height={300} />
      : <ChartCard_DS
          title="..."
          type="line|bar|pie"
          height={300}
          isLoading={false}
          {...(isChartEmpty(dashboard?.charts?.xxx)
            ? {}
            : toChartSeries(dashboard.charts.xxx))}
          // When empty, ChartCard_DS will render EmptyState internally
        />
    }
    ```
  - Charts in order:
    1. `title="Attendance Trend (Last 30 Days)"`, `type="line"`, source: `dashboard.charts.attendanceTrend`
    2. `title="Fee Collection (Last 12 Months)"`, `type="bar"`, source: `dashboard.charts.feeCollection`
    3. `title="Student Distribution by Class"`, `type="pie"`, source: `dashboard.charts.studentDistribution`
    4. `title="Academic Performance by Class"`, `type="bar"`, source: `dashboard.charts.academicPerformance`
  - _Requirements: 8.1–8.8_

  - [ ]* 7.1 Write tests for Charts Grid
    - Test: 4 `SkeletonChart` rendered during initial load
    - Test: `ChartCard_DS` rendered with correct `type` prop for each chart slot when dashboard populated
    - **Property 8: ChartData → ChartSeries round-trip (already covered in Task 1.1)**
    - _Requirements: 8.1–8.8_

- [x] 8. Checkpoint — Ensure all tests pass
  - Run `vitest --run` in `frontend/` and confirm zero failures
  - Check TypeScript with `npx tsc --noEmit` in `frontend/`
  - Ask the user if any questions arise before continuing

- [x] 9. Implement At-Risk Students Panel
  - Import `EmptyState`, `StatusBadge`, `ProgressBar` from `@components/admin/feedback`
  - Render At_Risk_Panel: `<div className="mb-8">`
  - Heading: `<h2>Students at Risk <span className="...">{dashboard.atRiskStudents.length}</span></h2>`
  - When `atRiskStudents.length === 0`: render `<EmptyState message="No students at risk" description="All students are performing within acceptable parameters" />`
  - When non-empty: render `<div className="overflow-x-auto">` wrapping an HTML `<table>` with columns: Name, Roll No., Class, Severity, Attendance, Grade, Risk Factors
  - Render `dashboard.atRiskStudents.slice(0, 10)` as rows
  - Severity column: `<StatusBadge status={severityToStatus[student.severity]} />` using the mapping `{ high: 'overdue', medium: 'pending', low: 'inactive' }`
  - Attendance column: attendance rate text + `<ProgressBar size="sm" value={student.attendanceRate} color={attendanceColor(student.attendanceRate)} showValue={false} />`
    - `attendanceColor`: `< 75` → `"red"`, `75–89.9` → `"amber"`, `≥ 90` → `"green"`
  - Grade column: `student.averageGrade.toFixed(1)`, coloured red when `< 40`, green otherwise
  - Risk factors column: `student.riskFactors.map(f => <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded mr-1">{f}</span>)`
  - _Requirements: 9.1–9.7_

  - [ ]* 9.1 Write tests for At-Risk Panel
    - **Property 9: Count badge matches array length — Validates: Requirements 9.1**
    - **Property 10: At most 10 students rendered — Validates: Requirements 9.2**
    - **Property 11: Attendance rate → ProgressBar colour threshold correctness — Validates: Requirements 9.5**
    - Test: `EmptyState` shown when `atRiskStudents=[]`
    - Test: severity "high" renders StatusBadge with destructive-mapped status
    - _Requirements: 9.1–9.7_

- [x] 10. Implement Quick Actions Grid
  - Import `useNavigate` from `react-router-dom` (already imported from Task 2)
  - Render `<div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">` with heading `"Quick Actions"`
  - Inside: `<div className="grid grid-cols-2 md:grid-cols-4 gap-4">`
  - Render 8 `Button` components (variant `"outline"`) using the exact route table below:

    | Label              | Icon (lucide-react)     | Route              |
    |--------------------|-------------------------|--------------------|
    | Enroll Student     | `UserPlus`              | `/students`        |
    | Create Class       | `BookOpen`              | `/classes`         |
    | Add Teacher        | `Briefcase`             | `/teachers`        |
    | Manage Timetable   | `CalendarDays`          | `/timetable`       |
    | Publish Results    | `ClipboardCheck`        | `/examinations`    |
    | Generate Report    | `BarChart2`             | `/reports`         |
    | Send Announcement  | `Megaphone`             | `/announcements`   |
    | Import / Export    | `ArrowLeftRight`        | `/import-export`   |

  - Each `Button` calls `navigate(route)` in its `onClick`
  - _Requirements: 10.1–10.5_

  - [ ]* 10.1 Write tests for Quick Actions Grid
    - Mock `useNavigate` → mock `navigate` function
    - **Property 12: Quick action routes are exhaustive and correct — Validates: Requirements 10.2, 10.3**
    - For each of the 8 buttons: find by label text, click it, assert `navigate` called with the correct route
    - _Requirements: 10.2, 10.3_

- [x] 11. Final integration pass — wire up and clean up
  - Remove all imports from the old page that are no longer used: `MainLayout` (now wrapped by `PageShell`/`ProtectedRoute` calling `MainLayout` at route level), `AdminMetricsCard`, `AlertCard`, `ChartComponent`, `AtRiskStudentsPanel` (if replaced inline), `SystemHealthPanel` references if moved
  - Verify `MainLayout` IS still wrapping: the existing `AdminDashboard` renders `<MainLayout>` as its outermost element — keep this wrapping intact inside the new file (PageShell goes inside MainLayout's `<main>` content area, NOT replacing MainLayout)
  - Confirm named export `export const AdminDashboard` and `export default AdminDashboard` are both present
  - Confirm `routes.tsx` requires no edits (the default export name is unchanged)
  - Remove `selectedStudent` state if no detail modal is being implemented in this spec (it was in the old file but the modal was never built)
  - _Requirements: 13.2, 13.3_

  - [ ]* 11.1 Write end-to-end integration render test
    - Render `AdminDashboard` with a mocked `useDashboard` returning a full realistic `CompleteDashboard` fixture and a mocked `useAuth` returning `{ user: { firstName: 'Jane', lastName: 'Doe', role: 'principal' } }`
    - Assert all seven sections are present: KPI row, alerts, financial, system health, charts, at-risk, quick actions
    - Assert heading "Principal Dashboard" present
    - Assert subtitle contains "Jane Doe"
    - _Requirements: 1.1–1.3, 4.1–4.5, 6.1, 7.1, 8.1, 9.1, 10.1_

- [x] 12. Final checkpoint — Ensure all tests pass
  - Run `vitest --run` in `frontend/` and confirm zero failures
  - Run `npx tsc --noEmit` in `frontend/` and confirm no TypeScript errors
  - Verify that `routes.tsx` compiles cleanly (no import changes needed)
  - Ask the user if any questions arise

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- `SkeletonCard` and `SkeletonChart` come from `@components/admin/feedback/Skeleton.tsx` (part of the admin-dashboard-design-system spec — that spec must be implemented before or alongside this one)
- `ChartCard` from the Design System (`@components/admin/charts/ChartCard.tsx`) is distinct from the legacy `@components/dashboard/ChartCard.tsx` — always import from the admin path
- The `SystemHealthPanel` component (`@components/dashboard/SystemHealthPanel.tsx`) is reused as-is; only the `RoleGuard` wrapper is new
- Property tests are implemented with `vitest`'s `it.each` using representative input arrays (no new PBT library needed per Requirement 13.1)

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2"] },
    { "wave": 3, "tasks": ["3", "4", "5", "6", "7"] },
    { "wave": 4, "tasks": ["8"] },
    { "wave": 5, "tasks": ["9", "10", "11"] },
    { "wave": 6, "tasks": ["12"] }
  ]
}
```
