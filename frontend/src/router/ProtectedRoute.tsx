/**
 * Protected Route Component
 * Guards routes that require authentication
 * Phase 11: Frontend Dashboard Implementation
 */

import React from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Lock } from 'lucide-react';
import useAuth, { getDashboardPath } from '@hooks/useAuth';
import { AuthUser, UserRole } from '@appTypes/index';
import { planAccessOf, routeAccess } from '@lib/planFeatures';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles,
}) => {
  const { isAuthenticated, canAccess, isLoading, user } = useAuth();
  const location = useLocation();

  // Show loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated: remember where they were going (email links, bookmarks)
  // so login brings them straight back.
  if (!isAuthenticated) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    const to = next && next !== '/' ? `/login?next=${encodeURIComponent(next)}` : '/login';
    return <Navigate to={to} replace />;
  }

  // Check role-based access. When the user's role doesn't grant this route —
  // e.g. they were just promoted/migrated to a different portal — send them to
  // THEIR correct dashboard rather than a dead-end "unauthorized" page. This is
  // what makes a promotion "move" a staff member into their new portal cleanly.
  if (requiredRoles && !canAccess(requiredRoles)) {
    const home = user ? getDashboardPath(user.role) : '/login';
    return <Navigate to={home} replace />;
  }

  // Plan features: a page outside the school's plan shows an upgrade note; a
  // read-only one (held on the trial / an earlier plan) shows a banner and the
  // server refuses changes.
  const access = routeAccess(user, location.pathname);
  if (access === 'locked') {
    return <PlanLockedNotice user={user} />;
  }
  // (A lapsed subscription has its own school-wide banner in MainLayout.)
  if (access === 'read_only' && !planAccessOf(user)?.lapsed) {
    return (
      <>
        <ReadOnlyBanner user={user} />
        {children}
      </>
    );
  }

  return <>{children}</>;
};

const canManageBilling = (user: AuthUser | null) => user?.role === 'principal';

const ReadOnlyBanner: React.FC<{ user: AuthUser | null }> = ({ user }) => {
  const pa = planAccessOf(user);
  return (
    <div role="status" className="mx-3 sm:mx-6 mt-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3 text-sm text-amber-900 dark:text-amber-200 flex flex-wrap items-center gap-x-3 gap-y-2">
      <Lock size={16} aria-hidden="true" className="flex-shrink-0" />
      <span className="flex-1 min-w-[12rem]">
        {pa?.lapsed
          ? 'Your subscription has ended, so this page is read-only. Your records are safe.'
          : `Read-only on the ${pa?.planName || 'current'} plan. Your existing records are kept and can be viewed; upgrade to add or change them.`}
      </span>
      {canManageBilling(user) && (
        <Link to="/settings?tab=billing" className="font-semibold underline underline-offset-2 hover:no-underline">
          {pa?.lapsed ? 'Renew' : 'Upgrade'}
        </Link>
      )}
    </div>
  );
};

const PlanLockedNotice: React.FC<{ user: AuthUser | null }> = ({ user }) => {
  const pa = planAccessOf(user);
  const home = user ? getDashboardPath(user.role) : '/login';
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-sm">
        <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-300">
          <Lock size={22} aria-hidden="true" />
        </div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">Not included in your plan</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          This feature isn’t part of the {pa?.planName || 'current'} plan.
          {canManageBilling(user) ? ' Upgrade to start using it.' : ' Ask your principal about upgrading the school’s plan.'}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {canManageBilling(user) && (
            <Link to="/settings?tab=billing" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">See plans</Link>
          )}
          <Link to={home} className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">Back to dashboard</Link>
        </div>
      </div>
    </div>
  );
};

export default ProtectedRoute;
