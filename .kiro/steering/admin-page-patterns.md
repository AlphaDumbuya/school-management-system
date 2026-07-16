---
inclusion: auto
---

# Admin Page Development Patterns

Standard patterns for building production-ready admin pages in this school management system. Every new page MUST follow these patterns for consistency.

## Architecture Rules

1. **Every page wraps in `<MainLayout>`** — this provides the sidebar + header
2. **Every page uses `<PageShell>`** — provides breadcrumbs, title, subtitle, actions area
3. **super_admin has universal access** — bypass all role checks in `canAccess()`
4. **Light mode only** — `darkMode: 'class'` in Tailwind config, no dark class applied. Never add `dark:` classes.
5. **Tenant operations restricted to tenant roles** — super_admin can view but not mutate school-level data
6. **All pages must be added to both routes.tsx AND Sidebar.tsx** — with matching role arrays
7. **Backend API required** — every page must connect to real API endpoints, never ship with only mock data

## Role Hierarchy

| Role               | Scope    | Access Level                                | Description                                                                  |
| ------------------ | -------- | ------------------------------------------- | ---------------------------------------------------------------------------- |
| super_admin        | Platform | ALL pages visible, view-only for tenant ops | Manages tenants, subscriptions, platform analytics                           |
| principal          | School   | Full school admin                           | Academic, students, staff, finance, communication, identity, events, reports |
| teacher            | School   | Teaching scope                              | Classes, grading, attendance, assignments, events, leave                     |
| student            | School   | Own data only                               | Grades, attendance, schedule, events, messages                               |
| parent             | School   | Children's data                             | Grades, attendance, fees/invoices, events, messages                          |
| accountant         | School   | Financial scope                             | Fees, invoices, payments, expenses, payroll, scholarships, SMS, reports      |
| admissions_officer | School   | Enrollment scope                            | Admissions, student directory, ID cards, SMS, enrollment reports             |

## File Structure Convention

```
frontend/src/pages/<module>/
├── <ModuleName>Page.tsx          # Main listing page
├── <ModuleName>DetailPage.tsx    # Detail/view page (if needed)
└── components/
    ├── <Entity>FormModal.tsx     # Create/Edit modal
    ├── <Entity>DetailModal.tsx   # View detail modal
    └── <Entity>FilterPanel.tsx   # Complex filter panel (if needed)
```

## Standard Page Template (Full Example)

```tsx
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { Plus, RefreshCw, Download } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { DataTable } from '@components/admin/table/DataTable';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { DeleteDialog } from '@components/admin/feedback/DeleteDialog';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { SkeletonCard } from '@components/admin/feedback/Skeleton';
import { RoleGuard } from '@components/admin/common/RoleGuard';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import apiClient from '@lib/apiClient';

export const MyPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<Entity | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  // Fetch data
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['entities'],
    queryFn: () => apiClient.get('/api/v1/entities'),
    staleTime: 30_000,
  });

  const items = data?.data?.data ?? [];

  // Column definitions
  const columns: ColumnDef<Entity, any>[] = [
    { id: 'name', accessorKey: 'name', header: 'Name', cell: ({ row }) => (
      <span className="font-medium text-gray-900">{row.original.name}</span>
    )},
    { id: 'status', accessorKey: 'status', header: 'Status', cell: ({ row }) => (
      <StatusBadge status={row.original.status} showDot />
    )},
  ];

  // Delete handler
  const handleDelete = async () => {
    await apiClient.delete(`/api/v1/entities/${deleteTarget!.id}`);
    showToast.deleted('Entity');
    queryClient.invalidateQueries({ queryKey: ['entities'] });
  };

  return (
    <MainLayout>
      <PageShell
        title="Page Title"
        subtitle="Brief description of what this page manages"
        breadcrumbs={[{ label: 'Module' }, { label: 'Page' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline ml-1.5">Refresh</span>
            </Button>
            <RoleGuard roles={['principal', 'admissions_officer']}>
              <Button size="sm" onClick={() => setFormOpen(true)}>
                <Plus size={15} className="mr-1.5" />
                Add Item
              </Button>
            </RoleGuard>
          </div>
        }
      >
        {/* KPI Row — always show stats at top */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <KPICard title="Total" value={items.length} icon={...} color="blue" />
          {/* More KPI cards */}
        </div>

        {/* DataTable */}
        <DataTable
          columns={columns}
          data={items}
          isLoading={isLoading}
          error={error ? String(error) : null}
          onRetry={refetch}
          emptyMessage="No records found"
          emptyAction={{ label: 'Create First', onClick: () => setFormOpen(true) }}
          rowActions={(row) => [
            { label: 'Edit', onClick: (r) => openEdit(r) },
            { label: 'Delete', variant: 'destructive', onClick: (r) => setDeleteTarget(r) },
          ]}
        />

        {/* Delete Dialog */}
        <DeleteDialog
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          title="Delete Entity"
          itemName={deleteTarget?.name}
        />

        {/* Form Modal */}
        {formOpen && <EntityFormModal ... />}
      </PageShell>
    </MainLayout>
  );
};

export default MyPage;
```

