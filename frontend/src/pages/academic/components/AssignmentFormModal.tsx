/**
 * AssignmentFormModal — Create / Edit an assignment
 * Uses SearchableSelect for class/subject/teacher (handles large datasets).
 * Includes level filter to narrow down classes.
 */

import React, { useEffect, useMemo, useState } from 'react';
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
import { assignmentsService, AssignmentRecord, AssignmentFormData, ASSIGNMENT_TYPES } from '@services/assignmentsService';
import { classesService } from '@services/classesService';
import { subjectsService } from '@services/subjectsService';
import { timetableService } from '@services/timetableService';
import { useAuth } from '@hooks/useAuth';

// ── Validation ────────────────────────────────────────────────────────────────

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Max 200 characters'),
  description: z.string().max(10000).optional().or(z.literal('')),
  class_id: z.string().min(1, 'Class is required'),
  subject_id: z.string().min(1, 'Subject is required'),
  teacher_id: z.string().min(1, 'Teacher is required'),
  type: z.string().min(1, 'Type is required'),
  assigned_date: z.string().min(1, 'Assigned date is required'),
  due_date: z.string().min(1, 'Due date is required'),
  max_marks: z.coerce.number().min(1).max(1000),
  instructions: z.string().max(10000).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

// ── Level options for filtering classes ───────────────────────────────────────

const CLASS_LEVELS = [
  { value: '', label: 'All Levels' },
  { value: 'nursery', label: 'Nursery' },
  { value: 'primary', label: 'Primary' },
  { value: 'jss', label: 'JSS' },
  { value: 'sss', label: 'SSS' },
];

