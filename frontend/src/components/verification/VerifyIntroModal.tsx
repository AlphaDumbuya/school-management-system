/**
 * VerifyIntroModal — a once-per-session reminder for an unverified account
 * owner (principal). Calm and factual: what verification is, how long it
 * takes, and what it's needed for.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight, X } from 'lucide-react';
import useAuthStore from '@store/authStore';
import verificationService, { isVerifiedUser } from '@services/verificationService';

const SESSION_KEY = 'wiskul_verify_reminder_shown';

export const VerifyIntroModal: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const userId = (user as any)?.id as string | undefined;
  const role = (user as any)?.role;
  const [open, setOpen] = useState(false);
  const primaryRef = useRef<HTMLButtonElement | null>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (role !== 'principal' || !userId || isVerifiedUser(user)) return;
    // Only once per browser session (survives route changes, resets on a new visit).
    try {
      if (sessionStorage.getItem(SESSION_KEY) === '1') return;
    } catch { /* ignore */ }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    verificationService.getStatus().then((res) => {
      if (!cancelled && res.success && res.data?.status !== 'verified') {
        timer = setTimeout(() => setOpen(true), 700);
      }
    });
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [role, userId, user]);

  const close = () => {
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* ignore */ }
    setOpen(false);
    lastFocus.current?.focus?.();
  };

  // Focus the main action, close on Escape, keep Tab inside the dialog.
  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement as HTMLElement | null;
    primaryRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      if (e.key === 'Tab') {
        const nodes = Array.from(document.querySelectorAll<HTMLElement>('#verify-reminder button'));
        if (!nodes.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div id="verify-reminder" role="dialog" aria-modal="true" aria-labelledby="verify-reminder-title" aria-describedby="verify-reminder-text"
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
        <div className="bg-gradient-to-br from-[#1a2b6b] to-[#1d4ed8] p-6 text-center relative">
          <button onClick={close} className="absolute top-3 right-3 text-white/70 hover:text-white" aria-label="Close">
            <X size={18} />
          </button>
          <div className="mx-auto w-14 h-14 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center mb-3">
            <ShieldCheck size={28} className="text-white" aria-hidden="true" />
          </div>
          <h2 id="verify-reminder-title" className="text-lg font-black text-white">Verify your school</h2>
        </div>
        <div className="p-6 space-y-4">
          <p id="verify-reminder-text" className="text-sm text-slate-600">
            Confirm your school's EMIS code and your ID as the account owner. It takes about two minutes,
            and you'll need it before changing your subscription plan.
          </p>
          <p className="text-xs text-slate-500">
            Have your EMIS code (or school registration number) and your national ID, passport or driver's licence ready.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              ref={primaryRef}
              onClick={() => { close(); navigate('/verify-school'); }}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-bold text-sm py-3 rounded-xl transition-colors"
            >
              Verify now <ArrowRight size={16} aria-hidden="true" />
            </button>
            <button onClick={close} className="px-4 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm">
              Later
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.animate-fade-in{animation:fadeIn .35s ease-out both}@media (prefers-reduced-motion: reduce){.animate-fade-in{animation:none}}`}</style>
    </div>
  );
};

export default VerifyIntroModal;
