# Requirements Document

## Introduction

This document defines the requirements for rebuilding `frontend/src/pages/AdminDashboard.tsx` — the principal's dashboard at route `/admin/dashboard`. The existing page is fully functional but uses ad-hoc inline HTML throughout. This rebuild replaces every ad-hoc element with shared components from the Admin Dashboard Design System (`frontend/src/components/admin/`) and the existing `KPICard` component, while preserving all existing behaviours, adding loading skeletons, proper error handling, and connecting quick-action buttons to real navigation routes.

The page renders inside `MainLayout` (Header + Sidebar + `<main>`) via `ProtectedRoute requiredRoles={['principal']}` at `/admin/dashboard`. Data is sourced exclusively from the `useDashboard()` hook, which calls `dashboardService.getCompleteDashboard()` and returns a `CompleteDashboard` object.

---

## Glossary

- **Dashboard_Page**: The rebuilt `AdminDashboard.tsx` component rendered at `/admin/dashboard`.
- **Design_System**: The Admin Dashboard Design System component library being built under `frontend/src/components/admin/`.
- **useDashboard_Hook**: The custom hook `useDashboard()` from `frontend/src/hooks/useDashboard.ts` that exposes `{ dashboard, loading, error, refreshDashboard }`.
- **CompleteDashboard**: The TypeScript interface returned by `useDashboard()` containing `metrics`, `alerts`, `financialSummary`, `atRiskStudents`, `systemHealth`, `charts`, and `timestamp`.
- **KPI_Row**: The horizontal strip of four `KPICard` components at the top of the Dashboard_Page.
- **Alerts_Panel**: The section that lists `CompleteDashboard.alerts` filtered by locally dismissed IDs.
- **Financial_Card**: The card displaying `CompleteDashboard.financialSummary` data.
- **System_Health_Panel**: The panel displaying `CompleteDashboard.systemHealth` data, visible only to the `principal` role.
- **Charts_Grid**: The 2×2 grid of `ChartCard` components rendered from `CompleteDashboard.charts`.
- **At_Risk_Panel**: The panel listing up to 10 students from `CompleteDashboard.atRiskStudents`.
- **Quick_Actions_Grid**: The 2×4 grid of `Button` components navigating to defined routes.
- **PageShell**: The `frontend/src/components/admin/layout/PageShell.tsx` component providing consistent page scaffolding.
- **PageHeader**: The `frontend/src/components/admin/layout/PageHeader.tsx` component rendering title, subtitle, and action buttons.
- **ChartCard_DS**: The Design System's `frontend/src/components/admin/charts/ChartCard.tsx`, distinct from the legacy `frontend/src/components/dashboard/ChartCard.tsx`.
- **SkeletonCard**: The `SkeletonCard` variant from `frontend/src/components/admin/feedback/Skeleton.tsx`.
- **SkeletonChart**: The `SkeletonChart` variant from `frontend/src/components/admin/feedback/Skeleton.tsx`.
- **StatusBadge_DS**: The `StatusBadge` component from `frontend/src/components/admin/feedback/StatusBadge.tsx`.
- **ProgressBar_DS**: The `ProgressBar` component from `frontend/src/components/admin/feedback/ProgressBar.tsx`.
- **ErrorState_DS**: The `ErrorState` component from `frontend/src/components/admin/feedback/ErrorState.tsx`.
- **EmptyState_DS**: The `EmptyState` component from `frontend/src/components/admin/feedback/EmptyState.tsx`.
- **Currency**: Sierra Leonean Leone, always formatted as `Le {value.toLocaleString()}` (e.g., `Le 1,250,000`).

---

## Requirements

### Requirement 1: Page Shell and Header

**User Story:** As a principal, I want the dashboard to have a consistent header with my name, a refresh control, and an export control, so that I always know which page I am on and can act on it quickly.

#### Acceptance Criteria

