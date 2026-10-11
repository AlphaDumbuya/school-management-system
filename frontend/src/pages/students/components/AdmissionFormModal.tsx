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

// ── Validation ────────────────────────────────────────────────────────────────
const NAME_RE = /^[\p{L}][\p{L}\s'.-]*$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Phone: optional +, 8–15 digits once spaces, dashes and brackets are removed. */
const phoneDigits = (v: string) => String(v || '').replace(/[\s\-()]/g, '');
const PHONE_RE = /^\+?\d{8,15}$/;

function checkName(e: Record<string, string>, form: any, k: string, label: string, required: boolean) {
  const v = String(form[k] || '').trim();
  if (!v) { if (required) e[k] = `Enter the ${label}.`; return; }
  if (v.length < 2) e[k] = `The ${label} is too short.`;
  else if (v.length > 50) e[k] = `The ${label} must be 50 characters or fewer.`;
  else if (!NAME_RE.test(v)) e[k] = `The ${label} can only contain letters, spaces, hyphens and apostrophes.`;
}
function checkPhone(e: Record<string, string>, form: any, k: string, required: boolean) {
  const v = phoneDigits(form[k]);
  if (!v) { if (required) e[k] = 'Enter a phone number.'; return; }
  if (!PHONE_RE.test(v)) e[k] = 'Enter a valid phone number, e.g. +232 76 123456 or 076 123456.';
}

/**
 * Field errors for one step of the admission form (empty object = valid).
 * The server repeats the critical checks; this gives instant, per-field help.
 */
export function validateAdmissionStep(
  step: number,
  form: any,
  opts: { requireEmail: boolean; requireClass: boolean },
): Record<string, string> {
  const e: Record<string, string> = {};
  if (step === 1) {
    checkName(e, form, 'child_first_name', "child's first name", true);
    checkName(e, form, 'child_middle_name', "child's middle name", false);
    checkName(e, form, 'child_last_name', "child's last name", true);
    if (!form.child_dob) e.child_dob = 'Enter the date of birth.';
    else {
      const dob = new Date(`${form.child_dob}T00:00:00`);
      const now = new Date();
      const age = (now.getTime() - dob.getTime()) / (365.25 * 24 * 3600 * 1000);
      if (Number.isNaN(dob.getTime())) e.child_dob = 'Enter a valid date.';
      else if (dob > now) e.child_dob = 'The date of birth cannot be in the future.';
      else if (age < 2) e.child_dob = 'The child must be at least 2 years old.';
      else if (age > 30) e.child_dob = 'Check the year: the child would be over 30.';
    }
    if (!form.child_gender) e.child_gender = 'Select the sex.';
    if (opts.requireClass && !form.class_applying_for) e.class_applying_for = 'Choose the class.';
    if (String(form.child_place_of_birth || '').length > 100) e.child_place_of_birth = 'Keep it under 100 characters.';
    if (String(form.child_address || '').length > 255) e.child_address = 'Keep the address under 255 characters.';
    const photo = String(form.child_photo_url || '');
    if (photo && !/^data:image\/(png|jpe?g|webp);base64,/i.test(photo) && !/^https:\/\//i.test(photo)) {
      e.child_photo_url = 'Use a PNG, JPG or WEBP photo.';
    }
  }
  if (step === 2) {
    checkName(e, form, 'guardian_first_name', "guardian's first name", true);
    checkName(e, form, 'guardian_middle_name', "guardian's middle name", false);
    checkName(e, form, 'guardian_last_name', "guardian's last name", true);
    if (!form.guardian_relationship) e.guardian_relationship = 'Select the relationship.';
    checkPhone(e, form, 'guardian_phone', true);
    checkPhone(e, form, 'guardian_alt_phone', false);
    if (!e.guardian_alt_phone && form.guardian_alt_phone && phoneDigits(form.guardian_alt_phone) === phoneDigits(form.guardian_phone)) {
      e.guardian_alt_phone = 'The alternative phone is the same as the main phone.';
    }
    const email = String(form.guardian_email || '').trim();
    if (!email) { if (opts.requireEmail) e.guardian_email = 'Enter an email address for the confirmation.'; }
    else if (!EMAIL_RE.test(email)) e.guardian_email = 'Enter a valid email address, e.g. name@example.com.';
    if (form.guardian_nationality && !NAME_RE.test(String(form.guardian_nationality).trim())) e.guardian_nationality = 'Use letters only.';
    const nid = String(form.guardian_national_id || '').trim();
    if (nid && !/^[A-Za-z0-9\-/ ]{4,30}$/.test(nid)) e.guardian_national_id = 'Use 4–30 letters or numbers.';
  }
  if (step === 3) {
    if (form.takes_medication && !String(form.medication_details || '').trim()) e.medication_details = 'Name the medication(s).';
    if (form.has_allergies && !String(form.allergy_details || '').trim()) e.allergy_details = 'Describe the allergies.';
    if (form.has_chronic_illness && !String(form.chronic_illness_details || '').trim()) e.chronic_illness_details = 'Describe the condition.';
  }
  if (step === 4) {
    const anyEmergency = ['emergency_contact_name', 'emergency_contact_relationship', 'emergency_contact_phone']
      .some((k) => String(form[k] || '').trim());
    // Optional section, but once started it must be usable: a name and a phone.
    checkName(e, form, 'emergency_contact_name', 'contact name', anyEmergency);
    checkPhone(e, form, 'emergency_contact_phone', anyEmergency);
    if (!e.emergency_contact_phone && form.emergency_contact_phone && phoneDigits(form.emergency_contact_phone) === phoneDigits(form.guardian_phone)) {
      e.emergency_contact_phone = "Use someone other than the parent/guardian's number.";
    }
  }
  return e;
}

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
  /** Public form: Cloudflare Turnstile site key (security check), when enabled. */
  captchaSiteKey?: string | null;
}

