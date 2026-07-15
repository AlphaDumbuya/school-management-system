## Design Document: Admin Dashboard Design System

## Overview

This document defines the technical architecture and component specifications for the Admin Dashboard Design System. It layers on top of the existing `MainLayout`, `Button`, `Badge`, and `KPICard` components without replacing them, and establishes `frontend/src/components/admin/` as the single shared component library for all admin pages.

---

## 1. Architecture Overview

### 1.1 Layer Model

```
┌─────────────────────────────────────────────────────┐
│  Admin Pages  (pages/AdminXxx.tsx)                  │
│  compose AdminPageTemplate + admin/* components     │
├─────────────────────────────────────────────────────┤
│  Admin Component Library  (components/admin/)       │
│  layout/ │ table/ │ forms/ │ charts/ │ feedback/    │
│  common/  │ templates/                              │
├─────────────────────────────────────────────────────┤
│  Base UI  (components/ui/, components/dashboard/)   │
│  Button  │ Badge  │ KPICard  │ card.tsx             │
├─────────────────────────────────────────────────────┤
│  Design Tokens  (styles/tokens.css + theme.css)     │
├─────────────────────────────────────────────────────┤
│  Providers: TanStack Query │ react-toastify │ Zustand│
└─────────────────────────────────────────────────────┘
```

### 1.2 Folder Structure

```
frontend/src/components/admin/
├── layout/
│   ├── PageShell.tsx
│   ├── PageHeader.tsx
│   └── Breadcrumb.tsx
├── table/
│   ├── DataTable.tsx
│   ├── ActionBar.tsx
│   ├── SearchBar.tsx
│   ├── BulkToolbar.tsx
│   ├── MultiSelectFilter.tsx
│   └── DateRangePicker.tsx
├── forms/
│   ├── FormField.tsx
│   └── FormSection.tsx
├── charts/
│   └── ChartCard.tsx
├── feedback/
│   ├── Modal.tsx
│   ├── ConfirmationDialog.tsx
│   ├── EmptyState.tsx
│   ├── ErrorState.tsx
│   ├── Skeleton.tsx
│   ├── StatusBadge.tsx
│   ├── ProgressBar.tsx
│   └── AvatarGroup.tsx
├── common/
│   ├── RoleGuard.tsx
│   └── PageTabs.tsx
├── templates/
│   └── AdminPageTemplate.tsx
├── index.ts
└── COMPONENTS.md
```

---

## 2. Design Token Extension

A new file `frontend/src/styles/tokens.css` is imported after `theme.css`. It adds only the tokens missing from `theme.css` — it does not duplicate existing shadow or semantic-colour tokens.

```css
/* frontend/src/styles/tokens.css */
/* ── Extended Design Tokens ── */
:root {
  /* Primary palette additions */
  --color-primary-hover:  #1D4ED8;
  --color-primary-light:  #EFF6FF;

  /* Semantic light-background variants */
  --color-success-light:  #ECFDF5;
  --color-warning-light:  #FFFBEB;
  --color-error-light:    #FEF2F2;
  --color-info-light:     #EFF6FF;

  /* Grey scale (Tailwind-aligned) */
  --color-gray-50:  #F9FAFB;
  --color-gray-100: #F3F4F6;
  --color-gray-200: #E5E7EB;
  --color-gray-300: #D1D5DB;
  --color-gray-400: #9CA3AF;
  --color-gray-500: #6B7280;
  --color-gray-600: #4B5563;
  --color-gray-700: #374151;
  --color-gray-800: #1F2937;
  --color-gray-900: #111827;

  /* Typography */
  --text-xs:   0.75rem;   /* 12 px */
  --text-sm:   0.875rem;  /* 14 px */
  --text-base: 1rem;      /* 16 px */
  --text-lg:   1.125rem;  /* 18 px */
  --text-xl:   1.25rem;   /* 20 px */
  --text-2xl:  1.5rem;    /* 24 px */
  --text-3xl:  1.875rem;  /* 30 px */
  --text-4xl:  2.25rem;   /* 36 px */

  --font-normal:   400;
  --font-medium:   500;
  --font-semibold: 600;
  --font-bold:     700;

  --leading-tight:  1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;

  /* Spacing (4 px grid) */
  --space-1:  0.25rem;
  --space-2:  0.5rem;
  --space-3:  0.75rem;
  --space-4:  1rem;
  --space-5:  1.25rem;
  --space-6:  1.5rem;
  --space-8:  2rem;
  --space-10: 2.5rem;
  --space-12: 3rem;
  --space-16: 4rem;

  /* Border radius */
  --radius-sm:   4px;
  --radius-md:   8px;
  --radius-lg:   12px;
  --radius-xl:   16px;
  --radius-full: 9999px;

  /* Transition */
  --transition-default: all 0.2s ease-in-out;
}

[data-theme="dark"], .dark {
  --color-primary-hover:  #3B82F6;
  --color-primary-light:  #1E3A5F;
  --color-success-light:  #064E3B;
  --color-warning-light:  #78350F;
  --color-error-light:    #7F1D1D;
  --color-info-light:     #1E3A5F;
}
```

Import order in `frontend/src/styles/index.css`:
```css
@import './theme.css';
@import './tokens.css';
```

---

## 3. Component Specifications

### 3.1 layout/PageShell

**File:** `frontend/src/components/admin/layout/PageShell.tsx`

```typescript
export interface PageShellProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;       // rendered in PageHeader action slot
  isLoading?: boolean;             // shows skeleton over children
  backHref?: string;               // renders "← Back" link above title
  tabs?: TabItem[];                // if provided, renders PageTabs below header
  children: React.ReactNode;
}
```

