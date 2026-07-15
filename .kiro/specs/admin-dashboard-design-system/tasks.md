# Implementation Plan: Admin Dashboard Design System

## Overview

This implementation plan covers building the complete Admin Dashboard Design System component library for the Sierra Leone School Management System. The system provides shared UI components, data-fetching hooks, utilities, and an `AdminPageTemplate` scaffold that every admin page composes from.

## Tasks

- [x] 1. Extend Design Tokens
  - Create `frontend/src/styles/tokens.css` with primary palette additions, semantic light-background variants, grey scale, typography tokens, spacing tokens, border-radius tokens, and `--transition-default`
  - Add dark-mode overrides for the new colour tokens inside `[data-theme="dark"], .dark` block
  - Add `@import './tokens.css';` after the existing `@import './theme.css';` line in `frontend/src/styles/index.css`
  - _Requirements: Requirement 1_

  - [x] 1.1 Create `frontend/src/styles/tokens.css` with primary palette additions (`--color-primary-hover`, `--color-primary-light`), semantic light-background variants (`--color-success-light`, `--color-warning-light`, `--color-error-light`, `--color-info-light`), grey scale (`--color-gray-50` through `--color-gray-900`), typography tokens (`--text-xs` through `--text-4xl`, `--font-normal` through `--font-bold`, line-height tokens), spacing tokens (`--space-1` through `--space-16`), border-radius tokens (`--radius-sm` through `--radius-full`), and `--transition-default`
  - [x] 1.2 Add dark-mode overrides for the new colour tokens inside `[data-theme="dark"], .dark` block in `tokens.css`
  - [x] 1.3 Add `@import './tokens.css';` after the existing `@import './theme.css';` line in `frontend/src/styles/index.css`

- [x] 2. Layout Components
  - Implement `PageShell`, `PageHeader`, and `Breadcrumb` under `frontend/src/components/admin/layout/`
  - _Requirements: Requirement 2, Requirement 15_

  - [x] 2.1 Create `frontend/src/components/admin/layout/Breadcrumb.tsx` — `<nav aria-label="breadcrumb">` with home icon linking to `getDashboardPath(user.role)`, slash-separated segments, last segment non-clickable as `<span aria-current="page">`, using `text-sm` and token colours
  - [x] 2.2 Create `frontend/src/components/admin/layout/PageHeader.tsx` — `<h1>` title (`text-xl font-bold sm:text-2xl`), optional subtitle, optional back-link with `ChevronLeft` from lucide-react, actions flex-row on desktop / stacked below title on mobile, icon-only action buttons on mobile
  - [x] 2.3 Create `frontend/src/components/admin/layout/PageShell.tsx` — composes `Breadcrumb` + `PageHeader` inside `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6`; `isLoading` replaces children with `SkeletonChart`; accepts optional `tabs` for `PageTabs`; does NOT wrap `MainLayout`

- [x] 3. Skeleton Components
  - Implement all Skeleton variants in `frontend/src/components/admin/feedback/Skeleton.tsx`
  - _Requirements: Requirement 10_

  - [x] 3.1 Create `frontend/src/components/admin/feedback/Skeleton.tsx` exporting: base `Skeleton` (configurable width/height, `bg-gray-200 animate-pulse rounded`), `SkeletonText` (full-width line at `0.875rem` height), `SkeletonCard` (KPI card shape with label and value placeholders), `SkeletonTableRow` (accepts `columnCount` prop, renders a `<tr>` with matching `<td>` skeletons), and `SkeletonChart` (accepts `height` prop, default 300)

- [x] 4. Feedback Components
  - Implement `EmptyState`, `ErrorState`, `StatusBadge`, `ProgressBar`, and `AvatarGroup`
  - _Requirements: Requirement 8, Requirement 11, Requirement 14_

  - [x] 4.1 Create `frontend/src/components/admin/feedback/EmptyState.tsx` — centred container with `min-h-[200px]`, `InboxIcon` or `SearchX` icon from lucide-react, primary message (`font-semibold`), optional secondary message, optional CTA button, `isSearchResult` mode shows "Clear search" link
  - [x] 4.2 Create `frontend/src/components/admin/feedback/ErrorState.tsx` — centred container with `min-h-[200px]`, red `AlertCircle` icon, HTTP 403/404 friendly messages, generic fallback message, optional "Try again" `<Button variant="outline">` rendered only when `onRetry` is provided
  - [x] 4.3 Create `frontend/src/components/admin/feedback/StatusBadge.tsx` — wraps existing `Badge` from `frontend/src/components/ui/badge.tsx`; maps canonical status strings (`active`, `inactive`, `pending`, `suspended`, `paid`, `overdue`, `partial`, `draft`, `published`, `cancelled`) to Badge variants; unknown statuses render as `secondary` capitalised; optional 4 px leading dot via `showDot` prop using `text-current`
  - [x] 4.4 Create `frontend/src/components/admin/feedback/ProgressBar.tsx` — `role="progressbar"` with aria attributes; inner fill animates from 0 to `value` on mount via `useEffect` + 600 ms CSS `transition: width`; configurable `size` (`sm`/`md`/`lg`), `color` variant, optional `label` and `showValue`
  - [x] 4.5 Create `frontend/src/components/admin/feedback/AvatarGroup.tsx` — displays up to `max` (default 5) avatar images stacked with `-8px` negative margin and `ring-2 ring-white`; overflow shown as `+N` circle; broken/missing `src` falls back to initials from `name`

