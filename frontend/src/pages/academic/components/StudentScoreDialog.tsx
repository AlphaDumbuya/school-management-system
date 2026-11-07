/**
 * StudentScoreDialog: correct (or add) one student's Test 1 and Test 2 for the subject on the page.
 * Opened from the pencil icon in the preview, which only appears when the student's scores are not locked.
 * Saving is a normal submit of that one student, so the principal's lock rules apply exactly as everywhere else.
 */
import React, { useEffect, useState } from 'react';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { reportCardService, SLTerm, ScoreGridRow, getGrade } from '@services/reportCardService';
import { INPUT_CLASS, isValidScoreText, liveMean, toNum, toStr } from './scoreUi';

interface Props {
  student: ScoreGridRow | null;
  onClose: () => void;
  onSaved: () => void;
  target: { classId: string; subjectId: string; term: SLTerm; academicYear: string; subjectName: string; termLabel: string };
  /** True when submitting will lock this student's scores for the teacher. */
  submitLocks: boolean;
  settingsReady: boolean;
}

export const StudentScoreDialog: React.FC<Props> = ({ student, onClose, onSaved, target, submitLocks, settingsReady }) => {
  const [t1, setT1] = useState('');
  const [t2, setT2] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (student) { setT1(toStr(student.test1)); setT2(toStr(student.test2)); }
  }, [student]);

  if (!student) return null;

  const mean = liveMean(t1, t2);
  const g = getGrade(mean);
  const changed = t1 !== toStr(student.test1) || t2 !== toStr(student.test2);
  const hasAny = t1 !== '' || t2 !== '';

  const save = async () => {
    setSaving(true);
    const res: any = await reportCardService.saveScores({
      class_id: target.classId, subject_id: target.subjectId, academic_year: target.academicYear, term: target.term,
      scores: [{ student_id: student.student_id, test1: toNum(t1), test2: toNum(t2) }],
    });
    setSaving(false);
    if (res?.success === false) { showToast.apiError(res.error); return; }
    showToast.success('Scores saved');
    onSaved();
    onClose();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Edit scores: ${student.student_name}`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="default" onClick={save} disabled={saving || !settingsReady || !changed || !hasAny}>
            {saving ? 'Saving...' : submitLocks ? 'Save and lock' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {target.subjectName} · {target.termLabel} · {target.academicYear} · <span className="font-mono">{student.roll_number}</span>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="one-t1" className="text-sm font-medium text-gray-700 dark:text-gray-300">Test 1</label>
            <input id="one-t1" type="text" inputMode="numeric" maxLength={3} value={t1} autoFocus
              onChange={(e) => { if (isValidScoreText(e.target.value)) setT1(e.target.value); }} className={INPUT_CLASS} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="one-t2" className="text-sm font-medium text-gray-700 dark:text-gray-300">Test 2</label>
            <input id="one-t2" type="text" inputMode="numeric" maxLength={3} value={t2}
              onChange={(e) => { if (isValidScoreText(e.target.value)) setT2(e.target.value); }} className={INPUT_CLASS} />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-3">
          <span className="text-sm text-gray-600 dark:text-gray-400">Mean</span>
          <span className="flex items-center gap-2">
            <span className={`font-mono font-bold text-lg ${mean != null && mean < 50 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>{mean ?? '—'}</span>
            {mean != null && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${g.isFail ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{g.letter}</span>
            )}
          </span>
        </div>
        {submitLocks && (
          <p className="text-xs rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
            The principal has set scores to lock when they are saved. After this, only the principal can change them again.
          </p>
        )}
      </div>
    </Modal>
  );
};

export default StudentScoreDialog;