1. THE Dashboard_Page SHALL render using `PageShell` from the Design_System as the outermost content container inside `MainLayout`.
2. THE Dashboard_Page header title SHALL be the string `"Principal Dashboard"`.
3. THE Dashboard_Page SHALL display a personalised subtitle reading `"Welcome back, {firstName} {lastName}"` sourced from `useAuth().user`.
4. THE Dashboard_Page SHALL render a Refresh button in the `PageHeader` actions slot that calls `refreshDashboard()` from the `useDashboard_Hook` when clicked.
5. WHEN `loading` from `useDashboard_Hook` is `true`, THE Refresh button SHALL display a spinning `RefreshCw` icon (using Tailwind `animate-spin`) and be `disabled`.
6. THE Dashboard_Page SHALL render an Export button in the `PageHeader` actions slot that calls `window.print()` when clicked.
7. THE Dashboard_Page SHALL call `refreshDashboard()` once on mount and set up an interval to call `refreshDashboard()` every 5 minutes (300,000 ms), clearing the interval on component unmount.

---

### Requirement 2: Loading States

**User Story:** As a principal, I want to see placeholder shapes while data is loading, so that the page does not jump or show blank areas before data arrives.

#### Acceptance Criteria

1. WHILE `loading` is `true` AND `dashboard` is `null` (initial load), THE KPI_Row SHALL render four `SkeletonCard` components in place of `KPICard` components.
2. WHILE `loading` is `true` AND `dashboard` is `null`, THE Charts_Grid SHALL render four `SkeletonChart` components each at height 300, in place of `ChartCard_DS` components.
3. THE Dashboard_Page SHALL NOT render a full-screen spinner or block the entire page layout during loading.
4. WHEN `loading` is `true` AND `dashboard` is already populated (a background refresh), THE Dashboard_Page SHALL NOT replace visible content with skeletons; the Refresh button spinner is sufficient feedback.

---

### Requirement 3: Error State

**User Story:** As a principal, I want a clear error message with a retry option when the dashboard fails to load, so that I know something went wrong and can recover without refreshing the browser.

#### Acceptance Criteria

1. WHEN `error` from `useDashboard_Hook` is non-null AND `dashboard` is `null`, THE Dashboard_Page SHALL render `ErrorState_DS` as the primary content area, replacing the normal dashboard sections.
2. THE `ErrorState_DS` SHALL display the error message from `useDashboard_Hook` or a fallback message of `"Failed to load dashboard data"` when the error message is empty.
3. THE `ErrorState_DS` SHALL include a "Try again" button that calls `refreshDashboard()` when clicked.
4. WHEN `error` is non-null AND `dashboard` is already populated (error from a background refresh), THE Dashboard_Page SHALL NOT replace the page with `ErrorState_DS`; existing data SHALL remain visible.

---

### Requirement 4: KPI Stat Row

**User Story:** As a principal, I want to see four key metrics at the top of the dashboard, so that I can immediately assess the school's status at a glance.

#### Acceptance Criteria

1. THE KPI_Row SHALL render exactly four `KPICard` components in a CSS grid with classes `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6`.
2. THE first `KPICard` SHALL display the label `"Total Students"`, the value `dashboard.metrics.totalStudents`, a `Users` icon from `lucide-react`, and the `blue` colour variant.
3. THE second `KPICard` SHALL display the label `"Total Teachers"`, the value `dashboard.metrics.totalTeachers`, a `Briefcase` icon from `lucide-react`, and the `green` colour variant.
4. THE third `KPICard` SHALL display the label `"Total Classes"`, the value `dashboard.metrics.totalClasses`, a `BookOpen` icon from `lucide-react`, and the `purple` colour variant.
5. THE fourth `KPICard` SHALL display the label `"Outstanding Fees"`, the value formatted as `"Le {dashboard.metrics.outstandingFees.toLocaleString()}"`, a `DollarSign` icon from `lucide-react`, and the `red` colour variant.
6. WHEN `loading` is `true` AND `dashboard` is `null`, THE KPI_Row SHALL pass `isLoading={true}` to each `KPICard`, causing each to render its internal skeleton state.
7. WHEN `dashboard.metrics.totalStudents` changes between refreshes, THE KPI_Row SHALL reflect the updated value without requiring a page reload.