**Implementation details:**
- Wraps children with `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6`.
- Renders `<Breadcrumb>` only when `breadcrumbs` is non-empty.
- Renders `<PageHeader>` always.
- When `isLoading` is true, replaces `children` with `<SkeletonChart height={400} />` to avoid layout shift.
- Does NOT wrap `MainLayout`; it goes inside `MainLayout`'s `<main>` slot.
- `backHref` renders `<Link>` with `ChevronLeft` icon above the `<h1>`.

---

### 3.2 layout/PageHeader

**File:** `frontend/src/components/admin/layout/PageHeader.tsx`

```typescript
export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  backHref?: string;
}
```

**Implementation details:**
- Title: `<h1 className="text-xl font-bold sm:text-2xl text-gray-900">`.
- Desktop: flex row, title left, actions right via `justify-between`.
- Mobile: title full-width, actions below via `flex-col sm:flex-row`.
- Action buttons show icon-only (`size="icon"`) on mobile, icon + label on `sm:` and above.

---

### 3.3 layout/Breadcrumb

**File:** `frontend/src/components/admin/layout/Breadcrumb.tsx`

```typescript
export interface BreadcrumbItem {
  label: string;
  href?: string;   // omit for the current (last) segment
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
}
```

**Implementation details:**
- Rendered as `<nav aria-label="breadcrumb">` containing an `<ol>` of `<li>` items.
- First item always renders a `<Home size={14} />` icon from `lucide-react` linking to `getDashboardPath(user.role)`.
- Separator: `/` rendered as a `<span aria-hidden="true">` between items.
- Last item: `<span aria-current="page" className="text-gray-900">` (not a link).
- Parent segments: `className="text-gray-500 hover:text-gray-700"`.
- Full row: `text-sm mb-4`.

---

### 3.4 table/DataTable

**File:** `frontend/src/components/admin/table/DataTable.tsx`

```typescript
export type PaginationMode = 'client' | 'server';

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  // Pagination
  paginationMode?: PaginationMode;      // default: 'client'
  pageIndex?: number;                   // controlled (server-side)
  pageSize?: number;
  totalRows?: number;                   // required for server-side
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  // Selection
  enableRowSelection?: boolean;
  onSelectionChange?: (rows: TData[]) => void;
  // Row actions
  rowActions?: (row: TData) => RowAction[];
  // Empty state
  emptyMessage?: string;
  emptyAction?: { label: string; onClick: () => void };
}

export interface RowAction {
  label: string;
  icon?: React.ReactNode;
  onClick: (row: any) => void;
  variant?: 'default' | 'destructive';
}
```

**Implementation details:**
- Built with `useReactTable` from `@tanstack/react-table` with `getCoreRowModel`, `getSortedRowModel`, `getPaginationRowModel` (client mode), `getFilteredRowModel`.
- Row selection uses `useRowSelect` pattern with an injected checkbox column prepended to `columns`.
- While `isLoading`: renders 5 `<SkeletonTableRow columnCount={columns.length} />` inside `<tbody>`.
- On `error`: renders `<ErrorState message={error} onRetry={onRetry} />` spanning all columns via `<td colSpan>`.
- On empty: renders `<EmptyState message={emptyMessage} action={emptyAction} />` spanning all columns.
- Pagination footer always visible. Page size selector: `<select>` with options `[10, 25, 50, 100]`.
- Row action menu: last column renders a `<button>` with a `MoreHorizontal` lucide icon; on click shows an absolute-positioned dropdown.
- Table wrapper: `<div className="overflow-x-auto">` for mobile scroll.
- Semantic HTML: `<table>`, `<thead>`, `<tbody>`, `<th scope="col">`, `<td>`.

---

### 3.5 table/ActionBar

**File:** `frontend/src/components/admin/table/ActionBar.tsx`

```typescript
export interface ActionBarFilter {
  key: string;
  label: string;
  type: 'multiselect' | 'daterange' | 'select';
  options?: { label: string; value: string }[];  // for multiselect/select
}

export interface ActionBarProps {
  onSearch: (value: string) => void;
  filters?: ActionBarFilter[];
  filterValues?: Record<string, any>;
  onFilterChange?: (key: string, value: any) => void;
  onAdd?: () => void;
  onExport?: (format: 'csv' | 'pdf') => void;
  onImport?: () => void;
  addLabel?: string;
  isLoading?: boolean;
}
```

**Implementation details:**
- Layout: `flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`.
- Left side: `<SearchBar>` + inline filters (hidden on mobile when >3 filters).
- Right side: Import (optional), Export dropdown, Add button.
- Mobile: "Filters" button with `<SlidingPanel>` (uses a `fixed inset-0` overlay + right-panel pattern with `translate-x` CSS transition — no extra library).
- Active filter count badge: `<span className="ml-1 rounded-full bg-blue-600 text-white text-xs px-1.5">`.
- Export button opens a small dropdown with "Export to CSV" and "Export to PDF" items.

---

### 3.6 table/SearchBar

**File:** `frontend/src/components/admin/table/SearchBar.tsx`

```typescript
export interface SearchBarProps {
  onSearch: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;  // default: 300
  className?: string;
}
```

