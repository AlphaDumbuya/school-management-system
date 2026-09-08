/**
 * Route Configuration
 * All application routes with role-based access control
 */

import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import LoginPage from '@pages/LoginPage';
import ForgotPasswordPage from '@pages/ForgotPasswordPage';
import ResetPasswordPage from '@pages/ResetPasswordPage';
import LandingPage from '@pages/LandingPage';
import FeaturesPage from '@pages/FeaturesPage';
import PricingPage from '@pages/PricingPage';
import WhyWiskulPage from '@pages/WhyWiskulPage';
import BenefitsPage from '@pages/BenefitsPage';
import ContactPage from '@pages/ContactPage';
import AdminDashboard from '@pages/AdminDashboard';
import { Phase13TeacherDashboard } from '@pages/Phase13TeacherDashboard';
import { Phase13StudentDashboard } from '@pages/Phase13StudentDashboard';
import { Phase13ParentDashboard } from '@pages/Phase13ParentDashboard';
import { Phase13AccountantDashboard } from '@pages/Phase13AccountantDashboard';
import { Phase13AdmissionsDashboard } from '@pages/Phase13AdmissionsDashboard';
import SuperAdminDashboard from '@pages/SuperAdminDashboard';
import GuidePage from '@pages/GuidePage';
import AnnouncementsPage from '@pages/communication/AnnouncementsPage';
import TenantDetailPage from '@pages/TenantDetailPage';
import { PlatformTenantsPage } from '@pages/PlatformTenantsPage';
import { PlatformSubscriptionsPage } from '@pages/PlatformSubscriptionsPage';
import { PlatformAnalyticsPage } from '@pages/PlatformAnalyticsPage';
import PlatformCommunicationPage from '@pages/PlatformCommunicationPage';
import SyncIssuesPage from '@pages/offline/SyncIssuesPage';
import { ComingSoonPage } from '@pages/ComingSoonPage';
import { SettingsPage } from '@pages/SettingsPage';
import SMSWhatsAppDashboard from '@pages/SMSWhatsAppDashboard';

// Built pages
import ClassesPage from '@pages/academic/ClassesPage';
import SubjectsPage from '@pages/academic/SubjectsPage';
import TimetablesPage from '@pages/academic/TimetablesPage';
import AssignmentsPage from '@pages/academic/AssignmentsPage';
import ExamTimetablePage from '@pages/academic/ExamTimetablePage';
import ResultsPage from '@pages/academic/ResultsPage';
import ReportCardsPage from '@pages/academic/ReportCardsPage';
import PromotionsPage from '@pages/academic/PromotionsPage';
import StudentDirectoryPage from '@pages/students/StudentDirectoryPage';
import AdmissionsPage from '@pages/students/AdmissionsPage';
import { StudentProfilesPage } from '@pages/students/StudentProfilesPage';
import { AttendancePage } from '@pages/students/AttendancePage';
import DisciplinePage from '@pages/discipline/DisciplinePage';
import { EventsPage } from '@pages/events/EventsPage';
import { EventDetailsPage } from '@pages/events/EventDetailsPage';
import { CalendarPage } from '@pages/events/CalendarPage';
import { MyEventsPage } from '@pages/events/MyEventsPage';
import { EventAnalyticsPage } from '@pages/events/EventAnalyticsPage';
import { IdCardsPage } from '@pages/identity/IdCardsPage';
import { TemplatesPage } from '@pages/identity/TemplatesPage';
import VerifyIdPage from '@pages/identity/VerifyIdPage';
import PaymentReturnPage from '@pages/finance/PaymentReturnPage';
import FeesPage from '@pages/finance/FeesPage';
import InvoicesPage from '@pages/finance/InvoicesPage';
import PaymentsPage from '@pages/finance/PaymentsPage';
import TeachersPage from '@pages/staff/TeachersPage';

import useAuthStore from '@store/authStore';
import { getDashboardPath } from '@hooks/useAuth';

