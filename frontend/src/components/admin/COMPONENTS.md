# Admin Component Library

All components are exported from `frontend/src/components/admin/index.ts`.

```ts
import { ComponentName } from '@components/admin';
```

---

## Layout

### PageShell
Outermost content wrapper for every admin page. Goes **inside** `MainLayout`, not around it.

| Prop | Type | Required | Default |
|------|------|----------|---------|
| title | string | ✓ | — |
| subtitle | string | — | — |
| breadcrumbs | BreadcrumbItem[] | — | — |
| actions | ReactNode | — | — |
| isLoading | boolean | — | false |
| backHref | string | — | — |
| tabs | TabItem[] | — | — |
| children | ReactNode | ✓ | — |

```tsx
<PageShell title="Students" subtitle="Manage enrolment" breadcrumbs={[{ label: 'Students' }]}>
  {/* page content */}
</PageShell>
```

### PageHeader
Renders the page `<h1>`, optional subtitle, optional back-link, and action buttons.

```tsx
<PageHeader title="New Student" backHref="/students" actions={<Button>Save</Button>} />
```

### Breadcrumb
Accessible breadcrumb nav. Home icon always links to role-aware dashboard.

```tsx
<Breadcrumb items={[{ label: 'Students', href: '/students' }, { label: 'Edit' }]} />
```

---

## Table

### DataTable
Full-featured sortable, filterable, paginated table built on TanStack Table v8.

| Key prop | Type | Notes |
|----------|------|-------|
| columns | ColumnDef<T>[] | TanStack column defs |
| data | T[] | Row data |
| isLoading | boolean | Shows 5 skeleton rows |
| error | string \| null | Shows ErrorState |
| paginationMode | 'client' \| 'server' | Default: client |
| enableRowSelection | boolean | Adds checkbox column |
| rowActions | (row) => RowAction[] | Adds ⋯ menu column |

```tsx
<DataTable columns={columns} data={students} isLoading={isLoading} emptyMessage="No students found" />
```

### ActionBar
Toolbar with search, filters, and action buttons.

```tsx
<ActionBar onSearch={setQuery} onAdd={() => setModalOpen(true)} onExport={handleExport} addLabel="Add Student" />
```

### SearchBar
Debounced search input (300ms default).

```tsx
<SearchBar onSearch={setQuery} placeholder="Search students..." />
```

### BulkToolbar
Contextual toolbar shown when rows are selected. Hides destructive actions from non-admin roles.

```tsx
<BulkToolbar selectedCount={3} actions={bulkActions} onDeselectAll={clearSelection} />
```

### MultiSelectFilter
Multi-value dropdown filter with chips and Select/Clear all.

```tsx
<MultiSelectFilter label="Status" options={statusOptions} selected={selected} onChange={setSelected} />
```

### DateRangePicker
Two date inputs (DD/MM/YYYY) with start > end validation.

```tsx
<DateRangePicker startDate={start} endDate={end} onChange={({ startDate, endDate }) => ...} />
```

---

## Forms

### FormField
RHF-compatible `forwardRef` input supporting text, email, password, number, tel, textarea, select.

| Prop | Notes |
|------|-------|
| name | Used for label `htmlFor` |
| required | Adds red asterisk |
| error | Red border + icon + message |
| readOnly | Renders as styled `<p>` |
| options | For `type="select"` |

```tsx
<FormField name="email" label="Email" type="email" required error={errors.email?.message} {...register('email')} />
```

### FormSection
Groups related form fields under a title with a divider.

```tsx
<FormSection title="Personal Details">
  <FormField name="firstName" label="First Name" />
  <FormField name="lastName" label="Last Name" />
</FormSection>
```

---

## Charts

### ChartCard
Recharts wrapper with card shell, skeleton, empty state, and PNG export.

| Types | line, bar, pie, donut |
|-------|-----------------------|

```tsx
<ChartCard title="Attendance Trend" type="line" series={series} labels={labels} height={300} isLoading={loading} />
```

---

## Feedback

### Modal
Accessible dialog portal with focus trap, Escape key, and body scroll lock.

**Sizes:** `sm` (448px), `md` (576px, default), `lg` (768px). Full-screen on mobile.

```tsx
<Modal isOpen={open} onClose={() => setOpen(false)} title="Add Student" footer={<Button>Save</Button>}>
  {/* form */}
</Modal>
```

### ConfirmationDialog
Specialised destructive confirm modal.

```tsx
<ConfirmationDialog isOpen={open} onClose={close} onConfirm={handleDelete} title="Delete student?" message="This cannot be undone." />
```

### EmptyState
Centred placeholder for empty data sets.

```tsx
<EmptyState message="No students found" action={{ label: 'Add student', onClick: openModal }} />
<EmptyState message="No results" isSearchResult onClearSearch={clearSearch} />
```

### ErrorState
Centred error display with optional retry. HTTP 403/404 show friendly messages automatically.

```tsx
<ErrorState message={error} onRetry={refetch} />
<ErrorState statusCode={403} />
```

### Skeleton variants

| Component | Use case |
|-----------|----------|
| `Skeleton` | Base — any shape |
| `SkeletonText` | Single text line |
| `SkeletonCard` | KPI card placeholder |
| `SkeletonTableRow` | Table row (needs `columnCount`) |
| `SkeletonChart` | Chart area (needs `height`) |

```tsx
<SkeletonCard />
<SkeletonTableRow columnCount={5} />
<SkeletonChart height={300} />
```

### StatusBadge
Maps canonical status strings to coloured pill badges.

**Canonical statuses:** active, inactive, pending, suspended, paid, overdue, partial, draft, published, cancelled

```tsx
<StatusBadge status="active" showDot />
<StatusBadge status="overdue" />
```

### ProgressBar
Animated progress bar with ARIA progressbar role.

**Sizes:** sm (4px), md (8px), lg (12px)
**Colors:** blue, green, amber, red, purple

```tsx
<ProgressBar value={75} color="green" size="md" showValue label="Collection rate" />
```

### AvatarGroup
Stacked circular avatars with initials fallback and overflow counter.

```tsx
<AvatarGroup avatars={[{ name: 'Alice Doe', src: '/img/alice.jpg' }]} max={5} />
```

---

## Common

### RoleGuard
Renders children only when `canAccess(roles)` is true.

```tsx
<RoleGuard roles={['super_admin', 'principal']}>
  <Button variant="destructive">Delete</Button>
</RoleGuard>
```

### PageTabs
Stateless tab strip with URL sync (caller manages `useSearchParams`).

```tsx
<PageTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
```

---

## Templates

### AdminPageTemplate
Full page scaffold: PageShell + StatRow + ActionBar + BulkToolbar + DataTable.

```tsx
<AdminPageTemplate<Student>
  title="Students"
  columns={columns}
  data={students}
  stats={kpiStats}
  onAdd={openModal}
  onExport={handleExport}
  onSearch={setQuery}
  enableRowSelection
  bulkActions={bulkActions}
/>
```
