/**
 * SubjectFormModal — Add / Edit subject
 * Featuring:
 *  - Multi-level selection (Nursery, Primary, JSS, SSS, Technical)
 *  - Authentic Sierra Leone Ministry of Education (MBSSE / WAEC) departments
 *  - Smart default pass & max marks based on selected level (WASSCE: 40%, BECE/NPSE: 50%)
 *  - Formatted Description Text Editor with quick formatting toolbar
 */

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';
import { FormField } from '@components/admin/forms/FormField';
import { showToast } from '@utils/toast';
import { subjectsService, SubjectRecord, SubjectFormData } from '@services/subjectsService';
import { Bold, Italic, List, Sparkles, Check, Info } from 'lucide-react';

// ── Options ───────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'core', label: 'Core / Mandatory' },
  { value: 'elective', label: 'Elective / Optional' },
];

export const LEVEL_OPTIONS = [
  { value: 'nursery', label: 'Nursery / Pre-School', code: 'NUR', defaultPass: 50 },
  { value: 'primary', label: 'Primary (Class 1–6)', code: 'PRI', defaultPass: 50 },
  { value: 'jss', label: 'Junior Secondary (JSS 1–3)', code: 'JSS', defaultPass: 50 },
  { value: 'sss', label: 'Senior Secondary (SSS 1–3)', code: 'SSS', defaultPass: 40 },
  { value: 'technical', label: 'Technical & Vocational', code: 'VOC', defaultPass: 50 },
];

export const DEPARTMENTS_BY_LEVEL: Record<string, string[]> = {
  sss: [
    'Sciences',
    'Arts & Humanities',
    'Commercial & Business',
    'Technical & Vocational',
    'General Studies',
  ],
  jss: [
    'Basic Sciences & Tech',
    'Languages & Literature',
    'Social & Religious Studies',
    'Business & Practical Skills',
    'General Education',
  ],
  primary: [
    'Primary Education',
    'Mathematics',
    'English Language',
    'Social & General Studies',
  ],
  nursery: [
    'Early Childhood',
    'Pre-Primary Basics',
  ],
  technical: [
    'Engineering & Industrial Tech',
    'Business & Accounting',
    'Home Economics',
    'Information Technology (ICT)',
  ],
  default: [
    'Sciences',
    'Arts & Humanities',
    'Commercial & Business',
    'Technical & Vocational',
    'General Studies',
  ],
};

export const SIERRA_LEONE_DEPARTMENTS = DEPARTMENTS_BY_LEVEL.default;

// ── Validation ────────────────────────────────────────────────────────────────

const schema = z.object({
  code: z.string().min(2, 'Code must be at least 2 characters').max(10, 'Max 10 characters'),
  name: z.string().min(1, 'Subject name is required').max(100, 'Max 100 characters'),
  description: z.string().max(1000, 'Max 1000 characters').optional().or(z.literal('')),
  category: z.string().optional().or(z.literal('')),
  // Kept in the schema so it is actually saved (zod drops unknown keys).
  level: z.string().optional().or(z.literal('')),
  department: z.string().optional().or(z.literal('')),
  max_marks: z.coerce.number().min(1, 'Min 1%').max(100, 'Max 100%'),
  pass_marks: z.coerce.number().min(0, 'Min 0%').max(100, 'Max 100%'),
  credit_points: z.coerce.number().min(0, 'Min 0').max(20, 'Max 20'),
  is_elective: z.boolean(),
}).refine((v) => v.pass_marks <= v.max_marks, {
  path: ['pass_marks'],
  message: 'Pass mark cannot be higher than the maximum',
});

