/**
 * InfractionFormModal — record a new infraction for a student
 */

import React, { useState, useEffect } from 'react';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { disciplineService } from '@services/disciplineService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  prefilledStudentId?: string;
  prefilledStudentName?: string;
}

const INFRACTION_TYPES = [
  { value: 'tardiness', label: 'Tardiness / Late Arrival' },
  { value: 'absence', label: 'Unexcused Absence' },
  { value: 'disruptive_behavior', label: 'Disruptive Behavior' },
  { value: 'disrespect', label: 'Disrespect to Staff' },
  { value: 'academic_dishonesty', label: 'Academic Dishonesty / Cheating' },
  { value: 'bullying', label: 'Bullying / Harassment' },
  { value: 'vandalism', label: 'Vandalism / Property Damage' },
  { value: 'fighting', label: 'Fighting / Physical Altercation' },
  { value: 'dress_code', label: 'Dress Code Violation' },
  { value: 'mobile_phone', label: 'Unauthorized Mobile Phone Use' },
  { value: 'other', label: 'Other' },
];

const LOCATIONS = [
  'Classroom', 'Hallway', 'Cafeteria', 'Playground', 'Restroom',
  'Library', 'Laboratory', 'Sports Field', 'Assembly Hall', 'Other',
];

const fieldCls = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const errorCls = 'text-xs text-red-600 mt-0.5';

export const InfractionFormModal: React.FC<Props> = ({
  isOpen, onClose, onSuccess, prefilledStudentId = '', prefilledStudentName = '',
}) => {
  const [loading, setLoading] = useState(false);
  const [studentId, setStudentId] = useState(prefilledStudentId);
  const [infractionType, setInfractionType] = useState('');
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [isConfidential, setIsConfidential] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setStudentId(prefilledStudentId);
      setInfractionType('');
      setIncidentDate(new Date().toISOString().slice(0, 10));
      setLocation('');
      setDescription('');
      setNotes('');
      setIsConfidential(false);
      setErrors({});
    }
  }, [isOpen, prefilledStudentId]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!studentId.trim()) e.student_id = 'Student ID is required';
    if (!infractionType) e.infraction_type = 'Infraction type is required';
    if (!incidentDate) e.incident_date = 'Date is required';
    if (!description.trim()) e.description = 'Description is required';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      await disciplineService.recordInfraction({
        student_id: studentId,
        infraction_type_id: infractionType,
        incident_date: incidentDate,
        incident_description: description,
        incident_location: location || undefined,
        notes: notes || undefined,
        is_confidential: isConfidential,
      });
      showToast.success('Infraction recorded successfully');
      onSuccess();
      onClose();
    } catch {
      showToast.apiError('Failed to record infraction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Infraction" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Student ID */}
        <div>
          <label className={labelCls}>Student ID <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={studentId}
            onChange={e => setStudentId(e.target.value)}
            className={fieldCls}
            placeholder={prefilledStudentName || 'Enter student ID'}
            readOnly={!!prefilledStudentId}
          />
          {prefilledStudentName && <p className="text-xs text-gray-500 mt-0.5">Student: {prefilledStudentName}</p>}
          {errors.student_id && <p className={errorCls}>{errors.student_id}</p>}
        </div>

        {/* Infraction Type */}
        <div>
          <label className={labelCls}>Infraction Type <span className="text-red-500">*</span></label>
          <select value={infractionType} onChange={e => setInfractionType(e.target.value)} className={fieldCls}>
            <option value="">— Select type —</option>
            {INFRACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {errors.infraction_type && <p className={errorCls}>{errors.infraction_type}</p>}
        </div>

        {/* Date */}
        <div>
          <label className={labelCls}>Incident Date <span className="text-red-500">*</span></label>
          <input type="date" value={incidentDate} onChange={e => setIncidentDate(e.target.value)} className={fieldCls} />
          {errors.incident_date && <p className={errorCls}>{errors.incident_date}</p>}
        </div>

        {/* Location */}
        <div>
          <label className={labelCls}>Location</label>
          <select value={location} onChange={e => setLocation(e.target.value)} className={fieldCls}>
            <option value="">— Select location —</option>
            {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        {/* Description */}
        <div>
          <label className={labelCls}>Incident Description <span className="text-red-500">*</span></label>
          <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} className={fieldCls} placeholder="Describe what happened..." />
          {errors.description && <p className={errorCls}>{errors.description}</p>}
        </div>

        {/* Notes */}
        <div>
          <label className={labelCls}>Additional Notes (optional)</label>
          <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className={fieldCls} placeholder="Internal notes visible only to staff..." />
        </div>

        {/* Confidential */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={isConfidential} onChange={e => setIsConfidential(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
          <span className="text-sm text-gray-700 dark:text-gray-300">Mark as confidential</span>
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Recording…' : 'Record Infraction'}</Button>
        </div>
      </form>
    </Modal>
  );
};
