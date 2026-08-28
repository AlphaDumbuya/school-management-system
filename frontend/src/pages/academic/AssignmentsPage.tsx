/**
 * AssignmentsPage — /academic/assignments
 * CRUD for class assignments with submission tracking.
 * Features Searchable Filter Popovers with embedded search bars inside filters.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import {
  ClipboardList,
  Clock,
  CheckCircle,
  AlertTriangle,
  X,
  ChevronDown,
  SlidersHorizontal,
  Search,
  Check,
} from 'lucide-react';
import { SearchBar } from '@components/admin/table/SearchBar';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { DataTable } from '@components/admin/table/DataTable';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { SkeletonCard } from '@components/admin/feedback/Skeleton';
import { RoleGuard } from '@components/admin/common/RoleGuard';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { useAuth } from '@hooks/useAuth';
import {
  assignmentsService,
  AssignmentRecord,
  ASSIGNMENT_TYPES,
} from '@services/assignmentsService';
import { AssignmentFormModal } from './components/AssignmentFormModal';
import { AssignmentDetailModal } from './components/AssignmentDetailModal';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isOverdue(dueDate: string): boolean {
  return new Date(dueDate) < new Date() && new Date(dueDate).toDateString() !== new Date().toDateString();
}

const TYPE_LABELS: Record<string, string> = {
  homework: 'Homework',
  classwork: 'Classwork',
  essay: 'Essay',
  practical: 'Practical',
  project: 'Project',
  quiz: 'Quiz',
  test: 'Test',
  presentation: 'Presentation',
  group_work: 'Group Work',
  revision: 'Revision',
  reading: 'Reading',
  exercise: 'Exercise',
};

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', icon: '🟢' },
  { value: 'closed', label: 'Closed', icon: '🔴' },
  { value: 'draft', label: 'Draft', icon: '🟡' },
];

const TYPE_OPTIONS = ASSIGNMENT_TYPES.map((t) => ({
  value: t.value,
  label: t.label,
  icon: '📝',
}));

// ── SEARCHABLE FILTER POPOVER COMPONENT ────────────────────────────────────────

interface SearchableFilterPopoverProps {
  title: string;
  placeholder?: string;
  options: { value: string; label: string; icon?: string }[];
  value: string;
  onChange: (val: string) => void;
  allLabel?: string;
}

const SearchableFilterPopover: React.FC<SearchableFilterPopoverProps> = ({
  title,
  placeholder = 'Search options...',
  options,
  value,
  onChange,
  allLabel = 'All Options',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
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

  const filteredOptions = useMemo(() => {
    if (!filterSearch) return options;
    return options.filter((opt) =>
      opt.label.toLowerCase().includes(filterSearch.toLowerCase())
    );
  }, [options, filterSearch]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setFilterSearch('');
  };

  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption ? selectedOption.label : allLabel;

  return (
    <div ref={popoverRef} className="relative flex-1 sm:flex-initial">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full sm:w-auto flex items-center justify-between gap-2 pl-3 pr-2.5 py-2.5 sm:py-2 border rounded-lg text-sm font-medium transition-all cursor-pointer min-w-[140px] sm:min-w-[160px] ${
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20 bg-white dark:bg-gray-800'
            : value
              ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 font-semibold'
              : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
        }`}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown
          size={14}
          className={`flex-shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-1.5 z-50 w-[260px] sm:w-[280px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Header */}
          <div className="px-3.5 py-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {title}
            </span>
            {value && (
              <button
                type="button"
                onClick={() => handleSelect('')}
                className="text-[11px] font-semibold text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {/* Shared SearchBar inside Filter Popover */}
          <div className="p-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/30">
            <SearchBar
              placeholder={placeholder}
              onSearch={(val) => setFilterSearch(val)}
              defaultValue={filterSearch}
              debounceMs={0}
              className="w-full"
            />
          </div>

          {/* Options list */}
          <div className="p-1.5 max-h-[220px] overflow-y-auto space-y-1">
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-all text-left font-medium ${
                !value
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 font-bold'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60'
              }`}
            >
              <span>{allLabel}</span>
              {!value && <Check size={14} className="text-blue-500 flex-shrink-0" />}
            </button>

            {filteredOptions.map((opt) => {
              const isSelected = value === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-all text-left ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 font-bold'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {opt.icon && <span>{opt.icon}</span>}
                    <span>{opt.label}</span>
                  </span>
                  {isSelected && <Check size={14} className="text-blue-500 flex-shrink-0" />}
                </button>
              );
            })}

            {filteredOptions.length === 0 && (
              <p className="text-[11px] text-center text-gray-400 py-3 font-medium">
                No matching options found
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

export const AssignmentsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { canAccess } = useAuth();
  // Students (and other non-staff) get a read-only view of their class assignments.
  const canManage = canAccess(['principal', 'super_admin', 'teacher']);

  // Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  // Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<AssignmentRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AssignmentRecord | null>(null);
  const [viewingAssignment, setViewingAssignment] = useState<AssignmentRecord | null>(null);

  // Fetch assignments
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['assignments', { search, statusFilter, typeFilter, page, pageSize }],
    queryFn: () => assignmentsService.listAssignments({
      page,
      limit: pageSize,
      status: statusFilter || undefined,
      type: typeFilter || undefined,
      search: search || undefined,
    }),
    staleTime: 30_000,
  });

  const assignments: AssignmentRecord[] = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination ?? { total: 0, total_pages: 1 };

  // KPIs
  const stats = useMemo(() => {
    const total = Number(pagination.total ?? assignments.length);
    const active = assignments.filter((a) => a.status === 'active').length;
    const overdue = assignments.filter((a) => a.status === 'active' && isOverdue(a.due_date)).length;
    const totalSubmissions = assignments.reduce((s, a) => s + Number(a.total_submissions ?? 0), 0);
    return { total, active, overdue, totalSubmissions };
  }, [assignments, pagination]);

  // Delete handler
  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await assignmentsService.deleteAssignment(deleteTarget.id);
    if (res.success !== false) {
      showToast.deleted('Assignment');
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    } else {
      showToast.apiError(res.error);
    }
    setDeleteTarget(null);
  };

  // Columns
  const columns: ColumnDef<AssignmentRecord, any>[] = [
    {
      id: 'title',
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <div className="min-w-[150px]">
          <p className="font-medium text-gray-900 dark:text-white truncate">{row.original.title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{row.original.subject_name}</p>
        </div>
      ),
    },
    {
      id: 'class',
      accessorKey: 'class_name',
      header: 'Class',
      cell: ({ row }) => (
        <span className="text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2.5 py-0.5 rounded-full border border-gray-200 dark:border-gray-700">
          {row.original.class_name}
        </span>
      ),
    },
    {
      id: 'type',
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => (
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 capitalize">
          {TYPE_LABELS[row.original.type] || row.original.type}
        </span>
      ),
    },
    {
      id: 'due_date',
      accessorKey: 'due_date',
      header: 'Due Date',
      cell: ({ row }) => {
        const overdue = row.original.status === 'active' && isOverdue(row.original.due_date);
        return (
          <span className={`text-xs font-semibold ${overdue ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
            {formatDate(row.original.due_date)}
            {overdue && <span className="ml-1 text-[10px]">⚠️</span>}
          </span>
        );
      },
    },
    {
      id: 'teacher',
      accessorKey: 'teacher_name',
      header: 'Teacher',
      cell: ({ row }) => <span className="text-sm text-gray-600 dark:text-gray-400 truncate">{row.original.teacher_name}</span>,
    },
    {
      id: 'submissions',
      header: 'Submissions',
      cell: ({ row }) => (
        <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
          {Number(row.original.total_submissions ?? 0)} / {Number(row.original.graded_count ?? 0)} graded
        </span>
      ),
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} showDot />,
    },
  ];

  return (
    <MainLayout>
      <PageShell
        title="Assignments"
        subtitle={canManage ? 'Create and manage student assignments' : 'Your class assignments'}
        breadcrumbs={[{ label: 'Assignments' }]}
        actions={
          <div className="flex items-center gap-2 sm:gap-3">
            <RoleGuard roles={['principal', 'super_admin', 'teacher']}>
              <Button variant="default" size="sm" onClick={() => { setEditingAssignment(null); setFormOpen(true); }} className="whitespace-nowrap shadow-sm">
                + Create Assignment
              </Button>
            </RoleGuard>
          </div>
        }
      >
        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
          {isLoading && !data ? (
            <><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
          ) : (
            <>
              <KPICard title="Total Assignments" value={stats.total} icon={<div className="p-2 rounded-xl bg-blue-500 text-white shadow-sm flex items-center justify-center"><ClipboardList size={20} /></div>} color="blue" />
              <KPICard title="Active" value={stats.active} icon={<div className="p-2 rounded-xl bg-green-500 text-white shadow-sm flex items-center justify-center"><CheckCircle size={20} /></div>} color="green" />
              <KPICard title="Overdue" value={stats.overdue} icon={<div className="p-2 rounded-xl bg-red-500 text-white shadow-sm flex items-center justify-center"><AlertTriangle size={20} /></div>} color="red" />
              <KPICard title="Submissions" value={stats.totalSubmissions} icon={<div className="p-2 rounded-xl bg-purple-500 text-white shadow-sm flex items-center justify-center"><Clock size={20} /></div>} color="purple" />
            </>
          )}
        </div>

        {/* Search & Searchable Filter Popovers */}
        <div className="flex flex-col gap-3 sm:gap-4 mb-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Bar — shared component */}
            <SearchBar
              placeholder="Search assignment title or subject..."
              onSearch={setSearch}
              isLoading={isLoading}
              resultCount={search ? assignments.length : undefined}
              className="w-full lg:max-w-md"
            />

            {/* Searchable Filter Popovers */}
            <div className="flex items-center gap-2 sm:gap-2.5 w-full lg:w-auto">
              {/* Type Filter with internal Search Bar */}
              <SearchableFilterPopover
                title="Filter by Type"
                placeholder="Search types (homework, quiz...)"
                options={TYPE_OPTIONS}
                value={typeFilter}
                onChange={setTypeFilter}
                allLabel="All Types"
              />

              {/* Status Filter with internal Search Bar */}
              <SearchableFilterPopover
                title="Filter by Status"
                placeholder="Search status..."
                options={STATUS_OPTIONS}
                value={statusFilter}
                onChange={setStatusFilter}
                allLabel="All Statuses"
              />
            </div>
          </div>

          {/* Active filter badges */}
          {(search || typeFilter || statusFilter) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-450 dark:text-gray-500 flex items-center gap-1 mr-1">
                <SlidersHorizontal size={10} /> Filters:
              </span>
              {search && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-50 dark:bg-primary-950/20 text-primary-700 dark:text-primary-400 text-xs font-semibold border border-primary-200/30">
                  "{search}" <button onClick={() => setSearch('')}><X size={12} /></button>
                </span>
              )}
              {typeFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 text-xs font-semibold border border-blue-200/30">
                  Type: {TYPE_LABELS[typeFilter]} <button onClick={() => setTypeFilter('')}><X size={12} /></button>
                </span>
              )}
              {statusFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold border border-emerald-200/30">
                  Status: {statusFilter} <button onClick={() => setStatusFilter('')}><X size={12} /></button>
                </span>
              )}
              <button onClick={() => { setSearch(''); setTypeFilter(''); setStatusFilter(''); }} className="text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 font-bold ml-auto">
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* DataTable */}
        <DataTable
          columns={columns}
          data={assignments}
          isLoading={isLoading}
          error={error ? String(error) : null}
          onRetry={refetch}
          paginationMode="server"
          pageIndex={page}
          pageSize={pageSize}
          totalRows={Number(pagination.total)}
          onPageChange={setPage}
          emptyMessage="No assignments found"
          emptyAction={canManage ? { label: 'Create your first assignment', onClick: () => { setEditingAssignment(null); setFormOpen(true); } } : undefined}
          rowActions={(row) => (
            canManage
              ? [
                  { label: 'View', onClick: (r) => setViewingAssignment(r) },
                  { label: 'Edit', onClick: (r) => { setEditingAssignment(r); setFormOpen(true); } },
                  { label: 'Delete', variant: 'destructive', onClick: (r) => setDeleteTarget(r) },
                ]
              : [
                  { label: 'View', onClick: (r) => setViewingAssignment(r) },
                ]
          )}
        />
      </PageShell>

      {/* Detail Modal */}
      <AssignmentDetailModal
        isOpen={!!viewingAssignment}
        onClose={() => setViewingAssignment(null)}
        assignment={viewingAssignment}
        onEdit={(a) => { setEditingAssignment(a); setFormOpen(true); }}
      />

      {/* Form Modal */}
      <AssignmentFormModal
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditingAssignment(null); }}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['assignments'] })}
        editingAssignment={editingAssignment}
      />

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Assignment"
        message={`Delete "${deleteTarget?.title}"? If it has submissions, it will be closed instead of permanently deleted.`}
        confirmLabel="Delete"
      />
    </MainLayout>
  );
};

export default AssignmentsPage;
