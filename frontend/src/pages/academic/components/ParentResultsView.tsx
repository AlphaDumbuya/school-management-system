/**
 * ParentResultsView — read-only results for a parent's children.
 * Child selector + published SL results (server-enforced ownership + publish gate).
 */

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap, Loader2 } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { parentDashboardService } from '@services/parentDashboardService';
import { SL_TERMS, SL_GRADING_METHOD } from '@services/reportCardService';

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
                {byTerm.map(([term, rows]) => (
                  <div key={term} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
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
                          {rows.map((g: any) => {
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
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
};

export default ParentResultsView;
