/**
 * OnboardingGuide — a role-aware first-login walkthrough modal.
 *
 * Shows once per user per tenant (completion stored in localStorage, scoped by
 * tenantId:userId). Walks the user through the key steps for their role, links to
 * the relevant pages ("Take me there"), and points to the full Guide page. The
 * user can skip at any time.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight, BookOpen, CheckCircle2, ArrowRight } from 'lucide-react';
import useAuthStore from '@store/authStore';
import authService from '@services/authService';
import { getRoleGuide, markOnboardingComplete } from '@lib/onboarding';

interface OnboardingGuideProps {
  onClose: () => void;
}

export const OnboardingGuide: React.FC<OnboardingGuideProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const guide = getRoleGuide(user?.role);
  const [index, setIndex] = useState(0);

  const steps = guide.steps;
  const step = steps[index];
  const isLast = index === steps.length - 1;
  const progress = Math.round(((index + 1) / steps.length) * 100);

  const finish = () => {
    // Local (per-device) flag for instant effect…
    markOnboardingComplete(user?.id, user?.tenantId);
    // …and server-side (device-independent) so it's truly one-time per account.
    void authService.markOnboarded();
    if (user) useAuthStore.getState().setUser({ ...(user as any), hasOnboarded: true });
    onClose();
  };

  // Keyboard: Esc skips, arrows move between steps.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, steps.length - 1));
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length]);

  const goTo = (route?: string) => {
    if (!route) return;
    finish();
    navigate(route);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={finish} />

      {/* Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-step-title"
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in max-h-[92dvh] overflow-y-auto"
      >
        {/* Header */}
        <div className="relative bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#3b82f6] text-white p-6">
          <div className="pointer-events-none absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
          <button
            onClick={finish}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Skip guide"
          >
            <X size={18} />
          </button>
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/80">
              <BookOpen size={13} /> Getting started · Step {index + 1} of {steps.length}
            </span>
            <h2 className="mt-1 text-xl font-black tracking-tight">{guide.headline}</h2>
          </div>
          {/* Progress bar */}
          <div className="relative mt-4 h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
              {index + 1}
            </span>
            <div className="min-w-0">
              <h3 id="onboarding-step-title" className="text-base font-bold text-slate-900">{step.title}</h3>
              <p className="mt-1 text-sm text-slate-600 leading-relaxed">{step.body}</p>
              {step.route && (
                <button
                  onClick={() => goTo(step.route)}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1d4ed8] hover:text-[#1e40af] transition-colors"
                >
                  {step.routeLabel ?? 'Take me there'} <ArrowRight size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Step dots */}
          <div className="mt-6 flex items-center justify-center gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Go to step ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-[#1d4ed8]' : 'w-1.5 bg-slate-300 hover:bg-slate-400'}`}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
          <button
            onClick={finish}
            className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
          >
            Skip for now
          </button>

          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                onClick={() => setIndex((i) => i - 1)}
                className="inline-flex items-center gap-1 px-3 py-2 text-sm font-semibold text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <ChevronLeft size={16} /> Back
              </button>
            )}
            {isLast ? (
              <button
                onClick={finish}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] rounded-lg shadow-md shadow-blue-500/30 hover:shadow-lg transition-all"
              >
                <CheckCircle2 size={16} /> Finish
              </button>
            ) : (
              <button
                onClick={() => setIndex((i) => i + 1)}
                className="inline-flex items-center gap-1 px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] rounded-lg shadow-md shadow-blue-500/30 hover:shadow-lg transition-all"
              >
                Next <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Guide page link */}
        <div className="px-6 py-3 bg-white border-t border-slate-100 text-center">
          <button
            onClick={() => goTo('/guide')}
            className="text-xs font-semibold text-slate-500 hover:text-[#1d4ed8] transition-colors inline-flex items-center gap-1.5"
          >
            <BookOpen size={13} /> Prefer the full guide? Visit the Guide page anytime
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingGuide;
