/**
 * VerificationPage — instant, self-declared school verification for the
 * account owner (the principal who registered the school).
 *
 * The owner confirms the school's EMIS code and their government ID, and
 * declares the details true. The server checks the formats, that the name on
 * the ID matches the account owner's name on file, and that no other school
 * already verified with that EMIS code. Then a profile photo (optional).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { ShieldCheck, BadgeCheck, Loader2, Lock, Info, Camera, Upload, X, CheckCircle2 } from 'lucide-react';
import useAuthStore from '@store/authStore';
import verificationService, { IdType, EMIS_RE } from '@services/verificationService';
import schoolConfigService from '@services/schoolConfigService';
import { showToast } from '@utils/toast';

const ID_RE: Record<IdType, RegExp> = {
  passport: /^[A-Za-z0-9]{6,12}$/,
  national_id: /^[A-Za-z0-9-]{5,20}$/,
  drivers_license: /^[A-Za-z0-9-]{5,20}$/,
};
const ID_HINT: Record<IdType, string> = {
  passport: '6–12 letters or digits',
  national_id: '5–20 letters or digits',
  drivers_license: '5–20 letters or digits',
};
const ID_LABEL: Record<IdType, string> = { national_id: 'National ID', passport: 'Passport', drivers_license: "Driver's licence" };

export const VerificationPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [status, setStatus] = useState<'unverified' | 'verified' | 'loading'>('loading');
  const [info, setInfo] = useState<{ ownerName?: string; verifiedAt?: string | null; idLast4?: string | null; emisCode?: string | null }>({});
  const [lastReason, setLastReason] = useState<string | null>(null);
  const [options, setOptions] = useState<{ school_levels: string[]; districts: string[] }>({ school_levels: [], districts: [] });
  const [submitting, setSubmitting] = useState(false);
  const [showPhotoStep, setShowPhotoStep] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const isOwner = (user as any)?.role === 'principal' && (user as any)?.isOwner !== false;

  const [form, setForm] = useState({
    emisCode: '',
    idType: 'national_id' as IdType,
    idNumber: '',
    idName: '',
    schoolLevel: '',
    district: '',
    yearEstablished: '',
    declaration: false,
  });

  useEffect(() => {
    verificationService.getStatus().then((res) => {
      if (res.success && res.data) {
        setStatus(res.data.status);
        setLastReason(res.data.lastReason || null);
        setInfo({ ownerName: res.data.ownerName, verifiedAt: res.data.verifiedAt, idLast4: res.data.idLast4, emisCode: res.data.emisCode });
        if (res.data.emisCode) setForm((f) => ({ ...f, emisCode: f.emisCode || res.data!.emisCode || '' }));
      } else {
        setStatus('unverified');
      }
    });
    verificationService.getOptions().then((res) => { if (res.success && res.data) setOptions(res.data); }).catch(() => undefined);
    // Prefill from School Settings so the owner doesn't retype known details.
    schoolConfigService.getSchoolInfo().then((res) => {
      const s = res?.success ? (res.data as any) : null;
      if (!s) return;
      setForm((f) => ({
        ...f,
        emisCode: f.emisCode || s.emis_code || '',
        yearEstablished: f.yearEstablished || (s.founded_year ? String(s.founded_year) : ''),
      }));
    }).catch(() => undefined);
  }, []);

  const set = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }));

  const errors = {
    emisCode: form.emisCode && !EMIS_RE.test(form.emisCode.trim()) ? 'Use 4–30 letters or digits; "/" and "-" are allowed.' : '',
    idNumber: form.idNumber && !ID_RE[form.idType].test(form.idNumber.trim().replace(/\s+/g, '')) ? `Expected ${ID_HINT[form.idType]}.` : '',
    yearEstablished: form.yearEstablished && !/^\d{4}$/.test(form.yearEstablished) ? 'Enter a 4-digit year.' : '',
  };
  const canSubmit =
    EMIS_RE.test(form.emisCode.trim()) &&
    ID_RE[form.idType].test(form.idNumber.trim().replace(/\s+/g, '')) &&
    form.idName.trim().length >= 3 &&
    !errors.yearEstablished &&
    form.declaration;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const res = await verificationService.verify({
        emisCode: form.emisCode.trim(),
        idType: form.idType,
        idNumber: form.idNumber.trim(),
        idName: form.idName.trim(),
        schoolLevel: form.schoolLevel || undefined,
        district: form.district || undefined,
        yearEstablished: form.yearEstablished ? Number(form.yearEstablished) : undefined,
        declaration: form.declaration,
      });
      if (res.success) {
        setStatus('verified');
        setLastReason(null);
        setInfo((i) => ({ ...i, verifiedAt: new Date().toISOString(), idLast4: form.idNumber.trim().slice(-4), emisCode: form.emisCode.trim().toUpperCase() }));
        setShowPhotoStep(true);
        if (user) setUser({ ...(user as any), verificationStatus: 'verified' });
        showToast.success('Your school is verified.');
      } else {
        setLastReason(res.error || 'Verification failed. Please check your details and try again.');
      }
    } catch {
      setLastReason('Verification failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const input = 'w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white outline-none focus:border-[#1d4ed8] focus:ring-2 focus:ring-[#1d4ed8]/20 aria-[invalid=true]:border-red-400';
  const label = 'block text-sm font-semibold text-gray-800 mb-1.5';
  const hint = 'text-xs text-gray-500 mt-1';
  const err = (k: keyof typeof errors) => (touched[k] || form[k as keyof typeof form]) && errors[k] ? errors[k] : '';
  const when = (v?: string | null) => (v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

  return (
    <MainLayout>
      <PageShell title="Verify your school" subtitle="Confirm your school's details as the account owner">
        {status === 'loading' ? (
          <div className="flex items-center gap-2 text-gray-500 py-16 justify-center" role="status">
            <Loader2 className="animate-spin" size={18} aria-hidden="true" /> Loading…
          </div>
        ) : status === 'verified' && !showPhotoStep ? (
          <div className="max-w-lg mx-auto bg-white rounded-2xl border border-emerald-200 p-8 text-center">
            <BadgeCheck size={48} className="mx-auto text-emerald-600 mb-3" aria-hidden="true" />
            <h2 className="text-xl font-black text-gray-900">Your school is verified</h2>
            <dl className="mt-4 text-sm text-gray-600 space-y-1">
              {info.verifiedAt && <div><dt className="inline font-semibold">Verified on: </dt><dd className="inline">{when(info.verifiedAt)}</dd></div>}
              {info.emisCode && <div><dt className="inline font-semibold">EMIS code: </dt><dd className="inline">{info.emisCode}</dd></div>}
              {info.idLast4 && <div><dt className="inline font-semibold">Owner ID: </dt><dd className="inline">ending {info.idLast4}</dd></div>}
            </dl>
            <p className="text-xs text-gray-500 mt-4">Need to change these details? Contact WiSkul support.</p>
          </div>
        ) : showPhotoStep ? (
          <ProfilePhotoStep onDone={() => setShowPhotoStep(false)} />
        ) : !isOwner ? (
          <div className="max-w-lg mx-auto bg-white rounded-2xl border border-gray-200 p-8 text-center text-sm text-gray-600">
            Only the school's account owner can verify the school.
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* What this is */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex gap-3">
              <ShieldCheck className="text-[#1d4ed8] shrink-0" size={22} aria-hidden="true" />
              <div className="text-sm text-slate-700 space-y-2">
                <p className="font-bold text-slate-900">About verification</p>
                <p>
                  You confirm that you run this school by giving its EMIS code and your ID as the account owner.
                  It takes about two minutes and you'll need it before changing your subscription plan.
                </p>
                <ul className="space-y-1">
                  {[
                    'The name on your ID must match your account name.',
                    'Each EMIS code can be verified by one school only.',
                    'You confirm the details are true. False details can lead to the account being suspended.',
                  ].map((t) => <li key={t} className="flex gap-2"><CheckCircle2 size={15} className="text-[#1d4ed8] shrink-0 mt-0.5" aria-hidden="true" />{t}</li>)}
                </ul>
              </div>
            </div>

            {lastReason && (
              <div role="alert" className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-900">
                {lastReason}
              </div>
            )}

            <form onSubmit={submit} noValidate className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 space-y-6">
              <fieldset className="space-y-4">
                <legend className="text-base font-bold text-gray-900 mb-1">Your school</legend>
                <div>
                  <label htmlFor="v-emis" className={label}>EMIS code or school registration number</label>
                  <input id="v-emis" className={input} value={form.emisCode} autoComplete="off"
                    onChange={(e) => set('emisCode', e.target.value)} onBlur={() => touch('emisCode')}
                    aria-invalid={!!err('emisCode')} aria-describedby="v-emis-hint" placeholder="e.g. 3101204 or MEST/SL/2026/04" />
                  <p id="v-emis-hint" className={err('emisCode') ? 'text-xs text-red-600 mt-1' : hint}>
                    {err('emisCode') || "The number MBSSE gave your school. It's on your approval or registration letter."}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="v-level" className={label}>School level <span className="font-normal text-gray-500">(optional)</span></label>
                    <select id="v-level" className={input} value={form.schoolLevel} onChange={(e) => set('schoolLevel', e.target.value)}>
                      <option value="">Choose…</option>
                      {options.school_levels.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="v-district" className={label}>District <span className="font-normal text-gray-500">(optional)</span></label>
                    <select id="v-district" className={input} value={form.district} onChange={(e) => set('district', e.target.value)}>
                      <option value="">Choose…</option>
                      {options.districts.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="v-year" className={label}>Year founded <span className="font-normal text-gray-500">(optional)</span></label>
                    <input id="v-year" className={input} inputMode="numeric" value={form.yearEstablished}
                      onChange={(e) => set('yearEstablished', e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} onBlur={() => touch('yearEstablished')}
                      aria-invalid={!!err('yearEstablished')} aria-describedby="v-year-err" placeholder="e.g. 2005" />
                    {err('yearEstablished') && <p id="v-year-err" className="text-xs text-red-600 mt-1">{err('yearEstablished')}</p>}
                  </div>
                </div>
              </fieldset>

              <fieldset className="space-y-4">
                <legend className="text-base font-bold text-gray-900 mb-1">You, the account owner</legend>
                <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm">
                  <span className="text-gray-500">Account owner: </span>
                  <span className="font-semibold text-gray-900">{info.ownerName || '—'}</span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    Not your legal name? <Link to="/settings?tab=profile" className="text-[#1d4ed8] font-semibold hover:underline">Correct it in your profile</Link> first.
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="v-idtype" className={label}>Type of ID</label>
                    <select id="v-idtype" className={input} value={form.idType} onChange={(e) => set('idType', e.target.value)}>
                      {(Object.keys(ID_LABEL) as IdType[]).map((k) => <option key={k} value={k}>{ID_LABEL[k]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="v-idnum" className={label}>{ID_LABEL[form.idType]} number</label>
                    <input id="v-idnum" className={input} value={form.idNumber} autoComplete="off"
                      onChange={(e) => set('idNumber', e.target.value)} onBlur={() => touch('idNumber')}
                      aria-invalid={!!err('idNumber')} aria-describedby="v-idnum-hint" />
                    <p id="v-idnum-hint" className={err('idNumber') ? 'text-xs text-red-600 mt-1' : hint}>{err('idNumber') || ID_HINT[form.idType]}</p>
                  </div>
                </div>
                <div>
                  <label htmlFor="v-idname" className={label}>Your name as printed on the ID</label>
                  <input id="v-idname" className={input} value={form.idName} autoComplete="name"
                    onChange={(e) => set('idName', e.target.value)} aria-describedby="v-idname-hint" />
                  <p id="v-idname-hint" className={`${hint} flex items-center gap-1`}>
                    <Info size={12} aria-hidden="true" /> Must match the account owner name above (middle names and word order don't matter).
                  </p>
                </div>
              </fieldset>

              <label className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form.declaration} onChange={(e) => set('declaration', e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#1d4ed8] focus:ring-[#1d4ed8] shrink-0" />
                <span>I confirm that I run this school, that these details are true, and that the ID is mine.</span>
              </label>

              <button
                type="submit"
                disabled={!canSubmit || submitting}
                className="w-full inline-flex items-center justify-center gap-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-bold text-sm py-3.5 rounded-xl transition-colors disabled:opacity-50"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <ShieldCheck size={16} aria-hidden="true" />}
                {submitting ? 'Verifying…' : 'Verify my school'}
              </button>
              <p className="text-xs text-gray-500 flex items-start gap-1.5">
                <Lock size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  Your ID number is encrypted and only its last 4 characters are shown, to you and to WiSkul support.
                  These details are used only to confirm the school's account owner and are never shown to parents, staff or other schools.
                </span>
              </p>
            </form>
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
