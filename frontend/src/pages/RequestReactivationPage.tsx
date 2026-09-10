/**
 * Request Reactivation — public page for a SUSPENDED (non-payment) school to
 * professionally request reactivation WITHOUT logging in. Reached via the signed
 * link in the suspension email, or the "click here to resolve" link on login:
 *   /request-reactivation?token=<jwt>
 *
 * Submitting opens a high-priority platform support ticket and notifies the
 * WiSkul team, who review and lift the suspension. It does NOT auto-reactivate.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSpinner } from 'react-icons/fa';
import { LifeBuoy, CheckCircle2, AlertTriangle, Send } from 'lucide-react';
import restoreService, { ReactivationInfo } from '@services/restoreService';

const getParam = (k: string) =>
  typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get(k) : null;

const CATEGORY_LABEL: Record<string, string> = {
  payment: 'Overdue payment',
  policy: 'Policy / terms review',
  review: 'Pending verification / review',
  security: 'Security precaution',
  abuse: 'Suspected misuse / abuse',
  other: 'Other',
};

export const RequestReactivationPage: React.FC = () => {
  const navigate = useNavigate();
  const token = getParam('token') || '';

  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<ReactivationInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!token) { setError('This link is missing its token.'); setLoading(false); return; }
      try {
        const res = await restoreService.getReactivationInfo(token);
        if (!active) return;
        if (res.success && res.data) setInfo(res.data);
        else setError(res.error || 'This link is invalid or has expired.');
      } catch (e: any) {
        if (active) setError(e?.response?.data?.error || 'This link is invalid or has expired.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [token]);

  const submit = async () => {
    if (message.trim().length < 10) { setError('Please add a short explanation (at least 10 characters).'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await restoreService.submitReactivationRequest(token, message.trim(), contactEmail.trim() || undefined);
      if (res.success && res.data?.reference) {
        setReference(res.data.reference);
      } else {
        setError(res.error || 'Could not submit your request. Please try again.');
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not submit your request. Please contact support@wiskulsl.com.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#16235c] via-[#1a2b6b] to-[#20308a] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="auth-blob-1 absolute top-[-20%] left-[-12%] w-[520px] h-[520px] rounded-full bg-[#2563eb]/25 blur-[120px]" />
        <div className="auth-blob-2 absolute bottom-[-20%] right-[-12%] w-[460px] h-[460px] rounded-full bg-amber-400/15 blur-[130px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-6">
          <img src="/logo.png" alt="WiSkul" className="w-12 h-12 rounded-2xl object-contain bg-white/95 p-1.5 mx-auto mb-2" />
          <h1 className="text-lg font-black text-white">Wi<span className="text-amber-400">Skul</span></h1>
        </div>

        <div className="bg-[#20308a]/95 backdrop-blur-xl border border-white/10 rounded-3xl p-7 sm:p-9 shadow-2xl text-white">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <FaSpinner className="animate-spin text-white/80" size={26} />
              <p className="text-sm text-blue-100/70">Loading…</p>
            </div>
          ) : reference ? (
            <div className="text-center space-y-3">
              <CheckCircle2 className="mx-auto text-emerald-400" size={44} />
              <h2 className="text-xl font-black">Request submitted</h2>
              <p className="text-sm text-blue-100/80">
                Thanks — our team has received your reactivation request and will review it shortly.
                We'll reply to the email you provided.
              </p>
              <p className="text-sm text-blue-100/70">Reference: <span className="font-mono font-bold text-amber-300">{reference}</span></p>
              <button onClick={() => navigate('/login')} className="mt-2 w-full bg-[#f59e0b] hover:bg-[#d97706] text-white font-black text-sm tracking-wide py-3.5 rounded-xl transition-colors">
                Back to sign in
              </button>
            </div>
          ) : error && !info ? (
            <div className="text-center space-y-3">
              <AlertTriangle className="mx-auto text-amber-400" size={40} />
              <h2 className="text-lg font-black">We couldn't load this link</h2>
              <p className="text-sm text-blue-100/80">{error}</p>
              <a href="mailto:support@wiskulsl.com" className="inline-block mt-1 text-amber-300 text-sm font-semibold hover:underline">Contact support@wiskulsl.com</a>
            </div>
          ) : info?.alreadyActive ? (
            <div className="text-center space-y-3">
              <CheckCircle2 className="mx-auto text-emerald-400" size={44} />
              <h2 className="text-xl font-black">Your account is active</h2>
              <p className="text-sm text-blue-100/80">{info.schoolName} is already active. You can sign in normally.</p>
              <button onClick={() => navigate('/login')} className="mt-2 w-full bg-[#f59e0b] hover:bg-[#d97706] text-white font-black text-sm tracking-wide py-3.5 rounded-xl transition-colors">Go to sign in</button>
            </div>
          ) : info ? (
            <div className="space-y-4">
              <div className="text-center">
                <LifeBuoy className="mx-auto text-amber-400 mb-2" size={36} />
                <h2 className="text-xl font-black">Request reactivation</h2>
                <p className="text-sm text-blue-100/70 mt-1">Tell us how you'd like to resolve this. Our team will review and respond.</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-blue-100/60">School</span><span className="font-semibold">{info.schoolName}</span></div>
                <div className="flex justify-between"><span className="text-blue-100/60">Reason</span><span className="font-semibold">{CATEGORY_LABEL[info.category] || 'Other'}</span></div>
                {info.reason && <p className="text-xs text-blue-100/60 pt-1 border-t border-white/10">{info.reason}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-blue-100/80 mb-1.5 uppercase tracking-wider">Your message</label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Explain the situation or the steps you've taken to resolve it…"
                  className="w-full bg-white/95 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-blue-100/80 mb-1.5 uppercase tracking-wider">Reply-to email (optional)</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="you@school.com"
                  className="w-full bg-white/95 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none"
                />
              </div>

              {error && <p className="text-xs text-red-200 text-center">{error}</p>}

              <button
                onClick={submit}
                disabled={submitting || message.trim().length < 10}
                className="w-full flex items-center justify-center gap-2 bg-[#f59e0b] hover:bg-[#d97706] text-white font-black text-sm tracking-wide py-3.5 rounded-xl transition-colors disabled:opacity-50"
              >
                {submitting ? <FaSpinner className="animate-spin" size={16} /> : <Send size={16} />}
                {submitting ? 'SENDING…' : 'Submit request'}
              </button>
              <p className="text-[11px] text-blue-100/50 text-center">Our team reviews requests and lifts suspensions once resolved.</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default RequestReactivationPage;
