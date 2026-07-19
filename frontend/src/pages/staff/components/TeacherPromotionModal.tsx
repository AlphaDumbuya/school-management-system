/**
 * TeacherPromotionModal — Dedicated modal to promote/change structural roles,
 * Form Class, and Class/Subject assignments for a teacher.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '@components/admin/feedback/Modal';
import { FormField } from '@components/admin/forms/FormField';
import { Button } from '@components/ui/button';
import { Loader2, ShieldAlert, BookOpen, GraduationCap } from 'lucide-react';
import { showToast } from '@utils/toast';
import { teachersService, TeacherRecord } from '@services/teachersService';
import { classesService } from '@services/classesService';
import { subjectsService } from '@services/subjectsService';

const schema = z.object({
  designation: z.string().default('subject_teacher'),
  department: z.string().default('none'),
  employment_type: z.string().default('full_time'),
  form_class_id: z.string().optional().or(z.literal('')),
  assigned_classes: z.array(z.string()).max(4, 'A teacher can be assigned to at most 4 classes').default([]),
  assigned_subjects: z.array(z.string()).max(4, 'A teacher can be assigned to at most 4 subjects').default([]),
});

type FormValues = z.infer<typeof schema>;

interface TeacherPromotionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  teacher: TeacherRecord | null;
}

export const TeacherPromotionModal: React.FC<TeacherPromotionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  teacher,
}) => {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Search filter states for assignments
  const [classSearch, setClassSearch] = useState('');
  const [subjectSearch, setSubjectSearch] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      designation: 'subject_teacher',
      department: 'none',
      employment_type: 'full_time',
      form_class_id: '',
      assigned_classes: [],
      assigned_subjects: [],
    },
  });

  const watchedClasses = watch('assigned_classes') || [];
  const watchedSubjects = watch('assigned_subjects') || [];

  // Query all active classes and subjects for assignment lists
  const { data: classesData } = useQuery({
    queryKey: ['classes-list-promotion'],
    queryFn: () => classesService.listClasses({ limit: 100 }),
    staleTime: 60_000,
    enabled: isOpen,
  });

  const { data: subjectsData } = useQuery({
    queryKey: ['subjects-list-promotion'],
    queryFn: () => subjectsService.listSubjects({ limit: 100 }),
    staleTime: 60_000,
    enabled: isOpen,
  });

  const classesList = (classesData as any)?.data ?? [];
  const subjectsList = (subjectsData as any)?.data ?? [];

  const classOptions = useMemo(() => {
    return [
      { label: 'None (Not a Form Teacher)', value: '' },
      ...classesList.map((c: any) => ({
        label: `${c.name} ${c.section ? `(${c.section})` : ''}`,
        value: c.id,
      })),
    ];
  }, [classesList]);

  // Filtered lists for checkbox pickers
  const filteredClasses = useMemo(() => {
    if (!classSearch) return classesList;
    const term = classSearch.toLowerCase();
    return classesList.filter((c: any) =>
      c.name.toLowerCase().includes(term) ||
      (c.section && c.section.toLowerCase().includes(term)) ||
      (c.level && c.level.toLowerCase().includes(term))
    );
  }, [classesList, classSearch]);

  const filteredSubjects = useMemo(() => {
    if (!subjectSearch) return subjectsList;
    const term = subjectSearch.toLowerCase();
    return subjectsList.filter((s: any) =>
      s.name.toLowerCase().includes(term) ||
      s.code.toLowerCase().includes(term) ||
      (s.category && s.category.toLowerCase().includes(term))
    );
  }, [subjectsList, subjectSearch]);

  useEffect(() => {
    if (isOpen && teacher) {
      setServerError(null);
      setClassSearch('');
      setSubjectSearch('');
      setLoadingDetails(true);
      teachersService.getTeacher(teacher.id)
        .then((res: any) => {
          const details = (res && res.success && res.data) ? res.data : res;
          if (details && (details.designation || details.email)) {
            reset({
              designation: details.designation ?? 'subject_teacher',
              department: details.department ?? 'none',
              employment_type: details.employment_type ?? 'full_time',
              form_class_id: details.form_class_id ?? '',
              assigned_classes: details.assignments?.map((a: any) => a.class_id) ?? [],
              assigned_subjects: details.assignments?.map((a: any) => a.subject_id) ?? [],
            });
          }
        })
        .catch((err) => {
          console.error('Failed to load teacher details for promotion', err);
          setServerError('Failed to load current roles.');
        })
        .finally(() => {
          setLoadingDetails(false);
        });
    }
  }, [isOpen, teacher, reset]);

  const onSubmit = async (values: FormValues) => {
    if (!teacher) return;
    setServerError(null);
    setIsSubmitting(true);
    try {
      const payload = {
        designation: values.designation,
        department: values.department,
        employment_type: values.employment_type,
        form_class_id: values.form_class_id || null,
        assigned_classes: values.assigned_classes,
        assigned_subjects: values.assigned_subjects,
      };

      const res = await teachersService.updateTeacher(teacher.id, payload as any);
      if (res.success === false) throw new Error(res.error ?? 'Promotion update failed');
      
      showToast.success(`Role & Assignments updated for ${teacher.first_name} ${teacher.last_name}`);
      onSuccess();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setServerError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!teacher) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Promote & Assign Structural Role"
      size="lg"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="default" onClick={handleSubmit(onSubmit)} disabled={isSubmitting || loadingDetails}>
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" /> Saving Changes...
              </>
            ) : (
              'Update Role & Promotion'
            )}
          </Button>
        </div>
      }
    >
      {loadingDetails ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Loader2 size={32} className="text-blue-500 animate-spin" />
          <span className="text-sm text-gray-500 dark:text-gray-400">Loading current roles...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-h-[70vh] overflow-y-auto px-1">
          {serverError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-950/30 flex items-start gap-2">
              <ShieldAlert size={16} className="mt-0.5 flex-shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Profile Quick Summary Header */}
          <div className="bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
              {teacher.photo_url && teacher.photo_url.length > 10 ? (
                <img src={teacher.photo_url} alt="" className="w-full h-full object-cover rounded-lg" />
              ) : (
                `${teacher.first_name?.[0] || ''}${teacher.last_name?.[0] || ''}`
              )}
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                {teacher.first_name} {teacher.last_name}
              </h4>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium font-mono">Staff ID: {teacher.teacher_id} · Specialization: {teacher.specialization || 'General'}</p>
            </div>
          </div>

          {/* ── Section 1: Role Configuration ── */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b pb-1">
              Role & Title Settings
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Designation / Title"
                type="select"
                options={[
                  { label: 'Subject Teacher', value: 'subject_teacher' },
                  { label: 'Form Teacher', value: 'form_teacher' },
                  { label: 'Head of Department (HOD)', value: 'hod' },
                  { label: 'Senior Teacher', value: 'senior_teacher' },
                  { label: 'Vice Principal', value: 'vice_principal' },
                  { label: 'Principal', value: 'principal' },
                ]}
                error={errors.designation?.message}
                {...register('designation')}
              />

              <FormField
                label="Department"
                type="select"
                options={[
                  { label: 'None', value: 'none' },
                  { label: 'Mathematics & Sciences', value: 'mathematics_sciences' },
                  { label: 'Languages & Linguistics', value: 'languages' },
                  { label: 'Humanities & Social Sciences', value: 'social_sciences_humanities' },
                  { label: 'Commercial & Technical Studies', value: 'commercial_technical' },
                ]}
                error={errors.department?.message}
                {...register('department')}
              />

              <FormField
                label="Employment Type"
                type="select"
                options={[
                  { label: 'Full-Time', value: 'full_time' },
                  { label: 'Part-Time', value: 'part_time' },
                  { label: 'Community / Volunteer Teacher', value: 'volunteer' },
                  { label: 'Contract', value: 'contract' },
                ]}
                error={errors.employment_type?.message}
                {...register('employment_type')}
              />

              <FormField
                label="Form Class Assignment (Form Teacher)"
                type="select"
                options={classOptions}
                error={errors.form_class_id?.message}
                {...register('form_class_id')}
              />
            </div>
          </div>

          {/* ── Section 2: Class & Subject Assignment Load ── */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b pb-1">
              Class & Subject Assignments
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Class Selection list */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <BookOpen size={14} className="text-blue-500" /> Class Assignments
                  </h4>
                  <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500">
                    {watchedClasses.length}/4 selected
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  Select the classes this teacher will teach (max 4):
                </p>
                
                {/* Search input for classes */}
                <input
                  type="text"
                  placeholder="Filter classes by name or stream..."
                  value={classSearch}
                  onChange={(e) => setClassSearch(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <div className="max-h-[160px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-gray-50/50 dark:bg-gray-800/10 space-y-1.5">
                  {filteredClasses.length === 0 ? (
                    <span className="text-xs text-gray-405">No classes found.</span>
                  ) : (
                    filteredClasses.map((c: any) => {
                      const isChecked = watchedClasses.includes(c.id);
                      const isDisabled = watchedClasses.length >= 4 && !isChecked;
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center gap-2.5 p-2 bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/60 transition-colors ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                          <input
                            type="checkbox"
                            value={c.id}
                            {...register('assigned_classes')}
                            disabled={isDisabled}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 disabled:opacity-50"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-100">{c.name}</p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500">
                              {c.section ? `Stream: ${c.section}` : c.level}
                            </p>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
                {errors.assigned_classes && (
                  <p className="text-[10px] font-semibold text-red-500 mt-1">{errors.assigned_classes.message}</p>
                )}
              </div>

              {/* Subject Selection list */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <GraduationCap size={14} className="text-indigo-500" /> Subject Assignments
                  </h4>
                  <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500">
                    {watchedSubjects.length}/4 selected
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  Select the subjects this teacher will teach (max 4):
                </p>
                
                {/* Search input for subjects */}
                <input
                  type="text"
                  placeholder="Filter subjects by name or code..."
                  value={subjectSearch}
                  onChange={(e) => setSubjectSearch(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <div className="max-h-[160px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-gray-50/50 dark:bg-gray-800/10 space-y-1.5">
                  {filteredSubjects.length === 0 ? (
                    <span className="text-xs text-gray-405">No subjects found.</span>
                  ) : (
                    filteredSubjects.map((s: any) => {
                      const isChecked = watchedSubjects.includes(s.id);
                      const isDisabled = watchedSubjects.length >= 4 && !isChecked;
                      return (
                        <label
                          key={s.id}
                          className={`flex items-center gap-2.5 p-2 bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/60 transition-colors ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                          <input
                            type="checkbox"
                            value={s.id}
                            {...register('assigned_subjects')}
                            disabled={isDisabled}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 disabled:opacity-50"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-100">{s.name}</p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                              {s.code} · Category: {s.category || '—'}
                            </p>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
                {errors.assigned_subjects && (
                  <p className="text-[10px] font-semibold text-red-500 mt-1">{errors.assigned_subjects.message}</p>
                )}
              </div>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default TeacherPromotionModal;
