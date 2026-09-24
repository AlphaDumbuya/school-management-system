/**
 * StudentResultsView — read-only results for the logged-in student.
 * Reuses the student dashboard endpoint (published SL subject results only,
 * enforced server-side) and groups them by term. Students cannot enter or edit.
 */

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap, Loader2, BarChart3 } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import MainLayout from '@components/layout/MainLayout';
import { cardTint } from '@lib/cardTint';
import { PageShell } from '@components/admin/layout/PageShell';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { studentDashboardService, StudentGrade } from '@services/studentDashboardService';
import { SL_TERMS, SL_GRADING_METHOD } from '@services/reportCardService';
import { ClassRankingView } from './ClassRankingView';

const TERM_LABEL: Record<string, string> = Object.fromEntries(
  (SL_TERMS as any[]).map((t: any) => [t.value ?? t, t.label ?? t]),
);

function termName(term: string): string {
  return TERM_LABEL[term] || term.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export const StudentResultsView: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['student-results-self'],
    queryFn: () => studentDashboardService.getDashboard(),
    staleTime: 60_000,
  });

  const dash = (data as any)?.data ?? (data as any);
  const profile = dash?.profile ?? null;
  const grades: StudentGrade[] = dash?.grades ?? [];

  // Group grades by term
  const byTerm = useMemo(() => {
    const map = new Map<string, StudentGrade[]>();
    for (const g of grades) {
      const arr = map.get(g.term) ?? [];
      arr.push(g);
      map.set(g.term, arr);
    }
    return Array.from(map.entries());
  }, [grades]);

  // Chart: latest mean score per subject (one bar per subject).
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

  // Terms the student can open in the ranking = the terms actually released to
  // them (i.e. the distinct terms present in their published grades), in
  // canonical order. This makes the ranking default to the latest released term
  // instead of an unreleased "Full Year" tab.
  const rankingTerms = useMemo(() => {
    const order = ['first_term', 'second_term', 'third_term'] as const;
    const present = new Set(grades.map((g) => g.term));
    const terms = order.filter((t) => present.has(t)) as Array<'first_term' | 'second_term' | 'third_term' | 'full'>;
    // When all three terms are released, the whole-year ranking is meaningful too.
    if (terms.length === 3) terms.push('full');
    return terms;
  }, [grades]);

  return (
    <MainLayout>
      <PageShell
        title="My Results"
        subtitle={profile?.class_name ? `${profile.class_name}${profile.academic_year ? ` • ${profile.academic_year}` : ''}` : 'Your published results'}
      >
        {/* Grading legend */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
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
          <div className="flex items-center justify-center py-20 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading your results…
          </div>
        ) : error ? (
          <EmptyState message="Couldn't load results" description="Please refresh and try again." />
        ) : grades.length === 0 ? (
          <EmptyState
            message="No results yet"
            description="Your results will appear here once your teachers enter and the school publishes them."
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
                      {rows.map((g, i) => {
                        const mean = Number(g.mean);
                        const hasMean = !isNaN(mean) && g.mean != null;
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
                                <span
                                  className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                    isFail
                                      ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                                      : mean >= 70
                                      ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                                      : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                                  }`}
                                >
                                  {g.mean}
                                </span>
                              ) : (
                                '—'
                              )}
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

        {/* Class ranking — where you stand + who leads the class (published only) */}
        {profile?.class_id && grades.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider mb-3">Class Ranking</h2>
            <ClassRankingView
              classId={String(profile.class_id)}
              academicYear={String(profile.academic_year || '')}
              availableTerms={rankingTerms}
            />
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
};

export default StudentResultsView;
