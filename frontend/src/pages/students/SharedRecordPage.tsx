/**
 * SharedRecordPage: /update-record/school/:token (public, no login)
 * The one link the school posts in the parents' WhatsApp group. Parents first read why the school is asking, then choose:
 *
 *   1. "My child is already at the school": CHECK. The parent gives the child's name, date of birth and a phone number or
 *      email the school holds. Only when all three match is the record shown, so they can confirm it or correct it. A
 *      wrong or partial answer gets one reply whatever the reason, so the check cannot be used to find out who is
 *      enrolled. A mismatch offers: try again, send the details for the school to match, or register the child.
 *   2. "My child is not registered yet": REGISTER, through the school's own admission form.
 *   3. Send details for the school to match: the blind form (shows nothing the school holds; the school matches it).
 *
 * What the check shows is never stored on the phone (no draft); only the blind form keeps a draft.
 */
import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Camera, Loader2, Search, UserPlus, ArrowLeft, ShieldCheck, FileText } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { studentRecordsService, recordsError, RecordsApiError, SharedForm, RecordValues, CheckResult } from '@services/studentRecordsService';
import { RecordFields, validateRecord, validateField } from './components/RecordFields';
import { RecordBackdrop } from './components/RecordBackdrop';
import { WelcomePanel } from './components/WelcomePanel';
import { loadDraft, saveDraft, clearDraft } from './components/recordDraft';

const INPUT = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-gray-600 dark:bg-gray-800 dark:text-white sm:text-sm';
const CARD = 'rounded-3xl bg-white p-6 text-gray-800 shadow-xl dark:bg-gray-900 dark:text-gray-200 sm:p-8';
interface Draft { first: string; last: string; classId: string; values: RecordValues }
type Step = 'welcome' | 'choose' | 'check' | 'notfound' | 'verified' | 'blind' | 'sent';
type Verified = Extract<CheckResult, { verified: true }>;
const today = () => new Date().toISOString().slice(0, 10);

const FieldError: React.FC<{ id: string; msg?: string }> = ({ id, msg }) =>
  msg ? <p id={id} role="alert" className="mt-1 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{msg}</p> : null;

const BackButton: React.FC<{ onClick: () => void; label?: string }> = ({ onClick, label = 'Back' }) => (
  <button type="button" onClick={onClick} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white/90 hover:text-white">
    <ArrowLeft size={16} aria-hidden="true" /> {label}
  </button>
);

