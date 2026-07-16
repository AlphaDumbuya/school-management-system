/**
 * ExaminationsPage — /academic/examinations
 * Manage school examinations: internal (mid-term, end-of-term, mock) and external (NPSE, BECE, WASSCE).
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { FileText, Calendar, CheckCircle, Clock, Search, X, ChevronDown, SlidersHorizontal } from 'lucide-react';
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
import { examinationsService, ExaminationRecord, EXAM_TYPES, EXAM_TERMS, EXAM_STATUSES } from '@services/examinationsService';
import { ExaminationFormModal } from './components/ExaminationFormModal';
import { ExaminationDetailModal } from './components/ExaminationDetailModal';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const TYPE_LABELS: Record<string, string> = Object.fromEntries(EXAM_TYPES.map((t) => [t.value, t.label]));
const TERM_LABELS: Record<string, string> = Object.fromEntries(EXAM_TERMS.map((t) => [t.value, t.label]));

// ── Component ─────────────────────────────────────────────────────────────────

export const ExaminationsPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [termFilter, setTermFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  const [formOpen, setFormOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExaminationRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExaminationRecord | null>(null);
  const [viewingExam, setViewingExam] = useState<ExaminationRecord | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['examinations', { search, typeFilter, termFilter, statusFilter, page, pageSize }],
    queryFn: () => examinationsService.listExaminations({
      page, limit: pageSize,
      type: typeFilter || undefined,
      term: termFilter || undefined,
      status: statusFilter || undefined,
      search: search || undefined,
    }),
    staleTime: 30_000,
  });

  const examinations: ExaminationRecord[] = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination ?? { total: 0, total_pages: 1 };

  const stats = useMemo(() => {
    const total = Number(pagination.total ?? examinations.length);
    const scheduled = examinations.filter((e) => e.status === 'scheduled').length;
    const completed = examinations.filter((e) => e.status === 'completed').length;
    const ongoing = examinations.filter((e) => e.status === 'ongoing').length;
    return { total, scheduled, completed, ongoing };
  }, [examinations, pagination]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await examinationsService.deleteExamination(deleteTarget.id);
    if (res.success !== false) {
      showToast.deleted('Examination');
      queryClient.invalidateQueries({ queryKey: ['examinations'] });
    } else {
      showToast.apiError(res.error);
    }
    setDeleteTarget(null);
  };

  const columns: ColumnDef<ExaminationRecord, any>[] = [
    {
      id: 'title',
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <div className="min-w-[160px]">
          <p className="font-medium text-gray-900 dark:text-white truncate">{row.original.title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {row.original.subject_name || 'All subjects'} · {row.original.class_name || 'All classes'}
          </p>
        </div>
      ),
    },
    {
      id: 'type',
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => (
        <span className="text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800/30">
          {TYPE_LABELS[row.original.type] || row.original.type}
        </span>
      ),
    },
    {
      id: 'term',
      accessorKey: 'term',
      header: 'Term',
      cell: ({ row }) => (
        <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
          {TERM_LABELS[row.original.term] || row.original.term}
        </span>
      ),
    },
    {
      id: 'academic_year',
      accessorKey: 'academic_year',
      header: 'Year',
      cell: ({ row }) => <span className="text-xs font-mono text-gray-600 dark:text-gray-400">{row.original.academic_year}</span>,
    },
    {
      id: 'start_date',
      accessorKey: 'start_date',
      header: 'Date',
      cell: ({ row }) => <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{formatDate(row.original.start_date)}</span>,
    },
    {
      id: 'marks',
      header: 'Marks',
      cell: ({ row }) => (
        <span className="text-xs text-gray-600 dark:text-gray-400">
          {row.original.total_marks} (pass: {row.original.pass_marks})
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
        title="Examinations"
        subtitle="Schedule and manage internal and external examinations"
        breadcrumbs={[{ label: 'Examinations' }]}
        actions={
          <RoleGuard roles={['principal', 'super_admin']}>
            <Button variant="default" size="sm" onClick={() => { setEditingExam(null); setFormOpen(true); }} className="whitespace-nowrap shadow-sm">
              + Schedule Exam
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
              <KPICard title="Total Exams" value={stats.total} icon={<div className="p-2 rounded-xl bg-blue-500 text-white shadow-sm flex items-center justify-center"><FileText size={20} /></div>} color="blue" />
              <KPICard title="Scheduled" value={stats.scheduled} icon={<div className="p-2 rounded-xl bg-amber-500 text-white shadow-sm flex items-center justify-center"><Calendar size={20} /></div>} color="amber" />
              <KPICard title="Ongoing" value={stats.ongoing} icon={<div className="p-2 rounded-xl bg-purple-500 text-white shadow-sm flex items-center justify-center"><Clock size={20} /></div>} color="purple" />
              <KPICard title="Completed" value={stats.completed} icon={<div className="p-2 rounded-xl bg-green-500 text-white shadow-sm flex items-center justify-center"><CheckCircle size={20} /></div>} color="green" />
            </>
          )}
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col gap-3 sm:gap-4 mb-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search exam title or subject..."
                className="w-full pl-9 pr-8 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md"><X size={14} /></button>}
            </div>
            <div className="flex items-center gap-2 w-full lg:w-auto flex-wrap">
              <div className="relative flex-1 sm:flex-initial sm:min-w-[140px]">
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-full appearance-none pl-3 pr-8 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                  <option value="">All Types</option>
                  {EXAM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
              </div>
              <div className="relative flex-1 sm:flex-initial sm:min-w-[120px]">
                <select value={termFilter} onChange={(e) => setTermFilter(e.target.value)} className="w-full appearance-none pl-3 pr-8 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                  <option value="">All Terms</option>
                  {EXAM_TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
              </div>
              <div className="relative flex-1 sm:flex-initial sm:min-w-[120px]">
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full appearance-none pl-3 pr-8 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                  <option value="">All Statuses</option>
                  {EXAM_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
              </div>
            </div>
          </div>

          {(search || typeFilter || termFilter || statusFilter) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-450 dark:text-gray-500 flex items-center gap-1 mr-1"><SlidersHorizontal size={10} /> Filters:</span>
              {search && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-50 dark:bg-primary-950/20 text-primary-700 dark:text-primary-400 text-xs font-semibold border border-primary-200/30">"{search}" <button onClick={() => setSearch('')}><X size={12} /></button></span>}
              {typeFilter && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 text-xs font-semibold border border-blue-200/30">{TYPE_LABELS[typeFilter]} <button onClick={() => setTypeFilter('')}><X size={12} /></button></span>}
              {termFilter && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 text-xs font-semibold border border-purple-200/30">{TERM_LABELS[termFilter]} <button onClick={() => setTermFilter('')}><X size={12} /></button></span>}
              {statusFilter && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold border border-emerald-200/30">{statusFilter} <button onClick={() => setStatusFilter('')}><X size={12} /></button></span>}
              <button onClick={() => { setSearch(''); setTypeFilter(''); setTermFilter(''); setStatusFilter(''); }} className="text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 font-bold ml-auto">Clear All</button>
            </div>
          )}
        </div>

        {/* Table */}
        <DataTable
          columns={columns}
          data={examinations}
          isLoading={isLoading}
          error={error ? String(error) : null}
          onRetry={refetch}
          paginationMode="server"
          pageIndex={page}
          pageSize={pageSize}
          totalRows={Number(pagination.total)}
          onPageChange={setPage}
          emptyMessage="No examinations found"
          emptyAction={{ label: 'Schedule your first exam', onClick: () => { setEditingExam(null); setFormOpen(true); } }}
          rowActions={(row) => [
            { label: 'View Details', onClick: (r) => setViewingExam(r) },
            { label: 'Edit', onClick: (r) => { setEditingExam(r); setFormOpen(true); } },
            { label: 'Delete', variant: 'destructive', onClick: (r) => setDeleteTarget(r) },
          ]}
        />
      </PageShell>

      <ExaminationFormModal
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditingExam(null); }}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['examinations'] })}
        editingExam={editingExam}
      />

      <ConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Examination"
        message={`Delete "${deleteTarget?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
      />

      <ExaminationDetailModal
        isOpen={!!viewingExam}
        onClose={() => setViewingExam(null)}
        exam={viewingExam}
      />
    </MainLayout>
  );
};

export default ExaminationsPage;
