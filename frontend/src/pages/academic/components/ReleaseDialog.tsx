/**
 * ReleaseDialog: shown when the principal presses Release. Nothing is sent until they confirm here.
 *
 * It says, with real numbers for the chosen class and term: how many students and parents will be told, what is still
 * unfinished (subjects without grades, unsubmitted drafts, incomplete ratings), and what restricts editing afterwards.
 * Releasing alone does NOT stop teachers changing scores; only a lock does. So the dialog offers to lock the scores now,
 * ticked to start when the principal's own "auto-lock" setting is on.
 */
import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Lock, Loader2, Send, ShieldAlert } from 'lucide-react';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';
import { reportCardService, SLTerm, SL_TERMS } from '@services/reportCardService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  className: string;
  academicYear: string;
  /** '' = the whole year. */
  term: '' | SLTerm;
  busy: boolean;
  /** Confirm: release now, optionally locking the scores. */
  onConfirm: (lockScores: boolean) => void;
}

const termName = (t: string) => SL_TERMS.find((x) => x.value === t)?.label ?? t;

export const ReleaseDialog: React.FC<Props> = ({ isOpen, onClose, classId, className, academicYear, term, busy, onConfirm }) => {
  const [lockScores, setLockScores] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['release-check', classId, academicYear, term],
    queryFn: () => reportCardService.getReleaseCheck({ class_id: classId, academic_year: academicYear, term }),
    enabled: isOpen && !!classId,
    staleTime: 0,
    gcTime: 0,
  });
  const check = (data as any)?.data as import('@services/reportCardService').ReleaseCheck | undefined;
  const failed = !!data && (data as any).success === false;

  // The principal's own auto-lock setting decides the starting choice.
  useEffect(() => {
    if (isOpen && check) setLockScores(!!check.editing.auto_lock_on_entry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, !!check]);

  const wholeYear = term === '';
  const label = wholeYear ? 'the whole year' : termName(term);
  const unfinished = !!check && (
    check.terms.some((t) => t.subjects_partial.length > 0 || t.subjects_empty.length > 0 || t.drafts > 0) || check.ratings_incomplete > 0
  );
  const nothingEntered = !!check && check.terms.every((t) => t.scores === 0);
  const lockableScores = check ? check.terms.reduce((n, t) => n + (t.scores - t.locked), 0) : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={busy ? () => undefined : onClose}
      title={`Release ${label} for ${className}?`}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="default" onClick={() => onConfirm(lockScores)} disabled={busy || isLoading || failed || !check}>
            {busy ? <Loader2 size={15} className="mr-1.5 animate-spin" /> : <Send size={15} className="mr-1.5" />}
            {unfinished ? 'Release anyway' : 'Release'}
          </Button>
        </>
      }
    >
      {isLoading && <p className="flex items-center justify-center gap-2 p-6 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" /> Checking the grades...</p>}
      {failed && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{(data as any)?.error || 'Could not check the grades.'}</p>}

      {check && (
        <div className="space-y-4 text-sm">
          <p className="text-gray-700 dark:text-gray-300">
            This makes {label} visible to the <strong>{check.students} {check.students === 1 ? 'student' : 'students'}</strong> of {className} and their parents,
            and sends each of them an email and an in-app message.
            {wholeYear && ' It also opens the full report booklet, and moves passing students up if auto-promotion is on.'}
          </p>

          {check.already_released && (
            <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-blue-900">This is already released. Releasing again sends the messages again.</p>
          )}

          {nothingEntered && (
            <p role="alert" className="flex gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-red-800">
              <ShieldAlert size={16} className="mt-0.5 flex-shrink-0" /> No scores have been entered for {label}. Parents would see empty results.
            </p>
          )}

          {/* what is unfinished, per term */}
          <section aria-label="What is unfinished" className="space-y-2">
            {check.terms.map((t) => {
              const ok = t.subjects_partial.length === 0 && t.subjects_empty.length === 0 && t.drafts === 0;
              return (
                <div key={t.term} className={`rounded-lg border px-3 py-2 ${ok ? 'border-green-200 bg-green-50/60' : 'border-amber-300 bg-amber-50'}`}>
                  <p className={`flex items-center gap-1.5 font-semibold ${ok ? 'text-green-800' : 'text-amber-900'}`}>
                    {ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                    {termName(t.term)}: {t.subjects_complete} of {t.subjects_total} subjects fully graded
                  </p>
                  {t.subjects_partial.length > 0 && (
                    <p className="mt-1 text-xs text-amber-900">Partly graded: {t.subjects_partial.map((s) => `${s.name} (${s.entered}/${s.total})`).join(', ')}.</p>
                  )}
                  {t.subjects_empty.length > 0 && (
                    <p className="mt-1 text-xs text-amber-900">No grades yet: {t.subjects_empty.join(', ')}.</p>
                  )}
                  {t.drafts > 0 && (
                    <p className="mt-1 text-xs text-amber-900">{t.drafts} {t.drafts === 1 ? 'draft score is' : 'draft scores are'} still not submitted and will not appear in the results.</p>
                  )}
                </div>
              );
            })}
            {check.ratings_incomplete > 0 && (
              <p className="flex items-start gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                {check.ratings_incomplete} {check.ratings_incomplete === 1 ? 'student does' : 'students do'} not have all 12 affective and 12 psychomotor ratings for {wholeYear ? 'every term' : label}.
              </p>
            )}
          </section>

          {/* editing rules */}
          <section aria-label="Editing after release" className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-3">
            <p className="flex items-center gap-1.5 font-semibold text-gray-900 dark:text-white"><Lock size={14} /> Editing after release</p>
            <ul className="mt-1.5 list-disc pl-5 text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <li>
                Releasing does <strong>not</strong> stop teachers changing scores by itself. Only a lock does.
              </li>
              <li>
                {check.editing.auto_lock_on_entry
                  ? 'Your setting locks scores when a teacher submits them.'
                  : 'Your setting does not lock scores when a teacher submits them.'}{' '}
                {check.editing.allow_teacher_edit_after_lock
                  ? 'Teachers are allowed to edit locked scores.'
                  : 'Teachers cannot edit locked scores.'}
              </li>
              <li>You can change these two settings below, or lock or unlock one subject at a time on the Results page.</li>
            </ul>
            <label className="mt-3 flex items-start gap-2.5 rounded-lg border border-gray-200 dark:border-gray-700 p-2.5 cursor-pointer has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 dark:has-[:checked]:bg-blue-950/30">
              <input type="checkbox" className="mt-0.5" checked={lockScores} onChange={(e) => setLockScores(e.target.checked)} />
              <span className="text-sm">
                <strong className="block text-gray-900 dark:text-white">Lock the scores now ({lockableScores} not yet locked)</strong>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Teachers can then no longer change {wholeYear ? 'this year&apos;s' : `the ${label}`} scores of {className}. Only you can unlock them.
                </span>
              </span>
            </label>
          </section>
        </div>
      )}
    </Modal>
  );
};

export default ReleaseDialog;
