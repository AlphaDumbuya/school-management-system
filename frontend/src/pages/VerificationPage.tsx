/**
 * VerificationPage — the account owner (the principal who registered the
 * school) submits the school's details for WiSkul to review.
 *
 * The owner gives the school's EMIS code and their government ID and declares
 * the details true. WiSkul's verification team reviews the submission and
 * approves it (verified) or rejects it with a reason; after a rejection the
 * owner fixes the details and submits again. States:
 *   unverified → form · pending → under review · verified → done ·
 *   rejected → reason + prefilled form
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { ShieldCheck, BadgeCheck, Loader2, Lock, Info, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import useAuthStore from '@store/authStore';
import verificationService, {
  IdType,
  EMIS_RE,
  ID_TYPE_LABEL,
  type VerificationState,
  type VerificationStatus,
} from '@services/verificationService';
import schoolConfigService from '@services/schoolConfigService';
import { SCHOOL_LEVEL_OPTIONS, SCHOOL_LEVEL_GROUPS } from '@lib/leadTitle';
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
const ID_PLACEHOLDER: Record<IdType, string> = {
  national_id: 'e.g. SL1234567',
  passport: 'e.g. P1234567',
  drivers_license: 'e.g. DL-123456',
};
const isIdType = (v: unknown): v is IdType => typeof v === 'string' && v in ID_TYPE_LABEL;

/** Friendly text for the error codes POST /verification/verify can return. */
const submitErrorText = (code: string | undefined, serverMessage: string | undefined): string => {
  switch (code) {
    case 'ALREADY_PENDING':
      return "Your details are already with WiSkul for review. We'll let you know once they've been checked.";
    case 'ALREADY_VERIFIED':
      return 'Your school is already verified.';
    case 'EMIS_IN_USE':
      return 'This EMIS code is already used by another school on WiSkul. Check the number, or contact WiSkul support if it belongs to your school.';
    case 'IDENTITY_NAME_MISMATCH':
      return "The name on your ID doesn't match the account owner's name. Check the spelling, or correct your name in your profile first.";
    case 'VERIFICATION_FIELD_INVALID':
      return serverMessage || "One of the details isn't in the expected format. Check the fields and try again.";
    case 'NOT_ACCOUNT_OWNER':
      return "Only the school's account owner can submit the school for verification.";
    default:
      return serverMessage || 'Could not submit your details. Please check them and try again.';
  }
};

type StatusInfo = Omit<VerificationStatus, 'status'>;

