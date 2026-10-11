/**
 * Main Layout Component
 * Wrapper for main application layout with sidebar and header
 * Phase 11: Frontend Dashboard Implementation
 */

import React, { useState, useEffect } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import useAuthStore from '@store/authStore';
import { isOnboardingComplete, REPLAY_WALKTHROUGH_FLAG } from '@lib/onboarding';
import OnboardingGuide from '@components/onboarding/OnboardingGuide';
import ImpersonationBanner from './ImpersonationBanner';
import PromotionWelcomeBanner from './PromotionWelcomeBanner';
import OfflineBanner from '@components/offline/OfflineBanner';
import NativeUpdateBanner from '@components/app/NativeUpdateBanner';
import { useSyncEngine } from '../../offline/useSyncEngine';
import useInactivityLock from '@hooks/useInactivityLock';
import VerifyIntroModal from '@components/verification/VerifyIntroModal';
import { ResultReleasePopup } from '@components/results/ResultReleasePopup';
import { showToast } from '@utils/toast';
import { isDemoUser } from '@lib/demo';

/**
 * School-wide notice when the trial / plan has ended and payment is required:
 * everything stays viewable, changes are paused until a plan is paid.
 */
/**
 * Principal-only notice after a downgrade (e.g. the trial ended): which
 * portals are switched off and which features are now read-only. Dismissible;
 * it comes back if the plan's restrictions change.
 */
/** Signed in to the public demo school: sample data, changes switched off. */
const DemoSchoolBanner: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  if (!isDemoUser(user)) return null;
  return (
    <div role="status" className="mb-4 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <p className="text-blue-900 dark:text-blue-100 flex-1 min-w-[220px]">
        <span className="font-bold">You're exploring the WiSkul demo school.</span>{' '}
        Everything here is sample data, and changes are switched off.
      </p>
      <a href="/#demo" className="font-semibold text-blue-700 dark:text-blue-300 hover:underline">Try another portal</a>
      <a href="/register" className="font-bold text-white bg-[#f59e0b] hover:bg-[#d97706] rounded-lg px-3 py-1.5">Start your free trial</a>
    </div>
  );
};

const PLAN_DISMISS_KEY = 'wiskul.planNotice.dismissed';
const PlanRestrictionsBanner: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const pa = user?.role === 'principal' ? user.planAccess : null;
  const entries = Object.entries(pa?.features || {});
  const portalsOff = entries.filter(([k, v]) => k.startsWith('portal_') && v === 'locked').map(([k]) => k);
  const readOnly = entries.filter(([k, v]) => !k.startsWith('portal_') && v === 'read_only').map(([k]) => k);
  const signature = `${pa?.plan}|${readOnly.sort().join(',')}`;
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(PLAN_DISMISS_KEY) === signature; } catch { return false; }
  });
  // Only worth showing when something the school used is now restricted.
  if (!pa || pa.lapsed || !readOnly.length || dismissed) return null;
  const names: Record<string, string> = {
    portal_parent: 'Parent', portal_admissions: 'Admissions Officer', portal_bursar: 'Bursar',
  };
  return (
    <div role="status" className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 flex flex-wrap items-start gap-x-4 gap-y-2">
      <span className="flex-1 min-w-[14rem]">
        <strong className="font-semibold">You're on the {pa.planName} plan.</strong>{' '}
        {readOnly.length} feature{readOnly.length === 1 ? '' : 's'} you used before {readOnly.length === 1 ? 'is' : 'are'} now read-only (marked with a lock in the menu).
        {portalsOff.length > 0 && <> The {portalsOff.map((k) => names[k] || k).join(', ')} portal{portalsOff.length === 1 ? ' is' : 's are'} switched off.</>}
        {' '}Nothing has been deleted.
      </span>
      <span className="flex items-center gap-3">
        <a href="/settings?tab=billing" className="font-semibold underline underline-offset-2 hover:no-underline">See what's included</a>
        <button type="button" onClick={() => { try { localStorage.setItem(PLAN_DISMISS_KEY, signature); } catch { /* ignore */ } setDismissed(true); }}
          className="text-blue-800/70 hover:text-blue-950" aria-label="Dismiss plan notice">Dismiss</button>
      </span>
    </div>
  );
};

const SubscriptionLapsedBanner: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const pa = user && user.role !== 'super_admin' ? user.planAccess : null;
  if (!pa?.lapsed) return null;
  const isPrincipal = user?.role === 'principal';
  return (
    <div role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="flex-1 min-w-[14rem]">
        <strong className="font-semibold">{pa.isTrial ? 'Your free period has ended.' : 'Your plan has ended.'}</strong>{' '}
        {isPrincipal
          ? 'Everything is safe and can be viewed. Choose a plan to keep adding and changing records.'
          : 'Everything is safe and can be viewed. Changes are paused until your principal chooses a plan.'}
      </span>
      {isPrincipal && (
        <a href="/settings?tab=billing" className="inline-flex items-center rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2">
          Choose a plan
        </a>
      )}
    </div>
  );
};

interface MainLayoutProps {
  children: React.ReactNode;
}

