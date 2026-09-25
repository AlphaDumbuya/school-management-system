/**
 * Protected Route Component
 * Guards routes that require authentication
 * Phase 11: Frontend Dashboard Implementation
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import useAuth, { getDashboardPath } from '@hooks/useAuth';
import { UserRole } from '@appTypes/index';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles,
}) => {
  const { isAuthenticated, canAccess, isLoading, user } = useAuth();

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

  // Not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check role-based access. When the user's role doesn't grant this route —
  // e.g. they were just promoted/migrated to a different portal — send them to
  // THEIR correct dashboard rather than a dead-end "unauthorized" page. This is
  // what makes a promotion "move" a staff member into their new portal cleanly.
  if (requiredRoles && !canAccess(requiredRoles)) {
    const home = user ? getDashboardPath(user.role) : '/login';
    return <Navigate to={home} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
