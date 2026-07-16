---
inclusion: auto
---

# Admin Page Development Patterns

Standard patterns for building production-ready admin pages in this school management system.

## Architecture Rules

1. **Every page wraps in `<MainLayout>`** — this provides the sidebar + header
2. **Every page uses `<PageShell>`** — provides breadcrumbs, title, subtitle, actions area
3. **super_admin has universal access** — bypass all role checks in `canAccess()`
4. **Light mode only** — `darkMode: 'class'` in Tailwind config, no dark class applied
5. **Tenant operations restricted to tenant roles** — super_admin can view but not mutate school-level data

## Role Hierarchy

| Role               | Scope    | Description                                            |
| ------------------ | -------- | ------------------------------------------------------ |
| super_admin        | Platform | Manages tenants, subscriptions, platform analytics     |
| principal          | School   | Full school admin (academic, students, staff, finance) |
| teacher            | School   | Teaching, grading, attendance                          |
| student            | School   | View own grades, attendance, schedule                  |
| parent             | School   | Monitor children, view fees, communicate               |
| accountant         | School   | Financial operations, fees, payroll                    |
| admissions_officer | School   | Enrollment, ID cards, student intake                   |

## Standard Page Structure

```tsx
import MainLayout from "@components/layout/MainLayout";
import { PageShell } from "@components/admin/layout/PageShell";
import { KPICard } from "@components/dashboard/KPICard";
import { DataTable } from "@components/admin/table/DataTable";
import { StatusBadge } from "@components/admin/feedback/StatusBadge";
import { DeleteDialog } from "@components/admin/feedback/DeleteDialog";
import { FormModal } from "@components/admin/feedback/FormModal";
import { RoleGuard } from "@components/admin/common/RoleGuard";
import { Button } from "@components/ui/button";
import { showToast } from "@utils/toast";

export const MyPage: React.FC = () => {
  return (
    <MainLayout>
      <PageShell
        title="Page Title"
        subtitle="Brief description"
        breadcrumbs={[{ label: "Module" }, { label: "Page" }]}
        actions={
          <RoleGuard roles={["principal", "admissions_officer"]}>
            <Button size="sm" onClick={openForm}>
              <Plus size={15} className="mr-1.5" />
              Add Item
            </Button>
          </RoleGuard>
        }
      >
        {/* KPI Row */}
        {/* Filters */}
        {/* DataTable */}
        {/* Modals */}
      </PageShell>
    </MainLayout>
  );
};
```

## Shared Components Available

### Layout

- `MainLayout` — sidebar + header wrapper
- `PageShell` — breadcrumbs + title + content wrapper
- `PageHeader` — title + subtitle + actions

### Data Display

- `DataTable` — TanStack Table with sort, pagination, row actions, selection
- `KPICard` — metric card (6 colors: blue, green, red, amber, purple, indigo)
- `StatusBadge` — status pill (active, inactive, pending, suspended, paid, overdue, etc.)
- `ProgressBar` — animated progress with ARIA
- `AvatarGroup` — stacked user avatars

### Feedback & Dialogs

- `Modal` — base accessible dialog (sm/md/lg)
- `FormModal` — standardized form-in-modal with submit/cancel
- `DeleteDialog` — responsive delete confirmation with optional typing verification
- `ConfirmationDialog` — generic destructive action confirmation
- `Tooltip` — hover tooltip (top/bottom/left/right)
- `DropdownMenu` — action dropdown with separators and variants

### States

- `EmptyState` — empty data placeholder with action
- `ErrorState` — error display with retry
- `Skeleton`, `SkeletonCard`, `SkeletonTableRow`, `SkeletonChart`

### Controls

- `Button` — 6 variants (default, outline, ghost, destructive, secondary, link)
- `Badge` — colored label (6 variants)
- `RoleGuard` — conditional render by role
- `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter`

### Forms

- `FormField` — RHF-compatible input (text, email, password, number, tel, textarea, select)
- `FormSection` — field grouping with title

### Toast

```ts
import { showToast } from "@utils/toast";
showToast.success("Record created");
showToast.saved("Student"); // "Student saved successfully."
showToast.deleted("Invoice"); // "Invoice deleted successfully."
showToast.apiError(error.message); // Red persistent error
showToast.warning("Low balance");
showToast.info("Reminder sent");
```

## Styling Rules

1. **No colored backgrounds** — use `bg-white` for cards, `border border-gray-200` for borders
2. **Icon containers use solid colors** — `bg-blue-500 text-white` in KPI cards
3. **Status uses StatusBadge** — never inline colored classes for status
4. **Inputs use consistent class** — `w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500`
5. **Selects use consistent class** — same as inputs + `appearance-none` with chevron icon

## API Integration Pattern

```ts
import apiClient from "@lib/apiClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// Fetching
const { data, isLoading, error, refetch } = useQuery({
  queryKey: ["entity-name", { filters }],
  queryFn: () => apiClient.get("/api/v1/entity"),
  staleTime: 30_000,
});

// Mutations
const queryClient = useQueryClient();
const handleCreate = async (data) => {
  await apiClient.post("/api/v1/entity", data);
  showToast.success("Created successfully");
  queryClient.invalidateQueries({ queryKey: ["entity-name"] });
};
```

## Delete Pattern

```tsx
const [deleteTarget, setDeleteTarget] = useState<Entity | null>(null);

const handleDelete = async () => {
  await apiClient.delete(`/api/v1/entity/${deleteTarget!.id}`);
  showToast.deleted("Entity");
  queryClient.invalidateQueries({ queryKey: ["entities"] });
};

// In JSX:
<DeleteDialog
  isOpen={!!deleteTarget}
  onClose={() => setDeleteTarget(null)}
  onConfirm={handleDelete}
  title="Delete Entity"
  itemName={deleteTarget?.name}
/>;
```
