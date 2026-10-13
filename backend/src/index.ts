import './utils/env.js';
import express, { Express, Request, Response, NextFunction } from 'express';
import { forwardAsyncRouteErrors } from './utils/asyncRouteErrors.js';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { logger } from '@utils/logger';
import { errorHandler } from '@middleware/errorHandler';
import { requestLogger } from '@middleware/requestLogger';
import { apiLimiter } from '@middleware/rateLimit';
import { tenantContext } from '@middleware/tenantContext';
import { db } from '@utils/database';
import authRoutes from '@routes/authRoutes';
import verificationRoutes from '@routes/verificationRoutes';
import userRoutes from '@routes/userRoutes';
import rbacRoutes from '@routes/rbacRoutes';
import studentRoutes from '@routes/studentRoutes';
import guardianRoutes from '@routes/guardianRoutes';
import classRoutes from '@routes/classRoutes';
import subjectRoutes from '@routes/subjectRoutes';
import timetableRoutes from '@routes/timetableRoutes';
import assignmentRoutes from '@routes/assignmentRoutes';
import examinationRoutes from '@routes/examinationRoutes';
import resultsRoutes from '@routes/resultsRoutes';
import uploadRoutes from '@routes/uploadRoutes';
import admissionsNewRoutes from '@routes/admissionsRoutes';
import houseRoutes from '@routes/houseRoutes';
import teacherHouseRoutes from '@routes/teacherHouseRoutes';
import houseBadgeRoutes from '@routes/houseBadgeRoutes';
import publicAdmissionRoutes from '@routes/publicAdmissionRoutes';
import planRoutes from '@routes/planRoutes';
import brandingRoutes from '@routes/brandingRoutes';
import { rememberRequestOrigin } from '@utils/publicUrl';
import { planFeatureGate } from '@middleware/subscriptionGuard';
import { demoReadOnly } from '@middleware/demoReadOnly';
import { publicDemoRouter, platformDemoRouter } from '@routes/demoAccessRoutes';
import enrollmentRoutes from '@routes/enrollmentRoutes';
import enrollmentWorkflowRoutes from '@routes/enrollmentWorkflowRoutes';
import gradeRoutes from '@routes/gradeRoutes';
import phase5GradeRoutes from '@routes/phase5GradeRoutes';
import attendanceRoutes from '@routes/attendanceRoutes';
import syncRoutes from '@routes/syncRoutes';
import phase5AttendanceRoutes from '@routes/phase5AttendanceRoutes';
import phase6ScheduleRoutes from '@routes/phase6ScheduleRoutes';
import phase7ReportingRoutes from '@routes/phase7ReportingRoutes';
import phase8FinancialRoutes from '@routes/phase8FinancialRoutes';
import monimeRoutes from '@routes/monimeRoutes';
import feeStructureRoutes from '@routes/feeStructureRoutes';
import financeLedgerRoutes from '@routes/financeLedgerRoutes';
import schoolExpenseRoutes from '@routes/schoolExpenseRoutes';
import bursarFinanceRoutes, { financeCronRouter } from '@routes/bursarFinanceRoutes';
import bursarFinanceBRoutes from '@routes/bursarFinanceBRoutes';
import bursarFinanceCRoutes from '@routes/bursarFinanceCRoutes';
import { startFinanceJobs } from './jobs/financeJobs';