**Implementation details:**
- Controlled input with local state + `useEffect` debounce using `setTimeout`/`clearTimeout`.
- Left: `<Search size={16} />` from lucide-react (decorative, `aria-hidden`).
- Right: `<button aria-label="Clear search">` with `<X size={14} />`, only visible when input non-empty.
- Input: `className="pl-9 pr-8 py-2 border rounded-lg text-sm w-full sm:w-64 focus:ring-2 focus:ring-blue-500"`.

---

### 3.7 table/BulkToolbar

**File:** `frontend/src/components/admin/table/BulkToolbar.tsx`

```typescript
export interface BulkAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'destructive';
  roles?: UserRole[];  // hidden if current user role not in list
}

export interface BulkToolbarProps {
  selectedCount: number;
  actions: BulkAction[];
  onDeselectAll: () => void;
}
```

**Implementation details:**
- Only rendered when `selectedCount > 0`.
- Wraps in `<div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-3">`.
- Left: `"{N} selected"` + "Deselect all" `<button variant="link">`.
- Right: bulk action buttons.
- Destructive bulk actions check `canAccess(['super_admin', 'principal'])` via `useAuth` and are hidden otherwise.

---

### 3.8 table/MultiSelectFilter

**File:** `frontend/src/components/admin/table/MultiSelectFilter.tsx`

```typescript
export interface MultiSelectOption {
  label: string;
  value: string;
}

export interface MultiSelectFilterProps {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
}
```

**Implementation details:**
- Trigger button text: first selected label + `+N more` when `selected.length > 1`; label when none selected.
- Dropdown opens on trigger click; closes on outside click via `useEffect` with `mousedown` listener on `document`.
- Top of list: "Select all" / "Clear all" links separated by a `|`.
- Each option: checkbox + label.
- Selected chips shown inside trigger using `<span className="bg-blue-100 text-blue-700 text-xs rounded px-1.5 py-0.5 flex items-center gap-1">` with a remove `×` button.
- Dropdown position: `absolute top-full mt-1 z-50` with `max-h-60 overflow-y-auto`.

---

### 3.9 table/DateRangePicker

**File:** `frontend/src/components/admin/table/DateRangePicker.tsx`

```typescript
export interface DateRangePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  onChange: (range: { startDate: Date | null; endDate: Date | null }) => void;
  label?: string;
}
```

**Implementation details:**
- Uses `react-datepicker` with `selectsStart` / `selectsEnd` pattern.
- Date format: `DD/MM/YYYY` via `dateFormat="dd/MM/yyyy"` prop on `<DatePicker>`.
- When `startDate` is set after `endDate`, `endDate` is cleared and a validation message `"End date must be after start date"` is shown in `text-xs text-red-600`.
- Renders two `<DatePicker>` inputs side-by-side in a `flex gap-2` container.

---

### 3.10 forms/FormField

**File:** `frontend/src/components/admin/forms/FormField.tsx`

```typescript
export interface FormFieldProps {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'textarea' | 'select';
  placeholder?: string;
  helperText?: string;
  required?: boolean;
  readOnly?: boolean;
  options?: { label: string; value: string }[];  // for select type
  error?: string;                                 // from RHF fieldState.error.message
  registration?: UseFormRegisterReturn;           // from RHF register()
  className?: string;
}
```

**Implementation details:**
- Uses `React.forwardRef` to support `register()` ref forwarding.
- Label: `<label htmlFor={name}>` with optional `<span className="text-red-500 ml-0.5">*</span>`.
- Input: `className="w-full rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"`. On error: adds `border-red-500 focus:ring-red-500`.
- Error icon: `<AlertCircle size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500" />` inside a relative wrapper.
- Error message: `<p className="mt-1 text-xs text-red-600">`.
- Helper text: `<p className="mt-1 text-xs text-gray-500">` — only shown when no error.
- Read-only mode: renders `<p className="py-2 px-3 text-sm text-gray-700 bg-gray-50 rounded-lg border border-gray-200">`.
- Textarea: `<textarea rows={4}>` instead of `<input>`.

---

### 3.11 forms/FormSection

**File:** `frontend/src/components/admin/forms/FormSection.tsx`

```typescript
export interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}
```

**Implementation details:**
- Renders a `<fieldset>` with a `<legend>` styled as `text-sm font-semibold text-gray-900`.
- Below the legend: a horizontal `<hr className="border-gray-200 mb-4">`.
- Children in a `grid grid-cols-1 sm:grid-cols-2 gap-4` by default.

---

### 3.12 charts/ChartCard

**File:** `frontend/src/components/admin/charts/ChartCard.tsx`

```typescript
export type ChartType = 'line' | 'bar' | 'pie' | 'donut';

export interface ChartSeries {
  name: string;
  data: number[];
}

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  type: ChartType;
  series: ChartSeries[];
  labels?: string[];           // x-axis labels / pie segment names
  height?: number;             // default: 300
  isLoading?: boolean;
  onExport?: () => void;       // triggers PNG download via html-to-image fallback — see note
  dateRangeFilter?: React.ReactNode;
  donutCenterLabel?: string;   // only for donut type
  colors?: string[];           // overrides canonical palette
}
```

**Canonical colour palette (in order):**
`['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4']`