export const VerificationPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [status, setStatus] = useState<VerificationState | 'loading'>('loading');
  const [info, setInfo] = useState<StatusInfo>({});
  const [districts, setDistricts] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
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

  /** Keep the cached user's state in step with the server, so banners and badges agree. */
  const syncUserState = (next: VerificationState) => {
    const u = useAuthStore.getState().user as any;
    if (u && u.verificationStatus !== next) setUser({ ...u, verificationStatus: next });
  };

  const loadStatus = () =>
    verificationService.getStatus().then((res) => {
      if (!(res.success && res.data)) {
        setStatus('unverified');
        return;
      }
      const d = res.data;
      const { status: s, ...rest } = d;
      setStatus(s);
      setInfo(rest);
      syncUserState(s);
      // What the owner submitted last wins over School Settings (rejected → fix and resubmit).
      setForm((f) => ({
        ...f,
        emisCode: d.emisCode || f.emisCode,
        schoolLevel: d.schoolLevel || f.schoolLevel,
        district: d.district || f.district,
        yearEstablished: d.yearEstablished ? String(d.yearEstablished) : f.yearEstablished,
        idType: isIdType(d.idType) ? d.idType : f.idType,
        idName: d.idName || f.idName,
      }));
    });

  useEffect(() => {
    loadStatus();
    verificationService.getOptions()
      .then((res) => { if (res.success && res.data) setDistricts(res.data.districts || []); })
      .catch(() => undefined);
    // Prefill from School Settings so the owner doesn't retype known details.
    schoolConfigService.getSchoolInfo().then((res) => {
      const s = res?.success ? (res.data as any) : null;
      if (!s) return;
      setForm((f) => ({
        ...f,
        emisCode: f.emisCode || s.emis_code || '',
        yearEstablished: f.yearEstablished || (s.founded_year ? String(s.founded_year) : ''),
        schoolLevel: f.schoolLevel || s.school_type || '',
      }));
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setFormError(null);
    try {
      const idNumber = form.idNumber.trim();
      const res = await verificationService.verify({
        emisCode: form.emisCode.trim(),
        idType: form.idType,
        idNumber,
        idName: form.idName.trim(),
        schoolLevel: form.schoolLevel || undefined,
        district: form.district || undefined,
        yearEstablished: form.yearEstablished ? Number(form.yearEstablished) : undefined,
        declaration: form.declaration,
      });
      if (res.success) {
        setStatus('pending');
        setInfo((i) => ({
          ...i,
          submittedAt: res.data?.submittedAt || new Date().toISOString(),
          lastReason: null,
          idLast4: idNumber.replace(/\s+/g, '').slice(-4),
          idType: form.idType,
          emisCode: form.emisCode.trim().toUpperCase(),
          schoolLevel: form.schoolLevel || null,
          district: form.district || null,
        }));
        setForm((f) => ({ ...f, idNumber: '', declaration: false }));
        syncUserState('pending');
        showToast.success('Submitted for review');
        return;
      }
      const code = (res as any).code as string | undefined;
      if (code === 'ALREADY_PENDING' || code === 'ALREADY_VERIFIED') {
        // The server is ahead of this screen: show its state instead of the form.
        showToast.info(submitErrorText(code, res.error));
        await loadStatus();
        return;
      }
      setFormError(submitErrorText(code, res.error));
    } catch {
      setFormError('Could not submit your details. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const input = 'w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white outline-none focus:border-[#1d4ed8] focus:ring-2 focus:ring-[#1d4ed8]/20 aria-[invalid=true]:border-red-400';
  const label = 'block text-sm font-semibold text-gray-800 mb-1.5';
  const hint = 'text-xs text-gray-500 mt-1';
  const err = (k: keyof typeof errors) => (touched[k] || form[k as keyof typeof form]) && errors[k] ? errors[k] : '';
  const when = (v?: string | null) => (v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
  const idSummary = info.idLast4 ? `${isIdType(info.idType) ? ID_TYPE_LABEL[info.idType] : 'ID'} ending ${info.idLast4}` : '';
  const levelKnown = !form.schoolLevel || SCHOOL_LEVEL_OPTIONS.some((o) => o.value === form.schoolLevel);
  const districtKnown = !form.district || districts.includes(form.district);

  return (
    <MainLayout>
      <PageShell title="Verify your school" subtitle="Confirm your school's details as the account owner">
        {status === 'loading' ? (
          <div className="flex items-center gap-2 text-gray-500 py-16 justify-center" role="status">
            <Loader2 className="animate-spin" size={18} aria-hidden="true" /> Loading…
          </div>
        ) : status === 'verified' ? (
          <div className="max-w-lg mx-auto bg-white rounded-2xl border border-emerald-200 p-8 text-center">
            <BadgeCheck size={48} className="mx-auto text-emerald-600 mb-3" aria-hidden="true" />
            <h2 className="text-xl font-black text-gray-900">Your school is verified</h2>
            <dl className="mt-4 text-sm text-gray-600 space-y-1">
              {info.verifiedAt && <div><dt className="sr-only">Verified</dt><dd>Verified by WiSkul on {when(info.verifiedAt)}</dd></div>}
              {info.emisCode && <div><dt className="inline font-semibold">EMIS code: </dt><dd className="inline">{info.emisCode}</dd></div>}
              {info.idLast4 && <div><dt className="inline font-semibold">Owner ID: </dt><dd className="inline">ending {info.idLast4}</dd></div>}
            </dl>
            <p className="text-xs text-gray-500 mt-4">Need to change these details? Contact WiSkul support.</p>
          </div>
        ) : status === 'pending' ? (
          <div className="max-w-lg mx-auto bg-white rounded-2xl border border-blue-200 p-8 text-center" role="status">
            <Clock size={48} className="mx-auto text-[#1d4ed8] mb-3" aria-hidden="true" />
            <h2 className="text-xl font-black text-gray-900">Verification under review</h2>
            <p className="mt-3 text-sm text-gray-600">
              {info.submittedAt ? `Submitted on ${when(info.submittedAt)}. ` : ''}
              WiSkul is reviewing your details, usually within one working day. We'll notify you by email and in the app.
            </p>
            {(info.emisCode || idSummary || info.schoolLevel || info.district) && (
              <dl className="mt-5 text-sm text-gray-600 space-y-1 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-left">
                {info.emisCode && <div><dt className="inline font-semibold">EMIS code: </dt><dd className="inline">{info.emisCode}</dd></div>}
                {idSummary && <div><dt className="inline font-semibold">Owner ID: </dt><dd className="inline">{idSummary}</dd></div>}
                {info.schoolLevel && <div><dt className="inline font-semibold">School level: </dt><dd className="inline">{info.schoolLevel}</dd></div>}
                {info.district && <div><dt className="inline font-semibold">District: </dt><dd className="inline">{info.district}</dd></div>}
              </dl>
            )}
            <p className="text-xs text-gray-500 mt-4">Spotted a mistake? Contact WiSkul support and we'll help you correct it.</p>
          </div>
        ) : !isOwner ? (
          <div className="max-w-lg mx-auto bg-white rounded-2xl border border-gray-200 p-8 text-center text-sm text-gray-600">
            Only the school's account owner can verify the school.
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-6">
            {status === 'rejected' ? (
              <div role="alert" className="bg-red-50 border border-red-200 rounded-2xl p-5 flex gap-3">
                <AlertTriangle className="text-red-600 shrink-0" size={22} aria-hidden="true" />
                <div className="text-sm text-red-900 space-y-1.5">
                  <p className="font-bold">Verification not approved</p>
                  {info.lastReason && <p><span className="font-semibold">Reason from WiSkul: </span>{info.lastReason}</p>}
                  <p>Fix the details below, re-enter your ID number and submit again.</p>
                </div>
              </div>
            ) : info.lastReason ? (
              <div role="alert" className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-3">
                <AlertTriangle className="text-amber-600 shrink-0" size={22} aria-hidden="true" />
                <div className="text-sm text-amber-900 space-y-1.5">
                  <p className="font-bold">A note from WiSkul about your verification</p>
                  <p>{info.lastReason}</p>
                  <p>Check your details below and submit them again.</p>
                </div>
              </div>
            ) : null}

            {/* What this is */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex gap-3">
              <ShieldCheck className="text-[#1d4ed8] shrink-0" size={22} aria-hidden="true" />
              <div className="text-sm text-slate-700 space-y-2">
                <p className="font-bold text-slate-900">About verification</p>
                <p>
                  You give your school's EMIS code and your ID as the account owner. WiSkul's verification team reviews
                  the details, usually within one working day, and lets you know by email and in the app.
                  You'll need a verified school before changing your subscription plan.
                </p>
                <p className="font-semibold text-slate-900">What we check</p>
                <ul className="space-y-1">
                  {[
                    'The EMIS code belongs to your school, and no other school uses it.',
                    'The name on your ID matches your account name.',
                    'The school details match what MBSSE has on record.',
                    'You confirm the details are true. False details can lead to the account being suspended.',
                  ].map((t) => <li key={t} className="flex gap-2"><CheckCircle2 size={15} className="text-[#1d4ed8] shrink-0 mt-0.5" aria-hidden="true" />{t}</li>)}
                </ul>
              </div>
            </div>

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
                <div>
                  <label htmlFor="v-level" className={label}>School level <span className="font-normal text-gray-500">(optional)</span></label>
                  <select id="v-level" className={input} value={form.schoolLevel} onChange={(e) => set('schoolLevel', e.target.value)}>
                    <option value="">Select your school level</option>
                    {!levelKnown && <option value={form.schoolLevel}>{form.schoolLevel}</option>}
                    {SCHOOL_LEVEL_GROUPS.map((g) => (
                      <optgroup key={g} label={g}>
                        {SCHOOL_LEVEL_OPTIONS.filter((o) => o.group === g).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="v-district" className={label}>District <span className="font-normal text-gray-500">(optional)</span></label>
                    <select id="v-district" className={input} value={form.district} onChange={(e) => set('district', e.target.value)}>
                      <option value="">Select your district</option>
                      {!districtKnown && <option value={form.district}>{form.district}</option>}
                      {districts.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="v-year" className={label}>Year founded <span className="font-normal text-gray-500">(optional)</span></label>
                    <input id="v-year" className={input} inputMode="numeric" value={form.yearEstablished}
                      onChange={(e) => set('yearEstablished', e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} onBlur={() => touch('yearEstablished')}
                      aria-invalid={!!err('yearEstablished')} aria-describedby={err('yearEstablished') ? 'v-year-err' : undefined} placeholder="e.g. 2005" />
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
                      <option value="" disabled>Select ID type</option>
                      {(Object.keys(ID_TYPE_LABEL) as IdType[]).map((k) => <option key={k} value={k}>{ID_TYPE_LABEL[k]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="v-idnum" className={label}>{ID_TYPE_LABEL[form.idType]} number</label>
                    <input id="v-idnum" className={input} value={form.idNumber} autoComplete="off"
                      onChange={(e) => set('idNumber', e.target.value)} onBlur={() => touch('idNumber')}
                      aria-invalid={!!err('idNumber')} aria-describedby="v-idnum-hint" placeholder={ID_PLACEHOLDER[form.idType]} />
                    <p id="v-idnum-hint" className={err('idNumber') ? 'text-xs text-red-600 mt-1' : hint}>
                      {err('idNumber') || (status === 'rejected' || info.idLast4 ? `${ID_HINT[form.idType]}. Please enter it again.` : ID_HINT[form.idType])}
                    </p>
                  </div>
                </div>
                <div>
                  <label htmlFor="v-idname" className={label}>Your name as printed on the ID</label>
                  <input id="v-idname" className={input} value={form.idName} autoComplete="name"
                    onChange={(e) => set('idName', e.target.value)} aria-describedby="v-idname-hint"
                    placeholder="e.g. Aminata Kamara (as printed on your ID)" />
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

              {formError && (
                <div role="alert" className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-900">
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit || submitting}
                className="w-full inline-flex items-center justify-center gap-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-bold text-sm py-3.5 rounded-xl transition-colors disabled:opacity-50"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <ShieldCheck size={16} aria-hidden="true" />}
                {submitting ? 'Submitting…' : 'Submit for review'}
              </button>
              <p className="text-xs text-gray-500 flex items-start gap-1.5">
                <Lock size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  Your ID number is encrypted. Only WiSkul's verification team can see it, to check it against your documents;
                  your school's staff, parents and other schools never see it.
                </span>
              </p>
            </form>
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
};

export default VerificationPage;
