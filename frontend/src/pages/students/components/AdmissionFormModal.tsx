/**
 * AdmissionFormModal — Multi-step admission application form
 * Sierra Leone school format: Child Info, Guardian, Medical, Emergency, Documents
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '@components/admin/feedback/Modal';
import { Button } from '@components/ui/button';
import { FormField } from '@components/admin/forms/FormField';
import { SearchableSelect } from '@components/admin/forms/SearchableSelect';
import { FileUploader } from '@components/admin/forms/FileUploader';
import { showToast } from '@utils/toast';
import { admissionsService, type AdmissionRecord, type EnrolResult } from '@services/admissionsService';

const RELATIONSHIPS = ['Father', 'Mother', 'Guardian'];
const RELIGIONS = ['Christianity', 'Islam', 'Traditional', 'Other'];

interface AdmissionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (applicationNumber?: string, emailSent?: boolean | null) => void;
  publicSchoolSlug?: string;
  publicClasses?: { id: string; name: string; level: string }[];
  /** Staff: edit this application instead of creating one. */
  editing?: AdmissionRecord | null;
  /** Staff: called when "enrol now" made the applicant a student. */
  onEnrolled?: (result: EnrolResult, childName: string) => void;
}

const EDIT_KEYS = ['child_first_name', 'child_middle_name', 'child_last_name', 'child_dob', 'child_gender', 'child_nationality', 'child_religion', 'child_place_of_birth', 'class_applying_for', 'child_address', 'previous_school', 'last_grade_attained', 'child_photo_url', 'guardian_first_name', 'guardian_middle_name', 'guardian_last_name', 'guardian_relationship', 'guardian_phone', 'guardian_alt_phone', 'guardian_email', 'guardian_occupation', 'guardian_address', 'guardian_nationality', 'guardian_national_id', 'takes_medication', 'medication_details', 'has_allergies', 'allergy_details', 'has_chronic_illness', 'chronic_illness_details', 'allow_first_aid', 'emergency_contact_name', 'emergency_contact_relationship', 'emergency_contact_phone'] as const;

