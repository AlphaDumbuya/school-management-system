import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission, attachUserContext } from '@middleware/authMiddleware';
import { db } from '@utils/database';
import { AttendanceService } from '@services/attendanceService';
import { AuditService } from '@services/auditService';
import { logger } from '@utils/logger';
import { AppError } from '@middleware/errorHandler';

const router = Router();
router.use(authenticate);
router.use(attachUserContext);
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
      const tenantId = req.user?.tenant_id;

      if (!tenantId) {
        throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
      }

      // Verify student belongs to this tenant
      const student = await db('students').where({ id: student_id, tenant_id: tenantId }).first();
      if (!student) {
        throw new AppError('Student not found or access denied', 404, 'NOT_FOUND');
      }

      // Verify class belongs to this tenant
      const classCheck = await db('classes')
        .join('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
        .where('classes.id', class_id)
        .where('academic_sessions.tenant_id', tenantId)
        .first();
      if (!classCheck) {
        throw new AppError('Class not found or access denied', 404, 'NOT_FOUND');
      }

      // Verify session belongs to this tenant
      const sessionCheck = await db('academic_sessions').where({ id: academic_session_id, tenant_id: tenantId }).first();
      if (!sessionCheck) {
        throw new AppError('Academic session not found or access denied', 404, 'NOT_FOUND');
      }

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
      const tenantId = req.user?.tenant_id;

      if (!tenantId) {
        throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
      }

      // Verify student belongs to this tenant
      const student = await db('students').where({ id: studentId, tenant_id: tenantId }).first();
      if (!student) {
        throw new AppError('Student not found or access denied', 404, 'NOT_FOUND');
      }

      // Verify class belongs to this tenant if provided
      if (class_id) {
        const classCheck = await db('classes')
          .join('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
          .where('classes.id', class_id as string)
          .where('academic_sessions.tenant_id', tenantId)
          .first();
        if (!classCheck) {
          throw new AppError('Class not found or access denied', 404, 'NOT_FOUND');
        }
      }

      // Verify session belongs to this tenant if provided
      if (academic_session_id) {
        const sessionCheck = await db('academic_sessions').where({ id: academic_session_id as string, tenant_id: tenantId }).first();
        if (!sessionCheck) {
          throw new AppError('Academic session not found or access denied', 404, 'NOT_FOUND');
        }
      }

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
      const tenantId = req.user?.tenant_id;

      if (!tenantId) {
        throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
      }

      if (!academicSessionId) {
        return res.status(400).json({
          success: false,
          error: 'academicSessionId is required',
        });
      }

      // Verify class belongs to this tenant
      const classCheck = await db('classes')
        .join('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
        .where('classes.id', classId)
        .where('academic_sessions.tenant_id', tenantId)
        .first();
      if (!classCheck) {
        throw new AppError('Class not found or access denied', 404, 'NOT_FOUND');
      }

      // Verify session belongs to this tenant
      const sessionCheck = await db('academic_sessions').where({ id: academicSessionId as string, tenant_id: tenantId }).first();
      if (!sessionCheck) {
        throw new AppError('Academic session not found or access denied', 404, 'NOT_FOUND');
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
      const tenantId = req.user?.tenant_id;

      if (!tenantId) {
        throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
      }

      if (!classId || !academicSessionId) {
        return res.status(400).json({
          success: false,
          error: 'classId and academicSessionId are required',
        });
      }

      // Verify student belongs to this tenant
      const student = await db('students').where({ id: studentId, tenant_id: tenantId }).first();
      if (!student) {
        throw new AppError('Student not found or access denied', 404, 'NOT_FOUND');
      }

      // Verify class belongs to this tenant
      const classCheck = await db('classes')
        .join('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
        .where('classes.id', classId as string)
        .where('academic_sessions.tenant_id', tenantId)
        .first();
      if (!classCheck) {
        throw new AppError('Class not found or access denied', 404, 'NOT_FOUND');
      }

      // Verify session belongs to this tenant
      const sessionCheck = await db('academic_sessions').where({ id: academicSessionId as string, tenant_id: tenantId }).first();
      if (!sessionCheck) {
        throw new AppError('Academic session not found or access denied', 404, 'NOT_FOUND');
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
      const tenantId = req.user?.tenant_id;

      if (!tenantId) {
        throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
      }

      if (!academicSessionId) {
        return res.status(400).json({
          success: false,
          error: 'academicSessionId is required',
        });
      }

      // Verify class belongs to this tenant
      const classCheck = await db('classes')
        .join('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
        .where('classes.id', classId)
        .where('academic_sessions.tenant_id', tenantId)
        .first();
      if (!classCheck) {
        throw new AppError('Class not found or access denied', 404, 'NOT_FOUND');
      }

      // Verify session belongs to this tenant
      const sessionCheck = await db('academic_sessions').where({ id: academicSessionId as string, tenant_id: tenantId }).first();
      if (!sessionCheck) {
        throw new AppError('Academic session not found or access denied', 404, 'NOT_FOUND');
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
      const tenantId = req.user?.tenant_id;

      if (!tenantId) {
        throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
      }

      // Verify record belongs to this tenant (via student)
      const recordCheck = await db('attendance')
        .join('students', 'attendance.student_id', 'students.id')
        .where('attendance.id', recordId)
        .where('students.tenant_id', tenantId)
        .first();
      if (!recordCheck) {
        throw new AppError('Attendance record not found or access denied', 404, 'NOT_FOUND');
      }

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
      const tenantId = req.user?.tenant_id;

      if (!tenantId) {
        throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
      }

      if (!academicSessionId) {
        return res.status(400).json({
          success: false,
          error: 'academicSessionId is required',
        });
      }

      // Verify class belongs to this tenant
      const classCheck = await db('classes')
        .join('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
        .where('classes.id', classId)
        .where('academic_sessions.tenant_id', tenantId)
        .first();
      if (!classCheck) {
        throw new AppError('Class not found or access denied', 404, 'NOT_FOUND');
      }

      // Verify session belongs to this tenant
      const sessionCheck = await db('academic_sessions').where({ id: academicSessionId as string, tenant_id: tenantId }).first();
      if (!sessionCheck) {
        throw new AppError('Academic session not found or access denied', 404, 'NOT_FOUND');
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
