/**
 * StudentDirectoryPage — /students/directory
 * Searchable directory of all students with CRUD.
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { Users, UserCheck, UserX, GraduationCap, Search, X, ChevronDown, SlidersHorizontal } from 'lucide-react';
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
import { studentsService, StudentRecord } from '@services/studentsService';
import { StudentFormModal } from './components/StudentFormModal';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Component ─────────────────────────────────────────────────────────────────

export const StudentDirectoryPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  const [formOpen, setFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<StudentRecord | null>(null);

  // Fetch students
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['students', { search, statusFilter, page, pageSize }],
    queryFn: () => studentsService.listStudents({
      page, limit: pageSize,
      status: statusFilter || undefined,
      search: search || undefined,
    }),
    staleTime: 30_000,
  });

  const students: StudentRecord[] = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination ?? { total: 0, total_pages: 1 };

  // KPIs
  const stats = useMemo(() => {
    const total = Number(pagination.total ?? students.length);
    const active = students.filter((s) => s.status === 'active').length;
    const inactive = students.filter((s) => s.status === 'inactive' || s.status === 'suspended').length;
    const graduated = students.filter((s) => s.status === 'graduated').length;
    return { total, active, inactive, graduated };
  }, [students, pagination]);

  // Deactivate handler
  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    const res = await studentsService.deactivateStudent(deactivateTarget.id);
    if (res.success !== false) {
      showToast.deleted('Student');
      queryClient.invalidateQueries({ queryKey: ['students'] });
    } else {
      showToast.apiError(res.error);
    }
    setDeactivateTarget(null);
  };

  // Columns
  const columns: ColumnDef<StudentRecord, any>[] = [
    {
      id: 'student_id',
      accessorKey: 'student_id',
      header: 'ID',
      cell: ({ row }) => (
        <span className="font-mono text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
          {row.original.student_id}
        </span>
      ),
    },
    {
      id: 'name',
      header: 'Full Name',
      cell: ({ row }) => (
        <div className="min-w-[140px]">
          <p className="font-medium text-gray-900 dark:text-white">{row.original.first_name} {row.original.last_name}</p>
          {row.original.email && <p className="text-[11px] text-gray-500 dark:text-gray-400">{row.original.email}</p>}
        </div>
      ),
    },
    {
      id: 'gender',
      accessorKey: 'gender',
      header: 'Gender',
      cell: ({ row }) => <span className="text-xs text-gray-600 dark:text-gray-400 capitalize">{row.original.gender || '—'}</span>,
    },
    {
      id: 'enrollment_date',
      accessorKey: 'enrollment_date',
      header: 'Enrolled',
      cell: ({ row }) => <span className="text-xs text-gray-600 dark:text-gray-400">{formatDate(row.original.enrollment_date)}</span>,
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
        title="Student Directory"
        subtitle="Manage all student records and enrollment"
        breadcrumbs={[{ label: 'Student Directory' }]}
        actions={
          <RoleGuard roles={['principal', 'super_admin', 'admissions_officer']}>
            <Button variant="default" size="sm" onClick={() => { setEditingStudent(null); setFormOpen(true); }} className="whitespace-nowrap shadow-sm">
              + Add Student
            </Button>
          </RoleGuard>
        }
      >
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
          {isLoading && !data ? (
            <><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
          ) : (
            <>
              <KPICard title="Total Students" value={stats.total} icon={<div className="p-2 rounded-xl bg-blue-500 text-white shadow-sm flex items-center justify-center"><Users size={20} /></div>} color="blue" />
              <KPICard title="Active" value={stats.active} icon={<div className="p-2 rounded-xl bg-green-500 text-white shadow-sm flex items-center justify-center"><UserCheck size={20} /></div>} color="green" />
              <KPICard title="Inactive / Suspended" value={stats.inactive} icon={<div className="p-2 rounded-xl bg-red-500 text-white shadow-sm flex items-center justify-center"><UserX size={20} /></div>} color="red" />
              <KPICard title="Graduated" value={stats.graduated} icon={<div className="p-2 rounded-xl bg-purple-500 text-white shadow-sm flex items-center justify-center"><GraduationCap size={20} /></div>} color="purple" />
            </>
          )}
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col gap-3 sm:gap-4 mb-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, ID, or email..."
                className="w-full pl-9 pr-8 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md"><X size={14} /></button>}
            </div>

            <div className="relative flex-1 sm:flex-initial sm:min-w-[150px] lg:w-auto">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full appearance-none pl-3 pr-8 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
                <option value="graduated">Graduated</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
            </div>
          </div>

          {(search || statusFilter) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-450 dark:text-gray-500 flex items-center gap-1 mr-1"><SlidersHorizontal size={10} /> Filters:</span>
              {search && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-50 dark:bg-primary-950/20 text-primary-700 dark:text-primary-400 text-xs font-semibold border border-primary-200/30">"{search}" <button onClick={() => setSearch('')}><X size={12} /></button></span>}
              {statusFilter && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold border border-emerald-200/30">{statusFilter} <button onClick={() => setStatusFilter('')}><X size={12} /></button></span>}
              <button onClick={() => { setSearch(''); setStatusFilter(''); }} className="text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 font-bold ml-auto">Clear All</button>
            </div>
          )}
        </div>

        {/* Table */}
        <DataTable
          columns={columns}
          data={students}
          isLoading={isLoading}
          error={error ? String(error) : null}
          onRetry={refetch}
          paginationMode="server"
          pageIndex={page}
          pageSize={pageSize}
          totalRows={Number(pagination.total)}
          onPageChange={setPage}
          emptyMessage="No students found"
          emptyAction={{ label: 'Add your first student', onClick: () => { setEditingStudent(null); setFormOpen(true); } }}
          rowActions={(row) => [
            { label: 'Edit', onClick: (r) => { setEditingStudent(r); setFormOpen(true); } },
            { label: 'Deactivate', variant: 'destructive', onClick: (r) => setDeactivateTarget(r) },
          ]}
        />
      </PageShell>

      {/* Form Modal */}
      <StudentFormModal
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditingStudent(null); }}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['students'] })}
        editingStudent={editingStudent}
      />

      {/* Deactivate Confirmation */}
      <ConfirmationDialog
        isOpen={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivate}
        title="Deactivate Student"
        message={`Deactivate ${deactivateTarget?.first_name} ${deactivateTarget?.last_name}? They will no longer appear in active listings.`}
        confirmLabel="Deactivate"
      />
    </MainLayout>
  );
};

export default StudentDirectoryPage;