export const AdmissionFormModal: React.FC<AdmissionFormModalProps> = ({ isOpen, onClose, onSuccess, publicSchoolSlug, publicClasses, editing, onEnrolled }) => {
  const [step, setStep] = useState(1);
  const isStaffCreate = !publicSchoolSlug && !editing;
  const [enrolNow, setEnrolNow] = useState(false);
  const [docs, setDocs] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Form data
  const [form, setForm] = useState<any>({
    child_first_name: '', child_middle_name: '', child_last_name: '',
    child_dob: '', child_gender: '', child_nationality: 'Sierra Leonean',
    child_religion: '', child_place_of_birth: '', class_applying_for: '',
    child_address: '', previous_school: '', last_grade_attained: '', child_photo_url: '',
    guardian_first_name: '', guardian_middle_name: '', guardian_last_name: '',
    guardian_relationship: '', guardian_phone: '', guardian_alt_phone: '',
    guardian_email: '', guardian_occupation: '', guardian_address: '',
    guardian_nationality: 'Sierra Leonean', guardian_national_id: '',
    takes_medication: false, medication_details: '',
    has_allergies: false, allergy_details: '',
    has_chronic_illness: false, chronic_illness_details: '',
    allow_first_aid: true,
    emergency_contact_name: '', emergency_contact_relationship: '', emergency_contact_phone: '',
  });

  const updateForm = (key: string, value: any) => setForm((f: any) => ({ ...f, [key]: value }));

  // Staff: this year's classes only (with places left), from the admissions API.
  const { data: metaRes } = useQuery({
    queryKey: ['admissions-meta'], queryFn: () => admissionsService.getMeta(),
    staleTime: 60_000, enabled: isOpen && !publicSchoolSlug,
  });
  const meta = (metaRes as any)?.data;
  const classes = publicSchoolSlug ? (publicClasses ?? []) : (meta?.classes ?? []);
  const classOptions = useMemo(() => classes.map((c: any) => ({
    value: String(c.id), label: c.name,
    sublabel: c.capacity ? `${c.level} · ${c.enrolled}/${c.capacity}${c.full ? ' full' : ''}` : c.level,
  })), [classes]);

  // Editing: load the application into the form.
  useEffect(() => {
    if (!isOpen || !editing) return;
    const next: any = {};
    for (const k of EDIT_KEYS) {
      const v = (editing as any)[k];
      next[k] = typeof v === 'boolean' ? v : v == null ? '' : (k === 'child_dob' ? String(v).slice(0, 10) : String(v));
    }
    if (editing.allow_first_aid === undefined || editing.allow_first_aid === null) next.allow_first_aid = true;
    // A class from an earlier year can't be kept; the officer picks this year's.
    if (next.class_applying_for && meta?.classes && !meta.classes.some((c: any) => c.id === next.class_applying_for)) next.class_applying_for = '';
    setForm((f: any) => ({ ...f, ...next }));
    setStep(1); setServerError(null);
  }, [isOpen, editing?.id, meta?.classes?.length]);

  const handleSubmit = async () => {
    if (!form.child_first_name || !form.child_last_name || !form.child_dob || !form.child_gender) {
      setServerError('Please fill in all required child information');
      setStep(1); return;
    }
    if (!form.guardian_first_name || !form.guardian_last_name || !form.guardian_phone || !form.guardian_relationship) {
      setServerError('Please fill in all required guardian information');
      setStep(2); return;
    }
    if (publicSchoolSlug && !form.guardian_email.trim()) {
      setServerError('Please provide a guardian email address for the application confirmation');
      setStep(2); return;
    }
    if (publicSchoolSlug && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.guardian_email.trim())) {
      setServerError('Please enter a valid guardian email address');
      setStep(2); return;
    }
    if (isStaffCreate && enrolNow && !form.class_applying_for) {
      setServerError('Choose the class to enrol into, or untick "Accept and enrol now"');
      setStep(1); return;
    }
    setServerError(null);
    setIsSubmitting(true);
    try {
      if (editing) {
        const r: any = await admissionsService.updateApplication(editing.id, form);
        if (r?.success === false) throw new Error(r.error ?? 'Could not save');
        showToast.success('Application updated');
        onSuccess(editing.application_number, null); onClose();
        return;
      }
      const res: any = publicSchoolSlug
        ? await admissionsService.submitPublicApplication(publicSchoolSlug, form)
        : await admissionsService.submitApplication({ ...form, documents: docs, enrol_now: enrolNow });
      if (res.success === false) throw new Error(res.error ?? 'Submission failed');
      const enrolment = res.data?.enrolment;
      if (enrolment && onEnrolled) onEnrolled(enrolment, `${form.child_first_name} ${form.child_last_name}`);
      else showToast.success(res.data?.duplicate ? 'This application was already received' : 'Application submitted');
      onSuccess(res.data?.application_number, res.data?.email_sent); onClose();
      setStep(1); setDocs({}); setEnrolNow(false);
      setForm({ child_first_name: '', child_middle_name: '', child_last_name: '', child_dob: '', child_gender: '', child_nationality: 'Sierra Leonean', child_religion: '', child_place_of_birth: '', class_applying_for: '', child_address: '', previous_school: '', last_grade_attained: '', child_photo_url: '', guardian_first_name: '', guardian_middle_name: '', guardian_last_name: '', guardian_relationship: '', guardian_phone: '', guardian_alt_phone: '', guardian_email: '', guardian_occupation: '', guardian_address: '', guardian_nationality: 'Sierra Leonean', guardian_national_id: '', takes_medication: false, medication_details: '', has_allergies: false, allergy_details: '', has_chronic_illness: false, chronic_illness_details: '', allow_first_aid: true, emergency_contact_name: '', emergency_contact_relationship: '', emergency_contact_phone: '' });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong');
    } finally { setIsSubmitting(false); }
  };

  const totalSteps = 4;
  const stepTitles = ['Child Information', 'Parent / Guardian', 'Medical Information', 'Emergency Contact'];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editing ? `Edit application ${editing.application_number}` : 'Admission Application'} size="xl"
      footer={
        <div className="flex items-center justify-between w-full gap-3">
          <div className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">Step {step} of {totalSteps}: {stepTitles[step - 1]}</div>
          <div className="flex items-center gap-2 ml-auto">
            {step > 1 && <Button variant="ghost" onClick={() => setStep(step - 1)}>Back</Button>}
            {step < totalSteps && <Button variant="default" onClick={() => setStep(step + 1)}>Next</Button>}
            {step === totalSteps && <Button variant="default" disabled={isSubmitting} onClick={handleSubmit}>{isSubmitting ? 'Saving…' : editing ? 'Save changes' : isStaffCreate && enrolNow ? 'Save and enrol' : 'Submit Application'}</Button>}
          </div>
        </div>
      }
    >
      {serverError && <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">{serverError}</div>}

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-6">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < step ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
        ))}
      </div>

      {/* Step 1: Child Information */}
      {step === 1 && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-3">1. Child's Personal Information</h3>
          <div className="flex flex-col sm:flex-row gap-4">
            {!publicSchoolSlug && <div className="sm:w-[140px]">
              <FileUploader label="Photo" value={form.child_photo_url} onChange={(v) => updateForm('child_photo_url', v)} accept="image/*" maxSizeMB={2} placeholder="Upload" enableCamera previewType="image" />
            </div>}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700 dark:text-gray-300">First Name *</label><input value={form.child_first_name} placeholder="e.g. Fatmata" onChange={(e) => updateForm('child_first_name', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700 dark:text-gray-300">Middle Name</label><input value={form.child_middle_name} placeholder="e.g. Aminata" onChange={(e) => updateForm('child_middle_name', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700 dark:text-gray-300">Last Name *</label><input value={form.child_last_name} placeholder="e.g. Kamara" onChange={(e) => updateForm('child_last_name', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700 dark:text-gray-300">Date of Birth *</label><input type="date" value={form.child_dob} onChange={(e) => updateForm('child_dob', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700 dark:text-gray-300">Sex *</label><select value={form.child_gender} onChange={(e) => updateForm('child_gender', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="">Select...</option><option value="male">Male</option><option value="female">Female</option></select></div>
            <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nationality</label><input value={form.child_nationality} placeholder="Sierra Leonean" onChange={(e) => updateForm('child_nationality', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700 dark:text-gray-300">Religion</label><select value={form.child_religion} onChange={(e) => updateForm('child_religion', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="">Select...</option>{RELIGIONS.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700 dark:text-gray-300">Place of Birth</label><input value={form.child_place_of_birth} onChange={(e) => updateForm('child_place_of_birth', e.target.value)} placeholder="e.g. Freetown" className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <SearchableSelect label="Class Applying For" options={classOptions} value={form.class_applying_for} onChange={(v) => updateForm('class_applying_for', v)} placeholder="Select class..." searchPlaceholder="Search..." />
          </div>
          <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700 dark:text-gray-300">Home Address</label><input value={form.child_address} placeholder="e.g. 75 Main Road, Kossoh Town" onChange={(e) => updateForm('child_address', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700 dark:text-gray-300">Previous School</label><input value={form.previous_school} placeholder="e.g. ABC Primary School" onChange={(e) => updateForm('previous_school', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700 dark:text-gray-300">Last Grade Attained</label><input value={form.last_grade_attained} placeholder="e.g. Class 5, JSS 2" onChange={(e) => updateForm('last_grade_attained', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
          </div>
        </div>
      )}

      {/* Step 2: Guardian */}
      {step === 2 && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-3">2. Parent / Guardian Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700 dark:text-gray-300">First Name *</label><input value={form.guardian_first_name} placeholder="e.g. Abu" onChange={(e) => updateForm('guardian_first_name', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700 dark:text-gray-300">Middle Name</label><input value={form.guardian_middle_name} placeholder="e.g. Mohamed" onChange={(e) => updateForm('guardian_middle_name', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700 dark:text-gray-300">Last Name *</label><input value={form.guardian_last_name} placeholder="e.g. Kamara" onChange={(e) => updateForm('guardian_last_name', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700 dark:text-gray-300">Relationship *</label><select value={form.guardian_relationship} onChange={(e) => updateForm('guardian_relationship', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="">Select...</option>{RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
            <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700 dark:text-gray-300">Phone *</label><input type="tel" value={form.guardian_phone} onChange={(e) => updateForm('guardian_phone', e.target.value)} placeholder="+232..." className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700 dark:text-gray-300">Alt Phone</label><input type="tel" value={form.guardian_alt_phone} onChange={(e) => updateForm('guardian_alt_phone', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email{publicSchoolSlug ? ' *' : ''}</label><input type="email" required={!!publicSchoolSlug} value={form.guardian_email} onChange={(e) => updateForm('guardian_email', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700 dark:text-gray-300">Occupation</label><input value={form.guardian_occupation} placeholder="e.g. Teacher, Trader" onChange={(e) => updateForm('guardian_occupation', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
          </div>
          <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700 dark:text-gray-300">Home Address</label><input value={form.guardian_address} placeholder="e.g. 10 Main Road, Freetown" onChange={(e) => updateForm('guardian_address', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nationality</label><input value={form.guardian_nationality} placeholder="Sierra Leonean" onChange={(e) => updateForm('guardian_nationality', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700 dark:text-gray-300">National ID / Passport No.</label><input value={form.guardian_national_id} placeholder="e.g. SL12345678" onChange={(e) => updateForm('guardian_national_id', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
          </div>
        </div>
      )}

      {/* Step 3: Medical */}
      {step === 3 && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-3">3. Child's Medical Information</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span className="text-sm text-gray-700 dark:text-gray-300">Does your child regularly take medication?</span>
              <select value={form.takes_medication ? 'yes' : 'no'} onChange={(e) => updateForm('takes_medication', e.target.value === 'yes')} className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"><option value="no">No</option><option value="yes">Yes</option></select>
            </div>
            {form.takes_medication && <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700 dark:text-gray-300">Specify medication(s)</label><input value={form.medication_details} onChange={(e) => updateForm('medication_details', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span className="text-sm text-gray-700 dark:text-gray-300">Known allergies?</span>
              <select value={form.has_allergies ? 'yes' : 'no'} onChange={(e) => updateForm('has_allergies', e.target.value === 'yes')} className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"><option value="no">No</option><option value="yes">Yes</option></select>
            </div>
            {form.has_allergies && <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700 dark:text-gray-300">Describe allergies</label><input value={form.allergy_details} onChange={(e) => updateForm('allergy_details', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span className="text-sm text-gray-700 dark:text-gray-300">Chronic illness or condition?</span>
              <select value={form.has_chronic_illness ? 'yes' : 'no'} onChange={(e) => updateForm('has_chronic_illness', e.target.value === 'yes')} className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"><option value="no">No</option><option value="yes">Yes</option></select>
            </div>
            {form.has_chronic_illness && <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700 dark:text-gray-300">Describe condition</label><input value={form.chronic_illness_details} onChange={(e) => updateForm('chronic_illness_details', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span className="text-sm text-gray-700 dark:text-gray-300">May school administer first aid?</span>
              <select value={form.allow_first_aid ? 'yes' : 'no'} onChange={(e) => updateForm('allow_first_aid', e.target.value === 'yes')} className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"><option value="yes">Yes</option><option value="no">No</option></select>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Emergency Contact */}
      {step === 4 && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-3">4. Emergency Contact (Other Than Parent/Guardian)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label><input value={form.emergency_contact_name} placeholder="e.g. Issa Kamara" onChange={(e) => updateForm('emergency_contact_name', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700 dark:text-gray-300">Relationship</label><input value={form.emergency_contact_relationship} placeholder="e.g. Uncle, Neighbour" onChange={(e) => updateForm('emergency_contact_relationship', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div className="flex flex-col gap-1"><label className="text-sm font-medium text-gray-700 dark:text-gray-300">Phone Number</label><input type="tel" value={form.emergency_contact_phone} placeholder="+232..." onChange={(e) => updateForm('emergency_contact_phone', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
          </div>
          {isStaffCreate && (meta?.documents?.length ?? 0) > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-2">Documents handed in</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {meta.documents.map((d: any) => (
                  <label key={d.key} className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm">
                    <input type="checkbox" checked={!!docs[d.key]} onChange={(e) => setDocs({ ...docs, [d.key]: e.target.checked })} /> {d.label}
                  </label>
                ))}
              </div>
            </div>
          )}
          {isStaffCreate && (
            <label className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900 p-3 text-sm text-emerald-900 dark:text-emerald-200">
              <input type="checkbox" className="mt-0.5" checked={enrolNow} onChange={(e) => setEnrolNow(e.target.checked)} />
              <span><strong>Accept and enrol now</strong> (walk-in admission). The child becomes a student in the chosen class straight away, portal sign-ins are created and any terms already billed to the class are billed to them too (the bursar is told). Leave it unticked to review the application first.</span>
            </label>
          )}
          {!editing && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1">Ready to Submit</p>
            <p className="text-xs text-blue-600 dark:text-blue-400">By submitting, you confirm all information is accurate. The application will be reviewed by the admissions team.</p>
          </div>
          )}
        </div>
      )}
    </Modal>
  );
};

export default AdmissionFormModal;
