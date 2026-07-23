import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { disciplineService, BehavioralNote } from '@services/disciplineService';
import { studentsService } from '@services/studentsService';
import { SearchableSelect } from '@components/admin/forms/SearchableSelect';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  studentId?: string;
  studentName?: string;
  editingNote?: BehavioralNote | null;
}

const NOTE_TYPES = [
  { value: 'positive', label: 'Positive Observation' },
  { value: 'commendation', label: 'Commendation / Achievement' },
  { value: 'concern', label: 'Concern' },
  { value: 'observation', label: 'General Observation' },
];

const CATEGORIES = [
  { value: 'academic', label: 'Academic' },
  { value: 'social', label: 'Social' },
  { value: 'emotional', label: 'Emotional' },
  { value: 'behavioral', label: 'Behavioral' },
];

const fieldCls = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const errorCls = 'text-xs text-red-600 mt-0.5';

export const BehavioralNoteModal: React.FC<Props> = ({
  isOpen, onClose, onSuccess, studentId = '', studentName = '', editingNote,
}) => {
  const [loading, setLoading] = useState(false);
  const [sid, setSid] = useState(studentId);
  const [noteType, setNoteType] = useState('observation');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [rating, setRating] = useState('');
  const [noteDate, setNoteDate] = useState(new Date().toISOString().slice(0, 10));
  const [isConfidential, setIsConfidential] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch students for dropdown if not prefilled
  const { data: studentsData } = useQuery({
    queryKey: ['students-discipline-note-modal'],
    queryFn: () => studentsService.listStudents({ limit: 200 }),
    enabled: isOpen && !studentId && !editingNote,
    staleTime: 60_000,
  });

  const studentOptions = useMemo(() => {
    const list = (studentsData as any)?.data ?? [];
    return list.map((s: any) => ({
      value: s.id,
      label: `${s.first_name} ${s.last_name}`,
      sublabel: `ID: ${s.student_id}${s.class_name ? ` • ${s.class_name}` : ''}`,
    }));
  }, [studentsData]);

  useEffect(() => {
    if (!isOpen) return;
    if (editingNote) {
      setSid(editingNote.student_id);
      setNoteType(editingNote.note_type);
      setContent(editingNote.content || '');
      setCategory(editingNote.category || '');
      setRating(editingNote.rating?.toString() || '');
      setNoteDate(editingNote.note_date.slice(0, 10));
      setIsConfidential(editingNote.is_confidential);
      setIsShared(editingNote.is_shared_with_student);
    } else {
      setSid(studentId);
      setNoteType('observation');
      setContent('');
      setCategory('');
      setRating('');
      setNoteDate(new Date().toISOString().slice(0, 10));
      setIsConfidential(false);
      setIsShared(false);
    }
    setErrors({});
  }, [isOpen, editingNote, studentId]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!sid.trim()) e.student_id = 'Please select a student';
    if (!noteType) e.note_type = 'Note type is required';
    if (!content.trim()) e.content = 'Content is required';
    if (rating && (isNaN(Number(rating)) || Number(rating) < 1 || Number(rating) > 5))
      e.rating = 'Rating must be between 1 and 5';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      const payload = {
        student_id: sid,
        note_type: noteType,
        content,
        category: category || undefined,
        rating: rating ? parseInt(rating) : undefined,
        note_date: noteDate,
        is_confidential: isConfidential,
        is_shared_with_student: isShared,
      };
      if (editingNote) {
        await disciplineService.updateNote(editingNote.note_id, payload);
        showToast.saved('Note');
      } else {
        await disciplineService.createNote(payload);
        showToast.success('Behavioral note added');
      }
      onSuccess();
      onClose();
    } catch {
      showToast.apiError('Failed to save note');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editingNote ? 'Edit Note' : 'Add Behavioral Note'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Student Selector */}
        {studentId || editingNote ? (
          <div>
            <label className={labelCls}>Student <span className="text-red-500">*</span></label>
            <input type="text" value={editingNote?.student_name || studentName || sid} className={fieldCls} readOnly />
          </div>
        ) : (
          <SearchableSelect
            label="Select Student"
            required
            options={studentOptions}
            value={sid}
            onChange={(val) => {
              setSid(val);
              if (errors.student_id) setErrors(prev => ({ ...prev, student_id: '' }));
            }}
            placeholder="Search student by name or ID..."
            error={errors.student_id}
          />
        )}

        {/* Note Type */}
        <div>
          <label className={labelCls}>Note Type <span className="text-red-500">*</span></label>
          <select value={noteType} onChange={e => setNoteType(e.target.value)} className={fieldCls}>
            {NOTE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {errors.note_type && <p className={errorCls}>{errors.note_type}</p>}
        </div>

        {/* Category */}
        <div>
          <label className={labelCls}>Category</label>
          <select value={category} onChange={e => setCategory(e.target.value)} className={fieldCls}>
            <option value="">— No category —</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        {/* Content */}
        <div>
          <label className={labelCls}>Observation / Note <span className="text-red-500">*</span></label>
          <textarea rows={3} value={content} onChange={e => setContent(e.target.value)} className={fieldCls} placeholder="Write your observation here..." />
          {errors.content && <p className={errorCls}>{errors.content}</p>}
        </div>

        {/* Rating */}
        <div>
          <label className={labelCls}>Behavior Rating (1–5)</label>
          <input type="number" min="1" max="5" value={rating} onChange={e => setRating(e.target.value)} className={fieldCls} placeholder="Optional: 1 = Very poor, 5 = Excellent" />
          {errors.rating && <p className={errorCls}>{errors.rating}</p>}
        </div>

        {/* Date */}
        <div>
          <label className={labelCls}>Date</label>
          <input type="date" value={noteDate} onChange={e => setNoteDate(e.target.value)} className={fieldCls} />
        </div>

        {/* Flags */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={isConfidential} onChange={e => setIsConfidential(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Confidential (visible to admin only)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={isShared} onChange={e => setIsShared(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Share with student</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Saving…' : editingNote ? 'Update Note' : 'Add Note'}</Button>
        </div>
      </form>
    </Modal>
  );
};
