/**
 * YearTransitionDialog — confirm moving the school into the current academic
 * year (carry-forward). Shows exactly what will move and what stays, then runs
 * the action with an in-dialog busy state. Used by the principal overview and
 * Settings → Academic Year.
 */
import React, { useState } from 'react';
import { ArrowRight, CalendarCheck, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';

export interface YearTransitionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  fromYear?: string | null;
  toYear?: string | null;
  /** Students still in last year's classes (shown when known). */
  studentCount?: number | null;
}

const MOVES = [
  'Active students into their class for the new year',
  'Classes, with the next-class order kept',
  'Class subjects and teacher assignments',
  'Timetable',
];

export const YearTransitionDialog: React.FC<YearTransitionDialogProps> = ({
  isOpen, onClose, onConfirm, fromYear, toYear, studentCount,
}) => {
  const [busy, setBusy] = useState(false);
  const from = fromYear || 'last year';
  const to = toYear || 'this year';

  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { if (!busy) onClose(); }}
      title="Move the school into the new year"
      size="md"
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button variant="default" disabled={busy} onClick={run}>
            {busy && <Loader2 size={14} className="animate-spin mr-1.5" />}
            {busy ? 'Moving…' : `Move into ${to}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* From → To */}
        <div className="flex items-center justify-center gap-3 rounded-xl bg-blue-50 px-4 py-3 dark:bg-blue-950/30">
          <span className="rounded-lg bg-white px-3 py-1.5 text-sm font-bold text-gray-700 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700">{from}</span>
          <ArrowRight size={18} className="text-blue-600" aria-hidden />
          <span className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-bold text-white">
            <CalendarCheck size={14} aria-hidden /> {to}
          </span>
        </div>

        {typeof studentCount === 'number' && studentCount > 0 && (
          <p className="text-center text-sm text-gray-700 dark:text-gray-300">
            <strong>{studentCount}</strong> student{studentCount === 1 ? '' : 's'} will move, and their portals will switch to {to}.
          </p>
        )}

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">What moves into {to}</p>
          <ul className="space-y-1.5">
            {MOVES.map((m) => (
              <li key={m} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-emerald-500" aria-hidden /> {m}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400">
          <ShieldCheck size={16} className="mt-0.5 flex-shrink-0 text-gray-500" aria-hidden />
          <span>
            Nothing is deleted. {from} results, attendance, fee structures and fees stay as history.
            Fee structures start fresh: set up {to}'s fees on the Fee Structures page. Graduated
            students aren't moved. Safe to run again.
          </span>
        </div>
      </div>
    </Modal>
  );
};

export default YearTransitionDialog;