**Implementation details:**
- Wraps Recharts chart in `<ResponsiveContainer width="100%" height={height}>`.
- `line`: `<LineChart>` with `<Line>` per series, `<CartesianGrid strokeDasharray="3 3">`, `<XAxis>`, `<YAxis>`, `<Tooltip>`, `<Legend>`.
- `bar`: `<BarChart>` with `<Bar>` per series.
- `pie`: `<PieChart>` with `<Pie>` + `<Cell>` per segment using canonical colours.
- `donut`: `<PieChart>` with `<Pie innerRadius="60%">` + a `<text>` SVG element centred at `cx`/`cy` for the centre label.
- Tooltip customisation: `content={<CustomTooltip />}` with `bg-gray-800 text-white rounded px-2 py-1 text-xs shadow-md`.
- X-axis label rotation: when `labels.length > 8` and container width < 600 px, set `<XAxis angle={-45} textAnchor="end" interval={0}>`.
- `isLoading`: renders `<SkeletonChart height={height} />`.
- Empty data (all series have zero-length data arrays): renders `<EmptyState message="No data available" />` at `height` px.
- Export: captures chart container ref with `useRef`; downloads via `canvas.toBlob` approach using browser `toDataURL` from the SVG — no extra library needed.
- Card shell: `<div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">`.

---

### 3.13 feedback/Modal

**File:** `frontend/src/components/admin/feedback/Modal.tsx`

```typescript
export type ModalSize = 'sm' | 'md' | 'lg';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: ModalSize;           // default: 'md'
  footer?: React.ReactNode;
  children: React.ReactNode;
}
```

**Size max-widths:** `sm` = 448 px, `md` = 576 px, `lg` = 768 px.

**Implementation details:**
- Rendered via `ReactDOM.createPortal` into `document.body`.
- Backdrop: `<div className="fixed inset-0 bg-black/50 z-40">` — clicking it calls `onClose()`.
- Dialog: `<div role="dialog" aria-modal="true" aria-labelledby="modal-title" className="fixed inset-0 z-50 flex items-center justify-center p-4">`. On mobile: `w-full h-dvh` (full screen). On `sm:` and above: centred with max-width.
- Focus trap: on mount, `querySelectorAll` focusable elements; `keydown` listener cycles Tab/Shift+Tab within them; returns focus to trigger element on unmount via `triggerRef`.
- Escape key: `keydown` listener on `document` calls `onClose()`.
- Header: title as `<h2 id="modal-title" className="text-lg font-semibold">` + close `<button aria-label="Close">` with `<X size={18} />`.
- Footer: right-aligned via `flex justify-end gap-3 pt-4 border-t border-gray-200`.
- Body scroll lock: `document.body.style.overflow = 'hidden'` on open; restored on close.

---

### 3.14 feedback/ConfirmationDialog

**File:** `frontend/src/components/admin/feedback/ConfirmationDialog.tsx`

```typescript
export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  message: string;
  confirmLabel?: string;     // default: 'Confirm'
  isDestructive?: boolean;   // default: true
}
```

**Implementation details:**
- Wraps `<Modal size="sm">`.
- Icon: `<AlertTriangle className="text-red-500 w-8 h-8 mx-auto mb-3">` from lucide-react.
- Footer: `<Button variant="ghost">Cancel</Button>` + `<Button variant="destructive" disabled={isPending}>` with `<Loader2 className="animate-spin" size={14} />` spinner when `isPending`.
- `isPending` is local state set to `true` when `onConfirm()` starts and `false` when it resolves/rejects.

---

### 3.15 feedback/EmptyState

**File:** `frontend/src/components/admin/feedback/EmptyState.tsx`

```typescript
export interface EmptyStateProps {
  message: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  isSearchResult?: boolean;   // shows "Clear search" link instead of action
  onClearSearch?: () => void;
  className?: string;
}
```

**Implementation details:**
- Container: `flex flex-col items-center justify-center min-h-[200px] py-12 text-center`.
- Icon: `<InboxIcon size={40} className="text-gray-300 mb-3">` from lucide-react.
- When `isSearchResult`: icon changes to `<SearchX size={40}>` and description reads `'No results for your search.'` + `<button className="text-blue-600 text-sm underline" onClick={onClearSearch}>Clear search</button>`.
- Action button: `<Button variant="default" size="sm">`.

---

### 3.16 feedback/ErrorState

**File:** `frontend/src/components/admin/feedback/ErrorState.tsx`

```typescript
export interface ErrorStateProps {
  message?: string;
  statusCode?: number;
  onRetry?: () => void;
  className?: string;
}
```

**Implementation details:**
- Container: same as EmptyState.
- Icon: `<AlertCircle size={40} className="text-red-400 mb-3">`.
- HTTP 403 message: `"You do not have permission to view this data"`.
- HTTP 404 message: `"This page or record could not be found"`.
- Other: shows `message` prop or `"Something went wrong. Please try again."`.
- Retry button: `<Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>` — only rendered when `onRetry` is provided.

---

### 3.17 feedback/Skeleton

**File:** `frontend/src/components/admin/feedback/Skeleton.tsx`

```typescript
// Base Skeleton
export interface SkeletonProps {
  width?: string;   // CSS width, default '100%'
  height?: string;  // CSS height, default '1rem'
  className?: string;
}

// Pre-composed variants
export interface SkeletonTableRowProps { columnCount: number }
export interface SkeletonChartProps    { height?: number }
// SkeletonText: no extra props (full-width line)
// SkeletonCard: no extra props (KPI card shape)
```

**Implementation details:**
- Base: `<div className="bg-gray-200 animate-pulse rounded" style={{ width, height }}>`.
- `SkeletonText`: `<Skeleton height="0.875rem" className="mb-2" />`.
- `SkeletonCard`: `<div className="p-6 rounded-lg border-l-4 border-gray-200 bg-gray-50">` with a `SkeletonText` for label and a taller `Skeleton` for value.
- `SkeletonTableRow`: `<tr>` with `{columnCount}` `<td>` elements, each containing a `<Skeleton height="0.875rem">`.
- `SkeletonChart`: `<Skeleton height={height ?? 300} />`.
- Animation duration matches Tailwind's default `animate-pulse` (1.5 s).

