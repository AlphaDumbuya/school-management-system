/**
 * ScoreEntryModal: the window where grades are typed for ONE class, subject and term.
 *
 * The page behind it (the preview table) is never edited. Everything typed here lives in this window until:
 *   Save as draft  keeps it. A draft is never locked and never counted anywhere.
 *   Submit scores  makes it official, after a review. If the principal set scores to lock on entry, a teacher's
 *                  submit locks them, and the review says so.
 * Helpers: Enter moves down the column; a locked student is shown but cannot be edited and is never sent.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Save, Send, Trash2, Lock, Calculator } from 'lucide-react';
import { Modal } from '@components/admin/feedback/Modal';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { SkeletonCard } from '@components/admin/feedback/Skeleton';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { reportCardService, SLTerm, ScoreGridRow, getGrade } from '@services/reportCardService';
import {
  EditableRow, FIELD_LABEL, INPUT_CLASS, ScoreField, TABLE_HEAD, TH,
  isValidScoreText, liveMean, snapshotKey, toNum, toStr,
} from './scoreUi';

interface Props {
  isOpen: boolean;
  /** `changed` is true when something was saved or submitted, so the page can refresh. */
  onClose: (changed: boolean) => void;
  target: { classId: string; subjectId: string; term: SLTerm; academicYear: string; className: string; subjectName: string; termLabel: string };
  /** True when a teacher's submit would lock these scores (principal's setting). */
  submitLocks: boolean;
  settingsReady: boolean;
}

