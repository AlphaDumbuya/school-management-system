/**
 * TeacherFormModal — Add / Edit a teacher comprehensively
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';
import { FormField } from '@components/admin/forms/FormField';
import { showToast } from '@utils/toast';
import { teachersService, TeacherRecord } from '@services/teachersService';
import { classesService } from '@services/classesService';
import { subjectsService } from '@services/subjectsService';
import { schoolConfigService } from '@services/schoolConfigService';
import { teachingDesignationOptions, classAssignmentLabel } from '@lib/staffDesignations';
import { StaffJobPicker, jobFieldsSchema, refineJobs, jobsFromRecord, jobsToPayload, type StaffJob } from './StaffJobPicker';
import { Clipboard, ClipboardCheck, KeyRound, Loader2, BookOpen, GraduationCap } from 'lucide-react';
import { FileUploader } from '@components/admin/forms/FileUploader';
import { RichTextarea } from '@components/admin/forms/RichTextarea';

const schema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Invalid email address').min(1, 'Email is required'),
  phone: z.string().max(20).optional().or(z.literal('')),
  photo_url: z.string().optional().or(z.literal('')),
  specialization: z.string().max(100).optional().or(z.literal('')),
  experience_years: z.preprocess(
    (val) => (val === '' || val === undefined ? undefined : Number(val)),
    z.number().min(0, 'Experience cannot be negative').max(60, 'Maximum experience is 60 years').optional()
  ),
  office_location: z.string().max(100).optional().or(z.literal('')),
  qualifications: z.string().max(2000).optional().or(z.literal('')),
  hire_date: z.string().optional().or(z.literal('')),
  status: z.string().default('active'),
  designation: z.string().default('subject_teacher'),
  department: z.string().default('none'),
  employment_type: z.string().default('full_time'),
  form_class_id: z.string().optional().or(z.literal('')),
  assigned_classes: z.array(z.string()).default([]),
  assigned_subjects: z.array(z.string()).default([]),
  // Jobs at the school. Any mix: a form teacher can also keep the fees.
  ...jobFieldsSchema,
}).superRefine(refineJobs);

type FormValues = z.infer<typeof schema>;

export type { StaffJob };

interface TeacherFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingTeacher?: TeacherRecord | null;
  /** Preselected job when adding (e.g. from an "Add Accountant" button). */
  defaultJob?: StaffJob;
}