## Shared Components Reference

### Layout

| Component    | Import                                | Purpose                                            |
| ------------ | ------------------------------------- | -------------------------------------------------- |
| `MainLayout` | `@components/layout/MainLayout`       | Sidebar + header wrapper (REQUIRED for every page) |
| `PageShell`  | `@components/admin/layout/PageShell`  | Breadcrumbs + title + content area (REQUIRED)      |
| `PageHeader` | `@components/admin/layout/PageHeader` | Title + subtitle + actions (used inside PageShell) |

### Data Display

| Component     | Import                                   | Purpose                                                                                                 |
| ------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `DataTable`   | `@components/admin/table/DataTable`      | Full-featured table with sort, pagination, row actions                                                  |
| `KPICard`     | `@components/dashboard/KPICard`          | Metric card with trend (colors: blue, green, red, amber, purple, indigo)                                |
| `StatusBadge` | `@components/admin/feedback/StatusBadge` | Status pill (active, inactive, pending, suspended, paid, overdue, partial, draft, published, cancelled) |
| `ProgressBar` | `@components/admin/feedback/ProgressBar` | Animated progress bar (colors: blue, green, amber, red, purple)                                         |
| `AvatarGroup` | `@components/admin/feedback/AvatarGroup` | Stacked circular avatars with overflow                                                                  |

### Feedback & Dialogs

| Component            | Import                                          | Purpose                                                      |
| -------------------- | ----------------------------------------------- | ------------------------------------------------------------ |
| `Modal`              | `@components/admin/feedback/Modal`              | Base accessible dialog (sm/md/lg, focus trap, Escape)        |
| `FormModal`          | `@components/admin/feedback/FormModal`          | Form-in-modal with submit handling and loading               |
| `DeleteDialog`       | `@components/admin/feedback/DeleteDialog`       | Delete confirmation with item name and optional typing check |
| `ConfirmationDialog` | `@components/admin/feedback/ConfirmationDialog` | Generic destructive action confirmation                      |
| `Tooltip`            | `@components/admin/feedback/Tooltip`            | Hover tooltip (positions: top, bottom, left, right)          |
| `DropdownMenu`       | `@components/admin/feedback/DropdownMenu`       | Action menu with icons, separators, variants                 |

### States

| Component          | Import                                  | Purpose                                                |
| ------------------ | --------------------------------------- | ------------------------------------------------------ |
| `EmptyState`       | `@components/admin/feedback/EmptyState` | Empty data placeholder with optional action button     |
| `ErrorState`       | `@components/admin/feedback/ErrorState` | Error display with retry (auto-handles 403/404)        |
| `SkeletonCard`     | `@components/admin/feedback/Skeleton`   | Loading placeholder for KPI cards                      |
| `SkeletonTableRow` | `@components/admin/feedback/Skeleton`   | Loading placeholder for table rows (needs columnCount) |
| `SkeletonChart`    | `@components/admin/feedback/Skeleton`   | Loading placeholder for chart areas                    |

### Controls

| Component     | Import                               | Purpose                                                                                           |
| ------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `Button`      | `@components/ui/button`              | 6 variants: default, outline, ghost, destructive, secondary, link. 4 sizes: default, sm, lg, icon |
| `Badge`       | `@components/ui/badge`               | Colored label: default, secondary, success, warning, destructive, outline                         |
| `RoleGuard`   | `@components/admin/common/RoleGuard` | Show/hide content based on user role                                                              |
| `Card` family | `@components/ui/card`                | Card, CardHeader, CardTitle, CardContent, CardFooter                                              |

### Forms

