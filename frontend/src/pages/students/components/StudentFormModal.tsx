/**
 * StudentFormModal — Add / Edit a student
 * Comprehensive Sierra Leone student registration form.
 */

import React, { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';
import { FormField } from '@components/admin/forms/FormField';
import { FileUploader } from '@components/admin/forms/FileUploader';
import { SearchableSelect } from '@components/admin/forms/SearchableSelect';
import { showToast } from '@utils/toast';
import { studentsService, StudentRecord, StudentFormData } from '@services/studentsService';
import { classesService } from '@services/classesService';

// ── Validation ────────────────────────────────────────────────────────────────

const schema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  date_of_birth: z.string().optional().or(z.literal('')),
  gender: z.string().optional().or(z.literal('')),
  phone: z.string().max(20).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  state: z.string().max(100).optional().or(z.literal('')),
  country: z.string().max(100).optional().or(z.literal('')),
  enrollment_date: z.string().optional().or(z.literal('')),
  // Additional fields
  class_id: z.string().optional().or(z.literal('')),
  place_of_birth: z.string().max(100).optional().or(z.literal('')),
  religion: z.string().max(50).optional().or(z.literal('')),
  nationality: z.string().max(100).optional().or(z.literal('')),
  blood_group: z.string().max(10).optional().or(z.literal('')),
  medical_conditions: z.string().max(500).optional().or(z.literal('')),
  previous_school: z.string().max(200).optional().or(z.literal('')),
  home_language: z.string().max(50).optional().or(z.literal('')),
  photo_url: z.string().max(500).optional().or(z.literal('')),
  // Guardian
  guardian_name: z.string().max(200).optional().or(z.literal('')),
  guardian_phone: z.string().max(20).optional().or(z.literal('')),
  guardian_relationship: z.string().max(50).optional().or(z.literal('')),
  guardian_occupation: z.string().max(100).optional().or(z.literal('')),
  emergency_contact: z.string().max(20).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

const RELIGIONS = ['Christianity', 'Islam', 'Traditional', 'Other'];
const RELATIONSHIPS = ['Father', 'Mother', 'Guardian', 'Uncle', 'Aunt', 'Grandparent', 'Sibling', 'Other'];

// ── Props ─────────────────────────────────────────────────────────────────────

interface StudentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingStudent?: StudentRecord | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const StudentFormModal: React.FC<StudentFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingStudent,
}) => {
  const isEditing = !!editingStudent;
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Fetch classes for dropdown
  const { data: classesData } = useQuery({
    queryKey: ['student-form-classes'],
    queryFn: () => classesService.listClasses({ limit: 100 }),
    staleTime: 60_000,
    enabled: isOpen,
  });
  const classes = (classesData as any)?.data ?? [];
  const classOptions = useMemo(() => classes.map((c: any) => ({ value: String(c.id), label: c.name, sublabel: c.section ? `Stream: ${c.section}` : c.level })), [classes]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: '', last_name: '', email: '', date_of_birth: '', gender: '',
      phone: '', address: '', city: '', state: '', country: 'Sierra Leone',
      enrollment_date: new Date().toISOString().split('T')[0],
      class_id: '', place_of_birth: '',
      religion: '', nationality: 'Sierra Leonean', blood_group: '', medical_conditions: '',
      previous_school: '', home_language: '', photo_url: '',
      guardian_name: '', guardian_phone: '', guardian_relationship: '', guardian_occupation: '',
      emergency_contact: '',
    },
  });

  useEffect(() => {
    if (isOpen && editingStudent) {
      reset({
        first_name: editingStudent.first_name,
        last_name: editingStudent.last_name,
        email: (editingStudent as any).email ?? '',
        date_of_birth: editingStudent.date_of_birth?.split('T')[0] ?? '',
        gender: editingStudent.gender ?? '',
        phone: editingStudent.phone ?? '',
        address: editingStudent.address ?? '',
        city: editingStudent.city ?? '',
        state: editingStudent.state ?? '',
        country: editingStudent.country ?? 'Sierra Leone',
        enrollment_date: editingStudent.enrollment_date?.split('T')[0] ?? '',
        class_id: (editingStudent as any).class_id ?? '',
        place_of_birth: (editingStudent as any).place_of_birth ?? '',
        religion: (editingStudent as any).religion ?? '',
        nationality: (editingStudent as any).nationality ?? 'Sierra Leonean',
        blood_group: (editingStudent as any).blood_group ?? '',
        medical_conditions: (editingStudent as any).medical_conditions ?? '',
        previous_school: (editingStudent as any).previous_school ?? '',
        home_language: (editingStudent as any).home_language ?? '',
        photo_url: (editingStudent as any).photo_url ?? '',
        guardian_name: (editingStudent as any).guardian_name ?? '',
        guardian_phone: (editingStudent as any).guardian_phone ?? '',
        guardian_relationship: (editingStudent as any).guardian_relationship ?? '',
        guardian_occupation: (editingStudent as any).guardian_occupation ?? '',
        emergency_contact: (editingStudent as any).emergency_contact ?? '',
      });
    } else if (isOpen && !editingStudent) {
      reset({
        first_name: '', last_name: '', email: '', date_of_birth: '', gender: '',
        phone: '', address: '', city: '', state: '', country: 'Sierra Leone',
        enrollment_date: new Date().toISOString().split('T')[0],
        class_id: '', place_of_birth: '',
        religion: '', nationality: 'Sierra Leonean', blood_group: '', medical_conditions: '',
        previous_school: '', home_language: '', photo_url: '',
        guardian_name: '', guardian_phone: '', guardian_relationship: '', guardian_occupation: '',
        emergency_contact: '',
      });
    }
    setServerError(null);
  }, [isOpen, editingStudent, reset]);

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const payload: StudentFormData = {
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email || undefined,
        date_of_birth: values.date_of_birth || undefined,
        gender: values.gender || undefined,
        phone: values.phone || undefined,
        address: values.address || undefined,
        city: values.city || undefined,
        state: values.state || undefined,
        country: values.country || undefined,
        enrollment_date: values.enrollment_date || undefined,
      };

      if (isEditing && editingStudent) {
        const res = await studentsService.updateStudent(editingStudent.id, payload);
        if (res.success === false) throw new Error(res.error ?? 'Update failed');
        showToast.saved('Student');
      } else {
        const res = await studentsService.createStudent(payload);
        if (res.success === false) throw new Error(res.error ?? 'Create failed');
        showToast.success('Student added');
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
      title={isEditing ? 'Edit Student' : 'Register New Student'}
      size="xl"
      footer={
        <div className="flex items-center gap-3 ml-auto">
          <Button variant="ghost" disabled={isSubmitting} onClick={onClose}>Cancel</Button>
          <Button variant="default" disabled={isSubmitting} onClick={handleSubmit(onSubmit)}>
            {isSubmitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Register Student'}
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
        {/* Photo + Basic Info */}
        <div>
          <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-4">Personal Information</h3>
          <div className="flex flex-col sm:flex-row gap-5">
            {/* Photo upload */}
            <div className="flex-shrink-0 w-full sm:w-[140px]">
              <Controller
                name="photo_url"
                control={control}
                render={({ field }) => (
                  <FileUploader
                    label="Photo"
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

            {/* Name fields */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="First Name" placeholder="e.g. Fatmata" required error={errors.first_name?.message} {...register('first_name')} />
              <FormField label="Last Name" placeholder="e.g. Kamara" required error={errors.last_name?.message} {...register('last_name')} />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Gender</label>
                <select {...register('gender')} className="w-full px-3 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Date of Birth</label>
                <input type="date" {...register('date_of_birth')} className="w-full px-3 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          {/* Additional personal fields */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Religion</label>
              <select {...register('religion')} className="w-full px-3 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select...</option>
                {RELIGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <FormField label="Nationality" placeholder="Sierra Leonean" error={errors.nationality?.message} {...register('nationality')} />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Enrollment Date</label>
              <input type="date" {...register('enrollment_date')} className="w-full px-3 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Class Assignment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <Controller
              name="class_id"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  label="Assign to Class"
                  options={classOptions}
                  value={field.value || ''}
                  onChange={field.onChange}
                  placeholder="Select class..."
                  searchPlaceholder="Search classes..."
                />
              )}
            />
            <FormField label="Place of Birth" placeholder="e.g. Makeni" error={errors.place_of_birth?.message} {...register('place_of_birth')} />
          </div>
        </div>

        {/* Contact */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
          <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-3">Contact & Address</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Email" type="email" placeholder="student@email.com" error={errors.email?.message} {...register('email')} />
            <FormField label="Phone" type="tel" placeholder="+232 XX XXX XXXX" error={errors.phone?.message} {...register('phone')} />
          </div>
          <div className="mt-4">
            <FormField label="Address" placeholder="e.g. 10 Siaka Stevens Street" error={errors.address?.message} {...register('address')} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <FormField label="City / Town" placeholder="e.g. Freetown" error={errors.city?.message} {...register('city')} />
            <FormField label="Country" placeholder="Sierra Leone" error={errors.country?.message} {...register('country')} />
          </div>
        </div>

        {/* Guardian / Parent */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
          <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-1">Parent / Guardian</h3>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-3">Primary contact person for the student</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Guardian Name" placeholder="e.g. Mr. Abu Kamara" error={errors.guardian_name?.message} {...register('guardian_name')} />
            <FormField label="Guardian Phone" type="tel" placeholder="+232 XX XXX XXXX" error={errors.guardian_phone?.message} {...register('guardian_phone')} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Relationship</label>
              <select {...register('guardian_relationship')} className="w-full px-3 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select...</option>
                {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <FormField label="Occupation" placeholder="e.g. Teacher, Trader" error={errors.guardian_occupation?.message} {...register('guardian_occupation')} />
            <FormField label="Emergency Contact" type="tel" placeholder="+232 XX XXX XXXX" error={errors.emergency_contact?.message} {...register('emergency_contact')} />
          </div>
        </div>

        {/* Academic Background */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
          <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-1">Additional Information</h3>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-3">Optional</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Previous School" placeholder="e.g. ABC Primary School" error={errors.previous_school?.message} {...register('previous_school')} />
            <FormField label="Medical Conditions / Allergies" placeholder="e.g. Asthma, Peanut allergy" error={errors.medical_conditions?.message} {...register('medical_conditions')} />
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default StudentFormModal;
