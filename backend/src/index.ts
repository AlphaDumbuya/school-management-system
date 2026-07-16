import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { logger } from '@utils/logger';
import { errorHandler } from '@middleware/errorHandler';
import { requestLogger } from '@middleware/requestLogger';
import { db } from '@utils/database';
import authRoutes from '@routes/authRoutes';
import userRoutes from '@routes/userRoutes';
import rbacRoutes from '@routes/rbacRoutes';
import studentRoutes from '@routes/studentRoutes';
import guardianRoutes from '@routes/guardianRoutes';
import classRoutes from '@routes/classRoutes';
import subjectRoutes from '@routes/subjectRoutes';
import timetableRoutes from '@routes/timetableRoutes';
import assignmentRoutes from '@routes/assignmentRoutes';
import examinationRoutes from '@routes/examinationRoutes';
import enrollmentRoutes from '@routes/enrollmentRoutes';
import enrollmentWorkflowRoutes from '@routes/enrollmentWorkflowRoutes';
import gradeRoutes from '@routes/gradeRoutes';
import phase5GradeRoutes from '@routes/phase5GradeRoutes';
import attendanceRoutes from '@routes/attendanceRoutes';
import phase5AttendanceRoutes from '@routes/phase5AttendanceRoutes';
import phase6ScheduleRoutes from '@routes/phase6ScheduleRoutes';
import phase7ReportingRoutes from '@routes/phase7ReportingRoutes';
import phase8FinancialRoutes from '@routes/phase8FinancialRoutes';
import phase9NotificationRoutes from '@routes/phase9NotificationRoutes';
import phase10DashboardRoutes from '@routes/phase10DashboardRoutes';
import phase12ExportRoutes from '@routes/phase12ExportRoutes';
import phase18AuditComplianceRoutes from '@routes/phase18AuditComplianceRoutes';
import phase19IntegrationRoutes from '@routes/phase19IntegrationRoutes';
import phase20PerformanceRoutes from '@routes/phase20PerformanceRoutes';
import phase21HelpSupportRoutes from '@routes/phase21HelpSupportRoutes';
import phase22SerializationRoutes from '@routes/phase22SerializationRoutes';
import phase25ExternalServicesRoutes from '@routes/phase25ExternalServicesRoutes';
import platformRoutes from '@routes/platformRoutes';
import admissionRoutes from '@routes/admissionRoutes';
import idCardRoutes from '@routes/idCardRoutes';
import templateRoutes from '@routes/templateRoutes';
import idCardReportingRoutes from '@routes/idCardReportingRoutes';
import printConfigRoutes from '@routes/printConfigRoutes';
import eventRoutes from '@routes/eventRoutes';
import disciplineRoutes from '@routes/disciplineRoutes';
import smsWhatsAppRoutes from '@routes/smsWhatsAppRoutes';
import timetableRoutes from '@routes/timetableRoutes';
import { startIdentityManagementJobs } from './jobs/identityManagementJobs.js';
import { startEventManagementJobs } from './jobs/eventManagementJobs.js';

// Load environment variables
dotenv.config();

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

// Allow all *.vercel.app subdomains for preview deployments
allowedOrigins.push(/^https:\/\/.*\.vercel\.app$/);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, mobile apps)
      if (!origin) return callback(null, true);
      const allowed = allowedOrigins.some((o) =>
        typeof o === 'string' ? o === origin : o.test(origin)
      );
      if (allowed) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 3600,
  })
);
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    uptime: process.uptime(),
  });
});

// Debug endpoint — shows env and DB connectivity (remove after fixing)
app.get('/api/v1/debug', async (req: Request, res: Response) => {
  const info: Record<string, any> = {
    node_env: NODE_ENV,
    has_database_url: !!process.env.DATABASE_URL,
    has_jwt_secret: !!process.env.JWT_SECRET,
    has_refresh_secret: !!process.env.REFRESH_TOKEN_SECRET,
    jwt_secret_length: process.env.JWT_SECRET?.length ?? 0,
    database_url_prefix: process.env.DATABASE_URL?.substring(0, 30) + '...',
  };
  try {
    await db.raw('SELECT 1');
    info.db_connected = true;
  } catch (e) {
    info.db_connected = false;
    info.db_error = String(e);
  }
  res.json(info);
});

// Serve static files from storage directory (local storage only)
if (process.env.STORAGE_PROVIDER === 'local' || !process.env.STORAGE_PROVIDER) {
  const storagePath = process.env.LOCAL_STORAGE_PATH || './storage';
  app.use('/storage', express.static(storagePath));
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

// User Management Routes
app.use('/api/v1/users', userRoutes);

// RBAC Routes
app.use('/api/v1/roles', rbacRoutes);

// Student Routes
app.use('/api/v1/students', studentRoutes);

// Guardian Routes
app.use('/api/v1/guardians', guardianRoutes);

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
app.use('/api/v1', phase8FinancialRoutes);

// Notification System Routes (Phase 9)
app.use('/api/v1', phase9NotificationRoutes);

// Admin Dashboard Routes (Phase 10)
app.use('/api/v1', phase10DashboardRoutes);

// Export Routes (Phase 12)
app.use('/api/v1', phase12ExportRoutes);

// Audit & Compliance Routes (Phase 18)
phase18AuditComplianceRoutes(app, db);

// Integration Routes (Phase 19)
phase19IntegrationRoutes(app, db);

// Performance & Mobile Routes (Phase 20)
phase20PerformanceRoutes(app, db);

// Help & Support Routes (Phase 21)
phase21HelpSupportRoutes(app, db);

// Data Serialization & Parsing Routes (Phase 22)
phase22SerializationRoutes(app, db);

// External Services Integration Routes (Phase 25)
app.use('/api/v1', phase25ExternalServicesRoutes);

// Platform Management Routes (Phase 1: Super Admin)
app.use('/api/v1/platform', platformRoutes);

// Admission Management Routes (Phase 1.3: Admissions Officer Enhancement)
app.use('/api/v1/admissions', admissionRoutes);

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

// Discipline & Conduct Routes (Phase 2.3: Discipline & Conduct Module)
app.use('/api/v1/discipline', disciplineRoutes);

// SMS & WhatsApp Routes (Phase 2.4: SMS & WhatsApp Integration)
app.use('/api/v1/sms-whatsapp', smsWhatsAppRoutes);

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

export default app;