const DashboardRedirect: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  const path = getDashboardPath(user.role);
  if (path === '/admin/dashboard') return <AdminDashboard />;
  return <Navigate to={path} replace />;
};

const NotFound = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="text-center">
      <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">404</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">Page not found</p>
      <a href="/dashboard" className="text-blue-600 hover:underline">Back to dashboard</a>
    </div>
  </div>
);

const Unauthorized = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="text-center">
      <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">403</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">You don't have permission to access this page</p>
      <a href="/dashboard" className="text-blue-600 hover:underline">Back to dashboard</a>
    </div>
  </div>
);

// Shorthand wrappers
const P = ProtectedRoute;
const CS = ComingSoonPage;
// Online-only gate: shows a "requires internet" state offline (for admin/finance/
// admissions/reports/communications/platform modules).
const G: React.FC<{ children: React.ReactNode; feature?: string }> = ({ children, feature }) => (
  <OfflineGate feature={feature}>{children}</OfflineGate>
);

// Version 2 Feature Gate (Set to true when rolling out v2.0.0)
const V2_ENABLED = false;

const V2Route: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (!V2_ENABLED) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

import RegisterPage from '@pages/RegisterPage';
import UnsubscribePage from '@pages/UnsubscribePage';
import PrivacyPolicyPage from '@pages/PrivacyPolicyPage';
import { isAppMode } from '@lib/appMode';
import OfflineGate from '@components/offline/OfflineGate';

/**
 * App mode = native Capacitor build (VITE_APP_TARGET=native) OR an installed
 * standalone PWA. In app mode we drop the public marketing site — the app is
 * for signed-in school users, so it opens straight at the auth pages. The web
 * (browser tab) experience keeps the full marketing site.
 */
const APP_MODE = isAppMode();

// Public marketing pages — web only. In app mode, the index redirects to /login.
const publicMarketingRoutes = APP_MODE
  ? [{ index: true, element: <Navigate to="/login" replace /> }]
  : [
      { index: true, element: <LandingPage /> },
      { path: 'features', element: <FeaturesPage /> },
      { path: 'pricing', element: <PricingPage /> },
      { path: 'why', element: <WhyWiskulPage /> },
      { path: 'benefits', element: <BenefitsPage /> },
      { path: 'contact', element: <ContactPage /> },
    ];