/** Shows the first-login walkthrough once per user per tenant. */
const OnboardingController: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    // Server-side flag is authoritative and device-independent; fall back to the
    // legacy per-device localStorage flag only if the server flag is absent.
    if ((user as any).hasOnboarded === true) return;
    if (!isOnboardingComplete(user.id, user.tenantId)) {
      // Small delay so the dashboard renders behind the modal first.
      const t = setTimeout(() => setShow(true), 600);
      return () => clearTimeout(t);
    }
  }, [user?.id, user?.tenantId, (user as any)?.hasOnboarded]);

  // Explicit replay from the Guide page: the stored "done" flags (and the
  // server-side hasOnboarded) would otherwise suppress a repeat showing, so the
  // Guide fires this event to force the walkthrough open regardless.
  useEffect(() => {
    const consumeFlag = () => {
      try { sessionStorage.removeItem(REPLAY_WALKTHROUGH_FLAG); } catch { /* ignore */ }
    };
    const onReplay = () => { consumeFlag(); setShow(true); };
    // The Guide also leaves a one-shot flag: if this layout mounted AFTER the
    // event fired (slow lazy load / dashboard redirect), open from the flag.
    let pending = false;
    try { pending = sessionStorage.getItem(REPLAY_WALKTHROUGH_FLAG) === '1'; } catch { /* ignore */ }
    let t: ReturnType<typeof setTimeout> | undefined;
    if (pending) t = setTimeout(onReplay, 300);
    window.addEventListener('wiskul:replay-walkthrough', onReplay);
    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener('wiskul:replay-walkthrough', onReplay);
    };
  }, []);

  if (!show) return null;
  return <OnboardingGuide onClose={() => setShow(false)} />;
};

const COLLAPSE_KEY = 'wiskul.sidebar.collapsed';

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  // Drive the teacher offline sync loop (no-op for other roles / when online-first).
  useSyncEngine();
  // Auto-lock the app after inactivity → back to /login (re-auth required).
  useInactivityLock();

  // Global plan-limit / subscription-expiry prompt: apiClient broadcasts a
  // 'wiskul:plan-limit' event on those 403s; toast it once with an upgrade hint.
  useEffect(() => {
    const onLimit = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const isExpired = detail.code === 'SUBSCRIPTION_EXPIRED';
      const base = detail.message || (isExpired ? 'Your subscription has expired.' : 'Plan limit reached.');
      const role = useAuthStore.getState().user?.role;
      showToast.error(role === 'principal'
        ? `${base} Open Settings → Plan & Billing to upgrade or renew.`
        : `${base} Ask your principal about the school's plan.`);
      // The plan may have changed since sign-in: refresh what the sidebar shows.
      useAuthStore.getState().refreshUser?.().catch?.(() => undefined);
    };
    window.addEventListener('wiskul:plan-limit', onLimit as EventListener);
    return () => window.removeEventListener('wiskul:plan-limit', onLimit as EventListener);
  }, []);

  // Plan features drive the sidebar. Sessions restored from storage (or a
  // login response) may not carry them yet: fetch /me once to fill them in.
  const needsPlan = useAuthStore((s) => !!s.user && s.user.role !== 'super_admin' && s.user.planAccess === undefined);
  useEffect(() => {
    if (needsPlan) useAuthStore.getState().refreshUser?.().catch?.(() => undefined);
  }, [needsPlan]);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
  // Desktop-only: collapse the sidebar to a slim icon rail. Persisted.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMenuClick = () => {
    if (window.innerWidth < 1024) {
      // Mobile: slide the sidebar in/out.
      setSidebarOpen((v) => !v);
    } else {
      // Desktop: collapse/expand the icon rail (and persist).
      setCollapsed((v) => {
        const next = !v;
        try {
          localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
        } catch {
          /* ignore */
        }
        return next;
      });
    }
  };

  const handleToggleCollapse = () => {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const handleSidebarClose = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Support-mode banner (only while impersonating) */}
      <ImpersonationBanner />

      {/* Offline / web-update strip (only when relevant) */}
      <OfflineBanner />
      {/* Native APK update prompt (installed app only, when a newer APK exists) */}
      <NativeUpdateBanner />

      {/* Header */}
      <Header onMenuClick={handleMenuClick} sidebarOpen={sidebarOpen} />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={handleSidebarClose}
          collapsed={collapsed}
          onToggleCollapse={handleToggleCollapse}
        />

        {/* Content area — tight horizontal gutter on mobile so content isn't
            choked; comfortable padding from sm upwards. Subtle radial texture
            adds depth without noise. */}
        <main
          className="flex-1 overflow-y-auto"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(99,102,241,0.05) 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        >
          <div className="px-2 py-3 sm:p-6 animate-page-enter">
            <DemoSchoolBanner />
            <SubscriptionLapsedBanner />
            <PlanRestrictionsBanner />
            <PromotionWelcomeBanner />
            {children}
          </div>
        </main>
      </div>

      {/* First-login onboarding walkthrough */}
      <OnboardingController />

      {/* One-time "verify your school" announcement for existing unverified owners */}
      <VerifyIntroModal />

      {/* One-time result-released popup for students & parents (promotion / term result) */}
      <ResultReleasePopup />
    </div>
  );
};

export default MainLayout;
