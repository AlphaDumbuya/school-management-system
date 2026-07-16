/**
 * AppealReviewModal — approve, reject, or escalate a discipline appeal
 */

import React, { useState, useEffect } from 'react';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { showToast } from '@utils/toast';
import { disciplineService, DisciplineAppeal, ACTION_TYPE_LABELS } from '@services/disciplineService';
import { CheckCircle, XCircle, ArrowUp, Calendar, User } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  appeal: DisciplineAppeal | null;
}

const fieldCls = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

export const AppealReviewModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, appeal }) => {
  const [loading, setLoading] = useState(false);
  const [decision, setDecision] = useState<'approve' | 'reject' | 'escalate' | null>(null);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [modifiedAction, setModifiedAction] = useState('');

  useEffect(() => {
    if (isOpen) { setDecision(null); setDecisionNotes(''); setModifiedAction(''); }
  }, [isOpen]);

  if (!appeal) return null;

  const handleSubmit = async () => {
    if (!decision) return;
    setLoading(true);
    try {
      if (decision === 'approve') {
        await disciplineService.approveAppeal(appeal.appeal_id, {
          decision_notes: decisionNotes || undefined,
          modified_action: modifiedAction || undefined,
        });
        showToast.success('Appeal approved');
      } else if (decision === 'reject') {
        await disciplineService.rejectAppeal(appeal.appeal_id, decisionNotes || undefined);
        showToast.success('Appeal rejected');
      } else {
        await disciplineService.escalateAppeal(appeal.appeal_id, decisionNotes || undefined);
        showToast.success('Appeal escalated');
      }
      onSuccess();
      onClose();
    } catch {
      showToast.apiError('Failed to process appeal decision');
    } finally {
      setLoading(false);
    }
  };

  const fmt = (d?: string) => d ? new Date(d).toLocaleDateString() : '—';

  const DECISIONS = [
    { key: 'approve' as const, label: 'Approve', icon: <CheckCircle size={16} />, active: 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 dark:border-green-600' },
    { key: 'reject' as const, label: 'Reject', icon: <XCircle size={16} />, active: 'border-red-500 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 dark:border-red-600' },
    { key: 'escalate' as const, label: 'Escalate', icon: <ArrowUp size={16} />, active: 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-600' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Review Appeal" size="md">
      <div className="space-y-5">
        {/* Appeal summary */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 space-y-3 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Appeal Details</span>
            <StatusBadge status={appeal.status} showDot />
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Student</p>
              <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                <User size={14} className="text-gray-400" />
                {appeal.student_name || appeal.student_id}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Action Appealed</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {appeal.action_type ? ACTION_TYPE_LABELS[appeal.action_type] : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Submitted By</p>
              <p className="font-medium text-gray-700 dark:text-gray-300 capitalize">{appeal.submitted_by_type}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Date Submitted</p>
              <p className="font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                <Calendar size={13} className="text-gray-400" />
                {fmt(appeal.submitted_date)}
              </p>
            </div>
          </div>
          {appeal.appeal_reason && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Appeal Reason</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                {appeal.appeal_reason}
              </p>
            </div>
          )}
        </div>

        {/* Decision buttons */}
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Decision</p>
          <div className="grid grid-cols-3 gap-3">
            {DECISIONS.map(d => (
              <button
                key={d.key}
                type="button"
                onClick={() => setDecision(d.key)}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 font-semibold text-sm transition-all
                  ${decision === d.key ? d.active : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300'}`}
              >
                {d.icon}
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Modified action — approve only */}
        {decision === 'approve' && (
          <div>
            <label className={labelCls}>Modified Action (optional)</label>
            <input
              type="text"
              value={modifiedAction}
              onChange={e => setModifiedAction(e.target.value)}
              className={fieldCls}
              placeholder="Describe any reduction or modification to the original action..."
            />
          </div>
        )}

        {/* Decision notes */}
        {decision && (
          <div>
            <label className={labelCls}>
              {decision === 'approve' ? 'Approval' : decision === 'reject' ? 'Rejection' : 'Escalation'} Notes
            </label>
            <textarea
              rows={3}
              value={decisionNotes}
              onChange={e => setDecisionNotes(e.target.value)}
              className={fieldCls}
              placeholder="Provide reasoning for this decision..."
            />
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!decision || loading}
            className={
              decision === 'approve' ? 'bg-green-600 hover:bg-green-700 text-white border-green-600' :
              decision === 'reject' ? 'bg-red-600 hover:bg-red-700 text-white border-red-600' :
              ''
            }
          >
            {loading ? 'Processing…' : decision
              ? `${decision.charAt(0).toUpperCase() + decision.slice(1)} Appeal`
              : 'Select a Decision'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