---

### 3.18 feedback/StatusBadge

**File:** `frontend/src/components/admin/feedback/StatusBadge.tsx`

```typescript
export type CanonicalStatus =
  | 'active' | 'inactive' | 'pending' | 'suspended'
  | 'paid' | 'overdue' | 'partial' | 'draft'
  | 'published' | 'cancelled';

export interface StatusBadgeProps {
  status: string;
  showDot?: boolean;
}
```

**Canonical status → Badge variant mapping:**

| Status     | Variant       |
|------------|---------------|
| active     | success       |
| paid       | success       |
| inactive   | secondary     |
| draft      | secondary     |
| pending    | warning       |
| partial    | warning       |
| suspended  | destructive   |
| overdue    | destructive   |
| cancelled  | destructive   |
| published  | default (blue)|

**Implementation details:**
- Wraps `<Badge>` from `frontend/src/components/ui/badge.tsx`; does not create a parallel implementation.
- Unrecognised status: `variant="secondary"`, displays capitalised raw string.
- `showDot`: prepends `<span className="w-1 h-1 rounded-full bg-current mr-1 inline-block" aria-hidden="true">` — 4 px dot.
- The dot colour inherits from the badge text colour via `text-current`; no extra colour logic needed.

---

### 3.19 feedback/ProgressBar

**File:** `frontend/src/components/admin/feedback/ProgressBar.tsx`

```typescript
export type ProgressBarSize = 'sm' | 'md' | 'lg';
export type ProgressBarColor = 'blue' | 'green' | 'amber' | 'red' | 'purple';

export interface ProgressBarProps {
  value: number;           // 0–100
  label?: string;
  color?: ProgressBarColor;  // default: 'blue'
  size?: ProgressBarSize;    // default: 'md'
  showValue?: boolean;
}
```

**Height map:** `sm` = 4 px, `md` = 8 px, `lg` = 12 px.

**Colour → Tailwind class map:**
`blue` → `bg-blue-600`, `green` → `bg-green-500`, `amber` → `bg-amber-500`, `red` → `bg-red-500`, `purple` → `bg-purple-500`.

**Implementation details:**
- Container: `<div className="w-full bg-gray-200 rounded-full" style={{ height }}>`; inner fill `<div style={{ width: '0%', transition: 'width 600ms ease-out' }}>` — mounts at 0 %, then a `useEffect` sets `width` to `${value}%` on the next tick to trigger the animation.
- `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`, `role="progressbar"` on the container.
- `showValue`: renders `<span className="text-xs text-gray-600 ml-2">{value}%</span>` to the right.

---

### 3.20 feedback/AvatarGroup

**File:** `frontend/src/components/admin/feedback/AvatarGroup.tsx`

```typescript
export interface AvatarItem {
  src?: string;
  name: string;    // used for alt text and initials fallback
}

export interface AvatarGroupProps {
  avatars: AvatarItem[];
  max?: number;     // default: 5
  size?: number;    // px, default: 32
}
```

**Implementation details:**
- Renders up to `max` avatars, each in a `<div className="rounded-full ring-2 ring-white overflow-hidden" style={{ width: size, height: size, marginLeft: index > 0 ? -8 : 0 }}>`.
- When `avatars.length > max`: last slot is `<div className="rounded-full ring-2 ring-white bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">+{avatars.length - max}</div>`.
- `src` missing or broken: renders initials from `name` (first letter of first + last word) in the accent background.
- `<img alt={avatar.name}>` for accessible image; `onError` switches to initials.

---

### 3.21 common/RoleGuard

**File:** `frontend/src/components/admin/common/RoleGuard.tsx`

```typescript
export interface RoleGuardProps {
  roles: UserRole[];
  fallback?: React.ReactNode;  // default: null
  children: React.ReactNode;
}
```

**Implementation details:**
- Reads auth via `const { canAccess } = useAuth()`.
- Returns `children` when `canAccess(roles)` is true; `fallback ?? null` otherwise.
- Never reads role from local state; always uses `useAuth` hook.

**Role permission matrix for admin actions:**

| Action / Control        | super_admin | principal | accountant | admissions_officer | teacher |
|-------------------------|:-----------:|:---------:|:----------:|:------------------:|:-------:|
| Add record              | ✓           | ✓         | ✓ (finance)| ✓ (admissions)     | ✗       |
| Delete record           | ✓           | ✓         | ✗          | ✗                  | ✗       |
| Export data             | ✓           | ✓         | ✓          | ✓                  | ✗       |
| Bulk destructive action | ✓           | ✓         | ✗          | ✗                  | ✗       |
| Import data             | ✓           | ✓         | ✓ (finance)| ✓ (admissions)     | ✗       |

---

### 3.22 common/PageTabs

**File:** `frontend/src/components/admin/common/PageTabs.tsx`

```typescript
export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface PageTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
}
```

**Implementation details:**
- URL sync: caller uses `useSearchParams` from `react-router-dom`; `onChange` is wired to `setSearchParams({ tab: id })`. The `PageTabs` component itself is stateless — it receives `activeTab` and calls `onChange`.
- Active tab: `border-b-2 border-blue-600 text-blue-600 font-medium`.
- Inactive tab: `border-transparent text-gray-600 hover:text-gray-800`.
- Container: `<div className="flex overflow-x-auto border-b border-gray-200 -mb-px">` — horizontal scroll without wrapping on mobile (`flex-shrink-0` on each tab button).
- Tab switches via conditional rendering in the parent, not a full page reload.
- `role="tablist"` on container; each button `role="tab"` with `aria-selected` and `aria-controls`.

