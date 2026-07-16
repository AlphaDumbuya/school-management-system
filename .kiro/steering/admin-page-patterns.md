---
inclusion: auto
---

# Admin Page Development Patterns

Standard patterns for building production-ready admin pages in this school management system. Every new page MUST follow these patterns for consistency. The **Classes & Streams page** (`frontend/src/pages/academic/ClassesPage.tsx`) is the reference implementation.

## Reference Implementation Files

When building a new admin page, study these files first:
- #[[file:frontend/src/pages/academic/ClassesPage.tsx]] — Main page with KPIs, grid/table toggle, cascading filter, search
- #[[file:frontend/src/pages/academic/components/ClassFormModal.tsx]] — Multi-step cascading form with auto-prefill
- #[[file:frontend/src/services/classesService.ts]] — API service layer pattern
- #[[file:backend/src/routes/classRoutes.ts]] — Backend CRUD routes with auth, validation, pagination
- #[[file:frontend/src/components/admin/feedback/Modal.tsx]] — Modal component (sm/md/lg/xl sizes)
- #[[file:frontend/src/components/admin/table/DataTable.tsx]] — DataTable with row actions, selection, pagination

## Architecture Rules

1. **Every page wraps in `<MainLayout>`** — provides the sidebar + header
2. **Every page uses `<PageShell>`** — provides breadcrumbs, title, subtitle, actions area
3. **Dark mode supported** — use `dark:` classes on all elements (bg, text, border)
4. **super_admin has universal access** — include in all `authorize()` and `RoleGuard` arrays
5. **All pages must connect to real API endpoints** — never ship with mock data
6. **Both routes.tsx AND Sidebar.tsx** must be updated with matching role arrays
7. **Modal size `xl`** for complex forms, `lg` for detail views, `md` for simple forms

## Role Hierarchy

| Role | Scope | Access Level |
|------|-------|-------------|
| super_admin | Platform | ALL pages + platform management |
| principal | School | Full school admin |
| teacher | School | Classes, grading, attendance, assignments |
| student | School | Own data only |
| parent | School | Children's data |
| accountant | School | Financial scope |
| admissions_officer | School | Enrollment scope |

## File Structure Convention

```
frontend/src/pages/<module>/
├── <ModuleName>Page.tsx          # Main listing page
└── components/
    ├── <Entity>FormModal.tsx     # Create/Edit modal (cascading if complex)
    ├── <Entity>DetailModal.tsx   # View detail modal
    └── ...

frontend/src/services/
└── <module>Service.ts            # API service wrapping apiClient

backend/src/routes/
└── <module>Routes.ts             # Express router with CRUD endpoints
```

## Page Layout Pattern (Production Reference)

Every admin listing page follows this structure:

```tsx
<MainLayout>
  <PageShell title="..." subtitle="..." breadcrumbs={[...]} actions={<ActionButtons />}>
    {/* 1. KPI Row */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
      <KPICard ... />
    </div>

    {/* 2. Search & Filter Action Bar */}
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search input */}
        {/* Filter controls (popovers/selects) */}
      </div>
      {/* Active filter badges */}
    </div>

    {/* 3. Grid/Table Toggle + Content */}
    {viewMode === 'grid' ? <GridCards /> : <DataTable ... />}
  </PageShell>

  {/* 4. Modals & Dialogs (outside PageShell) */}
  <FormModal ... />
  <ConfirmationDialog ... /> {/* Deactivate */}
  <ConfirmationDialog ... /> {/* Delete */}
</MainLayout>
```

## API Response Handling (CRITICAL)

The backend returns responses at the **top level** (not wrapped in `ApiResponse`):

```ts
// Backend sends: { data: [...], pagination: {...} }
// apiClient.get() returns that directly
// useQuery's `data` IS that object

// ✅ CORRECT — access directly
const items: Record[] = (data as any)?.data ?? [];
const pagination = (data as any)?.pagination ?? { total: 0, total_pages: 1 };

// ❌ WRONG — don't nest .data.data
const items = data?.data?.data ?? []; // WRONG - extra nesting
```

### Numeric Fields from PostgreSQL

PostgreSQL returns `count(*)` and `COALESCE` values as **strings**. Always coerce with `Number()`:

```ts
// ✅ CORRECT
const enrolled = Number(cls.enrolled_students ?? 0);
const total = classes.reduce((s, c) => s + Number(c.enrolled_students ?? 0), 0);

// ❌ WRONG — string concatenation: "0" + "0" + "0" = "000"
const total = classes.reduce((s, c) => s + (c.enrolled_students ?? 0), 0);
```

### Create/Update Response Check

The apiClient's `handleError` returns `{ success: false, error: '...' }` on failure. Successful responses do NOT have a `success` field. Use strict equality:

```ts
// ✅ CORRECT
const res = await service.createEntity(payload);
if (res.success === false) throw new Error(res.error ?? 'Create failed');

// ❌ WRONG — falsy check triggers on success (success is undefined, not true)
if (!res.success) throw new Error(...);
```

## Backend Auth Pattern

The auth middleware sets `req.auth` (NOT `req.user`):

```ts
// ✅ CORRECT
const createdBy = req.auth?.userId ?? null;

// ❌ WRONG — req.user doesn't exist
const createdBy = (req as any).user.id; // throws "Cannot read properties of undefined"
```

Authorization uses `UserRole` enum:

```ts
import { UserRole } from '../types/auth';

router.post('/', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), async (req, res, next) => { ... });
```

## Backend PostgreSQL Insert Pattern

PostgreSQL requires `.returning('*')` to get back the inserted row:

```ts
// ✅ CORRECT — PostgreSQL
const [inserted] = await db('table').insert({ ... }).returning('*');
res.status(201).json({ message: 'Created', data: inserted });

// ❌ WRONG — returns row count [0], not the actual row
const [id] = await db('table').insert({ ... });
```

## Form Modal Pattern — Multi-Step Cascading (Modern)

For complex entity creation (like classes with level/stream hierarchy), use a **cascading card-based selector** instead of flat dropdowns:

### Key Features:
- **Progressive disclosure** — each step only shows after the previous is complete
- **Card-based selection** — clickable cards with icons, labels, descriptions
- **Smart auto-scroll** — `scrollIntoView({ behavior: 'smooth', block: 'nearest' })` after each selection
- **Auto-prefill** — name field auto-fills based on selections (with smart detection to avoid overwriting custom input)
- **Breadcrumb trail** — shows the full selection path at the top
- **Footer status hint** — tells user what to do next
- **`size="xl"`** on Modal for spacious desktop layout

### Structure:

```tsx
const [category, setCategory] = useState<string | null>(null);
const subCategoryRef = useRef<HTMLDivElement>(null);

const scrollToRef = useCallback((ref: React.RefObject<HTMLDivElement | null>) => {
  setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
}, []);

// Card style classes (reuse across all steps)
const cardBase = 'relative rounded-xl border-2 transition-all duration-200 cursor-pointer select-none';
const cardActive = 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-md ring-1 ring-blue-500/20';
const cardInactive = 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:shadow-sm active:scale-[0.98]';
```

### Auto-prefill Pattern:

```tsx
useEffect(() => {
  if (!selectedLevel) return;
  const autoName = selectedSection ? `${levelLabel} ${selectedSection}` : levelLabel;
  const currentName = watch('name');
  
  // Only auto-fill if empty or matches a previously generated name
  const isAutoGenerated = !currentName || KNOWN_PREFIXES.some(p => currentName.startsWith(p));
  if (isAutoGenerated) setValue('name', autoName);
}, [selectedLevel, selectedSection]);
```

## Filter Popover Pattern (Modern)

Instead of flat `<select>` dropdowns for complex hierarchical filters, use a **two-step popover**:

```tsx
const LevelFilterPopover = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  return (
    <div ref={popoverRef} className="relative">
      {/* Trigger button */}
      <button onClick={() => setIsOpen(!isOpen)} className="...">
        {displayLabel} <ChevronDown />
      </button>
      {/* Popover panel — uses position:fixed or z-50 to avoid clipping */}
      {isOpen && (
        <div className="absolute ... z-50 bg-white dark:bg-gray-900 border rounded-xl shadow-xl">
          {!activeCategory ? <CategoryGrid /> : <LevelButtons />}
        </div>
      )}
    </div>
  );
};
```

## Row Action Menu — Fixed Position (IMPORTANT)

Action menus MUST use `position: fixed` with `getBoundingClientRect()` to avoid being clipped by `overflow-hidden` table containers:

```tsx
function RowActionMenu({ row, actions }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={menuRef} className="relative">
      <button onClick={() => setOpen(!open)}>⋯</button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed z-50 bg-white dark:bg-gray-800 border rounded-xl shadow-xl min-w-[160px]"
            style={{
              top: menuRef.current.getBoundingClientRect().bottom + 4,
              right: window.innerWidth - menuRef.current.getBoundingClientRect().right,
            }}
          >
            {actions.map(action => <button ...>{action.label}</button>)}
          </div>
        </>
      )}
    </div>
  );
}
```

## CRUD Actions Pattern

Every listing page should have:

| Action | What it does | Backend endpoint |
|--------|-------------|-----------------|
| **Edit** | Opens FormModal pre-populated | `PUT /api/v1/entities/:id` |
| **View Details** | Opens detail modal or navigates | `GET /api/v1/entities/:id` |
| **Deactivate** | Soft delete (status='inactive') | `DELETE /api/v1/entities/:id` |
| **Delete** | Hard delete (only if no dependencies) | `DELETE /api/v1/entities/:id/permanent` |

