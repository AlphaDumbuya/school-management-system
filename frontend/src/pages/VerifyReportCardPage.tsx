/**
 * VerifyReportCardPage — /verify-report-card/:hash
 *
 * PUBLIC (no login) page reached by scanning the QR code on a printed report
 * card. The QR carries a verification hash plus student / class / year. This page
 * asks the server to check the hash against the school's records and, if it
 * matches, shows a verification certificate and the report card it vouches for.
 *
 * Designed to be read on a phone by a parent, employer or another school: a clear
 * verdict first, then who issued it, then the results.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  ShieldCheck, ShieldAlert, ShieldQuestion, GraduationCap, Award, TrendingUp, User, School, CheckCircle2,
  Printer, RefreshCw, Phone, Mail, Globe, MapPin, Lock, FileCheck2,
} from 'lucide-react';
import { verifyReportCard } from '@services/reportCardVerifyService';

type SchoolInfo = {
  name?: string; short_name?: string; logo_url?: string;
  address?: string; motto?: string; phone?: string; email?: string; website?: string;
};
type TermNums = { test1?: number; test2?: number; mean?: number; rank?: number };
type Card = {
  student?: {
    name?: string; admission_no?: string; class_name?: string; class_level?: string; photo_url?: string;
    form_teacher_name?: string; pupil_age?: number; class_average_age?: number; number_in_form?: number;
  };
  academic_year?: string;
  subjects?: { subject_name?: string; terms?: Record<string, TermNums>; yearly_mean?: number; yearly_rank?: number }[];
  yearly_summary?: {
    percentage?: number; position?: number; class_size?: number; outcome?: string;
    promotion_recommendation?: string; combined_score?: number;
  };
  term_summaries?: Record<string, {
    combined_score?: number; percentage?: number; position?: number; class_size?: number;
    conduct?: string; on_time?: number; late?: number; absent?: number;
  }>;
  meta?: { principal_comment?: string; promotion_status?: string };
};

type Failure = { kind: 'missing' | 'invalid' | 'network'; message: string };

const TERMS = ['first_term', 'second_term', 'third_term'] as const;
const TERM_LABELS: Record<string, string> = { first_term: 'Term 1', second_term: 'Term 2', third_term: 'Term 3' };
const OUTCOME_LABEL: Record<string, string> = { promoted: 'Promoted', promoted_effort: 'Promoted (needs effort)', fail: 'To repeat the class' };

const ordinal = (n?: number | null) => {
  if (n == null) return '—';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
const num = (n?: number | null) => (n == null ? '—' : n);
/** A short, readable reference taken from the verification hash, e.g. 3F9A-82C1-D07B. */
const reference = (hash?: string) => (hash ? (hash.replace(/[^a-z0-9]/gi, '').slice(0, 12).toUpperCase().match(/.{1,4}/g) || []).join('-') : '');
const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' });
};

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-slate-100 print:bg-white">
    <div className="mx-auto w-full max-w-3xl px-3 py-5 sm:px-6 sm:py-8">
      <p className="mb-3 flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 print:hidden">
        <Lock size={12} aria-hidden="true" /> Official report card verification
      </p>
      {children}
      <p className="mt-6 text-center text-[11px] text-slate-400 print:hidden">Powered by WiSkul · Secure QR verification</p>
    </div>
  </div>
);

const Skeleton: React.FC = () => (
  <Shell>
    <div role="status" aria-live="polite" aria-label="Verifying report card" className="space-y-4">
      <div className="h-40 animate-pulse rounded-2xl bg-white shadow-sm" />
      <div className="h-24 animate-pulse rounded-2xl bg-white shadow-sm" />
      <div className="h-56 animate-pulse rounded-2xl bg-white shadow-sm" />
      <p className="text-center text-sm font-medium text-slate-500">Checking this report card against the school's records…</p>
    </div>
  </Shell>
);

