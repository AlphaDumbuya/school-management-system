/**
 * UpdateRecordPage: /update-record/:token (public, no login)
 * A parent opens the personal link the school sent. They first read why the school is asking (the move to a digital
 * system), then see what the school holds for their child, fill in what is missing and send it. The officer reviews
 * it before anything changes. The photo is taken at school.
 */
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Camera, Loader2 } from 'lucide-react';
import { studentRecordsService, recordsError, PublicRecordForm, RecordValues } from '@services/studentRecordsService';
import { RecordFields, validateRecord, validateField } from './components/RecordFields';
import { RecordBackdrop } from './components/RecordBackdrop';
import { WelcomePanel } from './components/WelcomePanel';
import { loadDraft, saveDraft, clearDraft } from './components/recordDraft';

const UpdateRecordPage: React.FC = () => {
  const { token = '' } = useParams<{ token: string }>();
  const draftKey = `personal:${token}`;
  const [form, setForm] = useState<PublicRecordForm | null>(null);
  const [values, setValues] = useState<RecordValues>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ changed: number; reference: string } | null>(null);
  const [formError, setFormError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState('');

  useEffect(() => {
    let alive = true;
    studentRecordsService.open(token)
      .then((r) => {
        if (!alive || !r.success || !r.data) return;
        const draft = loadDraft<{ values: RecordValues }>(draftKey);
        setForm(r.data);
        setValues(draft?.values ? { ...r.data.values, ...draft.values } : r.data.values);
        setHasDraft(!!draft);
      })
      .catch((e) => { if (alive) setError(recordsError(e, 'This link is not valid.')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [token, draftKey]);

  // Keep what was typed on this phone, so a dropped connection or a reload does not lose it.
  useEffect(() => {
    if (!started || done) return;
    saveDraft(draftKey, { values });
  }, [started, done, values, draftKey]);

  const start = () => { setStarted(true); window.scrollTo({ top: 0 }); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const found = validateRecord(form.fields, values);
    setErrors(found);
    const count = Object.keys(found).length;
    if (count) {
      setFormError(count === 1 ? 'Please correct the highlighted field below.' : `Please correct the ${count} highlighted fields below.`);
      const firstBad = form.fields.find((f) => found[f.key]);
      const el = firstBad ? document.getElementById(`p-${firstBad.key}`) : null;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus({ preventScroll: true });
      return;
    }
    setFormError('');
    setSending(true);
    try {
      const r = await studentRecordsService.submit(token, values, honeypot);
      clearDraft(draftKey);
      setDone({ changed: r.data?.changed ?? 0, reference: r.data?.reference || '' });
      window.scrollTo({ top: 0 });
    } catch (err) {
      setFormError(recordsError(err));
    } finally {
      setSending(false);
    }
  };

  const child = form ? `${form.student.first_name} ${form.student.last_name}` : '';
  const contact = form?.contact;
  return (
    <RecordBackdrop color={form?.school.brand_color}>
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
            <header className="mb-6 text-center">
              {form.school.logo_url && (
                <img src={form.school.logo_url} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  className="mx-auto mb-3 h-16 w-16 rounded-xl bg-white object-contain p-1 shadow-md" />
              )}
              <h1 className="text-xl font-black text-white sm:text-2xl">{form.school.name}</h1>
              {started && !done && (
                <p className="mt-1 text-white/80">Student record for <strong>{child}</strong>{form.student.class_name ? ` · ${form.student.class_name}` : ''}</p>
              )}
            </header>

            {done ? (
              <div role="status" className="rounded-3xl bg-white p-8 text-center text-gray-800 shadow-xl dark:bg-gray-900 dark:text-gray-200">
                <CheckCircle2 className="mx-auto text-emerald-600" size={40} aria-hidden="true" />
                <h2 className="mt-3 text-xl font-bold text-gray-900 dark:text-white">Thank you</h2>
                <p className="mt-2 text-gray-600 dark:text-gray-300">
                  {done.changed > 0
                    ? 'The school has received your details and will check them. You do not need to do anything else.'
                    : 'Thank you for confirming that the record is correct.'}
                </p>
                {done.reference && <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">Your reference: <span className="rounded bg-gray-100 px-2 py-1 font-mono font-bold tracking-wider text-gray-900 dark:bg-gray-800 dark:text-white">{done.reference}</span></p>}
                <p className="mt-4 text-xs text-gray-500">You can open this link again until it expires if you need to correct something.</p>
                {(contact?.phone || contact?.email) && <p className="mt-3 text-xs text-gray-500">Questions? Contact the school{contact.phone ? `: ${contact.phone}` : ''}{contact.email ? ` · ${contact.email}` : ''}</p>}
              </div>
            ) : !started ? (
              <WelcomePanel school={form.school.name} message={form.welcome} hasDraft={hasDraft} onStart={start}
                title={`Update ${form.student.first_name}’s school record`} />
            ) : (
              <form onSubmit={submit} noValidate className="space-y-6">
                <p className="rounded-xl bg-white/95 p-4 text-sm text-primary-900 shadow">
                  This is what the school has for {form.student.first_name}. Please complete anything that is empty and correct anything that is wrong.
                  Fields marked <span className="font-bold text-red-600">*</span> are needed.
                  {hasDraft && ' We kept what you typed earlier on this phone.'}
                </p>
                <RecordFields fields={form.fields} values={values} idPrefix="p" errors={errors}
                  onChange={(k, v) => { setValues((s) => ({ ...s, [k]: v })); setErrors((e) => { if (!e[k]) return e; const n = { ...e }; delete n[k]; return n; }); }}
                  onBlur={(k) => {
                    const f = form.fields.find((x) => x.key === k);
                    if (!f) return;
                    const msg = validateField(f, values[k]);
                    setErrors((e) => { const n = { ...e }; if (msg) n[k] = msg; else delete n[k]; return n; });
                  }} />
                {form.photo_note && (
                  <p className="flex items-center gap-2 rounded-xl bg-white/95 p-4 text-sm text-gray-700 shadow">
                    <Camera size={18} aria-hidden="true" className="flex-shrink-0 text-gray-500" /> {form.photo_note}
                  </p>
                )}
                <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={honeypot} onChange={(e) => setHoneypot(e.target.value)}
                  className="absolute left-[-9999px] h-0 w-0 opacity-0" name="website" />
                {formError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">{formError}</p>}
                <button type="submit" disabled={sending}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-base font-bold text-primary-800 shadow-lg transition hover:bg-gray-100 disabled:opacity-60">
                  {sending && <Loader2 size={18} className="animate-spin" aria-hidden="true" />} {sending ? 'Submitting…' : 'Submit'}
                </button>
                <p className="text-center text-xs text-white/70">Your details go only to the school and are used for your child's school record.</p>
              </form>
            )}
          </>
        )}
      </div>
    </RecordBackdrop>
  );
};
export default UpdateRecordPage;