import phase9NotificationRoutes from '@routes/phase9NotificationRoutes';
import phase10DashboardRoutes from '@routes/phase10DashboardRoutes';
import phase12ExportRoutes from '@routes/phase12ExportRoutes';
import phase18AuditComplianceRoutes from '@routes/phase18AuditComplianceRoutes';
import phase19IntegrationRoutes from '@routes/phase19IntegrationRoutes';
import phase20PerformanceRoutes from '@routes/phase20PerformanceRoutes';
import phase21HelpSupportRoutes from '@routes/phase21HelpSupportRoutes';
import { asyncSafeApp } from '@utils/asyncRoutes';
import phase22SerializationRoutes from '@routes/phase22SerializationRoutes';
import phase25ExternalServicesRoutes from '@routes/phase25ExternalServicesRoutes';
import platformRoutes from '@routes/platformRoutes';
import idCardRoutes from '@routes/idCardRoutes';
import publicVerifyRoutes from '@routes/publicVerifyRoutes';
import templateRoutes from '@routes/templateRoutes';
import idCardReportingRoutes from '@routes/idCardReportingRoutes';
import printConfigRoutes from '@routes/printConfigRoutes';
import eventRoutes from '@routes/eventRoutes';
import slReportCardRoutes from '@routes/slReportCardRoutes';
import promotionRoutes from '@routes/promotionRoutes';
import disciplineRoutes from '@routes/disciplineRoutes';
import smsWhatsAppRoutes from '@routes/smsWhatsAppRoutes';
import smsWhatsAppWebhooks from '@routes/smsWhatsAppWebhooks';
import teacherRoutes from '@routes/teacherRoutes';
import staffRoutes from '@routes/staffRoutes';
import contactRoutes from '@routes/contactRoutes';
import newsletterRoutes from '@routes/newsletterRoutes';
import schoolConfigRoutes from '@routes/schoolConfigRoutes';
import liveSyncRoutes from '@routes/liveSyncRoutes';
import { liveSyncMiddleware } from '@utils/liveSync';
import announcementRoutes from '@routes/announcementRoutes';
import searchRoutes from '@routes/searchRoutes';
import appStatsRoutes from '@routes/appStatsRoutes';
import { startIdentityManagementJobs } from './jobs/identityManagementJobs.js';
import { startEventManagementJobs } from './jobs/eventManagementJobs.js';
import { startSmsDeliveryJobs } from './jobs/smsDeliveryJobs.js';
import { startSubscriptionJobs } from './jobs/subscriptionJobs.js';
import { startAttendanceDigestJobs } from './jobs/attendanceDigestJobs.js';

// Load environment variables
dotenv.config();

// An error in an async route answers that request instead of crashing the server.
forwardAsyncRouteErrors();
// Last line of defence: a stray rejected promise (fire-and-forget work) is
// logged, never allowed to stop the API for every school.
if (!(globalThis as any).__wiskulRejectionGuard) {
  (globalThis as any).__wiskulRejectionGuard = true;
  process.on('unhandledRejection', (reason: any) => {
    logger.error(`Unhandled promise rejection: ${reason?.stack || reason?.message || reason}`);
  });
}

const app: Express = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Middleware
app.use(helmet());
// Build the allowed origins list from env (supports comma-separated values)
const allowedOrigins: (string | RegExp)[] = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

// Add any explicitly configured frontend URL(s)
if (process.env.FRONTEND_URL) {
  process.env.FRONTEND_URL.split(',').forEach((url) => {
    const trimmed = url.trim();
    if (trimmed) allowedOrigins.push(trimmed);
  });
}

// Preview deployments of THIS Vercel project only (not every *.vercel.app
// site): <project>-<hash>-<team>.vercel.app / <project>-git-<branch>-<team>.vercel.app.
const previewProject = (process.env.VERCEL_PREVIEW_PROJECT || 'school-management-system').replace(/[^a-z0-9-]/gi, '');
allowedOrigins.push(new RegExp(`^https://${previewProject}(-[a-z0-9-]+)?\\.vercel\\.app$`, 'i'));

const corsBase = {
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 3600,
};
app.use(
  cors((req, callback) => {
    const origin = req.headers.origin;
    // No origin (server-to-server, native HTTP clients) or same-origin (the SPA
    // and API share a host on Vercel / the app's server.url) are always fine.
    const sameHost = !!origin && !!req.headers.host && origin.replace(/^https?:\/\//, '') === req.headers.host;
    const allowed = !origin || sameHost || allowedOrigins.some((o) =>
      typeof o === 'string' ? o === origin : o.test(origin)
    );
    if (allowed) return callback(null, { ...corsBase, origin: true });
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  })
);
app.use(compression());
// Monime webhook needs the RAW body for HMAC signature verification — parse it
// as a Buffer BEFORE the global JSON parser for this exact path only.
app.use('/api/v1/payments/monime/webhook', express.raw({ type: '*/*', limit: '2mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestLogger);
// Live portal sync: bump the school's change counter on successful structural
// writes (promotions, new year, roles, enrollments…) so open apps refresh.
app.use(liveSyncMiddleware);

// Broad per-IP rate ceiling across the whole API. Auth routes layer stricter,
// purpose-built limiters on top (see routes/authRoutes.ts). The webhook path is
// excluded so payment providers aren't throttled.
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/v1/payments/monime/webhook')) return next();
  return apiLimiter(req, res, next);
});

// Attach the request-scoped RLS tenant helper (req.withTenant). Binds lazily so
// it works regardless of where per-router auth middleware runs. This is opt-in
// per handler and safe to mount globally (see middleware/tenantContext.ts).
app.use(tenantContext);

// Learn the public host browsers use (for email/QR links when no URL env is set).
app.use((req, _res, next) => { rememberRequestOrigin(req.headers as any); next(); });

// Plan features: one gate for every module API (see FEATURE_PREFIXES). Locked
// features are refused; read-only ones (held on an earlier plan or trial)
// allow reads only. No-op for core modules and unauthenticated requests.
// The public demo school is read-only (its logins are published).
app.use('/api/v1', demoReadOnly);
app.use('/api/v1', planFeatureGate);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    uptime: process.uptime(),
  });
});

