/**
 * WelcomeModal — a friendly first-launch greeting shown on the login screen.
 *
 * Purpose: people using the app should already belong to a school that's set up.
 * This popup welcomes them and makes clear they sign in with credentials issued
 * by their school — not register a new account. Principals get a hint to
 * register a school if they haven't.
 *
 * Shown once per device (persisted). Prioritised for the installed PWA launch,
 * but also greets first-time web visitors to the login page.
 */
import React, { useEffect, useState } from 'react';
import { X, GraduationCap, KeyRound, Building2, HelpCircle, ArrowRight, WifiOff } from 'lucide-react';
import usePwaInstall from '@hooks/usePwaInstall';

const SEEN_KEY = 'wiskul_welcome_seen';

interface WelcomeModalProps {
  onRegister?: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ onRegister }) => {
  const { isInstalled } = usePwaInstall();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(SEEN_KEY)) return;
    // Small delay so it feels intentional after the app paints.
    const t = setTimeout(() => setOpen(true), isInstalled ? 400 : 900);
    return () => clearTimeout(t);
  }, [isInstalled]);

  const close = () => {
    setOpen(false);
    localStorage.setItem(SEEN_KEY, '1');
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to WiSkul"
      onClick={close}
    >
      <div
        className="relative w-full max-w-md bg-[#16213e] border border-white/[0.1] rounded-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent header */}
        <div className="relative px-6 pt-7 pb-6 bg-gradient-to-br from-[#00d4aa]/15 via-[#7c3aed]/10 to-transparent">
          <button
            onClick={close}
            aria-label="Close"
            className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>

          <div className="relative w-14 h-14 mb-4">
            <div className="absolute inset-0 bg-[#00d4aa]/40 blur-xl rounded-2xl" />
            <img
              src="/logo.png"
              alt="WiSkul"
              className="relative w-14 h-14 rounded-2xl object-contain bg-white/95 p-2 shadow-lg"
            />
          </div>

          <h2 className="text-2xl font-black text-white leading-tight">
            Welcome to Wi<span className="text-[#00d4aa]">Skul</span> 👋
          </h2>
          <p className="text-gray-400 text-sm mt-1.5 leading-relaxed">
            Your school portal for academics, attendance, fees and more — in your
            pocket, and it works offline after your first sign-in.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <Row
            icon={<KeyRound size={16} className="text-[#00d4aa]" />}
            title="Sign in with your school account"
            desc="Use the email and password given to you by your school."
          />
          <Row
            icon={<WifiOff size={16} className="text-[#00d4aa]" />}
            title="First sign-in needs internet — then works offline"
            desc="After you sign in once on this device, you can open and use the app offline anytime. Changes sync automatically when you're back online."
          />
          <Row
            icon={<GraduationCap size={16} className="text-[#00d4aa]" />}
            title="For students, parents & staff"
            desc="Your access is set up by your school — no account creation needed."
          />
          <Row
            icon={<HelpCircle size={16} className="text-[#00d4aa]" />}
            title="Can't sign in?"
            desc="Contact your school principal or administrator for your login details."
          />

          {/* Principal path */}
          <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Building2 size={15} className="text-[#7c3aed]" />
              <p className="text-white text-sm font-bold">Are you a school leader?</p>
            </div>
            <p className="text-gray-400 text-xs mb-3 leading-relaxed">
              If your school isn't on WiSkul yet, you can register it for free and
              set up your portal in minutes.
            </p>
            <button
              onClick={() => {
                close();
                onRegister?.();
              }}
              className="inline-flex items-center gap-1.5 text-[#00d4aa] text-xs font-bold hover:text-[#00e6b8] transition-colors"
            >
              Register your school <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={close}
            className="w-full bg-[#00d4aa] hover:bg-[#00e6b8] text-[#1a1a2e] font-black text-sm tracking-wide py-3.5 rounded-xl transition-all hover:shadow-[0_0_30px_rgba(0,212,170,0.3)] active:scale-[0.98]"
          >
            Continue to Sign In
          </button>
        </div>
      </div>
    </div>
  );
};

const Row: React.FC<{ icon: React.ReactNode; title: string; desc: string }> = ({
  icon,
  title,
  desc,
}) => (
  <div className="flex items-start gap-3">
    <div className="w-9 h-9 rounded-xl bg-[#00d4aa]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-white text-sm font-bold">{title}</p>
      <p className="text-gray-400 text-xs leading-snug">{desc}</p>
    </div>
  </div>
);

export default WelcomeModal;
