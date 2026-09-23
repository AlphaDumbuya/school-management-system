/**
 * StudentResultsView — read-only results for the logged-in student.
 * Reuses the student dashboard endpoint (published SL subject results only,
 * enforced server-side) and groups them by term. Students cannot enter or edit.
 */

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap, Loader2 } from 'lucide-react';
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
            {byTerm.map(([term, rows], idx) => (
              <div key={term} className={`${cardTint(idx)} sm:bg-white sm:dark:bg-gray-800 sm:border-gray-200 sm:dark:border-gray-700 border rounded-2xl shadow-sm overflow-hidden`}>
                <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                  <GraduationCap size={16} className="text-blue-500" />
                  <h3 className="font-bold text-gray-900 dark:text-white">{termName(term)}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b border-gray-100 dark:border-gray-800">
                        <th className="py-2 px-4">Subject</th>
                        <th className="py-2 px-3 text-center">Test 1</th>
                        <th className="py-2 px-3 text-center">Test 2</th>
                        <th className="py-2 px-3 text-center">Mean</th>
                        <th className="py-2 px-3 text-center">Rank</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((g) => {
                        const mean = Number(g.mean);
                        const isFail = !isNaN(mean) && mean > 0 && mean < 50;
                        return (
                          <tr key={g.id} className="border-b border-gray-50 dark:border-gray-800/50">
                            <td className="py-2 px-4 font-medium">{g.subject_name}</td>
                            <td className="py-2 px-3 text-center">{g.test1 ?? '—'}</td>
                            <td className="py-2 px-3 text-center">{g.test2 ?? '—'}</td>
                            <td className={`py-2 px-3 text-center font-semibold ${isFail ? 'text-red-600' : ''}`}>{g.mean ?? '—'}</td>
                            <td className="py-2 px-3 text-center">{g.subject_rank ? `#${g.subject_rank}` : '—'}</td>
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
            <ClassRankingView classId={String(profile.class_id)} academicYear={String(profile.academic_year || '')} />
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
};

export default StudentResultsView;
