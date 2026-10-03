/**
 * GuidePage — /guide
 * A comprehensive, role-aware help page. Explains how to use the platform
 * professionally, section by section, with quick links to the relevant pages.
 * Also lets the user replay the first-login walkthrough.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings, Users, GraduationCap, ClipboardCheck, Wallet, CreditCard,
  BookOpen, ClipboardList, FileText, Building, ArrowRight, PlayCircle, LifeBuoy, Mail,
  CalendarDays, Megaphone, ShieldCheck,
} from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import useAuthStore from '@store/authStore';
import { getRoleGuide, resetOnboarding, type GuideSection, type SetupPhase } from '@lib/onboarding';
import { AlertTriangle, ArrowRight as ArrowRightIcon } from 'lucide-react';

// Resolve the lucide icon name stored in the guide content to a component.
const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Settings, Users, GraduationCap, ClipboardCheck, Wallet, CreditCard,
  BookOpen, ClipboardList, FileText, Building, CalendarDays, Megaphone, ShieldCheck,
};

// A gentle rotating palette so the section cards feel colourful and distinct.
const CARD_TINTS = [
  { chip: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300', ring: 'hover:ring-blue-200 dark:hover:ring-blue-900/50' },
  { chip: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300', ring: 'hover:ring-emerald-200 dark:hover:ring-emerald-900/50' },
  { chip: 'bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-300', ring: 'hover:ring-violet-200 dark:hover:ring-violet-900/50' },
  { chip: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300', ring: 'hover:ring-amber-200 dark:hover:ring-amber-900/50' },
  { chip: 'bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-300', ring: 'hover:ring-sky-200 dark:hover:ring-sky-900/50' },
  { chip: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-300', ring: 'hover:ring-rose-200 dark:hover:ring-rose-900/50' },
];

export const GuidePage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const guide = getRoleGuide(user?.role);
  const [replayed, setReplayed] = useState(false);

  const replayWalkthrough = () => {
    // Clear the stored "done" flag so a future first-login still shows it…
    resetOnboarding(user?.id, user?.tenantId);
    setReplayed(true);
    // …then go to the dashboard and explicitly ask the layout to open the
    // walkthrough. The event is dispatched after navigation so the destination
    // layout's listener is already mounted (the server-side hasOnboarded flag
    // would otherwise suppress it).
    navigate('/dashboard');
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('wiskul:replay-walkthrough'));
    }, 400);
  };

  const SectionCard: React.FC<{ section: GuideSection; i: number }> = ({ section, i }) => {
    const Icon = section.icon ? ICONS[section.icon] ?? BookOpen : BookOpen;
    const tint = CARD_TINTS[i % CARD_TINTS.length];
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-2xl ring-1 ring-gray-200/70 dark:ring-gray-700 shadow-sm transition-all duration-300 hover:shadow-lg ${tint.ring} hover:ring-2 p-5`}>
        <div className="flex items-center gap-3 mb-3">
          <span className={`w-11 h-11 rounded-2xl flex items-center justify-center ${tint.chip}`}>
            <Icon size={22} />
          </span>
          <h3 className="font-bold text-slate-900 dark:text-white">{section.title}</h3>
        </div>
        <p className="text-sm text-slate-600 dark:text-gray-300 mb-3">{section.intro}</p>
        <ul className="space-y-1.5 mb-4">
          {section.points.map((p, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-slate-600 dark:text-gray-300">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-gray-500 flex-shrink-0" />
              {p}
            </li>
          ))}
        </ul>
        {section.route && (
          <button
            onClick={() => navigate(section.route!)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1d4ed8] dark:text-blue-400 hover:text-[#1e40af] transition-colors"
          >
            {section.routeLabel ?? 'Open'} <ArrowRight size={15} />
          </button>
        )}
      </div>
    );
  };

  return (
    <MainLayout>
      <PageShell title="Platform Guide" subtitle="Learn how to use WiSkul professionally">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#3b82f6] text-white shadow-lg mb-6 p-6 sm:p-8">
          <div className="pointer-events-none absolute -top-10 -right-10 w-56 h-56 rounded-full bg-white/10 blur-2xl" />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.08]"
            style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.7) 1px, transparent 0)', backgroundSize: '22px 22px' }}
          />
          <div className="relative max-w-2xl">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/80">
              <BookOpen size={13} /> {(user?.role ?? 'user').replace('_', ' ')} guide
            </span>
            <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight">{guide.headline}</h1>
            <p className="mt-2 text-sm sm:text-base text-white/90">{guide.intro}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={replayWalkthrough}
                className="inline-flex items-center gap-2 bg-white text-[#1d4ed8] font-bold text-sm px-4 py-2.5 rounded-xl shadow hover:shadow-md transition-all"
              >
                <PlayCircle size={16} /> {replayed ? 'Restarting…' : 'Replay walkthrough'}
              </button>
              <button
                onClick={() => navigate('/support')}
                className="inline-flex items-center gap-2 bg-white/15 backdrop-blur text-white border border-white/25 font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-white/25 transition-all"
              >
                <LifeBuoy size={15} /> Help Center
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center gap-2 bg-white/15 backdrop-blur text-white border border-white/25 font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-white/25 transition-all"
              >
                Go to Dashboard <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Setup roadmap (principal / super admin) */}
        {guide.setupOrder && guide.setupOrder.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Your setup roadmap</h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-gray-300 mb-4">
              Complete these phases <strong>in order</strong>. Steps marked{' '}
              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-semibold"><AlertTriangle size={13} /> Required</span>{' '}
              must be done before enrolling people or running the school.
            </p>

            <div className="relative space-y-4">
              {/* Vertical connector line */}
              <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-[#1d4ed8] via-blue-300 to-transparent hidden sm:block" />
              {guide.setupOrder.map((phase: SetupPhase) => (
                <div key={phase.order} className="relative flex gap-4">
                  {/* Order badge */}
                  <div className="relative z-10 flex-shrink-0">
                    <span className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1d4ed8] to-[#3b82f6] text-white font-black flex items-center justify-center shadow-md shadow-blue-500/30">
                      {phase.order}
                    </span>
                  </div>

                  {/* Phase card */}
                  <div className="flex-1 min-w-0 bg-white dark:bg-gray-800 rounded-2xl ring-1 ring-gray-200/70 dark:ring-gray-700 shadow-sm p-5">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-bold text-slate-900 dark:text-white">{phase.title}</h3>
                      {phase.required && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 px-2 py-0.5 rounded-full">
                          <AlertTriangle size={11} /> Required
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-gray-400 mb-3">{phase.why}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {phase.tasks.map((task, ti) => (
                        <button
                          key={ti}
                          onClick={() => task.route && navigate(task.route)}
                          disabled={!task.route}
                          className="group flex items-center justify-between gap-2 text-left px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-gray-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 ring-1 ring-transparent hover:ring-blue-200 dark:hover:ring-blue-900/50 transition-all disabled:cursor-default"
                        >
                          <span className="text-sm text-slate-700 dark:text-gray-200 font-medium">{task.label}</span>
                          {task.route && (
                            <ArrowRightIcon size={15} className="text-slate-400 group-hover:text-[#1d4ed8] dark:group-hover:text-blue-400 transition-colors flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick-start steps */}
        <div className="mb-8">
          <h2 className="text-lg font-black text-slate-900 dark:text-white mb-3">Quick start</h2>
          <ol className="space-y-3">
            {guide.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3 bg-white dark:bg-gray-800 rounded-xl ring-1 ring-gray-200/70 dark:ring-gray-700 shadow-sm p-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-[#1d4ed8] to-[#3b82f6] text-white font-black text-sm flex items-center justify-center">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">{step.title}</h4>
                  <p className="text-sm text-slate-600 dark:text-gray-300 mt-0.5">{step.body}</p>
                  {step.route && (
                    <button
                      onClick={() => navigate(step.route!)}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#1d4ed8] dark:text-blue-400 hover:text-[#1e40af] transition-colors"
                    >
                      {step.routeLabel ?? 'Take me there'} <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Feature sections */}
        <div className="mb-8">
          <h2 className="text-lg font-black text-slate-900 dark:text-white mb-3">Explore the platform</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {guide.sections.map((s, i) => (
              <SectionCard key={s.id} section={s} i={i} />
            ))}
          </div>
        </div>

        {/* Help footer */}
        <div className="rounded-2xl bg-slate-50 dark:bg-gray-800 ring-1 ring-gray-200/70 dark:ring-gray-700 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 flex items-center justify-center flex-shrink-0">
              <LifeBuoy size={22} />
            </span>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">Need more help?</h3>
              <p className="text-sm text-slate-600 dark:text-gray-300">Browse step-by-step guides in the Help Center, or reach our team.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 self-start sm:self-auto">
            <button
              onClick={() => navigate('/support')}
              className="inline-flex items-center gap-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
            >
              <LifeBuoy size={16} /> Help Center
            </button>
            <a
              href="mailto:support@wiskulsl.com"
              className="inline-flex items-center gap-2 bg-white dark:bg-gray-700 text-[#1d4ed8] dark:text-blue-300 border border-blue-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-gray-600 font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
            >
              <Mail size={16} /> Contact Support
            </a>
          </div>
        </div>
      </PageShell>
    </MainLayout>
  );
};

export default GuidePage;
