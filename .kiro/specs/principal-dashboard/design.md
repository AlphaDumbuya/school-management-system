# Design Document: Principal Dashboard Rebuild

## Overview

This document describes the technical design for rebuilding `frontend/src/pages/AdminDashboard.tsx` — the principal's dashboard at `/admin/dashboard`. The goal is to replace all ad-hoc inline HTML with shared components from the Admin Dashboard Design System (`frontend/src/components/admin/`) while preserving every existing behaviour.

The file is replaced in-place, keeping the same filename, same route binding, and same named/default exports. No new npm packages are introduced.

---

## Architecture

### Component Hierarchy

```
AdminDashboard.tsx                       (page, ProtectedRoute principal only)
└── MainLayout                           (existing — unchanged)
    └── PageShell                        (admin/layout/PageShell.tsx)
        ├── PageHeader                   (admin/layout/PageHeader.tsx)
        │   ├── title: "Principal Dashboard"
        │   ├── subtitle: "Welcome back, {firstName} {lastName}"
        │   └── actions: <RefreshButton />, <ExportButton />
        │
        ├── KPI Row                      (grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6)
        │   ├── KPICard (Total Students)
        │   ├── KPICard (Total Teachers)
        │   ├── KPICard (Total Classes)
        │   └── KPICard (Outstanding Fees — Le prefix)
        │
        ├── AlertsPanel                  (conditional — hidden when empty)
        │   └── alert cards × max 3
        │
        ├── Financial + System Health    (grid lg:grid-cols-3)
        │   ├── FinancialCard            (lg:col-span-1)
        │   │   ├── thisMonthCollected (Currency, green)
        │   │   ├── ProgressBar_DS (collectionRate)
        │   │   ├── outstandingBalance (Currency, red)
        │   │   ├── overdueAmount (Currency, red)
        │   │   └── StatusBadge_DS (trend)
        │   └── RoleGuard roles={['principal']}
        │       └── SystemHealthPanel (lg:col-span-2)
        │
        ├── ChartsGrid                   (grid grid-cols-1 lg:grid-cols-2 gap-6)
        │   ├── ChartCard_DS (Attendance Trend — line)
        │   ├── ChartCard_DS (Fee Collection — bar)
        │   ├── ChartCard_DS (Student Distribution — pie)
        │   └── ChartCard_DS (Academic Performance — bar)
        │
        ├── AtRiskPanel
        │   ├── heading + count badge
        │   └── table rows × max 10
        │       ├── StatusBadge_DS (severity)
        │       ├── ProgressBar_DS (attendanceRate, sm, coloured by threshold)
        │       └── risk factor chips
        │
        └── QuickActionsGrid             (grid grid-cols-2 md:grid-cols-4 gap-4)
            └── Button × 8 (useNavigate)
```

### Data Flow

```
AdminDashboard
  ├── useAuth()        → user.firstName, user.lastName, user.role
  └── useDashboard()  → { dashboard, loading, error, refreshDashboard }
       └── dashboardService.getCompleteDashboard()
            └── GET /dashboards/admin/complete
                  (falls back to individual endpoints on failure)
```

All rendering decisions are driven by `{ dashboard, loading, error }`. No local data fetching is introduced; the page is a pure consumer of the hook's output.

### State

| State variable        | Type              | Initial      | Purpose                                          |
|-----------------------|-------------------|--------------|--------------------------------------------------|
| `dismissedAlerts`     | `Set<string>`     | `new Set()`  | IDs of alerts the user has dismissed this session |

No additional state variables are needed. The `loading` / `error` / `dashboard` state lives in `useDashboard`.

---

## Components and Interfaces

### Design System Imports

```typescript
// Layout
import { PageShell, PageHeader } from '@components/admin/layout';

// Charts
import { ChartCard as ChartCard_DS } from '@components/admin/charts/ChartCard';
// ChartCard_DS expects: { title, type, series: ChartSeries[], labels, height, isLoading }

// Feedback
import {
  SkeletonCard,
  SkeletonChart,
  StatusBadge,
  ProgressBar,
  EmptyState,
  ErrorState,
} from '@components/admin/feedback';

// Common
import { RoleGuard } from '@components/admin/common/RoleGuard';

// Existing base
import { KPICard } from '@components/dashboard/KPICard';
import { Button } from '@components/ui/button';
```