---

### Requirement 5: Alerts Panel

**User Story:** As a principal, I want to see important system alerts with the ability to dismiss them, so that I am aware of issues that need my attention and can clear resolved ones.

#### Acceptance Criteria

1. THE Alerts_Panel SHALL render only alerts from `dashboard.alerts` whose `id` is NOT in a local `Set<string>` of dismissed alert IDs stored in component state.
2. THE Alerts_Panel SHALL render a maximum of 3 alert cards at once from the filtered (non-dismissed) list.
3. WHEN the total number of non-dismissed alerts exceeds 3, THE Alerts_Panel SHALL render a "View all" link below the visible alerts.
4. WHEN all alerts have been dismissed or `dashboard.alerts` is empty, THE Alerts_Panel SHALL not render any alerts section heading or container.
5. Each alert card SHALL display a coloured left-border (4 px) matching its `severity`: `info` → blue, `warning` → amber, `error` → red, `critical` → red.
6. Each alert card SHALL display the alert's `title` and `message` text.
7. WHEN an alert has a non-null `actionUrl`, THE alert card SHALL render a clickable action link navigating to that URL.
8. WHEN `alert.dismissible` is `true`, THE alert card SHALL render a dismiss button (×) in its top-right corner.
9. WHEN the dismiss button is clicked, THE Alerts_Panel SHALL add the alert's `id` to the dismissed set in local state, immediately removing that card from the visible list.
10. THE dismissed alert set SHALL persist only for the current page session (in React component state, not `localStorage`).

---

### Requirement 6: Financial Summary Card

**User Story:** As a principal, I want a financial summary card showing this month's collection, target progress, and outstanding balances, so that I can monitor the school's financial health at a glance.

#### Acceptance Criteria

1. THE Financial_Card SHALL render as a white card with a heading `"Financial Summary"`.
2. THE Financial_Card SHALL display `dashboard.financialSummary.thisMonthCollected` formatted as Currency in a prominent green bold style (`text-2xl font-bold text-green-600`).
3. THE Financial_Card SHALL render a `ProgressBar_DS` component with `value={dashboard.financialSummary.collectionRate}` (clamped to 0–100), `color="green"`, and `showValue={true}`.
4. THE Financial_Card SHALL display a label `"of monthly target"` adjacent to or below the `ProgressBar_DS`.
5. THE Financial_Card SHALL display `dashboard.financialSummary.outstandingBalance` formatted as Currency with a `text-red-600` colour.
6. THE Financial_Card SHALL display `dashboard.financialSummary.overdueAmount` formatted as Currency with a `text-red-600` colour.
7. THE Financial_Card SHALL display the collection trend using `StatusBadge_DS`; a positive `trend` value SHALL map to `"improving"` with a success variant, and a zero or negative value SHALL map to `"declining"` with a warning variant.

---

### Requirement 7: System Health Panel

**User Story:** As a principal, I want to see system health information — database status, backups, response time, storage, and active users — so that I can identify technical issues before they affect staff.

#### Acceptance Criteria

1. THE System_Health_Panel SHALL be rendered only when the authenticated user's role is `"principal"`, using `RoleGuard` from the Design_System with `roles={['principal']}`.
2. THE System_Health_Panel SHALL display the `dashboard.systemHealth.databaseStatus` using `StatusBadge_DS` with the mapping: `"healthy"` → success variant, `"warning"` → warning variant, `"error"` → destructive variant.
3. THE System_Health_Panel SHALL display `dashboard.systemHealth.lastBackup` as a human-readable relative time (e.g., `"2h ago"`) and the formatted absolute timestamp.
4. THE System_Health_Panel SHALL display `dashboard.systemHealth.apiResponseTime` in milliseconds with a contextual label: `< 200ms` → `"Optimal"` in `text-green-600`, `≥ 200ms` → `"Acceptable"` in `text-amber-600`.
5. THE System_Health_Panel SHALL render a `ProgressBar_DS` for `dashboard.systemHealth.storageUsage` with colour `"green"` when `< 60%`, `"amber"` when `60–79%`, and `"red"` when `≥ 80%`.
6. THE System_Health_Panel SHALL display `dashboard.systemHealth.activeUsers` as a numeric count with the label `"Online"`.
7. THE Financial_Card and System_Health_Panel SHALL be laid out side-by-side on desktop (`lg:grid-cols-3` with Financial_Card as `lg:col-span-1` and System_Health_Panel as `lg:col-span-2`) and stacked vertically on mobile.

