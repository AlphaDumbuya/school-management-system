/**
 * ScoreEntryGrid: the Cognitive Scores section of Results & Grades.
 *
 * The page is a PREVIEW and is never editable in place:
 *  - Pick a class, subject and term to see every student with their grades (a pencil per student opens a small
 *    window to correct that student, and is disabled when the student's scores are locked).
 *  - Pick only a class and you see how far along each subject is.
 *  - "Enter Grades" is always there. It opens a dialog to choose the subject, then a separate entry window
 *    (Save as draft / Submit) in which the grades are typed. See ScoreEntryModal.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Lock, Unlock, Download, Search, PenLine, ChevronRight } from 'lucide-react';
import { SearchableSelect } from '@components/admin/forms/SearchableSelect';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { SkeletonCard } from '@components/admin/feedback/Skeleton';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { saveBlob } from '@lib/download';
import { useAuth } from '@hooks/useAuth';
import { classesService } from '@services/classesService';
import { reportCardService, SL_TERMS, SLTerm, ScoreGridRow, getGrade } from '@services/reportCardService';
import { useEntrySubjects } from './useEntrySubjects';
import { EnterGradesDialog } from './EnterGradesDialog';
import { ScoreEntryModal } from './ScoreEntryModal';
import { StudentScoreDialog } from './StudentScoreDialog';
import { TABLE_HEAD, TH, toNum, EntryTarget } from './scoreUi';

interface Props {
  academicYear: string;
}

const csvCell = (v: unknown): string => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const ScoreEntryGrid: React.FC<Props> = ({ academicYear }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isStaffAdmin = user?.role === 'principal' || user?.role === 'super_admin';

  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [term, setTerm] = useState<SLTerm>('first_term');
  const [search, setSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [entry, setEntry] = useState<null | { target: EntryTarget; subjectName: string }>(null);
  const [rowStudent, setRowStudent] = useState<ScoreGridRow | null>(null);
  const [confirmUnlock, setConfirmUnlock] = useState(false);
  const [busy, setBusy] = useState<'lock' | null>(null);

  // Classes of the selected year: scores are keyed by that year's class rows.
  const { data: classesData } = useQuery({
    queryKey: ['score-classes', academicYear],
    queryFn: () => classesService.listClasses({ limit: 100, academic_year: academicYear }),
    enabled: !!academicYear,
    staleTime: 60_000,
  });
  const classes = (classesData as any)?.data ?? [];
  useEffect(() => { setClassId(''); setSubjectId(''); setEntry(null); }, [academicYear]);
  const classOptions = useMemo(
    () => classes.map((c: any) => ({ value: String(c.id), label: c.name, sublabel: c.level })),
    [classes],
  );

  const { subjects, isLoading: subjectsLoading } = useEntrySubjects(classId, term, academicYear);
  const subjectOptions = useMemo(() => subjects.map((s) => ({ value: s.value, label: s.label, sublabel: s.code ?? undefined })), [subjects]);
  useEffect(() => {
    if (subjectId && !subjectsLoading && subjects.length > 0 && !subjects.some((s) => s.value === subjectId)) setSubjectId('');
  }, [subjects, subjectsLoading, subjectId]);

  // The principal's lock setting decides what a teacher's submit does.
  const { data: settingsResp, isLoading: settingsLoading } = useQuery({
    queryKey: ['report-settings'],
    queryFn: () => reportCardService.getSettings(),
    staleTime: 60_000,
  });
  const settings: any = (settingsResp as any)?.data?.data ?? (settingsResp as any)?.data ?? null;
  // A teacher's submit takes away their own right to edit only when scores lock on entry AND teachers may not edit after a lock.
  const submitLocks = !!settings?.auto_lock_on_entry && !isStaffAdmin && !settings?.allow_teacher_edit_after_lock;
  // "Allow teachers to view results" off: no positions or class statistics for teachers (the server also withholds positions).
  const hideComputed = user?.role === 'teacher' && settings?.allow_teacher_view_results === false;

  const canLoad = !!(classId && subjectId && term && academicYear);
  const { data: gridData, isLoading, refetch } = useQuery({
    queryKey: ['score-grid', classId, subjectId, term, academicYear],
    queryFn: () => reportCardService.getGrid({ class_id: classId, subject_id: subjectId, term, academic_year: academicYear }),
    enabled: canLoad,
    staleTime: 0,
  });
  const gridRows: ScoreGridRow[] = useMemo(() => (gridData as any)?.data ?? [], [gridData]);
  useEffect(() => { setSearch(''); }, [classId, subjectId, term]);

  const subject = subjects.find((s) => s.value === subjectId);
  const className = classOptions.find((o: any) => o.value === classId)?.label ?? '';
  const termLabel = SL_TERMS.find((t) => t.value === term)?.label ?? term;

  const resultRows = gridRows.filter((r) => r.test1 != null || r.test2 != null);
  const gradedCount = resultRows.length;
  const draftCount = gridRows.filter((r) => r.has_draft).length;
  const lockedCount = gridRows.filter((r) => r.is_locked).length;
  const editableCount = gridRows.filter((r) => r.can_edit !== false).length;
  const allLocked = gradedCount > 0 && resultRows.every((r) => r.is_locked);
  const latestDraft = gridRows.map((r) => r.draft_saved_at).filter(Boolean).sort().pop() as string | undefined;

  const stats = useMemo(() => {
    const means = resultRows.map((r) => toNum(r.mean)).filter((m): m is number => m != null);
    if (!means.length) return null;
    const dist: Record<string, number> = {};
    means.forEach((m) => { const l = getGrade(m).letter; dist[l] = (dist[l] ?? 0) + 1; });
    return {
      avg: Math.round((means.reduce((a, b) => a + b, 0) / means.length) * 10) / 10,
      high: Math.max(...means),
      low: Math.min(...means),
      pass: Math.round((means.filter((m) => m >= 50).length / means.length) * 100),
      dist: Object.entries(dist).sort(([a], [b]) => a.localeCompare(b)),
    };
  }, [resultRows]);

  const shownRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return gridRows;
    return gridRows.filter((r) => `${r.student_name} ${r.roll_number}`.toLowerCase().includes(q));
  }, [gridRows, search]);

  const lastUpdate = useMemo(() => {
    const withTime = resultRows.filter((r) => r.updated_at).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0];
    return withTime ? { at: withTime.updated_at as string, by: withTime.entered_by_name } : null;
  }, [resultRows]);

  const refreshAll = async () => {
    await Promise.all([refetch(), queryClient.invalidateQueries({ queryKey: ['subject-progress'] })]);
    queryClient.invalidateQueries({ queryKey: ['class-ranking'] });
  };

  const doSetLock = async (locked: boolean) => {
    setBusy('lock');
    const res: any = await reportCardService.setLock({ class_id: classId, subject_id: subjectId, term, academic_year: academicYear, locked });
    setBusy(null);
    if (res?.success === false) { showToast.apiError(res.error); throw new Error('lock failed'); }
    if (!res?.data?.updated) { showToast.info('There are no submitted scores to ' + (locked ? 'lock' : 'unlock') + ' yet.'); return; }
    showToast.success(locked ? 'Scores locked. Teachers can no longer change them.' : 'Scores unlocked. Teachers can change them again.');
    await refreshAll();
  };

  const exportCsv = async () => {
    const head = ['Roll no', 'Student', 'Test 1', 'Test 2', 'Mean', 'Grade', ...(hideComputed ? [] : ['Position'])];
    const lines = gridRows.map((r) => {
      const m = toNum(r.mean);
      return [r.roll_number, r.student_name, toNum(r.test1) ?? '', toNum(r.test2) ?? '', m ?? '', m != null ? getGrade(m).letter : '', ...(hideComputed ? [] : [r.subject_rank ?? ''])];
    });
    const csv = '\uFEFF' + [head, ...lines].map((l) => l.map(csvCell).join(',')).join('\r\n');
    const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
    await saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `grades-${safe(className)}-${safe(subject?.label ?? 'subject')}-${term}.csv`);
  };

  const openEntry = (target: EntryTarget, subjectName: string) => {
    setClassId(target.classId); setSubjectId(target.subjectId); setTerm(target.term);
    setPickerOpen(false);
    setEntry({ target, subjectName });
  };

  const openEntryForSelection = () => {
    if (canLoad) openEntry({ classId, subjectId, term }, subject?.label ?? '');
    else setPickerOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-sm text-gray-600 dark:text-gray-400">Pick a class and subject to see its grades.</p>
        <Button variant="default" size="sm" onClick={() => setPickerOpen(true)} className="w-full sm:w-auto flex-shrink-0">
          <Pencil size={15} className="mr-1.5" /> Enter Grades
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <SearchableSelect label="Class" options={classOptions} value={classId} onChange={(v) => { setClassId(v); setSubjectId(''); }} placeholder="Select class..." />
        <SearchableSelect label="Subject" options={subjectOptions} value={subjectId} onChange={setSubjectId} placeholder={classId ? 'Select subject...' : 'Select a class first'} />
        <div className="flex flex-col gap-1">
          <label htmlFor="grades-term" className="text-sm font-medium text-gray-700 dark:text-gray-300">Term</label>
          <select
            id="grades-term" value={term} onChange={(e) => setTerm(e.target.value as SLTerm)}
            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
          >
            {SL_TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {!classId && (
        <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
          {classesData && classes.length === 0 ? `There are no classes to enter scores for in ${academicYear}.` : 'Select a class to see how its subjects are doing, or press Enter Grades.'}
        </div>
      )}

      {/* ── A class, no subject: how far along each subject is ───────────────────────────────────────── */}
      {classId && !subjectId && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{className} · {termLabel}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Choose a subject to see its grades.</p>
          </div>
          {subjectsLoading ? (
            <div className="p-4"><SkeletonCard /></div>
          ) : subjects.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-500">You don&apos;t teach any subject in this class this year.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {subjects.map((s) => {
                const pct = s.total ? Math.round(((s.entered ?? 0) / s.total) * 100) : 0;
                return (
                  <li key={s.value}>
                    <button type="button" onClick={() => setSubjectId(s.value)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-gray-900 dark:text-white truncate">{s.label}</span>
                        {s.entered != null && s.total != null && (
                          <span className="mt-1.5 flex items-center gap-2">
                            <span className="h-1.5 w-28 sm:w-40 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                              <span className="block h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                            </span>
                            <span className="text-[11px] text-gray-500 dark:text-gray-400">{s.entered}/{s.total} graded</span>
                          </span>
                        )}
                      </span>
                      {s.drafts > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">Draft</span>}
                      {s.locked > 0 && <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-700"><Lock size={10} /> Locked</span>}
                      <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* ── A class and a subject: the grades ──────────────────────────────────────────────────────────── */}
      {canLoad && isLoading && <div className="grid grid-cols-1 gap-3"><SkeletonCard /><SkeletonCard /></div>}

      {canLoad && !isLoading && gridRows.length === 0 && (
        <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
          No active students enrolled in this class.
        </div>
      )}

      {canLoad && !isLoading && gridRows.length > 0 && gradedCount === 0 && (
        <EmptyState
          message="No grades entered yet"
          description={`${subject?.label ?? 'This subject'} has no grades for ${className}, ${termLabel}${draftCount ? '. There is an unsubmitted draft.' : '.'}`}
          action={{ label: draftCount ? 'Continue draft' : 'Enter grades for this subject', onClick: openEntryForSelection }}
        />
      )}

      {canLoad && !isLoading && gridRows.length > 0 && gradedCount > 0 && (
        <>
          {/* summary */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <Stat label="Graded" value={`${gradedCount}/${gridRows.length}`} />
              {stats && !hideComputed && (
                <>
                  <Stat label="Class average" value={String(stats.avg)} />
                  <Stat label="Highest" value={String(stats.high)} />
                  <Stat label="Lowest" value={String(stats.low)} danger={stats.low < 50} />
                  <Stat label="Pass rate" value={`${stats.pass}%`} />
                </>
              )}
              {lockedCount > 0 && <Stat label="Locked" value={String(lockedCount)} />}
            </div>
            {stats && !hideComputed && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {stats.dist.map(([letter, n]) => (
                  <span key={letter} className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${letter === 'F' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{letter}: {n}</span>
                ))}
              </div>
            )}
            {lastUpdate && (
              <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                Last updated {new Date(lastUpdate.at).toLocaleString()}{lastUpdate.by ? ` by ${lastUpdate.by}` : ''}
              </p>
            )}
          </div>

          {draftCount > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <span>
                You have an unsubmitted <strong>draft</strong> for {draftCount} {draftCount === 1 ? 'student' : 'students'}
                {latestDraft ? <>, last saved {new Date(latestDraft).toLocaleString()}</> : null}. It is not counted in rankings or report cards until you submit it.
              </span>
              <button type="button" onClick={openEntryForSelection} className="text-xs font-bold text-amber-800 hover:underline">Continue draft</button>
            </div>
          )}

          {editableCount === 0 && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              <Lock size={13} className="inline mr-1.5 -mt-0.5" />
              These scores are locked. Ask the principal to unlock them if something needs correcting.
            </div>
          )}

          {/* toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            {gridRows.length > 8 ? (
              <div className="relative sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search students"
                  aria-label="Search students"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                />
              </div>
            ) : <span />}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" size="sm" onClick={() => void exportCsv()}>
                <Download size={14} className="mr-1.5" /> Export CSV
              </Button>
              {isStaffAdmin && (
                allLocked ? (
                  <Button variant="outline" size="sm" onClick={() => setConfirmUnlock(true)} disabled={busy !== null}>
                    <Unlock size={14} className="mr-1.5" /> Unlock scores
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => void doSetLock(true).catch(() => undefined)} disabled={busy !== null}>
                    <Lock size={14} className="mr-1.5" /> {busy === 'lock' ? 'Locking...' : 'Lock scores'}
                  </Button>
                )
              )}
            </div>
          </div>

          {/* the preview table: read only */}
          <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl">
            <table className="w-full text-sm min-w-[600px]">
              <thead className={TABLE_HEAD}>
                <tr>
                  <th className={`text-left ${TH} min-w-[140px]`}>Student</th>
                  <th className={`text-center ${TH} w-20`}>Test 1</th>
                  <th className={`text-center ${TH} w-20`}>Test 2</th>
                  <th className={`text-center ${TH} w-20`}>Mean</th>
                  <th className={`text-center ${TH} w-16`}>Grade</th>
                  {!hideComputed && <th className={`text-center ${TH} w-16`}>Pos.</th>}
                  <th className={`text-center ${TH} w-24`}>Status</th>
                  <th className={`text-center ${TH} w-14`}><span className="sr-only">Edit</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {shownRows.length === 0 && (
                  <tr><td colSpan={8} className="p-6 text-center text-sm text-gray-500">No student matches “{search}”.</td></tr>
                )}
                {shownRows.map((r, i) => {
                  const mean = toNum(r.mean);
                  const g = getGrade(mean);
                  const locked = r.can_edit === false;
                  return (
                    <tr key={r.student_id} className={`transition-colors hover:bg-sky-100 dark:hover:bg-gray-800/50 ${i % 2 === 1 ? 'bg-sky-50 dark:bg-gray-900/40' : 'bg-white dark:bg-transparent'}`}>
                      <td className="py-2 px-3">
                        <p className="font-medium text-gray-900 dark:text-white">{r.student_name}</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">{r.roll_number}</p>
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-gray-900 dark:text-white">{toNum(r.test1) ?? '—'}</td>
                      <td className="py-2 px-3 text-center font-mono text-gray-900 dark:text-white">{toNum(r.test2) ?? '—'}</td>
                      <td className="py-2 px-2 text-center">
                        <span className={`font-mono font-bold ${mean != null && mean < 50 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>{mean ?? '—'}</span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        {mean != null && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${g.isFail ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'}`}>{g.letter}</span>
                        )}
                      </td>
                      {!hideComputed && <td className="py-2 px-2 text-center font-mono text-gray-700 dark:text-gray-300">{r.subject_rank ?? '—'}</td>}
                      <td className="py-2 px-2 text-center">
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          {r.is_locked && (
                            <span
                              title={locked ? 'Locked: only the principal can change this' : 'Locked, but you are allowed to change it'}
                              className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                            >
                              <Lock size={10} /> Locked
                            </span>
                          )}
                          {r.has_draft && (
                            <span title={`Draft: ${r.draft_test1 ?? '—'} / ${r.draft_test2 ?? '—'} (not submitted)`} className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                              Draft
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => setRowStudent(r)}
                          aria-label={locked ? `${r.student_name}: scores are locked` : `Edit scores for ${r.student_name}`}
                          title={locked ? 'Locked: only the principal can change this' : 'Edit scores'}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent dark:disabled:text-gray-600"
                        >
                          {locked ? <Lock size={14} /> : <PenLine size={15} />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <EnterGradesDialog
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        academicYear={academicYear}
        classOptions={classOptions}
        initial={{ classId, subjectId, term }}
        onContinue={openEntry}
      />

      {entry && (
        <ScoreEntryModal
          isOpen
          onClose={(changed) => { setEntry(null); if (changed) void refreshAll(); }}
          target={{
            ...entry.target, academicYear, subjectName: entry.subjectName,
            className: classOptions.find((o: any) => o.value === entry.target.classId)?.label ?? className,
            termLabel: SL_TERMS.find((t) => t.value === entry.target.term)?.label ?? entry.target.term,
          }}
          submitLocks={submitLocks}
          settingsReady={!settingsLoading}
        />
      )}

      <StudentScoreDialog
        student={rowStudent}
        onClose={() => setRowStudent(null)}
        onSaved={() => void refreshAll()}
        target={{ classId, subjectId, term, academicYear, subjectName: subject?.label ?? '', termLabel }}
        submitLocks={submitLocks}
        settingsReady={!settingsLoading}
      />

      <ConfirmationDialog
        isOpen={confirmUnlock}
        onClose={() => setConfirmUnlock(false)}
        onConfirm={() => doSetLock(false)}
        title="Unlock these scores?"
        message="Teachers will be able to change these submitted scores again. Lock them again when the corrections are done."
        confirmLabel="Unlock"
        isDestructive={false}
      />
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; danger?: boolean }> = ({ label, value, danger }) => (
  <div>
    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
    <p className={`text-lg font-black ${danger ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>{value}</p>
  </div>
);

export default ScoreEntryGrid;
