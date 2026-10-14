/**
 * ResultsPage — /academic/results
 * Sierra Leone booklet grade-entry hub.
 *  - Cognitive tab: booklet-style Test 1 / Test 2 entry per class+subject+term
 *  - Ratings tab: per-student affective + psychomotor + conduct entry
 * Report cards are generated on the Report Cards page.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Star, BookOpen, Trophy } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { RoleGuard } from '@components/admin/common/RoleGuard';
import { SearchableSelect } from '@components/admin/forms/SearchableSelect';
import { YearFilter } from '@components/common/YearFilter';
import { useAcademicYears } from '@hooks/useAcademicYears';
import { Button } from '@components/ui/button';
import { useAuth } from '@hooks/useAuth';
import { classesService } from '@services/classesService';
import { ScoreEntryGrid } from './components/ScoreEntryGrid';
import { DomainRatingsModal } from './components/DomainRatingsModal';
import { SL_TERMS, SLTerm, SL_GRADING_METHOD, CONDUCT_CODES, getGradingMethod, reportCardService } from '@services/reportCardService';

import { StudentResultsView } from './components/StudentResultsView';
import { ParentResultsView } from './components/ParentResultsView';
import { ClassRankingView } from './components/ClassRankingView';

export const ResultsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isPrincipal = user?.role === 'principal' || user?.role === 'super_admin';
  const isStudent = user?.role === 'student';
  // Admissions officers read results (class ranking) but never enter scores.
  const readOnlyStaff = user?.role === 'admissions_officer';
  // 'guardian' is a legacy alias for parent (not in UserRole, but the column is free text).
  const isParent = user?.role === 'parent' || (user?.role as string | undefined) === 'guardian';

  // Pre-warm the grading method cache once the user is authenticated.
  // Previously this was a module-level call that fired before auth was ready,
  // causing repeated 401 errors on GET /api/v1/report-cards/config.
  useEffect(() => {
    getGradingMethod();
  }, []);
  // Year is chosen from the tenant's REAL sessions via <YearFilter> (auto-
  // selects the active year on first load). No new Date() fabrication.
  const [pickedYear, setPickedYear] = useState('');
  const { activeYear } = useAcademicYears();
  const academicYear = pickedYear || activeYear;
  const viewingPast = !!academicYear && !!activeYear && academicYear !== activeYear;
  const setAcademicYear = (y: string) => {
    // The current year is stored as '' so the page follows a rollover by itself.
    setPickedYear(y === activeYear ? '' : y);
    // Class picks belong to one year's class rows — reset them on change.
    setRankingClassId(''); setRatingsClassId(''); setRatingsStudentId('');
  };
  const [tab, setTab] = useState<'cognitive' | 'ratings' | 'ranking'>(readOnlyStaff ? 'ranking' : 'cognitive');

  // Ranking tab state
  const [rankingClassId, setRankingClassId] = useState('');
  // Read-only staff see released terms only (the server gates the rest).
  const { data: releasedResp } = useQuery({
    queryKey: ['results-released', rankingClassId, academicYear],
    queryFn: () => reportCardService.getReleased(rankingClassId, academicYear),
    enabled: readOnlyStaff && !!rankingClassId && !!academicYear,
    staleTime: 60_000,
  });
  const released = (releasedResp as any)?.data as { terms: SLTerm[]; year_released: boolean } | undefined;
  const releasedTerms = useMemo(() => {
    if (!released) return [] as Array<SLTerm | 'full'>;
    return [...released.terms, ...(released.year_released ? ['full' as const] : [])] as Array<SLTerm | 'full'>;
  }, [released]);

  // Ratings tab state
  const [ratingsClassId, setRatingsClassId] = useState('');
  const [ratingsTerm, setRatingsTerm] = useState<SLTerm>('first_term');
  const [ratingsStudentId, setRatingsStudentId] = useState('');
  const [ratingsModalOpen, setRatingsModalOpen] = useState(false);

  const { data: classesData } = useQuery({
    queryKey: ['results-classes', academicYear],
    queryFn: () => classesService.listClasses({ limit: 100, academic_year: academicYear }),
    enabled: !isStudent && !isParent && !!academicYear,
    staleTime: 60_000,
  });
  const classes = (classesData as any)?.data ?? [];
  const classOptions = useMemo(() => classes.map((c: any) => ({ value: String(c.id), label: c.name, sublabel: c.level })), [classes]);

  const { data: studentsData } = useQuery({
    queryKey: ['class-students-ratings', ratingsClassId],
    queryFn: () => classesService.getClassStudents(ratingsClassId),
    enabled: !!ratingsClassId && !isStudent && !isParent,
    staleTime: 30_000,
  });
  const students = (studentsData as any)?.data?.students ?? (studentsData as any)?.students ?? [];
  const studentOptions = useMemo(
    () => students.map((s: any) => ({ value: String(s.id), label: `${s.first_name} ${s.last_name}`, sublabel: s.roll_number || s.student_id })),
    [students],
  );
  const selectedStudent = students.find((s: any) => String(s.id) === String(ratingsStudentId));

  // Existing ratings + conduct/comment for the chosen student & term, so the
  // ratings dialog opens with what's saved (not blank).
  const { data: savedCardResp, isFetching: loadingSaved } = useQuery({
    queryKey: ['report-card', ratingsStudentId, ratingsClassId, academicYear],
    queryFn: () => reportCardService.getReportCard(ratingsStudentId, { class_id: ratingsClassId, academic_year: academicYear }),
    enabled: !!ratingsStudentId && !!ratingsClassId && !!academicYear && ratingsModalOpen,
    staleTime: 0,
  });
  const savedCard: any = (savedCardResp as any)?.data?.data ?? (savedCardResp as any)?.data ?? null;
  const initialRatings = useMemo(() => {
    if (!savedCard) return null;
    const pick = (domain: 'affective' | 'psychomotor') => {
      const out: Record<number, { r1: number | null; r2: number | null }> = {};
      Object.entries(savedCard.domain_ratings?.[domain] ?? {}).forEach(([idx, t]: [string, any]) => {
        const v = t?.terms?.[ratingsTerm];
        if (v) out[Number(idx)] = { r1: v.r1 ?? null, r2: v.r2 ?? null };
      });
      return out;
    };
    const ts = savedCard.term_summaries?.[ratingsTerm];
    return {
      affective: pick('affective'),
      psychomotor: pick('psychomotor'),
      termRecord: { conduct: ts?.conduct ?? '', teacher_comment: ts?.teacher_comment ?? '' },
    };
  }, [savedCard, ratingsTerm]);

  // Header Refresh: refetch every query on screen (this page's lists plus the
  // score grid / ranking / ratings panels, which own their own queries).
  const refreshPage = () => queryClient.refetchQueries({ type: 'active' });

  // Students get a read-only view of ONLY their own published results.
  if (isStudent) {
    return <StudentResultsView />;
  }
  // Parents get a read-only view of their children's published results.
  if (isParent) {
    return <ParentResultsView />;
  }

  return (
    <MainLayout>
      {/* Phones: the header's Refresh sits to the RIGHT of the year filter, a
          little wider and labelled. PageShell renders it as the first button
          beside our actions; the marked year-filter box finds that row. */}
      <div className="max-sm:[&_div:has(>[data-results-year])]:w-full max-sm:[&_div:has(>[data-results-year])]:flex-nowrap max-sm:[&_div:has(>[data-results-year])>button:first-child]:flex-shrink-0 max-sm:[&_div:has(>[data-results-year])>button:first-child]:px-4 max-sm:[&_div:has(>[data-results-year])>button:first-child>span]:inline">
      <PageShell
        title={readOnlyStaff ? 'Results & Grades' : 'Results & Grade Entry'}
        subtitle={readOnlyStaff ? 'Class rankings per term (view only). Scores are entered by teachers.' : 'Sierra Leone terminal booklet — Test 1 + Test 2 → Mean, per subject, per term'}
        breadcrumbs={[{ label: 'Results & Grades' }]}
        // Refetch this page's data (classes, students, scores, rankings) in
        // place. Without this PageShell falls back to reloading the whole app.
        onRefresh={refreshPage}
        actions={
          <div data-results-year className="order-first min-w-0 flex-1 sm:order-none sm:flex-none sm:w-44">
            <YearFilter value={academicYear} onChange={setAcademicYear} noAutoSelect className="w-full [&_select]:w-full" />
          </div>
        }
      >
        {viewingPast && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span>
              {readOnlyStaff
                ? <>You're viewing <strong>{academicYear}</strong>, a past year. The current year is {activeYear}.</>
                : <>You're working in <strong>{academicYear}</strong>, a past year. Scores and ratings you save here change
              that year's records. The current year is {activeYear}.</>}
            </span>
            <button type="button" onClick={() => setAcademicYear('')} className="text-xs font-bold text-amber-800 hover:underline">
              Back to {activeYear}
            </button>
          </div>
        )}
        {/* Grading method reference */}
        <div className="mb-6 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800/60 dark:to-gray-800/40 rounded-xl border border-blue-100 dark:border-gray-700 space-y-3">
          <div>
            <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">Method of Grading (Cognitive — Below 50% is a Fail, shown in RED)</p>
            <div className="flex flex-wrap gap-2">
              {SL_GRADING_METHOD.map((g) => (
                <span key={g.letter} className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                  g.isFail
                    ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border-red-300 dark:border-red-800'
                    : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800'
                }`}>
                  {g.letter}: {g.min}–{g.max} ({g.remark})
                </span>
              ))}
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
            <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">Conduct Legend</p>
            <div className="flex flex-wrap gap-2 text-[10px]">
              {CONDUCT_CODES.map((c) => (
                <span key={c.code} className={`px-2 py-0.5 rounded font-bold border ${c.isAlert ? 'bg-red-100 text-red-800 border-red-300' : 'bg-blue-100 text-blue-800 border-blue-200'}`}>
                  {c.code} = {c.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs — colorful pill group */}
        <div className="flex gap-2 mb-6 p-1.5 bg-slate-100 dark:bg-gray-800 rounded-2xl overflow-x-auto scrollbar-hide">
          {!readOnlyStaff && <button
            onClick={() => setTab('cognitive')}
            className={`flex-1 min-w-max text-center px-3 sm:px-4 py-2 text-sm rounded-xl transition-all whitespace-nowrap ${
              tab === 'cognitive'
                ? 'bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] text-white font-semibold shadow-md shadow-blue-500/30'
                : 'text-gray-600 dark:text-gray-400 hover:text-blue-700 hover:bg-white/70 dark:hover:bg-gray-700/50'
            }`}
          >
            <ClipboardList size={15} className="inline mr-1.5" />
            <span className="sm:hidden">Scores</span>
            <span className="hidden sm:inline">Cognitive Scores</span>
          </button>}
          {!readOnlyStaff && <button
            onClick={() => setTab('ratings')}
            className={`flex-1 min-w-max text-center px-3 sm:px-4 py-2 text-sm rounded-xl transition-all whitespace-nowrap ${
              tab === 'ratings'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white font-semibold shadow-md shadow-amber-500/30'
                : 'text-gray-600 dark:text-gray-400 hover:text-amber-700 hover:bg-white/70 dark:hover:bg-gray-700/50'
            }`}
          >
            <Star size={15} className="inline mr-1.5" />
            <span className="sm:hidden">Ratings</span>
            <span className="hidden sm:inline">Affective &amp; Psychomotor</span>
          </button>}
          <button
            onClick={() => setTab('ranking')}
            className={`flex-1 min-w-max text-center px-3 sm:px-4 py-2 text-sm rounded-xl transition-all whitespace-nowrap ${
              tab === 'ranking'
                ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold shadow-md shadow-emerald-500/30'
                : 'text-gray-600 dark:text-gray-400 hover:text-emerald-700 hover:bg-white/70 dark:hover:bg-gray-700/50'
            }`}
          >
            <Trophy size={15} className="inline mr-1.5" />
            <span className="sm:hidden">Ranking</span>
            <span className="hidden sm:inline">Class Ranking</span>
          </button>
        </div>

        {/* Grade controls & result release moved to Settings → Grading & Results */}
        {isPrincipal && (
          <div className="mb-6 flex flex-col gap-2 rounded-xl border border-blue-100 bg-blue-50/60 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-blue-900/40 dark:bg-blue-950/20">
            <p className="text-xs text-blue-800 dark:text-blue-300">
              Grade locking, teacher permissions, and result release are now managed in Settings.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/settings?tab=grading')}
              className="flex-shrink-0 whitespace-nowrap"
            >
              Open Grading &amp; Results settings →
            </Button>
          </div>
        )}

        {/* Cognitive tab */}
        {tab === 'cognitive' && (
          <RoleGuard roles={['principal', 'super_admin', 'teacher']} fallback={<p className="text-sm text-gray-500">You do not have permission to enter scores.</p>}>
            <ScoreEntryGrid academicYear={academicYear} />
          </RoleGuard>
        )}

        {/* Ratings tab */}
        {tab === 'ratings' && (
          <RoleGuard roles={['principal', 'super_admin', 'teacher']} fallback={<p className="text-sm text-gray-500">You do not have permission to enter ratings.</p>}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <SearchableSelect label="Class" options={classOptions} value={ratingsClassId} onChange={(v) => { setRatingsClassId(v); setRatingsStudentId(''); }} placeholder="Select class..." />
                <SearchableSelect label="Student" options={studentOptions} value={ratingsStudentId} onChange={setRatingsStudentId} placeholder="Select student..." />
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Term</label>
                  <select value={ratingsTerm} onChange={(e) => setRatingsTerm(e.target.value as SLTerm)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300">
                    {SL_TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              {ratingsStudentId ? (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedStudent ? `${selectedStudent.first_name} ${selectedStudent.last_name}` : ''}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Enter 12 affective + 12 psychomotor ratings, attendance & conduct for {ratingsTerm.replace('_', ' ')}.</p>
                  </div>
                  <Button variant="default" size="sm" onClick={() => setRatingsModalOpen(true)} className="w-full sm:w-auto flex-shrink-0 whitespace-nowrap">
                    <Star size={15} className="mr-1.5" /> Enter Ratings
                  </Button>
                </div>
              ) : (
                <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
                  <BookOpen size={28} className="mx-auto mb-2 text-gray-400" />
                  Select a class and student to enter affective / psychomotor ratings.
                </div>
              )}
            </div>
          </RoleGuard>
        )}

        {/* Class Ranking tab — results directory ordered by position */}
        {tab === 'ranking' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <SearchableSelect label="Class" options={classOptions} value={rankingClassId} onChange={setRankingClassId} placeholder="Select class..." />
            </div>
            {rankingClassId && readOnlyStaff && released && !releasedTerms.length ? (
              <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
                <Trophy size={28} className="mx-auto mb-2 text-gray-400" />
                No results are released for this class in {academicYear} yet. The ranking appears once the principal releases a term.
              </div>
            ) : rankingClassId && (!readOnlyStaff || released) ? (
              <ClassRankingView classId={rankingClassId} academicYear={academicYear} availableTerms={readOnlyStaff ? releasedTerms : undefined} />
            ) : (
              <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
                <Trophy size={28} className="mx-auto mb-2 text-gray-400" />
                Select a class to see students ranked by position and celebrate the class leader.
              </div>
            )}
          </div>
        )}

      </PageShell>
      </div>

      {selectedStudent && (
        <DomainRatingsModal
          isOpen={ratingsModalOpen && !loadingSaved}
          onClose={() => setRatingsModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['report-card'] });
            queryClient.invalidateQueries({ queryKey: ['class-ranking'] });
          }}
          initialAffective={initialRatings?.affective}
          initialPsychomotor={initialRatings?.psychomotor}
          initialTermRecord={initialRatings?.termRecord}
          studentId={ratingsStudentId}
          studentName={`${selectedStudent.first_name} ${selectedStudent.last_name}`}
          classId={ratingsClassId}
          academicYear={academicYear}
          term={ratingsTerm}
        />
      )}
    </MainLayout>
  );
};

export default ResultsPage;