function getClassLevelCategory(level: string): string {
  if (level.startsWith('NURSERY')) return 'nursery';
  if (level.startsWith('CLASS')) return 'primary';
  if (level.startsWith('JSS')) return 'jss';
  if (level.startsWith('SSS')) return 'sss';
  return '';
}

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
  const { user } = useAuth();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [levelFilter, setLevelFilter] = useState('');

  // Fetch dropdowns
  const { data: classesData } = useQuery({
    queryKey: ['classes-dropdown'],
    queryFn: () => classesService.listClasses({ limit: 100 }),
    staleTime: 60_000,
  });
  const allClasses = (classesData as any)?.data ?? [];

  // Filter classes by selected level
  const filteredClasses = useMemo(() => {
    if (!levelFilter) return allClasses;
    return allClasses.filter((c: any) => getClassLevelCategory(c.level) === levelFilter);
  }, [allClasses, levelFilter]);

  // Level-filter options limited to the categories actually present in the
  // (already scoped) class list — so a teacher only sees their own levels.
  const levelOptions = useMemo(() => {
    const present = new Set(
      allClasses.map((c: any) => getClassLevelCategory(c.level)).filter(Boolean),
    );
    return CLASS_LEVELS.filter((l) => l.value === '' || present.has(l.value));
  }, [allClasses]);

  // Class options for SearchableSelect
  const classOptions = useMemo(() =>
    filteredClasses.map((c: any) => ({
      value: String(c.id),
      label: c.name,
      sublabel: c.section ? `Stream: ${c.section}` : c.level,
    })),
    [filteredClasses]
  );

  const { data: subjectsData } = useQuery({
    queryKey: ['subjects-dropdown'],
    queryFn: () => subjectsService.listSubjects({ limit: 100, status: 'active' }),
    staleTime: 60_000,
  });
  const subjects = (subjectsData as any)?.data ?? [];
  const subjectOptions = useMemo(() =>
    subjects.map((s: any) => ({
      value: String(s.id),
      label: s.name,
      sublabel: s.code,
    })),
    [subjects]
  );

  const { data: teachersData } = useQuery({
    queryKey: ['teachers-dropdown'],
    queryFn: () => timetableService.getTeachers(),
    staleTime: 60_000,
  });
  const teachers = (teachersData as any)?.data ?? [];
  // A teacher can only create assignments as themselves — lock the selector.
  const isTeacher = user?.role === 'teacher';
  const ownTeacherId = useMemo(() => {
    if (!isTeacher) return '';
    const me = teachers.find((t: any) => String(t.user_id) === String(user?.id));
    return me ? String(me.id) : '';
  }, [teachers, isTeacher, user?.id]);
  const teacherOptions = useMemo(() =>
    teachers.map((t: any) => ({
      value: String(t.id),
      label: `${t.first_name} ${t.last_name}`,
      sublabel: t.specialization || undefined,
    })),
    [teachers]
  );

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
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
      // Set level filter based on class
      if (editingAssignment.class_level) {
        setLevelFilter(getClassLevelCategory(editingAssignment.class_level));
      }
    } else if (isOpen && !editingAssignment) {
      reset({
        title: '', description: '', class_id: '', subject_id: '', teacher_id: '',
        type: 'homework', assigned_date: new Date().toISOString().split('T')[0],
        due_date: '', max_marks: 100, instructions: '',
      });
      setLevelFilter('');
    }
    setServerError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingAssignment, reset]);

  // Teachers can only assign as themselves — force the field to their own id.
  useEffect(() => {
    if (isOpen && isTeacher && ownTeacherId) {
      setValue('teacher_id', ownTeacherId);
    }
  }, [isOpen, isTeacher, ownTeacherId, setValue]);

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
      size="xl"
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

      <form className="flex flex-col gap-6">
        {/* Title */}
        <FormField label="Assignment Title" placeholder="e.g. Chapter 5 Questions, Science Project" required error={errors.title?.message} {...register('title')} />

        {/* Level filter + Class + Subject + Teacher */}
        <div>
          <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-3">
            Class & Subject
          </h3>

          {/* Level filter (not part of the form data — just filters class options) */}
          <div className="mb-3">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">
              Filter classes by level
            </label>
            <div className="flex flex-wrap gap-1.5">
              {levelOptions.map((lvl) => (
                <button
                  key={lvl.value}
                  type="button"
                  onClick={() => setLevelFilter(lvl.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    levelFilter === lvl.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-blue-300 dark:hover:border-blue-700'
                  }`}
                >
                  {lvl.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Controller
              name="class_id"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  label="Class"
                  required
                  options={classOptions}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select class..."
                  searchPlaceholder="Search classes..."
                  error={errors.class_id?.message}
                />
              )}
            />

            <Controller
              name="subject_id"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  label="Subject"
                  required
                  options={subjectOptions}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select subject..."
                  searchPlaceholder="Search subjects..."
                  error={errors.subject_id?.message}
                />
              )}
            />

            {/* Teachers assign as themselves — no teacher selector needed.
                The teacher_id is set automatically from the logged-in teacher. */}
            {!isTeacher && (
              <Controller
                name="teacher_id"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    label="Teacher"
                    required
                    options={teacherOptions}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select teacher..."
                    searchPlaceholder="Search teachers..."
                    error={errors.teacher_id?.message}
                  />
                )}
              />
            )}
          </div>
        </div>

        {/* Type + Dates + Marks */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
          <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-3">
            Schedule & Marks
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  label="Type"
                  required
                  options={ASSIGNMENT_TYPES}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select type..."
                  searchPlaceholder="Search assignment type..."
                  error={errors.type?.message}
                />
              )}
            />

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
        </div>

        {/* Description & Instructions */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
          <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-3">
            Details
          </h3>
          <div className="space-y-4">
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <RichTextarea
                  label="Description"
                  placeholder="Describe the assignment — use bold, lists, headings to format..."
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.description?.message}
                  minHeight="100px"
                />
              )}
            />
            <Controller
              name="instructions"
              control={control}
              render={({ field }) => (
                <RichTextarea
                  label="Instructions (Optional)"
                  placeholder="Step-by-step instructions for students..."
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.instructions?.message}
                  helperText="Use bullet points and numbered lists for clarity"
                  minHeight="100px"
                />
              )}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default AssignmentFormModal;