export const TeacherFormModal: React.FC<TeacherFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingTeacher,
  defaultJob = 'teacher',
}) => {
  const isEditing = !!editingTeacher;
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Temporary password display state
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Search filter states for assignments
  const [classSearch, setClassSearch] = useState('');
  const [subjectSearch, setSubjectSearch] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      photo_url: '',
      specialization: '',
      experience_years: undefined,
      office_location: '',
      qualifications: '',
      hire_date: '',
      status: 'active',
      designation: 'subject_teacher',
      department: 'none',
      employment_type: 'full_time',
      form_class_id: '',
      assigned_classes: [],
      assigned_subjects: [],
      teaches: true,
      duty_accountant: false,
      duty_admissions: false,
    },
  });

  const watchTeaches = watch('teaches');
  const watchAccountant = watch('duty_accountant');
  const watchAdmissions = watch('duty_admissions');
  const watchedClasses = watch('assigned_classes') || [];
  const watchedSubjects = watch('assigned_subjects') || [];

  // Query all active classes and subjects for assignment lists
  const { data: classesData } = useQuery({
    queryKey: ['classes-list-all'],
    queryFn: () => classesService.listClasses({ limit: 100 }),
    staleTime: 60_000,
    enabled: isOpen,
  });

  const { data: subjectsData } = useQuery({
    queryKey: ['subjects-list-all'],
    queryFn: () => subjectsService.listSubjects({ limit: 100 }),
    staleTime: 60_000,
    enabled: isOpen,
  });

  // The school's level tailors which designations we offer (primary uses Class
  // Master, secondary uses Form Master; both shows both with a level suffix).
  const { data: schoolInfoResp } = useQuery({
    queryKey: ['school-info'],
    queryFn: () => schoolConfigService.getSchoolInfo(),
    staleTime: 5 * 60_000,
    enabled: isOpen,
  });
  const schoolType = ((schoolInfoResp as any)?.data?.school_type ?? (schoolInfoResp as any)?.data?.data?.school_type) as string | undefined;
  // Teaching and leadership titles only. Bursar / Admissions are jobs (the
  // checkboxes above), not teaching titles.
  const designationOpts = useMemo(() => teachingDesignationOptions(schoolType), [schoolType]);

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

  // Filtered lists for rendering
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
    if (isOpen) {
      setTempPassword(null);
      setCopied(false);
      setServerError(null);
      setClassSearch('');
      setSubjectSearch('');

      if (editingTeacher) {
        setLoadingDetails(true);
        teachersService.getTeacher(editingTeacher.id)
          .then((res: any) => {
            const details = (res && res.success && res.data) ? res.data : res;
            if (details && (details.first_name || details.email)) {
              reset({
                first_name: details.first_name || '',
                last_name: details.last_name || '',
                email: details.email || '',
                phone: details.phone ?? '',
                photo_url: details.photo_url ?? '',
                specialization: details.specialization ?? '',
                experience_years: details.experience_years,
                office_location: details.office_location ?? '',
                qualifications: details.qualifications ?? '',
                hire_date: details.hire_date ? details.hire_date.split('T')[0] : '',
                status: details.status || 'active',
                designation: details.designation ?? 'subject_teacher',
                department: details.department ?? 'none',
                employment_type: details.employment_type ?? 'full_time',
                form_class_id: details.form_class_id ?? '',
                assigned_classes: details.assignments?.map((a: any) => a.class_id) ?? [],
                assigned_subjects: details.assignments?.map((a: any) => a.subject_id) ?? [],
                ...jobsFromRecord(details),
              });
            }
          })
          .catch((err) => {
            console.error('Failed to load teacher details', err);
            setServerError('Failed to load teacher profiles.');
          })
          .finally(() => {
            setLoadingDetails(false);
          });
      } else {
        reset({
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
          photo_url: '',
          specialization: '',
          experience_years: undefined,
          office_location: '',
          qualifications: '',
          hire_date: new Date().toISOString().split('T')[0],
          status: 'active',
          designation: 'subject_teacher',
          department: 'none',
          employment_type: 'full_time',
          form_class_id: '',
          assigned_classes: [],
          assigned_subjects: [],
          ...jobsFromRecord(null, defaultJob),
        });
      }
    }
  }, [isOpen, editingTeacher, reset, defaultJob]);

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const payload: any = {
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email,
        phone: values.phone || undefined,
        photo_url: values.photo_url || undefined,
        specialization: values.specialization || undefined,
        experience_years: values.experience_years || undefined,
        office_location: values.office_location || undefined,
        qualifications: values.qualifications || undefined,
        hire_date: values.hire_date || undefined,
        designation: values.designation,
        department: values.teaches ? values.department : 'none',
        employment_type: values.employment_type,
        // Classes and subjects only for someone who teaches.
        form_class_id: values.teaches ? (values.form_class_id || null) : null,
        assigned_classes: values.teaches ? values.assigned_classes : [],
        assigned_subjects: values.teaches ? values.assigned_subjects : [],
        // Main job + extra duties (see jobsToPayload).
        ...jobsToPayload(values, { currentRole: (editingTeacher as any)?.user_role, designation: values.designation }),
      };
      // Status is only set at CREATE (defaults to active). On edit it is never
      // sent from this form — status changes go through the dedicated
      // suspend/dismiss/deactivate/reactivate actions (with reason + comms).
      if (!isEditing) payload.status = values.status;

      if (isEditing && editingTeacher) {
        const res = await teachersService.updateTeacher(editingTeacher.id, payload as any);
        if (res.success === false) throw new Error(res.error ?? 'Update failed');
        showToast.saved('Teacher details');
        onSuccess();
        onClose();
      } else {
        const res = await teachersService.createTeacher(payload as any);
        if (res.success === false) throw new Error(res.error ?? 'Create failed');
        showToast.success('Staff account added');
        onSuccess();

        if (res.data?.temporary_password) {
          setTempPassword(res.data.temporary_password);
        } else {
          onClose();
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setServerError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      showToast.success('Password copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (tempPassword) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Staff Account Created"
        size="md"
        footer={
          <div className="flex justify-end w-full">
            <Button variant="default" onClick={onClose}>
              Ok, Got it
            </Button>
          </div>
        }
      >
        <div className="space-y-6 text-center py-4">
          <div className="mx-auto w-14 h-14 bg-green-100 dark:bg-green-950/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center shadow-sm">
            <KeyRound size={28} />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Credentials Generated</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              Please share the temporary password below with the teacher. They will be required to change it on their first login.
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800/80 rounded-xl p-4 flex items-center justify-between gap-4 max-w-sm mx-auto">
            <div className="text-left">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Temporary Password</span>
              <span className="text-base font-mono font-bold text-gray-800 dark:text-gray-100 select-all">
                {tempPassword}
              </span>
            </div>
            <button
              onClick={handleCopy}
              className="p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all shadow-sm"
              title="Copy to clipboard"
            >
              {copied ? <ClipboardCheck size={18} className="text-green-600 dark:text-green-400" /> : <Clipboard size={18} />}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Staff Member' : 'Add Staff Member'}
      size="lg"
      footer={
        <div className="flex items-center gap-3 ml-auto">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting || loadingDetails}>
            Cancel
          </Button>
          <Button variant="default" onClick={handleSubmit(onSubmit)} disabled={isSubmitting || loadingDetails}>
            {isSubmitting ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Staff Account')}
          </Button>
        </div>
      }
    >
      {loadingDetails ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Loader2 size={32} className="text-blue-500 animate-spin" />
          <span className="text-sm text-gray-500 dark:text-gray-400">Loading teacher details...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-h-[70vh] overflow-y-auto px-1">
          {serverError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-950/30">
              {serverError}
            </div>
          )}

          {/* ── Section 1: Personal Info ── */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b pb-1">
              General Profile
            </h3>
            
            <div className="flex flex-col md:flex-row gap-5">
              {/* Photo Upload on the left */}
              <div className="flex-shrink-0 w-full md:w-[140px] mx-auto md:mx-0">
                <Controller
                  name="photo_url"
                  control={control}
                  render={({ field }) => (
                    <FileUploader
                      label="Teacher Photo"
                      value={field.value || ''}
                      onChange={field.onChange}
                      accept="image/*"
                      maxSizeMB={2}
                      placeholder="Upload photo"
                      helperText="Passport size"
                      previewType="image"
                      enableCamera
                    />
                  )}
                />
              </div>

              {/* General fields on the right */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="First Name"
                  placeholder="e.g. John"
                  required
                  error={errors.first_name?.message}
                  {...register('first_name')}
                />

                <FormField
                  label="Last Name"
                  placeholder="e.g. Cole"
                  required
                  error={errors.last_name?.message}
                  {...register('last_name')}
                />

                <FormField
                  label="Email Address"
                  type="email"
                  placeholder="john.cole@school.com"
                  required
                  readOnly={isEditing}
                  value={isEditing ? editingTeacher?.email : undefined}
                  error={errors.email?.message}
                  {...register('email')}
                />

                <FormField
                  label="Phone Number"
                  type="tel"
                  placeholder="e.g. +232-76-XXXXXX"
                  error={errors.phone?.message}
                  {...register('phone')}
                />

                <FormField
                  label="Hire Date"
                  type="date"
                  error={errors.hire_date?.message}
                  {...register('hire_date')}
                />

                {isEditing && (
                  // Status is intentionally READ-ONLY here. Changing it (suspend /
                  // dismiss / deactivate / reactivate) is a controlled action that
                  // requires a reason and triggers notifications + access
                  // enforcement — done via the dedicated buttons on the profile
                  // view, not by editing the form.
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Account Status</label>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40">
                      <span className={`inline-block w-2 h-2 rounded-full ${
                        editingTeacher?.status === 'active' ? 'bg-emerald-500'
                        : editingTeacher?.status === 'suspended' ? 'bg-amber-500'
                        : 'bg-red-500'
                      }`} />
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200 capitalize">
                        {editingTeacher?.status || 'active'}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-gray-400">
                      Use the Suspend / Dismiss / Deactivate actions on the profile to change this.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Jobs at the school (any mix) ── */}
          <StaffJobPicker
            register={register}
            values={{ teaches: !!watchTeaches, duty_accountant: !!watchAccountant, duty_admissions: !!watchAdmissions }}
            error={errors.teaches?.message || errors.duty_admissions?.message}
          />

          {/* ── Section 2: Professional Details ── */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b pb-1">
              Professional Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField
                label="Specialization"
                placeholder="e.g. Mathematics"
                error={errors.specialization?.message}
                {...register('specialization')}
              />

              <FormField
                label="Experience (Years)"
                type="number"
                placeholder="e.g. 5"
                error={errors.experience_years?.message}
                {...register('experience_years')}
              />

              <FormField
                label="Office Location"
                placeholder="e.g. Room 104"
                error={errors.office_location?.message}
                {...register('office_location')}
              />
            </div>

            <Controller
              name="qualifications"
              control={control}
              render={({ field }) => (
                <RichTextarea
                  label="Qualifications / Degrees"
                  placeholder="e.g. B.Sc Mathematics from Fourah Bay College, Diploma in Education"
                  value={field.value || ''}
                  onChange={field.onChange}
                  error={errors.qualifications?.message}
                  helperText="Use bolding, bullet points, and formatting to list degrees and certifications"
                  minHeight="120px"
                />
              )}
            />

            {/* Sierra Leone School Roles & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4 dark:border-gray-800">
              {watchTeaches ? (
                <>
                  <FormField
                    label="Teaching Title"
                    type="select"
                    options={designationOpts}
                    helperText="Leadership titles give principal-level access."
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
                </>
              ) : (
                <div className="sm:col-span-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
                  Title: <strong>{watchAccountant ? 'Bursar (Accountant)' : 'Administrator (Admissions Officer)'}</strong>. Tick Teaching above if they also teach.
                </div>
              )}

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

              <div className={watchTeaches ? '' : 'hidden'}>
                <FormField
                  label={classAssignmentLabel(schoolType)}
                  type="select"
                  options={classOptions}
                  error={errors.form_class_id?.message}
                  {...register('form_class_id')}
                />
              </div>
            </div>
          </div>

          {/* ── Section 3: Class & Subject Assignments (teaching only) ── */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 ${watchTeaches ? '' : 'hidden'}`} aria-hidden={!watchTeaches}>
            {/* Class Selection list */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5 uppercase tracking-wider">
                  <BookOpen size={14} className="text-blue-500" /> Class Assignments
                </h4>
                <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500">
                  {watchedClasses.length} selected
                </span>
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                Select the classes this teacher will lead or teach:
              </p>
              
              {/* Search input for classes */}
              <input
                type="text"
                placeholder="Filter classes by name or stream..."
                value={classSearch}
                onChange={(e) => setClassSearch(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="max-h-[180px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 space-y-2 bg-gray-50/50 dark:bg-gray-800/10">
                {filteredClasses.length === 0 ? (
                  <span className="text-xs text-gray-400">No classes found.</span>
                ) : (
                  filteredClasses.map((c: any) => {
                    return (
                      <label
                        key={c.id}
                        className="flex items-center gap-2.5 p-2 bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/60 transition-colors"
                      >
                        <input
                          type="checkbox"
                          value={c.id}
                          {...register('assigned_classes')}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
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
                  {watchedSubjects.length} selected
                </span>
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                Select the subjects this teacher will be authorized to teach:
              </p>
              
              {/* Search input for subjects */}
              <input
                type="text"
                placeholder="Filter subjects by name or code..."
                value={subjectSearch}
                onChange={(e) => setSubjectSearch(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="max-h-[180px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 space-y-2 bg-gray-50/50 dark:bg-gray-800/10">
                {filteredSubjects.length === 0 ? (
                  <span className="text-xs text-gray-400">No subjects found.</span>
                ) : (
                  filteredSubjects.map((s: any) => {
                    return (
                      <label
                        key={s.id}
                        className="flex items-center gap-2.5 p-2 bg-white dark:bg-gray-800 border border-gray-150 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/60 transition-colors"
                      >
                        <input
                          type="checkbox"
                          value={s.id}
                          {...register('assigned_subjects')}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
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
        </form>
      )}
    </Modal>
  );
};

export default TeacherFormModal;