---

### 3.23 templates/AdminPageTemplate

**File:** `frontend/src/components/admin/templates/AdminPageTemplate.tsx`

```typescript
export interface AdminPageTemplateProps<TData> {
  // PageShell
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  backHref?: string;
  tabs?: TabItem[];

  // KPI stat row
  stats?: Array<Omit<KPICardProps, 'isLoading'> & { key: string }>;
  statsLoading?: boolean;

  // Action bar
  onSearch?: (value: string) => void;
  filters?: ActionBarFilter[];
  filterValues?: Record<string, any>;
  onFilterChange?: (key: string, value: any) => void;
  onAdd?: () => void;
  onExport?: (format: 'csv' | 'pdf') => void;
  onImport?: () => void;
  addLabel?: string;

  // Data table
  columns: ColumnDef<TData, any>[];
  data: TData[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  paginationMode?: PaginationMode;
  pageIndex?: number;
  pageSize?: number;
  totalRows?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  enableRowSelection?: boolean;
  onSelectionChange?: (rows: TData[]) => void;
  rowActions?: (row: TData) => RowAction[];
  bulkActions?: BulkAction[];
  emptyMessage?: string;
  emptyAction?: { label: string; onClick: () => void };

  // Extra content below table
  children?: React.ReactNode;
}
```

**Composition order:**
```
<PageShell title subtitle breadcrumbs backHref isLoading={isLoading && !data.length} tabs>
  {stats && <StatRow stats={stats} isLoading={statsLoading} />}
  <ActionBar ... />
  {selectedRows.length > 0 && <BulkToolbar ... />}
  <DataTable ... />
  {children}
</PageShell>
```

`StatRow` is a thin local wrapper: `<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">` rendering a `<KPICard>` for each stat.

---

## 4. Data Fetching Hooks

All hooks live in `frontend/src/hooks/admin/`.

### 4.1 useEntityList

```typescript
// frontend/src/hooks/admin/useEntityList.ts
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@lib/apiClient';
import { PaginatedResponse } from '@types/index';

export interface UseEntityListParams {
  endpoint: string;
  params?: Record<string, any>;
  staleTime?: number;  // default: 30_000 ms
  enabled?: boolean;
}

export interface UseEntityListReturn<T> {
  data: T[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    setPage: (p: number) => void;
    setPageSize: (s: number) => void;
  };
}
```

**Key decisions:**
- Query key: `[endpoint, params]` — changing any param automatically re-fetches.
- Uses `placeholderData: keepPreviousData` to keep the previous page visible while the next page loads.
- Returns `error` as a string extracted from the `ApiResponse.error` field.
- `pagination.setPage` / `setPageSize` are local React state setters that update `params`; the caller does not manage them directly.

### 4.2 useEntityDetail

```typescript
// frontend/src/hooks/admin/useEntityDetail.ts
export interface UseEntityDetailParams {
  endpoint: string;
  id: string | number | null;  // null disables the query
  staleTime?: number;
}

export interface UseEntityDetailReturn<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}
```

- Query key: `[endpoint, id]`.
- `enabled: id !== null`.

### 4.3 useEntityMutation

```typescript
// frontend/src/hooks/admin/useEntityMutation.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

export type MutationMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface UseEntityMutationParams {
  endpoint: string;
  method: MutationMethod;
  invalidateKeys?: string[];  // query keys to invalidate on success
  entityName?: string;        // used in toast: "Student saved successfully"
}

export interface UseEntityMutationReturn<TPayload, TResult> {
  mutate: (payload: TPayload, id?: string | number) => Promise<TResult | null>;
  isLoading: boolean;
  error: string | null;
  reset: () => void;
}
```

**Key decisions:**
- On success: calls `showToast.success(\`${entityName} saved successfully.\`)` (or "deleted" for DELETE).
- On failure: calls `showToast.error(serverMessage ?? 'Something went wrong. Please try again.')`.
- On success: iterates `invalidateKeys` and calls `queryClient.invalidateQueries({ queryKey: [key] })`.
- `mutate` builds the URL as `endpoint` for POST, `${endpoint}/${id}` for PUT/PATCH/DELETE.

### 4.4 Loading / Error / Empty State Decision Tree

```
isLoading && data === null       → render Skeleton
isLoading && data has stale rows → render table rows (stale data while refetching)
error !== null                   → render ErrorState (regardless of data)
data.length === 0 && !error      → render EmptyState
data.length > 0                  → render DataTable rows
```

---

## 5. Toast Utility

**File:** `frontend/src/utils/toast.ts`

```typescript
import { toast } from 'react-toastify';

export const showToast = {
  success: (message: string) =>
    toast.success(message, { autoClose: 4000, position: 'top-right' }),

  error: (message: string) =>
    toast.error(message, { autoClose: false, position: 'top-right' }),

  warning: (message: string) =>
    toast.warning(message, { autoClose: false, position: 'top-right' }),

  info: (message: string) =>
    toast.info(message, { autoClose: 4000, position: 'top-right' }),

  /** Convenience: "[Entity] saved successfully." */
  saved: (entityName: string) =>
    showToast.success(`${entityName} saved successfully.`),

  /** Convenience: "[Entity] deleted successfully." */
  deleted: (entityName: string) =>
    showToast.success(`${entityName} deleted successfully.`),

  /** Convenience: API failure fallback */
  apiError: (message?: string) =>
    showToast.error(message ?? 'Something went wrong. Please try again.'),
};
```