// Debug endpoint — only available in development, never in production
if (NODE_ENV !== 'production') {
  app.get('/api/v1/debug', async (req: Request, res: Response) => {
    const info: Record<string, any> = {
      node_env: NODE_ENV,
      has_database_url: !!process.env.DATABASE_URL,
      has_jwt_secret: !!process.env.JWT_SECRET,
      has_refresh_secret: !!process.env.REFRESH_TOKEN_SECRET,
      jwt_secret_length: process.env.JWT_SECRET?.length ?? 0,
      database_url_prefix: process.env.DATABASE_URL?.substring(0, 30) + '...',
      cwd: process.cwd(),
      env_keys: Object.keys(process.env).filter(k => k.includes('DB') || k.includes('URL') || k.includes('SECRET')),
    };
    try {
      await db.raw('SELECT 1');
      info.db_connected = true;
    } catch (e: any) {
      info.db_connected = false;
      info.db_error = {
        message: e.message,
        code: e.code,
      };
    }
    res.json(info);
  });
}

// Serve static files from storage directory (local storage only)
if (process.env.STORAGE_PROVIDER === 'local' || !process.env.STORAGE_PROVIDER) {
  const storagePath = process.env.LOCAL_STORAGE_PATH || './storage';
  // helmet() sends Cross-Origin-Resource-Policy: same-origin, which stops the
  // frontend (another origin: Vite, Vercel, the Android app) from showing
  // uploaded photos. These files are meant to be embedded, so allow it here.
  app.use('/storage', (_req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  }, express.static(storagePath));
  logger.info(`Serving static files from ${storagePath}`);
}

// API Routes
app.get('/api', (req: Request, res: Response) => {
  res.json({
    message: 'School Management System API',
    version: '1.0.0',
    environment: NODE_ENV,
  });
});

// Authentication Routes
app.use('/api/v1/auth', authRoutes);

// Public ID verification (UNAUTHENTICATED — QR scan verification).
// MUST be mounted BEFORE any blanket `app.use('/api/v1', router)` whose router
// applies `authenticate` at the top (e.g. phase10DashboardRoutes) — otherwise
// that middleware runs for every /api/v1/* path and 401s this public route.
app.use('/api/v1/public/plans', planRoutes);
// "Book a live demo" + emailed demo links (public), and the super admin list.
app.use('/api/v1/public/demo', publicDemoRouter);
app.use('/api/v1/platform/demo-requests', platformDemoRouter);
// School logos for emails (stable absolute URL, whatever the storage).
app.use('/api/v1/public/branding', brandingRoutes);
app.use('/api/v1/public', publicVerifyRoutes);
app.use('/api/v1/public/admissions', publicAdmissionRoutes);

// App stats (APK download tracking + count). Contains the PUBLIC
// GET /api/v1/app/download route, so — like publicVerifyRoutes above — it MUST
// be mounted before any blanket `/api/v1` router that applies `authenticate`
// router-wide, otherwise the public download 401s. Its protected routes
// (download-count, blob-url) enforce their own auth internally.
app.use('/api/v1', appStatsRoutes);

// User Management Routes
app.use('/api/v1/users', userRoutes);

// RBAC Routes
app.use('/api/v1/roles', rbacRoutes);

// Student Routes
app.use('/api/v1/students', studentRoutes);

// Guardian Routes — mounted under both /guardians and /students so student-
// nested guardian actions (e.g. /students/:studentId/parent-account,
// /students/guardian-lookup) resolve correctly.
app.use('/api/v1/guardians', guardianRoutes);
app.use('/api/v1/students', guardianRoutes);

// Class Routes
app.use('/api/v1/classes', classRoutes);

