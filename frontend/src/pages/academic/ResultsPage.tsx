/**
 * ResultsPage — /academic/results
 * Grade entry and viewing for Sierra Leone schools.
 * CA (30%) + Exam (70%) = Total (100%) with auto grade letter.
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { Award, TrendingUp, TrendingDown, Users, Search, X, ChevronDown, SlidersHorizontal } from 'lucide-react';
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
import { resultsService, GradeRecord, TERMS, DEFAULT_GRADING_SCALE } from '@services/resultsService';
import { classesService } from '@services/classesService';
import { subjectsService } from '@services/subjectsService';
import { SearchableSelect } from '@components/admin/forms/SearchableSelect';

// ── Helpers ───────────────────────────────────────────────────────────────────

const gradeColorMap: Record<string, string> = {
  A: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
  B: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  C: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  D: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  E: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
  F: 'bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700',
};

const TERM_LABELS: Record<string, string> = Object.fromEntries(TERMS.map((t) => [t.value, t.label]));

// ── Component ─────────────────────────────────────────────────────────────────

export const ResultsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const defaultAcademicYear = `${currentYear}/${currentYear + 1}`;

  // Filters
  const [classFilter, setClassFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [termFilter, setTermFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  const [deleteTarget, setDeleteTarget] = useState<GradeRecord | null>(null);

  // Fetch classes & subjects for filters
  const { data: classesData } = useQuery({
    queryKey: ['classes-dropdown'],
    queryFn: () => classesService.listClasses({ limit: 100 }),
    staleTime: 60_000,
  });
  const classes = (classesData as any)?.data ?? [];
  const classOptions = useMemo(() => classes.map((c: any) => ({ value: String(c.id), label: c.name, sublabel: c.level })), [classes]);

  const { data: subjectsData } = useQuery({
    queryKey: ['subjects-dropdown'],
    queryFn: () => subjectsService.listSubjects({ limit: 100, status: 'active' }),
    staleTime: 60_000,
  });
  const subjects = (subjectsData as any)?.data ?? [];
  const subjectOptions = useMemo(() => subjects.map((s: any) => ({ value: String(s.id), label: s.name, sublabel: s.code })), [subjects]);

  // Fetch results
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['results', { classFilter, subjectFilter, termFilter, search, page, pageSize }],
    queryFn: () => resultsService.listGrades({
      page, limit: pageSize,
      class_id: classFilter || undefined,
      subject_id: subjectFilter || undefined,
      term: termFilter || undefined,
      academic_year: defaultAcademicYear,
      search: search || undefined,
    }),
    staleTime: 15_000,
  });

  const results: GradeRecord[] = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination ?? { total: 0, total_pages: 1 };

  // KPIs
  const stats = useMemo(() => {
    const total = Number(pagination.total ?? results.length);
    const passCount = results.filter((r) => Number(r.total_score) >= 40).length;
    const avgScore = results.length > 0
      ? Math.round(results.reduce((s, r) => s + Number(r.total_score), 0) / results.length * 10) / 10
      : 0;
    const highestScore = results.length > 0
      ? Math.max(...results.map((r) => Number(r.total_score)))
      : 0;
    return { total, passCount, avgScore, highestScore };
  }, [results, pagination]);

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await resultsService.deleteGrade(deleteTarget.id);
    if (res.success !== false) {
      showToast.deleted('Result');
      queryClient.invalidateQueries({ queryKey: ['results'] });
    } else {
      showToast.apiError(res.error);
    }
    setDeleteTarget(null);
  };

  // Columns
  const columns: ColumnDef<GradeRecord, any>[] = [
    {
      id: 'student',
      header: 'Student',
      cell: ({ row }) => (
        <div className="min-w-[130px]">
          <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{row.original.student_name}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">{row.original.student_roll_number}</p>
        </div>
      ),
    },
    {
      id: 'subject',
      header: 'Subject',
      cell: ({ row }) => (
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{row.original.subject_code || row.original.subject_name}</span>
      ),
    },
    {
      id: 'class',
      header: 'Class',
      cell: ({ row }) => (
        <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full text-gray-600 dark:text-gray-400 font-medium">{row.original.class_name}</span>
      ),
    },
    {
      id: 'ca_score',
      header: 'CA /30',
      cell: ({ row }) => <span className="text-sm font-mono font-semibold text-gray-800 dark:text-gray-200">{Number(row.original.ca_score)}</span>,
    },
    {
      id: 'exam_score',
      header: 'Exam /70',
      cell: ({ row }) => <span className="text-sm font-mono font-semibold text-gray-800 dark:text-gray-200">{Number(row.original.exam_score)}</span>,
    },
    {
      id: 'total_score',
      header: 'Total /100',
      cell: ({ row }) => <span className="text-sm font-mono font-bold text-gray-900 dark:text-white">{Number(row.original.total_score)}</span>,
    },
    {
      id: 'grade',
      header: 'Grade',
      cell: ({ row }) => {
        const color = gradeColorMap[row.original.grade_letter] || gradeColorMap.F;
        return (
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${color}`}>
            {row.original.grade_letter}
          </span>
        );
      },
    },
    {
      id: 'remark',
      header: 'Remark',
      cell: ({ row }) => <span className="text-xs text-gray-600 dark:text-gray-400">{row.original.remark}</span>,
    },
    {
      id: 'term',
      header: 'Term',
      cell: ({ row }) => <span className="text-xs text-gray-500 dark:text-gray-400">{TERM_LABELS[row.original.term] || row.original.term}</span>,
    },
  ];

  return (
    <MainLayout>
      <PageShell
        title="Results & Grades"
        subtitle="View and manage student academic results"
        breadcrumbs={[{ label: 'Results & Grades' }]}
        actions={
          <RoleGuard roles={['principal', 'super_admin', 'teacher']}>
            <Button variant="default" size="sm" className="whitespace-nowrap shadow-sm" disabled>
              + Enter Grades (Coming Soon)
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
              <KPICard title="Total Results" value={stats.total} icon={<div className="p-2 rounded-xl bg-blue-500 text-white shadow-sm flex items-center justify-center"><Award size={20} /></div>} color="blue" />
              <KPICard title="Pass Count" value={stats.passCount} icon={<div className="p-2 rounded-xl bg-green-500 text-white shadow-sm flex items-center justify-center"><TrendingUp size={20} /></div>} color="green" />
              <KPICard title="Average Score" value={`${stats.avgScore}%`} icon={<div className="p-2 rounded-xl bg-purple-500 text-white shadow-sm flex items-center justify-center"><Users size={20} /></div>} color="purple" />
              <KPICard title="Highest Score" value={stats.highestScore} icon={<div className="p-2 rounded-xl bg-amber-500 text-white shadow-sm flex items-center justify-center"><TrendingDown size={20} /></div>} color="amber" />
            </>
          )}
        </div>

        {/* Grading Scale Reference — configurable hint */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Grading Configuration (CA 30% + Exam 70% = Total 100%)</p>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 italic">Configurable in School Settings</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_GRADING_SCALE.map((g) => (
              <span key={g.letter} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${gradeColorMap[g.letter]}`}>
                {g.letter}: {g.min}–{g.max}% ({g.remark})
              </span>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
            ℹ️ Nursery/Primary may use simpler grading (e.g. Excellent/Good/Fair/Poor). Schools can customise the scale and CA/Exam weights in Settings → Academic Configuration.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:gap-4 mb-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            {/* Search */}
            <div className="relative w-full lg:max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student name or subject..."
                className="w-full pl-9 pr-8 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md"><X size={14} /></button>}
            </div>

            {/* Filter row */}
            <div className="flex items-end gap-2 flex-wrap w-full lg:w-auto">
              <SearchableSelect options={classOptions} value={classFilter} onChange={setClassFilter} placeholder="All Classes" searchPlaceholder="Search classes..." className="flex-1 sm:flex-initial sm:w-[160px]" />
              <SearchableSelect options={subjectOptions} value={subjectFilter} onChange={setSubjectFilter} placeholder="All Subjects" searchPlaceholder="Search subjects..." className="flex-1 sm:flex-initial sm:w-[160px]" />
              <div className="relative flex-1 sm:flex-initial sm:min-w-[130px]">
                <select value={termFilter} onChange={(e) => setTermFilter(e.target.value)} className="w-full appearance-none pl-3 pr-8 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                  <option value="">All Terms</option>
                  {TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
              </div>
            </div>
          </div>

          {/* Active filter badges */}
          {(search || classFilter || subjectFilter || termFilter) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-450 dark:text-gray-500 flex items-center gap-1 mr-1"><SlidersHorizontal size={10} /> Filters:</span>
              {search && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-50 dark:bg-primary-950/20 text-primary-700 dark:text-primary-400 text-xs font-semibold border border-primary-200/30">"{search}" <button onClick={() => setSearch('')}><X size={12} /></button></span>}
              {classFilter && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 text-xs font-semibold border border-blue-200/30">Class: {classOptions.find((o: any) => o.value === classFilter)?.label} <button onClick={() => setClassFilter('')}><X size={12} /></button></span>}
              {subjectFilter && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 text-xs font-semibold border border-purple-200/30">Subject: {subjectOptions.find((o: any) => o.value === subjectFilter)?.label} <button onClick={() => setSubjectFilter('')}><X size={12} /></button></span>}
              {termFilter && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold border border-emerald-200/30">{TERM_LABELS[termFilter]} <button onClick={() => setTermFilter('')}><X size={12} /></button></span>}
              <button onClick={() => { setSearch(''); setClassFilter(''); setSubjectFilter(''); setTermFilter(''); }} className="text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 font-bold ml-auto">Clear All</button>
            </div>
          )}
        </div>

        {/* Table */}
        <DataTable
          columns={columns}
          data={results}
          isLoading={isLoading}
          error={error ? String(error) : null}
          onRetry={refetch}
          paginationMode="server"
          pageIndex={page}
          pageSize={pageSize}
          totalRows={Number(pagination.total)}
          onPageChange={setPage}
          emptyMessage="No results found. Grades will appear here once entered."
          rowActions={(row) => [
            { label: 'Delete', variant: 'destructive', onClick: (r) => setDeleteTarget(r) },
          ]}
        />
      </PageShell>

      <ConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Result"
        message={`Delete the grade for ${deleteTarget?.student_name} in ${deleteTarget?.subject_name}?`}
        confirmLabel="Delete"
      />
    </MainLayout>
  );
};

export default ResultsPage;
