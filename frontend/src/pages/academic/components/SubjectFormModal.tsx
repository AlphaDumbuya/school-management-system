/**
 * SubjectFormModal — Add / Edit subject
 * Multi-step cascading category & level selector for Sierra Leone curriculum.
 * - xl modal size — spacious on desktop, full-sheet on mobile
 * - Auto-prefills subject code based on name initials
 * - Smart smooth-scroll to newly revealed sections
 * - Fully responsive cards with consistent spacing across all breakpoints
 */

import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronRight, Check } from 'lucide-react';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';
import { FormField } from '@components/admin/forms/FormField';
import { showToast } from '@utils/toast';
import { subjectsService, SubjectRecord, SubjectFormData } from '@services/subjectsService';

// ── Sierra Leone Subject Categories ──────────────────────────────────────────

const CATEGORIES = [
  { value: 'core', label: 'Core', description: 'Compulsory for all students', icon: '📖' },
  { value: 'science', label: 'Science', description: 'STEM subjects', icon: '🔬' },
  { value: 'arts', label: 'Arts / Humanities', description: 'Language, History, Culture', icon: '📜' },
  { value: 'commercial', label: 'Commercial', description: 'Business & Economics', icon: '💼' },
  { value: 'technical', label: 'Technical', description: 'Vocational & Technical', icon: '🔧' },
] as const;

const LEVELS = [
  { value: 'all', label: 'All Levels', description: 'Primary through SSS' },
  { value: 'primary', label: 'Primary', description: 'Class 1–6' },
  { value: 'jss', label: 'Junior Secondary', description: 'JSS 1–3 · BECE' },
  { value: 'sss', label: 'Senior Secondary', description: 'SSS 1–3 · WASSCE' },
] as const;

const DEPARTMENTS = [
  'Sciences',
  'Mathematics',
  'Languages',
  'Humanities',
  'Business',
  'Technical',
  'Arts & Culture',
  'Physical Education',
] as const;

type CategoryValue = typeof CATEGORIES[number]['value'];
type LevelValue = typeof LEVELS[number]['value'];

// ── Validation ────────────────────────────────────────────────────────────────

