/**
 * ExamSlotModal — add/edit a single exam in the exam-timetable grid.
 * Focused, cell-oriented form (like TimetableSlotModal for the normal timetable):
 * pick the subject, tweak the time/venue/marks for a specific date + session.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';
import { SearchableSelect } from '@components/admin/forms/SearchableSelect';
import { showToast } from '@utils/toast';
import { subjectsService } from '@services/subjectsService';
import {
  examinationsService, ExaminationRecord, ExamType, ExamTerm,
  EXAM_TYPES, EXAM_SESSIONS, composeExamDateTime,
} from '@services/examinationsService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  classId: string;
  className?: string;
  term: ExamTerm;
  academicYear: string;
  /** Prefill for a new exam from a clicked cell */
  prefillDate?: string;        // YYYY-MM-DD
  prefillSession?: string;     // 'morning' | 'afternoon'
  /** Editing an existing exam */
  editingExam?: ExaminationRecord | null;
}

export const ExamSlotModal: React.FC<Props> = ({
  isOpen, onClose, onSuccess, classId, className, term, academicYear,
  prefillDate, prefillSession, editingExam,
}) => {
  const isEditing = !!editingExam;

  const [subjectId, setSubjectId] = useState('');
  const [type, setType] = useState<ExamType>('test_2');
  const [date, setDate] = useState('');
  const [session, setSession] = useState('morning');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('11:00');
  const [totalMarks, setTotalMarks] = useState('100');
  const [passMarks, setPassMarks] = useState('50');
  const [venue, setVenue] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: subjectsData } = useQuery({
    queryKey: ['subjects-dropdown'],
    queryFn: () => subjectsService.listSubjects({ limit: 100, status: 'active' }),
    staleTime: 60_000,
  });
  const subjects = (subjectsData as any)?.data ?? [];
  const subjectOptions = useMemo(
    () => subjects.map((s: any) => ({ value: String(s.id), label: s.name, sublabel: s.code })),
    [subjects],
  );

  useEffect(() => {
    if (!isOpen) return;
    if (editingExam) {
      setSubjectId(editingExam.subject_id ?? '');
      setType(editingExam.type);
      setDate(editingExam.start_date?.substring(0, 10) ?? '');
      const d = editingExam.start_date ? new Date(editingExam.start_date) : null;
      const sess = d && d.getHours() >= 12 ? 'afternoon' : 'morning';
      setSession(sess);
      setStartTime(editingExam.start_date ? editingExam.start_date.substring(11, 16) : '09:00');
      setEndTime(editingExam.end_date ? editingExam.end_date.substring(11, 16) : '11:00');
      setTotalMarks(String(editingExam.total_marks ?? 100));
      setPassMarks(String(editingExam.pass_marks ?? 50));
      setVenue(editingExam.venue ?? '');
    } else {
      const s = EXAM_SESSIONS.find((x) => x.key === (prefillSession || 'morning')) || EXAM_SESSIONS[0];
      setSubjectId('');
      setType('test_2');
      setDate(prefillDate || '');
      setSession(s.key);
      setStartTime(s.start);
      setEndTime(s.end);
      setTotalMarks('100');
      setPassMarks('50');
      setVenue('');
    }
  }, [isOpen, editingExam, prefillDate, prefillSession]);

  // When session changes on a new exam, sync default times
  const handleSessionChange = (key: string) => {
    setSession(key);
    const s = EXAM_SESSIONS.find((x) => x.key === key);
    if (s && !isEditing) { setStartTime(s.start); setEndTime(s.end); }
  };

  const handleSave = async () => {
    if (!subjectId) { showToast.error('Select a subject'); return; }
    if (!date) { showToast.error('Select a date'); return; }

    const subjectName = subjects.find((s: any) => String(s.id) === subjectId)?.name || 'Exam';
    const duration = Math.max(
      10,
      Math.round((new Date(`1970-01-01T${endTime}:00`).getTime() - new Date(`1970-01-01T${startTime}:00`).getTime()) / 60000),
    );

    const payload = {
      title: `${subjectName} Exam`,
      type,
      term,
      academic_year: academicYear,
      class_id: classId,
      subject_id: subjectId,
      start_date: composeExamDateTime(date, startTime),
      end_date: composeExamDateTime(date, endTime),
      total_marks: Number(totalMarks) || 100,
      pass_marks: Number(passMarks) || 50,
      duration_minutes: duration,
      venue: venue || undefined,
      status: 'scheduled' as const,
    };

    setSaving(true);
    try {
      const res = isEditing
        ? await examinationsService.updateExamination(editingExam!.id, payload)
        : await examinationsService.createExamination(payload);
      if ((res as any).success === false) throw new Error((res as any).error);
      showToast.success(isEditing ? 'Exam updated' : 'Exam scheduled');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast.error(err.message || 'Failed to save exam');
    } finally {
      setSaving(false);
    }
  };

  const fieldCls = 'w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1 block';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Exam' : 'Schedule Exam'}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="default" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Schedule Exam'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {className && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Class: <span className="font-semibold text-gray-800 dark:text-gray-200">{className}</span>
            &nbsp;·&nbsp; {academicYear} &nbsp;·&nbsp; {term.replace('_', ' ')}
          </div>
        )}

        <div>
          <label className={labelCls}>Subject *</label>
          <SearchableSelect options={subjectOptions} value={subjectId} onChange={setSubjectId} placeholder="Select subject..." searchPlaceholder="Search subjects..." />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Exam Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as ExamType)} className={fieldCls}>
              {EXAM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Session</label>
            <select value={session} onChange={(e) => handleSessionChange(e.target.value)} className={fieldCls}>
              {EXAM_SESSIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Date *</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldCls} />
          </div>
          <div>
            <label className={labelCls}>Start</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={fieldCls} />
          </div>
          <div>
            <label className={labelCls}>End</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={fieldCls} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Total Marks</label>
            <input type="number" value={totalMarks} onChange={(e) => setTotalMarks(e.target.value)} className={fieldCls} min={1} max={1000} />
          </div>
          <div>
            <label className={labelCls}>Pass Marks</label>
            <input type="number" value={passMarks} onChange={(e) => setPassMarks(e.target.value)} className={fieldCls} min={0} max={999} />
          </div>
          <div>
            <label className={labelCls}>Venue</label>
            <input type="text" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. Hall A" className={fieldCls} />
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ExamSlotModal;
