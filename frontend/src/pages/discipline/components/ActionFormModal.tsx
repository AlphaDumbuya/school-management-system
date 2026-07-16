/**
 * ActionFormModal — assign a discipline action to a student
 */

import React, { useState, useEffect } from 'react';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { disciplineService, ActionType } from '@services/disciplineService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  studentId?: string;
  studentName?: string;
  infractionId?: string;
}

const ACTION_TYPES: { value: ActionType; label: string }[] = [
  { value: 'warning', label: 'Verbal / Written Warning' },
  { value: 'detention', label: 'Detention' },
  { value: 'suspension', label: 'Suspension' },
  { value: 'expulsion', label: 'Expulsion' },
  { value: 'counseling', label: 'Counseling Session' },
];

const fieldCls = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const errorCls = 'text-xs text-red-600 mt-0.5';

export const ActionFormModal: React.FC<Props> = ({
  isOpen, onClose, onSuccess, studentId = '', studentName = '', infractionId = '',
}) => {
  const [loading, setLoading] = useState(false);
  const [sid, setSid] = useState(studentId);
  const [actionType, setActionType] = useState<ActionType | ''>('');
  const [description, setDescription] = useState('');
  const [actionDate, setActionDate] = useState(new Date().toISOString().slice(0, 10));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [durationDays, setDurationDays] = useState('');
  const [conditions, setConditions] = useState('');
  const [requiresFollowUp, setRequiresFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setSid(studentId);
      setActionType('');
      setDescription('');
      setActionDate(new Date().toISOString().slice(0, 10));
      setStartDate('');
      setEndDate('');
      setDurationDays('');
      setConditions('');
      setRequiresFollowUp(false);
      setFollowUpDate('');
      setNotes('');
      setErrors({});
    }
  }, [isOpen, studentId]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!sid.trim()) e.student_id = 'Student ID is required';
    if (!actionType) e.action_type = 'Action type is required';
    if (!actionDate) e.action_date = 'Action date is required';
    if (actionType === 'suspension' && !durationDays) e.duration_days = 'Duration required for suspensions';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      await disciplineService.assignAction({
        student_id: sid,
        infraction_id: infractionId || undefined,
        action_type: actionType,
        action_description: description || undefined,
        action_date: actionDate,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        duration_days: durationDays ? parseInt(durationDays) : undefined,
        conditions: conditions || undefined,
        requires_follow_up: requiresFollowUp,
        follow_up_date: followUpDate || undefined,
        notes: notes || undefined,
      });
      showToast.success('Discipline action assigned');
      onSuccess();
      onClose();
    } catch {
      showToast.apiError('Failed to assign action');
    } finally {
      setLoading(false);
    }
  };

  const needsDates = actionType === 'suspension' || actionType === 'expulsion';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assign Discipline Action" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Student */}
        <div>
          <label className={labelCls}>Student <span className="text-red-500">*</span></label>
          <input type="text" value={studentName || sid} onChange={e => setSid(e.target.value)} className={fieldCls} readOnly={!!studentId} />
          {errors.student_id && <p className={errorCls}>{errors.student_id}</p>}
        </div>

        {/* Linked infraction */}
        {infractionId && (
          <div>
            <label className={labelCls}>Linked Infraction</label>
            <input type="text" value={infractionId} readOnly className={`${fieldCls} bg-gray-50 dark:bg-gray-700`} />
          </div>
        )}

        {/* Action Type */}
        <div>
          <label className={labelCls}>Action Type <span className="text-red-500">*</span></label>
          <select value={actionType} onChange={e => setActionType(e.target.value as ActionType)} className={fieldCls}>
            <option value="">— Select action —</option>
            {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
          {errors.action_type && <p className={errorCls}>{errors.action_type}</p>}
        </div>

        {/* Description */}
        <div>
          <label className={labelCls}>Description</label>
          <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} className={fieldCls} placeholder="Describe the action being taken..." />
        </div>

        {/* Action Date */}
        <div>
          <label className={labelCls}>Action Date <span className="text-red-500">*</span></label>
          <input type="date" value={actionDate} onChange={e => setActionDate(e.target.value)} className={fieldCls} />
          {errors.action_date && <p className={errorCls}>{errors.action_date}</p>}
        </div>

        {/* Start / End dates for suspension/expulsion */}
        {needsDates && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={fieldCls} />
            </div>
          </div>
        )}

        {/* Duration */}
        {(actionType === 'suspension' || actionType === 'detention') && (
          <div>
            <label className={labelCls}>Duration (days) {actionType === 'suspension' && <span className="text-red-500">*</span>}</label>
            <input type="number" min="1" value={durationDays} onChange={e => setDurationDays(e.target.value)} className={fieldCls} />
            {errors.duration_days && <p className={errorCls}>{errors.duration_days}</p>}
          </div>
        )}

        {/* Conditions */}
        <div>
          <label className={labelCls}>Conditions / Requirements</label>
          <textarea rows={2} value={conditions} onChange={e => setConditions(e.target.value)} className={fieldCls} placeholder="Any conditions the student must meet..." />
        </div>

        {/* Follow-up */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={requiresFollowUp} onChange={e => setRequiresFollowUp(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
          <span className="text-sm text-gray-700 dark:text-gray-300">Requires follow-up</span>
        </label>

        {requiresFollowUp && (
          <div>
            <label className={labelCls}>Follow-up Date</label>
            <input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} className={fieldCls} />
          </div>
        )}

        {/* Notes */}
        <div>
          <label className={labelCls}>Internal Notes</label>
          <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className={fieldCls} placeholder="Notes visible only to staff..." />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Assigning…' : 'Assign Action'}</Button>
        </div>
      </form>
    </Modal>
  );
};
