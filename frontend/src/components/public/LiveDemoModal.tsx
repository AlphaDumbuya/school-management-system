/**
 * "Get a live demo" popup.
 *
 * The visitor leaves their details and gets personal one-click links into every
 * portal of WiSkul Demo Academy by email (sample data, read-only). The super
 * admin sees each request under Platform → Demo requests.
 *
 * Mount <LiveDemoModal /> once on a public page, then open it from any button
 * with openLiveDemo(). Visiting /?demo=1 (or the old /#demo) opens it too.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Briefcase, GraduationCap, Users, User, Wallet, ClipboardList, CheckCircle2, Mail, Loader2, X } from 'lucide-react';
import { DEMO_PORTALS } from '@lib/demo';
import demoService, { DEMO_ROLES, DEMO_STUDENT_COUNTS } from '@services/demoService';

const OPEN_EVENT = 'wiskul:open-live-demo';

/** Open the popup from any button on the page. */
export function openLiveDemo(): void {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

const ICONS: Record<string, React.ElementType> = {
  principal: Briefcase, teacher: Users, student: GraduationCap, parent: User, bursar: Wallet, admissions: ClipboardList,
};
const input = 'w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1d4ed8] focus:outline-none focus:ring-2 focus:ring-blue-100';
const label = 'block text-xs font-semibold text-slate-700 mb-1.5';
const EMPTY = { full_name: '', email: '', phone: '', school_name: '', role: '', student_count: '', consent_followup: false, website: '' };

export const LiveDemoModal: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    // Tidy a ?demo=1 or #demo left in the address.
    const url = new URL(window.location.href);
    if (url.searchParams.has('demo') || url.hash === '#demo') {
      url.searchParams.delete('demo');
      if (url.hash === '#demo') url.hash = '';
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  // Open on request, or when the page is visited as /?demo=1 or /#demo.
  useEffect(() => {
    const show = () => { openerRef.current = document.activeElement as HTMLElement | null; setOpen(true); };
    window.addEventListener(OPEN_EVENT, show);
    const url = new URL(window.location.href);
    if (url.searchParams.get('demo') === '1' || url.hash === '#demo') setOpen(true);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, []);

  // While open: lock page scroll, close on Escape, keep Tab inside, focus the first field, then give focus back.
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusables = () =>
      Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled])') ?? []);
    const t = window.setTimeout(() => (dialogRef.current?.querySelector<HTMLElement>('#demo-name') ?? dialogRef.current?.querySelector<HTMLElement>('#demo-close') ?? focusables()[0])?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      openerRef.current?.focus?.();
    };
  }, [open, close]);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
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

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center sm:p-6 bg-slate-900/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-title"
        className="relative w-full sm:max-w-xl max-h-[94vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl"
      >
        <button
          id="demo-close"
          type="button"
          onClick={close}
          aria-label="Close"
          style={{ padding: 0 }}
          className="absolute right-3 top-3 z-10 w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <X size={18} aria-hidden="true" />
        </button>

        {sentTo ? (
          <div className="px-6 sm:px-10 py-12 text-center" role="status">
            <CheckCircle2 size={52} className="mx-auto text-emerald-500" aria-hidden="true" />
            <h2 id="demo-title" className="mt-4 text-xl sm:text-2xl font-black text-slate-900">Check your inbox</h2>
            <p className="mt-2 text-sm text-slate-600 break-words">
              We've sent your demo links to <strong className="text-slate-900">{sentTo}</strong>. Open the email and pick a portal; you're signed in with one click.
            </p>
            <p className="mt-3 text-xs text-slate-500">Nothing there after a few minutes? Check your spam or promotions folder.</p>
            <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button type="button" onClick={close} className="w-full sm:w-auto rounded-lg bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-bold text-sm px-8 py-3 transition-colors">Done</button>
              <button type="button" onClick={() => { setSentTo(null); setForm((f) => ({ ...f, email: '' })); }} className="text-sm font-semibold text-[#1d4ed8] hover:underline">
                Use a different email
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="relative px-5 sm:px-8 pt-8 pb-6 space-y-4">
            <div className="pr-8">
              <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#1d4ed8]">Live demo</p>
              <h2 id="demo-title" className="mt-1 text-xl sm:text-2xl font-black tracking-tight text-slate-900">See WiSkul run a real school</h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Explore WiSkul Demo Academy with sample data. Tell us a little about you and we'll email your personal demo links.
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5" aria-label="Portals you can explore">
              {DEMO_PORTALS.map((p) => {
                const Icon = ICONS[p.key] || User;
                return (
                  <span key={p.key} className="inline-flex items-center gap-1.5 rounded-full border border-[#e5e9f2] bg-[#f8faff] px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                    <Icon size={12} className="text-[#1d4ed8]" aria-hidden="true" /> {p.portal}
                  </span>
                );
              })}
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
                <input id="demo-school" required autoComplete="organization" value={form.school_name} onChange={set('school_name')} className={input} placeholder="e.g. Hill View Secondary" />
              </div>
              <div className="min-w-0">
                <label htmlFor="demo-role" className={label}>Your role</label>
                <select id="demo-role" required value={form.role} onChange={set('role')} className={input}>
                  <option value="">Choose…</option>
                  {DEMO_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="min-w-0">
                <label htmlFor="demo-size" className={label}>Students <span className="font-normal text-slate-400">(optional)</span></label>
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
            </button>
            <p className="text-[11px] text-slate-400 text-center">
              Free, and it takes under a minute. We use your details only to send the demo and follow up. See our{' '}
              <a href="/privacy-policy" className="underline hover:text-slate-600">privacy policy</a>.
            </p>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default LiveDemoModal;