### ChartData → ChartSeries Transformation

`useDashboard()` returns chart data in the existing `ChartData` format used by Recharts:

```typescript
interface ChartData {
  labels: string[];
  datasets: ChartDataset[];   // { label, data: number[], … }
}
```

`ChartCard_DS` from the Design System expects:

```typescript
interface ChartSeries {
  name: string;    // maps from dataset.label
  data: number[];  // maps from dataset.data
}
// plus labels?: string[]  (x-axis / pie segment names)
```

The transformation function (defined as a module-level pure function in `AdminDashboard.tsx`):

```typescript
function toChartSeries(chartData: ChartData): { series: ChartSeries[]; labels: string[] } {
  return {
    labels: chartData.labels,
    series: chartData.datasets.map((ds) => ({
      name: ds.label,
      data: ds.data,
    })),
  };
}
```

Empty data guard (used before passing to `ChartCard_DS`):

```typescript
function isChartEmpty(chartData: ChartData | undefined): boolean {
  if (!chartData) return true;
  if (chartData.labels.length === 0) return true;
  return chartData.datasets.every((ds) => ds.data.length === 0);
}
```

### Currency Formatter

A module-level helper (no new dependency — uses native `Number.prototype.toLocaleString`):

```typescript
function formatCurrency(value: number | undefined | null): string {
  if (value == null || isNaN(value as number)) return 'Le 0';
  return `Le ${(value as number).toLocaleString()}`;
}
```

### Severity → StatusBadge Variant Mapping

For `atRiskStudents` severity field:

| Severity | StatusBadge variant |
|----------|---------------------|
| `high`   | `destructive`       |
| `medium` | `warning`           |
| `low`    | `secondary`         |

The `StatusBadge` component from the Design System maps the `status` string to a variant. To leverage it, pass the severity string as the `status` prop. If the canonical mapping doesn't cover `high`/`medium`/`low`, a thin local lookup converts to a Design System canonical status before passing:

```typescript
const severityToStatus: Record<string, string> = {
  high: 'overdue',      // maps to destructive
  medium: 'pending',    // maps to warning
  low: 'inactive',      // maps to secondary
};
```

### Trend → StatusBadge Variant Mapping

For `financialSummary.trend`:

| Condition      | Status string  | Variant   |
|----------------|----------------|-----------|
| `trend > 0`    | `"active"`     | success   |
| `trend <= 0`   | `"overdue"`    | warning   |

### Attendance Rate → ProgressBar Color

| Rate                | ProgressBar color |
|---------------------|-------------------|
| `rate < 75`         | `red`             |
| `75 ≤ rate < 90`    | `amber`           |
| `rate ≥ 90`         | `green`           |

### Storage Usage → ProgressBar Color

| Usage         | ProgressBar color |
|---------------|-------------------|
| `< 60%`       | `green`           |
| `60–79%`      | `amber`           |
| `≥ 80%`       | `red`             |

---

## Data Models

The rebuilt page consumes the existing types unchanged — no new interfaces are introduced.

```typescript
// All sourced from frontend/src/hooks/useDashboard.ts
interface CompleteDashboard {
  metrics: DashboardMetrics;
  alerts: DashboardAlert[];
  financialSummary: FinancialSummary;
  atRiskStudents: AtRiskStudent[];
  systemHealth: SystemHealth;
  charts: {
    academicPerformance: ChartData;
    attendanceTrend: ChartData;
    feeCollection: ChartData;
    studentDistribution: ChartData;
  };
  timestamp: string;
}
```

The key derived/computed values used by the view layer:

| Derived value            | Expression                                                    |
|--------------------------|---------------------------------------------------------------|
| `visibleAlerts`          | `alerts.filter(a => !dismissedAlerts.has(a.id))`             |
| `shownAlerts`            | `visibleAlerts.slice(0, 3)`                                   |
| `hasMoreAlerts`          | `visibleAlerts.length > 3`                                    |
| `isInitialLoad`          | `loading && dashboard === null`                               |
| `attendanceTrendChart`   | `toChartSeries(dashboard.charts.attendanceTrend)`             |
| `feeCollectionChart`     | `toChartSeries(dashboard.charts.feeCollection)`               |
| `studentDistChart`       | `toChartSeries(dashboard.charts.studentDistribution)`         |
| `academicPerfChart`      | `toChartSeries(dashboard.charts.academicPerformance)`         |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Subtitle contains authenticated user's full name