`<ToastContainer>` is placed once in `frontend/src/App.tsx` with:
```tsx
<ToastContainer
  position="top-right"
  toastStyle={{ marginTop: '16px', marginRight: '16px' }}
  gap={8}
  closeButton={true}
  aria-live="polite"
/>
```

---

## 6. Export Utilities

**File:** `frontend/src/utils/exportUtils.ts`

### 6.1 CSV Export

```typescript
export function exportToCSV<T extends Record<string, any>>(
  rows: T[],
  columns: { header: string; accessor: keyof T }[],
  entityName: string
): void {
  const header = columns.map(c => `"${c.header}"`).join(',');
  const body = rows.map(row =>
    columns.map(c => `"${String(row[c.accessor] ?? '').replace(/"/g, '""')}"`).join(',')
  );
  const csv = [header, ...body].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `${entityName.toLowerCase()}-${date}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
```

### 6.2 PDF Export

PDF generation uses the browser's native `window.print()` with a print-specific CSS stylesheet — no extra library. The approach:

1. Open a new `window` via `window.open('', '_blank')`.
2. Write an HTML document with a `<style>` tag containing print styles and the table data.
3. Include school name, report title, and generation date in a `<header>`.
4. Call `printWindow.print()` then `printWindow.close()`.

This satisfies the requirement with zero new dependencies.

---

## 7. Barrel Export

**File:** `frontend/src/components/admin/index.ts`

```typescript
// layout
export { PageShell }         from './layout/PageShell';
export { PageHeader }        from './layout/PageHeader';
export { Breadcrumb }        from './layout/Breadcrumb';
export type { BreadcrumbItem, PageShellProps, PageHeaderProps } from './layout/PageShell';

// table
export { DataTable }         from './table/DataTable';
export { ActionBar }         from './table/ActionBar';
export { SearchBar }         from './table/SearchBar';
export { BulkToolbar }       from './table/BulkToolbar';
export { MultiSelectFilter } from './table/MultiSelectFilter';
export { DateRangePicker }   from './table/DateRangePicker';
export type { DataTableProps, RowAction, ActionBarProps, BulkAction } from './table/DataTable';

// forms
export { FormField }         from './forms/FormField';
export { FormSection }       from './forms/FormSection';
export type { FormFieldProps, FormSectionProps } from './forms/FormField';

// charts
export { ChartCard }         from './charts/ChartCard';
export type { ChartCardProps, ChartType, ChartSeries } from './charts/ChartCard';

// feedback
export { Modal }             from './feedback/Modal';
export { ConfirmationDialog } from './feedback/ConfirmationDialog';
export { EmptyState }        from './feedback/EmptyState';
export { ErrorState }        from './feedback/ErrorState';
export {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonTableRow,
  SkeletonChart,
}                            from './feedback/Skeleton';
export { StatusBadge }       from './feedback/StatusBadge';
export { ProgressBar }       from './feedback/ProgressBar';
export { AvatarGroup }       from './feedback/AvatarGroup';

// common
export { RoleGuard }         from './common/RoleGuard';
export { PageTabs }          from './common/PageTabs';
export type { TabItem, RoleGuardProps } from './common/PageTabs';

// templates
export { AdminPageTemplate } from './templates/AdminPageTemplate';
export type { AdminPageTemplateProps } from './templates/AdminPageTemplate';
```

---

## 8. Responsive Behaviour Summary

| Component        | Mobile (< 640 px)                    | Tablet (640–1023 px)            | Desktop (≥ 1024 px)          |
|------------------|--------------------------------------|---------------------------------|------------------------------|
| Sidebar          | Hidden; open via hamburger overlay   | Hidden; open via hamburger      | Always visible               |
| PageHeader       | Title full-width, actions below      | flex row                        | flex row                     |
| PageHeader btns  | Icon-only                            | Icon + label                    | Icon + label                 |
| StatRow          | 1-column grid                        | 2-column grid                   | 4-column grid                |
| ActionBar        | SearchBar stacked above buttons      | Inline                          | Inline                       |
| Filters          | Always in slide-over panel           | Inline (≤3) or slide-over (>3)  | Always inline                |
| DataTable        | `overflow-x-auto` horizontal scroll  | `overflow-x-auto`               | Full width                   |
| Modal            | Full screen (`100vw / 100dvh`)        | Centred overlay                 | Centred overlay              |
| PageTabs         | Horizontal scroll                    | Horizontal scroll               | Horizontal no-scroll         |
| ChartCard height | min 200 px                           | 250 px                          | 300 px (default)             |

---

## 9. Accessibility Standards

- All interactive elements reachable by Tab; Enter/Space activate buttons/links.
- All form inputs linked to `<label htmlFor>`.
- Icon-only buttons: `aria-label` attribute always present.
- Decorative images/icons: `aria-hidden="true"`.
- Status information never conveyed by colour alone — `StatusBadge` includes text label.
- Focus ring: `focus:ring-2 focus:ring-blue-500 focus:ring-offset-2` on all interactive elements.
- Text contrast: primary text `#111827` on `#FFFFFF` = 16.1:1 ✓; secondary text `#6B7280` on `#FFFFFF` = 4.6:1 ✓.
- Modal: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, body scroll lock, focus trap.
- DataTable: `<table>`, `<thead>`, `<tbody>`, `<th scope="col">`, `<td>` semantic HTML.
- Toast container: `aria-live="polite"`.
- PageTabs: `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`.
- Breadcrumb: `<nav aria-label="breadcrumb">`.

