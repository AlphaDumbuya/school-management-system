import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '@middleware/authMiddleware';
import { db } from '@utils/database';
import { AttendanceService } from '@services/attendanceService';
import { AuditService } from '@services/auditService';
import { logger } from '@utils/logger';

const router = Router();
const attendanceService = new AttendanceService(db);
const auditService = new AuditService(db);

/**
 * POST /api/v1/attendance
 * Record attendance
 */
router.post(
  '/',
  authenticate,
  requirePermission('attendance:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { student_id, class_id, academic_session_id, attendance_date, status, remarks } = req.body;
      const userId = (req as any).user.userId;

      const record = await attendanceService.recordAttendance(
        {
          student_id,
          class_id,
          academic_session_id,
          attendance_date,
          status,
          remarks,
        },
        userId
      );

      // Log audit trail
      await auditService.logAudit({
        entity_type: 'attendance',
        entity_id: record.id,
        action: 'create',
        performed_by: userId,
        new_values: record,
        reason: `Attendance recorded: ${status}`,
        source: 'api',
      });

      res.status(201).json({
        success: true,
        message: 'Attendance recorded successfully',
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/attendance/student/:studentId
 * Get student attendance
 */
router.get(
  '/student/:studentId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId } = req.params;
      const { class_id, academic_session_id, page, limit } = req.query;

      const result = await attendanceService.getStudentAttendance(studentId, {
        class_id: class_id as string,
        academic_session_id: academic_session_id as string,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/attendance/class/:classId/date/:date
 * Get class attendance for a specific date
 */
router.get(
  '/class/:classId/date/:date',
  authenticate,
  requirePermission('attendance:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { classId, date } = req.params;
      const { academicSessionId } = req.query;

      if (!academicSessionId) {
        return res.status(400).json({
          success: false,
          error: 'academicSessionId is required',
        });
      }

      const records = await attendanceService.getClassAttendanceForDate(
        classId,
        academicSessionId as string,
        date
      );

      res.json({
        success: true,
        data: records,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/attendance/student/:studentId/percentage
 * Get student attendance percentage
 */
router.get(
  '/student/:studentId/percentage',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId } = req.params;
      const { classId, academicSessionId } = req.query;

      if (!classId || !academicSessionId) {
        return res.status(400).json({
          success: false,
          error: 'classId and academicSessionId are required',
        });
      }

      const percentage = await attendanceService.calculateAttendancePercentage(
        studentId,
        classId as string,
        academicSessionId as string
      );

      res.json({
        success: true,
        data: percentage,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/attendance/class/:classId/summary
 * Get class attendance summary
 */
router.get(
  '/class/:classId/summary',
  authenticate,
  requirePermission('attendance:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { classId } = req.params;
      const { academicSessionId } = req.query;

      if (!academicSessionId) {
        return res.status(400).json({
          success: false,
          error: 'academicSessionId is required',
        });
      }

      const summary = await attendanceService.getClassAttendanceSummary(
        classId,
        academicSessionId as string
      );

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/attendance/:recordId
 * Update attendance record
 */
router.put(
  '/:recordId',
  authenticate,
  requirePermission('attendance:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { recordId } = req.params;
      const { status, remarks } = req.body;
      const userId = (req as any).user.userId;

      const oldRecord = await attendanceService.getAttendanceById(recordId);
      const updatedRecord = await attendanceService.updateAttendance(
        recordId,
        { status, remarks },
        userId
      );

      // Log audit trail
      await auditService.logAudit({
        entity_type: 'attendance',
        entity_id: recordId,
        action: 'update',
        performed_by: userId,
        old_values: oldRecord,
        new_values: updatedRecord,
        reason: 'Attendance updated',
        source: 'api',
      });

      res.json({
        success: true,
        message: 'Attendance updated successfully',
        data: updatedRecord,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/attendance/class/:classId/report
 * Generate attendance report
 */
router.get(
  '/class/:classId/report',
  authenticate,
  requirePermission('attendance:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { classId } = req.params;
      const { academicSessionId, startDate, endDate } = req.query;

      if (!academicSessionId) {
        return res.status(400).json({
          success: false,
          error: 'academicSessionId is required',
        });
      }

      const report = await attendanceService.generateAttendanceReport(
        classId,
        academicSessionId as string,
        startDate as string,
        endDate as string
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
