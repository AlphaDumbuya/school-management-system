/**
 * VerificationPage — simple, instant school verification for the account owner.
 *
 * Flow: rationale ("why verify") → confirm name + EMIS + government-ID → instant
 * result → prompt for a profile photo (upload from device, no waiting for review).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MainLayout } from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { ShieldCheck, BadgeCheck, Loader2, Lock, Info, Camera, Upload, X } from 'lucide-react';
import useAuthStore from '@store/authStore';
import verificationService, { IdType } from '@services/verificationService';
import schoolConfigService from '@services/schoolConfigService';
import { showToast } from '@utils/toast';

const EMIS_RE = /^[A-Za-z0-9]{4,20}$/;
const ID_RE: Record<IdType, RegExp> = {
  passport: /^[A-Za-z0-9]{6,12}$/,
  national_id: /^[A-Za-z0-9-]{5,20}$/,
  drivers_license: /^[A-Za-z0-9-]{5,20}$/,
};
const ID_HINT: Record<IdType, string> = {
  passport: '6–12 letters/digits',
  national_id: '5–20 letters/digits',
  drivers_license: '5–20 letters/digits',
};

export const VerificationPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [status, setStatus] = useState<'unverified' | 'verified' | 'loading'>('loading');
  const [lastReason, setLastReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPhotoStep, setShowPhotoStep] = useState(false);

  const defaultName = useMemo(
    () => [ (user as any)?.firstName || (user as any)?.first_name, (user as any)?.lastName || (user as any)?.last_name ]
      .filter(Boolean).join(' ').trim(),
    [user]
  );

  const [form, setForm] = useState({
    legalName: '',
    emisCode: '',
    idType: 'national_id' as IdType,
    idNumber: '',
    idName: '',
    schoolLevel: '',
    district: '',
    yearEstablished: '',
  });

  useEffect(() => {
    setForm((f) => ({ ...f, legalName: f.legalName || defaultName, idName: f.idName || defaultName }));
  }, [defaultName]);

  useEffect(() => {
    verificationService.getStatus().then((res) => {
      if (res.success && res.data) {
        setStatus(res.data.status);
        setLastReason(res.data.lastReason || null);
      } else {
        setStatus('unverified');
      }
    });
  }, []);

  // Prefill from School Settings so the owner doesn't retype known details.
  useEffect(() => {
    schoolConfigService.getSchoolInfo().then((res) => {
      const s = res?.success ? (res.data as any) : null;
      if (!s) return;
      setForm((f) => ({
        ...f,
        emisCode: f.emisCode || s.emis_code || '',
        district: f.district || s.city || s.state || '',
        yearEstablished: f.yearEstablished || (s.founded_year ? String(s.founded_year) : ''),
        legalName: f.legalName || s.principal_name || defaultName,
        idName: f.idName || s.principal_name || defaultName,
      }));
    }).catch(() => undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const errors = {
    emisCode: form.emisCode && !EMIS_RE.test(form.emisCode.trim()) ? 'EMIS code must be 4–20 letters or digits' : '',
    idNumber: form.idNumber && !ID_RE[form.idType].test(form.idNumber.trim()) ? `Expected ${ID_HINT[form.idType]}` : '',
    yearEstablished:
      form.yearEstablished && !/^\d{4}$/.test(form.yearEstablished) ? 'Enter a 4-digit year' : '',
  };
  const canSubmit =
    form.legalName.trim() &&
    EMIS_RE.test(form.emisCode.trim()) &&
    ID_RE[form.idType].test(form.idNumber.trim()) &&
    form.idName.trim() &&
    !errors.yearEstablished;

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const res = await verificationService.verify({
        legalName: form.legalName.trim(),
        emisCode: form.emisCode.trim(),
        idType: form.idType,
        idNumber: form.idNumber.trim(),
        idName: form.idName.trim(),
        schoolLevel: form.schoolLevel.trim() || undefined,
        district: form.district.trim() || undefined,
        yearEstablished: form.yearEstablished ? Number(form.yearEstablished) : undefined,
      });
      if (res.success) {
        setStatus('verified');
        setShowPhotoStep(true);
        if (user) setUser({ ...(user as any), verificationStatus: 'verified' });
        showToast.success('Your school is verified 🎉');
      } else {
        setLastReason(res.error || 'Verification failed');
        showToast.error(res.error || 'Verification failed');
      }
    } catch {
      showToast.error('Verification failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const input = 'w-full border border-gray-300 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#1d4ed8] focus:ring-1 focus:ring-[#1d4ed8]/30';
  const label = 'block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide';

  return (
    <MainLayout>
      <PageShell title="School Verification" subtitle="Verify your school to unlock full access">
        {status === 'loading' ? (
          <div className="flex items-center gap-2 text-gray-400 py-16 justify-center">
            <Loader2 className="animate-spin" size={18} /> Loading…
          </div>
        ) : status === 'verified' && !showPhotoStep ? (
          <div className="max-w-lg mx-auto bg-white rounded-2xl border border-emerald-200 p-8 text-center">
            <BadgeCheck size={48} className="mx-auto text-emerald-600 mb-3" />
            <h3 className="text-xl font-black text-gray-900">Your school is verified</h3>
            <p className="text-sm text-gray-500 mt-1">You have full access to all features.</p>
          </div>
        ) : showPhotoStep ? (
          <ProfilePhotoStep onDone={() => setShowPhotoStep(false)} />
        ) : (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Why verify */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex gap-3">
              <ShieldCheck className="text-[#1d4ed8] shrink-0" size={22} />
              <div className="text-sm text-slate-700">
                <p className="font-bold text-slate-900 mb-1">Why verify your school?</p>
                Verification protects your school's data and community, builds trust with parents
                and staff, prevents impersonation, and unlocks high-impact features like billing,
                staff management, and ID card issuance.
              </div>
            </div>

            {lastReason && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                {lastReason}
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
              <div>
                <label className={label}>Account owner full legal name</label>
                <input className={input} value={form.legalName} onChange={(e) => set('legalName', e.target.value)} placeholder="As registered" />
              </div>

              <div>
                <label className={label}>
                  EMIS code <span className="text-gray-400 normal-case font-normal">— your school's MBSSE / EMIS identifier</span>
                </label>
                <input className={input} value={form.emisCode} onChange={(e) => set('emisCode', e.target.value)} placeholder="e.g. SL123456" />
                {errors.emisCode && <p className="text-xs text-red-500 mt-1">{errors.emisCode}</p>}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={label}>Government ID type</label>
                  <select className={input} value={form.idType} onChange={(e) => set('idType', e.target.value)}>
                    <option value="national_id">National ID</option>
                    <option value="passport">Passport</option>
                    <option value="drivers_license">Driver's licence</option>
                  </select>
                </div>
                <div>
                  <label className={label}>ID number</label>
                  <input className={input} value={form.idNumber} onChange={(e) => set('idNumber', e.target.value)} placeholder={ID_HINT[form.idType]} />
                  {errors.idNumber && <p className="text-xs text-red-500 mt-1">{errors.idNumber}</p>}
                </div>
              </div>

              <div>
                <label className={label}>Name exactly as printed on your ID</label>
                <input className={input} value={form.idName} onChange={(e) => set('idName', e.target.value)} placeholder="Full name on the ID" />
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <Info size={12} /> This must match your account owner name so we know the ID is yours.
                </p>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className={label}>School level</label>
                  <input className={input} value={form.schoolLevel} onChange={(e) => set('schoolLevel', e.target.value)} placeholder="Primary / JSS / SSS" />
                </div>
                <div>
                  <label className={label}>District / chiefdom</label>
                  <input className={input} value={form.district} onChange={(e) => set('district', e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <label className={label}>Year established</label>
                  <input className={input} value={form.yearEstablished} onChange={(e) => set('yearEstablished', e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} placeholder="e.g. 2005" />
                  {errors.yearEstablished && <p className="text-xs text-red-500 mt-1">{errors.yearEstablished}</p>}
                </div>
              </div>

              <button
                onClick={submit}
                disabled={!canSubmit || submitting}
                className="w-full inline-flex items-center justify-center gap-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-bold text-sm py-3.5 rounded-xl transition-colors disabled:opacity-50"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                {submitting ? 'Verifying…' : 'Verify my school'}
              </button>
              <p className="text-[11px] text-gray-400 text-center flex items-center justify-center gap-1">
                <Lock size={11} /> Your details are private to your school and never shared.
              </p>
            </div>
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
};

/** Post-verification: prompt for a profile photo (optional, non-blocking). */
const MAX_PHOTO_BYTES = 3 * 1024 * 1024; // 3MB
const ACCEPTED_PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

const ProfilePhotoStep: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [dataUrl, setDataUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
      showToast.error('Please choose a PNG, JPG or WEBP image.');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      showToast.error('Image is too large. Please use one under 3MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDataUrl(String(reader.result || ''));
      setFileName(file.name);
    };
    reader.onerror = () => showToast.error('Could not read the image file.');
    reader.readAsDataURL(file);
  };

  const clear = () => {
    setDataUrl('');
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const save = async () => {
    if (!dataUrl) return;
    setSaving(true);
    try {
      const res = await verificationService.setProfilePhoto(dataUrl);
      if (res.success) {
        if (user) setUser({ ...(user as any), profilePhotoUrl: dataUrl });
        showToast.success('Profile photo saved');
        onDone();
      } else {
        showToast.error(res.error || 'Could not save photo');
      }
    } catch {
      showToast.error('Could not save photo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto bg-white rounded-2xl border border-emerald-200 p-8 text-center space-y-5">
      <BadgeCheck size={48} className="mx-auto text-emerald-600" />
      <div>
        <h3 className="text-xl font-black text-gray-900">Verified! Add your photo</h3>
        <p className="text-sm text-gray-500 mt-1">Your photo appears on your profile with the Verified School badge.</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {dataUrl ? (
        <div className="space-y-3">
          <div className="relative w-32 h-32 mx-auto">
            <img src={dataUrl} alt="Selected" className="w-32 h-32 rounded-2xl object-cover border border-gray-200" />
            <button
              type="button"
              onClick={clear}
              className="absolute -top-2 -right-2 bg-white border border-gray-200 rounded-full p-1 shadow hover:bg-gray-50"
              aria-label="Remove photo"
            >
              <X size={14} className="text-gray-600" />
            </button>
          </div>
          {fileName && <p className="text-xs text-gray-400 truncate">{fileName}</p>}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs font-semibold text-[#1d4ed8] hover:underline"
          >
            Choose a different photo
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 hover:border-[#1d4ed8] rounded-2xl py-8 text-gray-500 hover:text-[#1d4ed8] transition-colors"
        >
          <Upload size={28} />
          <span className="text-sm font-semibold">Upload a photo</span>
          <span className="text-[11px] text-gray-400">PNG, JPG or WEBP · up to 3MB</span>
        </button>
      )}

      <button
        onClick={save}
        disabled={!dataUrl || saving}
        className="w-full inline-flex items-center justify-center gap-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-bold text-sm px-4 py-3 rounded-xl disabled:opacity-50"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} Save photo
      </button>
      <button onClick={onDone} className="block mx-auto text-xs text-gray-400 hover:text-gray-600">Skip for now</button>
    </div>
  );
};

export default VerificationPage;
