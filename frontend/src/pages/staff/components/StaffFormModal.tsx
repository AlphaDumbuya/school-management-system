/**
 * StaffFormModal — add or edit a SUPPORT staff member (security, cleaner, cook,
 * driver…). Easy onboarding: basic details, photo and an emergency contact, no
 * login. Professional staff use the full Add Staff Member form instead.
 */
import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Modal } from '@components/admin/feedback/Modal';
import { FormField } from '@components/admin/forms/FormField';
import { FileUploader } from '@components/admin/forms/FileUploader';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { staffService, SupportStaff, SUPPORT_JOB_LABEL } from '@services/staffService';

const schema = z.object({
  first_name: z.string().trim().min(1, 'First name is required').max(100),
  last_name: z.string().trim().min(1, 'Last name is required').max(100),
  job_type: z.enum(['security', 'cleaner', 'cook', 'driver', 'gardener', 'maintenance', 'other']),
  job_title: z.string().max(100).optional().or(z.literal('')),
  gender: z.string().optional().or(z.literal('')),
  phone: z.string().max(30).optional().or(z.literal('')),
  address: z.string().max(255).optional().or(z.literal('')),
  photo_url: z.string().optional().or(z.literal('')),
  hire_date: z.string().optional().or(z.literal('')),
  employment_type: z.string().default('full_time'),
  emergency_contact_name: z.string().max(150).optional().or(z.literal('')),
  emergency_contact_phone: z.string().max(30).optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
});
type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  first_name: '', last_name: '', job_type: 'security', job_title: '', gender: '', phone: '', address: '',
  photo_url: '', hire_date: new Date().toISOString().slice(0, 10), employment_type: 'full_time',
  emergency_contact_name: '', emergency_contact_phone: '', notes: '',
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editing?: SupportStaff | null;
}

export const StaffFormModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, editing }) => {
  const isEditing = !!editing;
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!isOpen) return;
    setServerError(null);
    reset(editing
      ? {
          first_name: editing.first_name, last_name: editing.last_name, job_type: editing.job_type,
          job_title: editing.job_title || '', gender: editing.gender || '', phone: editing.phone || '',
          address: editing.address || '', photo_url: editing.photo_url || '',
          hire_date: editing.hire_date ? String(editing.hire_date).slice(0, 10) : '',
          employment_type: editing.employment_type || 'full_time',
          emergency_contact_name: editing.emergency_contact_name || '',
          emergency_contact_phone: editing.emergency_contact_phone || '', notes: editing.notes || '',
        }
      : EMPTY);
  }, [isOpen, editing, reset]);

  const onSubmit = async (v: FormValues) => {
    setServerError(null);
    setSubmitting(true);
    try {
      const res: any = isEditing && editing ? await staffService.update(editing.id, v as any) : await staffService.create(v as any);
      if (res?.success === false) throw new Error(res.error || 'Could not save');
      showToast.success(isEditing ? 'Staff member updated' : `${SUPPORT_JOB_LABEL[v.job_type]} added`);
      onSuccess();
      onClose();
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Support Staff' : 'Add Support Staff'}
      size="lg"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={submitting}>
            {submitting ? <><Loader2 size={16} className="mr-2 animate-spin" /> Saving…</> : isEditing ? 'Save Changes' : 'Add Staff Member'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {serverError && (
          <div role="alert" className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-900/40 flex items-start gap-2">
            <ShieldAlert size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span>{serverError}</span>
          </div>
        )}
        <div className="flex flex-col md:flex-row gap-5">
          <div className="w-full md:w-[140px] flex-shrink-0">
            <Controller
              name="photo_url"
              control={control}
              render={({ field }) => (
                <FileUploader label="Photo" value={field.value || ''} onChange={field.onChange} accept="image/*" maxSizeMB={2}
                  placeholder="Upload photo" helperText="For the staff ID card" previewType="image" enableCamera />
              )}
            />
          </div>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="First name" required error={errors.first_name?.message} {...register('first_name')} />
            <FormField label="Last name" required error={errors.last_name?.message} {...register('last_name')} />
            <FormField label="Job" type="select" required
              options={Object.entries(SUPPORT_JOB_LABEL).map(([value, label]) => ({ value, label }))}
              error={errors.job_type?.message} {...register('job_type')} />
            <FormField label="Job title (optional)" placeholder="e.g. Head of Security" {...register('job_title')} />
            <FormField label="Phone" type="tel" error={errors.phone?.message} {...register('phone')} />
            <FormField label="Gender" type="select"
              options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]}
              {...register('gender')} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Address" {...register('address')} />
          <FormField label="Hire date" type="date" {...register('hire_date')} />
          <FormField label="Employment type" type="select"
            options={[
              { value: 'full_time', label: 'Full-Time' }, { value: 'part_time', label: 'Part-Time' },
              { value: 'contract', label: 'Contract' }, { value: 'casual', label: 'Casual' },
            ]}
            {...register('employment_type')} />
          <div />
          <FormField label="Emergency contact name" {...register('emergency_contact_name')} />
          <FormField label="Emergency contact phone" type="tel" {...register('emergency_contact_phone')} />
        </div>
        <FormField label="Notes" type="textarea" {...register('notes')} />
      </form>
    </Modal>
  );
};

export default StaffFormModal;