- [x] 5. Modal and Confirmation Dialog
  - Implement `Modal` and `ConfirmationDialog` with full accessibility and focus management
  - _Requirements: Requirement 6_

  - [x] 5.1 Create `frontend/src/components/admin/feedback/Modal.tsx` — `ReactDOM.createPortal` to `document.body`; semi-transparent backdrop (`bg-black/50`) calls `onClose` on click; dialog with `role="dialog"`, `aria-modal="true"`, `aria-labelledby="modal-title"`; focus trap (Tab/Shift+Tab cycle within focusable elements, restore focus on unmount); Escape key closes; size variants `sm`/`md`/`lg`; full-screen on mobile (`w-full h-dvh`); body scroll lock on open
  - [x] 5.2 Create `frontend/src/components/admin/feedback/ConfirmationDialog.tsx` — wraps `Modal size="sm"`; `AlertTriangle` icon from lucide-react; `isPending` local state disables both buttons and shows `Loader2 animate-spin` spinner on Confirm; `onConfirm` is awaited before closing

- [x] 6. Form Components
  - Implement `FormField` and `FormSection` for React Hook Form + Zod integration
  - _Requirements: Requirement 7_

  - [x] 6.1 Create `frontend/src/components/admin/forms/FormField.tsx` — `React.forwardRef` for RHF `register()` compatibility; supports `text`, `email`, `password`, `number`, `tel`, `textarea`, `select` types; required asterisk; error state adds `border-red-500` + `AlertCircle` icon + red error message; helper text shown only when no error; read-only mode renders styled `<p>`; `options` prop for select type
  - [x] 6.2 Create `frontend/src/components/admin/forms/FormSection.tsx` — `<fieldset>` with styled `<legend>`, horizontal `<hr>` divider, children in `grid grid-cols-1 sm:grid-cols-2 gap-4`

- [x] 7. Table Components
  - Implement `SearchBar`, `MultiSelectFilter`, `DateRangePicker`, `BulkToolbar`, and `ActionBar`
  - _Requirements: Requirement 5, Requirement 13, Requirement 14_

  - [x] 7.1 Create `frontend/src/components/admin/table/SearchBar.tsx` — controlled input with `useEffect` debounce (default 300 ms); `Search` icon on left; clear `×` button on right (visible only when non-empty); `aria-label` on clear button; `w-full sm:w-64`
  - [x] 7.2 Create `frontend/src/components/admin/table/MultiSelectFilter.tsx` — trigger button showing first selected label + `+N more` or the filter label when empty; dropdown with `Select all` / `Clear all` at top; checkbox list; outside-click close via `mousedown` listener; selected chips inside trigger with remove `×`; `max-h-60 overflow-y-auto` dropdown
  - [x] 7.3 Create `frontend/src/components/admin/table/DateRangePicker.tsx` — two `react-datepicker` inputs with `dateFormat="dd/MM/yyyy"`; clears end date and shows validation message when start > end; side-by-side `flex gap-2` layout
  - [x] 7.4 Create `frontend/src/components/admin/table/BulkToolbar.tsx` — only rendered when `selectedCount > 0`; blue-tinted container; left: selected count + "Deselect all" link button; right: bulk action buttons; destructive actions hidden for roles outside `['super_admin', 'principal']` via `useAuth().canAccess`
  - [x] 7.5 Create `frontend/src/components/admin/table/ActionBar.tsx` — flex layout (stacked on mobile, row on desktop); `SearchBar` + inline filters (hidden on mobile when >3 filters, replaced by slide-over panel); active filter count badge on "Filters" button; Import/Export/Add buttons on right; Export opens dropdown with "Export to CSV" / "Export to PDF" options; slide-over panel uses CSS `translate-x` transition with `fixed inset-0` overlay — no extra library

