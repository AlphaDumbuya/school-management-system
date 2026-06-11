/**
 * Route Configuration
 * All application routes
 * Phase 11: Frontend Dashboard Implementation
 */

import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import LoginPage from '@pages/LoginPage';
import AdminDashboard from '@pages/AdminDashboard';

// Placeholder pages for other roles
const TeacherDashboard = () => <AdminDashboard />;
const StudentDashboard = () => <AdminDashboard />;
const ParentDashboard = () => <AdminDashboard />;

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

const router = createBrowserRouter([
  {
    path: '/',
    children: [
      {
        path: '/',
        element: <Navigate to="/dashboard" />,
      },
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute>
            <AdminDashboard />
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
]);

interface AppRouterProps {}

export const AppRouter: React.FC<AppRouterProps> = () => {
  return <RouterProvider router={router} />;
};

// Import Navigate
import { Navigate } from 'react-router-dom';

export default AppRouter;