| Component     | Import                                | Purpose                                                               |
| ------------- | ------------------------------------- | --------------------------------------------------------------------- |
| `FormField`   | `@components/admin/forms/FormField`   | Input supporting text, email, password, number, tel, textarea, select |
| `FormSection` | `@components/admin/forms/FormSection` | Groups related fields under a title                                   |

### Templates

| Component           | Import                                          | Purpose                                                      |
| ------------------- | ----------------------------------------------- | ------------------------------------------------------------ |
| `AdminPageTemplate` | `@components/admin/templates/AdminPageTemplate` | Full page scaffold: PageShell + KPIs + ActionBar + DataTable |

## Toast Notifications

```ts
import { showToast } from "@utils/toast";

// Success (auto-closes after 4s)
showToast.success("Record created");
showToast.saved("Student"); // → "Student saved successfully."
showToast.deleted("Invoice"); // → "Invoice deleted successfully."

// Errors (stays until dismissed)
showToast.error("Failed to save");
showToast.apiError(error.message); // → "Something went wrong..." if no message

// Informational (auto-closes after 4s)
showToast.info("Email sent");
showToast.warning("Low balance"); // Stays until dismissed
```

## Styling Rules (STRICT)

### Cards & Containers

- Background: `bg-white`
- Border: `border border-gray-200`
- Radius: `rounded-xl`
- Combined: `bg-white rounded-xl border border-gray-200`

### Inputs & Selects

```
className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
```

### Labels

```
className="block text-sm font-medium text-gray-700 mb-1"
```

### Section Headers

```
className="text-base font-bold text-gray-900 mb-4"
```

### Text Colors

- Primary text: `text-gray-900`
- Secondary text: `text-gray-500`
- Muted text: `text-gray-400`
- Links: `text-blue-600 hover:text-blue-700`

### Forbidden Patterns

- ❌ No `bg-blue-50`, `bg-green-100`, `bg-yellow-50` etc. on cards/sections
- ❌ No `dark:` prefixed classes anywhere
- ❌ No inline status colors — always use `<StatusBadge>`
- ❌ No `shadow-lg` on cards — use `border` instead
- ❌ No custom fonts or text sizes outside the scale (xs, sm, base, lg, xl, 2xl, 3xl)

### Allowed Colored Backgrounds

- KPI card icon containers: `bg-blue-500 text-white` (solid color icons only)
- Selected/active tabs: `border-blue-600 text-blue-600`
- Badge with `<Badge>` or `<StatusBadge>` components only
- Quick-action card hover highlights (very subtle): `hover:border-blue-300`

## API Integration Pattern

### Fetching with React Query

```ts
import apiClient from "@lib/apiClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const { data, isLoading, error, refetch } = useQuery({
  queryKey: ["entity-name", { page, search, status }],
  queryFn: () =>
    apiClient.get("/api/v1/entities", {
      params: { page, limit: 25, search, status },
    }),
  staleTime: 30_000,
});

const items = data?.data?.data ?? [];
const pagination = data?.data?.pagination ?? { total: 0, total_pages: 1 };
```

### Creating/Updating

```ts
const queryClient = useQueryClient();

const handleCreate = async (formData: CreateDTO) => {
  try {
    await apiClient.post("/api/v1/entities", formData);
    showToast.success("Created successfully");
    queryClient.invalidateQueries({ queryKey: ["entity-name"] });
    setFormOpen(false);
  } catch (error: any) {
    showToast.apiError(error.message);
  }
};

const handleUpdate = async (id: string, formData: UpdateDTO) => {
  try {
    await apiClient.patch(`/api/v1/entities/${id}`, formData);
    showToast.saved("Entity");
    queryClient.invalidateQueries({ queryKey: ["entity-name"] });
    setFormOpen(false);
  } catch (error: any) {
    showToast.apiError(error.message);
  }
};
```

### Deleting

```ts
const [deleteTarget, setDeleteTarget] = useState<Entity | null>(null);

const handleDelete = async () => {
  try {
    await apiClient.delete(`/api/v1/entities/${deleteTarget!.id}`);
    showToast.deleted('Entity');
    queryClient.invalidateQueries({ queryKey: ['entity-name'] });
  } catch (error: any) {
    showToast.apiError(error.message);
  }
};

// In JSX:
<DeleteDialog
  isOpen={!!deleteTarget}
  onClose={() => setDeleteTarget(null)}
  onConfirm={handleDelete}
  title="Delete Entity"
  itemName={deleteTarget?.name}
  description="This will permanently remove this record and all related data."
/>
```

## Route Registration Checklist

