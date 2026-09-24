/**
 * ParentResultsView — read-only results for a parent's children.
 * Child selector + published SL results (server-enforced ownership + publish gate).
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
import { parentDashboardService } from '@services/parentDashboardService';
import { SL_TERMS, SL_GRADING_METHOD } from '@services/reportCardService';
import { ClassRankingView } from './ClassRankingView';

const TERM_LABEL: Record<string, string> = Object.fromEntries(
  (SL_TERMS as any[]).map((t: any) => [t.value ?? t, t.label ?? t]),
);
function termName(term: string): string {
  return TERM_LABEL[term] || term.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export const ParentResultsView: React.FC = () => {
  const [childId, setChildId] = useState('');

  const { data: dashResp } = useQuery({
    queryKey: ['parent-dashboard'],
    queryFn: () => parentDashboardService.getDashboard(),
    staleTime: 60_000,
  });
  const children = ((dashResp as any)?.data ?? (dashResp as any))?.children ?? [];
  const currentId = childId || children[0]?.id || '';

  const { data: childResp, isLoading, error } = useQuery({
    queryKey: ['parent-child-detail', currentId],
    queryFn: () => parentDashboardService.getChildDetail(currentId),
    enabled: !!currentId,
    staleTime: 60_000,
  });
  const detail = (childResp as any)?.data ?? (childResp as any);
  const grades = detail?.grades ?? [];
  const published = detail?.results_published;

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

  // Terms the selected child has released (distinct terms in published grades),
  // so the ranking defaults to the latest released term rather than an
  // unreleased "Full Year" tab.
  const rankingTerms = useMemo(() => {
    const order = ['first_term', 'second_term', 'third_term'] as const;
    const present = new Set(grades.map((g: any) => g.term));
    const terms = order.filter((t) => present.has(t)) as Array<'first_term' | 'second_term' | 'third_term' | 'full'>;
    if (terms.length === 3) terms.push('full');
    return terms;
  }, [grades]);

  return (
    <MainLayout>
      <PageShell title="Children's Results" subtitle="View your children's published results">
        {children.length === 0 ? (
          <EmptyState message="No children linked" description="Your account isn't linked to any student yet." />
        ) : (
          <div className="space-y-6">
            {/* Child selector */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {children.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => setChildId(c.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm whitespace-nowrap transition ${
                    currentId === c.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300'
                  }`}
                >
                  <span className="font-medium">{c.name}</span>
                  {c.class_name && <span className="text-xs text-gray-400">· {c.class_name}</span>}
                </button>
              ))}
            </div>

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
            ) : error ? (
              <EmptyState message="Couldn't load results" description="Please refresh and try again." />
            ) : !published ? (
              <EmptyState message="Results not published" description="Your child's results will appear here once the school publishes them." />
            ) : grades.length === 0 ? (
              <EmptyState message="No results recorded" description="No subject results have been entered yet." />
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
                            formatter={(value: number) => [`${value}%`, 'Mean Score']}
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

            {/* Class ranking for the selected child (published only) */}
            {published && detail?.profile?.class_id && grades.length > 0 && (
              <div className="mt-4">
                <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider mb-3">Class Ranking</h2>
                <ClassRankingView
                  classId={String(detail.profile.class_id)}
                  academicYear={String(detail.profile.academic_year || '')}
                  availableTerms={rankingTerms}
                />
              </div>
            )}
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
};

export default ParentResultsView;
