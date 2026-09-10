/**
 * SubjectsPage — /academic/subjects
 * Full CRUD for school subjects and curriculum.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { BookOpen, Layers, ToggleRight, CheckCircle, LayoutGrid, List, Edit, Trash2, X, ChevronDown, ChevronRight, SlidersHorizontal, Check, Power } from 'lucide-react';
import { SearchBar } from '@components/admin/table/SearchBar';
import MainLayout from '@components/layout/MainLayout';
import { cardTint } from '@lib/cardTint';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { DataTable } from '@components/admin/table/DataTable';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { SkeletonCard } from '@components/admin/feedback/Skeleton';
import { RoleGuard } from '@components/admin/common/RoleGuard';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { subjectsService, SubjectRecord } from '@services/subjectsService';
import { SubjectFormModal } from './components/SubjectFormModal';

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  core: 'Core',
  science: 'Science',
  arts: 'Arts / Humanities',
  commercial: 'Commercial',
  technical: 'Technical',
};

const CATEGORY_COLORS: Record<string, string> = {
  core: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/30',
  science: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/30',
  arts: 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/30',
  commercial: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/30',
  technical: 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800/30',
};

const LEVEL_LABELS: Record<string, string> = {
  all: 'All Levels',
  nursery: 'Nursery',
  primary: 'Primary',
  jss: 'JSS',
  sss: 'SSS',
  technical: 'Technical / Voc',
};

const FILTER_CATEGORIES = [
  { key: 'core', label: 'Core', icon: '📖' },
  { key: 'science', label: 'Science', icon: '🔬' },
  { key: 'arts', label: 'Arts', icon: '📜' },
  { key: 'commercial', label: 'Commercial', icon: '💼' },
  { key: 'technical', label: 'Technical', icon: '🔧' },
];

// ── Category Filter Popover ───────────────────────────────────────────────────

interface CategoryFilterPopoverProps {
  value: string;
  onChange: (val: string) => void;
}

const CategoryFilterPopover: React.FC<CategoryFilterPopoverProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
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

  const handleSelect = (cat: string) => {
    onChange(cat);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
  };

  const displayLabel = value ? (CATEGORY_LABELS[value] || value) : 'All Categories';

  return (
    <div ref={popoverRef} className="relative flex-1 sm:flex-initial">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full sm:w-auto flex items-center justify-between gap-2 pl-3 pr-2.5 py-2.5 sm:py-2 border rounded-lg text-sm font-medium transition-all cursor-pointer min-w-0 ${
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20 bg-white dark:bg-gray-800'
            : value
              ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400'
              : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
        }`}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown size={14} className={`flex-shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-1.5 z-50 w-[260px] sm:w-[280px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Header */}
          <div className="px-3.5 py-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Filter by Category
            </span>
            {value && (
              <button
                onClick={handleClear}
                className="text-[11px] font-semibold text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {/* Content */}
          <div className="p-2.5">
            <div className="flex flex-col gap-1.5">
              {FILTER_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => handleSelect(cat.key)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-all text-left ${
                    value === cat.key
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                      : 'border-transparent hover:border-blue-200 dark:hover:border-blue-800 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  {value === cat.key && <Check size={14} className="text-blue-500 flex-shrink-0" />}
                  <span className="text-lg">{cat.icon}</span>
                  <span className={`text-sm font-bold ${value === cat.key ? 'text-blue-700 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'}`}>
                    {cat.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

export const SubjectsPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Filter state
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  // View state: table (default) or grid
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

  // Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<SubjectRecord | null>(null);
  const [statusToggleTarget, setStatusToggleTarget] = useState<SubjectRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SubjectRecord | null>(null);

  // Fetch subjects
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['subjects', { search, categoryFilter, statusFilter, page, pageSize }],
    queryFn: () => subjectsService.listSubjects({
      page,
      limit: pageSize,
      category: categoryFilter.length === 1 ? categoryFilter[0] : undefined,
      status: statusFilter.length === 1 ? statusFilter[0] : undefined,
      search: search || undefined,
    }),
    staleTime: 30_000,
  });

  const subjects: SubjectRecord[] = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination ?? { total: 0, total_pages: 1 };

  // KPI calculations
  const stats = useMemo(() => {
    const total = Number(pagination.total ?? subjects.length);
    const core = subjects.filter((s) => s.category === 'core').length;
    const elective = subjects.filter((s) => s.is_elective).length;
    const active = subjects.filter((s) => s.status === 'active').length;
    return { total, core, elective, active };
  }, [subjects, pagination]);

  // Activate / Deactivate handler
  const handleToggleStatus = async () => {
    if (!statusToggleTarget) return;
    const isActivating = statusToggleTarget.status === 'inactive';
    const res = isActivating
      ? await subjectsService.activateSubject(statusToggleTarget.id)
      : await subjectsService.deactivateSubject(statusToggleTarget.id);

    if (res.success !== false) {
      showToast.success(`Subject ${isActivating ? 'activated' : 'deactivated'} successfully`);
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    } else {
      showToast.apiError(res.error);
    }
    setStatusToggleTarget(null);
  };

  // Permanent delete handler
  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await subjectsService.deleteSubject(deleteTarget.id);
    if (res.success !== false) {
      showToast.deleted('Subject');
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    } else {
      showToast.apiError(res.error);
    }
    setDeleteTarget(null);
  };

  // Column definitions
  const columns: ColumnDef<SubjectRecord, any>[] = [
    {
      id: 'code',
      accessorKey: 'code',
      header: 'Code',
      cell: ({ row }) => (
        <span className="font-mono text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
          {row.original.code}
        </span>
      ),
    },
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Subject Name',
      cell: ({ row }) => (
        <span className="font-medium text-gray-900 dark:text-white">{row.original.name}</span>
      ),
    },
    {
      id: 'category',
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => {
        const cat = row.original.category;
        if (!cat) return <span className="text-gray-400 dark:text-gray-500">—</span>;
        return (
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${CATEGORY_COLORS[cat] || ''}`}>
            {CATEGORY_LABELS[cat] || cat}
          </span>
        );
      },
    },
    {
      id: 'level',
      accessorKey: 'level',
      header: 'Applicable Level(s)',
      cell: ({ row }) => {
        const rawLevel = row.original.level;
        if (!rawLevel || rawLevel === 'all') {
          return (
            <span className="text-[11px] font-bold bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
              All Levels
            </span>
          );
        }
        const levels = rawLevel.split(',').map((l) => l.trim().toLowerCase());
        return (
          <div className="flex flex-wrap gap-1">
            {levels.map((lvl) => (
              <span
                key={lvl}
                className="text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800 uppercase"
              >
                {LEVEL_LABELS[lvl] || lvl}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      id: 'department',
      accessorKey: 'department',
      header: 'Department',
      cell: ({ row }) => row.original.department || <span className="text-gray-400 dark:text-gray-500">—</span>,
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
        title="Subjects"
        subtitle="Manage school subjects and curriculum"
        breadcrumbs={[{ label: 'Subjects' }]}
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
              <Button variant="default" size="sm" onClick={() => { setEditingSubject(null); setFormOpen(true); }} className="whitespace-nowrap shadow-sm hover:shadow">
                + Add Subject
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
              <KPICard title="Total Subjects" value={stats.total} icon={<div className="p-2 rounded-xl bg-blue-500 text-white shadow-sm flex items-center justify-center"><BookOpen size={20} /></div>} color="blue" />
              <KPICard title="Core Subjects" value={stats.core} icon={<div className="p-2 rounded-xl bg-green-500 text-white shadow-sm flex items-center justify-center"><Layers size={20} /></div>} color="green" />
              <KPICard title="Elective Subjects" value={stats.elective} icon={<div className="p-2 rounded-xl bg-purple-500 text-white shadow-sm flex items-center justify-center"><ToggleRight size={20} /></div>} color="purple" />
              <KPICard title="Active Subjects" value={stats.active} icon={<div className="p-2 rounded-xl bg-emerald-500 text-white shadow-sm flex items-center justify-center"><CheckCircle size={20} /></div>} color="green" />
            </>
          )}
        </div>

        {/* ── Search & Filter Action Bar ── */}
        <div className="flex flex-col gap-3 sm:gap-4 mb-6 transition-all duration-300">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Bar — shared component */}
            <SearchBar
              placeholder="Search subject name or code..."
              onSearch={setSearch}
              isLoading={isLoading}
              resultCount={search ? classes.length : undefined}
              className="w-full lg:max-w-md"
            />

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2 sm:gap-2.5 w-full lg:w-auto">
              {/* Category Filter — popover */}
              <CategoryFilterPopover
                value={categoryFilter[0] || ''}
                onChange={(val) => setCategoryFilter(val ? [val] : [])}
              />

              {/* Status Select */}
              <div className="relative flex-1 sm:flex-initial sm:min-w-[140px]">
                <select
                  value={statusFilter[0] || ''}
                  onChange={(e) => setStatusFilter(e.target.value ? [e.target.value] : [])}
                  className="w-full appearance-none pl-3 pr-8 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-all"
                >
                  <option value="">All Statuses</option>
                  <option value="active" className="bg-white dark:bg-gray-800">Active</option>
                  <option value="inactive" className="bg-white dark:bg-gray-800">Inactive</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500">
                  <ChevronDown size={14} />
                </div>
              </div>
            </div>
          </div>

          {/* Active Filter Badges */}
          {(categoryFilter.length > 0 || statusFilter.length > 0 || search) && (
            <div className="flex flex-wrap items-center gap-2 pt-1 mt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-450 dark:text-gray-500 flex items-center gap-1 mr-1">
                <SlidersHorizontal size={10} />
                Active Filters:
              </span>

              {search && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-50 dark:bg-primary-950/20 text-primary-700 dark:text-primary-400 text-xs font-semibold border border-primary-200/30">
                  Query: &ldquo;{search}&rdquo;
                  <button onClick={() => setSearch('')} className="hover:text-primary-900 dark:hover:text-primary-200">
                    <X size={12} />
                  </button>
                </span>
              )}

              {categoryFilter.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 text-xs font-semibold border border-blue-200/30">
                  Category: {CATEGORY_LABELS[c] || c}
                  <button onClick={() => setCategoryFilter([])} className="hover:text-blue-900 dark:hover:text-blue-200">
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
                  setCategoryFilter([]);
                  setStatusFilter([]);
                }}
                className="text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 font-bold ml-auto transition-colors"
              >
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* Subjects Content: Grid or Table View */}
        {viewMode === 'grid' ? (
          isLoading && !data ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : subjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-transparent dark:bg-transparent text-center">
              <BookOpen size={48} className="text-gray-400 dark:text-gray-500 mb-4" />
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">No subjects found</p>
              <p className="text-sm text-gray-500 mt-1 mb-4">Try adjusting your filters or search query.</p>
              <Button onClick={() => { setEditingSubject(null); setFormOpen(true); }}>Add your first subject</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {subjects.map((subj, idx) => {
                const cat = subj.category || 'core';
                const catColor = CATEGORY_COLORS[cat] || CATEGORY_COLORS.core;

                return (
                  <div
                    key={subj.id}
                    className={`group relative overflow-hidden ${cardTint(idx)} sm:bg-white sm:dark:bg-gray-800 sm:border-gray-200/60 sm:dark:border-gray-700/60 border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1`}
                  >
                    {/* Header: Subject Name and Code Badge */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-snug group-hover:text-primary dark:group-hover:text-primary transition-colors truncate">
                          {subj.name}
                        </h3>
                        {subj.department && (
                          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                            {subj.department}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 uppercase tracking-wide flex-shrink-0 ml-2">
                        {subj.code}
                      </span>
                    </div>

                    {/* Category & Level badges */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${catColor}`}>
                        {CATEGORY_LABELS[cat] || cat}
                      </span>
                      {subj.level && subj.level !== 'all' ? (
                        subj.level.split(',').map((lvl) => (
                          <span
                            key={lvl.trim()}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md border bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 uppercase"
                          >
                            {LEVEL_LABELS[lvl.trim().toLowerCase()] || lvl}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700">
                          All Levels
                        </span>
                      )}
                      {subj.is_elective && (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/30">
                          Elective
                        </span>
                      )}
                    </div>

                    {/* Marks Info */}
                    <div className="grid grid-cols-3 gap-2 text-center border-t border-gray-100 dark:border-gray-700/50 pt-3 mb-4">
                      <div>
                        <span className="block text-xs text-gray-400 dark:text-gray-500">Max</span>
                        <span className="block text-sm font-bold text-gray-800 dark:text-gray-200">{subj.max_marks}</span>
                      </div>
                      <div>
                        <span className="block text-xs text-gray-400 dark:text-gray-500">Pass</span>
                        <span className="block text-sm font-bold text-gray-800 dark:text-gray-200">{subj.pass_marks}</span>
                      </div>
                      <div>
                        <span className="block text-xs text-gray-400 dark:text-gray-500">Credits</span>
                        <span className="block text-sm font-bold text-gray-800 dark:text-gray-200">{subj.credit_points}</span>
                      </div>
                    </div>

                    {/* Card footer actions */}
                    <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700/50 pt-3">
                      {subj.status === 'inactive' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                          Inactive
                        </span>
                      )}
                      <div className="flex items-center gap-2 ml-auto">
                        <RoleGuard roles={['principal', 'super_admin']}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setEditingSubject(subj); setFormOpen(true); }}
                            className="h-8 p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                            title="Edit Subject"
                          >
                            <Edit size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setStatusToggleTarget(subj)}
                            className={`h-8 p-2 rounded-lg transition-colors ${
                              subj.status === 'inactive'
                                ? 'text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20'
                                : 'text-red-500 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20'
                            }`}
                            title={subj.status === 'inactive' ? 'Activate Subject' : 'Deactivate Subject'}
                          >
                            {subj.status === 'inactive' ? <CheckCircle size={16} /> : <Power size={16} />}
                          </Button>
                        </RoleGuard>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )

        ) : (
          <DataTable
            columns={columns}
            data={subjects}
            isLoading={isLoading}
            error={error ? String(error) : null}
            onRetry={refetch}
            paginationMode="server"
            pageIndex={page}
            pageSize={pageSize}
            totalRows={Number(pagination.total)}
            onPageChange={setPage}
            emptyMessage="No subjects found"
            emptyAction={{ label: 'Add your first subject', onClick: () => { setEditingSubject(null); setFormOpen(true); } }}
            rowActions={(subj) => [
              {
                label: 'Edit',
                onClick: (row) => { setEditingSubject(row); setFormOpen(true); },
              },
              {
                label: subj.status === 'inactive' ? 'Activate' : 'Deactivate',
                variant: subj.status === 'inactive' ? 'default' : 'destructive',
                onClick: (row) => setStatusToggleTarget(row),
              },
              {
                label: 'Delete',
                variant: 'destructive',
                onClick: (row) => setDeleteTarget(row),
              },
            ]}
          />
        )}
      </PageShell>

      {/* Add / Edit Modal */}
      <SubjectFormModal
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditingSubject(null); }}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['subjects'] })}
        editingSubject={editingSubject}
      />

      {/* Activate / Deactivate Confirmation */}
      <ConfirmationDialog
        isOpen={!!statusToggleTarget}
        onClose={() => setStatusToggleTarget(null)}
        onConfirm={handleToggleStatus}
        title={statusToggleTarget?.status === 'inactive' ? 'Activate Subject' : 'Deactivate Subject'}
        message={
          statusToggleTarget?.status === 'inactive'
            ? `Are you sure you want to activate "${statusToggleTarget?.name}"? It will become available across the school portal.`
            : `Are you sure you want to deactivate "${statusToggleTarget?.name}"? This will hide the subject from active listings.`
        }
        confirmLabel={statusToggleTarget?.status === 'inactive' ? 'Activate' : 'Deactivate'}
      />

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Subject Permanently"
        message={`Are you sure you want to permanently delete "${deleteTarget?.name}"? This cannot be undone. Subjects with grade records cannot be deleted.`}
        confirmLabel="Delete Permanently"
      />
    </MainLayout>
  );
};

export default SubjectsPage;