/** Departments apply to SSS only; anything else is offered to all of them. */
export const ALL_DEPARTMENTS = 'All';
const SSS_DEPARTMENTS = [ALL_DEPARTMENTS, ...DEPARTMENTS_BY_LEVEL.sss];

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
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Multi-level selection state (array of level values e.g. ['primary', 'jss', 'sss'])
  const [selectedLevels, setSelectedLevels] = useState<string[]>(['jss', 'sss']);

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
      category: 'core',
      level: 'all',
      department: ALL_DEPARTMENTS,
      max_marks: 100,
      pass_marks: 50,
      credit_points: 3,
      is_elective: false,
    },
  });

  const watchedName = watch('name');
  const watchedDescription = watch('description') || '';
  const watchedLevel = watch('level') || 'all';

  // Only an SSS-only subject belongs to one department. A subject taught at
  // other levels too (e.g. English from Primary to SSS) is for all departments.
  const sssOnly = watchedLevel === 'sss';
  const activeDepartments = React.useMemo(
    () => (sssOnly ? SSS_DEPARTMENTS : [ALL_DEPARTMENTS]),
    [sssOnly],
  );

  // Toggle multi-level pill selection
  const toggleLevel = (levelVal: string) => {
    let updated: string[];
    if (selectedLevels.includes(levelVal)) {
      if (selectedLevels.length === 1) {
        showToast.warning('At least one school level must be selected.');
        return;
      }
      updated = selectedLevels.filter((l) => l !== levelVal);
    } else {
      updated = [...selectedLevels, levelVal];
    }
    setSelectedLevels(updated);
  };

  // Select all levels
  const selectAllLevels = () => {
    setSelectedLevels(LEVEL_OPTIONS.map((l) => l.value));
  };

  // Keep the department valid for the level (non-SSS → All).
  // The pass mark is left as typed: it no longer resets when the level changes.
  useEffect(() => {
    const currentDept = watch('department');
    if (!currentDept || !activeDepartments.includes(currentDept)) {
      setValue('department', ALL_DEPARTMENTS);
    }
  }, [activeDepartments, watch, setValue]);

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
        category: editingSubject.category ?? 'core',
        level: editingSubject.level ?? 'all',
        department: editingSubject.level === 'sss' && editingSubject.department ? editingSubject.department : ALL_DEPARTMENTS,
        max_marks: Math.min(Number(editingSubject.max_marks ?? 100), 100),
        pass_marks: Math.min(Number(editingSubject.pass_marks ?? 50), 100),
        credit_points: editingSubject.credit_points ?? 3,
        is_elective: editingSubject.is_elective ?? false,
      });
    } else if (isOpen && !editingSubject) {
      reset({
        code: '',
        name: '',
        description: '',
        category: 'core',
        level: 'all',
        department: ALL_DEPARTMENTS,
        max_marks: 100,
        pass_marks: 50,
        credit_points: 3,
        is_elective: false,
      });
    }
    setServerError(null);
  }, [isOpen, editingSubject, reset]);

  // Rich Text Editor formatting helper
  const insertFormatting = (prefix: string, suffix: string = '') => {
    const current = watchedDescription;
    setValue('description', `${current}${prefix}${suffix}`, { shouldValidate: true });
  };

  // Submit
  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const isElective = values.category === 'elective';

      const payload: SubjectFormData = {
        code: values.code.toUpperCase(),
        name: values.name,
        description: values.description || undefined,
        department: (values.level === 'sss' && values.department) || ALL_DEPARTMENTS,
        max_marks: values.max_marks,
        pass_marks: values.pass_marks,
        credit_points: values.credit_points,
        is_elective: isElective,
        category: values.category || 'core',
        level: values.level || 'all',
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
      title={isEditing ? 'Edit Subject Details' : 'Add New Subject'}
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
          <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
            Subject Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Subject Name"
              placeholder="e.g. Mathematics, English Language, Physics"
              required
              error={errors.name?.message}
              {...register('name')}
            />
            <FormField
              label="Subject Code"
              placeholder="e.g. MTH, ENG, PHY"
              required
              helperText="Auto-generated from name"
              error={errors.code?.message}
              {...register('code')}
            />
          </div>

          {/* ── RICH TEXT FORMATTED DESCRIPTION EDITOR ── */}
          <div className="mt-4 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Syllabus & Course Description
              </label>
              <span className="text-[11px] text-gray-400 font-mono">
                {watchedDescription.length} / 1000 chars
              </span>
            </div>

            {/* Editor Formatting Toolbar */}
            <div className="border border-gray-300 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
              <div className="flex items-center gap-1 p-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => insertFormatting('**', '**')}
                  className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
                  title="Bold Text"
                >
                  <Bold size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('*', '*')}
                  className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
                  title="Italic Text"
                >
                  <Italic size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('\n• ')}
                  className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
                  title="Bullet Point"
                >
                  <List size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting(' [Module 1]: ')}
                  className="px-2 py-1 text-[11px] font-bold rounded bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors ml-auto"
                >
                  + Add Module Tag
                </button>
              </div>

              <textarea
                rows={3}
                {...register('description')}
                placeholder="Enter syllabus overview, objectives, key learning modules, or WAEC exam requirements..."
                className="w-full p-3 bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none resize-y min-h-[90px]"
              />
            </div>
            {errors.description && (
              <p className="text-xs text-red-500">{errors.description.message}</p>
            )}
          </div>
        </div>

        {/* ── CLASSIFICATION & SUBJECT TYPE (RADIO BUTTONS FOR CATEGORY) ── */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
          <div className="mb-4">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest">
              Classification & Subject Type
            </h3>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
              Choose whether this subject is compulsory or optional, and set its level & department
            </p>
          </div>

          {/* RADIO BUTTONS FOR SUBJECT TYPE */}
          <div className="mb-5">
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
              Subject Type (Mandatory vs Optional) <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                watch('category') === 'core' || !watch('category')
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-500/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  value="core"
                  {...register('category')}
                  defaultChecked
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <div>
                  <span className="block text-sm font-bold text-gray-900 dark:text-white">Core / Mandatory</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">Compulsory subject required for all students</span>
                </div>
              </label>

              <label className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                watch('category') === 'elective'
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30 ring-2 ring-purple-500/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  value="elective"
                  {...register('category')}
                  className="w-4 h-4 text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
                <div>
                  <span className="block text-sm font-bold text-gray-900 dark:text-white">Elective / Optional</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">Optional subject selected based on student stream</span>
                </div>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Level Select */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Level</label>
              <select
                {...register('level')}
                className="w-full px-3 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">All Levels (Nursery to SSS)</option>
                <option value="nursery">Nursery only</option>
                <option value="primary">Primary only (Class 1–6)</option>
                <option value="jss">JSS only (JSS 1–3)</option>
                <option value="sss">SSS only (SSS 1–3)</option>
                <option value="nursery,primary">Nursery & Primary</option>
                <option value="primary,jss">Primary & JSS</option>
                <option value="jss,sss">JSS & SSS</option>
                <option value="primary,jss,sss">Primary, JSS & SSS</option>
                <option value="technical">Technical & Vocational</option>
              </select>
            </div>

            {/* Department: SSS-only subjects pick one; everything else is All */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Department
              </label>
              <select
                {...register('department')}
                disabled={!sssOnly}
                className="w-full px-3 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {activeDepartments.map((d) => (
                  <option key={d} value={d}>{d === ALL_DEPARTMENTS ? 'All departments' : d}</option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                {sssOnly ? 'Pick a department, or All if every SSS stream takes it.' : 'Departments are for SSS only, so this subject is for all departments.'}
              </p>
            </div>
          </div>
        </div>

        {/* ── MARKS & GRADING STANDARDS ── */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
          <div className="mb-4">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest">
              Marks & Grading Standards
            </h3>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
              Configure maximum score and pass mark threshold for this subject
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField
              label="Maximum Mark (%)"
              type="number"
              min={1}
              max={100}
              placeholder="100"
              required
              helperText="Up to 100%"
              error={errors.max_marks?.message}
              {...register('max_marks')}
            />
            <FormField
              label="Pass Mark (%)"
              type="number"
              min={0}
              max={100}
              placeholder="50"
              helperText="Up to 100%"
              required
              error={errors.pass_marks?.message}
              {...register('pass_marks')}
            />
            <FormField
              label="Credit Points"
              type="number"
              placeholder="3"
              error={errors.credit_points?.message}
              {...register('credit_points')}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default SubjectFormModal;
