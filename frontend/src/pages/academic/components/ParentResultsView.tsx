/**
 * ParentResultsView — read-only results for a parent's children.
 *
 * One child and one academic year at a time ('' = the current year, follows a
 * rollover). Each child is resolved on its own for that year, server-side and
 * with the student portal's logic: every class the child had that year
 * (promoted mid-year → both), released results only (per class), ownership
 * verified. Siblings can be in different classes, graduated, or not yet moved
 * into the new year.
 */

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap, Loader2, BarChart3 } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import MainLayout from '@components/layout/MainLayout';
import { cardTint } from '@lib/cardTint';
import { PageShell } from '@components/admin/layout/PageShell';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { YearFilter } from '@components/common/YearFilter';
import { useAcademicYears } from '@hooks/useAcademicYears';
import { parentDashboardService, type ParentChildSummary } from '@services/parentDashboardService';
import { SL_TERMS, SL_GRADING_METHOD } from '@services/reportCardService';
import { ClassRankingView } from './ClassRankingView';

const TERM_LABEL: Record<string, string> = Object.fromEntries(
  (SL_TERMS as unknown as any[]).map((t: any) => [t.value ?? t, t.label ?? t]),
);
function termName(term: string): string {
  return TERM_LABEL[term] || term.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export const ParentResultsView: React.FC = () => {
  const { activeYear } = useAcademicYears();
  const [pickedYear, setPickedYear] = useState('');
  const year = pickedYear || activeYear;
  const viewingPast = !!year && !!activeYear && year !== activeYear;
  const [childId, setChildId] = useState('');
  const [rankClassId, setRankClassId] = useState('');
  const changeYear = (y: string) => { setPickedYear(!y || y === activeYear ? '' : y); setRankClassId(''); };

  const { data: dashResp, isLoading: dashLoading } = useQuery({
    queryKey: ['parent-dashboard', year],
    queryFn: () => parentDashboardService.getDashboard(year),
    enabled: !!year,
    staleTime: 60_000,
  });
  const children: ParentChildSummary[] = ((dashResp as any)?.data ?? (dashResp as any))?.children ?? [];
  const currentId = (childId && children.some((c) => c.id === childId)) ? childId : (children[0]?.id || '');
  const child = children.find((c) => c.id === currentId) ?? null;
  const first = (child?.name || 'Your child').split(' ')[0];

  const { data: childResp, isLoading, error, refetch } = useQuery({
    queryKey: ['parent-child-detail', currentId, year],
    queryFn: () => parentDashboardService.getChildDetail(currentId, year),
    enabled: !!currentId && !!year,
    staleTime: 60_000,
  });
  // apiClient never throws: a refused/failed load comes back as success:false.
  const loadError: string | null = error
    ? String(error)
    : (childResp as any)?.success === false ? ((childResp as any)?.error || "Couldn't load results") : null;
  const detail: any = loadError ? null : ((childResp as any)?.data ?? (childResp as any));
  const grades: any[] = detail?.grades ?? [];
  const yearClasses: string[] = Array.from(new Set<string>((detail?.year_classes ?? []).map((c: any) => c.name)));
  const multiClass = new Set(grades.map((g) => g.class_id || g.class_name)).size > 1;

  const byTerm = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const g of grades) {
      const arr = map.get(g.term) ?? [];
      arr.push(g);
      map.set(g.term, arr);
    }
    return Array.from(map.entries());
  }, [grades]);

  // Chart: latest mean per subject for the selected child.
  const chartData = useMemo(() => {
    const bySubject = new Map<string, number>();
    for (const g of grades) {
      const mean = Number(g.mean);
      if (!Number.isNaN(mean)) bySubject.set(g.subject_name, mean);
    }
    return Array.from(bySubject.entries()).map(([subject, mean]) => ({
      subject: subject.length > 10 ? `${subject.slice(0, 10)}…` : subject,
      fullSubject: subject,
      mean,
    }));
  }, [grades]);

  // Ranking: within the class the results were recorded in (picker if several).
  const rankClasses = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; year: string }>();
    for (const g of grades) {
      if (g.class_id && !seen.has(g.class_id)) seen.set(g.class_id, { id: g.class_id, name: g.class_name || 'Class', year: g.class_year || year });
    }
    return Array.from(seen.values());
  }, [grades, year]);
  const rankClass = rankClasses.find((c) => c.id === rankClassId) || rankClasses[0] || null;

  // Released terms for that class, so the ranking defaults to the latest one.
  const rankingTerms = useMemo(() => {
    const order = ['first_term', 'second_term', 'third_term'] as const;
    const present = new Set(grades.filter((g) => !rankClass || g.class_id === rankClass.id).map((g) => g.term));
    const terms = order.filter((t) => present.has(t)) as Array<'first_term' | 'second_term' | 'third_term' | 'full'>;
    // The whole-year ranking only once the school has released the full year.
    if (grades.some((g: any) => g.year_released && (!rankClass || g.class_id === rankClass.id))) terms.push('full');
    return terms;
  }, [grades, rankClass]);

  /** The child's place in the selected year, for the switcher chip. */
  const chip = (c: ParentChildSummary) =>
    c.year_classes && c.year_classes.length > 1 ? [...c.year_classes].reverse().map((x) => x.name).join(' → ')
      : c.class_name || (c.graduated ? '🎓 Graduated' : c.pending_transition ? `${c.pending_transition.className} (moving up)` : `Not enrolled in ${year}`);

  return (
    <MainLayout>
      <PageShell
        title="Children's Results"
        subtitle={child ? `${child.name}${yearClasses.length ? ` · ${[...yearClasses].reverse().join(' → ')}` : ''} · ${year}` : 'Your children’s released results'}
        breadcrumbs={[{ label: 'Results & Grades' }]}
        onRefresh={() => refetch()}
        isRefreshing={isLoading}
        actions={<YearFilter value={year} onChange={changeYear} noAutoSelect />}
      >
        {dashLoading || !year ? (
          <div className="flex items-center justify-center py-16 text-gray-500"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…</div>
        ) : children.length === 0 ? (
          <EmptyState message="No children linked" description="Your account isn't linked to any student yet. Please contact the school office." />
        ) : (
          <div className="space-y-6">
            {/* Child selector */}
            {children.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Choose a child">
                {children.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={currentId === c.id}
                    onClick={() => { setChildId(c.id); setRankClassId(''); }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm whitespace-nowrap transition ${
                      currentId === c.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300'
                    }`}
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-gray-400">· {chip(c)}</span>
                  </button>
                ))}
              </div>
            )}

            {viewingPast && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
                <span>Showing {first}'s <strong>{year}</strong> results{yearClasses.length ? <> ({[...yearClasses].reverse().join(' → ')})</> : null}. Only results the school released are shown.</span>
                <button type="button" onClick={() => changeYear('')} className="text-xs font-bold text-blue-700 hover:underline dark:text-blue-300">Back to {activeYear}</button>
              </div>
            )}
            {!viewingPast && detail?.pending_transition && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                <strong>{activeYear} is being set up.</strong> {first} is still listed in {detail.pending_transition.className} ({detail.pending_transition.fromYear}). Last year's results are under {detail.pending_transition.fromYear} in the year picker.
              </div>
            )}

            {/* Grading legend */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
              <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">Grading Method (below 50% is a fail)</p>
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

            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-500"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…</div>
            ) : loadError ? (
              <EmptyState message="Couldn't load results" description={loadError} action={{ label: 'Retry', onClick: () => refetch() }} />
            ) : detail && !detail.enrolled_in_year && !detail.pending_transition ? (
              detail.graduated && !viewingPast
                ? <EmptyState message={`🎓 ${first} graduated from ${detail.graduated.className}${detail.graduated.year ? ` in ${detail.graduated.year}` : ''}`} description="Their results from earlier years are still available: pick a year above." />
                : <EmptyState message={`${first} wasn’t in a class at this school in ${year}`} description="Pick another year above." />
            ) : grades.length === 0 ? (
              <EmptyState
                message={`No results released for ${first} in ${year} yet`}
                description={viewingPast ? 'The school did not release results for this year.' : 'Results appear here once teachers enter them and the school releases the term.'}
              />
            ) : (
              <div className="space-y-6">
                {/* Performance chart */}
                {chartData.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                      <BarChart3 size={16} className="text-blue-500" />
                      <h3 className="font-bold text-gray-900 dark:text-white">Mean Score by Subject</h3>
                    </div>
                    <div className="p-4">
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                          <XAxis dataKey="subject" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullSubject ?? ''}
                            formatter={(value: any) => [`${value}%`, 'Mean Score']}
                          />
                          <Bar dataKey="mean" radius={[4, 4, 0, 0]} maxBarSize={56}>
                            {chartData.map((d) => (
                              <Cell key={d.fullSubject} fill={d.mean < 50 ? '#EF4444' : '#2563EB'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {byTerm.map(([term, rows], idx) => (
                  <div key={term} className={`${cardTint(idx)} sm:bg-white sm:dark:bg-gray-800 sm:border-gray-200 sm:dark:border-gray-700 border rounded-2xl shadow-sm overflow-hidden`}>
                    <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                      <GraduationCap size={16} className="text-blue-500" />
                      <h3 className="font-bold text-gray-900 dark:text-white">{termName(term)}</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#3b82f6] border-b border-blue-700">
                          <tr className="text-white">
                            <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider">Subject</th>
                            {multiClass && <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider">Class</th>}
                            <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider text-center">Test 1</th>
                            <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider text-center">Test 2</th>
                            <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider text-center">Mean</th>
                            <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider text-center">Rank</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {rows.map((g: any, i: number) => {
                            const mean = Number(g.mean);
                            const hasMean = g.mean != null && !Number.isNaN(mean);
                            const isFail = hasMean && mean > 0 && mean < 50;
                            return (
                              <tr
                                key={g.id}
                                className={`transition-colors hover:bg-sky-100 dark:hover:bg-blue-950/20 ${
                                  i % 2 === 1 ? 'bg-sky-50 dark:bg-gray-800/20' : 'bg-white dark:bg-transparent'
                                }`}
                              >
                                <td className="px-4 py-3.5 font-medium text-gray-900 dark:text-gray-100">{g.subject_name}</td>
                                {multiClass && <td className="px-4 py-3.5 text-xs text-gray-600 dark:text-gray-300">{g.class_name || '—'}</td>}
                                <td className="px-4 py-3.5 text-center text-gray-700 dark:text-gray-300">{g.test1 ?? '—'}</td>
                                <td className="px-4 py-3.5 text-center text-gray-700 dark:text-gray-300">{g.test2 ?? '—'}</td>
                                <td className="px-4 py-3.5 text-center">
                                  {hasMean ? (
                                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                      isFail
                                        ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                                        : mean >= 70
                                        ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                                    }`}>
                                      {g.mean}
                                    </span>
                                  ) : '—'}
                                </td>
                                <td className="px-4 py-3.5 text-center font-medium text-gray-600 dark:text-gray-300">{g.subject_rank ? `#${g.subject_rank}` : '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Class ranking (released only), in the class the results were recorded in */}
            {rankClass && grades.length > 0 && (
              <div className="mt-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                    Class Ranking{rankClasses.length === 1 ? ` · ${rankClass.name}` : ''}
                  </h2>
                  {rankClasses.length > 1 && (
                    <div className="flex gap-1.5" role="group" aria-label="Choose a class">
                      {rankClasses.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          aria-pressed={rankClass.id === c.id}
                          onClick={() => setRankClassId(c.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold ${rankClass.id === c.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <ClassRankingView key={`${currentId}:${rankClass.id}`} classId={rankClass.id} academicYear={rankClass.year} availableTerms={rankingTerms} />
              </div>
            )}
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
};

export default ParentResultsView;
