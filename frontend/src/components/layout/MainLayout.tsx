/**
 * Main Layout Component
 * Wrapper for main application layout with sidebar and header
 * Phase 11: Frontend Dashboard Implementation
 */

import React, { useState, useEffect } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import useAuthStore from '@store/authStore';
import { isOnboardingComplete } from '@lib/onboarding';
import OnboardingGuide from '@components/onboarding/OnboardingGuide';
import ImpersonationBanner from './ImpersonationBanner';
import PromotionWelcomeBanner from './PromotionWelcomeBanner';
import OfflineBanner from '@components/offline/OfflineBanner';
import { useSyncEngine } from '../../offline/useSyncEngine';
import useInactivityLock from '@hooks/useInactivityLock';
import VerifyIntroModal from '@components/verification/VerifyIntroModal';
import { ResultReleasePopup } from '@components/results/ResultReleasePopup';
import { showToast } from '@utils/toast';

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
      showToast.error(`${base} Open Settings → Plan & Billing to upgrade or renew.`);
    };
    window.addEventListener('wiskul:plan-limit', onLimit as EventListener);
    return () => window.removeEventListener('wiskul:plan-limit', onLimit as EventListener);
  }, []);

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

      {/* Offline / update-available strip (only when relevant) */}
      <OfflineBanner />

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