When adding a new page, you MUST:

1. **Create the page file** in `frontend/src/pages/<module>/`
2. **Add route in `routes.tsx`**:
   ```tsx
   { path: 'module/page', element: <P requiredRoles={['principal', 'super_admin']}><MyPage /></P> }
   ```
3. **Add sidebar item in `Sidebar.tsx`** with matching roles:
   ```ts
   { label: 'My Page', icon: <FaIcon />, path: '/module/page', roles: ['super_admin', 'principal'], group: 'Module' }
   ```
4. **Create backend API route** in `backend/src/routes/`
5. **Create backend service** in `backend/src/services/`
6. **Create frontend service** in `frontend/src/services/`

## Backend API Convention

- Base URL: `/api/v1/<resource>`
- List: `GET /api/v1/entities?page=1&limit=25&search=&status=`
- Get: `GET /api/v1/entities/:id`
- Create: `POST /api/v1/entities`
- Update: `PATCH /api/v1/entities/:id`
- Delete: `DELETE /api/v1/entities/:id`
- Response format:
  ```json
  { "success": true, "data": { ... }, "pagination": { "page": 1, "limit": 25, "total": 100, "total_pages": 4 } }
  ```
- Error format:
  ```json
  { "success": false, "error": "Human-readable error message" }
  ```

## Tab Pattern (for multi-tab pages)

```tsx
const [activeTab, setActiveTab] = useState<"overview" | "list" | "settings">(
  "overview",
);

// Tab bar
<div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
  {TABS.map((tab) => (
    <button
      key={tab.key}
      role="tab"
      aria-selected={activeTab === tab.key}
      onClick={() => setActiveTab(tab.key)}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0
        ${
          activeTab === tab.key
            ? "border-blue-600 text-blue-600"
            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
        }`}
    >
      {tab.icon}
      {tab.label}
    </button>
  ))}
</div>;
```

## Search & Filter Pattern

```tsx
const [search, setSearch] = useState('');
const [statusFilter, setStatusFilter] = useState('');

// Search input
<div className="relative flex-1 max-w-md">
  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
  <input
    type="text"
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    placeholder="Search..."
    className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
  />
  {search && (
    <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 rounded">
      <X size={14} />
    </button>
  )}
</div>

// Status filter select
<select
  value={statusFilter}
  onChange={(e) => setStatusFilter(e.target.value)}
  className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
>
  <option value="">All Statuses</option>
  <option value="active">Active</option>
  <option value="inactive">Inactive</option>
</select>
```

## Form Modal Pattern (Create/Edit)

```tsx
const [formOpen, setFormOpen] = useState(false);
const [editing, setEditing] = useState<Entity | null>(null);
const [form, setForm] = useState({ name: "", status: "active" });

const openCreate = () => {
  setEditing(null);
  setForm({ name: "", status: "active" });
  setFormOpen(true);
};
const openEdit = (item: Entity) => {
  setEditing(item);
  setForm({ name: item.name, status: item.status });
  setFormOpen(true);
};

const handleSave = async () => {
  if (editing) {
    await apiClient.patch(`/api/v1/entities/${editing.id}`, form);
    showToast.saved("Entity");
  } else {
    await apiClient.post("/api/v1/entities", form);
    showToast.success("Entity created");
  }
  queryClient.invalidateQueries({ queryKey: ["entities"] });
  setFormOpen(false);
};

// In JSX:
<FormModal
  isOpen={formOpen}
  onClose={() => setFormOpen(false)}
  onSubmit={handleSave}
  title={editing ? "Edit Entity" : "Create Entity"}
  submitLabel={editing ? "Update" : "Create"}
>
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Name *
    </label>
    <input
      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      value={form.name}
      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
      required
    />
  </div>
</FormModal>;
```

## KPI Card Icon Convention

Always use solid-colored icon containers:

```tsx
<KPICard
  title="Active Students"
  value={1250}
  icon={
    <div className="p-2.5 rounded-xl bg-blue-500 text-white shadow-sm">
      <Users size={20} />
    </div>
  }
  color="blue"
/>
```

Available icon container colors:

- `bg-blue-500` — general/primary metrics
- `bg-green-500` or `bg-emerald-500` — positive/success metrics
- `bg-purple-500` — people/users metrics
- `bg-amber-500` — warning/attention metrics
- `bg-red-500` — negative/critical metrics
- `bg-gray-500` — neutral/inactive metrics
