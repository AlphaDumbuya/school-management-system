/**
 * EnterGradesDialog: the first step of entering grades. Pick the class, the term and the subject, see how far
 * along each subject is, then continue to the entry window. The page behind it is never changed by this dialog.
 */
import React, { useEffect, useState } from 'react';
import { Lock, CheckCircle2, PenLine, Loader2 } from 'lucide-react';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';
import { SearchableSelect } from '@components/admin/forms/SearchableSelect';
import { SL_TERMS, SLTerm } from '@services/reportCardService';
import { useEntrySubjects } from './useEntrySubjects';
import type { EntryTarget } from './scoreUi';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  academicYear: string;
  classOptions: Array<{ value: string; label: string; sublabel?: string }>;
  /** What the page behind has selected: the dialog starts from it. */
  initial: { classId: string; subjectId: string; term: SLTerm };
  onContinue: (target: EntryTarget, subjectName: string) => void;
}

export const EnterGradesDialog: React.FC<Props> = ({ isOpen, onClose, academicYear, classOptions, initial, onContinue }) => {
  const [classId, setClassId] = useState(initial.classId);
  const [term, setTerm] = useState<SLTerm>(initial.term);
  const [subjectId, setSubjectId] = useState(initial.subjectId);

  // Every time it opens it starts from the page's current choice.
  useEffect(() => {
    if (isOpen) { setClassId(initial.classId); setTerm(initial.term); setSubjectId(initial.subjectId); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const { subjects, isLoading } = useEntrySubjects(isOpen ? classId : '', term, academicYear);

  // A subject chosen for another class or term that is not on this list is dropped.
  useEffect(() => {
    if (subjectId && !isLoading && subjects.length > 0 && !subjects.some((s) => s.value === subjectId)) setSubjectId('');
  }, [subjects, isLoading, subjectId]);

  const canContinue = !!classId && !!subjectId;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Enter grades"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="default" disabled={!canContinue} onClick={() => onContinue({ classId, subjectId, term }, subjects.find((s) => s.value === subjectId)?.label ?? '')}>
            Continue
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Choose what you are entering grades for. The grades you already see on the page stay as they are until you submit.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SearchableSelect
            label="Class" options={classOptions} value={classId}
            onChange={(v) => { setClassId(v); setSubjectId(''); }} placeholder="Select class..."
          />
          <div className="flex flex-col gap-1">
            <label htmlFor="enter-grades-term" className="text-sm font-medium text-gray-700 dark:text-gray-300">Term</label>
            <select
              id="enter-grades-term" value={term}
              onChange={(e) => setTerm(e.target.value as SLTerm)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
            >
              {SL_TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Subject</p>
          {!classId ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-4 text-center">
              Select a class to see its subjects.
            </p>
          ) : isLoading ? (
            <p className="text-sm text-gray-500 flex items-center justify-center gap-2 p-4"><Loader2 size={16} className="animate-spin" /> Loading subjects...</p>
          ) : subjects.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-4 text-center">
              You don&apos;t teach any subject in this class this year.
            </p>
          ) : (
            <ul role="radiogroup" aria-label="Subject" className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
              {subjects.map((s) => {
                const selected = s.value === subjectId;
                const done = s.entered != null && s.total != null && s.total > 0 && s.entered >= s.total;
                return (
                  <li key={s.value}>
                    <button
                      type="button" role="radio" aria-checked={selected}
                      onClick={() => setSubjectId(s.value)}
                      className={`w-full text-left flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                        selected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-500'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-gray-900 dark:text-white truncate">{s.label}</span>
                        {s.code && <span className="block text-[11px] text-gray-500 font-mono">{s.code}</span>}
                      </span>
                      <span className="flex flex-wrap items-center justify-end gap-1.5 flex-shrink-0">
                        {s.entered != null && s.total != null && (
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              done ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : s.entered > 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {done && <CheckCircle2 size={11} />}
                            {s.entered}/{s.total} graded
                          </span>
                        )}
                        {s.drafts > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            <PenLine size={11} /> Draft
                          </span>
                        )}
                        {s.locked > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                            <Lock size={11} /> Locked
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default EnterGradesDialog;