/** Cloudflare Turnstile widget (loaded only when the school turned it on). */
const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const Turnstile: React.FC<{ siteKey: string; onToken: (t: string) => void }> = ({ siteKey, onToken }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    let widgetId: string | undefined; let cancelled = false;
    const render = () => {
      const ts = (window as any).turnstile;
      if (cancelled || !ts || !ref.current) return;
      widgetId = ts.render(ref.current, {
        sitekey: siteKey,
        callback: (t: string) => onToken(t),
        'expired-callback': () => onToken(''),
        'error-callback': () => onToken(''),
      });
    };
    if ((window as any).turnstile) render();
    else {
      let el = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SRC}"]`);
      if (!el) { el = document.createElement('script'); el.src = TURNSTILE_SRC; el.async = true; el.defer = true; document.head.appendChild(el); }
      el.addEventListener('load', render);
    }
    return () => { cancelled = true; try { if (widgetId) (window as any).turnstile?.remove(widgetId); } catch { /* ignore */ } };
  }, [siteKey]);
  return <div ref={ref} className="mt-4" aria-label="Security check" />;
};

const EDIT_KEYS = ['child_first_name', 'child_middle_name', 'child_last_name', 'child_dob', 'child_gender', 'child_nationality', 'child_religion', 'child_place_of_birth', 'class_applying_for', 'child_address', 'previous_school', 'last_grade_attained', 'child_photo_url', 'guardian_first_name', 'guardian_middle_name', 'guardian_last_name', 'guardian_relationship', 'guardian_phone', 'guardian_alt_phone', 'guardian_email', 'guardian_occupation', 'guardian_address', 'guardian_nationality', 'guardian_national_id', 'takes_medication', 'medication_details', 'has_allergies', 'allergy_details', 'has_chronic_illness', 'chronic_illness_details', 'allow_first_aid', 'emergency_contact_name', 'emergency_contact_relationship', 'emergency_contact_phone'] as const;

