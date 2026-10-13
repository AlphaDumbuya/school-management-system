/**
 * SchoolLevelDialog: confirm a change of school level.
 *
 * The level decides what the top leader is called (Head Teacher or Principal)
 * and which staff titles are offered, so the owner sees exactly what changes
 * before confirming. Replaces the browser's own confirm box.
 */
import React, { useEffect, useState } from 'react';
import { ArrowRight, GraduationCap, Loader2 } from 'lucide-react';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';
import { leadTitleFor } from '@lib/leadTitle';

interface Props {
  isOpen: boolean;
  /** The level the school has now (null when none is saved). */
  from: string | null;
  /** The level being chosen. */
  to: string;
  onClose: () => void;
  /** Save the change. Throw (with a readable message) to keep the dialog open. */
  onConfirm: () => Promise<void>;
}

export const SchoolLevelDialog: React.FC<Props> = ({ isOpen, from, to, onClose, onConfirm }) => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (isOpen) { setPending(false); setError(null); } }, [isOpen]);

  const before = leadTitleFor(from);
  const after = leadTitleFor(to);
  const titleChanges = before !== after;

  const confirm = async () => {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e: any) {
      setError(e?.message || 'Could not change the school level.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={pending ? () => undefined : onClose}
      title="Change school level"
      size="sm"
      footer={(
        <>
          <Button variant="ghost" disabled={pending} onClick={onClose}>Cancel</Button>
          <Button disabled={pending} onClick={confirm}>
            {pending && <Loader2 size={14} className="animate-spin" />}
            Change level
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-blue-50 p-2 text-[#1d4ed8]" aria-hidden="true"><GraduationCap size={20} /></span>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Your school level sets the title of your top leader and the staff titles people can pick. Check the change before you confirm.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800 text-sm">
          <div className="p-3">
            <div className="text-xs font-semibold text-gray-500 mb-1">School level</div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-gray-500 line-through">{from || 'Not set'}</span>
              <ArrowRight size={14} className="text-gray-400" aria-hidden="true" />
              <span className="font-semibold text-gray-900 dark:text-white">{to}</span>
            </div>
          </div>
          <div className="p-3">
            <div className="text-xs font-semibold text-gray-500 mb-1">Top leader</div>
            {titleChanges ? (
              <div className="flex flex-wrap items-center gap-x-2">
                <span className="text-gray-500 line-through">{before}</span>
                <ArrowRight size={14} className="text-gray-400" aria-hidden="true" />
                <span className="font-semibold text-gray-900 dark:text-white">{after}</span>
              </div>
            ) : (
              <span className="font-semibold text-gray-900 dark:text-white">Stays {after}</span>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-500">
          Accounts and records are not changed. The new title shows for everyone the next time their page loads. This change is recorded in the audit log.
        </p>

        {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
      </div>
    </Modal>
  );
};

export default SchoolLevelDialog;
