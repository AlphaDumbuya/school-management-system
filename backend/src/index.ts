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
import { startIdentityManagementJobs } from './jobs/identityManagementJobs.js';
import { startEventManagementJobs } from './jobs/eventManagementJobs.js';

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
      process.env.FRONTEND_URL || '',
    ].filter(Boolean),
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

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${NODE_ENV} mode`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
  
  // Start identity management scheduled jobs
  if (NODE_ENV === 'production' || process.env.ENABLE_SCHEDULED_JOBS === 'true') {
    startIdentityManagementJobs();
  }
  
  // Start event management scheduled jobs
  if (NODE_ENV === 'production' || process.env.ENABLE_SCHEDULED_JOBS === 'true') {
    startEventManagementJobs();
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default app;
