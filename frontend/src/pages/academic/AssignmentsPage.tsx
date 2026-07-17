/**
 * AssignmentsPage — /academic/assignments
 * CRUD for class assignments with submission tracking.
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { ClipboardList, Clock, CheckCircle, AlertTriangle, X, ChevronDown, SlidersHorizontal } from 'lucide-react';
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
import { assignmentsService, AssignmentRecord, ASSIGNMENT_TYPES } from '@services/assignmentsService';
import { AssignmentFormModal } from './components/AssignmentFormModal';

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

// ── Component ─────────────────────────────────────────────────────────────────

export const AssignmentsPage: React.FC = () => {
  const queryClient = useQueryClient();

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

  // Fetch
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
        subtitle="Create and manage student assignments"
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

        {/* Search & Filters */}
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

            {/* Filters */}
            <div className="flex items-center gap-2 sm:gap-2.5 w-full lg:w-auto">
              {/* Type filter */}
              <div className="relative flex-1 sm:flex-initial sm:min-w-[130px]">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full appearance-none pl-3 pr-8 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="">All Types</option>
                  {ASSIGNMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
              </div>

              {/* Status filter */}
              <div className="relative flex-1 sm:flex-initial sm:min-w-[130px]">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full appearance-none pl-3 pr-8 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="closed">Closed</option>
                  <option value="draft">Draft</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
              </div>
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
          emptyAction={{ label: 'Create your first assignment', onClick: () => { setEditingAssignment(null); setFormOpen(true); } }}
          rowActions={(row) => [
            { label: 'Edit', onClick: (r) => { setEditingAssignment(r); setFormOpen(true); } },
            { label: 'Delete', variant: 'destructive', onClick: (r) => setDeleteTarget(r) },
          ]}
        />
      </PageShell>

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