export const ScoreEntryModal: React.FC<Props> = ({ isOpen, onClose, target, submitLocks, settingsReady }) => {
  const { classId, subjectId, term, academicYear } = target;

  const { data: gridData, isLoading, refetch } = useQuery({
    queryKey: ['score-entry-grid', classId, subjectId, term, academicYear],
    queryFn: () => reportCardService.getGrid({ class_id: classId, subject_id: subjectId, term, academic_year: academicYear }),
    enabled: isOpen && !!classId && !!subjectId,
    staleTime: 0,
    gcTime: 0,
    // What the teacher is typing must never be replaced by a background refresh.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const gridRows: ScoreGridRow[] = useMemo(() => (gridData as any)?.data ?? [], [gridData]);

  const [rows, setRows] = useState<EditableRow[]>([]);
  const [baseline, setBaseline] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<'draft' | 'submit' | 'discard' | null>(null);
  const [changedSomething, setChangedSomething] = useState(false);
  const [confirm, setConfirm] = useState<null | 'submit' | 'discard' | 'leave'>(null);
  const [hint, setHint] = useState('');
  const loadedFor = useRef('');

  // Fill the form once per opening from the freshly loaded grid (the draft wins over the saved score).
  useEffect(() => {
    if (!isOpen) { loadedFor.current = ''; return; }
    if (isLoading || !gridData) return;
    const key = `${classId}|${subjectId}|${term}|${academicYear}`;
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    const next: EditableRow[] = gridRows.map((r) => {
      const useDraft = !!r.has_draft && r.can_edit !== false;
      return { ...r, _t1: toStr(useDraft ? r.draft_test1 : r.test1), _t2: toStr(useDraft ? r.draft_test2 : r.test2) };
    });
    setRows(next);
    setBaseline(snapshotKey(next));
    setChangedSomething(false);
  }, [isOpen, isLoading, gridData, gridRows, classId, subjectId, term, academicYear]);

  const editable = rows.filter((r) => r.can_edit !== false);
  const dirty = rows.some((r) => r.can_edit !== false && baseline[r.student_id] !== `${r._t1}|${r._t2}`);
  const draftCount = gridRows.filter((r) => r.has_draft).length;
  const enteredCount = rows.filter((r) => r._t1 !== '' || r._t2 !== '').length;

  // A closed tab or reload would throw unsaved typing away.
  useEffect(() => {
    if (!isOpen || !dirty) return undefined;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isOpen, dirty]);

  const showHint = (text: string) => {
    setHint(text);
    window.setTimeout(() => setHint((h) => (h === text ? '' : h)), 2600);
  };

  const setCell = (studentId: string, field: ScoreField, value: string) => {
    setRows((prev) => prev.map((r) => (r.student_id === studentId ? { ...r, [field]: value } : r)));
  };

  const onType = (studentId: string, field: ScoreField, value: string) => {
    if (!isValidScoreText(value)) { showHint('Scores are whole numbers from 0 to 100.'); return; }
    setCell(studentId, field, value);
  };

  // Enter moves down the same column (to the next student that can be edited).
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, field: ScoreField) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    for (let i = rowIndex + 1; i < rows.length; i += 1) {
      const el = document.querySelector<HTMLInputElement>(`[data-cell="${i}-${field}"]:not([disabled])`);
      if (el) { el.focus(); el.select(); return; }
    }
    (e.target as HTMLInputElement).blur();
  };

  const payloadFor = (list: EditableRow[]) => ({
    class_id: classId, subject_id: subjectId, academic_year: academicYear, term,
    scores: list.map((r) => ({ student_id: r.student_id, test1: toNum(r._t1), test2: toNum(r._t2) })),
  });

  const saveDraft = async () => {
    setBusy('draft');
    const res: any = await reportCardService.saveScoreDraft(payloadFor(editable));
    setBusy(null);
    if (res?.success === false) { showToast.apiError(res.error); return; }
    showToast.success(res?.message || 'Draft saved');
    setBaseline(snapshotKey(rows));
    setChangedSomething(true);
    void refetch();
  };

  // Only students who have a score now, or had one that is being corrected.
  const toSend = editable.filter((r) => r._t1 !== '' || r._t2 !== '' || r.test1 != null || r.test2 != null);
  const blank = editable.filter((r) => r._t1 === '' && r._t2 === '' && r.test1 == null && r.test2 == null);
  const failing = toSend.filter((r) => { const m = liveMean(r._t1, r._t2); return m != null && m < 50; });

  const submit = async () => {
    setBusy('submit');
    const res: any = await reportCardService.saveScores(payloadFor(toSend));
    setBusy(null);
    if (res?.success === false) { showToast.apiError(res.error); throw new Error('submit failed'); }
    showToast.success(res?.message || 'Scores submitted');
    onClose(true);
  };

  const askSubmit = () => {
    if (!toSend.length) { showToast.error('Enter at least one score first'); return; }
    setConfirm('submit');
  };

  const discard = async () => {
    setBusy('discard');
    const res: any = await reportCardService.discardScoreDraft({ class_id: classId, subject_id: subjectId, term, academic_year: academicYear });
    setBusy(null);
    if (res?.success === false) { showToast.apiError(res.error); throw new Error('discard failed'); }
    showToast.success('Draft discarded');
    setChangedSomething(true);
    const fresh: any = await refetch();
    const list: ScoreGridRow[] = fresh?.data?.data ?? [];
    const next: EditableRow[] = list.map((r) => ({ ...r, _t1: toStr(r.test1), _t2: toStr(r.test2) }));
    setRows(next);
    setBaseline(snapshotKey(next));
  };

  const requestClose = () => { if (dirty) setConfirm('leave'); else onClose(changedSomething); };

  const footer = (
    <>
      {draftCount > 0 && (
        <Button variant="ghost" size="sm" onClick={() => setConfirm('discard')} disabled={busy !== null} className="text-red-600 hover:text-red-700 mr-auto">
          <Trash2 size={14} className="mr-1.5" /> Discard draft
        </Button>
      )}
      <Button variant="outline" onClick={saveDraft} disabled={busy !== null || !editable.length}>
        <Save size={15} className="mr-1.5" /> {busy === 'draft' ? 'Saving draft...' : 'Save as draft'}
      </Button>
      <Button variant="default" onClick={askSubmit} disabled={busy !== null || !settingsReady || !editable.length}>
        <Send size={15} className="mr-1.5" /> {busy === 'submit' ? 'Submitting...' : 'Submit scores'}
      </Button>
    </>
  );

  return (
    <>
      <Modal isOpen={isOpen} onClose={requestClose} title="Enter grades" size="xl" footer={footer}>
        <div className="space-y-3">
          <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/20 px-4 py-2.5">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{target.className} · {target.subjectName}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">{target.termLabel} · {target.academicYear}</p>
          </div>

          {isLoading && <div className="grid gap-3"><SkeletonCard /><SkeletonCard /></div>}

          {!isLoading && rows.length === 0 && (
            <div className="p-8 text-center text-sm text-gray-500 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
              No active students enrolled in this class.
            </div>
          )}

          {!isLoading && rows.length > 0 && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  <Calculator size={12} className="inline mr-1" />
                  Mean = (Test 1 + Test 2) ÷ 2 · <span className="text-red-600 font-semibold">Below 50 = Fail</span> · {enteredCount}/{rows.length} entered
                  {dirty && <span className="ml-2 font-semibold text-amber-700 dark:text-amber-400">· Unsaved changes</span>}
                </p>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                <strong>Save as draft</strong> keeps your work, and you can change it again. <strong>Submit scores</strong> makes it official
                {submitLocks ? ' and locks it: only the principal can change it afterwards.' : '.'} Press <kbd className="px-1 border rounded">Enter</kbd> to go to the next student.
              </p>
              <div aria-live="polite" className="min-h-[18px] text-xs font-semibold text-red-600">{hint}</div>

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
                    {rows.map((r, i) => {
                      const mean = liveMean(r._t1, r._t2);
                      const g = getGrade(mean);
                      const readOnly = r.can_edit === false;
                      return (
                        <tr key={r.student_id} className={`${i % 2 === 1 ? 'bg-sky-50 dark:bg-gray-900/40' : 'bg-white dark:bg-transparent'}`}>
                          <td className="py-2 px-3">
                            <p className="font-medium text-gray-900 dark:text-white">
                              {r.student_name}
                              {readOnly && <Lock size={11} className="inline ml-1.5 -mt-0.5 text-gray-500" aria-label="Locked" />}
                            </p>
                            <p className="text-[11px] text-gray-500 font-mono">{r.roll_number}</p>
                          </td>
                          {(['_t1', '_t2'] as ScoreField[]).map((f) => (
                            <td key={f} className="py-2 px-3">
                              <input
                                type="text" inputMode="numeric" maxLength={3}
                                data-cell={`${i}-${f}`}
                                value={r[f]} disabled={readOnly}
                                aria-label={`${FIELD_LABEL[f]} for ${r.student_name}`}
                                onChange={(e) => onType(r.student_id, f, e.target.value)}
                                onKeyDown={(e) => onKeyDown(e, i, f)}
                                className={INPUT_CLASS}
                              />
                            </td>
                          ))}
                          <td className="py-2 px-2 text-center">
                            <span className={`font-mono font-bold ${mean != null && mean < 50 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>{mean ?? '—'}</span>
                          </td>
                          <td className="py-2 px-2 text-center">
                            {mean != null && (
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${g.isFail ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{g.letter}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </Modal>

      <ConfirmationDialog
        isOpen={confirm === 'submit'}
        onClose={() => setConfirm(null)}
        onConfirm={submit}
        title={submitLocks ? 'Submit and lock these scores?' : 'Submit these scores?'}
        message={[
          `${toSend.length} ${toSend.length === 1 ? 'student' : 'students'} will be saved for ${target.subjectName}, ${target.termLabel}.`,
          blank.length ? `${blank.length} ${blank.length === 1 ? 'student has' : 'students have'} no score yet and will stay empty.` : '',
          failing.length ? `${failing.length} ${failing.length === 1 ? 'student is' : 'students are'} below 50 (a fail).` : '',
          submitLocks ? 'The principal has set scores to lock as soon as they are submitted. After this only the principal can change them. If you are not sure yet, choose Cancel and use Save as draft.' : '',
        ].filter(Boolean).join(' ')}
        confirmLabel={submitLocks ? 'Submit and lock' : 'Submit'}
        isDestructive={false}
      />
      <ConfirmationDialog
        isOpen={confirm === 'discard'}
        onClose={() => setConfirm(null)}
        onConfirm={discard}
        title="Discard this draft?"
        message="The draft for this class, subject and term is deleted and the form goes back to the scores that are already submitted. This cannot be undone."
        confirmLabel="Discard draft"
      />
      <ConfirmationDialog
        isOpen={confirm === 'leave'}
        onClose={() => setConfirm(null)}
        onConfirm={() => onClose(changedSomething)}
        title="Close without saving?"
        message="You have changes that are not saved. Choose Cancel and use Save as draft to keep them."
        confirmLabel="Close without saving"
      />
    </>
  );
};

export default ScoreEntryModal;
