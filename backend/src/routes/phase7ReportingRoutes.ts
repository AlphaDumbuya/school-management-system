import express, { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '@middleware/authMiddleware';
import { ReportingService } from '@services/reportingService';
import { AnalyticsService } from '@services/analyticsService';
import { db } from '@utils/database';
import { logger } from '@utils/logger';
import { AuditService } from '@services/auditService';

const router: Router = express.Router();
const reportingService = new ReportingService(db);
const analyticsService = new AnalyticsService(db);
const auditService = new AuditService(db);

/**
 * Generate grade report for a class
 * POST /api/v1/reports/grades
 * Requires: principal, teacher, or student role
 */
router.post(
  '/reports/grades',
  authenticate,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { classId, startDate, endDate } = req.body;
      const userId = (req as any).user.id;

      // Validate input
      if (!classId) {
        return res
          .status(400)
          .json({ error: 'classId is required' });
      }

      const filters = { startDate, endDate };
      const report = await reportingService.generateGradeReport(
        classId,
        filters,
        userId
      );

      // Store report
      const reportRecord = {
        id: report.reportId,
        type: 'grade',
        name: `Grade Report - ${report.className}`,
        created_by: userId,
        class_id: classId,
        filters: JSON.stringify(filters),
        data: JSON.stringify(report),
        status: 'generated',
        generated_at: new Date(),
      };

      await db('reports').insert(reportRecord);

      res.status(200).json({
        success: true,
        data: report,
        message: 'Grade report generated successfully',
      });
    } catch (error) {
      logger.error(`Error generating grade report: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Generate attendance report for a class
 * POST /api/v1/reports/attendance
 * Requires: principal, teacher, or student role
 */
router.post(
  '/reports/attendance',
  authenticate,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { classId, startDate, endDate } = req.body;
      const userId = (req as any).user.id;

      if (!classId) {
        return res
          .status(400)
          .json({ error: 'classId is required' });
      }

      const filters = { startDate, endDate };
      const report = await reportingService.generateAttendanceReport(
        classId,
        filters,
        userId
      );

      // Store report
      const reportRecord = {
        id: report.reportId,
        type: 'attendance',
        name: `Attendance Report - ${report.className}`,
        created_by: userId,
        class_id: classId,
        filters: JSON.stringify(filters),
        data: JSON.stringify(report),
        status: 'generated',
        generated_at: new Date(),
      };

      await db('reports').insert(reportRecord);

      res.status(200).json({
        success: true,
        data: report,
        message: 'Attendance report generated successfully',
      });
    } catch (error) {
      logger.error(`Error generating attendance report: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Generate performance report for a student
 * POST /api/v1/reports/performance
 * Requires: principal or teacher role
 */
router.post(
  '/reports/performance',
  authenticate,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { studentId } = req.body;
      const userId = (req as any).user.id;

      if (!studentId) {
        return res
          .status(400)
          .json({ error: 'studentId is required' });
      }

      const report = await reportingService.generateStudentPerformanceReport(
        studentId,
        userId
      );

      // Store report
      const reportRecord = {
        id: report.reportId,
        type: 'performance',
        name: `Performance Report - ${report.studentName}`,
        created_by: userId,
        student_id: studentId,
        data: JSON.stringify(report),
        status: 'generated',
        generated_at: new Date(),
      };

      await db('reports').insert(reportRecord);

      res.status(200).json({
        success: true,
        data: report,
        message: 'Performance report generated successfully',
      });
    } catch (error) {
      logger.error(`Error generating performance report: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Generate class performance report
 * POST /api/v1/reports/class-performance
 * Requires: principal or teacher role
 */
router.post(
  '/reports/class-performance',
  authenticate,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { classId } = req.body;
      const userId = (req as any).user.id;

      if (!classId) {
        return res
          .status(400)
          .json({ error: 'classId is required' });
      }

      const report = await reportingService.generateClassPerformanceReport(
        classId,
        userId
      );

      // Store report
      const reportRecord = {
        id: report.reportId,
        type: 'class_performance',
        name: `Class Performance Report - ${report.className}`,
        created_by: userId,
        class_id: classId,
        data: JSON.stringify(report),
        status: 'generated',
        generated_at: new Date(),
      };

      await db('reports').insert(reportRecord);

      res.status(200).json({
        success: true,
        data: report,
        message: 'Class performance report generated successfully',
      });
    } catch (error) {
      logger.error(`Error generating class performance report: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Generate schedule utilization report
 * POST /api/v1/reports/schedule-utilization
 * Requires: principal role
 */
router.post(
  '/reports/schedule-utilization',
  authenticate,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { academicPeriod } = req.body;
      const userId = (req as any).user.id;

      if (!academicPeriod) {
        return res
          .status(400)
          .json({ error: 'academicPeriod is required' });
      }

      const report = await reportingService.generateScheduleUtilizationReport(
        academicPeriod,
        userId
      );

      // Store report
      const reportRecord = {
        id: report.reportId,
        type: 'schedule_utilization',
        name: `Schedule Utilization Report - ${academicPeriod}`,
        created_by: userId,
        filters: JSON.stringify({ academicPeriod }),
        data: JSON.stringify(report),
        status: 'generated',
        generated_at: new Date(),
      };

      await db('reports').insert(reportRecord);

      res.status(200).json({
        success: true,
        data: report,
        message: 'Schedule utilization report generated successfully',
      });
    } catch (error) {
      logger.error(`Error generating schedule utilization report: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Get dashboard analytics
 * GET /api/v1/analytics/dashboard
 * Requires: principal, teacher, or accountant role
 */
router.get(
  '/analytics/dashboard',
  authenticate,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const userId = (req as any).user.id;

      const dashboard = await analyticsService.getDashboardAnalytics();

      // Store analytics snapshot
      const snapshot = {
        id: `snapshot-${Date.now()}`,
        snapshot_type: 'dashboard',
        metrics: JSON.stringify(dashboard.metrics),
        insights: JSON.stringify(dashboard.insights),
        captured_at: new Date(),
      };

      await db('analytics_snapshots').insert(snapshot);

      // Log analytics access
      await auditService.logAudit({
        entityType: 'analytics',
        entityId: 'dashboard',
        action: 'access',
        performedBy: userId,
        details: {
          type: 'dashboard_analytics',
        },
        timestamp: new Date(),
      });

      res.status(200).json({
        success: true,
        data: dashboard,
        message: 'Dashboard analytics retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error fetching dashboard analytics: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Get student analytics
 * GET /api/v1/analytics/students/:studentId
 * Requires: principal, teacher, or the student
 */
router.get(
  '/analytics/students/:studentId',
  authenticate,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { studentId } = req.params;
      const userId = (req as any).user.id;

      const analytics = await analyticsService.getStudentAnalytics(studentId);

      // Store analytics snapshot
      const snapshot = {
        id: `snapshot-${Date.now()}`,
        snapshot_type: 'student',
        metrics: JSON.stringify(analytics),
        captured_at: new Date(),
      };

      await db('analytics_snapshots').insert(snapshot);

      res.status(200).json({
        success: true,
        data: analytics,
        message: 'Student analytics retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error fetching student analytics: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Get class analytics
 * GET /api/v1/analytics/classes/:classId
 * Requires: principal or teacher role
 */
router.get(
  '/analytics/classes/:classId',
  authenticate,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { classId } = req.params;

      const analytics = await analyticsService.getClassAnalytics(classId);

      // Store analytics snapshot
      const snapshot = {
        id: `snapshot-${Date.now()}`,
        snapshot_type: 'class',
        metrics: JSON.stringify(analytics),
        captured_at: new Date(),
      };

      await db('analytics_snapshots').insert(snapshot);

      res.status(200).json({
        success: true,
        data: analytics,
        message: 'Class analytics retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error fetching class analytics: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Get enrollment analytics
 * GET /api/v1/analytics/enrollment
 * Requires: principal or accountant role
 */
router.get(
  '/analytics/enrollment',
  authenticate,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const userId = (req as any).user.id;

      const analytics = await analyticsService.getEnrollmentAnalytics();

      // Store analytics snapshot
      const snapshot = {
        id: `snapshot-${Date.now()}`,
        snapshot_type: 'enrollment',
        metrics: JSON.stringify(analytics),
        captured_at: new Date(),
      };

      await db('analytics_snapshots').insert(snapshot);

      res.status(200).json({
        success: true,
        data: analytics,
        message: 'Enrollment analytics retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error fetching enrollment analytics: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Get system health metrics
 * GET /api/v1/analytics/health
 * Requires: principal role
 */
router.get(
  '/analytics/health',
  authenticate,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const health = await analyticsService.getSystemHealthMetrics();

      res.status(200).json({
        success: true,
        data: health,
        message: 'System health metrics retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error fetching system health metrics: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Get report history
 * GET /api/v1/reports/history
 * Requires: principal or accountant role
 */
router.get(
  '/reports/history',
  authenticate,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const history = await reportingService.getReportHistory(limit, offset);

      res.status(200).json({
        success: true,
        data: history,
        pagination: { limit, offset, total: history.length },
        message: 'Report history retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error fetching report history: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Get stored report details
 * GET /api/v1/reports/:reportId
 * Requires: authenticated user
 */
router.get(
  '/reports/:reportId',
  authenticate,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { reportId } = req.params;

      const report = await db('reports')
        .where('id', reportId)
        .first();

      if (!report) {
        return res
          .status(404)
          .json({ error: 'Report not found' });
      }

      res.status(200).json({
        success: true,
        data: {
          ...report,
          filters: report.filters ? JSON.parse(report.filters) : null,
          data: report.data ? JSON.parse(report.data) : null,
        },
        message: 'Report retrieved successfully',
      });
    } catch (error) {
      logger.error(`Error fetching report: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Delete report
 * DELETE /api/v1/reports/:reportId
 * Requires: principal role or report creator
 */
router.delete(
  '/reports/:reportId',
  authenticate,
  async (req: Request, res: Response, NextFunction: NextFunction) => {
    try {
      const { reportId } = req.params;
      const userId = (req as any).user.id;

      const report = await db('reports')
        .where('id', reportId)
        .first();

      if (!report) {
        return res
          .status(404)
          .json({ error: 'Report not found' });
      }

      // Check authorization
      if (report.created_by !== userId && (req as any).user.role !== 'principal') {
        return res
          .status(403)
          .json({ error: 'Forbidden' });
      }

      // Delete associated exports
      await db('report_exports').where('report_id', reportId).del();

      // Delete report
      await db('reports').where('id', reportId).del();

      // Log deletion
      await auditService.logAudit({
        entityType: 'report',
        entityId: reportId,
        action: 'delete',
        performedBy: userId,
        details: {
          type: report.type,
          name: report.name,
        },
        timestamp: new Date(),
      });

      res.status(200).json({
        success: true,
        message: 'Report deleted successfully',
      });
    } catch (error) {
      logger.error(`Error deleting report: ${error}`);
      res.status(500).json({
        error: 'Internal server error',
        message: (error as Error).message,
      });
    }
  }
);

export default router;