---

## 10. Property-Based Testing (Correctness Properties)

Test file location: `frontend/src/components/admin/__tests__/design-system.pbt.test.ts`

Test runner: Vitest. Input generation via manual array sampling (no extra library; avoids introducing fast-check).

### Property 1 — Token completeness
**Invariant:** Every semantic colour token defined in light mode must also exist in dark mode.
**Generator:** Read CSS custom property names from the `:root` ruleset; read dark-mode property names; assert the sets are equal.
**Test approach:** Parse `tokens.css` with a regex; compare light and dark sets.

### Property 2 — DataTable pagination bounds
**Invariant:** `(page - 1) * pageSize < total` is always true when `total > 0`.
**Generator:** Generate random `{ page, pageSize, total }` triples where `1 ≤ page ≤ 1000`, `pageSize ∈ [10,25,50,100]`, `total ≥ 0`.
**Test approach:** For each triple, assert the inequality holds; confirm `DataTable` clamps `page` to `totalPages` when `page > ceil(total / pageSize)`.

### Property 3 — StatusBadge mapping exhaustiveness
**Invariant:** Every canonical status maps to a non-`secondary` (non-gray) Badge variant.
**Generator:** Iterate over the `CanonicalStatus` union literal values.
**Test approach:** Render `<StatusBadge status={s} />` for each canonical value; assert the variant is not `"secondary"`.

### Property 4 — RoleGuard never renders children when access is denied
**Invariant:** When `canAccess(roles)` returns `false`, `RoleGuard` renders `null` (or the fallback), never the children.
**Generator:** For each `UserRole` value and each subset of roles where the role is NOT included, call `canAccess`.
**Test approach:** Mock `useAuth` to return each role in turn; mount `<RoleGuard roles={rolesNotIncludingCurrentRole}>SECRET</RoleGuard>`; assert "SECRET" is not in the rendered output.

### Property 5 — FormField blocks submission when required and empty
**Invariant:** A form with a required `FormField` with an empty value never calls `onSubmit`.
**Generator:** Generate random schemas with one required string field; render `<FormField required>`.
**Test approach:** Render form; fire submit without filling the field; assert `onSubmit` mock was not called; assert error message is visible.

### Property 6 — KPICard trend colour matches direction
**Invariant:** `isPositive: true` always renders green (`text-green-600`); `isPositive: false` always renders red (`text-red-600`), regardless of the numeric trend value or card colour.
**Generator:** All combinations of `{ isPositive: boolean, value: number, color: KPICardColor }`.
**Test approach:** Render `<KPICard>` with each combination; assert the trend element class contains the expected colour.

### Property 7 — MultiSelectFilter badge count equals selected array length
**Invariant:** The count badge on the ActionBar "Filters" button always equals `Object.values(activeFilters).filter(Boolean).length`.
**Generator:** Random `activeFilters` objects with 0–5 truthy values.
**Test approach:** Render `<ActionBar>` with each combination; assert badge text matches the count of active filter values.

### Property 8 — Toast auto-dismiss behaviour
**Invariant:** `success` and `info` toasts have `autoClose: 4000`; `error` and `warning` toasts have `autoClose: false`.
**Generator:** All four toast types.
**Test approach:** Spy on `react-toastify`'s `toast` function; call each `showToast.*` variant; assert the `autoClose` option matches the expected value.

---

## 11. Component Library Conventions

1. Every file in `components/admin/` is PascalCase matching its exported component name.
2. Every component exports its props interface alongside the component.
3. No new third-party libraries — only packages already in `frontend/package.json`.
4. New admin pages compose exclusively from `components/admin/` exports; custom inline HTML structures are not permitted.
5. A `COMPONENTS.md` file in `frontend/src/components/admin/` documents each component's props, variants, and usage example.

### COMPONENTS.md minimal entry format

```markdown
## ComponentName

**Import:** `import { ComponentName } from '@components/admin'`

**Props:** See `ComponentNameProps` interface in `ComponentName.tsx`.

**Variants/States:** list here.

**Usage example:**
\`\`\`tsx
<ComponentName prop1="value" prop2={handler} />
\`\`\`
```

---

## 12. Implementation Notes

### TanStack Query Provider
`QueryClientProvider` with `new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } })` must wrap the app in `frontend/src/App.tsx`. If already present, do not add a second provider.

### KPICard re-export
The existing `frontend/src/components/dashboard/KPICard.tsx` is re-exported from `admin/index.ts` as-is. No modifications to the existing file are needed for basic usage.

### StatRow
`StatRow` is not a standalone exported component — it is an internal sub-component of `AdminPageTemplate`. Its grid classes are inlined there. Pages that need a stat row outside the template render `KPICard` components directly in a `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4` div.

### ChartCard vs existing dashboard/ChartCard
The existing `frontend/src/components/dashboard/ChartCard.tsx` may differ from the new `admin/charts/ChartCard.tsx`. The admin version is the canonical implementation going forward; the dashboard version is kept for backward compatibility but not extended.

### react-toastify vs sonner
The system uses `react-toastify` as the primary toast library. `sonner` is available but not used by the design system to avoid having two competing toast providers active simultaneously.

### guardian role
The `getDashboardPath` function in `useAuth.ts` handles `'guardian'` as an alias for `'parent'`. The `UserRole` type in `types/index.ts` does not include `'guardian'` — this is handled internally in `getDashboardPath` only.