*For any* authenticated user object with a non-empty `firstName` and `lastName`, the rendered subtitle in `PageHeader` shall contain both `firstName` and `lastName` as substrings.

**Validates: Requirements 1.3**

---

### Property 2: Error message propagation

*For any* non-null, non-empty error string returned by `useDashboard`, when `dashboard` is `null`, the `ErrorState` component rendered on the page shall display a string that contains that error message (or the fallback when the message is empty).

**Validates: Requirements 3.1, 3.2**

---

### Property 3: KPI values match metrics fields

*For any* valid `DashboardMetrics` object, the four KPI cards rendered on the page shall display values derived only from `metrics.totalStudents`, `metrics.totalTeachers`, `metrics.totalClasses`, and `metrics.outstandingFees` respectively — no transposition or cross-field contamination.

**Validates: Requirements 4.2, 4.3, 4.4, 4.5**

---

### Property 4: Alert dismissal filter invariant

*For any* list of dashboard alerts and any set of dismissed IDs, the visible alerts rendered shall be exactly the subset of alerts whose `id` is NOT in the dismissed set. No dismissed alert shall appear; no non-dismissed alert shall be missing from the visible list.

**Validates: Requirements 5.1**

---

### Property 5: Visible alerts capped at 3

*For any* list of non-dismissed alerts, the number of alert cards rendered shall be at most 3. When the filtered list has more than 3 entries, the rendered count shall be exactly 3.

**Validates: Requirements 5.2, 5.3**

---

### Property 6: Alert severity → border colour mapping

*For any* alert with a known severity (`info`, `warning`, `error`, `critical`), the rendered alert card shall include the corresponding left-border CSS class: `border-blue-500` for `info`, `border-amber-500` for `warning`, `border-red-500` for `error` or `critical`.

**Validates: Requirements 5.5**

---

### Property 7: Currency formatting invariant

*For any* non-negative numeric value passed to `formatCurrency`, the returned string shall start with `"Le "` and the remainder shall equal `value.toLocaleString()`. For `undefined`, `null`, or `NaN` inputs, the returned string shall be exactly `"Le 0"`.

**Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6**

---

### Property 8: ChartData → ChartSeries round-trip labels preserved

*For any* `ChartData` object with non-empty `labels` and `datasets`, the `toChartSeries` transformation shall produce a `series` array of the same length as `datasets`, where each `series[i].name === datasets[i].label` and `series[i].data` deeply equals `datasets[i].data`, and the returned `labels` array deeply equals `chartData.labels`.

**Validates: Requirements 8.8**

---

### Property 9: At-risk student count badge matches array length

*For any* `atRiskStudents` array, the count displayed in the panel heading badge shall equal `atRiskStudents.length`.

**Validates: Requirements 9.1**

---

### Property 10: At-risk panel renders at most 10 students

*For any* `atRiskStudents` array, the number of rendered table rows shall equal `Math.min(atRiskStudents.length, 10)`.

**Validates: Requirements 9.2**

---

### Property 11: Attendance rate → ProgressBar colour threshold correctness

*For any* numeric `attendanceRate`, the `ProgressBar` `color` prop passed shall be `"red"` when `attendanceRate < 75`, `"amber"` when `75 ≤ attendanceRate < 90`, and `"green"` when `attendanceRate ≥ 90`. No rate value shall produce a colour outside these three outcomes.

**Validates: Requirements 9.5**

---

### Property 12: Quick action routes are exhaustive and correct

*For any* button label in the eight defined quick actions, clicking that button shall invoke `navigate` with exactly the route string listed in the specification (the mapping is a closed table; no label maps to a different route or produces no navigation).

**Validates: Requirements 10.2, 10.3**

---

### Property 13: System Health Panel role-gating