const Problem: React.FC<{ failure: Failure; onRetry: () => void }> = ({ failure, onRetry }) => {
  const network = failure.kind === 'network';
  const missing = failure.kind === 'missing';
  const Icon = network ? ShieldQuestion : ShieldAlert;
  return (
    <Shell>
      <div role="alert" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className={`flex items-center gap-4 px-6 py-6 ${network ? 'bg-slate-700' : 'bg-rose-700'}`}>
          <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30">
            <Icon className="text-white" size={30} aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold leading-tight text-white">
              {network ? 'Could not reach the server' : missing ? 'Incomplete verification link' : 'This report card could not be verified'}
            </h1>
            <p className="mt-0.5 text-sm text-white/80">
              {network ? 'Your connection may be down. Nothing has been checked yet.' : 'We cannot confirm that this document is genuine.'}
            </p>
          </div>
        </div>
        <div className="space-y-4 p-6">
          <p className="text-sm text-slate-700">{failure.message}</p>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-800">What to do next</p>
            <ul className="list-inside list-disc space-y-1 text-sm text-amber-900">
              {network ? (
                <li>Check your internet connection and try again.</li>
              ) : (
                <>
                  <li>Scan the QR code again, straight from the printed report card.</li>
                  <li>If it fails again, treat the document as unverified and contact the school that issued it.</li>
                </>
              )}
            </ul>
          </div>
          {network && (
            <button type="button" onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2">
              <RefreshCw size={15} aria-hidden="true" /> Try again
            </button>
          )}
        </div>
      </div>
    </Shell>
  );
};

const Stat: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; tone?: string }> = ({ icon, label, value, tone = 'text-slate-900' }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
    <div className="mx-auto mb-1.5 flex justify-center" aria-hidden="true">{icon}</div>
    <div className={`text-xl font-black leading-tight sm:text-2xl ${tone}`}>{value}</div>
    <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
  </div>
);