---

### Requirement 8: Charts Grid

**User Story:** As a principal, I want four charts visualising attendance, fee collection, student distribution, and academic performance, so that I can understand trends without navigating away from the dashboard.

#### Acceptance Criteria

1. THE Charts_Grid SHALL render four `ChartCard_DS` components in a `grid grid-cols-1 lg:grid-cols-2 gap-6` layout.
2. THE first `ChartCard_DS` SHALL render the `Attendance Trend` chart as a `line` type with height 300, using data from `dashboard.charts.attendanceTrend`.
3. THE second `ChartCard_DS` SHALL render the `Fee Collection` chart as a `bar` type with height 300, using data from `dashboard.charts.feeCollection`.
4. THE third `ChartCard_DS` SHALL render the `Student Distribution` chart as a `pie` type with height 300, using data from `dashboard.charts.studentDistribution`.
5. THE fourth `ChartCard_DS` SHALL render the `Academic Performance by Class` chart as a `bar` type with height 300, using data from `dashboard.charts.academicPerformance`.
6. WHILE `loading` is `true` AND `dashboard` is `null` (initial load with no existing data), each `ChartCard_DS` SHALL receive `isLoading={true}` and render a `SkeletonChart` at height 300. WHEN `loading` is `true` but `dashboard` is already populated, `isLoading` SHALL NOT be set to `true`; existing chart data SHALL remain visible.
7. WHEN a chart's corresponding dataset has no data points (empty `labels` array or all series have empty `data` arrays), THE `ChartCard_DS` SHALL render `EmptyState_DS` with message `"No data available"` instead of the chart.
8. THE chart data MUST be transformed from the `ChartData` format (`{ labels, datasets }`) returned by `useDashboard_Hook` into the `ChartSeries[]` format expected by `ChartCard_DS` before passing as props.

---

### Requirement 9: At-Risk Students Panel

**User Story:** As a principal, I want to see a list of students identified as at risk, with their severity, attendance rate, grades, and risk factors, so that I can take targeted action for each student.

#### Acceptance Criteria

1. THE At_Risk_Panel SHALL render a heading `"Students at Risk"` with a count badge showing the number of students in `dashboard.atRiskStudents`.
2. THE At_Risk_Panel SHALL display up to 10 students from `dashboard.atRiskStudents` in a horizontally scrollable table.
3. Each table row SHALL display: student name, roll number, class name, severity badge, attendance rate, average grade, and risk factor chips.
4. THE severity column SHALL use `StatusBadge_DS` with the mapping: `"high"` → destructive variant, `"medium"` → warning variant, `"low"` → secondary variant.
5. THE attendance rate column SHALL render a `ProgressBar_DS` with `size="sm"`, coloured `"red"` when `attendanceRate < 75`, `"amber"` when `75 ≤ attendanceRate < 90`, and `"green"` when `≥ 90`.
6. THE risk factor chips SHALL render each entry in `student.riskFactors` as an inline chip with `bg-red-100 text-red-700 text-xs rounded px-2 py-0.5`.
7. WHEN `dashboard.atRiskStudents` is an empty array, THE At_Risk_Panel SHALL render `EmptyState_DS` with message `"No students at risk"` and description `"All students are performing within acceptable parameters"`.

---

### Requirement 10: Quick Actions Grid

