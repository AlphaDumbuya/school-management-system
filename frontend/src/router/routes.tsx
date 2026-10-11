/**
 * Route Configuration
 * All application routes with role-based access control
 */

import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate, useSearchParams } from 'react-router-dom';
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
import SupportPage from '@pages/SupportPage';
import SupportTopicPage from '@pages/SupportTopicPage';
import PlatformSupportPage from '@pages/PlatformSupportPage';
import { PlatformTenantsPage } from '@pages/PlatformTenantsPage';
import { PlatformSubscriptionsPage } from '@pages/PlatformSubscriptionsPage';
import { PlatformAnalyticsPage } from '@pages/PlatformAnalyticsPage';
import PlatformCommunicationPage from '@pages/PlatformCommunicationPage';
import SyncIssuesPage from '@pages/offline/SyncIssuesPage';
import { ComingSoonPage } from '@pages/ComingSoonPage';
import { AcademicArchivePage } from '@pages/reports/AcademicArchivePage';
import { SettingsPage } from '@pages/SettingsPage';

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
import PublicAdmissionPage from '@pages/students/PublicAdmissionPage';
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
import DiscountsPage from '@pages/finance/DiscountsPage';
import AgingPage from '@pages/finance/AgingPage';
import PettyCashPage from '@pages/finance/PettyCashPage';
import BudgetsPage from '@pages/finance/BudgetsPage';
import PayrollPage from '@pages/finance/PayrollPage';
import MyPayslipsPage from '@pages/finance/MyPayslipsPage';
import ChartOfAccountsPage from '@pages/finance/ChartOfAccountsPage';
import JournalPage from '@pages/finance/JournalPage';
import FinancialReportsPage from '@pages/finance/FinancialReportsPage';
import BankReconciliationPage from '@pages/finance/BankReconciliationPage';
import FinanceAuditPage from '@pages/finance/FinanceAuditPage';
import ExpensesPage from '@pages/finance/ExpensesPage';
import MyFeesPage from '@pages/finance/MyFeesPage';
import TeachersPage from '@pages/staff/TeachersPage';
import NonTeachingStaffPage from '@pages/staff/NonTeachingStaffPage';
// SMS & WhatsApp module removed — in-app communication (Announcements + Support)
// replaces this feature in V1.

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
import DemoStartPage from '@pages/DemoStartPage';
import PlatformDemoRequestsPage from '@pages/PlatformDemoRequestsPage';
import WelcomePage, { hasOnboarded } from '@pages/WelcomePage';
import VerificationPage from '@pages/VerificationPage';
import VerifyReportCardPage from '@pages/VerifyReportCardPage';
import UnsubscribePage from '@pages/UnsubscribePage';
import PrivacyPolicyPage from '@pages/PrivacyPolicyPage';
import RestoreAccessPage from '@pages/RestoreAccessPage';
import RequestReactivationPage from '@pages/RequestReactivationPage';
import { isAppMode } from '@lib/appMode';
import OfflineGate from '@components/offline/OfflineGate';

/**
 * App mode = native Capacitor build (VITE_APP_TARGET=native) OR an installed
 * standalone PWA. In app mode we drop the public marketing site — the app is
 * for signed-in school users, so it opens straight at the auth pages. The web
 * (browser tab) experience keeps the full marketing site.
 */
const APP_MODE = isAppMode();

