/**
 * ExaminationFormModal — Create / Edit an examination
 * Uses SearchableSelect for class/subject.
 */

import React, { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';
import { FormField } from '@components/admin/forms/FormField';
import { SearchableSelect } from '@components/admin/forms/SearchableSelect';
import { RichTextarea } from '@components/admin/forms/RichTextarea';
import { showToast } from '@utils/toast';
import { examinationsService, ExaminationRecord, ExamFormData, EXAM_TYPES, EXAM_TERMS } from '@services/examinationsService';
import { classesService } from '@services/classesService';
import { subjectsService } from '@services/subjectsService';

// ── Validation ────────────────────────────────────────────────────────────────

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(5000).optional().or(z.literal('')),
  type: z.string().min(1, 'Type is required'),
  term: z.string().min(1, 'Term is required'),
  academic_year: z.string().min(1, 'Academic year is required'),
  class_id: z.string().optional().or(z.literal('')),
  subject_id: z.string().optional().or(z.literal('')),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional().or(z.literal('')),
  total_marks: z.coerce.number().min(1).max(1000),
  pass_marks: z.coerce.number().min(0).max(999),
  duration_minutes: z.coerce.number().min(10).max(480),
  venue: z.string().max(200).optional().or(z.literal('')),
  instructions: z.string().max(5000).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface ExaminationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingExam?: ExaminationRecord | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ExaminationFormModal: React.FC<ExaminationFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingExam,
}) => {
  const isEditing = !!editingExam;
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Fetch dropdowns
  const { data: classesData } = useQuery({
    queryKey: ['classes-dropdown'],
    queryFn: () => classesService.listClasses({ limit: 100 }),
    staleTime: 60_000,
  });
  const classes = (classesData as any)?.data ?? [];
  const classOptions = useMemo(() => classes.map((c: any) => ({ value: String(c.id), label: c.name, sublabel: c.level })), [classes]);

  const { data: subjectsData } = useQuery({
    queryKey: ['subjects-dropdown'],
    queryFn: () => subjectsService.listSubjects({ limit: 100, status: 'active' }),
    staleTime: 60_000,
  });
  const subjects = (subjectsData as any)?.data ?? [];
  const subjectOptions = useMemo(() => subjects.map((s: any) => ({ value: String(s.id), label: s.name, sublabel: s.code })), [subjects]);

  // Current academic year default
  const currentYear = new Date().getFullYear();
  const defaultAcademicYear = `${currentYear}/${currentYear + 1}`;

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '', description: '', type: '', term: '', academic_year: defaultAcademicYear,
      class_id: '', subject_id: '', start_date: '', end_date: '',
      total_marks: 100, pass_marks: 40, duration_minutes: 120, venue: '', instructions: '',
    },
  });

  useEffect(() => {
    if (isOpen && editingExam) {
      reset({
        title: editingExam.title,
        description: editingExam.description ?? '',
        type: editingExam.type,
        term: editingExam.term,
        academic_year: editingExam.academic_year,
        class_id: editingExam.class_id ?? '',
        subject_id: editingExam.subject_id ?? '',
        start_date: editingExam.start_date?.split('T')[0] ?? '',
        end_date: editingExam.end_date?.split('T')[0] ?? '',
        total_marks: editingExam.total_marks,
        pass_marks: editingExam.pass_marks,
        duration_minutes: editingExam.duration_minutes,
        venue: editingExam.venue ?? '',
        instructions: editingExam.instructions ?? '',
      });
    } else if (isOpen && !editingExam) {
      reset({
        title: '', description: '', type: '', term: '', academic_year: defaultAcademicYear,
        class_id: '', subject_id: '', start_date: '', end_date: '',
        total_marks: 100, pass_marks: 40, duration_minutes: 120, venue: '', instructions: '',
      });
    }
    setServerError(null);
  }, [isOpen, editingExam, reset, defaultAcademicYear]);

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const payload: ExamFormData = {
        title: values.title,
        description: values.description || undefined,
        type: values.type as any,
        term: values.term as any,
        academic_year: values.academic_year,
        class_id: values.class_id || undefined,
        subject_id: values.subject_id || undefined,
        start_date: values.start_date,
        end_date: values.end_date || undefined,
        total_marks: values.total_marks,
        pass_marks: values.pass_marks,
        duration_minutes: values.duration_minutes,
        venue: values.venue || undefined,
        instructions: values.instructions || undefined,
      };

      if (isEditing && editingExam) {
        const res = await examinationsService.updateExamination(editingExam.id, payload);
        if (res.success === false) throw new Error(res.error ?? 'Update failed');
        showToast.saved('Examination');
      } else {
        const res = await examinationsService.createExamination(payload);
        if (res.success === false) throw new Error(res.error ?? 'Create failed');
        showToast.success('Examination scheduled');
      }
      onSuccess();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setServerError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Examination' : 'Schedule Examination'}
      size="xl"
      footer={
        <div className="flex items-center gap-3 ml-auto">
          <Button variant="ghost" disabled={isSubmitting} onClick={onClose}>Cancel</Button>
          <Button variant="default" disabled={isSubmitting} onClick={handleSubmit(onSubmit)}>
            {isSubmitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Schedule Exam'}
          </Button>
        </div>
      }
    >
      {serverError && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
          {serverError}
        </div>
      )}

      <form className="flex flex-col gap-6">
        {/* Title */}
        <FormField label="Examination Title" placeholder="e.g. First Term Mid-Term Examination 2025" required error={errors.title?.message} {...register('title')} />

        {/* Type + Term + Academic Year */}
        <div>
          <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-3">Classification</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Type <span className="text-red-500">*</span></label>
              <select {...register('type')} className="w-full px-3 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select type...</option>
                {EXAM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {errors.type && <p className="text-xs text-red-600">{errors.type.message}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Term <span className="text-red-500">*</span></label>
              <select {...register('term')} className="w-full px-3 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select term...</option>
                {EXAM_TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {errors.term && <p className="text-xs text-red-600">{errors.term.message}</p>}
            </div>
            <FormField label="Academic Year" placeholder="2025/2026" required error={errors.academic_year?.message} {...register('academic_year')} />
          </div>
        </div>

        {/* Class + Subject (optional) */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
          <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-1">Scope</h3>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-3">Optional — leave blank for school-wide exams</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Controller name="class_id" control={control} render={({ field }) => (
              <SearchableSelect label="Class" options={classOptions} value={field.value || ''} onChange={field.onChange} placeholder="All classes" searchPlaceholder="Search classes..." />
            )} />
            <Controller name="subject_id" control={control} render={({ field }) => (
              <SearchableSelect label="Subject" options={subjectOptions} value={field.value || ''} onChange={field.onChange} placeholder="All subjects" searchPlaceholder="Search subjects..." />
            )} />
          </div>
        </div>

        {/* Schedule */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
          <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-3">Schedule</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Start Date <span className="text-red-500">*</span></label>
              <input type="date" {...register('start_date')} className="w-full px-3 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {errors.start_date && <p className="text-xs text-red-600">{errors.start_date.message}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">End Date</label>
              <input type="date" {...register('end_date')} className="w-full px-3 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <FormField label="Duration (min)" type="number" placeholder="120" required error={errors.duration_minutes?.message} {...register('duration_minutes')} />
            <FormField label="Venue" placeholder="e.g. Hall A" error={errors.venue?.message} {...register('venue')} />
          </div>
        </div>

        {/* Marks */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
          <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-3">Marks</h3>
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
            <FormField label="Total Marks" type="number" placeholder="100" required error={errors.total_marks?.message} {...register('total_marks')} />
            <FormField label="Pass Marks" type="number" placeholder="40" required error={errors.pass_marks?.message} {...register('pass_marks')} />
          </div>
        </div>

        {/* Instructions */}
        <Controller
          name="instructions"
          control={control}
          render={({ field }) => (
            <RichTextarea
              label="Instructions / Notes (Optional)"
              placeholder="General exam instructions for invigilators and students..."
              value={field.value}
              onChange={field.onChange}
              error={errors.instructions?.message}
              helperText="Use bullet points and formatting for clarity"
              minHeight="100px"
            />
          )}
        />
      </form>
    </Modal>
  );
};

export default ExaminationFormModal;