- [x] 8. DataTable Component
  - Implement the full `DataTable` on TanStack Table v8 with sort, pagination, selection, row actions, and all states
  - _Requirements: Requirement 4_

  - [x] 8.1 Create `frontend/src/components/admin/table/DataTable.tsx` using `useReactTable` with `getCoreRowModel`, `getSortedRowModel`, `getPaginationRowModel`, `getFilteredRowModel`; sort indicators (`ChevronUp`/`ChevronDown` from lucide-react) in column headers; row selection with injected checkbox column; `overflow-x-auto` wrapper; semantic HTML (`<table>`, `<thead>`, `<tbody>`, `<th scope="col">`, `<td>`)
  - [x] 8.2 Add loading state to `DataTable` — renders exactly 5 `SkeletonTableRow` elements inside `<tbody>` matching `columns.length` while `isLoading` is true
  - [x] 8.3 Add error state to `DataTable` — renders `ErrorState` inside a `<td colSpan={columns.length}>` when `error` is non-null; pagination footer remains visible
  - [x] 8.4 Add empty state to `DataTable` — renders `EmptyState` inside a `<td colSpan>` when data is empty and no error; pagination footer remains visible
  - [x] 8.5 Add pagination footer to `DataTable` — always-visible footer with current page, total pages, total record count, page size selector (`<select>` with options 10/25/50/100), previous/next buttons
  - [x] 8.6 Add row action menu to `DataTable` — last column (optional) renders `MoreHorizontal` button from lucide-react; on click shows absolute-positioned dropdown with `rowActions` items including "Edit" and "Delete" variants

- [x] 9. ChartCard Component
  - Implement `ChartCard` with all four chart types using Recharts
  - _Requirements: Requirement 9_

  - [x] 9.1 Create `frontend/src/components/admin/charts/ChartCard.tsx` with card shell (`bg-white rounded-xl border shadow-sm p-4 sm:p-6`); title, optional subtitle, optional date range filter slot, optional export button; `isLoading` renders `SkeletonChart`; empty data renders `EmptyState`; `ResponsiveContainer width="100%"`
  - [x] 9.2 Implement `line` chart type — `LineChart` with `Line` per series, `CartesianGrid strokeDasharray="3 3"`, `XAxis`, `YAxis`, `Tooltip`, `Legend`; canonical colour palette `['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4']`
  - [x] 9.3 Implement `bar` chart type — `BarChart` with `Bar` per series using canonical colours
  - [x] 9.4 Implement `pie` chart type — `PieChart` with `Pie` and `Cell` per segment using canonical colours
  - [x] 9.5 Implement `donut` chart type — `PieChart` with `Pie innerRadius="60%"` and centred SVG `<text>` for `donutCenterLabel`
  - [x] 9.6 Add dark tooltip (`CustomTooltip` component with `bg-gray-800 text-white rounded px-2 py-1 text-xs shadow-md`) and x-axis label rotation (45° when `labels.length > 8` and width < 600 px)
  - [x] 9.7 Add PNG export to `ChartCard` — capture chart container via `useRef`; serialize SVG to canvas via `toDataURL`; trigger download link with filename `chart-{title}-{date}.png`

- [x] 10. Role Guard and Page Tabs
  - Implement `RoleGuard` and `PageTabs`
  - _Requirements: Requirement 15, Requirement 16_

  - [x] 10.1 Create `frontend/src/components/admin/common/RoleGuard.tsx` — reads auth exclusively from `useAuth().canAccess`; renders `children` when `canAccess(roles)` is true; renders `fallback ?? null` otherwise; never reads role from local state
  - [x] 10.2 Create `frontend/src/components/admin/common/PageTabs.tsx` — stateless tab strip; `role="tablist"` container with `overflow-x-auto` for mobile scroll; each tab `role="tab"`, `aria-selected`, `aria-controls`; active tab: `border-b-2 border-blue-600 text-blue-600 font-medium`; inactive: `border-transparent text-gray-600 hover:text-gray-800`; `flex-shrink-0` on each tab prevents wrapping

- [x] 11. Data Fetching Hooks
  - Implement `useEntityList`, `useEntityDetail`, and `useEntityMutation` under `frontend/src/hooks/admin/`
  - _Requirements: Requirement 17_

  - [x] 11.1 Create `frontend/src/hooks/admin/useEntityList.ts` — wraps `useQuery` from `@tanstack/react-query`; query key `[endpoint, params]`; `staleTime: 30_000`; `placeholderData: keepPreviousData`; manages `page`/`pageSize` as local state merged into params; returns `{ data, isLoading, error, refetch, pagination }`
  - [x] 11.2 Create `frontend/src/hooks/admin/useEntityDetail.ts` — wraps `useQuery`; `enabled: id !== null`; query key `[endpoint, id]`; returns `{ data, isLoading, error, refetch }`
  - [x] 11.3 Create `frontend/src/hooks/admin/useEntityMutation.ts` — wraps `useMutation`; builds URL as `endpoint` for POST, `${endpoint}/${id}` for PUT/PATCH/DELETE; calls `showToast.saved`/`showToast.deleted`/`showToast.apiError` on success/failure; invalidates `invalidateKeys` via `queryClient.invalidateQueries`

