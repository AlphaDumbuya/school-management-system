/**
 * ClassesPage — /academic/classes
 * Full CRUD for school classes and streams.
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { BookOpen, Users, BarChart2, Percent, LayoutGrid, List, MapPin, Building2, Edit, Trash2, Search, X, ChevronDown, SlidersHorizontal } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { DataTable } from '@components/admin/table/DataTable';
import { BulkToolbar } from '@components/admin/table/BulkToolbar';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { ProgressBar } from '@components/admin/feedback/ProgressBar';
import { SkeletonCard } from '@components/admin/feedback/Skeleton';
import { RoleGuard } from '@components/admin/common/RoleGuard';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { classesService, ClassRecord } from '@services/classesService';
import { ClassFormModal } from './components/ClassFormModal';
import { ClassStudentsModal } from './components/ClassStudentsModal';

// ── Constants ─────────────────────────────────────────────────────────────────

const LEVELS = [
  'NURSERY1', 'NURSERY2', 'NURSERY3',
  'CLASS1', 'CLASS2', 'CLASS3', 'CLASS4', 'CLASS5', 'CLASS6',
  'JSS1', 'JSS2', 'JSS3',
  'SSS1', 'SSS2', 'SSS3'
];

const LEVEL_NAMES: Record<string, string> = {
  NURSERY1: 'Nursery 1',
  NURSERY2: 'Nursery 2',
  NURSERY3: 'Nursery 3',
  CLASS1: 'Class 1',
  CLASS2: 'Class 2',
  CLASS3: 'Class 3',
  CLASS4: 'Class 4',
  CLASS5: 'Class 5',
  CLASS6: 'Class 6',
  JSS1: 'JSS 1',
  JSS2: 'JSS 2',
  JSS3: 'JSS 3',
  SSS1: 'SSS 1',
  SSS2: 'SSS 2',
  SSS3: 'SSS 3',
};

function formatLevel(lvl: string): string {
  return LEVEL_NAMES[lvl] || lvl;
}

function capacityColor(pct: number): 'green' | 'amber' | 'red' {
  if (pct >= 90) return 'red';
  if (pct >= 75) return 'amber';
  return 'green';
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ClassesPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Filter state
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  // View state: grid (default) or table
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassRecord | null>(null);
  const [studentsModal, setStudentsModal] = useState<{ open: boolean; classId: number | null; className?: string }>({
    open: false, classId: null,
  });
  const [deactivateTarget, setDeactivateTarget] = useState<ClassRecord | null>(null);
  const [selectedRows, setSelectedRows] = useState<ClassRecord[]>([]);

  // Fetch classes
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['classes', { search, levelFilter, statusFilter, page, pageSize }],
    queryFn: () => classesService.listClasses({
      page,
      limit: pageSize,
      level: levelFilter.length === 1 ? levelFilter[0] : undefined,
      search: search || undefined,
    }),
    staleTime: 30_000,
  });

  const classes: ClassRecord[] = (data?.data as any)?.data ?? [];
  const pagination = (data?.data as any)?.pagination ?? { total: 0, total_pages: 1 };

  // KPI calculations
  const stats = useMemo(() => {
    const total = pagination.total ?? classes.length;
    const totalEnrolled = classes.reduce((s, c) => s + (c.enrolled_students ?? 0), 0);
    const avgSize = classes.length > 0
      ? Math.round(classes.reduce((s, c) => s + (c.enrolled_students ?? 0), 0) / classes.length)
      : 0;
    const avgCapPct = classes.length > 0
      ? Math.round(classes.reduce((s, c) => s + ((c.enrolled_students ?? 0) / c.capacity) * 100, 0) / classes.length)
      : 0;
    return { total, totalEnrolled, avgSize, avgCapPct };
  }, [classes, pagination]);

  // Deactivate handler
  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    const res = await classesService.deactivateClass(deactivateTarget.id);
    if (res.success !== false) {
      showToast.deleted('Class');
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    } else {
      showToast.apiError(res.error);
    }
    setDeactivateTarget(null);
  };

  // Column definitions
  const columns: ColumnDef<ClassRecord, any>[] = [
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Class Name',
      cell: ({ row }) => (
        <span className="font-medium text-gray-900 dark:text-white">{row.original.name}</span>
      ),
    },
    {
      id: 'level',
      accessorKey: 'level',
      header: 'Level',
      cell: ({ row }) => (
        <span className="text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2.5 py-0.5 rounded-full border border-gray-200 dark:border-gray-700">
          {formatLevel(row.original.level)}
        </span>
      ),
    },
    {
      id: 'section',
      accessorKey: 'section',
      header: 'Stream',
      cell: ({ row }) => row.original.section || <span className="text-gray-400 dark:text-gray-500">—</span>,
    },
    {
      id: 'room',
      accessorKey: 'room_number',
      header: 'Room',
      cell: ({ row }) => row.original.room_number || <span className="text-gray-400 dark:text-gray-500">—</span>,
    },
    {
      id: 'enrollment',
      header: 'Enrolled / Capacity',
      cell: ({ row }) => {
        const cls = row.original;
        const enrolled = cls.enrolled_students ?? 0;
        const pct = Math.min(100, Math.round((enrolled / cls.capacity) * 100));
        return (
          <div className="min-w-[140px]">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{enrolled} / {cls.capacity}</span>
              <span>{pct}%</span>
            </div>
            <ProgressBar
              value={pct}
              color={capacityColor(pct)}
              size="sm"
              showValue={false}
            />
          </div>
        );
      },
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} showDot />,
    },
  ];

  const filterValues = {
    level: levelFilter,
    status: statusFilter,
  };

  return (
    <MainLayout>
      <PageShell
        title="Classes & Streams"
        subtitle="Manage school classes, streams, and enrolment capacity"
        breadcrumbs={[{ label: 'Classes & Streams' }]}
        actions={
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap md:flex-nowrap justify-end">
            {/* View Mode Toggle */}
            <div className="flex items-center border border-gray-200 dark:border-gray-750 bg-white dark:bg-gray-800 rounded-lg p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-gray-100 dark:bg-gray-700 text-primary-600 dark:text-primary-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                title="Grid View"
              >
                <LayoutGrid size={18} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-gray-100 dark:bg-gray-700 text-primary-600 dark:text-primary-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                title="Table View"
              >
                <List size={18} />
              </button>
            </div>

            <RoleGuard roles={['principal', 'super_admin']}>
              <Button variant="default" size="sm" onClick={() => { setEditingClass(null); setFormOpen(true); }} className="flex items-center gap-1 shadow-sm hover:shadow">
                <span>+ Add <span className="hidden sm:inline">Class</span></span>
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
              <KPICard title="Total Classes" value={stats.total} icon={<div className="p-2 rounded-xl bg-blue-500 text-white shadow-sm flex items-center justify-center"><BookOpen size={20} /></div>} color="blue" />
              <KPICard title="Total Enrolled" value={stats.totalEnrolled} icon={<div className="p-2 rounded-xl bg-green-500 text-white shadow-sm flex items-center justify-center"><Users size={20} /></div>} color="green" />
              <KPICard title="Avg Class Size" value={stats.avgSize} icon={<div className="p-2 rounded-xl bg-purple-500 text-white shadow-sm flex items-center justify-center"><BarChart2 size={20} /></div>} color="purple" />
              <KPICard
                title="Avg Capacity Used"
                value={`${stats.avgCapPct}%`}
                icon={
                  <div className={`p-2 rounded-xl text-white shadow-sm flex items-center justify-center ${
                    stats.avgCapPct >= 90 ? 'bg-red-500' : stats.avgCapPct >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}>
                    <Percent size={20} />
                  </div>
                }
                color={stats.avgCapPct >= 90 ? 'red' : stats.avgCapPct >= 75 ? 'amber' : 'green'}
              />
            </>
          )}
        </div>

        {/* ── Search & Filter Action Bar ── */}
        <div className="flex flex-col gap-4 mb-6 transition-all duration-300">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input Box */}
            <div className="relative flex-1 max-w-full md:max-w-md">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-550 pointer-events-none"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search class name, room, building..."
                className="w-full pl-9 pr-8 py-2 bg-transparent dark:bg-transparent border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {/* Level Select */}
              <div className="relative flex-1 sm:flex-initial sm:w-44">
                <select
                  value={levelFilter[0] || ''}
                  onChange={(e) => setLevelFilter(e.target.value ? [e.target.value] : [])}
                  className="w-full appearance-none pl-3 pr-8 py-2 bg-transparent dark:bg-transparent border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-all"
                >
                  <option value="">All Levels</option>
                  {LEVELS.map((l) => (
                    <option key={l} value={l} className="bg-white dark:bg-gray-800">
                      {LEVEL_NAMES[l] || l}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-550">
                  <ChevronDown size={14} />
                </div>
              </div>

              {/* Status Select */}
              <div className="relative flex-1 sm:flex-initial sm:w-40">
                <select
                  value={statusFilter[0] || ''}
                  onChange={(e) => setStatusFilter(e.target.value ? [e.target.value] : [])}
                  className="w-full appearance-none pl-3 pr-8 py-2 bg-transparent dark:bg-transparent border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-all"
                >
                  <option value="">All Statuses</option>
                  <option value="active" className="bg-white dark:bg-gray-800">Active</option>
                  <option value="inactive" className="bg-white dark:bg-gray-800">Inactive</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-550">
                  <ChevronDown size={14} />
                </div>
              </div>
            </div>
          </div>

          {/* Active Filter Badges */}
          {(levelFilter.length > 0 || statusFilter.length > 0 || search) && (
            <div className="flex flex-wrap items-center gap-2 pt-1 mt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-450 dark:text-gray-500 flex items-center gap-1 mr-1">
                <SlidersHorizontal size={10} />
                Active Filters:
              </span>

              {search && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-50 dark:bg-primary-950/20 text-primary-700 dark:text-primary-400 text-xs font-semibold border border-primary-200/30">
                  Query: "{search}"
                  <button onClick={() => setSearch('')} className="hover:text-primary-900 dark:hover:text-primary-200">
                    <X size={12} />
                  </button>
                </span>
              )}

              {levelFilter.map((l) => (
                <span key={l} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 text-xs font-semibold border border-blue-200/30">
                  Level: {LEVEL_NAMES[l] || l}
                  <button onClick={() => setLevelFilter([])} className="hover:text-blue-900 dark:hover:text-blue-200">
                    <X size={12} />
                  </button>
                </span>
              ))}

              {statusFilter.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold border border-emerald-200/30">
                  Status: {s === 'active' ? 'Active' : 'Inactive'}
                  <button onClick={() => setStatusFilter([])} className="hover:text-emerald-900 dark:hover:text-emerald-200">
                    <X size={12} />
                  </button>
                </span>
              ))}

              <button
                onClick={() => {
                  setSearch('');
                  setLevelFilter([]);
                  setStatusFilter([]);
                }}
                className="text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 font-bold ml-auto transition-colors"
              >
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* Bulk toolbar */}
        {selectedRows.length > 0 && (
          <RoleGuard roles={['principal', 'super_admin']}>
            <BulkToolbar
              selectedCount={selectedRows.length}
              onDeselectAll={() => setSelectedRows([])}
              actions={[
                {
                  label: 'Deactivate selected',
                  variant: 'destructive',
                  onClick: () => {
                    // Deactivate all selected one by one
                    Promise.all(selectedRows.map((c) => classesService.deactivateClass(c.id))).then(() => {
                      showToast.success(`${selectedRows.length} classes deactivated`);
                      queryClient.invalidateQueries({ queryKey: ['classes'] });
                      setSelectedRows([]);
                    });
                  },
                },
              ]}
            />
          </RoleGuard>
        )}

        {/* Classes Content: Grid or Table View */}
        {viewMode === 'grid' ? (
          isLoading && !data ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : classes.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-transparent dark:bg-transparent text-center">
              <BookOpen size={48} className="text-gray-400 dark:text-gray-500 mb-4" />
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">No classes found</p>
              <p className="text-sm text-gray-500 mt-1 mb-4">Try adjusting your filters or search query.</p>
              <Button onClick={() => { setEditingClass(null); setFormOpen(true); }}>Add your first class</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {classes.map((cls) => {
                const enrolled = cls.enrolled_students ?? 0;
                const pct = Math.min(100, Math.round((enrolled / cls.capacity) * 100));
                const capColor = capacityColor(pct);

                const colorMap = {
                  green: {
                    bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-450',
                    bar: 'bg-emerald-500'
                  },
                  amber: {
                    bg: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-450',
                    bar: 'bg-amber-500'
                  },
                  red: {
                    bg: 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-450',
                    bar: 'bg-red-500'
                  }
                };

                const themeColor = colorMap[capColor];

                return (
                  <div
                    key={cls.id}
                    className="group relative overflow-hidden bg-white dark:bg-gray-800 border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1"
                  >
                    {/* Header: Class Name and Level Badge */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-snug group-hover:text-primary dark:group-hover:text-primary transition-colors">
                          {cls.name}
                        </h3>
                        {cls.section && (
                          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Stream: {cls.section}
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/30 uppercase tracking-wide">
                        {formatLevel(cls.level)}
                      </span>
                    </div>

                    {/* Capacity Indicator & Progress */}
                    <div className="mb-5 space-y-2">
                      <div className="flex justify-between items-center text-xs font-semibold text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                          <Users size={14} className="text-gray-400 dark:text-gray-550" />
                          Enrolled
                        </span>
                        <span className="font-mono text-gray-800 dark:text-gray-100">
                          {enrolled} / <span className="text-gray-405 dark:text-gray-500">{cls.capacity}</span>
                        </span>
                      </div>

                      {/* Capacity Progress Bar */}
                      <div className="relative w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden border border-gray-200/20 shadow-inner">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${themeColor.bar}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between pt-0.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${themeColor.bg}`}>
                          {pct}% Filled
                        </span>
                        {cls.status === 'inactive' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                            Inactive
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Class Details: Room/Building */}
                    <div className="grid grid-cols-2 gap-3 text-xs font-semibold border-t border-gray-100 dark:border-gray-700/50 pt-3.5 mb-4 text-gray-600 dark:text-gray-350">
                      <div className="flex items-center gap-2 min-w-0">
                        <MapPin size={16} className="text-blue-500/80 dark:text-blue-400/95 flex-shrink-0" />
                        <span className="truncate" title={cls.room_number ? `Room ${cls.room_number}` : 'No Room'}>
                          {cls.room_number ? `Room ${cls.room_number}` : '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 size={16} className="text-indigo-500/80 dark:text-indigo-400/95 flex-shrink-0" />
                        <span className="truncate" title={cls.building || 'No Building'}>
                          {cls.building || '—'}
                        </span>
                      </div>
                    </div>

                    {/* Quick Hover Actions / Card footer */}
                    <div className="flex items-center justify-end gap-2 border-t border-gray-100 dark:border-gray-700/50 pt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setStudentsModal({ open: true, classId: cls.id, className: cls.name })}
                        className="h-8 text-xs font-bold px-2.5 rounded-lg text-primary hover:text-primary dark:text-primary hover:bg-primary-50 dark:hover:bg-primary-950/20"
                      >
                        Students
                      </Button>

                      <RoleGuard roles={['principal', 'super_admin']}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setEditingClass(cls); setFormOpen(true); }}
                          className="h-8 p-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-205 hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Edit Class"
                        >
                          <Edit size={16} className="text-gray-500 dark:text-gray-400 group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={cls.status === 'inactive'}
                          onClick={() => setDeactivateTarget(cls)}
                          className="h-8 p-1.5 rounded-lg text-red-500 hover:text-red-700 dark:text-red-405 hover:bg-red-50 dark:hover:bg-red-950/20 disabled:opacity-30"
                          title="Deactivate Class"
                        >
                          <Trash2 size={16} className="text-red-500 group-hover:text-red-600 dark:group-hover:text-red-450 transition-colors" />
                        </Button>
                      </RoleGuard>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <DataTable
            columns={columns}
            data={classes}
            isLoading={isLoading}
            error={error ? String(error) : null}
            onRetry={refetch}
            paginationMode="server"
            pageIndex={page}
            pageSize={pageSize}
            totalRows={pagination.total}
            onPageChange={setPage}
            enableRowSelection
            onSelectionChange={setSelectedRows}
            emptyMessage="No classes found"
            emptyAction={{ label: 'Add your first class', onClick: () => { setEditingClass(null); setFormOpen(true); } }}
            rowActions={(cls) => [
              {
                label: 'Edit',
                onClick: (row) => { setEditingClass(row); setFormOpen(true); },
              },
              {
                label: 'View Students',
                onClick: (row) => setStudentsModal({ open: true, classId: row.id, className: row.name }),
              },
              {
                label: 'Deactivate',
                variant: 'destructive',
                onClick: (row) => setDeactivateTarget(row),
              },
            ]}
          />
        )}
      </PageShell>

      {/* Add / Edit Modal */}
      <ClassFormModal
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditingClass(null); }}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['classes'] })}
        editingClass={editingClass}
      />

      {/* Students Modal */}
      <ClassStudentsModal
        isOpen={studentsModal.open}
        onClose={() => setStudentsModal({ open: false, classId: null })}
        classId={studentsModal.classId}
        className={studentsModal.className}
      />

      {/* Deactivate Confirmation */}
      <ConfirmationDialog
        isOpen={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivate}
        title="Deactivate Class"
        message={`Are you sure you want to deactivate "${deactivateTarget?.name}"? This will hide the class from active listings.`}
        confirmLabel="Deactivate"
      />
    </MainLayout>
  );
};

export default ClassesPage;
