/**
 * TeachersPage — /staff/teachers
 * Fully functional directory of all teachers in the system with CRUD operations.
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { Users, UserCheck, UserX, X, ChevronDown, SlidersHorizontal, LayoutGrid, List, Mail, Phone, BookOpen, Eye, Edit, Award } from 'lucide-react';
import { SearchBar } from '@components/admin/table/SearchBar';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { DataTable } from '@components/admin/table/DataTable';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { SkeletonCard } from '@components/admin/feedback/Skeleton';
import { RoleGuard } from '@components/admin/common/RoleGuard';
import { ExportButton } from '@components/admin/common/ExportButton';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { teachersService, TeacherRecord } from '@services/teachersService';
import { TeacherFormModal } from './components/TeacherFormModal';
import { TeacherDetailModal } from './components/TeacherDetailModal';
import { TeacherPromotionModal } from './components/TeacherPromotionModal';
import useAuth from '@hooks/useAuth';

interface TeacherCardProps {
  teacher: TeacherRecord;
  onView: (teacher: TeacherRecord) => void;
  onEdit?: (teacher: TeacherRecord) => void;
  onPromote?: (teacher: TeacherRecord) => void;
  onDeactivate?: (teacher: TeacherRecord) => void;
  hasWriteAccess: boolean;
}

const TeacherCard: React.FC<TeacherCardProps> = ({
  teacher,
  onView,
  onEdit,
  onPromote,
  onDeactivate,
  hasWriteAccess,
}) => {
  const designationMappings: Record<string, string> = {
    subject_teacher: 'Subject Teacher',
    form_teacher: 'Form Teacher',
    hod: 'Head of Department (HOD)',
    senior_teacher: 'Senior Teacher',
    vice_principal: 'Vice Principal',
    principal: 'Principal',
  };

  const designation = designationMappings[teacher.designation || ''] || teacher.designation || 'Subject Teacher';

  return (
    <div className="group bg-white dark:bg-gray-800 border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between h-full">
      <div>
        {/* Profile photo and Status badge */}
        <div className="flex items-start justify-between mb-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-lg border border-blue-100 dark:border-blue-900/30 overflow-hidden">
              {teacher.photo_url && teacher.photo_url.length > 10 ? (
                <img src={teacher.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                `${teacher.first_name?.[0] || ''}${teacher.last_name?.[0] || ''}`
              )}
            </div>
            {/* Active/Inactive dot */}
            <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border border-white dark:border-gray-800 ${teacher.status === 'active' ? 'bg-emerald-500' : 'bg-gray-450'}`} />
          </div>
          <span className="font-mono text-[10px] font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
            {teacher.teacher_id}
          </span>
        </div>

        {/* Name and Designation */}
        <div className="space-y-1">
          <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors text-base leading-snug truncate">
            {teacher.first_name} {teacher.last_name}
          </h3>
          <p className="text-xs font-semibold text-blue-655 dark:text-blue-400">
            {designation}
          </p>
          {teacher.department && teacher.department !== 'none' && (
            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-bold">
              {teacher.department.replace(/_/g, ' ')}
            </p>
          )}
        </div>

        {/* Contact Info */}
        <div className="mt-4 space-y-2 border-t border-gray-100 dark:border-gray-700/50 pt-3">
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <Mail size={13} className="text-gray-400 flex-shrink-0" />
            <span className="truncate select-all">{teacher.email}</span>
          </div>
          {teacher.phone && (
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <Phone size={13} className="text-gray-400 flex-shrink-0" />
              <span>{teacher.phone}</span>
            </div>
          )}
          {teacher.form_class_name && (
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <BookOpen size={13} className="text-indigo-400 flex-shrink-0" />
              <span className="font-medium">Form Teacher: <span className="font-bold text-indigo-650 dark:text-indigo-400">{teacher.form_class_name}</span></span>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-5 pt-3 border-t border-gray-150 dark:border-gray-700/50 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onView(teacher)}
          className="flex-1 flex items-center justify-center gap-1 text-xs py-1"
        >
          <Eye size={12} /> View Profile
        </Button>
        {hasWriteAccess && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPromote && onPromote(teacher)}
              title="Promote / Assign"
              className="px-2"
            >
              <Award size={12} className="text-amber-500" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit && onEdit(teacher)}
              title="Edit Profile"
              className="px-2"
            >
              <Edit size={12} className="text-blue-500" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDeactivate && onDeactivate(teacher)}
              title="Deactivate Account"
              className="px-2 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600"
            >
              <UserX size={12} className="text-red-500" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export const TeachersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { canAccess } = useAuth();
  const hasWriteAccess = canAccess(['principal', 'super_admin']);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  const [formOpen, setFormOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherRecord | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<TeacherRecord | null>(null);
  const [viewingTeacher, setViewingTeacher] = useState<TeacherRecord | null>(null);
  const [promotionOpen, setPromotionOpen] = useState(false);
  const [promotionTeacher, setPromotionTeacher] = useState<TeacherRecord | null>(null);
  const [activeTab, setActiveTab] = useState<'directory' | 'roles'>('directory');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

  // Fetch teachers list (server-side paginated/filtered)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['teachers', { search, statusFilter, page, pageSize }],
    queryFn: () =>
      teachersService.listTeachers({
        page,
        limit: pageSize,
        status: statusFilter || undefined,
        search: search || undefined,
      }),
    staleTime: 30_000,
  });

  const teachers = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination ?? { total: 0, total_pages: 1 };

  // KPIs derived from current query list or overall total count
  const stats = useMemo(() => {
    const total = Number(pagination.total ?? teachers.length);
    const active = teachers.filter((t: TeacherRecord) => t.status === 'active').length;
    const inactive = teachers.filter((t: TeacherRecord) => t.status === 'inactive').length;
    return { total, active, inactive };
  }, [teachers, pagination]);

  // Deactivate / Soft Delete handler
  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    try {
      const res = await teachersService.deactivateTeacher(deactivateTarget.id);
      if (res.success !== false) {
        showToast.success('Teacher deactivated');
        queryClient.invalidateQueries({ queryKey: ['teachers'] });
      } else {
        showToast.apiError(res.error);
      }
    } catch {
      showToast.error('Failed to deactivate teacher');
    }
    setDeactivateTarget(null);
  };

  // Status Update handler
  const handleUpdateStatus = async (teacher: TeacherRecord, newStatus: 'active' | 'suspended' | 'dismissed' | 'inactive') => {
    try {
      const res = await teachersService.updateTeacher(teacher.id, {
        first_name: teacher.first_name,
        last_name: teacher.last_name,
        status: newStatus,
      });
      if (res.success !== false) {
        showToast.success(`Teacher status updated to ${newStatus}`);
        queryClient.invalidateQueries({ queryKey: ['teachers'] });
      } else {
        showToast.apiError(res.error);
      }
    } catch {
      showToast.error('Failed to update teacher status');
    }
  };

  // Table columns definition
  const columns: ColumnDef<TeacherRecord, any>[] = [
    {
      id: 'avatar',
      header: '',
      size: 50,
      cell: ({ row }) => (
        <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center">
          <button
            onClick={() => setViewingTeacher(row.original)}
            className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-950/20 overflow-hidden border border-blue-100 dark:border-blue-900/30 hover:scale-105 transition-transform p-0 block"
            title="Click to view profile"
          >
            {row.original.photo_url && row.original.photo_url.length > 10 ? (
              <img src={row.original.photo_url} alt="" className="w-full h-full object-cover rounded-full" />
            ) : (
              <span className="w-full h-full flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-400">
                {row.original.first_name?.[0]}{row.original.last_name?.[0]}
              </span>
            )}
          </button>
        </div>
      ),
    },
    {
      id: 'teacher_id',
      accessorKey: 'teacher_id',
      header: 'Staff ID',
      cell: ({ row }) => (
        <span className="font-mono text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
          {row.original.teacher_id}
        </span>
      ),
    },
    {
      id: 'name',
      header: 'Full Name',
      cell: ({ row }) => (
        <div className="flex flex-col items-start text-left min-w-[150px]">
          <button
            onClick={() => setViewingTeacher(row.original)}
            className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left hover:underline focus:outline-none"
            title="Click to view profile"
          >
            {row.original.first_name} {row.original.last_name}
          </button>
          <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 block">
            {row.original.email}
          </span>
        </div>
      ),
    },
    {
      id: 'specialization',
      accessorKey: 'specialization',
      header: 'Specialization',
      cell: ({ row }) => (
        <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
          {row.original.specialization || '—'}
        </span>
      ),
    },
    {
      id: 'created_at',
      accessorKey: 'created_at',
      header: 'Date Joined',
      cell: ({ row }) => (
        <span className="text-xs text-gray-600 dark:text-gray-400">
          {row.original.created_at ? new Date(row.original.created_at).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }) : '—'}
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

  const rolesColumns: ColumnDef<TeacherRecord, any>[] = useMemo(() => [
    {
      accessorKey: 'name',
      header: 'Teacher',
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs border border-blue-100 dark:border-blue-900/30 overflow-hidden flex-shrink-0">
              {r.photo_url && r.photo_url.length > 10 ? (
                <img src={r.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                `${r.first_name?.[0] || ''}${r.last_name?.[0] || ''}`
              )}
            </div>
            <div>
              <button
                onClick={() => setViewingTeacher(r)}
                className="text-xs font-bold text-gray-900 dark:text-white hover:underline text-left"
              >
                {r.first_name} {r.last_name}
              </button>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono mt-0.5">{r.teacher_id}</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'designation',
      header: 'Designation / Role',
      cell: ({ row }) => {
        const val = row.original.designation;
        const mappings: Record<string, string> = {
          subject_teacher: 'Subject Teacher',
          form_teacher: 'Form Teacher',
          hod: 'Head of Department (HOD)',
          senior_teacher: 'Senior Teacher',
          vice_principal: 'Vice Principal',
          principal: 'Principal',
        };
        const text = mappings[val || ''] || val || 'Subject Teacher';
        return <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{text}</span>;
      },
    },
    {
      accessorKey: 'form_class_name',
      header: 'Form Class',
      cell: ({ row }) => {
        const r = row.original;
        if (r.form_class_name) {
          return (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border border-indigo-200/30">
              Form Teacher: {r.form_class_name}
            </span>
          );
        }
        return <span className="text-xs text-gray-400 dark:text-gray-500">Not Assigned</span>;
      },
    },
    {
      accessorKey: 'department',
      header: 'Department',
      cell: ({ row }) => {
        const val = row.original.department;
        if (!val || val === 'none') {
          return <span className="text-xs text-gray-400 dark:text-gray-500">—</span>;
        }
        const mappings: Record<string, string> = {
          mathematics_sciences: 'Maths & Sciences',
          languages: 'Languages & Linguistics',
          social_sciences_humanities: 'Humanities & Social',
          commercial_technical: 'Commercial & Tech',
        };
        return <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{mappings[val] || val}</span>;
      },
    },
    {
      accessorKey: 'employment_type',
      header: 'Employment Status',
      cell: ({ row }) => {
        const val = row.original.employment_type;
        const mappings: Record<string, string> = {
          full_time: 'Full-Time',
          part_time: 'Part-Time',
          volunteer: 'Community / Volunteer',
          contract: 'Contract',
        };
        const text = mappings[val || ''] || val || 'Full-Time';
        const isVolunteer = val === 'volunteer';
        return (
          <span className={`inline-flex items-center text-xs font-semibold ${isVolunteer ? 'text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'}`}>
            {text}
          </span>
        );
      },
    },
  ], []);

  return (
    <MainLayout>
      <PageShell
        title="Teachers Directory"
        subtitle="Manage school teachers, class assignments, and qualifications"
        breadcrumbs={[{ label: 'Teachers' }]}
        onRefresh={() => refetch()}
        isRefreshing={isLoading}
        actions={
          <div className="flex items-center gap-2 sm:gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-gray-100 dark:bg-gray-700 text-primary-600 dark:text-primary-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                title="Grid View"
              >
                <LayoutGrid size={18} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-md transition-all ${viewMode === 'table' ? 'bg-gray-100 dark:bg-gray-700 text-primary-600 dark:text-primary-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                title="Table View"
              >
                <List size={18} />
              </button>
            </div>

            <RoleGuard roles={['principal', 'super_admin']}>
              <ExportButton endpoint="/api/v1/teachers/export" filename="teachers" />
            </RoleGuard>

            <RoleGuard roles={['principal', 'super_admin']}>
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  setEditingTeacher(null);
                  setFormOpen(true);
                }}
                className="whitespace-nowrap shadow-sm"
              >
                + Add Teacher
              </Button>
            </RoleGuard>
          </div>
        }
      >
        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
          {isLoading && !data ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <KPICard
                title="Total Teachers"
                value={stats.total}
                icon={
                  <div className="p-2 rounded-xl bg-blue-500 text-white shadow-sm flex items-center justify-center">
                    <Users size={20} />
                  </div>
                }
                color="blue"
              />
              <KPICard
                title="Active"
                value={stats.active}
                icon={
                  <div className="p-2 rounded-xl bg-green-500 text-white shadow-sm flex items-center justify-center">
                    <UserCheck size={20} />
                  </div>
                }
                color="green"
              />
              <KPICard
                title="Inactive"
                value={stats.inactive}
                icon={
                  <div className="p-2 rounded-xl bg-red-500 text-white shadow-sm flex items-center justify-center">
                    <UserX size={20} />
                  </div>
                }
                color="red"
              />
            </>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 mb-6 gap-1">
          <button
            onClick={() => setActiveTab('directory')}
            className={`flex-1 sm:flex-none text-center px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all duration-200 ${
              activeTab === 'directory'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Teacher Directory
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`flex-1 sm:flex-none text-center px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all duration-200 ${
              activeTab === 'roles'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Manage Teachers
          </button>
        </div>

        {activeTab === 'directory' ? (
          <>
            {/* Search Bar & Filters Panel */}
            <div className="flex flex-col gap-3 sm:gap-4 mb-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <SearchBar
                  placeholder="Search name or email..."
                  onSearch={setSearch}
                  isLoading={isLoading}
                  resultCount={search ? teachers.length : undefined}
                  className="w-full lg:max-w-md"
                />

                <div className="relative w-full md:w-40">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full appearance-none pl-3 pr-8 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                    <option value="dismissed">Dismissed</option>
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400"
                  />
                </div>
              </div>

              {(search || statusFilter) && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-450 dark:text-gray-500 flex items-center gap-1 mr-1">
                    <SlidersHorizontal size={10} /> Filters:
                  </span>
                  {search && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-50 dark:bg-primary-950/20 text-primary-700 dark:text-primary-400 text-xs font-semibold border border-primary-200/30">
                      "{search}"{' '}
                      <button onClick={() => setSearch('')}>
                        <X size={12} />
                      </button>
                    </span>
                  )}
                  {statusFilter && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:bg-emerald-400 text-xs font-semibold border border-emerald-200/30">
                      {statusFilter}{' '}
                      <button onClick={() => setStatusFilter('')}>
                        <X size={12} />
                      </button>
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setSearch('');
                      setStatusFilter('');
                    }}
                    className="text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 font-bold ml-auto"
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>

            {/* Directory Content: Grid or Table View */}
            {viewMode === 'grid' ? (
              isLoading && !data ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </div>
              ) : teachers.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 bg-transparent text-center">
                  <Users size={48} className="text-gray-400 dark:text-gray-500 mb-4" />
                  <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">No teachers found</p>
                  <p className="text-sm text-gray-500 mt-1 mb-4">Try adjusting your filters or search query.</p>
                  {hasWriteAccess && (
                    <Button onClick={() => { setEditingTeacher(null); setFormOpen(true); }}>Add your first teacher</Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {teachers.map((teacher: TeacherRecord) => (
                    <TeacherCard
                      key={teacher.id}
                      teacher={teacher}
                      onView={setViewingTeacher}
                      onEdit={(t) => { setEditingTeacher(t); setFormOpen(true); }}
                      onPromote={(t) => { setPromotionTeacher(t); setPromotionOpen(true); }}
                      onDeactivate={setDeactivateTarget}
                      hasWriteAccess={hasWriteAccess}
                    />
                  ))}
                </div>
              )
            ) : (
              <DataTable
                columns={columns}
                data={teachers}
                isLoading={isLoading}
                error={error ? String(error) : null}
                onRetry={refetch}
                paginationMode="server"
                pageIndex={page}
                pageSize={pageSize}
                totalRows={Number(pagination.total)}
                onPageChange={setPage}
                emptyMessage="No teachers found"
                emptyAction={{
                  label: 'Add your first teacher',
                  onClick: () => {
                    setEditingTeacher(null);
                    setFormOpen(true);
                  },
                }}
                rowActions={(row) => [
                  {
                    label: 'View Details',
                    onClick: (r: TeacherRecord) => setViewingTeacher(r),
                  },
                  ...(hasWriteAccess
                    ? [
                        {
                          label: 'Edit Details',
                          onClick: (r: TeacherRecord) => {
                            setEditingTeacher(r);
                            setFormOpen(true);
                          },
                        },
                        ...(row.status === 'active'
                          ? [
                              {
                                label: 'Suspend Account',
                                onClick: (r: TeacherRecord) => handleUpdateStatus(r, 'suspended'),
                              },
                              {
                                label: 'Dismiss Teacher',
                                variant: 'destructive' as const,
                                onClick: (r: TeacherRecord) => handleUpdateStatus(r, 'dismissed'),
                              },
                              {
                                label: 'Deactivate Account',
                                variant: 'destructive' as const,
                                onClick: (r: TeacherRecord) => setDeactivateTarget(r),
                              },
                            ]
                          : [
                              {
                                label: 'Approve & Reactivate',
                                onClick: (r: TeacherRecord) => handleUpdateStatus(r, 'active'),
                              },
                            ]),
                      ]
                    : []),
                ]}
              />
            )}
          </>
        ) : (
          <>
            {/* Roles Search Panel */}
            <div className="flex flex-col gap-3 sm:gap-4 mb-6">
              <SearchBar
                placeholder="Filter teachers by name or Staff ID..."
                onSearch={setSearch}
                isLoading={isLoading}
                resultCount={search ? teachers.length : undefined}
                className="w-full lg:max-w-md"
              />
            </div>

            {/* Manage Teachers Content: Grid or Table View */}
            {viewMode === 'grid' ? (
              isLoading && !data ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </div>
              ) : teachers.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 bg-transparent text-center">
                  <Users size={48} className="text-gray-400 dark:text-gray-500 mb-4" />
                  <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">No teachers found</p>
                  <p className="text-sm text-gray-500 mt-1">Try adjusting your search query.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {teachers.map((teacher: TeacherRecord) => {
                    const designationMap: Record<string, string> = {
                      subject_teacher: 'Subject Teacher',
                      form_teacher: 'Form Teacher',
                      hod: 'Head of Department (HOD)',
                      senior_teacher: 'Senior Teacher',
                      vice_principal: 'Vice Principal',
                      principal: 'Principal',
                    };
                    const deptMap: Record<string, string> = {
                      none: 'No Department',
                      mathematics_sciences: 'Mathematics & Sciences',
                      languages_linguistics: 'Languages & Linguistics',
                      humanities_social_sciences: 'Humanities & Social Sciences',
                      commercial_technical: 'Commercial & Technical Studies',
                    };
                    const empMap: Record<string, string> = {
                      full_time: 'Full-Time',
                      part_time: 'Part-Time',
                      volunteer: 'Volunteer',
                      contract: 'Contract',
                    };
                    const designation = designationMap[teacher.designation || ''] || 'Subject Teacher';
                    const dept = deptMap[teacher.department || ''] || teacher.department || 'No Department';
                    const emp = empMap[teacher.employment_type || ''] || teacher.employment_type || 'Full-Time';

                    return (
                      <div
                        key={teacher.id}
                        className="group bg-white dark:bg-gray-800 border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between h-full"
                      >
                        <div>
                          {/* Header */}
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm border border-blue-100 dark:border-blue-900/30 overflow-hidden flex-shrink-0">
                              {teacher.photo_url && teacher.photo_url.length > 10 ? (
                                <img src={teacher.photo_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                `${teacher.first_name?.[0] || ''}${teacher.last_name?.[0] || ''}`
                              )}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-bold text-gray-900 dark:text-white text-sm truncate">
                                {teacher.first_name} {teacher.last_name}
                              </h3>
                              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">{teacher.teacher_id}</p>
                            </div>
                          </div>

                          {/* Role Details */}
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Designation</span>
                              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{designation}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Department</span>
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{dept}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Employment</span>
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{emp}</span>
                            </div>
                            {teacher.form_class_name && (
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Form Class</span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border border-indigo-200/30">
                                  <BookOpen size={10} /> {teacher.form_class_name}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-4 pt-3 border-t border-gray-150 dark:border-gray-700/50 flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewingTeacher(teacher)}
                            className="flex-1 flex items-center justify-center gap-1 text-xs py-1"
                          >
                            <Eye size={12} /> View
                          </Button>
                          {hasWriteAccess && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setPromotionTeacher(teacher);
                                setPromotionOpen(true);
                              }}
                              className="flex-1 flex items-center justify-center gap-1 text-xs py-1"
                            >
                              <Award size={12} className="text-amber-500" /> Promote
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              <DataTable
                columns={rolesColumns}
                data={teachers}
                isLoading={isLoading}
                error={error ? String(error) : null}
                onRetry={refetch}
                paginationMode="server"
                pageIndex={page}
                pageSize={pageSize}
                totalRows={Number(pagination.total)}
                onPageChange={setPage}
                emptyMessage="No teachers found"
                rowActions={(row) => [
                  ...(hasWriteAccess
                    ? [
                        {
                          label: 'Promote / Change Role',
                          onClick: (r: TeacherRecord) => {
                            setPromotionTeacher(r);
                            setPromotionOpen(true);
                          },
                        },
                      ]
                    : []),
                  {
                    label: 'View Full Profile',
                    onClick: (r: TeacherRecord) => setViewingTeacher(r),
                  },
                ]}
              />
            )}
          </>
        )}
      </PageShell>

      {/* Teacher Form Modal */}
      <TeacherFormModal
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingTeacher(null);
        }}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['teachers'] })}
        editingTeacher={editingTeacher}
      />

      {/* Teacher Details Modal */}
      <TeacherDetailModal
        isOpen={!!viewingTeacher}
        onClose={() => setViewingTeacher(null)}
        teacher={viewingTeacher}
        onEdit={hasWriteAccess ? (t) => {
          setEditingTeacher(t);
          setFormOpen(true);
        } : undefined}
        onStatusChange={hasWriteAccess ? handleUpdateStatus : undefined}
      />

      {/* Teacher Promotion Modal */}
      <TeacherPromotionModal
        isOpen={promotionOpen}
        onClose={() => {
          setPromotionOpen(false);
          setPromotionTeacher(null);
        }}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['teachers'] })}
        teacher={promotionTeacher}
      />

      {/* Deactivation Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivate}
        title="Deactivate Teacher"
        message={`Are you sure you want to deactivate ${deactivateTarget?.first_name} ${deactivateTarget?.last_name}? They will no longer be able to log in.`}
        confirmLabel="Deactivate Account"
      />
    </MainLayout>
  );
};

export default TeachersPage;
