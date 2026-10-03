/**
 * PromotionsPage — /academic/promotions
 * End-of-year student promotion. Principal picks a class + academic year, the
 * system computes each student's yearly outcome (from SL report-card results),
 * the principal picks a target class and bulk-promotes. Repeaters stay put;
 * final-year students can be graduated. Includes a promotion history tab.
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  GraduationCap, ArrowUpCircle, RotateCcw, Award, History,
  CheckCircle2, AlertTriangle, Loader2, ChevronDown, Users,
} from 'lucide-react';
import { MainLayout } from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { Button } from '@components/ui/button';
import { RoleGuard } from '@components/admin/common/RoleGuard';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { showToast } from '@utils/toast';
import { classesService } from '@services/classesService';
import { YearFilter } from '@components/common/YearFilter';
import { useAcademicYears } from '@hooks/useAcademicYears';
import {
  promotionService, PromotionCandidate, PromotionOutcome, PromotionDecision,
} from '@services/promotionService';

type Tab = 'promote' | 'history';

const OUTCOME_STYLES: Record<PromotionOutcome, string> = {
  promoted: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  promoted_effort: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  repeated: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  graduated: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

const OUTCOME_LABELS: Record<PromotionOutcome, string> = {
  promoted: 'Promoted',
  promoted_effort: 'Promoted (Effort)',
  repeated: 'Repeat',
  graduated: 'Graduated',
};

export const PromotionsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('promote');
  // Real years only (shared source); opens on the school's ACTIVE year.
  const { activeYear } = useAcademicYears();
  const [pickedYear, setPickedYear] = useState('');
  const academicYear = pickedYear || activeYear;
  const [classId, setClassId] = useState('');
  const [targetClassId, setTargetClassId] = useState('');
  const [graduate, setGraduate] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, PromotionOutcome>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: classesData } = useQuery({
    // Scope classes to the selected year so the picker shows that year's classes.
    queryKey: ['promotion-classes', academicYear],
    queryFn: () => classesService.listClasses({ limit: 200, academic_year: academicYear }),
    enabled: !!academicYear,
    staleTime: 60_000,
  });
  const classes: any[] = (classesData as any)?.data ?? [];

  // Promoting from a PAST year? Students move into the CURRENT year's classes,
  // so "To Class" lists the active year's classes instead of last year's.
  const fromPastYear = !!academicYear && !!activeYear && academicYear !== activeYear;
  const { data: activeClassesData } = useQuery({
    queryKey: ['promotion-classes', activeYear],
    queryFn: () => classesService.listClasses({ limit: 200, academic_year: activeYear }),
    enabled: fromPastYear,
    staleTime: 60_000,
  });
  const targetClasses: any[] = fromPastYear ? ((activeClassesData as any)?.data ?? []) : classes;
  // Map a last-year class to its copy in the current year (via carried_from_id).
  const toCurrentYear = (id?: string | null) => {
    if (!id) return '';
    if (!fromPastYear) return String(id);
    const copy = targetClasses.find((c) => String(c.carried_from_id) === String(id));
    return copy ? String(copy.id) : '';
  };

  const canLoad = !!(classId && academicYear);
  const { data: candData, isLoading, error, refetch } = useQuery({
    queryKey: ['promotion-candidates', classId, academicYear],
    queryFn: () => promotionService.getCandidates(classId, academicYear),
    enabled: canLoad && tab === 'promote',
    // Always fetch fresh: promotion state changes (elsewhere or a reversal) must
    // show immediately — never a stale "Recorded" row.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const candidates: PromotionCandidate[] = (candData as any)?.data?.candidates ?? (candData as any)?.candidates ?? [];

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['promotion-history', classId, academicYear],
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    queryFn: () => promotionService.getHistory({
      class_id: classId || undefined,
      academic_year: academicYear || undefined,
    }),
    enabled: tab === 'history',
    staleTime: 15_000,
  });
  const history: any[] = (historyData as any)?.data ?? [];

  // Effective outcome = principal override, else recommendation.
  const effectiveOutcome = (c: PromotionCandidate): PromotionOutcome | null =>
    overrides[c.student_id] ?? c.outcome;

  const pending = candidates.filter((c) => !c.already_promoted);
  const stats = useMemo(() => {
    let promoted = 0, repeat = 0, noResult = 0;
    pending.forEach((c) => {
      const o = effectiveOutcome(c);
      if (o === 'promoted' || o === 'promoted_effort' || o === 'graduated') promoted++;
      else if (o === 'repeated') repeat++;
      else noResult++;
    });
    return { total: candidates.length, promoted, repeat, noResult, done: candidates.length - pending.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, pending, overrides]);

  const setOutcome = (studentId: string, outcome: PromotionOutcome) =>
    setOverrides((prev) => ({ ...prev, [studentId]: outcome }));

  const needsTarget = !graduate && pending.some((c) => {
    const o = effectiveOutcome(c);
    return o === 'promoted' || o === 'promoted_effort';
  });

  const handleExecute = async () => {
    const decisions: PromotionDecision[] = pending
      .map((c) => {
        const o = effectiveOutcome(c);
        if (!o) return null;
        return {
          student_id: c.student_id,
          outcome: o,
          percentage: c.percentage,
          position: c.position,
        } as PromotionDecision;
      })
      .filter(Boolean) as PromotionDecision[];

    if (decisions.length === 0) {
      showToast.error('No students to promote');
      return;
    }

    setSubmitting(true);
    try {
      const res: any = await promotionService.execute({
        from_class_id: classId,
        academic_year: academicYear,
        to_class_id: graduate ? null : targetClassId || null,
        graduate,
        decisions,
      });
      const r = res?.result ?? res?.data?.result ?? {};
      showToast.success(
        `Done — ${r.promoted ?? 0} promoted, ${r.repeated ?? 0} repeating, ${r.graduated ?? 0} graduated`,
      );
      setOverrides({});
      queryClient.invalidateQueries({ queryKey: ['promotion-candidates'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-history'] });
      refetch();
    } catch (e: any) {
      showToast.error(e?.response?.data?.error || 'Promotion failed');
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  };

  const selectCls = 'appearance-none pl-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <MainLayout>
      <PageShell
        title="Student Promotions"
        subtitle="Promote students to the next class at the end of the academic year"
        breadcrumbs={[{ label: 'Academic' }, { label: 'Promotions' }]}
      >
        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
          {([['promote', 'Promote Class', <ArrowUpCircle size={16} key="p" />], ['history', 'History', <History size={16} key="h" />]] as const).map(
            ([key, label, icon]) => (
              <button
                key={key}
                onClick={() => setTab(key as Tab)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === key
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800'
                }`}
              >
                {icon}{label}
              </button>
            ),
          )}
        </div>

        {/* Pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:flex-row md:items-end gap-3 mb-6">
          <div className="w-full md:w-auto">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Academic Year</label>
            <YearFilter
              value={academicYear}
              onChange={(y) => {
                // Each year has its own class rows — drop picks from the old year.
                setPickedYear(y);
                setClassId(''); setTargetClassId(''); setGraduate(false); setOverrides({});
              }}
              noAutoSelect
              className="w-full md:w-40 [&_select]:w-full"
            />
          </div>
          <div className="w-full md:w-auto">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
              {tab === 'promote' ? 'From Class' : 'Filter by Class'}
            </label>
            <div className="relative">
              <select
                value={classId}
                onChange={(e) => {
                  const newFrom = e.target.value;
                  setClassId(newFrom);
                  setOverrides({});
                  // Auto-suggest the destination from the source class's configured
                  // next class (or Graduate for a final-year class), so "To Class"
                  // isn't just a mirror of the same list.
                  if (tab === 'promote') {
                    const src = classes.find((c) => String(c.id) === newFrom);
                    if (src?.is_final_year) { setGraduate(true); setTargetClassId(''); }
                    else if (src?.next_class_id) { setGraduate(false); setTargetClassId(toCurrentYear(src.next_class_id)); }
                    else { setGraduate(false); setTargetClassId(''); }
                  }
                }}
                className={`${selectCls} w-full md:w-56`}
              >
                <option value="">{tab === 'promote' ? '— Select a class —' : 'All classes'}</option>
                {classes.map((c) => <option key={c.id} value={String(c.id)}>{c.name}{c.level ? ` (${c.level})` : ''}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
            </div>
          </div>

          {tab === 'promote' && (
            <div className="w-full sm:col-span-2 md:col-auto md:w-auto">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">To Class</label>
              <div className="relative">
                <select
                  value={graduate ? '__graduate__' : targetClassId}
                  onChange={(e) => {
                    if (e.target.value === '__graduate__') { setGraduate(true); setTargetClassId(''); }
                    else { setGraduate(false); setTargetClassId(e.target.value); }
                  }}
                  className={`${selectCls} w-full md:w-56`}
                >
                  <option value="">— Select target class —</option>
                  {targetClasses
                    .filter((c) => String(c.id) !== classId && String(c.carried_from_id ?? '') !== classId)
                    .map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}{c.level ? ` (${c.level})` : ''}{fromPastYear ? ` · ${activeYear}` : ''}
                      </option>
                    ))}
                  <option value="__graduate__">🎓 Graduate (final year)</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
              </div>
            </div>
          )}
        </div>

        {/* ── PROMOTE TAB ── */}
        {tab === 'promote' && (
          !canLoad ? (
            <EmptyState message="Select a class and academic year" description="Choose the class you want to promote and its academic year." />
          ) : isLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={32} className="animate-spin text-blue-500" /></div>
          ) : error ? (
            <EmptyState message="Failed to load candidates" description="Please try again." />
          ) : candidates.length === 0 ? (
            <EmptyState message="No students found" description="This class has no active students for the selected year." />
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                <KPICard title="Total Students" value={stats.total} icon={<div className="p-2 rounded-xl bg-blue-500 text-white"><Users size={18} /></div>} color="blue" />
                <KPICard title="To Promote" value={stats.promoted} icon={<div className="p-2 rounded-xl bg-emerald-500 text-white"><ArrowUpCircle size={18} /></div>} color="green" />
                <KPICard title="To Repeat" value={stats.repeat} icon={<div className="p-2 rounded-xl bg-red-500 text-white"><RotateCcw size={18} /></div>} color="red" />
                <KPICard title="Already Done" value={stats.done} icon={<div className="p-2 rounded-xl bg-gray-500 text-white"><CheckCircle2 size={18} /></div>} color="gray" />
              </div>

              {needsTarget && !targetClassId && !graduate && (
                <div className="flex items-center gap-2 px-4 py-3 mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle size={16} /> Select a target class (under "Promote To") before promoting.
                </div>
              )}

              {/* Candidate table */}
              <p className="sm:hidden text-[11px] text-gray-400 mb-1.5">Swipe sideways to see all columns.</p>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        {['Pos', 'Student', 'ID', '%', 'Recommendation', 'Decision'].map((h) => (
                          <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                      {candidates.map((c) => {
                        const o = effectiveOutcome(c);
                        return (
                          <tr key={c.student_id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 ${c.already_promoted ? 'opacity-60' : ''}`}>
                            <td className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">{c.position ?? '—'}</td>
                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{c.student_name}</td>
                            <td className="px-4 py-3 text-gray-500 font-mono text-xs">{c.student_reg_id ?? '—'}</td>
                            <td className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">{c.percentage != null ? `${c.percentage}%` : '—'}</td>
                            <td className="px-4 py-3">
                              {o ? (
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${OUTCOME_STYLES[o]}`}>
                                  {c.recommendation ?? OUTCOME_LABELS[o]}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">{c.recommendation ?? 'No results'}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {c.already_promoted ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><CheckCircle2 size={13} /> Recorded</span>
                              ) : (
                                <div className="relative w-40">
                                  <select
                                    value={o ?? ''}
                                    onChange={(e) => setOutcome(c.student_id, e.target.value as PromotionOutcome)}
                                    className={`${selectCls} w-full`}
                                  >
                                    <option value="" disabled>— Decide —</option>
                                    <option value="promoted">Promote</option>
                                    <option value="promoted_effort">Promote (Effort)</option>
                                    <option value="repeated">Repeat</option>
                                    <option value="graduated">Graduate</option>
                                  </select>
                                  <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Execute */}
              <RoleGuard roles={['principal', 'super_admin']}>
                <div className="flex justify-stretch sm:justify-end mt-5">
                  <Button
                    onClick={() => setConfirmOpen(true)}
                    disabled={pending.length === 0 || (needsTarget && !targetClassId && !graduate)}
                    className="w-full sm:w-auto"
                  >
                    <ArrowUpCircle size={16} className="mr-1.5" />
                    Process {pending.length} Student{pending.length !== 1 ? 's' : ''}
                  </Button>
                </div>
              </RoleGuard>
            </>
          )
        )}

        {/* ── HISTORY TAB ── */}
        {tab === 'history' && (
          historyLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={32} className="animate-spin text-blue-500" /></div>
          ) : history.length === 0 ? (
            <EmptyState message="No promotion records" description="Processed promotions will appear here." />
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <p className="sm:hidden text-[11px] text-gray-400 px-4 pt-3">Swipe sideways to see all columns.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      {['Student', 'Year', 'From', 'To', 'Outcome', '%', 'Source', 'Date'].map((h) => (
                        <th key={h} className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {history.map((h) => (
                      <tr key={h.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{h.student_name || h.student_reg_id}</td>
                        <td className="px-4 py-3 text-gray-500">{h.academic_year}</td>
                        <td className="px-4 py-3 text-gray-500">{h.from_class_name ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{h.to_class_name ?? (h.outcome === 'graduated' ? '🎓 Graduated' : '—')}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${OUTCOME_STYLES[h.outcome as PromotionOutcome] ?? ''}`}>
                            {OUTCOME_LABELS[h.outcome as PromotionOutcome] ?? h.outcome}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{h.yearly_percentage != null ? `${h.yearly_percentage}%` : '—'}</td>
                        <td className="px-4 py-3 text-gray-500 capitalize">{h.source}</td>
                        <td className="px-4 py-3 text-gray-500">{new Date(h.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}
      </PageShell>

      <ConfirmationDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleExecute}
        title="Confirm Promotions"
        message={(() => {
          const targetName = targetClasses.find((c) => String(c.id) === targetClassId)?.name;
          const lines: string[] = [];
          if (graduate) {
            lines.push(`Graduate ${stats.promoted} student(s): their enrolment is closed and they are marked graduated.`);
          } else {
            if (stats.promoted > 0) lines.push(`Promote ${stats.promoted} student(s)${targetName ? ` to ${targetName}` : ''} (a new enrolment is created there).`);
            if (stats.repeat > 0) lines.push(`Keep ${stats.repeat} student(s) in this class (repeat — nothing moves).`);
          }
          lines.push('Prior enrolments and all results/fees are preserved as history. This cannot be easily undone.');
          return lines.join('\n\n');
        })()}
        confirmLabel="Process"
      />
    </MainLayout>
  );
};

export default PromotionsPage;
