/**
 * WelcomePage — first-run onboarding for the WiSkul app (native / installed PWA).
 *
 * Shows a short, swipeable guide ONCE on first launch after install. A localStorage
 * flag (`wiskul_onboarded`) records completion so it never shows again. From the
 * router, the app index sends first-time users here; returning users skip straight
 * to /login. Web (browser) users never see this — onboarding is app-only.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WifiOff, ClipboardCheck, ShieldCheck, ArrowRight, Check } from 'lucide-react';
import useAuthStore from '@store/authStore';
import { getDashboardPath } from '@hooks/useAuth';

export const ONBOARDED_KEY = 'wiskul_onboarded';

/** Mark onboarding complete so it never shows again. */
export function markOnboarded(): void {
  try {
    localStorage.setItem(ONBOARDED_KEY, '1');
  } catch {
    /* storage may be unavailable; onboarding will simply show again */
  }
}

/** True once the user has finished (or skipped) onboarding. */
export function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1';
  } catch {
    return false;
  }
}

interface Slide {
  icon: React.ReactNode;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    icon: <ClipboardCheck size={30} strokeWidth={2.2} />,
    title: 'Everything in one place',
    body: 'Attendance, assignments, grades and student records — manage your class right from your phone.',
  },
  {
    icon: <WifiOff size={30} strokeWidth={2.2} />,
    title: 'Works offline',
    body: 'Mark attendance and record work without a connection. Your changes sync automatically when you’re back online.',
  },
  {
    icon: <ShieldCheck size={30} strokeWidth={2.2} />,
    title: 'Sign in with your school account',
    body: 'This app has no sign-up — your account is created by your school administrator. Contact your school admin if you don’t have login details yet.',
  },
];

export const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;

  const isInitialized = useAuthStore((s) => s.isInitialized);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  // Already signed in? Skip onboarding straight to the dashboard.
  useEffect(() => {
    if (isInitialized && isAuthenticated && user) {
      markOnboarded();
      navigate(getDashboardPath(user.role), { replace: true });
    }
  }, [isInitialized, isAuthenticated, user, navigate]);

  const finish = () => {
    markOnboarded();
    navigate('/login', { replace: true });
  };

  const next = () => {
    if (isLast) finish();
    else setIndex((i) => i + 1);
  };

  const slide = SLIDES[index];

  return (
    <div
      className="bg-[#1a2b6b] flex flex-col relative overflow-hidden"
      style={{
        // Use the dynamic viewport height and respect the phone's status bar /
        // gesture bar so the top "Skip" and bottom CTA are never cut off.
        minHeight: '100dvh',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Brand gradient backdrop */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a2b6b] via-[#25408f] to-[#0b1234]" />
      <div className="absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full bg-[#1d4ed8]/25 blur-[130px] pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-[420px] h-[420px] rounded-full bg-amber-400/15 blur-[130px] pointer-events-none" />

      {/* Skip */}
      <div className="relative z-10 flex justify-end p-5">
        <button
          onClick={finish}
          className="text-white/60 text-xs font-semibold hover:text-white transition-colors"
        >
          Skip
        </button>
      </div>

      {/* Brand */}
      <div className="relative z-10 flex items-center justify-center gap-2 mb-2">
        <img src="/logo.png" alt="WiSkul" className="w-9 h-9 rounded-xl object-contain bg-white p-1 shadow" />
        <span className="text-lg font-black text-white tracking-tight">
          Wi<span className="text-amber-400">Skul</span>
        </span>
      </div>

      {/* Slide — flex-1 + min-h-0 so it shrinks on short screens and never
          pushes the CTA below the safe area; scrolls if content is tall. */}
      <div className="relative z-10 flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center px-8 text-center">
        <div key={index} className="animate-fade-in w-full max-w-sm">
          <div className="mx-auto mb-8 w-20 h-20 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-amber-400">
            {slide.icon}
          </div>
          <h2 className="text-2xl font-black text-white mb-3">{slide.title}</h2>
          <p className="text-blue-100/75 text-sm leading-relaxed">{slide.body}</p>
        </div>
      </div>

      {/* Dots + CTA */}
      <div className="relative z-10 px-8 pb-6 pt-2 max-w-sm w-full mx-auto shrink-0">
        <div className="flex justify-center gap-2 mb-6">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-6 bg-amber-400' : 'w-1.5 bg-white/30'
              }`}
            />
          ))}
        </div>
        <button
          onClick={next}
          className="group w-full bg-[#f59e0b] hover:bg-[#d97706] text-white font-black text-sm tracking-[0.1em] py-3.5 rounded-xl transition-all duration-300 shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          {isLast ? (
            <>
              GET STARTED
              <Check size={16} strokeWidth={3} />
            </>
          ) : (
            <>
              NEXT
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.45s ease-out both; }
      `}</style>
    </div>
  );
};

export default WelcomePage;