- [x] 12. Toast Utility and Export Utilities
  - Implement shared utility functions
  - _Requirements: Requirement 12, Requirement 13_

  - [x] 12.1 Create `frontend/src/utils/toast.ts` — `showToast` object with `success` (autoClose 4000), `error` (autoClose false), `warning` (autoClose false), `info` (autoClose 4000), `saved(entityName)`, `deleted(entityName)`, `apiError(message?)` convenience methods using `react-toastify`
  - [x] 12.2 Add `<ToastContainer position="top-right" closeButton gap={8} aria-live="polite">` to `frontend/src/App.tsx` if not already present (check before adding)
  - [x] 12.3 Create `frontend/src/utils/exportUtils.ts` — `exportToCSV<T>` function: UTF-8 BOM, quoted cells, escaped double-quotes, filename `{entityName}-{YYYY-MM-DD}.csv`; `exportToPDF` function: opens `window.open` with HTML document containing school name header, report title, generation date, and table data, then calls `printWindow.print()` — no extra library

- [x] 13. AdminPageTemplate
  - Implement the `AdminPageTemplate` scaffold
  - _Requirements: Requirement 20_

  - [x] 13.1 Create `frontend/src/components/admin/templates/AdminPageTemplate.tsx` — generic `<TData>` component composing `PageShell` + optional `StatRow` grid + `ActionBar` + optional `BulkToolbar` (shown when `selectedRows.length > 0`) + `DataTable` + optional `children`; `StatRow` is an internal `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6` wrapper around `KPICard` items from `components/dashboard/KPICard`

- [x] 14. Barrel Export and COMPONENTS.md
  - Wire all components into a single export and document them
  - _Requirements: Requirement 20_

  - [x] 14.1 Create `frontend/src/components/admin/index.ts` barrel file exporting all components and their TypeScript interfaces: layout (PageShell, PageHeader, Breadcrumb), table (DataTable, ActionBar, SearchBar, BulkToolbar, MultiSelectFilter, DateRangePicker), forms (FormField, FormSection), charts (ChartCard), feedback (Modal, ConfirmationDialog, EmptyState, ErrorState, all Skeleton variants, StatusBadge, ProgressBar, AvatarGroup), common (RoleGuard, PageTabs), templates (AdminPageTemplate)
  - [x] 14.2 Create `frontend/src/components/admin/COMPONENTS.md` documenting every exported component with its import path, props summary, variants/states, and a minimal usage example

- [x] 15. Property-Based Tests
  - Write and run the eight PBT correctness properties defined in the design document
  - _Requirements: Requirement 1, Requirement 3, Requirement 4, Requirement 5, Requirement 7, Requirement 8, Requirement 12_

  - [x] 15.1 Create `frontend/src/components/admin/__tests__/design-system.pbt.test.ts`; write and pass Property 1 (token completeness — light/dark mode parity) and Property 2 (DataTable pagination bounds invariant)
  - [x] 15.2 Write and pass Property 3 (StatusBadge mapping exhaustiveness) and Property 4 (RoleGuard never renders children when access denied)
  - [x] 15.3 Write and pass Property 5 (FormField blocks submission when required and empty) and Property 6 (KPICard trend colour matches direction for all `isPositive`/`color` combinations)
  - [x] 15.4 Write and pass Property 7 (MultiSelectFilter badge count equals active filter count) and Property 8 (Toast auto-dismiss — success/info have `autoClose: 4000`, error/warning have `autoClose: false`); run `npm test -- --reporter=verbose` inside `frontend/` and confirm all 8 properties pass

## Notes

- All components are in `frontend/src/components/admin/` and exported from `index.ts`
- No new npm packages were introduced — only packages already in `frontend/package.json`
- The existing `MainLayout`, `KPICard`, `Button`, `Badge`, and `Card` components are reused/extended rather than replaced
- `tokens.css` supplements `theme.css` without duplicating existing tokens
- All 69 PBT test cases pass: `npm test -- --run src/components/admin/__tests__/design-system.pbt.test.ts`

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2", "3"] },
    { "wave": 3, "tasks": ["4", "5", "6", "7", "12"] },
    { "wave": 4, "tasks": ["8", "9", "10", "11"] },
    { "wave": 5, "tasks": ["13", "14"] },
    { "wave": 6, "tasks": ["15"] }
  ]
}
```