// Public marketing pages — web only. In app mode, the index shows the one-time
// welcome guide on first launch, then goes straight to /login afterwards.
const publicMarketingRoutes = APP_MODE
  ? [{ index: true, element: <Navigate to={hasOnboarded() ? '/login' : '/welcome'} replace /> }]
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
        // One-time app onboarding guide (app mode only; web redirects to home).
        { path: 'welcome', element: APP_MODE ? <WelcomePage /> : <Navigate to="/" replace /> },
        { path: 'login', element: <LoginPage /> },
        // Personal sign-in links from the demo email (web + app).
        { path: 'demo/start', element: <DemoStartPage /> },
        // Payment return landing (after Monime hosted checkout). PUBLIC so it
        // resolves on the hard browser redirect back from Monime even before
        // auth state rehydrates — the page only needs the ?session query param.
        { path: 'finance/pay/return', element: <PaymentReturnPage /> },
        { path: 'apply/:schoolSlug', element: <PublicAdmissionPage /> },
        { path: 'forgot-password', element: <ForgotPasswordPage /> },
        { path: 'reset-password', element: <ResetPasswordPage /> },
        // School registration is a marketing/web action only — in app mode redirect to login.
        { path: 'register', element: APP_MODE ? <Navigate to="/login" replace /> : <RegisterPage /> },
        { path: 'newsletter/unsubscribe', element: <UnsubscribePage /> },
        { path: 'privacy-policy', element: <PrivacyPolicyPage /> },
        // Public "pay to restore access" for a suspended school (no login).
        { path: 'restore-access', element: <RestoreAccessPage /> },
        // Public reactivation request for non-payment suspensions (no login).
        { path: 'request-reactivation', element: <RequestReactivationPage /> },
        { path: 'verify-id', element: <VerifyIdPage /> },
        // Report card verification — reached by scanning QR on printed report card.
        { path: 'verify-report-card/:hash', element: <VerifyReportCardPage /> },
        // Aliases for older/malformed QR paths so previously-printed cards still resolve.
        { path: 'verify/id', element: <VerifyIdPage /> },
        // Old QR format: /verify?type=report-card&student=...&year=...
        // Redirect to the new verification page. Old QR codes don't have class_id,
        // so we pass 'old-format' as the hash — the backend will look up the class
        // from the student's enrollments and return the report card data.
        {
          path: 'verify',
          element: (() => {
            const Redirect: React.FC = () => {
              const [params] = useSearchParams();
              const type = params.get('type');
              if (type === 'report-card') {
                const student = params.get('student') || '';
                const year = params.get('year') || '';
                const ref = params.get('ref') || 'old-format';
                return <Navigate to={`/verify-report-card/${ref}?s=${student}&y=${encodeURIComponent(year)}`} replace />;
              }
              return <VerifyIdPage />;
            };
            return <Redirect />;
          })(),
        },

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
        {
          path: 'support',
          element: <P requiredRoles={['principal', 'super_admin', 'teacher', 'accountant', 'admissions_officer']}><SupportPage /></P>,
        },
        {
          path: 'support/:collectionId',
          element: <P requiredRoles={['principal', 'super_admin', 'teacher', 'accountant', 'admissions_officer']}><SupportTopicPage /></P>,
        },
        {
          path: 'support/:collectionId/:articleId',
          element: <P requiredRoles={['principal', 'super_admin', 'teacher', 'accountant', 'admissions_officer']}><SupportTopicPage /></P>,
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
          element: <P requiredRoles={['principal', 'super_admin', 'teacher', 'admissions_officer']}><ClassesPage /></P>,
        },
        {
          path: 'academic/subjects',
          element: <P requiredRoles={['principal', 'super_admin', 'teacher', 'admissions_officer', 'student', 'parent']}><SubjectsPage /></P>,
        },
        {
          path: 'academic/timetables',
          element: <P requiredRoles={['principal', 'super_admin', 'teacher', 'admissions_officer', 'student', 'parent']}><TimetablesPage /></P>,
        },
        {
          path: 'academic/assignments',
          element: <P requiredRoles={['principal', 'super_admin', 'teacher', 'student', 'parent']}><AssignmentsPage /></P>,
        },
        {
          path: 'academic/exam-timetable',
          element: <P requiredRoles={['principal', 'super_admin', 'teacher', 'student', 'parent', 'admissions_officer']}><ExamTimetablePage /></P>,
        },
        {
          path: 'academic/results',
          element: <P requiredRoles={['principal', 'super_admin', 'teacher', 'student', 'parent', 'admissions_officer', 'accountant']}><ResultsPage /></P>,
        },
        {
          path: 'academic/report-cards',
          element: <P requiredRoles={['principal', 'super_admin', 'teacher', 'student', 'parent', 'admissions_officer', 'accountant']}><ReportCardsPage /></P>,
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
          // Staff sign-in / sign-out: every professional staff member.
          path: 'staff/attendance',
          element: <P requiredRoles={['principal', 'super_admin', 'teacher', 'accountant', 'admissions_officer']}><AttendancePage /></P>,
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
          // Non-teaching staff: accountants and admissions officers.
          path: 'staff/members',
          element: <P requiredRoles={['principal', 'super_admin']}><G feature="Non-Teaching Staff"><NonTeachingStaffPage /></G></P>,
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
        // (Payment return landing is registered as a PUBLIC route above.)
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
          element: <P requiredRoles={['principal', 'super_admin', 'accountant']}><G feature="Expenses"><ExpensesPage /></G></P>,
        },
        {
          path: 'finance/petty-cash',
          element: <P requiredRoles={['principal', 'super_admin', 'accountant']}><G feature="Petty cash"><PettyCashPage /></G></P>,
        },
        {
          path: 'finance/budgets',
          element: <P requiredRoles={['principal', 'super_admin', 'accountant']}><G feature="Budgets"><BudgetsPage /></G></P>,
        },
        {
          path: 'finance/payroll',
          element: <P requiredRoles={['principal', 'super_admin', 'accountant']}><G feature="Payroll"><PayrollPage /></G></P>,
        },
        {
          path: 'finance/accounts',
          element: <P requiredRoles={['principal', 'super_admin', 'accountant']}><G feature="Chart of accounts"><ChartOfAccountsPage /></G></P>,
        },
        {
          path: 'finance/journal',
          element: <P requiredRoles={['principal', 'super_admin', 'accountant']}><G feature="Journal"><JournalPage /></G></P>,
        },
        {
          path: 'finance/reports',
          element: <P requiredRoles={['principal', 'super_admin', 'accountant']}><G feature="Financial reports"><FinancialReportsPage /></G></P>,
        },
        {
          path: 'finance/bank-reconciliation',
          element: <P requiredRoles={['principal', 'super_admin', 'accountant']}><G feature="Bank reconciliation"><BankReconciliationPage /></G></P>,
        },
        {
          path: 'finance/audit-log',
          element: <P requiredRoles={['principal', 'super_admin', 'accountant']}><G feature="Finance audit log"><FinanceAuditPage /></G></P>,
        },
        {
          path: 'finance/my-payslips',
          element: <P requiredRoles={['principal', 'teacher', 'accountant', 'admissions_officer']}><MyPayslipsPage /></P>,
        },
        {
          path: 'finance/discounts',
          element: <P requiredRoles={['principal', 'super_admin', 'accountant']}><G feature="Discounts"><DiscountsPage /></G></P>,
        },
        {
          path: 'finance/aging',
          element: <P requiredRoles={['principal', 'super_admin', 'accountant']}><G feature="Arrears"><AgingPage /></G></P>,
        },
        {
          path: 'finance/my-fees',
          element: <P requiredRoles={['student', 'parent', 'guardian']}><MyFeesPage /></P>,
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
          element: <P requiredRoles={['principal', 'super_admin', 'admissions_officer']}><TemplatesPage /></P>,
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
          element: <P requiredRoles={['principal', 'super_admin']}><AcademicArchivePage /></P>,
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
        {
          path: 'platform/demo-requests',
          element: <P requiredRoles={['super_admin']}><G feature="Demo requests"><PlatformDemoRequestsPage /></G></P>,
        },
        {
          path: 'platform/support',
          element: <P requiredRoles={['super_admin']}><G feature="Support triage"><PlatformSupportPage /></G></P>,
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
          // School verification — account owner (principal).
          path: 'verify-school',
          element: <P requiredRoles={['principal']}><VerificationPage /></P>,
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
        { path: 'import-export', element: <P requiredRoles={['principal', 'super_admin', 'admissions_officer']}><Navigate to="/students/directory" replace /></P> },

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