*For any* authenticated user whose role is NOT `"principal"`, the System Health Panel shall not be present in the rendered output. *For any* authenticated user whose role IS `"principal"`, the System Health Panel shall be present when `dashboard.systemHealth` is defined.

**Validates: Requirements 7.1**

---

## Error Handling

| Condition | Handling |
|---|---|
| `error !== null && dashboard === null` | Render `ErrorState_DS` with error message and "Try again" button calling `refreshDashboard()` |
| `error !== null && dashboard !== null` | Keep existing data visible; no error UI shown (background refresh failure) |
| `loading && dashboard === null` | Render `SkeletonCard × 4` for KPIs, `SkeletonChart × 4` for charts; all other sections omitted |
| `loading && dashboard !== null` | Keep existing data visible; Refresh button shows spinner |
| Individual chart dataset empty | `ChartCard_DS` renders `EmptyState_DS` internally |
| `atRiskStudents` empty | At-risk panel renders `EmptyState_DS` |
| `metrics.*` field undefined/null | `formatCurrency` returns `"Le 0"`; KPI card value falls back to `0` |
| `financialSummary.collectionRate` outside 0–100 | `ProgressBar_DS` value clamped by design system component |
| `systemHealth.lastBackup` invalid date | Display raw string if `new Date(lastBackup).getTime()` is `NaN` |

---

## Testing Strategy

### PBT Applicability Assessment

This feature is a React component that renders data-driven UI. The testable correctness properties (Properties 1–13 above) are suitable for property-based testing because:
- `formatCurrency` is a pure function with variable input (numeric values, null, undefined)
- `toChartSeries` is a pure data transformation
- Filtering logic (`visibleAlerts`, `shownAlerts`) depends on variable input
- Threshold mappings (attendance rate → colour, storage → colour) are pure functions
- Count invariants (badge count, row count) are universal over collection sizes

**Property-based testing library:** `vitest` (already installed) with `fast-check` — however `fast-check` is **not** currently in `frontend/package.json`. Since the constraint prohibits new dependencies (Requirement 13.1), the property tests SHALL be implemented as parameterised unit tests using `vitest`'s `it.each` and representative generated arrays rather than a PBT library. This satisfies the spirit of property testing (covering many inputs, including edge cases) without adding a dependency.

### Test File Location

```
frontend/src/pages/__tests__/AdminDashboard.test.tsx
frontend/src/pages/__tests__/adminDashboardHelpers.test.ts
```

### Unit / Parameterised Property Tests

**Helper function tests** (`adminDashboardHelpers.test.ts`):

- `formatCurrency` with `0`, positive integers, large numbers (>1 million), `undefined`, `null`, `NaN`
- `toChartSeries` with 0-dataset input, 1-dataset input, multi-dataset input, empty labels
- `isChartEmpty` with empty, partially-populated, fully-populated chart data
- `severityToStatus` mapping for all three severity values
- Attendance rate → ProgressBar colour for boundary values: 0, 74.9, 75, 89.9, 90, 100

**Component rendering tests** (`AdminDashboard.test.tsx`) using `@testing-library/react` (already installed):

- Initial load state (loading=true, dashboard=null): 4 skeletons each for KPIs and charts; no quick actions section
- Error state (error="…", dashboard=null): `ErrorState` rendered with error text; no KPI row
- Normal state (dashboard populated): all sections present, title "Principal Dashboard", KPI values match fixtures
- Alert dismissal: clicking × on a dismissible alert removes it from the DOM
- View-all link: rendered when visibleAlerts.length > 3
- Alerts hidden: when all alerts dismissed
- Role gating: System Health Panel absent when user.role = "teacher"
- Quick action navigation: mocking `useNavigate`, click each button, verify correct route called
- Auto-refresh interval: mock `setInterval`/`clearInterval`, verify 300,000 ms interval and cleanup

### Integration Tests

- Render the page with a mocked `useDashboard` returning a realistic `CompleteDashboard` fixture and verify all seven sections render with real data-binding end-to-end.

### What Is NOT Unit-Tested

- CSS responsiveness (verified manually or via visual regression)
- `window.print()` (browser-only, mocked in tests)
- 5-minute interval timing precision (timer mock covers setup/teardown)