const SharedRecordPage: React.FC = () => {
  const { token = '' } = useParams<{ token: string }>();
  const draftKey = `shared:${token}`;
  const [form, setForm] = useState<SharedForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('welcome');
  const [hasDraft, setHasDraft] = useState(false);

  // who the parent is asking about (shared by the check and the blind form)
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [dob, setDob] = useState('');
  const [contact, setContact] = useState('');
  const [classId, setClassId] = useState('');
  const [values, setValues] = useState<RecordValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [whoErrors, setWhoErrors] = useState<{ first?: string; last?: string; dob?: string; contact?: string; class?: string }>({});
  const [honeypot, setHoneypot] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [verified, setVerified] = useState<Verified | null>(null);
  const [sent, setSent] = useState<{ name: string; reference: string; confirmedOnly: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    const d = loadDraft<Draft>(draftKey);
    if (d) { setFirst(d.first || ''); setLast(d.last || ''); setClassId(d.classId || ''); setValues(d.values || {}); setHasDraft(true); }
    studentRecordsService.openShared(token)
      .then((r) => { if (alive && r.data) setForm(r.data); })
      .catch((e) => { if (alive) setError(recordsError(e, 'This link is not valid.')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [token, draftKey]);

  // The blind form keeps what was typed on this phone, so a dropped connection or a reload does not lose it.
  // (The checked record is NEVER saved here: it holds the school's data about the child.)
  useEffect(() => {
    if (step !== 'blind') return;
    saveDraft(draftKey, { first, last, classId, values } satisfies Draft);
  }, [step, first, last, classId, values, draftKey]);

  const go = (s: Step) => { setStep(s); setFormError(''); window.scrollTo({ top: 0 }); };
  const school = form?.school;
  const applyUrl = school?.slug ? `/apply/${encodeURIComponent(school.slug)}` : '';
  const contactInfo = form?.contact;

  // ── 1. check ─────────────────────────────────────────────────────────────────────────────────────────
  const runCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    const w: typeof whoErrors = {};
    if (first.trim().length < 2) w.first = "Enter the child's first name.";
    if (last.trim().length < 2) w.last = "Enter the child's last name.";
    if (!dob) w.dob = "Enter the child's date of birth.";
    else if (dob > today()) w.dob = 'The date of birth cannot be in the future.';
    const c = contact.trim();
    if (!c) w.contact = 'Enter the phone number or email address you gave the school when you registered your child.';
    else if (c.includes('@') ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) : c.replace(/\D/g, '').length < 7) w.contact = 'Enter a valid phone number or email address.';
    setWhoErrors(w);
    if (Object.keys(w).length) {
      setFormError('Please correct the highlighted fields.');
      document.getElementById(w.first ? 'ck-first' : w.last ? 'ck-last' : w.dob ? 'ck-dob' : 'ck-contact')?.focus();
      return;
    }
    setFormError('');
    setBusy(true);
    try {
      const r = await studentRecordsService.checkShared(token, { child_first_name: first.trim(), child_last_name: last.trim(), date_of_birth: dob, contact: c, website: honeypot });
      const data = r.data;
      if (data && data.verified) {
        setVerified(data);
        setValues(data.values);
        setErrors({});
        go('verified');
      } else {
        go('notfound');
      }
    } catch (err) {
      setFormError(recordsError(err));
    } finally {
      setBusy(false);
    }
  };

  // ── 2. confirm / correct the checked record ──────────────────────────────────────────────────────────
  const confirmChecked = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verified) return;
    const found = validateRecord(verified.fields, values);
    setErrors(found);
    const count = Object.keys(found).length;
    if (count) {
      setFormError(count === 1 ? 'Please correct the highlighted field below.' : `Please correct the ${count} highlighted fields below.`);
      document.getElementById(`vf-${verified.fields.find((f) => found[f.key])?.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setFormError('');
    setBusy(true);
    try {
      const r = await studentRecordsService.submitVerified(token, verified.session, values, honeypot);
      setSent({ name: `${verified.student.first_name} ${verified.student.last_name}`, reference: r.data?.reference || '', confirmedOnly: (r.data?.changed ?? 0) === 0 });
      setVerified(null);
      setValues({});
      go('sent');
    } catch (err) {
      if (err instanceof RecordsApiError && err.code === 'VERIFY_EXPIRED') {
        setVerified(null);
        setValues({});
        setFormError('For your child\'s privacy the check lasts 30 minutes and it has expired. Please check again.');
        go('check');
      } else {
        setFormError(recordsError(err));
      }
    } finally {
      setBusy(false);
    }
  };

  // ── 3. the blind form (the school matches it to a student) ───────────────────────────────────────────
  const submitBlind = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const who: typeof whoErrors = {};
    if (first.trim().length < 2) who.first = "Enter the child's first name. The school uses it to find your child's record.";
    if (last.trim().length < 2) who.last = "Enter the child's last name. The school uses it to find your child's record.";
    if (form.classes.length > 0 && !classId) who.class = "Select your child's current class, so the school can find the right record.";
    const found = validateRecord(form.fields, values);
    setWhoErrors(who);
    setErrors(found);
    const count = Object.keys(who).length + Object.keys(found).length;
    if (count) {
      setFormError(count === 1 ? 'Please correct the highlighted field below.' : `Please correct the ${count} highlighted fields below.`);
      const firstId = who.first ? 'sh-first' : who.last ? 'sh-last' : who.class ? 'sh-class' : `sh-${form.fields.find((f) => found[f.key])?.key}`;
      const el = document.getElementById(firstId);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus({ preventScroll: true });
      return;
    }
    setFormError('');
    setBusy(true);
    try {
      const r = await studentRecordsService.submitShared(token, { child_first_name: first.trim(), child_last_name: last.trim(), class_id: classId || undefined, values, website: honeypot });
      clearDraft(draftKey);
      setHasDraft(false);
      setSent({ name: `${first.trim()} ${last.trim()}`, reference: r.data?.reference || '', confirmedOnly: false });
      go('sent');
    } catch (err) {
      setFormError(recordsError(err));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setSent(null); setVerified(null); setFirst(''); setLast(''); setDob(''); setContact(''); setClassId(''); setValues({});
    setErrors({}); setWhoErrors({}); setFormError(''); go('choose');
  };

  const Header = () => !school ? null : (
    <header className="mb-6 text-center">
      {school.logo_url && (
        <img src={school.logo_url} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          className="mx-auto mb-3 h-16 w-16 rounded-xl bg-white object-contain p-1 shadow-md" />
      )}
      <h1 className="text-xl font-black text-white sm:text-2xl">{school.name}</h1>
    </header>
  );

  const Contact = () => (contactInfo?.phone || contactInfo?.email) ? (
    <p className="mt-5 text-xs text-gray-500">Questions? Contact the school{contactInfo.phone ? `: ${contactInfo.phone}` : ''}{contactInfo.email ? ` · ${contactInfo.email}` : ''}</p>
  ) : null;

  const RegisterButton: React.FC<{ className?: string }> = ({ className = '' }) => applyUrl ? (
    <a href={applyUrl} className={`inline-flex items-center justify-center gap-2 rounded-xl bg-primary-700 px-5 py-3 text-sm font-bold text-white shadow hover:bg-primary-800 ${className}`}>
      <UserPlus size={16} aria-hidden="true" /> Register my child
    </a>
  ) : (
    <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">The school's online registration is not open. Please contact the school to register your child.</p>
  );

  return (
    <RecordBackdrop color={school?.brand_color}>
      <div className="mx-auto max-w-2xl">
        {loading && <div className="flex justify-center py-24"><Loader2 className="animate-spin text-white/70" aria-label="Loading" /></div>}

        {!loading && error && (
          <div role="alert" className="rounded-2xl bg-white p-8 text-center text-gray-800 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-700">
            <AlertCircle className="mx-auto text-amber-500" size={36} aria-hidden="true" />
            <h1 className="mt-3 text-xl font-bold text-gray-900 dark:text-white">We cannot open this form</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-300">{error}</p>
          </div>
        )}

        {!loading && form && (
          <>
            <Header />

            {/* welcome */}
            {step === 'welcome' && <WelcomePanel school={form.school.name} message={form.welcome} hasDraft={hasDraft} onStart={() => go('choose')} />}

            {/* choose */}
            {step === 'choose' && (
              <section aria-labelledby="choose-title" className="space-y-4">
                <h2 id="choose-title" className="text-center text-lg font-bold text-white">What would you like to do?</h2>
                <button type="button" onClick={() => go('check')}
                  className="group flex w-full items-start gap-4 rounded-2xl bg-white p-5 text-left shadow-lg transition hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-white/40">
                  <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700"><Search size={22} aria-hidden="true" /></span>
                  <span>
                    <span className="block text-base font-bold text-gray-900">My child is already at the school</span>
                    <span className="mt-1 block text-sm text-gray-600">Check that your child is registered, then confirm or correct their details.</span>
                  </span>
                </button>
                <div className="flex w-full items-start gap-4 rounded-2xl bg-white p-5 shadow-lg">
                  <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700"><UserPlus size={22} aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-bold text-gray-900">My child is not registered yet</span>
                    <span className="mt-1 block text-sm text-gray-600">Fill in the school's admission form to register your child.</span>
                    <span className="mt-3 block"><RegisterButton /></span>
                  </span>
                </div>
                <p className="text-center text-sm text-white/80">
                  Not sure? <button type="button" onClick={() => go('blind')} className="font-semibold underline underline-offset-2 hover:text-white">Send your child's details and the school will find the record.</button>
                </p>
              </section>
            )}

            {/* check */}
            {step === 'check' && (
              <>
                <BackButton onClick={() => go('choose')} />
                <form onSubmit={runCheck} noValidate className={`${CARD} space-y-5`}>
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 flex-shrink-0 text-primary-700" size={24} aria-hidden="true" />
                    <div>
                      <h2 className="text-lg font-bold text-gray-900 dark:text-white">Check your child's registration</h2>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        To protect your child's privacy, we need three things the school already has. Only then do we show the record.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="ck-first" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Child's first name <span className="text-red-600" aria-hidden="true">*</span></label>
                      <input id="ck-first" value={first} placeholder="e.g. Aminata" maxLength={100} autoComplete="off" aria-invalid={whoErrors.first ? true : undefined}
                        onChange={(e) => { setFirst(e.target.value); if (whoErrors.first) setWhoErrors((n) => ({ ...n, first: undefined })); }} className={`${INPUT} ${whoErrors.first ? '!border-red-500' : ''}`} />
                      <FieldError id="ck-first-err" msg={whoErrors.first} />
                    </div>
                    <div>
                      <label htmlFor="ck-last" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Child's last name <span className="text-red-600" aria-hidden="true">*</span></label>
                      <input id="ck-last" value={last} placeholder="e.g. Kamara" maxLength={100} autoComplete="off" aria-invalid={whoErrors.last ? true : undefined}
                        onChange={(e) => { setLast(e.target.value); if (whoErrors.last) setWhoErrors((n) => ({ ...n, last: undefined })); }} className={`${INPUT} ${whoErrors.last ? '!border-red-500' : ''}`} />
                      <FieldError id="ck-last-err" msg={whoErrors.last} />
                    </div>
                    <div>
                      <label htmlFor="ck-dob" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Child's date of birth <span className="text-red-600" aria-hidden="true">*</span></label>
                      <input id="ck-dob" type="date" value={dob} max={today()} min="1985-01-01" aria-invalid={whoErrors.dob ? true : undefined}
                        onChange={(e) => { setDob(e.target.value); if (whoErrors.dob) setWhoErrors((n) => ({ ...n, dob: undefined })); }} className={`${INPUT} ${whoErrors.dob ? '!border-red-500' : ''}`} />
                      <FieldError id="ck-dob-err" msg={whoErrors.dob} />
                    </div>
                    <div>
                      <label htmlFor="ck-contact" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Your phone number or email <span className="text-red-600" aria-hidden="true">*</span></label>
                      <input id="ck-contact" value={contact} placeholder="The one you gave the school" maxLength={255} autoComplete="off" inputMode="email" aria-invalid={whoErrors.contact ? true : undefined}
                        onChange={(e) => { setContact(e.target.value); if (whoErrors.contact) setWhoErrors((n) => ({ ...n, contact: undefined })); }} className={`${INPUT} ${whoErrors.contact ? '!border-red-500' : ''}`} />
                      <FieldError id="ck-contact-err" msg={whoErrors.contact} />
                    </div>
                  </div>
                  <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} className="absolute left-[-9999px] h-0 w-0 opacity-0" name="website" />
                  {formError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">{formError}</p>}
                  <button type="submit" disabled={busy}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-700 px-6 py-3.5 text-base font-bold text-white shadow-lg transition hover:bg-primary-800 disabled:opacity-60">
                    {busy && <Loader2 size={18} className="animate-spin" aria-hidden="true" />} {busy ? 'Checking…' : 'Check registration'}
                  </button>
                </form>
              </>
            )}

            {/* not found */}
            {step === 'notfound' && (
              <div role="status" className={`${CARD} text-center`}>
                <AlertCircle className="mx-auto text-amber-500" size={40} aria-hidden="true" />
                <h2 className="mt-3 text-xl font-bold text-gray-900 dark:text-white">We could not match this child</h2>
                <p className="mt-2 text-gray-600 dark:text-gray-300">
                  Please check the spelling of the name, the date of birth, and that the phone number or email is the one you gave the school.
                  For privacy, we do not say which detail was different.
                </p>
                <div className="mt-6 grid gap-3">
                  <button type="button" onClick={() => go('check')} className="rounded-xl bg-primary-700 px-5 py-3 text-sm font-bold text-white shadow hover:bg-primary-800">Try again</button>
                  <button type="button" onClick={() => go('blind')} className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100">
                    <FileText size={16} className="mr-2 inline" aria-hidden="true" />Send details for the school to find the record
                  </button>
                  <RegisterButton className="w-full" />
                </div>
                <Contact />
              </div>
            )}

            {/* verified: confirm or correct */}
            {step === 'verified' && verified && (
              <>
                <BackButton onClick={() => { setVerified(null); setValues({}); go('check'); }} label="Check a different child" />
                <form onSubmit={confirmChecked} noValidate className="space-y-6">
                  <div role="status" className="flex items-start gap-3 rounded-2xl bg-white p-5 shadow-lg">
                    <CheckCircle2 className="mt-0.5 flex-shrink-0 text-emerald-600" size={28} aria-hidden="true" />
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">{verified.student.first_name} {verified.student.last_name} is registered</h2>
                      <p className="text-sm text-gray-600">
                        {verified.student.class_name ? `Class: ${verified.student.class_name}. ` : ''}
                        {verified.missing.length
                          ? `${verified.missing.length} required detail${verified.missing.length === 1 ? ' is' : 's are'} missing. Please complete ${verified.missing.length === 1 ? 'it' : 'them'} below.`
                          : 'Please check the details below. If everything is correct, confirm. If not, correct it and send.'}
                      </p>
                    </div>
                  </div>
                  <RecordFields fields={verified.fields} values={values} idPrefix="vf" errors={errors} missing={verified.missing}
                    onChange={(k, v) => { setValues((s) => ({ ...s, [k]: v })); setErrors((e) => { if (!e[k]) return e; const n = { ...e }; delete n[k]; return n; }); }}
                    onBlur={(k) => {
                      const f = verified.fields.find((x) => x.key === k);
                      if (!f) return;
                      const msg = validateField(f, values[k]);
                      setErrors((e) => { const n = { ...e }; if (msg) n[k] = msg; else delete n[k]; return n; });
                    }} />
                  {verified.photo_note && (
                    <p className="flex items-center gap-2 rounded-xl bg-white/95 p-4 text-sm text-gray-700 shadow">
                      <Camera size={18} aria-hidden="true" className="flex-shrink-0 text-gray-500" /> {verified.photo_note}
                    </p>
                  )}
                  <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} className="absolute left-[-9999px] h-0 w-0 opacity-0" name="website" />
                  {formError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">{formError}</p>}
                  <button type="submit" disabled={busy}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-base font-bold text-primary-800 shadow-lg transition hover:bg-gray-100 disabled:opacity-60">
                    {busy && <Loader2 size={18} className="animate-spin" aria-hidden="true" />} {busy ? 'Sending…' : 'Confirm and send'}
                  </button>
                  <p className="text-center text-xs text-white/70">If you changed anything, the school checks it before the record is updated.</p>
                </form>
              </>
            )}

            {/* blind form */}
            {step === 'blind' && (
              <>
                <BackButton onClick={() => go('choose')} />
                <form onSubmit={submitBlind} noValidate className="space-y-6">
                  <p className="rounded-xl bg-white/95 p-4 text-sm text-primary-900 shadow">
                    Please fill in one form for each child. Write the child's name as the school knows it. Fields marked <span className="font-bold text-red-600">*</span> are needed.
                    {hasDraft && ' We kept what you typed earlier on this phone.'}
                  </p>
                  <fieldset className="rounded-2xl border border-gray-200 bg-white p-4 text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 sm:p-5">
                    <legend className="rounded bg-white px-2 text-sm font-bold text-gray-900 dark:bg-gray-900 dark:text-white">Which child?</legend>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="sh-first" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Child's first name <span className="text-red-600" aria-hidden="true">*</span></label>
                        <input id="sh-first" placeholder="e.g. Aminata" value={first} aria-invalid={whoErrors.first ? true : undefined}
                          onChange={(e) => { setFirst(e.target.value); if (whoErrors.first) setWhoErrors((n) => ({ ...n, first: undefined })); }} maxLength={100} autoComplete="off" className={`${INPUT} ${whoErrors.first ? '!border-red-500' : ''}`} />
                        <FieldError id="sh-first-err" msg={whoErrors.first} />
                      </div>
                      <div>
                        <label htmlFor="sh-last" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Child's last name <span className="text-red-600" aria-hidden="true">*</span></label>
                        <input id="sh-last" placeholder="e.g. Kamara" value={last} aria-invalid={whoErrors.last ? true : undefined}
                          onChange={(e) => { setLast(e.target.value); if (whoErrors.last) setWhoErrors((n) => ({ ...n, last: undefined })); }} maxLength={100} autoComplete="off" className={`${INPUT} ${whoErrors.last ? '!border-red-500' : ''}`} />
                        <FieldError id="sh-last-err" msg={whoErrors.last} />
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="sh-class" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Child's current class{form.classes.length > 0 && <span className="text-red-600" aria-hidden="true"> *</span>}</label>
                        <select id="sh-class" value={classId} aria-invalid={whoErrors.class ? true : undefined}
                          onChange={(e) => { setClassId(e.target.value); if (whoErrors.class) setWhoErrors((n) => ({ ...n, class: undefined })); }} className={`${INPUT} ${whoErrors.class ? '!border-red-500' : ''}`}>
                          <option value="">Select your child's current class…</option>
                          {form.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <FieldError id="sh-class-err" msg={whoErrors.class} />
                      </div>
                    </div>
                  </fieldset>
                  <RecordFields fields={form.fields} values={values} idPrefix="sh" errors={errors}
                    onChange={(k, v) => { setValues((s) => ({ ...s, [k]: v })); setErrors((e) => { if (!e[k]) return e; const n = { ...e }; delete n[k]; return n; }); }}
                    onBlur={(k) => {
                      const f = form.fields.find((x) => x.key === k);
                      if (!f) return;
                      const msg = validateField(f, values[k]);
                      setErrors((e) => { const n = { ...e }; if (msg) n[k] = msg; else delete n[k]; return n; });
                    }} />
                  <p className="flex items-center gap-2 rounded-xl bg-white/95 p-4 text-sm text-gray-700 shadow">
                    <Camera size={18} aria-hidden="true" className="flex-shrink-0 text-gray-500" /> The school will take your child's photo at school.
                  </p>
                  <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} className="absolute left-[-9999px] h-0 w-0 opacity-0" name="website" />
                  {formError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">{formError}</p>}
                  <button type="submit" disabled={busy}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-base font-bold text-primary-800 shadow-lg transition hover:bg-gray-100 disabled:opacity-60">
                    {busy && <Loader2 size={18} className="animate-spin" aria-hidden="true" />} {busy ? 'Submitting…' : 'Submit'}
                  </button>
                  <p className="text-center text-xs text-white/70">Your details go only to the school and are used for your child's school record.</p>
                </form>
              </>
            )}

            {/* sent */}
            {step === 'sent' && sent && (
              <div role="status" className={`${CARD} text-center`}>
                <CheckCircle2 className="mx-auto text-emerald-600" size={40} aria-hidden="true" />
                <h2 className="mt-3 text-xl font-bold text-gray-900 dark:text-white">Thank you</h2>
                <p className="mt-2 text-gray-600 dark:text-gray-300">
                  {sent.confirmedOnly
                    ? `You confirmed the details for ${sent.name}. The school's record is up to date.`
                    : `The school has received the details for ${sent.name} and will check them. You do not need to do anything else.`}
                </p>
                {sent.reference && <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">Your reference: <span className="rounded bg-gray-100 px-2 py-1 font-mono font-bold tracking-wider text-gray-900 dark:bg-gray-800 dark:text-white">{sent.reference}</span></p>}
                <button type="button" onClick={reset} className="mt-5 rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100">
                  Do this for another child
                </button>
                <Contact />
              </div>
            )}
          </>
        )}
      </div>
    </RecordBackdrop>
  );
};
export default SharedRecordPage;