### Delete vs Deactivate:
- **Deactivate** — always safe, sets status to inactive, keeps historical data
- **Delete** — checks for foreign key dependencies first, rejects if linked records exist

## Backend List Endpoint Pattern

```ts
router.get('/', authenticate, async (req, res, next) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = (page - 1) * limit;
  const { search, status, level } = req.query;

  let query = db('entities')
    .select('entities.*', db.raw('COALESCE(sub.count, 0) as related_count'))
    .leftJoin(subquery.as('sub'), 'entities.id', 'sub.entity_id');

  if (status) query = query.where('entities.status', status);
  if (search) {
    const term = `%${(search as string).trim()}%`;
    query = query.where(function() {
      this.where('entities.name', 'like', term)
        .orWhere('entities.code', 'like', term);
    });
  }

  const totalResult = await query.clone().clearSelect().clearOrder().count('entities.id as count').first();
  const total = Number(totalResult?.count ?? 0);
  const items = await query.limit(limit).offset(offset).orderBy('entities.name', 'asc');

  res.json({
    data: items,
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
  });
});
```

## Migration Pattern

When adding new columns to existing tables:

```ts
import type { Knex } from 'knex'; // Must use `import type` for ES module compatibility

export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('table', 'column');
  if (!hasColumn) {
    await knex.schema.alterTable('table', (table) => {
      table.string('column', 50).nullable();
    });
  }
}
```

**IMPORTANT**: Use `import type { Knex } from 'knex'` (not `import { Knex }`) — the project is ES module and knex is CommonJS.

## Duplicate Submit Prevention

Forms MUST NOT have both `<form onSubmit={...}>` and a submit button with `onClick={handleSubmit(...)}`. Use only one:

```tsx
// ✅ CORRECT — button handles submit, form has no onSubmit
<form className="...">
  {/* fields */}
</form>
// In footer:
<Button onClick={handleSubmit(onSubmit)}>Create</Button>

// ❌ WRONG — causes double submission
<form onSubmit={handleSubmit(onSubmit)}>
  <Button onClick={handleSubmit(onSubmit)}>Create</Button> // fires TWICE
</form>
```

## Dark Mode Classes (REQUIRED on all elements)

Every visual element must have both light and dark variants:

```tsx
// Backgrounds
className="bg-white dark:bg-gray-900"
className="bg-gray-50 dark:bg-gray-800"

// Text
className="text-gray-900 dark:text-white"
className="text-gray-500 dark:text-gray-400"

// Borders
className="border-gray-200 dark:border-gray-700"
className="border-gray-100 dark:border-gray-800"

// Hover states
className="hover:bg-gray-50 dark:hover:bg-gray-800"
```

## Toast Notifications

```ts
import { showToast } from '@utils/toast';

showToast.success('Record created');
showToast.saved('Student');     // → "Student saved successfully."
showToast.deleted('Invoice');   // → "Invoice deleted successfully."
showToast.error('Failed to save');
showToast.apiError(res.error);  // Shows the error message from API
```

## Shared Components Quick Reference

| Component | Import | Purpose |
|-----------|--------|---------|
| `MainLayout` | `@components/layout/MainLayout` | Sidebar + header (REQUIRED) |
| `PageShell` | `@components/admin/layout/PageShell` | Title + breadcrumbs + actions (REQUIRED) |
| `DataTable` | `@components/admin/table/DataTable` | Table with sort, pagination, row actions, selection |
| `KPICard` | `@components/dashboard/KPICard` | Stat card (colors: blue, green, red, amber, purple, indigo) |
| `StatusBadge` | `@components/admin/feedback/StatusBadge` | Status pill with dot |
| `ProgressBar` | `@components/admin/feedback/ProgressBar` | Animated bar (colors: blue, green, amber, red) |
| `Modal` | `@components/admin/feedback/Modal` | Dialog (sm/md/lg/xl), focus trap, scroll, dark mode |
| `ConfirmationDialog` | `@components/admin/feedback/ConfirmationDialog` | Destructive action confirmation |
| `FormField` | `@components/admin/forms/FormField` | Input (text/email/number/tel/textarea/select) |
| `RoleGuard` | `@components/admin/common/RoleGuard` | Show/hide by role |
| `Button` | `@components/ui/button` | Variants: default, outline, ghost, destructive |
| `EmptyState` | `@components/admin/feedback/EmptyState` | No data placeholder |
| `SkeletonCard` | `@components/admin/feedback/Skeleton` | Loading placeholder |

## Route Registration Checklist

When adding a new page:

1. Create page file in `frontend/src/pages/<module>/`
2. Add route in `routes.tsx` with `<P requiredRoles={[...]}><Page /></P>`
3. Add sidebar item in `Sidebar.tsx` with matching roles
4. Create backend route in `backend/src/routes/`
5. Register backend route in `backend/src/index.ts`
6. Create frontend service in `frontend/src/services/`
7. Run any needed database migrations
