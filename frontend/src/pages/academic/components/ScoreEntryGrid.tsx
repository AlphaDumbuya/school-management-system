/**
 * ScoreEntryGrid — Booklet-style cognitive scores
 *
 * Two modes:
 *  - VIEW (default): pick Class + Subject + Term and see every student with their grades, read only.
 *    A teacher can look here without any risk of changing something. "Enter Grades" opens the editor.
 *  - EDIT: Test 1 & Test 2 for every student; Mean = (Test1 + Test2)/2 is shown live and ranks are
 *    computed on the server after a submit.
 *      Save as draft  keeps the work in progress. A draft is never locked and is not counted in ranks,
 *                     report cards or what students and parents see, so it can be changed again and again.
 *      Submit scores  makes the scores real. If the principal set scores to lock on entry
 *                     (Settings > Grading & Results), a teacher's submit locks them, so we ask first.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Calculator, Pencil, ArrowLeft, Lock, Unlock, Trash2, Send } from 'lucide-react';
import { SearchableSelect } from '@components/admin/forms/SearchableSelect';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { Button } from '@components/ui/button';
import { SkeletonCard } from '@components/admin/feedback/Skeleton';
import { showToast } from '@utils/toast';
import { useAuth } from '@hooks/useAuth';
import { classesService } from '@services/classesService';
import { subjectsService } from '@services/subjectsService';
import {
  reportCardService, SL_TERMS, SLTerm, ScoreGridRow, getGrade,
} from '@services/reportCardService';

interface Props {
  academicYear: string;
}

interface EditableRow extends ScoreGridRow {
  _t1: string;
  _t2: string;
}

const TABLE_HEAD = 'bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#3b82f6] border-b border-blue-700';
const TH = 'py-3 px-3 font-bold text-xs text-white uppercase tracking-wider';

function liveMean(t1: string, t2: string): number | null {
  const a = t1 === '' ? null : Number(t1);
  const b = t2 === '' ? null : Number(t2);
  if (a == null && b == null) return null;
  if (a != null && b != null) return Math.round(((a + b) / 2) * 10) / 10;
  return Math.round((a ?? b)! * 10) / 10;
}

const toStr = (v: number | string | null | undefined): string => (v == null || v === '' ? '' : String(Number(v)));
const toNum = (v: number | string | null | undefined): number | null => (v == null || v === '' ? null : Number(v));
const snapshotOf = (list: EditableRow[]): Record<string, string> =>
  Object.fromEntries(list.map((r) => [r.student_id, `${r._t1}|${r._t2}`]));

export const ScoreEntryGrid: React.FC<Props> = ({ academicYear }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isStaffAdmin = user?.role === 'principal' || user?.role === 'super_admin';

  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [term, setTerm] = useState<SLTerm>('first_term');
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [baseline, setBaseline] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<'draft' | 'submit' | 'discard' | 'lock' | null>(null);
  const [confirm, setConfirm] = useState<null | 'submit' | 'discard' | 'leave' | 'unlock'>(null);

  // Dropdown data
  // Classes of the selected year — scores are keyed by that year's class rows.
  const { data: classesData } = useQuery({
    queryKey: ['score-classes', academicYear],
    queryFn: () => classesService.listClasses({ limit: 100, academic_year: academicYear }),
    enabled: !!academicYear,
    staleTime: 60_000,
  });
  const classes = (classesData as any)?.data ?? [];
  // Changing the year drops a class picked from another year.
  useEffect(() => { setClassId(''); setRows([]); setMode('view'); }, [academicYear]);
  const classOptions = useMemo(
    () => classes.map((c: any) => ({ value: String(c.id), label: c.name, sublabel: c.level })),
    [classes],
  );

  const { data: subjectsData } = useQuery({
    queryKey: ['subjects-dropdown'],
    queryFn: () => subjectsService.listSubjects({ limit: 100, status: 'active' }),
    staleTime: 60_000,
  });
  const subjects = (subjectsData as any)?.data ?? [];

  // Restrict subjects to what the teacher may enter for the selected class.
  // For staff-admins the endpoint returns null (no restriction).
  const { data: mySubjectsData } = useQuery({
    queryKey: ['my-subjects', classId],
    queryFn: () => reportCardService.getMySubjects(classId),
    enabled: !!classId,
    staleTime: 60_000,
  });
  const allowedSubjectIds: string[] | null = (mySubjectsData as any)?.data?.data
    ?? (mySubjectsData as any)?.data
    ?? null;

  const subjectOptions = useMemo(() => {
    const list = Array.isArray(allowedSubjectIds)
      ? subjects.filter((s: any) => allowedSubjectIds.map(String).includes(String(s.id)))
      : subjects;
    return list.map((s: any) => ({ value: String(s.id), label: s.name, sublabel: s.code }));
  }, [subjects, allowedSubjectIds]);

  // If the chosen subject isn't valid for the current class, clear it.
  useEffect(() => {
    if (subjectId && subjectOptions.length > 0 && !subjectOptions.some((o: any) => o.value === subjectId)) {
      setSubjectId('');
    }
  }, [subjectOptions, subjectId]);

  // The principal's lock setting decides what a teacher's submit does.
  const { data: settingsResp, isLoading: settingsLoading } = useQuery({
    queryKey: ['report-settings'],
    queryFn: () => reportCardService.getSettings(),
    staleTime: 60_000,
  });
  const settings: any = (settingsResp as any)?.data?.data ?? (settingsResp as any)?.data ?? null;
  // A teacher's submit takes away their own right to edit only when scores lock on entry AND teachers may not edit after a lock.
  const submitLocks = !!settings?.auto_lock_on_entry && !isStaffAdmin && !settings?.allow_teacher_edit_after_lock;
  // "Allow teachers to view results" off: no positions for teachers (the server also withholds them).
  const hidePositions = user?.role === 'teacher' && settings?.allow_teacher_view_results === false;

  // Grid data
  const canLoad = !!(classId && subjectId && term && academicYear);
  const { data: gridData, isLoading, refetch } = useQuery({
    queryKey: ['score-grid', classId, subjectId, term, academicYear],
    queryFn: () => reportCardService.getGrid({ class_id: classId, subject_id: subjectId, term, academic_year: academicYear }),
    enabled: canLoad,
    staleTime: 0,
    // While editing, the rows below are the teacher's own work; never refetch under them.
    refetchOnWindowFocus: mode === 'view',
  });
  const gridRows: ScoreGridRow[] = useMemo(() => (gridData as any)?.data ?? [], [gridData]);

  // Picking another class, subject or term always goes back to the read-only view.
  useEffect(() => { setMode('view'); setRows([]); }, [classId, subjectId, term]);

  const draftCount = gridRows.filter((r) => r.has_draft).length;
  const editableCount = gridRows.filter((r) => r.can_edit !== false).length;
  const lockedCount = gridRows.filter((r) => r.is_locked).length;
  const resultRows = gridRows.filter((r) => r.test1 != null || r.test2 != null);
  const gradedCount = resultRows.length;
  const allLocked = gradedCount > 0 && resultRows.every((r) => r.is_locked);
  const latestDraft = gridRows.map((r) => r.draft_saved_at).filter(Boolean).sort().pop() as string | undefined;

  const dirty = mode === 'edit' && rows.some((r) => r.can_edit !== false && baseline[r.student_id] !== `${r._t1}|${r._t2}`);

  // A closed tab or reload would throw unsaved typing away.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const startEditing = () => {
    const next: EditableRow[] = gridRows.map((r) => {
      const useDraft = !!r.has_draft && r.can_edit !== false;
      return {
        ...r,
        _t1: toStr(useDraft ? r.draft_test1 : r.test1),
        _t2: toStr(useDraft ? r.draft_test2 : r.test2),
      };
    });
    setRows(next);
    setBaseline(snapshotOf(next));
    setMode('edit');
  };

  const updateCell = (studentId: string, field: '_t1' | '_t2', value: string) => {
    // Clamp 0-100, allow empty
    if (value !== '' && (Number(value) < 0 || Number(value) > 100 || isNaN(Number(value)))) return;
    setRows((prev) => prev.map((r) => (r.student_id === studentId ? { ...r, [field]: value } : r)));
  };

  const payloadFor = (list: EditableRow[]) => ({
    class_id: classId,
    subject_id: subjectId,
    academic_year: academicYear,
    term,
    scores: list.map((r) => ({ student_id: r.student_id, test1: toNum(r._t1), test2: toNum(r._t2) })),
  });

  const handleSaveDraft = async () => {
    if (!canLoad) { showToast.error('Select class, subject and term first'); return; }
    setBusy('draft');
    const res: any = await reportCardService.saveScoreDraft(payloadFor(rows.filter((r) => r.can_edit !== false)));
    setBusy(null);
    if (res?.success === false) { showToast.apiError(res.error); return; }
    showToast.success(res?.message || 'Draft saved');
    setBaseline(snapshotOf(rows));
    refetch();
  };

  const doSubmit = async () => {
    // Only students who have a score now, or had one that is being corrected. Students whose scores are
    // not in yet are left alone (a blank row would be created, and locked, for nothing).
    const toSend = rows.filter(
      (r) => r.can_edit !== false && (r._t1 !== '' || r._t2 !== '' || r.test1 != null || r.test2 != null),
    );
    if (!toSend.length) { showToast.error('Enter at least one score first'); return; }
    setBusy('submit');
    const res: any = await reportCardService.saveScores(payloadFor(toSend));
    setBusy(null);
    if (res?.success === false) { showToast.apiError(res.error); throw new Error('submit failed'); }
    showToast.success(res?.message || 'Scores submitted');
    queryClient.invalidateQueries({ queryKey: ['class-ranking'] });
    await refetch();
    setRows([]);
    setMode('view');
  };

  const handleSubmitClick = () => {
    if (!canLoad) { showToast.error('Select class, subject and term first'); return; }
    if (submitLocks) setConfirm('submit');
    else void doSubmit().catch(() => undefined);
  };

  const doDiscard = async () => {
    setBusy('discard');
    const res: any = await reportCardService.discardScoreDraft({ class_id: classId, subject_id: subjectId, term, academic_year: academicYear });
    setBusy(null);
    if (res?.success === false) { showToast.apiError(res.error); throw new Error('discard failed'); }
    showToast.success('Draft discarded');
    const fresh: any = await refetch();
    // Back to what is actually saved.
    const list: ScoreGridRow[] = fresh?.data?.data ?? [];
    const next: EditableRow[] = list.map((r) => ({ ...r, _t1: toStr(r.test1), _t2: toStr(r.test2) }));
    setRows(next);
    setBaseline(snapshotOf(next));
  };

  // Principal only: lock or unlock the submitted scores of this subject for teachers.
  const doSetLock = async (locked: boolean) => {
    setBusy('lock');
    const res: any = await reportCardService.setLock({ class_id: classId, subject_id: subjectId, term, academic_year: academicYear, locked });
    setBusy(null);
    if (res?.success === false) { showToast.apiError(res.error); throw new Error('lock failed'); }
    if (!res?.data?.updated) { showToast.info('There are no submitted scores to ' + (locked ? 'lock' : 'unlock') + ' yet.'); return; }
    showToast.success(locked ? 'Scores locked. Teachers can no longer change them.' : 'Scores unlocked. Teachers can change them again.');
    await refetch();
  };

  const leaveEditing = () => {
    if (dirty) setConfirm('leave');
    else { setMode('view'); setRows([]); }
  };

  const className = classOptions.find((o: any) => o.value === classId)?.label ?? '';
  const subjectName = subjectOptions.find((o: any) => o.value === subjectId)?.label ?? '';
  const termLabel = SL_TERMS.find((t) => t.value === term)?.label ?? term;
  const enteredCount = rows.filter((r) => r._t1 !== '' || r._t2 !== '').length;

  return (
    <div className="space-y-4">
      {/* Selectors (view mode) / what is being edited (edit mode) */}
      {mode === 'view' ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <SearchableSelect label="Class" options={classOptions} value={classId} onChange={setClassId} placeholder="Select class..." />
          <SearchableSelect label="Subject" options={subjectOptions} value={subjectId} onChange={setSubjectId} placeholder="Select subject..." />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Term</label>
            <select
              value={term}
              onChange={(e) => setTerm(e.target.value as SLTerm)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
            >
              {SL_TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 bg-white dark:bg-gray-800 rounded-xl border border-blue-200 dark:border-blue-900/50">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Entering grades</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{className} · {subjectName} · {termLabel} · {academicYear}</p>
          </div>
          <Button variant="outline" size="sm" onClick={leaveEditing} className="w-full sm:w-auto flex-shrink-0">
            <ArrowLeft size={14} className="mr-1.5" /> Back to grades
          </Button>
        </div>
      )}

      {!canLoad && (
        <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
          {classesData && classes.length === 0
            ? `There are no classes to enter scores for in ${academicYear}.`
            : classId && subjectOptions.length === 0 && mySubjectsData
              ? "You don't teach any subject in this class this year."
              : 'Select a class, subject and term to see the grades.'}
        </div>
      )}

      {canLoad && isLoading && (
        <div className="grid grid-cols-1 gap-3"><SkeletonCard /><SkeletonCard /></div>
      )}

      {canLoad && !isLoading && gridRows.length === 0 && (
        <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
          No active students enrolled in this class.
        </div>
      )}

      {/* ───────────────────────── VIEW: students with their grades ───────────────────────── */}
      {canLoad && !isLoading && gridRows.length > 0 && mode === 'view' && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {gradedCount}/{gridRows.length} students graded · <span className="text-red-600 dark:text-red-400 font-semibold">Below 50 = Fail</span>
              {lockedCount > 0 && <> · <Lock size={11} className="inline -mt-0.5" /> {lockedCount} locked</>}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto flex-shrink-0">
              {isStaffAdmin && gradedCount > 0 && (
                allLocked ? (
                  <Button variant="outline" size="sm" onClick={() => setConfirm('unlock')} disabled={busy !== null} className="w-full sm:w-auto">
                    <Unlock size={15} className="mr-1.5" /> Unlock scores
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => void doSetLock(true).catch(() => undefined)} disabled={busy !== null} className="w-full sm:w-auto">
                    <Lock size={15} className="mr-1.5" /> {busy === 'lock' ? 'Locking...' : 'Lock scores'}
                  </Button>
                )
              )}
              <Button
                variant="default" size="sm" onClick={startEditing}
                disabled={editableCount === 0}
                className="w-full sm:w-auto"
              >
                <Pencil size={15} className="mr-1.5" /> {draftCount > 0 ? 'Continue draft' : 'Enter Grades'}
              </Button>
            </div>
          </div>

          {draftCount > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <span>
                You have an unsubmitted <strong>draft</strong> for {draftCount} {draftCount === 1 ? 'student' : 'students'}
                {latestDraft ? <>, last saved {new Date(latestDraft).toLocaleString()}</> : null}. It is not counted in
                rankings or report cards until you submit it.
              </span>
              <button type="button" onClick={startEditing} className="text-xs font-bold text-amber-800 hover:underline">Continue draft</button>
            </div>
          )}

          {editableCount === 0 && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              <Lock size={13} className="inline mr-1.5 -mt-0.5" />
              These scores are locked. Ask the principal to unlock them if something needs correcting.
            </div>
          )}

          <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl">
            <table className="w-full text-sm min-w-[560px]">
              <thead className={TABLE_HEAD}>
                <tr>
                  <th className={`text-left ${TH} min-w-[140px]`}>Student</th>
                  <th className={`text-center ${TH} w-20`}>Test 1</th>
                  <th className={`text-center ${TH} w-20`}>Test 2</th>
                  <th className={`text-center ${TH} w-20`}>Mean</th>
                  <th className={`text-center ${TH} w-16`}>Grade</th>
                  {!hidePositions && <th className={`text-center ${TH} w-16`}>Pos.</th>}
                  <th className={`text-center ${TH} w-24`}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {gridRows.map((r, i) => {
                  const mean = toNum(r.mean);
                  const g = getGrade(mean);
                  const t1 = toNum(r.test1);
                  const t2 = toNum(r.test2);
                  return (
                    <tr key={r.student_id} className={`transition-colors hover:bg-sky-100 dark:hover:bg-gray-800/50 ${i % 2 === 1 ? 'bg-sky-50 dark:bg-gray-900/40' : 'bg-white dark:bg-transparent'}`}>
                      <td className="py-2 px-3">
                        <p className="font-medium text-gray-900 dark:text-white">{r.student_name}</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">{r.roll_number}</p>
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-gray-900 dark:text-white">{t1 ?? '—'}</td>
                      <td className="py-2 px-3 text-center font-mono text-gray-900 dark:text-white">{t2 ?? '—'}</td>
                      <td className="py-2 px-2 text-center">
                        <span className={`font-mono font-bold ${mean != null && mean < 50 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                          {mean ?? '—'}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        {mean != null && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${g.isFail ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'}`}>
                            {g.letter}
                          </span>
                        )}
                      </td>
                      {!hidePositions && <td className="py-2 px-2 text-center font-mono text-gray-700 dark:text-gray-300">{r.subject_rank ?? '—'}</td>}
                      <td className="py-2 px-2 text-center">
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          {r.is_locked && (
                            <span title={r.can_edit === false ? 'Locked: only the principal can change this' : 'Locked, but the principal allows teachers to edit locked scores'} className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                              <Lock size={10} /> Locked
                            </span>
                          )}
                          {r.has_draft && (
                            <span
                              title={`Draft: ${r.draft_test1 ?? '—'} / ${r.draft_test2 ?? '—'} (not submitted)`}
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                            >
                              Draft
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ───────────────────────── EDIT: enter grades ───────────────────────── */}
      {canLoad && !isLoading && rows.length > 0 && mode === 'edit' && (
        <>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <Calculator size={12} className="inline mr-1" />
              Mean = (Test 1 + Test 2) ÷ 2 · <span className="text-red-600 dark:text-red-400 font-semibold">Below 50 = Fail</span> · {enteredCount}/{rows.length} entered
              {dirty && <span className="ml-2 font-semibold text-amber-700 dark:text-amber-400">· Unsaved changes</span>}
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              {draftCount > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setConfirm('discard')} disabled={busy !== null} className="text-red-600 hover:text-red-700">
                  <Trash2 size={14} className="mr-1.5" /> Discard draft
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={busy !== null}>
                <Save size={15} className="mr-1.5" /> {busy === 'draft' ? 'Saving draft...' : 'Save as draft'}
              </Button>
              <Button variant="default" size="sm" onClick={handleSubmitClick} disabled={busy !== null || settingsLoading}>
                <Send size={15} className="mr-1.5" /> {busy === 'submit' ? 'Submitting...' : 'Submit scores'}
              </Button>
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            <strong>Save as draft</strong> keeps your work and you can change it again. <strong>Submit scores</strong> makes it official
            {submitLocks ? ' and locks it: only the principal can change it afterwards.' : '.'}
          </p>

          <p className="sm:hidden text-[11px] text-gray-400">Swipe sideways if the table is wider than your screen.</p>
          <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl">
            <table className="w-full text-sm min-w-[540px]">
              <thead className={TABLE_HEAD}>
                <tr>
                  <th className={`text-left ${TH} min-w-[140px]`}>Student</th>
                  <th className={`text-center ${TH} w-32 sm:w-40`}>Test 1</th>
                  <th className={`text-center ${TH} w-32 sm:w-40`}>Test 2</th>
                  <th className={`text-center ${TH} w-20`}>Mean</th>
                  <th className={`text-center ${TH} w-16`}>Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {rows.map((r, rowIndex) => {
                  const mean = liveMean(r._t1, r._t2);
                  const g = getGrade(mean);
                  const readOnly = r.can_edit === false;
                  return (
                    <tr key={r.student_id} className={`transition-colors hover:bg-sky-100 dark:hover:bg-gray-800/50 ${rowIndex % 2 === 1 ? 'bg-sky-50 dark:bg-gray-900/40' : 'bg-white dark:bg-transparent'}`}>
                      <td className="py-2 px-3">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {r.student_name}
                          {readOnly && <Lock size={11} className="inline ml-1.5 -mt-0.5 text-gray-500" aria-label="Locked" />}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">{r.roll_number}</p>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text" inputMode="numeric" maxLength={3}
                          value={r._t1} disabled={readOnly}
                          aria-label={`Test 1 for ${r.student_name}`}
                          onChange={(e) => updateCell(r.student_id, '_t1', e.target.value)}
                          className="w-full text-center px-2 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:bg-gray-800"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text" inputMode="numeric" maxLength={3}
                          value={r._t2} disabled={readOnly}
                          aria-label={`Test 2 for ${r.student_name}`}
                          onChange={(e) => updateCell(r.student_id, '_t2', e.target.value)}
                          className="w-full text-center px-2 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:bg-gray-800"
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className={`font-mono font-bold ${mean != null && mean < 50 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                          {mean ?? '—'}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        {mean != null && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${g.isFail ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'}`}>
                            {g.letter}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={busy !== null}>
              <Save size={15} className="mr-1.5" /> {busy === 'draft' ? 'Saving draft...' : 'Save as draft'}
            </Button>
            <Button variant="default" size="sm" onClick={handleSubmitClick} disabled={busy !== null || settingsLoading}>
              <Send size={15} className="mr-1.5" /> {busy === 'submit' ? 'Submitting...' : 'Submit scores'}
            </Button>
          </div>
        </>
      )}

      <ConfirmationDialog
        isOpen={confirm === 'submit'}
        onClose={() => setConfirm(null)}
        onConfirm={doSubmit}
        title="Submit and lock these scores?"
        message="The principal has set scores to lock as soon as they are submitted. After this only the principal can change them. If you are not sure yet, choose Cancel and use Save as draft instead."
        confirmLabel="Submit and lock"
        isDestructive={false}
      />
      <ConfirmationDialog
        isOpen={confirm === 'discard'}
        onClose={() => setConfirm(null)}
        onConfirm={doDiscard}
        title="Discard this draft?"
        message="The draft for this class, subject and term is deleted and the form goes back to the scores that are already submitted. This cannot be undone."
        confirmLabel="Discard draft"
      />
      <ConfirmationDialog
        isOpen={confirm === 'unlock'}
        onClose={() => setConfirm(null)}
        onConfirm={() => doSetLock(false)}
        title="Unlock these scores?"
        message="Teachers will be able to change these submitted scores again. Lock them again when the corrections are done."
        confirmLabel="Unlock"
        isDestructive={false}
      />
      <ConfirmationDialog
        isOpen={confirm === 'leave'}
        onClose={() => setConfirm(null)}
        onConfirm={() => { setMode('view'); setRows([]); }}
        title="Leave without saving?"
        message="You have changes that are not saved. Choose Cancel and use Save as draft to keep them."
        confirmLabel="Leave without saving"
      />
    </div>
  );
};

export default ScoreEntryGrid;
