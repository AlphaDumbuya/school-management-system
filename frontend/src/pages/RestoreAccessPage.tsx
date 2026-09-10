/**
 * Restore Access — public page for a SUSPENDED (non-payment) school to pay and
 * reactivate WITHOUT logging in. Reached via the signed link in the suspension
 * email: /restore-access?token=<jwt>.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSpinner } from 'react-icons/fa';
import { ShieldCheck, CheckCircle2, AlertTriangle, CreditCard } from 'lucide-react';
import restoreService, { RestoreInfo } from '@services/restoreService';

const getParam = (k: string) =>
  typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get(k) : null;

export const RestoreAccessPage: React.FC = () => {
  const navigate = useNavigate();
  const token = getParam('token') || '';
  const returnedStatus = getParam('status'); // success | cancelled after Monime redirect

  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<RestoreInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!token) { setError('This link is missing its access token.'); setLoading(false); return; }
      try {
        const res = await restoreService.getInfo(token);
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

  const pay = async () => {
    setPaying(true);
    setError(null);
    try {
      const res = await restoreService.startCheckout(token);
      if (res.success && res.data?.alreadyActive) {
        // Already active — send them to sign in.
        navigate('/login', { replace: true });
        return;
      }
      if (res.success && res.data?.redirectUrl) {
        window.location.assign(res.data.redirectUrl);
        return;
      }
      setError(res.error || 'Could not start the payment. Please try again or contact support.');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Could not start the payment. Please contact support@wiskulsl.com.');
    } finally {
      setPaying(false);
    }
  };

  const fmt = (n: number) => `Le ${Number(n || 0).toLocaleString()}`;

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
              <p className="text-sm text-blue-100/70">Loading your account…</p>
            </div>
          ) : returnedStatus === 'success' ? (
            <div className="text-center space-y-3">
              <CheckCircle2 className="mx-auto text-emerald-400" size={44} />
              <h2 className="text-xl font-black">Payment received</h2>
              <p className="text-sm text-blue-100/80">
                Thanks! Once your payment is confirmed (usually within a few minutes) your school
                access is restored automatically. You can then sign in normally.
              </p>
              <button onClick={() => navigate('/login')} className="mt-2 w-full bg-[#f59e0b] hover:bg-[#d97706] text-white font-black text-sm tracking-wide py-3.5 rounded-xl transition-colors">
                Go to sign in
              </button>
            </div>
          ) : error ? (
            <div className="text-center space-y-3">
              <AlertTriangle className="mx-auto text-amber-400" size={40} />
              <h2 className="text-lg font-black">We couldn't load this link</h2>
              <p className="text-sm text-blue-100/80">{error}</p>
              <a href="mailto:support@wiskulsl.com" className="inline-block mt-1 text-amber-300 text-sm font-semibold hover:underline">
                Contact support@wiskulsl.com
              </a>
            </div>
          ) : info?.alreadyActive ? (
            <div className="text-center space-y-3">
              <CheckCircle2 className="mx-auto text-emerald-400" size={44} />
              <h2 className="text-xl font-black">Your account is active</h2>
              <p className="text-sm text-blue-100/80">Good news — {info.schoolName} is already active. You can sign in normally.</p>
              <button onClick={() => navigate('/login')} className="mt-2 w-full bg-[#f59e0b] hover:bg-[#d97706] text-white font-black text-sm tracking-wide py-3.5 rounded-xl transition-colors">
                Go to sign in
              </button>
            </div>
          ) : info ? (
            <div className="space-y-5">
              <div className="text-center">
                <ShieldCheck className="mx-auto text-amber-400 mb-2" size={36} />
                <h2 className="text-xl font-black">Restore access</h2>
                <p className="text-sm text-blue-100/70 mt-1">Settle the amount below to reactivate your school. No login needed.</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-blue-100/60">School</span><span className="font-semibold">{info.schoolName}</span></div>
                <div className="flex justify-between"><span className="text-blue-100/60">Plan</span><span className="font-semibold capitalize">{info.planType}</span></div>
                <div className="flex justify-between items-center pt-2 border-t border-white/10">
                  <span className="text-blue-100/60">Amount due</span>
                  <span className="text-lg font-black text-amber-300">{fmt(info.amountDue)}</span>
                </div>
              </div>

              {returnedStatus === 'cancelled' && (
                <p className="text-xs text-amber-200 text-center">Payment was cancelled. You can try again below.</p>
              )}

              <button
                onClick={pay}
                disabled={paying}
                className="w-full flex items-center justify-center gap-2 bg-[#f59e0b] hover:bg-[#d97706] text-white font-black text-sm tracking-wide py-3.5 rounded-xl transition-colors disabled:opacity-50"
              >
                {paying ? <FaSpinner className="animate-spin" size={16} /> : <CreditCard size={16} />}
                {paying ? 'STARTING PAYMENT…' : `Pay ${fmt(info.amountDue)} & restore`}
              </button>
              <p className="text-[11px] text-blue-100/50 text-center">
                Secure payment via Monime (mobile money & card). Access is reinstated automatically once confirmed.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default RestoreAccessPage;
