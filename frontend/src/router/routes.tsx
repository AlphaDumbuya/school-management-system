/**
 * Route Configuration
 * All application routes with role-based access control
 * Phase 11: Frontend Dashboard Implementation
 */

import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import LoginPage from '@pages/LoginPage';
import AdminDashboard from '@pages/AdminDashboard';
import { Phase13TeacherDashboard } from '@pages/Phase13TeacherDashboard';
import { Phase13StudentDashboard } from '@pages/Phase13StudentDashboard';
import { Phase13ParentDashboard } from '@pages/Phase13ParentDashboard';
import { Phase13AccountantDashboard } from '@pages/Phase13AccountantDashboard';
import { Phase13AdmissionsDashboard } from '@pages/Phase13AdmissionsDashboard';
import useAuthStore from '@store/authStore';
import { getDashboardPath } from '@hooks/useAuth';

/**
 * Redirects to the correct dashboard based on the logged-in user's role.
 * Handles the case where any role navigates to the generic /dashboard path.
 */
const DashboardRedirect: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  const path = getDashboardPath(user.role);
  // Admin/principal stay here — render inline to avoid a redirect loop
  if (path === '/admin/dashboard') return <AdminDashboard />;
  return <Navigate to={path} replace />;
};

const NotFound = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <h1 className="text-4xl font-bold text-gray-900 mb-2">404</h1>
      <p className="text-gray-600 mb-6">Page not found</p>
      <a href="/dashboard" className="text-blue-600 hover:underline">
        Back to dashboard
      </a>
    </div>
  </div>
);

const Unauthorized = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <h1 className="text-4xl font-bold text-gray-900 mb-2">403</h1>
      <p className="text-gray-600 mb-6">You don't have permission to access this page</p>
      <a href="/dashboard" className="text-blue-600 hover:underline">
        Back to dashboard
      </a>
    </div>
  </div>
);

const router = createBrowserRouter(
  [
    {
      path: '/',
      children: [
        {
          index: true,
          element: <Navigate to="/dashboard" replace />,
        },
        {
          path: 'login',
          element: <LoginPage />,
        },
        // Generic /dashboard — redirects each role to their specific dashboard
        {
          path: 'dashboard',
          element: (
            <ProtectedRoute>
              <DashboardRedirect />
            </ProtectedRoute>
          ),
        },
        // Admin & Principal dashboard
        {
          path: 'admin/dashboard',
          element: (
            <ProtectedRoute requiredRoles={['admin', 'principal']}>
              <AdminDashboard />
            </ProtectedRoute>
          ),
        },
        // Teacher dashboard
        {
          path: 'teacher/dashboard',
          element: (
            <ProtectedRoute requiredRoles={['teacher']}>
              <Phase13TeacherDashboard />
            </ProtectedRoute>
          ),
        },
        // Student dashboard
        {
          path: 'student/dashboard',
          element: (
            <ProtectedRoute requiredRoles={['student']}>
              <Phase13StudentDashboard />
            </ProtectedRoute>
          ),
        },
        // Parent / Guardian dashboard
        {
          path: 'parent/dashboard',
          element: (
            <ProtectedRoute requiredRoles={['parent']}>
              <Phase13ParentDashboard />
            </ProtectedRoute>
          ),
        },
        // Accountant dashboard
        {
          path: 'accountant/dashboard',
          element: (
            <ProtectedRoute requiredRoles={['accountant']}>
              <Phase13AccountantDashboard />
            </ProtectedRoute>
          ),
        },
        // Admissions officer dashboard
        {
          path: 'admissions/dashboard',
          element: (
            <ProtectedRoute requiredRoles={['admissions_officer']}>
              <Phase13AdmissionsDashboard />
            </ProtectedRoute>
          ),
        },
        {
          path: 'unauthorized',
          element: <Unauthorized />,
        },
        {
          path: '*',
          element: <NotFound />,
        },
      ],
    },
  ],
  {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    },
  }
);

interface AppRouterProps {}

export const AppRouter: React.FC<AppRouterProps> = () => {
  return <RouterProvider router={router} />;
};

export default AppRouter;