const router = createBrowserRouter(
  [
    {
      path: '/',
      children: [
        ...publicMarketingRoutes,
        // Auth pages — always present (web + app).
        { path: 'login', element: <LoginPage /> },
        { path: 'forgot-password', element: <ForgotPasswordPage /> },
        { path: 'reset-password', element: <ResetPasswordPage /> },
        // School registration is a marketing/web action only — in app mode redirect to login.
        { path: 'register', element: APP_MODE ? <Navigate to="/login" replace /> : <RegisterPage /> },
        { path: 'newsletter/unsubscribe', element: <UnsubscribePage /> },
        { path: 'privacy-policy', element: <PrivacyPolicyPage /> },
        { path: 'verify-id', element: <VerifyIdPage /> },
        // Aliases for older/malformed QR paths so previously-printed cards still resolve.
        { path: 'verify/id', element: <VerifyIdPage /> },
        { path: 'verify', element: <VerifyIdPage /> },

        // ── Generic dashboard redirect ──────────────────────────────
        {
          path: 'dashboard',
          element: <P><DashboardRedirect /></P>,
        },

        // ── Platform guide (all authenticated roles) ────────────────
        {
          path: 'guide',
          element: <P><GuidePage /></P>,
        },

        // ── Role dashboards ─────────────────────────────────────────
        {
          path: 'admin/dashboard',
          element: <P requiredRoles={['principal', 'super_admin']}><AdminDashboard /></P>,
        },
        {
          path: 'platform/dashboard',
          element: <P requiredRoles={['super_admin']}><SuperAdminDashboard /></P>,
        },
        {
          path: 'teacher/dashboard',
          element: <P requiredRoles={['teacher']}><Phase13TeacherDashboard /></P>,
        },
        {
          path: 'student/dashboard',
          element: <P requiredRoles={['student']}><Phase13StudentDashboard /></P>,
        },
        {
          path: 'parent/dashboard',
          element: <P requiredRoles={['parent']}><Phase13ParentDashboard /></P>,
        },
        {
          path: 'accountant/dashboard',
          element: <P requiredRoles={['accountant']}><Phase13AccountantDashboard /></P>,
        },
        {
          path: 'admissions/dashboard',
          element: <P requiredRoles={['admissions_officer']}><Phase13AdmissionsDashboard /></P>,
        },

        // ── ACADEMIC MANAGEMENT ────────────────────────────────────
        {
          path: 'academic/classes',
          element: <P requiredRoles={['principal', 'super_admin', 'teacher']}><ClassesPage /></P>,
        },
        {
          path: 'academic/subjects',
          element: <P requiredRoles={['principal', 'super_admin']}><SubjectsPage /></P>,
        },
        {
          path: 'academic/timetables',
          element: <P requiredRoles={['principal', 'super_admin', 'teacher']}><TimetablesPage /></P>,
        },
        {
          path: 'academic/assignments',
          element: <P requiredRoles={['principal', 'super_admin', 'teacher', 'student', 'parent', 'guardian']}><AssignmentsPage /></P>,
        },
        {
          path: 'academic/exam-timetable',
          element: <P requiredRoles={['principal', 'super_admin', 'teacher']}><ExamTimetablePage /></P>,
        },
        {
          path: 'academic/results',
          element: <P requiredRoles={['principal', 'super_admin', 'teacher', 'student', 'parent']}><ResultsPage /></P>,
        },
        {
          path: 'academic/report-cards',
          element: <P requiredRoles={['principal', 'super_admin', 'teacher', 'student', 'parent']}><ReportCardsPage /></P>,
        },
        {
          path: 'academic/promotions',
          element: <P requiredRoles={['principal', 'super_admin']}><PromotionsPage /></P>,
        },

        // ── STUDENT MANAGEMENT ─────────────────────────────────────
        {
          path: 'students/directory',
          element: <P requiredRoles={['principal', 'super_admin', 'teacher', 'admissions_officer']}><StudentDirectoryPage /></P>,
        },
        {
          path: 'students/admissions',
          element: <P requiredRoles={['principal', 'super_admin', 'admissions_officer']}><G feature="Admissions"><AdmissionsPage /></G></P>,
        },
        {
          path: 'students/profiles',
          element: <P requiredRoles={['principal', 'super_admin', 'teacher', 'admissions_officer']}><StudentProfilesPage /></P>,
        },
        {
          path: 'students/attendance',
          element: <P requiredRoles={['principal', 'super_admin', 'teacher', 'parent', 'student']}><AttendancePage /></P>,
        },
        {
          path: 'discipline',
          element: <P requiredRoles={['principal', 'super_admin', 'teacher']}><DisciplinePage /></P>,
        },

        // ── STAFF MANAGEMENT ───────────────────────────────────────
        {
          path: 'staff/teachers',
          element: <P requiredRoles={['principal', 'super_admin']}><TeachersPage /></P>,
        },
        {
          path: 'staff/members',
          element: <P requiredRoles={['principal', 'super_admin']}><V2Route><CS /></V2Route></P>,
        },
        {
          path: 'staff/leave',
          element: <P requiredRoles={['principal', 'super_admin', 'teacher']}><V2Route><CS /></V2Route></P>,
        },
        {
          path: 'staff/performance',
          element: <P requiredRoles={['principal', 'super_admin']}><V2Route><CS /></V2Route></P>,
        },

        // ── FINANCIAL MANAGEMENT ───────────────────────────────────
        {
          // Payment return landing (after Monime hosted checkout) — any signed-in payer.
          path: 'finance/pay/return',
          element: <P><PaymentReturnPage /></P>,
        },
        {
          path: 'finance/fees',
          element: <P requiredRoles={['principal', 'super_admin', 'accountant']}><G feature="Fees"><FeesPage /></G></P>,
        },
        {
          path: 'finance/invoices',
          element: <P requiredRoles={['principal', 'super_admin', 'accountant']}><G feature="Invoices"><InvoicesPage /></G></P>,
        },
        {
          path: 'finance/payments',
          element: <P requiredRoles={['principal', 'super_admin', 'accountant']}><G feature="Payments"><PaymentsPage /></G></P>,
        },
        {
          path: 'finance/expenses',
          element: <P requiredRoles={['principal', 'super_admin', 'accountant']}><V2Route><CS /></V2Route></P>,
        },
        {
          path: 'finance/payroll',
          element: <P requiredRoles={['principal', 'super_admin', 'accountant']}><V2Route><CS /></V2Route></P>,
        },
        {
          path: 'finance/scholarships',
          element: <P requiredRoles={['principal', 'super_admin', 'accountant']}><V2Route><CS /></V2Route></P>,
        },

        // ── COMMUNICATION ──────────────────────────────────────────
        {
          path: 'communication/announcements',
          element: <P requiredRoles={['principal', 'super_admin', 'teacher', 'parent', 'student', 'accountant', 'admissions_officer']}><AnnouncementsPage /></P>,
        },
        {
          path: 'communication/messages',
          element: <P requiredRoles={['principal', 'super_admin', 'teacher', 'parent', 'student']}><V2Route><CS /></V2Route></P>,
        },
        {
          path: 'communication/sms',
          element: <P requiredRoles={['principal', 'super_admin', 'teacher']}><V2Route><SMSWhatsAppDashboard /></V2Route></P>,
        },
        {
          path: 'communication/email',
          element: <P requiredRoles={['principal', 'super_admin', 'accountant', 'admissions_officer']}><V2Route><CS /></V2Route></P>,
        },

        // ── IDENTITY MANAGEMENT ────────────────────────────────────
        {
          path: 'identity/cards',
          element: <P requiredRoles={['principal', 'super_admin', 'admissions_officer']}><IdCardsPage /></P>,
        },
        {
          path: 'identity/templates',
          element: <P requiredRoles={['principal', 'super_admin']}><TemplatesPage /></P>,
        },
        {
          path: 'identity/qr-codes',
          element: <P requiredRoles={['principal', 'super_admin', 'admissions_officer']}><V2Route><CS /></V2Route></P>,
        },

        // ── EVENTS MANAGEMENT ──────────────────────────────────────
        {
          path: 'events/school',
          element: <P requiredRoles={['principal', 'super_admin', 'teacher', 'parent', 'student']}><EventsPage /></P>,
        },
        {
          path: 'events/school/:eventId',
          element: <P requiredRoles={['principal', 'super_admin', 'teacher', 'parent', 'student']}><EventDetailsPage /></P>,
        },
        {
          path: 'events/calendar',
          element: <P requiredRoles={['principal', 'super_admin', 'teacher', 'parent', 'student']}><CalendarPage /></P>,
        },
        {
          path: 'events/my-events',
          element: <P requiredRoles={['principal', 'super_admin', 'teacher', 'parent', 'student']}><MyEventsPage /></P>,
        },
        {
          path: 'events/analytics',
          element: <P requiredRoles={['principal', 'super_admin']}><EventAnalyticsPage /></P>,
        },

        // ── REPORTS & ANALYTICS ────────────────────────────────────
        {
          path: 'reports/academic',
          element: <P requiredRoles={['principal', 'super_admin', 'teacher']}><V2Route><CS /></V2Route></P>,
        },
        {
          path: 'reports/financial',
          element: <P requiredRoles={['principal', 'super_admin', 'accountant']}><V2Route><CS /></V2Route></P>,
        },
        {
          path: 'reports/attendance',
          element: <P requiredRoles={['principal', 'super_admin', 'teacher']}><V2Route><CS /></V2Route></P>,
        },
        {
          path: 'reports/enrollment',
          element: <P requiredRoles={['principal', 'super_admin', 'admissions_officer']}><V2Route><CS /></V2Route></P>,
        },
        {
          path: 'reports/discipline',
          element: <P requiredRoles={['principal', 'super_admin']}><V2Route><CS /></V2Route></P>,
        },

        // ── PLATFORM MANAGEMENT (super admin) ─────────────────────
        {
          path: 'platform/tenants',
          element: <P requiredRoles={['super_admin']}><G feature="Tenant management"><PlatformTenantsPage /></G></P>,
        },
        {
          path: 'platform/tenants/:tenantId',
          element: <P requiredRoles={['super_admin']}><G feature="Tenant management"><TenantDetailPage /></G></P>,
        },
        {
          path: 'platform/subscriptions',
          element: <P requiredRoles={['super_admin']}><G feature="Subscriptions"><PlatformSubscriptionsPage /></G></P>,
        },
        {
          path: 'platform/analytics',
          element: <P requiredRoles={['super_admin']}><G feature="Platform analytics"><PlatformAnalyticsPage /></G></P>,
        },
        {
          path: 'platform/communications',
          element: <P requiredRoles={['super_admin']}><G feature="Communications"><PlatformCommunicationPage /></G></P>,
        },

        // ── SYSTEM ─────────────────────────────────────────────────
        {
          path: 'sync-issues',
          element: <P requiredRoles={['teacher']}><SyncIssuesPage /></P>,
        },
        {
          path: 'settings',
          element: <P><SettingsPage /></P>,
        },
        {
          path: 'profile',
          element: <P><CS /></P>,
        },

        // ── LEGACY paths kept so old bookmarks don't 404 ───────────
        { path: 'students', element: <P requiredRoles={['principal', 'teacher', 'admissions_officer']}><CS /></P> },
        { path: 'classes', element: <P requiredRoles={['principal', 'teacher']}><Navigate to="/academic/classes" replace /></P> },
        { path: 'subjects', element: <P requiredRoles={['principal']}><Navigate to="/academic/subjects" replace /></P> },
        { path: 'timetable', element: <P requiredRoles={['principal', 'teacher']}><Navigate to="/academic/timetables" replace /></P> },
        { path: 'examinations', element: <P requiredRoles={['principal', 'teacher']}><Navigate to="/academic/exam-timetable" replace /></P> },
        { path: 'grades', element: <P requiredRoles={['principal', 'teacher', 'student']}><Navigate to="/academic/results" replace /></P> },
        { path: 'attendance', element: <P requiredRoles={['principal', 'teacher', 'student']}><Navigate to="/students/attendance" replace /></P> },
        { path: 'teachers', element: <P requiredRoles={['principal']}><Navigate to="/staff/teachers" replace /></P> },
        { path: 'staff', element: <P requiredRoles={['principal']}><Navigate to="/staff/members" replace /></P> },
        { path: 'announcements', element: <P requiredRoles={['principal']}><Navigate to="/communication/announcements" replace /></P> },
        { path: 'messages', element: <P requiredRoles={['principal']}><Navigate to="/communication/messages" replace /></P> },
        { path: 'notifications', element: <P requiredRoles={['principal']}><Navigate to="/communication/announcements" replace /></P> },
        { path: 'finance', element: <P requiredRoles={['principal', 'accountant']}><Navigate to="/finance/fees" replace /></P> },
        { path: 'reports', element: <P requiredRoles={['principal', 'accountant']}><Navigate to="/reports/academic" replace /></P> },
        { path: 'users', element: <P requiredRoles={['principal']}><CS /></P> },
        { path: 'import-export', element: <P requiredRoles={['principal']}><CS /></P> },

        // ── Error pages ─────────────────────────────────────────────
        { path: 'unauthorized', element: <Unauthorized /> },
        { path: '*', element: <NotFound /> },
      ],
    },
  ],
  {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    } as any,
  }
);

export const AppRouter: React.FC = () => <RouterProvider router={router} />;
export default AppRouter;
