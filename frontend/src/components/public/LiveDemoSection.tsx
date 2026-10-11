/**
 * "Book a live demo": the visitor leaves their details and gets personal
 * one-click links into every portal of WiSkul Demo Academy by email
 * (sample data, read-only). The super admin sees each request under
 * Platform → Demo requests.
 */
import React, { useState } from 'react';
import { Briefcase, GraduationCap, Users, User, Wallet, ClipboardList, CheckCircle2, Mail, Loader2, ArrowRight } from 'lucide-react';
import { DEMO_PORTALS } from '@lib/demo';
import demoService, { DEMO_ROLES, DEMO_STUDENT_COUNTS } from '@services/demoService';

const ICONS: Record<string, React.ElementType> = {
  principal: Briefcase, teacher: Users, student: GraduationCap, parent: User, bursar: Wallet, admissions: ClipboardList,
};

const input = 'w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1d4ed8] focus:outline-none focus:ring-2 focus:ring-blue-100';
const label = 'block text-xs font-semibold text-slate-700 mb-1.5';

export const LiveDemoSection: React.FC = () => {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', school_name: '', role: '', student_count: '', consent_followup: false, website: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.role) { setError('Choose your role.'); return; }
    setBusy(true);
    try {
      const res: any = await demoService.request({ ...form, student_count: form.student_count || undefined });
      if (res?.success) setSentTo(form.email.trim());
      else setError(typeof res?.error === 'string' ? res.error : res?.error?.message || res?.message || 'Something went wrong. Please try again.');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="demo" aria-labelledby="demo-title" className="px-4 sm:px-10 py-16 sm:py-24 bg-white border-y border-[#e5e9f2] scroll-mt-20">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12 items-start">
        {/* Pitch */}
        <div className="lg:col-span-2 min-w-0">
          <p className="text-xs font-bold tracking-[0.2em] uppercase mb-2 text-[#1d4ed8]">Live demo</p>
          <h2 id="demo-title" className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900">See WiSkul run a real school</h2>
          <div className="w-12 h-1 bg-[#f59e0b] rounded-full mt-4" />
          <p className="text-sm sm:text-base mt-4 text-slate-600 leading-relaxed">
            Explore WiSkul Demo Academy: 72 students, 6 classes and a full term of attendance, results, fees,
            payroll and admissions. Tell us a little about you and we'll email your personal demo links straight away.
          </p>
          <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
            {DEMO_PORTALS.map((p) => {
              const Icon = ICONS[p.key] || User;
              return (
                <li key={p.key} className="flex items-start gap-3 rounded-xl border border-[#e5e9f2] bg-[#f8faff] px-3.5 py-3">
                  <span className="w-9 h-9 rounded-lg bg-[#1a2b6b] text-white flex items-center justify-center shrink-0"><Icon size={17} aria-hidden="true" /></span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-900">{p.portal} portal</span>
                    <span className="block text-xs text-slate-500 leading-snug">{p.blurb}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Form */}
        <div className="lg:col-span-3 min-w-0">
          <div className="rounded-2xl border border-[#e5e9f2] bg-white shadow-xl shadow-blue-900/5 p-5 sm:p-8">
            {sentTo ? (
              <div className="text-center py-6 sm:py-10" role="status">
                <CheckCircle2 size={48} className="mx-auto text-emerald-500" aria-hidden="true" />
                <h3 className="mt-4 text-xl sm:text-2xl font-black text-slate-900">Check your inbox</h3>
                <p className="mt-2 text-sm text-slate-600 break-words">
                  We've sent your demo links to <strong className="text-slate-900">{sentTo}</strong>. Open the email and pick a portal; you're signed in with one click.
                </p>
                <p className="mt-3 text-xs text-slate-500">Nothing there after a few minutes? Check your spam or promotions folder.</p>
                <button type="button" onClick={() => { setSentTo(null); setForm((f) => ({ ...f, email: '' })); }} className="mt-6 text-sm font-semibold text-[#1d4ed8] hover:underline">
                  Use a different email
                </button>
              </div>
            ) : (
              <form onSubmit={submit} noValidate={false} className="space-y-4">
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900">Get your demo access</h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">Free. Takes under a minute. Your links arrive by email.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="min-w-0">
                    <label htmlFor="demo-name" className={label}>Full name</label>
                    <input id="demo-name" required autoComplete="name" value={form.full_name} onChange={set('full_name')} className={input} placeholder="e.g. Fatmata Sesay" />
                  </div>
                  <div className="min-w-0">
                    <label htmlFor="demo-email" className={label}>Email</label>
                    <input id="demo-email" type="email" required autoComplete="email" value={form.email} onChange={set('email')} className={input} placeholder="you@school.edu.sl" />
                  </div>
                  <div className="min-w-0">
                    <label htmlFor="demo-phone" className={label}>Phone / WhatsApp</label>
                    <input id="demo-phone" type="tel" required autoComplete="tel" value={form.phone} onChange={set('phone')} className={input} placeholder="+232 76 123 456" />
                  </div>
                  <div className="min-w-0">
                    <label htmlFor="demo-school" className={label}>School name</label>
                    <input id="demo-school" required autoComplete="organization" value={form.school_name} onChange={set('school_name')} className={input} placeholder="e.g. Hill View Secondary School" />
                  </div>
                  <div className="min-w-0">
                    <label htmlFor="demo-role" className={label}>Your role</label>
                    <select id="demo-role" required value={form.role} onChange={set('role')} className={input}>
                      <option value="">Choose…</option>
                      {DEMO_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <div className="min-w-0">
                    <label htmlFor="demo-size" className={label}>Number of students <span className="font-normal text-slate-400">(optional)</span></label>
                    <select id="demo-size" value={form.student_count} onChange={set('student_count')} className={input}>
                      <option value="">Choose…</option>
                      {DEMO_STUDENT_COUNTS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                {/* Honeypot: hidden from people, filled by bots. */}
                <div aria-hidden="true" className="absolute -left-[10000px] w-px h-px overflow-hidden">
                  <label htmlFor="demo-website">Website</label>
                  <input id="demo-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
                </div>
                <label className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={form.consent_followup} onChange={set('consent_followup')} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#1d4ed8] focus:ring-[#1d4ed8] shrink-0" />
                  <span>WiSkul may contact me about the demo and getting started. You can opt out any time.</span>
                </label>
                {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#f59e0b] hover:bg-[#d97706] disabled:opacity-60 text-white font-bold text-sm px-6 py-3.5 shadow-lg shadow-amber-500/25 transition-colors"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Mail size={16} aria-hidden="true" />}
                  {busy ? 'Sending your links…' : 'Email me the demo'}
                  {!busy && <ArrowRight size={16} aria-hidden="true" />}
                </button>
                <p className="text-[11px] text-slate-400 text-center">
                  We use your details only to send the demo and follow up. See our <a href="/privacy-policy" className="underline hover:text-slate-600">privacy policy</a>.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default LiveDemoSection;