const schema = z.object({
  code: z.string().min(2, 'Code must be at least 2 characters').max(10, 'Max 10 characters'),
  name: z.string().min(1, 'Subject name is required').max(100, 'Max 100 characters'),
  description: z.string().max(500, 'Max 500 characters').optional().or(z.literal('')),
  department: z.string().optional().or(z.literal('')),
  max_marks: z.coerce.number().min(1, 'Min 1').max(1000, 'Max 1000'),
  pass_marks: z.coerce.number().min(0, 'Min 0').max(999, 'Max 999'),
  credit_points: z.coerce.number().min(0, 'Min 0').max(20, 'Max 20'),
  is_elective: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface SubjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingSubject?: SubjectRecord | null;
}

// ── Auto-generate code from name ──────────────────────────────────────────────

function generateCode(name: string): string {
  if (!name) return '';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 3).toUpperCase();
  }
  // Take first letter of each word, max 4 characters
  return words
    .map((w) => w[0])
    .join('')
    .substring(0, 4)
    .toUpperCase();
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

  // Cascading selector state
  const [category, setCategory] = React.useState<CategoryValue | null>(null);
  const [level, setLevel] = React.useState<LevelValue | null>(null);

  // Refs for smart scrolling
  const levelRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);

  /** Smoothly scroll element into view after animation renders */
  const scrollToRef = useCallback((ref: React.RefObject<HTMLDivElement | null>) => {
    setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  }, []);

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
      code: '',
      name: '',
      description: '',
      department: '',
      max_marks: 100,
      pass_marks: 40,
      credit_points: 3,
      is_elective: false,
    },
  });

  const watchedName = watch('name');
  const watchedCode = watch('code');

  // ── Auto-prefill code from name ──
  useEffect(() => {
    if (!watchedName) return;
    const autoCode = generateCode(watchedName);
    const currentCode = watchedCode;

    // Only auto-fill if code is empty or matches a previously generated code
    const isAutoGenerated = !currentCode || currentCode === generateCode(watchedName.trim().split(/\s+/).slice(0, -1).join(' '));
    if (isAutoGenerated || !currentCode) {
      setValue('code', autoCode);
    }
  }, [watchedName, setValue]);

  // Pre-populate when editing
  useEffect(() => {
    if (isOpen && editingSubject) {
      reset({
        code: editingSubject.code,
        name: editingSubject.name,
        description: editingSubject.description ?? '',
        department: editingSubject.department ?? '',
        max_marks: editingSubject.max_marks ?? 100,
        pass_marks: editingSubject.pass_marks ?? 40,
        credit_points: editingSubject.credit_points ?? 3,
        is_elective: editingSubject.is_elective ?? false,
      });
      setCategory(editingSubject.category ?? null);
      setLevel((editingSubject.level as LevelValue) ?? null);
    } else if (isOpen && !editingSubject) {
      reset({
        code: '', name: '', description: '', department: '',
        max_marks: 100, pass_marks: 40, credit_points: 3, is_elective: false,
      });
      setCategory(null);
      setLevel(null);
    }
    setServerError(null);
  }, [isOpen, editingSubject, reset]);

  // ── Handlers with smart scroll ──
  const handleCategorySelect = (cat: CategoryValue) => {
    setCategory(cat);
    // Auto-set is_elective based on category
    setValue('is_elective', cat !== 'core');
    scrollToRef(levelRef);
  };

  const handleLevelSelect = (lvl: LevelValue) => {
    setLevel(lvl);
    scrollToRef(detailsRef);
  };

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
        category: category || undefined,
        level: level || undefined,
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

  // Breadcrumb trail
  const breadcrumb = useMemo(() => {
    const parts: string[] = [];
    if (category) parts.push(CATEGORIES.find((c) => c.value === category)?.label ?? '');
    if (level) parts.push(LEVELS.find((l) => l.value === level)?.label ?? '');
    return parts;
  }, [category, level]);

  // ── Shared card styles ──
  const cardBase = 'relative rounded-xl border-2 transition-all duration-200 cursor-pointer select-none';
  const cardActive = 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-md ring-1 ring-blue-500/20';
  const cardInactive = 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:shadow-sm active:scale-[0.98]';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Subject' : 'Add New Subject'}
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full gap-3">
          {/* Status hint */}
          <div className="hidden sm:block text-xs text-gray-400 dark:text-gray-500">
            {!category && 'Select a category to continue'}
            {category && !level && 'Select a level to continue'}
            {category && level && 'Ready to create'}
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <Button variant="ghost" disabled={isSubmitting} onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="default"
              disabled={isSubmitting || !category || !level}
              onClick={handleSubmit(onSubmit)}
            >
              {isSubmitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Subject'}
            </Button>
          </div>
        </div>
      }
    >
      {serverError && (
        <div className="mb-5 p-3.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
          {serverError}
        </div>
      )}

      <form className="flex flex-col gap-7">

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION 1: CATEGORY & LEVEL
           ═══════════════════════════════════════════════════════════════════ */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest">
              Category & Level
            </h3>
            {breadcrumb.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs flex-wrap">
                {breadcrumb.map((part, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <ChevronRight size={10} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />}
                    <span className="font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">{part}</span>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>

          {/* ── Step 1: Category ── */}
          <div className="mb-5">
            <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
              1. Subject Category
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => handleCategorySelect(cat.value)}
                  className={`${cardBase} ${category === cat.value ? cardActive : cardInactive}
                    flex items-center gap-3 p-4`}
                >
                  {category === cat.value && (
                    <div className="absolute top-2.5 right-2.5">
                      <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow-sm">
                        <Check size={12} className="text-white" strokeWidth={3} />
                      </div>
                    </div>
                  )}
                  <span className="text-2xl flex-shrink-0">{cat.icon}</span>
                  <div className="min-w-0 pr-6">
                    <span className={`block text-sm font-bold leading-tight ${
                      category === cat.value ? 'text-blue-700 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'
                    }`}>
                      {cat.label}
                    </span>
                    <span className="block text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                      {cat.description}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Step 2: Level ── */}
          {category && (
            <div ref={levelRef} className="mb-5 animate-in fade-in slide-in-from-top-1 duration-200">
              <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                2. Education Level
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {LEVELS.map((lvl) => (
                  <button
                    key={lvl.value}
                    type="button"
                    onClick={() => handleLevelSelect(lvl.value)}
                    className={`${cardBase} ${level === lvl.value ? cardActive : cardInactive}
                      flex items-start gap-3 p-4 sm:p-5 text-left`}
                  >
                    {level === lvl.value && (
                      <div className="absolute top-2.5 right-2.5">
                        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow-sm">
                          <Check size={12} className="text-white" strokeWidth={3} />
                        </div>
                      </div>
                    )}
                    <div className="flex-1 min-w-0 pr-7">
                      <span className={`block text-sm font-bold ${
                        level === lvl.value ? 'text-blue-700 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'
                      }`}>
                        {lvl.label}
                      </span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                        {lvl.description}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION 2: SUBJECT DETAILS
           ═══════════════════════════════════════════════════════════════════ */}
        {category && level && (
          <section ref={detailsRef} className="animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
              <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-4">
                Subject Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <FormField
                  label="Subject Name"
                  placeholder="e.g. Physics"
                  required
                  error={errors.name?.message}
                  {...register('name')}
                />
                <FormField
                  label="Subject Code"
                  placeholder="e.g. PHY"
                  required
                  helperText="Auto-generated from name. You can customise it."
                  error={errors.code?.message}
                  {...register('code')}
                />
              </div>

              <div className="mt-4">
                <FormField
                  label="Description"
                  type="textarea"
                  placeholder="Brief description of the subject..."
                  error={errors.description?.message}
                  {...register('description')}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 mt-4">
                <div className="relative flex-1">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Department
                  </label>
                  <select
                    {...register('department')}
                    className="w-full appearance-none pl-3 pr-8 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-all"
                  >
                    <option value="">Select Department</option>
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept} className="bg-white dark:bg-gray-800">{dept}</option>
                    ))}
                  </select>
                </div>

                <FormField
                  label="Credit Points"
                  type="number"
                  placeholder="3"
                  helperText="Academic credit value (0–20)"
                  error={errors.credit_points?.message}
                  {...register('credit_points')}
                />
              </div>
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION 3: MARKS & OPTIONS
           ═══════════════════════════════════════════════════════════════════ */}
        {category && level && (
          <section className="animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
              <div className="mb-4">
                <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest">
                  Marks & Options
                </h3>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                  Configure grading parameters for this subject
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
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
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      {...register('is_elective')}
                      className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-800 cursor-pointer"
                    />
                    <div>
                      <span className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Elective</span>
                      <span className="block text-[11px] text-gray-400 dark:text-gray-500">Optional subject</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </section>
        )}
      </form>
    </Modal>
  );
};

export default SubjectFormModal;
