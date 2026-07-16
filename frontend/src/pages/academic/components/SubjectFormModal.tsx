/**
 * SubjectFormModal — Add / Edit subject
 * Flexible form — category and level are optional classification helpers.
 * Schools can add subjects for ANY level (nursery, primary, JSS, SSS).
 */

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';
import { FormField } from '@components/admin/forms/FormField';
import { showToast } from '@utils/toast';
import { subjectsService, SubjectRecord, SubjectFormData } from '@services/subjectsService';

// ── Options ───────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'core', label: 'Core' },
  { value: 'science', label: 'Science' },
  { value: 'arts', label: 'Arts / Humanities' },
  { value: 'commercial', label: 'Commercial / Business' },
  { value: 'technical', label: 'Technical / Vocational' },
];

const LEVELS = [
  { value: 'all', label: 'All Levels' },
  { value: 'nursery', label: 'Nursery' },
  { value: 'primary', label: 'Primary (Class 1–6)' },
  { value: 'jss', label: 'Junior Secondary (JSS)' },
  { value: 'sss', label: 'Senior Secondary (SSS)' },
];

const DEPARTMENTS = [
  'Sciences',
  'Mathematics',
  'Languages',
  'Humanities',
  'Business',
  'Technical',
  'Arts & Culture',
  'Physical Education',
  'Early Childhood',
];

// ── Validation ────────────────────────────────────────────────────────────────

const schema = z.object({
  code: z.string().min(2, 'Code must be at least 2 characters').max(10, 'Max 10 characters'),
  name: z.string().min(1, 'Subject name is required').max(100, 'Max 100 characters'),
  description: z.string().max(500, 'Max 500 characters').optional().or(z.literal('')),
  category: z.string().optional().or(z.literal('')),
  level: z.string().optional().or(z.literal('')),
  department: z.string().optional().or(z.literal('')),
  max_marks: z.coerce.number().min(1, 'Min 1').max(1000, 'Max 1000'),
  pass_marks: z.coerce.number().min(0, 'Min 0').max(999, 'Max 999'),
  credit_points: z.coerce.number().min(0, 'Min 0').max(20, 'Max 20'),
  is_elective: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

// ── Auto-generate code from name ──────────────────────────────────────────────

function generateCode(name: string): string {
  if (!name) return '';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].substring(0, 3).toUpperCase();
  return words.map((w) => w[0]).join('').substring(0, 4).toUpperCase();
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface SubjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingSubject?: SubjectRecord | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const SubjectFormModal: React.FC<SubjectFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingSubject,
}) => {
  const isEditing = !!editingSubject;
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: '', name: '', description: '', category: '', level: 'all',
      department: '', max_marks: 100, pass_marks: 40, credit_points: 3, is_elective: false,
    },
  });

  const watchedName = watch('name');

  // Auto-generate code from name
  useEffect(() => {
    if (!watchedName) return;
    const currentCode = watch('code');
    if (!currentCode || currentCode === generateCode(watchedName.slice(0, -1))) {
      setValue('code', generateCode(watchedName));
    }
  }, [watchedName, setValue, watch]);

  // Pre-populate when editing
  useEffect(() => {
    if (isOpen && editingSubject) {
      reset({
        code: editingSubject.code,
        name: editingSubject.name,
        description: editingSubject.description ?? '',
        category: editingSubject.category ?? '',
        level: editingSubject.level ?? 'all',
        department: editingSubject.department ?? '',
        max_marks: editingSubject.max_marks ?? 100,
        pass_marks: editingSubject.pass_marks ?? 40,
        credit_points: editingSubject.credit_points ?? 3,
        is_elective: editingSubject.is_elective ?? false,
      });
    } else if (isOpen && !editingSubject) {
      reset({
        code: '', name: '', description: '', category: '', level: 'all',
        department: '', max_marks: 100, pass_marks: 40, credit_points: 3, is_elective: false,
      });
    }
    setServerError(null);
  }, [isOpen, editingSubject, reset]);

  // Submit
  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const payload: SubjectFormData = {
        code: values.code.toUpperCase(),
        name: values.name,
        description: values.description || undefined,
        department: values.department || undefined,
        max_marks: values.max_marks,
        pass_marks: values.pass_marks,
        credit_points: values.credit_points,
        is_elective: values.is_elective,
        category: values.category || undefined,
        level: values.level || undefined,
      };

      if (isEditing && editingSubject) {
        const res = await subjectsService.updateSubject(editingSubject.id, payload);
        if (res.success === false) throw new Error(res.error ?? 'Update failed');
        showToast.saved('Subject');
      } else {
        const res = await subjectsService.createSubject(payload);
        if (res.success === false) throw new Error(res.error ?? 'Create failed');
        showToast.saved('Subject');
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
      title={isEditing ? 'Edit Subject' : 'Add New Subject'}
      size="lg"
      footer={
        <div className="flex items-center gap-3 ml-auto">
          <Button variant="ghost" disabled={isSubmitting} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="default"
            disabled={isSubmitting}
            onClick={handleSubmit(onSubmit)}
          >
            {isSubmitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Subject'}
          </Button>
        </div>
      }
    >
      {serverError && (
        <div className="mb-5 p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
          {serverError}
        </div>
      )}

      <form className="flex flex-col gap-6">
        {/* ── Subject Identity ── */}
        <div>
          <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-4">
            Subject Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Subject Name"
              placeholder="e.g. English Language, Physics, Numeracy"
              required
              error={errors.name?.message}
              {...register('name')}
            />
            <FormField
              label="Subject Code"
              placeholder="e.g. ENG, PHY, NUM"
              required
              helperText="Auto-generated from name"
              error={errors.code?.message}
              {...register('code')}
            />
          </div>
          <div className="mt-4">
            <FormField
              label="Description"
              type="textarea"
              placeholder="Brief description of what the subject covers..."
              error={errors.description?.message}
              {...register('description')}
            />
          </div>
        </div>

        {/* ── Classification (all optional) ── */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
          <div className="mb-4">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest">
              Classification
            </h3>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
              Optional — helps organize subjects by category and level
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Category */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
              <select
                {...register('category')}
                className="w-full px-3 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">None</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Level */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Level</label>
              <select
                {...register('level')}
                className="w-full px-3 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>

            {/* Department */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Department</label>
              <select
                {...register('department')}
                className="w-full px-3 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">None</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Marks & Options ── */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
          <div className="mb-4">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest">
              Marks & Grading
            </h3>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
              Set grading parameters for this subject
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <FormField
              label="Max Marks"
              type="number"
              placeholder="100"
              required
              error={errors.max_marks?.message}
              {...register('max_marks')}
            />
            <FormField
              label="Pass Marks"
              type="number"
              placeholder="40"
              required
              error={errors.pass_marks?.message}
              {...register('pass_marks')}
            />
            <FormField
              label="Credits"
              type="number"
              placeholder="3"
              error={errors.credit_points?.message}
              {...register('credit_points')}
            />
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  {...register('is_elective')}
                  className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-800 cursor-pointer"
                />
                <div>
                  <span className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Elective</span>
                  <span className="block text-[11px] text-gray-400 dark:text-gray-500">Optional</span>
                </div>
              </label>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default SubjectFormModal;