// Subject Routes
app.use('/api/v1/subjects', subjectRoutes);

// Timetable Routes
app.use('/api/v1/timetable', timetableRoutes);

// Assignment Routes
app.use('/api/v1/assignments', assignmentRoutes);

// Examination Routes
app.use('/api/v1/examinations', examinationRoutes);

// Results & Grades Routes
app.use('/api/v1/results', resultsRoutes);

// File Upload Routes
app.use('/api/v1/uploads', uploadRoutes);

// Houses and the house ballot (mounted before admissions so '/houses' isn't read as an application id)
app.use('/api/v1/admissions/houses', houseRoutes);
// Houses for teachers (their own house list; drawing only when permitted)
app.use('/api/v1/houses', teacherHouseRoutes);
// Sport-house badge shown on profiles (students, parents, house masters and teachers)
app.use('/api/v1/sport-badge', houseBadgeRoutes);

// Admissions Routes
app.use('/api/v1/admissions', admissionsNewRoutes);

// Enrollment Routes
app.use('/api/v1/enrollments', enrollmentRoutes);

// Enrollment Workflow Routes (Phase 4)
app.use('/api/v1', enrollmentWorkflowRoutes);

// Grade Routes (Phase 3 pre-built)
app.use('/api/v1/grades', gradeRoutes);

// Grade Routes (Phase 5 - Complete Implementation)
app.use('/api/v1/grades', phase5GradeRoutes);

// Attendance Routes (Phase 3 pre-built)
app.use('/api/v1/attendance', attendanceRoutes);

// Attendance Routes (Phase 5 - Complete Implementation)
app.use('/api/v1/attendance', phase5AttendanceRoutes);

// Schedule Routes (Phase 6)
app.use('/api/v1/schedules', phase6ScheduleRoutes);

// Reporting & Analytics Routes (Phase 7)
app.use('/api/v1', phase7ReportingRoutes);

// Financial Management Routes (Phase 8)
// NOTE: req.user (id/tenant_id/role) is populated by attachUserContext, applied
// INSIDE each finance router (after its own authenticate) so we don't broaden
// auth across the whole /api/v1 namespace.
app.use('/api/v1', phase8FinancialRoutes);

// Monime online payment routes (checkout + public webhook)
app.use('/api/v1/payments', monimeRoutes);

// Fee-structure configurator (per class/year term tuition + year expenses + policy)
app.use('/api/v1/fee-structures', feeStructureRoutes);

// Finance ledger reads (per-student ledger + tenant summary/breakdown)
app.use('/api/v1/finance/ledger', financeLedgerRoutes);

// Bursar Phase A: discounts, late fees, aging, receipts, credit, plans,
// statements. BEFORE schoolExpenseRoutes: its router-level guard is
// finance-staff only, and the family-facing reads here must stay reachable.
app.use('/api/v1/finance', bursarFinanceRoutes);
// Bursar Phase B: expenses, petty cash, budgets, payroll (+ My Payslips).
app.use('/api/v1/finance', bursarFinanceBRoutes);
// Bursar Phase C: chart of accounts, journal, statements, bank rec, audit log.
app.use('/api/v1/finance', bursarFinanceCRoutes);
// Daily finance job (Vercel Cron, CRON_SECRET-guarded).
app.use('/api/v1/cron', financeCronRouter);

// School operating expenses + fees-vs-expenses summary (staff-only)
app.use('/api/v1/finance', schoolExpenseRoutes);

// SMS & WhatsApp provider webhooks (PUBLIC, signature-verified). MUST stay
// above the Phase 9 router: it applies router-wide `authenticate` on /api/v1,
// which would 401 every provider callback mounted after it.
app.use('/api/v1/sms-whatsapp/webhooks', smsWhatsAppWebhooks);

// Notification System Routes (Phase 9)
app.use('/api/v1', phase9NotificationRoutes);

// Admin Dashboard Routes (Phase 10)
app.use('/api/v1', phase10DashboardRoutes);

// Export Routes (Phase 12)
app.use('/api/v1', phase12ExportRoutes);

// Phases 18-22 register async handlers directly on `app` and rethrow errors.
// Express 4 doesn't catch those (the request would hang with no response), so
// register them through a proxy that forwards rejections to the errorHandler.
const legacyApp = asyncSafeApp(app);

// Audit & Compliance Routes (Phase 18)
phase18AuditComplianceRoutes(legacyApp, db);