export default function VerifyReportCardPage() {
  const { hash } = useParams<{ hash: string }>();
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [verifiedAt, setVerifiedAt] = useState('');

  const studentId = params.get('s') || '';
  const classId = params.get('c') || '';
  const academicYear = params.get('y') || '';

  const run = useCallback(async () => {
    setLoading(true);
    setFailure(null);
    if (!hash || !studentId || !academicYear) {
      setFailure({ kind: 'missing', message: 'This link is missing some of the details that were printed in the QR code.' });
      setLoading(false);
      return;
    }
    try {
      const res = await verifyReportCard(hash, studentId, classId, academicYear);
      if (res.success && res.data?.verified) {
        setSchool(res.data.school || {});
        setCard(res.data.report_card || {});
        setVerifiedAt(res.data.verified_at);
      } else {
        const msg = (res as any)?.error?.message || (typeof (res as any)?.error === 'string' ? (res as any).error : '');
        setFailure({ kind: 'invalid', message: msg || 'The details in this QR code do not match any report card issued by the school.' });
      }
    } catch {
      setFailure({ kind: 'network', message: 'We could not connect to the verification service.' });
    } finally {
      setLoading(false);
    }
  }, [hash, studentId, classId, academicYear]);

  useEffect(() => { run(); }, [run]);

  useEffect(() => {
    const prev = document.title;
    document.title = card?.student?.name ? `Verified report card · ${card.student.name}` : 'Report card verification';
    return () => { document.title = prev; };
  }, [card?.student?.name]);

  if (loading) return <Skeleton />;
  if (failure) return <Problem failure={failure} onRetry={run} />;

  const student = card?.student;
  const ys = card?.yearly_summary;
  const terms = card?.term_summaries || {};
  const failed = ys?.outcome === 'fail';
  const contact = [
    school?.phone ? { icon: <Phone size={13} />, text: school.phone, href: `tel:${school.phone.replace(/\s/g, '')}` } : null,
    school?.email ? { icon: <Mail size={13} />, text: school.email, href: `mailto:${school.email}` } : null,
    school?.website ? { icon: <Globe size={13} />, text: school.website.replace(/^https?:\/\//, ''), href: /^https?:\/\//.test(school.website) ? school.website : `https://${school.website}` } : null,
  ].filter(Boolean) as { icon: React.ReactNode; text: string; href: string }[];

  return (
    <Shell>
      <main className="space-y-4">
        {/* 1. The verdict */}
        <section aria-labelledby="verdict" className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm print:shadow-none">
          <div className="flex items-start gap-4 bg-emerald-700 px-5 py-5 sm:px-6">
            <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30">
              <ShieldCheck className="text-white" size={30} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 id="verdict" className="text-xl font-extrabold leading-tight text-white sm:text-2xl">Report card verified</h1>
              <p className="mt-1 text-sm text-emerald-50">
                This report card is genuine and matches the records held by {school?.name || 'the school'}.
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-1 divide-y divide-slate-100 text-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="px-5 py-3 sm:px-6">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Reference</dt>
              <dd className="mt-0.5 font-mono font-bold tracking-wider text-slate-900">{reference(hash) || '—'}</dd>
            </div>
            <div className="px-5 py-3 sm:px-6">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Academic year</dt>
              <dd className="mt-0.5 font-bold text-slate-900">{card?.academic_year || academicYear || '—'}</dd>
            </div>
            <div className="px-5 py-3 sm:px-6">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Checked on</dt>
              <dd className="mt-0.5 font-bold text-slate-900">{fmtDateTime(verifiedAt) || '—'}</dd>
            </div>
          </dl>
          <ul className="grid grid-cols-3 border-t border-slate-100 bg-emerald-50/50 text-center">
            {[
              { icon: <ShieldCheck size={14} />, label: 'Authentic', sub: 'Issued by the school' },
              { icon: <FileCheck2 size={14} />, label: 'Unaltered', sub: 'Matches school records' },
              { icon: <Award size={14} />, label: 'Official', sub: 'Digitally signed' },
            ].map((t) => (
              <li key={t.label} className="px-2 py-2.5">
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-800"><span aria-hidden="true">{t.icon}</span>{t.label}</div>
                <p className="mt-0.5 text-[10px] text-slate-500">{t.sub}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* 2. Who issued it */}
        {school && (
          <section aria-label="Issuing school" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none sm:p-6">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Issued by</p>
            <div className="flex items-start gap-4">
              {school.logo_url ? (
                <img src={school.logo_url} alt={`${school.name || 'School'} logo`} className="h-16 w-16 flex-shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1" />
              ) : (
                <span className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-slate-800 text-lg font-bold text-white">
                  {school.short_name?.[0] || <School size={22} aria-hidden="true" />}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-extrabold leading-tight text-slate-900">{school.name || 'School'}</h2>
                {school.motto && <p className="text-sm italic text-slate-500">“{school.motto}”</p>}
                {school.address && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-600"><MapPin size={13} className="mt-0.5 flex-shrink-0" aria-hidden="true" />{school.address}</p>
                )}
                {contact.length > 0 && (
                  <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {contact.map((c) => (
                      <li key={c.href}><a href={c.href} className="inline-flex items-center gap-1.5 text-blue-700 hover:underline">{c.icon}{c.text}</a></li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        )}

        {/* 3. The pupil */}
        <section aria-label="Pupil" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none sm:p-6">
          <div className="flex items-start gap-4">
            {student?.photo_url ? (
              <img src={student.photo_url} alt={`Photo of ${student.name || 'the pupil'}`} className="h-24 w-24 flex-shrink-0 rounded-xl border border-slate-200 object-cover" />
            ) : (
              <span className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><User size={34} aria-hidden="true" /></span>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-extrabold leading-tight text-slate-900">{student?.name || '—'}</h2>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {[
                  ['Admission no.', student?.admission_no],
                  ['Class', student?.class_name],
                  ['Level', student?.class_level],
                  ['Pupils in class', student?.number_in_form],
                  ['Class teacher', student?.form_teacher_name],
                  ['Age', student?.pupil_age],
                ].map(([k, v]) => (
                  <div key={String(k)} className="min-w-0">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{k}</dt>
                    <dd className="truncate font-semibold text-slate-900">{v === undefined || v === null || v === '' ? '—' : String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* 4. Year result */}
        {ys && (
          <section aria-label="Result for the year" className="grid grid-cols-3 gap-3">
            <Stat icon={<TrendingUp className="text-blue-600" size={22} />} label="Overall" value={ys.percentage != null ? `${ys.percentage}%` : '—'} />
            <Stat icon={<Award className="text-amber-600" size={22} />} label="Position" value={<>{ordinal(ys.position)}<span className="text-sm font-semibold text-slate-400">{ys.class_size ? ` of ${ys.class_size}` : ''}</span></>} />
            <Stat
              icon={<GraduationCap className={failed ? 'text-rose-600' : 'text-emerald-600'} size={22} />}
              label="Outcome"
              tone={failed ? 'text-rose-700' : 'text-emerald-700'}
              value={<span className="text-base sm:text-lg">{(ys.outcome && OUTCOME_LABEL[ys.outcome]) || ys.outcome || '—'}</span>}
            />
          </section>
        )}

        {/* 5. Terms */}
        {Object.keys(terms).length > 0 && (
          <section aria-labelledby="terms-h" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none sm:p-6">
            <h2 id="terms-h" className="mb-3 text-base font-bold text-slate-900">Term by term</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {TERMS.map((t) => {
                const s = terms[t];
                return (
                  <div key={t} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{TERM_LABELS[t]}</p>
                    {s ? (
                      <>
                        <p className="mt-1 text-xl font-black text-slate-900">{s.percentage != null ? `${s.percentage}%` : '—'}</p>
                        <p className="text-xs text-slate-600">Position {ordinal(s.position)}{s.class_size ? ` of ${s.class_size}` : ''}</p>
                        <p className="mt-1.5 text-xs text-slate-500">
                          On time {s.on_time ?? 0} · Late {s.late ?? 0} · Absent {s.absent ?? 0}
                        </p>
                        {s.conduct && <p className="text-xs font-medium text-slate-700">Conduct: {s.conduct}</p>}
                      </>
                    ) : (
                      <p className="mt-2 text-sm text-slate-400">Not released</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 6. Subjects */}
        {card?.subjects && card.subjects.length > 0 && (
          <section aria-labelledby="subjects-h" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:shadow-none">
            <h2 id="subjects-h" className="border-b border-slate-200 px-5 py-3 text-base font-bold text-slate-900 sm:px-6">Subject results</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <caption className="sr-only">Test scores, term means and yearly mean for each subject</caption>
                <thead>
                  <tr className="bg-slate-50 text-xs uppercase text-slate-500">
                    <th scope="col" rowSpan={2} className="sticky left-0 z-10 bg-slate-50 px-4 py-2 text-left font-semibold">Subject</th>
                    {TERMS.map((t) => <th key={t} scope="colgroup" colSpan={3} className="border-l border-slate-200 px-2 py-2 text-center font-semibold">{TERM_LABELS[t]}</th>)}
                    <th scope="col" rowSpan={2} className="border-l border-slate-200 bg-amber-50 px-3 py-2 text-center font-semibold">Year mean</th>
                  </tr>
                  <tr className="bg-slate-50 text-[10px] uppercase text-slate-400">
                    {TERMS.map((t) => (
                      <React.Fragment key={t}>
                        <th scope="col" className="border-l border-slate-200 px-2 py-1 font-medium">Test 1</th>
                        <th scope="col" className="px-2 py-1 font-medium">Test 2</th>
                        <th scope="col" className="px-2 py-1 font-medium">Mean</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {card.subjects.map((s, i) => (
                    <tr key={i} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/40">
                      <th scope="row" className="sticky left-0 z-10 bg-inherit px-4 py-2 text-left font-semibold text-slate-900">{s.subject_name}</th>
                      {TERMS.map((t) => {
                        const n = s.terms?.[t];
                        return (
                          <React.Fragment key={t}>
                            <td className="border-l border-slate-100 px-2 py-2 text-center text-slate-600">{num(n?.test1)}</td>
                            <td className="px-2 py-2 text-center text-slate-600">{num(n?.test2)}</td>
                            <td className="px-2 py-2 text-center font-bold text-slate-900">{num(n?.mean)}</td>
                          </React.Fragment>
                        );
                      })}
                      <td className="border-l border-slate-100 bg-amber-50/50 px-3 py-2 text-center font-bold text-amber-800">
                        {num(s.yearly_mean)}
                        <span className="block text-[10px] font-normal text-slate-500">Position {ordinal(s.yearly_rank)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 7. Comments */}
        {(card?.meta?.principal_comment || card?.meta?.promotion_status || ys?.promotion_recommendation) && (
          <section aria-labelledby="comments-h" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:shadow-none sm:p-6">
            <h2 id="comments-h" className="mb-2 text-base font-bold text-slate-900">Principal's remarks</h2>
            {card?.meta?.principal_comment && <p className="text-sm italic leading-relaxed text-slate-700">“{card.meta.principal_comment}”</p>}
            {(card?.meta?.promotion_status || ys?.promotion_recommendation) && (
              <p className="mt-3 text-sm">
                <span className="font-bold text-slate-700">Promotion: </span>
                <span className={`font-bold ${failed ? 'text-rose-700' : 'text-emerald-700'}`}>{card?.meta?.promotion_status || ys?.promotion_recommendation}</span>
              </p>
            )}
          </section>
        )}

        {/* 8. About this check */}
        <section aria-label="About this verification" className="rounded-2xl border border-slate-200 bg-white p-5 text-xs leading-relaxed text-slate-600 shadow-sm print:shadow-none sm:p-6">
          <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-slate-800"><CheckCircle2 size={15} className="text-emerald-600" aria-hidden="true" /> How this check works</p>
          <p>
            The QR code on a printed report card holds a secret fingerprint of that exact document. We compared it with the school's records at the time shown above.
            The results on this page come from the school's records, not from the paper. If the paper shows different results, the paper has been altered.
          </p>
          <p className="mt-2">Questions about this report card? Contact {school?.name || 'the school'} using the details above, quoting reference <span className="font-mono font-semibold">{reference(hash)}</span>.</p>
          <button type="button" onClick={() => window.print()}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 print:hidden">
            <Printer size={14} aria-hidden="true" /> Print this verification
          </button>
        </section>
      </main>
    </Shell>
  );
}
