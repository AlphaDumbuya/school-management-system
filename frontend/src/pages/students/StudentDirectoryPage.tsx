/**
 * StudentDirectoryPage — /students/directory
 * Searchable directory of all students with CRUD.
 * Supports grid / list view toggle (same pattern as ClassesPage).
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import {
  Users, UserCheck, UserX, GraduationCap,
  X, ChevronDown, SlidersHorizontal,
  LayoutGrid, List, Edit, Trash2, Eye,
  Calendar, BookOpen, User,
} from 'lucide-react';
import { SearchBar } from '@components/admin/table/SearchBar';
import { cardTint } from '@lib/cardTint';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { DataTable } from '@components/admin/table/DataTable';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { SkeletonCard } from '@components/admin/feedback/Skeleton';
import { RoleGuard } from '@components/admin/common/RoleGuard';
import { YearFilter } from '@components/common/YearFilter';
import { ExportButton } from '@components/admin/common/ExportButton';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { useAuth } from '@hooks/useAuth';
import { studentsService, StudentRecord } from '@services/studentsService';
import { StudentFormModal } from './components/StudentFormModal';
import { StudentImportModal } from './components/StudentImportModal';
import { StudentDetailModal } from './components/StudentDetailModal';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getInitials(first: string, last: string): string {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
}

// Gender-based avatar gradient
const GENDER_GRADIENT: Record<string, string> = {
  male:   'from-blue-400 to-blue-600',
  female: 'from-pink-400 to-rose-500',
  other:  'from-purple-400 to-indigo-500',
};

const STATUS_PILL: Record<string, string> = {
  active:    'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/30',
  inactive:  'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700',
  suspended: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/30',
  graduated: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/30',
};

// ── Component ─────────────────────────────────────────────────────────────────

export const StudentDirectoryPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canAccess } = useAuth();
  // Teachers view a read-only, class-scoped directory; only these roles manage.
  const canManage = canAccess(['principal', 'super_admin', 'admissions_officer']);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  // Academic-year scope. Empty = current roster (all active). Choosing a past
  // year shows that year's enrolled roster (historical). Real sessions only.
  const [year, setYear] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<StudentRecord | null>(null);
  const [viewingStudent, setViewingStudent] = useState<StudentRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudentRecord | null>(null);

  // Fetch students
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['students', { search, statusFilter, year, page, pageSize }],
    queryFn: () => studentsService.listStudents({
      page, limit: pageSize,
      status: statusFilter || undefined,
      search: search || undefined,
      academic_year: year || undefined,
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

  // Delete handler (permanent)
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await studentsService.deleteStudent(deleteTarget.id);
      if (res.success !== false) {
        showToast.deleted('Student');
        queryClient.invalidateQueries({ queryKey: ['students'] });
      } else {
        showToast.apiError(res.error);
      }
    } catch {
      showToast.error('Failed to delete student');
    }
    setDeleteTarget(null);
  };

  // Reactivate handler
  const handleReactivate = async (student: StudentRecord) => {
    const res = await studentsService.reactivateStudent(student.id);
    if (res.success !== false) {
      showToast.success('Student reactivated');
      queryClient.invalidateQueries({ queryKey: ['students'] });
    } else {
      showToast.apiError(res.error);
    }
  };

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns: ColumnDef<StudentRecord, any>[] = [
    {
      id: 'photo',
      header: '',
      size: 50,
      cell: ({ row }) => (
        <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden flex items-center justify-center flex-shrink-0">
          {(row.original as any).photo_url && (row.original as any).photo_url.length > 10 ? (
            <img src={(row.original as any).photo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs font-bold text-gray-400 dark:text-gray-600">
              {getInitials(row.original.first_name, row.original.last_name)}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'student_id',
      accessorKey: 'student_id',
      header: 'Student ID',
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
      id: 'class',
      header: 'Class',
      cell: ({ row }) => {
        const className = (row.original as any).class_name;
        return className
          ? <span className="text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800/30">{className}</span>
          : <span className="text-xs text-gray-400 dark:text-gray-500">—</span>;
      },
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

  // ── Grid card ─────────────────────────────────────────────────────────────
  const renderStudentCard = (student: StudentRecord, idx: number) => {
    const gradient = GENDER_GRADIENT[student.gender?.toLowerCase() ?? ''] ?? 'from-gray-400 to-gray-600';
    const hasPhoto = !!(student as any).photo_url && ((student as any).photo_url?.length ?? 0) > 10;

    return (
      <div
        key={student.id}
        className={`group relative overflow-hidden ${cardTint(idx)} sm:bg-white sm:dark:bg-gray-800 sm:border-gray-200/60 sm:dark:border-gray-700/60 border rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1`}
      >
        {/* Top accent bar */}
        <div className={`h-1 w-full bg-gradient-to-r ${gradient}`} />

        <div className="p-5">
          {/* Avatar + Name + ID */}
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-12 h-12 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center bg-gradient-to-br ${gradient} shadow-sm`}>
              {hasPhoto ? (
                <img src={(student as any).photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-white">
                  {getInitials(student.first_name, student.last_name)}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {student.first_name} {student.last_name}
              </h3>
              <span className="font-mono text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                {student.student_id}
              </span>
            </div>
            {/* Status badge */}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize flex-shrink-0 ${STATUS_PILL[student.status] ?? STATUS_PILL.inactive}`}>
              {student.status}
            </span>
          </div>

          {/* Info grid */}
          <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400 mb-4">
            <div className="flex items-center gap-2">
              <BookOpen size={13} className="text-blue-400 flex-shrink-0" />
              <span className="truncate">
                {student.class_name
                  ? <span className="font-semibold text-blue-600 dark:text-blue-400">{student.class_name}</span>
                  : <span className="text-gray-400 italic">No class assigned</span>
                }
              </span>
            </div>
            <div className="flex items-center gap-2">
              <User size={13} className="text-purple-400 flex-shrink-0" />
              <span className="capitalize">{student.gender || 'Gender not set'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={13} className="text-green-400 flex-shrink-0" />
              <span>Enrolled {formatDate(student.enrollment_date)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700/50 pt-3 gap-1">
            <button
              onClick={() => setViewingStudent(student)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
            >
              <Eye size={13} /> View
            </button>

            <RoleGuard roles={['principal', 'super_admin', 'admissions_officer']}>
              <button
                onClick={() => { setEditingStudent(student); setFormOpen(true); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <Edit size={13} /> Edit
              </button>
              <button
                onClick={() => student.status === 'active' ? setDeactivateTarget(student) : handleReactivate(student)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
              >
                <Trash2 size={13} />
                {student.status === 'active' ? 'Deactivate' : 'Reactivate'}
              </button>
            </RoleGuard>
          </div>
        </div>
      </div>
    );
  };

  return (
    <MainLayout>
      <PageShell
        title="Student Directory"
        subtitle="Manage all student records and enrollment"
        breadcrumbs={[{ label: 'Student Directory' }]}
        onRefresh={() => refetch()}
        isRefreshing={isLoading}
        actions={
          <div className="flex items-center gap-2 sm:gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                title="Grid View"
              >
                <LayoutGrid size={18} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                title="List View"
              >
                <List size={18} />
              </button>
            </div>

            <YearFilter value={year} onChange={(y) => { setYear(y); setPage(1); }} includeAllOption />

            <RoleGuard roles={['principal', 'super_admin', 'admissions_officer']}>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="whitespace-nowrap">
                Import
              </Button>
            </RoleGuard>

            <RoleGuard roles={['principal', 'super_admin', 'admissions_officer']}>
              <ExportButton endpoint="/api/v1/students/export" filename="students" />
            </RoleGuard>

            <RoleGuard roles={['principal', 'super_admin', 'admissions_officer']}>
              <Button variant="default" size="sm" onClick={() => { setEditingStudent(null); setFormOpen(true); }} className="whitespace-nowrap shadow-sm">
                + Add Student
              </Button>
            </RoleGuard>
          </div>
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
            <SearchBar
              placeholder="Search name, ID, or email..."
              onSearch={setSearch}
              isLoading={isLoading}
              resultCount={search ? students.length : undefined}
              className="w-full lg:max-w-md"
            />

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

        {/* ── Grid View ── */}
        {viewMode === 'grid' ? (
          isLoading && !data ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
            </div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Users size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">No students found</p>
              <p className="text-sm text-gray-500 mt-1 mb-4">
                {canManage ? 'Try adjusting your filters or search query.' : 'No students in your classes match this view.'}
              </p>
              {canManage && (
                <Button onClick={() => { setEditingStudent(null); setFormOpen(true); }}>Add your first student</Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {students.map(renderStudentCard)}
            </div>
          )
        ) : (
          /* ── List / Table View ── */
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
            emptyMessage={canManage ? 'No students found' : 'No students in your classes match this view.'}
            emptyAction={canManage ? { label: 'Add your first student', onClick: () => { setEditingStudent(null); setFormOpen(true); } } : undefined}
            rowActions={(row) => [
              // View is available to everyone (read-only)
              { label: 'View Details', onClick: (r: StudentRecord) => setViewingStudent(r) },
              // Management actions are staff/admissions only
              ...(canManage ? [
                { label: 'Edit', onClick: (r: StudentRecord) => { setEditingStudent(r); setFormOpen(true); } },
                ...(row.status === 'active'
                  ? [{ label: 'Deactivate', variant: 'destructive' as const, onClick: (r: StudentRecord) => setDeactivateTarget(r) }]
                  : [{ label: 'Reactivate', onClick: (r: StudentRecord) => handleReactivate(r) }]
                ),
                { label: 'Delete', variant: 'destructive' as const, onClick: (r: StudentRecord) => setDeleteTarget(r) },
              ] : []),
            ]}
          />
        )}
      </PageShell>

      {/* Import Modal */}
      <StudentImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => queryClient.invalidateQueries({ queryKey: ['students'] })}
      />

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

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Student"
        message={`Permanently delete ${deleteTarget?.first_name} ${deleteTarget?.last_name}? This cannot be undone.`}
        confirmLabel="Delete Permanently"
      />

      {/* View Details */}
      <StudentDetailModal
        isOpen={!!viewingStudent}
        onClose={() => setViewingStudent(null)}
        student={viewingStudent}
        onEdit={(s) => { setEditingStudent(s); setFormOpen(true); }}
        onCreateParentAccount={(s) => navigate('/students/profiles', { state: { studentId: s.id, openParentModal: true } })}
      />
    </MainLayout>
  );
};

export default StudentDirectoryPage;
