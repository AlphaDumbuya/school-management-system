/**
 * VerifyIntroModal — recurring verification reminder for unverified account
 * owners. Shows on each dashboard load while the school is unverified, with an
 * urgent (but closable) tone. Once verified, it never shows again. Shown once
 * per app session so it doesn't re-pop on every in-app navigation.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, X, ArrowRight } from 'lucide-react';
import useAuthStore from '@store/authStore';
import verificationService from '@services/verificationService';

// Session-scoped so it appears each new visit but not on every route change.
const SESSION_KEY = 'wiskul_verify_reminder_shown';

export const VerifyIntroModal: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const userId = (user as any)?.id as string | undefined;
  const role = (user as any)?.role;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (role !== 'principal' || !userId) return;
    // Verified owners never see it.
    if ((user as any)?.verification_status === 'verified') return;
    // Only once per browser session (survives route changes, resets on new visit).
    try {
      if (sessionStorage.getItem(SESSION_KEY) === '1') return;
    } catch {
      /* ignore */
    }
    verificationService.getStatus().then((res) => {
      if (res.success && res.data?.status !== 'verified') {
        const t = setTimeout(() => setOpen(true), 700);
        return () => clearTimeout(t);
      }
    });
  }, [role, userId, user]);

  const close = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-6 text-center relative">
          <button onClick={close} className="absolute top-3 right-3 text-white/70 hover:text-white" aria-label="Close">
            <X size={18} />
          </button>
          <div className="mx-auto w-14 h-14 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center mb-3">
            <ShieldAlert size={28} className="text-white" />
          </div>
          <h3 className="text-lg font-black text-white">Your school is not verified</h3>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            Unverified schools are at higher risk of impersonation and lost trust. Verifying your
            school protects your account and community, reassures parents and staff, and keeps your
            school in good standing on WiSkul.
          </p>
          <p className="text-xs text-slate-400">
            It only takes a minute — confirm your EMIS code and ID details. You won't see this
            reminder again once you're verified.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { close(); navigate('/verify-school'); }}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-bold text-sm py-3 rounded-xl transition-colors"
            >
              Verify now <ArrowRight size={16} />
            </button>
            <button onClick={close} className="px-4 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm">
              Remind me later
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.animate-fade-in{animation:fadeIn .35s ease-out both}`}</style>
    </div>
  );
};

export default VerifyIntroModal;