// Integration Routes (Phase 19)
phase19IntegrationRoutes(legacyApp, db);

// Performance & Mobile Routes (Phase 20)
phase20PerformanceRoutes(legacyApp, db);

// Help & Support Routes (Phase 21)
phase21HelpSupportRoutes(legacyApp, db);

// Data Serialization & Parsing Routes (Phase 22)
phase22SerializationRoutes(legacyApp, db);

// External Services Integration Routes (Phase 25)
app.use('/api/v1', phase25ExternalServicesRoutes);

// Platform Management Routes (Phase 1: Super Admin)
app.use('/api/v1/platform', platformRoutes);

// Admission Management Routes (Phase 1.3: Admissions Officer Enhancement)
// The legacy Phase 1.3 admissions router (routes/admissionRoutes.ts) is no longer mounted:
// its GETs were shadowed by admissionsRoutes and its PATCH/DELETE paths bypassed the
// pipeline rules (no transition checks, duplicate students). admissionsRoutes is the API.

// ID Card Management Routes (Phase 2.1: Identity Management Module)
app.use('/api/v1/id-cards', idCardRoutes);

// Card Template Management Routes (Phase 2.1: Identity Management Module)
app.use('/api/v1/card-templates', templateRoutes);

// ID Card Reporting Routes (Phase 2.1: Identity Management Module)
app.use('/api/v1/id-cards/reports', idCardReportingRoutes);

// Print Configuration Routes (Phase 2.1: Identity Management Module)
app.use('/api/v1/print-configs', printConfigRoutes);

// Event Management Routes (Phase 2.2: Events Management Module)
app.use('/api/v1/events', eventRoutes);

// Sierra Leone Report Card / Booklet Routes
app.use('/api/v1/report-cards', slReportCardRoutes);

// NOTE: publicVerifyRoutes is already mounted at /api/v1/public above (line ~184),
// BEFORE any blanket auth middleware so the QR-scan verification endpoint stays public.

// Student Promotion Routes
app.use('/api/v1/promotions', promotionRoutes);

// Discipline & Conduct Routes (Phase 2.3: Discipline & Conduct Module)
app.use('/api/v1/discipline', disciplineRoutes);

// SMS & WhatsApp Routes (Phase 2.4: SMS & WhatsApp Integration)
// Webhooks (public) are mounted above, before the Phase 9 router.
// Authenticated SMS & WhatsApp routes
app.use('/api/v1/sms-whatsapp', smsWhatsAppRoutes);

// Teachers Management Routes
app.use('/api/v1/teachers', teacherRoutes);
// Support staff (security, cleaners, cooks…): records only, no login.
app.use('/api/v1/staff', staffRoutes);

// Contact Form Routes (Public)
app.use('/api/contact', contactRoutes);

// Public Newsletter Routes (subscribe / one-click unsubscribe)
app.use('/api/newsletter', newsletterRoutes);

// School Config & Settings Routes
app.use('/api/v1/school-config', schoolConfigRoutes);

// Announcements Routes (Communication)
app.use('/api/v1/announcements', announcementRoutes);
// Header search (students, staff, finance, … scoped to the caller's role)
app.use('/api/v1/search', searchRoutes);

// Offline sync Routes (teacher offline-first: pull/push)
app.use('/api/v1/sync', syncRoutes);

// Live portal sync version (polled by open apps to refresh after changes)
app.use('/api/v1/live', liveSyncRoutes);

// School verification Routes (account-owner instant verification)
app.use('/api/v1/verification', verificationRoutes);

// Timetable Routes (Simplified schedule management)
app.use('/api/v1/timetable', timetableRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString(),
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Start jobs that should run with the API (if process runs them)
try {
  startSmsDeliveryJobs();
} catch (e) {
  logger.warn('Could not start SMS delivery jobs at startup', { error: e });
}

try {
  startSubscriptionJobs();
} catch (e) {
  logger.warn('Could not start subscription jobs at startup', { error: e });
}

try {
  startFinanceJobs();
} catch (e) {
  logger.warn('Could not start finance jobs at startup', { error: e });
}

try {
  startAttendanceDigestJobs();
} catch (e) {
  logger.warn('Could not start attendance digest jobs at startup', { error: e });
}
try {
  startEventManagementJobs();
} catch (e) {
  logger.warn('Could not start event management jobs at startup', { error: e });
}

export default app;