**User Story:** As a principal, I want quick-action buttons for the most common tasks so that I can navigate directly to key areas of the system without using the sidebar.

#### Acceptance Criteria

1. THE Quick_Actions_Grid SHALL render eight `Button` components in a `grid grid-cols-2 md:grid-cols-4 gap-4` layout.
2. Each `Button` SHALL use `variant="outline"` and navigate to its target route using `useNavigate` from `react-router-dom` when clicked.
3. THE Quick_Actions_Grid SHALL include the following actions in order:
   - `"Enroll Student"` → navigates to `/students`
   - `"Create Class"` → navigates to `/classes`
   - `"Add Teacher"` → navigates to `/teachers`
   - `"Manage Timetable"` → navigates to `/timetable`
   - `"Publish Results"` → navigates to `/examinations`
   - `"Generate Report"` → navigates to `/reports`
   - `"Send Announcement"` → navigates to `/announcements`
   - `"Import / Export"` → navigates to `/import-export`
4. Each `Button` in the Quick_Actions_Grid SHALL display a relevant `lucide-react` icon alongside the label.
5. THE Quick_Actions_Grid SHALL be contained in a white card with a heading `"Quick Actions"`.

---

### Requirement 11: Responsive Layout

**User Story:** As a principal, I want the dashboard to be usable on any device — mobile, tablet, or desktop — so that I can check key information even when away from my desk.

#### Acceptance Criteria

1. THE KPI_Row SHALL use `grid-cols-1` on mobile (< 640 px), `grid-cols-2` on tablet (640 px–1023 px), and `grid-cols-4` on desktop (≥ 1024 px).
2. THE Charts_Grid SHALL use `grid-cols-1` on mobile and tablet, and `grid-cols-2` on desktop.
3. THE Quick_Actions_Grid SHALL use `grid-cols-2` on mobile and `grid-cols-4` on tablet and desktop.
4. THE At_Risk_Panel table SHALL be wrapped in an `overflow-x-auto` container so that it scrolls horizontally on small screens without breaking the layout.
5. THE Financial_Card and System_Health_Panel SHALL stack vertically on mobile and tablet, and render side-by-side on desktop using a `lg:grid-cols-3` grid.
6. THE PageHeader actions (Refresh and Export buttons) SHALL display icon-only on mobile and icon + label on tablet and desktop.

---

### Requirement 12: Currency Formatting

**User Story:** As a principal, I want all monetary values to display with the correct Sierra Leonean Leone prefix and thousands separator, so that large numbers are readable and unambiguous.

#### Acceptance Criteria

1. THE Dashboard_Page SHALL format all monetary values using the pattern `Le {value.toLocaleString()}`, producing output such as `"Le 1,250,000"`.
2. THE `"Outstanding Fees"` KPI value SHALL be formatted as Currency.
3. THE `"This Month Collected"` value in Financial_Card SHALL be formatted as Currency.
4. THE `"Outstanding Balance"` value in Financial_Card SHALL be formatted as Currency.
5. THE `"Overdue Amount"` value in Financial_Card SHALL be formatted as Currency.
6. IF `value` is `undefined` or `null`, THE Dashboard_Page SHALL fall back to displaying `"Le 0"` rather than rendering `"Le NaN"` or `"Le undefined"` — this applies to all five monetary fields: Outstanding Fees, This Month Collected, Outstanding Balance, and Overdue Amount.

---

### Requirement 13: No New Dependencies

**User Story:** As a developer, I want the rebuilt dashboard to use only the packages already listed in `frontend/package.json`, so that we do not introduce new bundle weight or security surface area.

#### Acceptance Criteria

1. THE Dashboard_Page rebuild SHALL NOT introduce any `npm` package not already present in `frontend/package.json`.
2. THE rebuilt file SHALL replace `frontend/src/pages/AdminDashboard.tsx` in-place, keeping the same filename and default export so that `routes.tsx` requires no changes.
3. THE rebuilt file SHALL preserve the `export const AdminDashboard` named export alongside the `export default AdminDashboard` default export.
