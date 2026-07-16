/**
 * AssignmentFormModal — Create / Edit an assignment
 */

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';
import { FormField } from '@components/admin/forms/FormField';
import { showToast } from '@utils/toast';
import { assignmentsService, AssignmentRecord, AssignmentFormData, ASSIGNMENT_TYPES } from '@services/assignmentsService';
import { classesService } from '@services/classesService';
import { subjectsService } from '@services/subjectsService';
import { timetableService } from '@services/timetableService';

// ── Validation ────────────────────────────────────────────────────────────────

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Max 200 characters'),
  description: z.string().max(2000).optional().or(z.literal('')),
  class_id: z.string().min(1, 'Class is required'),
  subject_id: z.string().min(1, 'Subject is required'),
  teacher_id: z.string().min(1, 'Teacher is required'),
  type: z.string().min(1, 'Type is required'),
  assigned_date: z.string().min(1, 'Assigned date is required'),
  due_date: z.string().min(1, 'Due date is required'),
  max_marks: z.coerce.number().min(1).max(1000),
  instructions: z.string().max(5000).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface AssignmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingAssignment?: AssignmentRecord | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const AssignmentFormModal: React.FC<AssignmentFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingAssignment,
}) => {
  const isEditing = !!editingAssignment;
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Fetch dropdowns
  const { data: classesData } = useQuery({
    queryKey: ['classes-dropdown'],
    queryFn: () => classesService.listClasses({ limit: 100 }),
    staleTime: 60_000,
  });
  const classes = (classesData as any)?.data ?? [];

  const { data: subjectsData } = useQuery({
    queryKey: ['subjects-dropdown'],
    queryFn: () => subjectsService.listSubjects({ limit: 100, status: 'active' }),
    staleTime: 60_000,
  });
  const subjects = (subjectsData as any)?.data ?? [];

  const { data: teachersData } = useQuery({
    queryKey: ['teachers-dropdown'],
    queryFn: () => timetableService.getTeachers(),
    staleTime: 60_000,
  });
  const teachers = (teachersData as any)?.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '', description: '', class_id: '', subject_id: '', teacher_id: '',
      type: 'homework', assigned_date: new Date().toISOString().split('T')[0],
      due_date: '', max_marks: 100, instructions: '',
    },
  });

  // Pre-populate when editing
  useEffect(() => {
    if (isOpen && editingAssignment) {
      reset({
        title: editingAssignment.title,
        description: editingAssignment.description ?? '',
        class_id: editingAssignment.class_id,
        subject_id: editingAssignment.subject_id,
        teacher_id: editingAssignment.teacher_id,
        type: editingAssignment.type,
        assigned_date: editingAssignment.assigned_date?.split('T')[0] ?? '',
        due_date: editingAssignment.due_date?.split('T')[0] ?? '',
        max_marks: editingAssignment.max_marks,
        instructions: editingAssignment.instructions ?? '',
      });
    } else if (isOpen && !editingAssignment) {
      reset({
        title: '', description: '', class_id: '', subject_id: '', teacher_id: '',
        type: 'homework', assigned_date: new Date().toISOString().split('T')[0],
        due_date: '', max_marks: 100, instructions: '',
      });
    }
    setServerError(null);
  }, [isOpen, editingAssignment, reset]);

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const payload: AssignmentFormData = {
        title: values.title,
        description: values.description || undefined,
        class_id: values.class_id,
        subject_id: values.subject_id,
        teacher_id: values.teacher_id,
        type: values.type as any,
        assigned_date: values.assigned_date,
        due_date: values.due_date,
        max_marks: values.max_marks,
        instructions: values.instructions || undefined,
      };

      if (isEditing && editingAssignment) {
        const res = await assignmentsService.updateAssignment(editingAssignment.id, payload);
        if (res.success === false) throw new Error(res.error ?? 'Update failed');
        showToast.saved('Assignment');
      } else {
        const res = await assignmentsService.createAssignment(payload);
        if (res.success === false) throw new Error(res.error ?? 'Create failed');
        showToast.success('Assignment created');
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
      title={isEditing ? 'Edit Assignment' : 'Create Assignment'}
      size="lg"
      footer={
        <div className="flex items-center gap-3 ml-auto">
          <Button variant="ghost" disabled={isSubmitting} onClick={onClose}>Cancel</Button>
          <Button variant="default" disabled={isSubmitting} onClick={handleSubmit(onSubmit)}>
            {isSubmitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Assignment'}
          </Button>
        </div>
      }
    >
      {serverError && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
          {serverError}
        </div>
      )}

      <form className="flex flex-col gap-5">
        {/* Title */}
        <FormField label="Title" placeholder="e.g. Chapter 5 Homework" required error={errors.title?.message} {...register('title')} />

        {/* Class + Subject + Teacher row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Class <span className="text-red-500">*</span></label>
            <select {...register('class_id')} className="w-full px-3 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select class...</option>
              {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.class_id && <p className="text-xs text-red-600">{errors.class_id.message}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Subject <span className="text-red-500">*</span></label>
            <select {...register('subject_id')} className="w-full px-3 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select subject...</option>
              {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
            </select>
            {errors.subject_id && <p className="text-xs text-red-600">{errors.subject_id.message}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Teacher <span className="text-red-500">*</span></label>
            <select {...register('teacher_id')} className="w-full px-3 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select teacher...</option>
              {teachers.map((t: any) => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
            </select>
            {errors.teacher_id && <p className="text-xs text-red-600">{errors.teacher_id.message}</p>}
          </div>
        </div>

        {/* Type + Dates + Marks row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Type <span className="text-red-500">*</span></label>
            <select {...register('type')} className="w-full px-3 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {ASSIGNMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Assigned <span className="text-red-500">*</span></label>
            <input type="date" {...register('assigned_date')} className="w-full px-3 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {errors.assigned_date && <p className="text-xs text-red-600">{errors.assigned_date.message}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Due Date <span className="text-red-500">*</span></label>
            <input type="date" {...register('due_date')} className="w-full px-3 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {errors.due_date && <p className="text-xs text-red-600">{errors.due_date.message}</p>}
          </div>

          <FormField label="Max Marks" type="number" placeholder="100" required error={errors.max_marks?.message} {...register('max_marks')} />
        </div>

        {/* Description */}
        <FormField label="Description" type="textarea" placeholder="Brief description of the assignment..." error={errors.description?.message} {...register('description')} />

        {/* Instructions */}
        <FormField label="Instructions (Optional)" type="textarea" placeholder="Detailed instructions for students..." error={errors.instructions?.message} {...register('instructions')} />
      </form>
    </Modal>
  );
};

export default AssignmentFormModal;