export const AdmissionFormModal: React.FC<AdmissionFormModalProps> = ({ isOpen, onClose, onSuccess, publicSchoolSlug, publicClasses, editing, onEnrolled, captchaSiteKey }) => {
  const [step, setStep] = useState(1);
  // Public form: bots fill this hidden field; people never see it.
  const [website, setWebsite] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaKey, setCaptchaKey] = useState(0);
  const needsCaptcha = !!publicSchoolSlug && !!captchaSiteKey;
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

  // Field errors, shown under each field. Cleared as the user fixes a field.
  const [errors, setErrors] = useState<Record<string, string>>({});
  const updateForm = (key: string, value: any) => {
    setForm((f: any) => ({ ...f, [key]: value }));
    setErrors((e) => {
      if (!e[key]) return e;
      const { [key]: _drop, ...rest } = e;
      return rest;
    });
  };
  const cls = (k: string) =>
    `w-full px-3 py-2 bg-white dark:bg-gray-800 border ${errors[k] ? 'border-red-500 ring-1 ring-red-500/30' : 'border-gray-300 dark:border-gray-600'} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`;
  const Err = ({ k }: { k: string }) =>
    errors[k] ? <p id={`adm-err-${k}`} role="alert" className="text-xs text-red-600 dark:text-red-400">{errors[k]}</p> : null;

  /** Errors for one step (1–4), using the rules in validateAdmissionStep. */
  const stepErrors = (n: number) => validateAdmissionStep(n, form, {
    requireEmail: !!publicSchoolSlug,
    requireClass: !!publicSchoolSlug || (isStaffCreate && enrolNow),
  });
  /** Validate steps 1..upTo; jump to the first step with a problem. */
  const checkSteps = (upTo: number): boolean => {
    for (let n = 1; n <= upTo; n++) {
      const e = stepErrors(n);
      if (Object.keys(e).length) {
        setErrors(e);
        setStep(n);
        setServerError(n === step ? 'Please correct the highlighted fields.' : `Please correct the highlighted fields in "${['Child Information', 'Parent / Guardian', 'Medical Information', 'Emergency Contact'][n - 1]}".`);
        return false;
      }
    }
    setErrors({});
    setServerError(null);
    return true;
  };

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
    setStep(1); setServerError(null); setErrors({});
  }, [isOpen, editing?.id, meta?.classes?.length]);

  const handleSubmit = async () => {
    if (!checkSteps(4)) return;
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
        ? await admissionsService.submitPublicApplication(publicSchoolSlug, { ...form, website, turnstile_token: captchaToken || undefined })
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
      // A security-check token works once: show a fresh check for the retry.
      if (needsCaptcha) { setCaptchaToken(''); setCaptchaKey((k) => k + 1); }
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
            {step > 1 && <Button variant="ghost" onClick={() => { setErrors({}); setServerError(null); setStep(step - 1); }}>Back</Button>}
            {step < totalSteps && <Button variant="default" onClick={() => { if (checkSteps(step)) setStep(step + 1); }}>Next</Button>}
            {step === totalSteps && <Button variant="default" disabled={isSubmitting || (needsCaptcha && !captchaToken)} onClick={handleSubmit}>{isSubmitting ? 'Saving…' : editing ? 'Save changes' : isStaffCreate && enrolNow ? 'Save and enrol' : 'Submit Application'}</Button>}
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
              <FileUploader label="Photo" value={form.child_photo_url} onChange={(v) => updateForm('child_photo_url', v)} accept="image/png,image/jpeg,image/webp" maxSizeMB={2} placeholder="Upload" enableCamera previewType="image" />
              <Err k="child_photo_url" />
            </div>}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1"><label htmlFor="adm-child_first_name" className="text-sm font-medium text-gray-700 dark:text-gray-300">First Name *</label><input value={form.child_first_name} placeholder="e.g. Fatmata" onChange={(e) => updateForm('child_first_name', e.target.value)} id="adm-child_first_name" aria-invalid={!!errors.child_first_name} aria-describedby={errors.child_first_name ? 'adm-err-child_first_name' : undefined} className={cls('child_first_name')} /><Err k="child_first_name" /></div>
              <div className="flex flex-col gap-1"><label htmlFor="adm-child_middle_name" className="text-sm font-medium text-gray-700 dark:text-gray-300">Middle Name</label><input value={form.child_middle_name} placeholder="e.g. Aminata" onChange={(e) => updateForm('child_middle_name', e.target.value)} id="adm-child_middle_name" aria-invalid={!!errors.child_middle_name} aria-describedby={errors.child_middle_name ? 'adm-err-child_middle_name' : undefined} className={cls('child_middle_name')} /><Err k="child_middle_name" /></div>
              <div className="flex flex-col gap-1"><label htmlFor="adm-child_last_name" className="text-sm font-medium text-gray-700 dark:text-gray-300">Last Name *</label><input value={form.child_last_name} placeholder="e.g. Kamara" onChange={(e) => updateForm('child_last_name', e.target.value)} id="adm-child_last_name" aria-invalid={!!errors.child_last_name} aria-describedby={errors.child_last_name ? 'adm-err-child_last_name' : undefined} className={cls('child_last_name')} /><Err k="child_last_name" /></div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1"><label htmlFor="adm-child_dob" className="text-sm font-medium text-gray-700 dark:text-gray-300">Date of Birth *</label><input type="date" value={form.child_dob} onChange={(e) => updateForm('child_dob', e.target.value)} id="adm-child_dob" aria-invalid={!!errors.child_dob} aria-describedby={errors.child_dob ? 'adm-err-child_dob' : undefined} className={cls('child_dob')} /><Err k="child_dob" /></div>
            <div className="flex flex-col gap-1"><label htmlFor="adm-child_gender" className="text-sm font-medium text-gray-700 dark:text-gray-300">Sex *</label><select value={form.child_gender} onChange={(e) => updateForm('child_gender', e.target.value)} id="adm-child_gender" aria-invalid={!!errors.child_gender} aria-describedby={errors.child_gender ? 'adm-err-child_gender' : undefined} className={cls('child_gender')}><option value="">Select...</option><option value="male">Male</option><option value="female">Female</option></select><Err k="child_gender" /></div>
            <div className="flex flex-col gap-1"><label htmlFor="adm-child_nationality" className="text-sm font-medium text-gray-700 dark:text-gray-300">Nationality</label><input value={form.child_nationality} placeholder="Sierra Leonean" onChange={(e) => updateForm('child_nationality', e.target.value)} id="adm-child_nationality" aria-invalid={!!errors.child_nationality} aria-describedby={errors.child_nationality ? 'adm-err-child_nationality' : undefined} className={cls('child_nationality')} /><Err k="child_nationality" /></div>
            <div className="flex flex-col gap-1"><label htmlFor="adm-child_religion" className="text-sm font-medium text-gray-700 dark:text-gray-300">Religion</label><select value={form.child_religion} onChange={(e) => updateForm('child_religion', e.target.value)} id="adm-child_religion" aria-invalid={!!errors.child_religion} aria-describedby={errors.child_religion ? 'adm-err-child_religion' : undefined} className={cls('child_religion')}><option value="">Select...</option>{RELIGIONS.map(r => <option key={r} value={r}>{r}</option>)}</select><Err k="child_religion" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1"><label htmlFor="adm-child_place_of_birth" className="text-sm font-medium text-gray-700 dark:text-gray-300">Place of Birth</label><input value={form.child_place_of_birth} onChange={(e) => updateForm('child_place_of_birth', e.target.value)} placeholder="e.g. Freetown" id="adm-child_place_of_birth" aria-invalid={!!errors.child_place_of_birth} aria-describedby={errors.child_place_of_birth ? 'adm-err-child_place_of_birth' : undefined} className={cls('child_place_of_birth')} /><Err k="child_place_of_birth" /></div>
            <div className="flex flex-col gap-1">
              <SearchableSelect label={`Class Applying For${publicSchoolSlug || (isStaffCreate && enrolNow) ? ' *' : ''}`} options={classOptions} value={form.class_applying_for} onChange={(v) => updateForm('class_applying_for', v)} placeholder="Select class..." searchPlaceholder="Search..." />
              <Err k="class_applying_for" />
            </div>
          </div>
          <div className="flex flex-col gap-1"><label htmlFor="adm-child_address" className="text-sm font-medium text-gray-700 dark:text-gray-300">Home Address</label><input value={form.child_address} placeholder="e.g. 75 Main Road, Kossoh Town" onChange={(e) => updateForm('child_address', e.target.value)} id="adm-child_address" aria-invalid={!!errors.child_address} aria-describedby={errors.child_address ? 'adm-err-child_address' : undefined} className={cls('child_address')} /><Err k="child_address" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1"><label htmlFor="adm-previous_school" className="text-sm font-medium text-gray-700 dark:text-gray-300">Previous School</label><input value={form.previous_school} placeholder="e.g. ABC Primary School" onChange={(e) => updateForm('previous_school', e.target.value)} id="adm-previous_school" aria-invalid={!!errors.previous_school} aria-describedby={errors.previous_school ? 'adm-err-previous_school' : undefined} className={cls('previous_school')} /><Err k="previous_school" /></div>
            <div className="flex flex-col gap-1"><label htmlFor="adm-last_grade_attained" className="text-sm font-medium text-gray-700 dark:text-gray-300">Last Grade Attained</label><input value={form.last_grade_attained} placeholder="e.g. Class 5, JSS 2" onChange={(e) => updateForm('last_grade_attained', e.target.value)} id="adm-last_grade_attained" aria-invalid={!!errors.last_grade_attained} aria-describedby={errors.last_grade_attained ? 'adm-err-last_grade_attained' : undefined} className={cls('last_grade_attained')} /><Err k="last_grade_attained" /></div>
          </div>
        </div>
      )}

      {/* Step 2: Guardian */}
      {step === 2 && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-3">2. Parent / Guardian Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1"><label htmlFor="adm-guardian_first_name" className="text-sm font-medium text-gray-700 dark:text-gray-300">First Name *</label><input value={form.guardian_first_name} placeholder="e.g. Abu" onChange={(e) => updateForm('guardian_first_name', e.target.value)} id="adm-guardian_first_name" aria-invalid={!!errors.guardian_first_name} aria-describedby={errors.guardian_first_name ? 'adm-err-guardian_first_name' : undefined} className={cls('guardian_first_name')} /><Err k="guardian_first_name" /></div>
            <div className="flex flex-col gap-1"><label htmlFor="adm-guardian_middle_name" className="text-sm font-medium text-gray-700 dark:text-gray-300">Middle Name</label><input value={form.guardian_middle_name} placeholder="e.g. Mohamed" onChange={(e) => updateForm('guardian_middle_name', e.target.value)} id="adm-guardian_middle_name" aria-invalid={!!errors.guardian_middle_name} aria-describedby={errors.guardian_middle_name ? 'adm-err-guardian_middle_name' : undefined} className={cls('guardian_middle_name')} /><Err k="guardian_middle_name" /></div>
            <div className="flex flex-col gap-1"><label htmlFor="adm-guardian_last_name" className="text-sm font-medium text-gray-700 dark:text-gray-300">Last Name *</label><input value={form.guardian_last_name} placeholder="e.g. Kamara" onChange={(e) => updateForm('guardian_last_name', e.target.value)} id="adm-guardian_last_name" aria-invalid={!!errors.guardian_last_name} aria-describedby={errors.guardian_last_name ? 'adm-err-guardian_last_name' : undefined} className={cls('guardian_last_name')} /><Err k="guardian_last_name" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1"><label htmlFor="adm-guardian_relationship" className="text-sm font-medium text-gray-700 dark:text-gray-300">Relationship *</label><select value={form.guardian_relationship} onChange={(e) => updateForm('guardian_relationship', e.target.value)} id="adm-guardian_relationship" aria-invalid={!!errors.guardian_relationship} aria-describedby={errors.guardian_relationship ? 'adm-err-guardian_relationship' : undefined} className={cls('guardian_relationship')}><option value="">Select...</option>{RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}</select><Err k="guardian_relationship" /></div>
            <div className="flex flex-col gap-1"><label htmlFor="adm-guardian_phone" className="text-sm font-medium text-gray-700 dark:text-gray-300">Phone *</label><input type="tel" value={form.guardian_phone} onChange={(e) => updateForm('guardian_phone', e.target.value)} placeholder="+232..." id="adm-guardian_phone" aria-invalid={!!errors.guardian_phone} aria-describedby={errors.guardian_phone ? 'adm-err-guardian_phone' : undefined} className={cls('guardian_phone')} /><Err k="guardian_phone" /></div>
            <div className="flex flex-col gap-1"><label htmlFor="adm-guardian_alt_phone" className="text-sm font-medium text-gray-700 dark:text-gray-300">Alt Phone</label><input type="tel" value={form.guardian_alt_phone} onChange={(e) => updateForm('guardian_alt_phone', e.target.value)} id="adm-guardian_alt_phone" aria-invalid={!!errors.guardian_alt_phone} aria-describedby={errors.guardian_alt_phone ? 'adm-err-guardian_alt_phone' : undefined} className={cls('guardian_alt_phone')} /><Err k="guardian_alt_phone" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1"><label htmlFor="adm-guardian_email" className="text-sm font-medium text-gray-700 dark:text-gray-300">Email{publicSchoolSlug ? ' *' : ''}</label><input type="email" required={!!publicSchoolSlug} value={form.guardian_email} onChange={(e) => updateForm('guardian_email', e.target.value)} id="adm-guardian_email" aria-invalid={!!errors.guardian_email} aria-describedby={errors.guardian_email ? 'adm-err-guardian_email' : undefined} className={cls('guardian_email')} /><Err k="guardian_email" /></div>
            <div className="flex flex-col gap-1"><label htmlFor="adm-guardian_occupation" className="text-sm font-medium text-gray-700 dark:text-gray-300">Occupation</label><input value={form.guardian_occupation} placeholder="e.g. Teacher, Trader" onChange={(e) => updateForm('guardian_occupation', e.target.value)} id="adm-guardian_occupation" aria-invalid={!!errors.guardian_occupation} aria-describedby={errors.guardian_occupation ? 'adm-err-guardian_occupation' : undefined} className={cls('guardian_occupation')} /><Err k="guardian_occupation" /></div>
          </div>
          <div className="flex flex-col gap-1"><label htmlFor="adm-guardian_address" className="text-sm font-medium text-gray-700 dark:text-gray-300">Home Address</label><input value={form.guardian_address} placeholder="e.g. 10 Main Road, Freetown" onChange={(e) => updateForm('guardian_address', e.target.value)} id="adm-guardian_address" aria-invalid={!!errors.guardian_address} aria-describedby={errors.guardian_address ? 'adm-err-guardian_address' : undefined} className={cls('guardian_address')} /><Err k="guardian_address" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1"><label htmlFor="adm-guardian_nationality" className="text-sm font-medium text-gray-700 dark:text-gray-300">Nationality</label><input value={form.guardian_nationality} placeholder="Sierra Leonean" onChange={(e) => updateForm('guardian_nationality', e.target.value)} id="adm-guardian_nationality" aria-invalid={!!errors.guardian_nationality} aria-describedby={errors.guardian_nationality ? 'adm-err-guardian_nationality' : undefined} className={cls('guardian_nationality')} /><Err k="guardian_nationality" /></div>
            <div className="flex flex-col gap-1"><label htmlFor="adm-guardian_national_id" className="text-sm font-medium text-gray-700 dark:text-gray-300">National ID / Passport No.</label><input value={form.guardian_national_id} placeholder="e.g. SL12345678" onChange={(e) => updateForm('guardian_national_id', e.target.value)} id="adm-guardian_national_id" aria-invalid={!!errors.guardian_national_id} aria-describedby={errors.guardian_national_id ? 'adm-err-guardian_national_id' : undefined} className={cls('guardian_national_id')} /><Err k="guardian_national_id" /></div>
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
            {form.takes_medication && <div className="flex flex-col gap-1"><label htmlFor="adm-medication_details" className="text-sm font-medium text-gray-700 dark:text-gray-300">Specify medication(s) *</label><input value={form.medication_details} onChange={(e) => updateForm('medication_details', e.target.value)} id="adm-medication_details" aria-invalid={!!errors.medication_details} aria-describedby={errors.medication_details ? 'adm-err-medication_details' : undefined} className={cls('medication_details')} /><Err k="medication_details" /></div>}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span className="text-sm text-gray-700 dark:text-gray-300">Known allergies?</span>
              <select value={form.has_allergies ? 'yes' : 'no'} onChange={(e) => updateForm('has_allergies', e.target.value === 'yes')} className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"><option value="no">No</option><option value="yes">Yes</option></select>
            </div>
            {form.has_allergies && <div className="flex flex-col gap-1"><label htmlFor="adm-allergy_details" className="text-sm font-medium text-gray-700 dark:text-gray-300">Describe allergies *</label><input value={form.allergy_details} onChange={(e) => updateForm('allergy_details', e.target.value)} id="adm-allergy_details" aria-invalid={!!errors.allergy_details} aria-describedby={errors.allergy_details ? 'adm-err-allergy_details' : undefined} className={cls('allergy_details')} /><Err k="allergy_details" /></div>}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span className="text-sm text-gray-700 dark:text-gray-300">Chronic illness or condition?</span>
              <select value={form.has_chronic_illness ? 'yes' : 'no'} onChange={(e) => updateForm('has_chronic_illness', e.target.value === 'yes')} className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"><option value="no">No</option><option value="yes">Yes</option></select>
            </div>
            {form.has_chronic_illness && <div className="flex flex-col gap-1"><label htmlFor="adm-chronic_illness_details" className="text-sm font-medium text-gray-700 dark:text-gray-300">Describe condition *</label><input value={form.chronic_illness_details} onChange={(e) => updateForm('chronic_illness_details', e.target.value)} id="adm-chronic_illness_details" aria-invalid={!!errors.chronic_illness_details} aria-describedby={errors.chronic_illness_details ? 'adm-err-chronic_illness_details' : undefined} className={cls('chronic_illness_details')} /><Err k="chronic_illness_details" /></div>}
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
          <p className="-mt-2 text-xs text-gray-500 dark:text-gray-400">Optional. If you add a contact, give both a name and a phone number.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1"><label htmlFor="adm-emergency_contact_name" className="text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label><input value={form.emergency_contact_name} placeholder="e.g. Issa Kamara" onChange={(e) => updateForm('emergency_contact_name', e.target.value)} id="adm-emergency_contact_name" aria-invalid={!!errors.emergency_contact_name} aria-describedby={errors.emergency_contact_name ? 'adm-err-emergency_contact_name' : undefined} className={cls('emergency_contact_name')} /><Err k="emergency_contact_name" /></div>
            <div className="flex flex-col gap-1"><label htmlFor="adm-emergency_contact_relationship" className="text-sm font-medium text-gray-700 dark:text-gray-300">Relationship</label><input value={form.emergency_contact_relationship} placeholder="e.g. Uncle, Neighbour" onChange={(e) => updateForm('emergency_contact_relationship', e.target.value)} id="adm-emergency_contact_relationship" aria-invalid={!!errors.emergency_contact_relationship} aria-describedby={errors.emergency_contact_relationship ? 'adm-err-emergency_contact_relationship' : undefined} className={cls('emergency_contact_relationship')} /><Err k="emergency_contact_relationship" /></div>
            <div className="flex flex-col gap-1"><label htmlFor="adm-emergency_contact_phone" className="text-sm font-medium text-gray-700 dark:text-gray-300">Phone Number</label><input type="tel" value={form.emergency_contact_phone} placeholder="+232..." onChange={(e) => updateForm('emergency_contact_phone', e.target.value)} id="adm-emergency_contact_phone" aria-invalid={!!errors.emergency_contact_phone} aria-describedby={errors.emergency_contact_phone ? 'adm-err-emergency_contact_phone' : undefined} className={cls('emergency_contact_phone')} /><Err k="emergency_contact_phone" /></div>
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
          {publicSchoolSlug && (
            <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
              <label htmlFor="adm-website">Leave this empty</label>
              <input id="adm-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
          )}
          {needsCaptcha && <Turnstile key={captchaKey} siteKey={captchaSiteKey!} onToken={setCaptchaToken} />}
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
