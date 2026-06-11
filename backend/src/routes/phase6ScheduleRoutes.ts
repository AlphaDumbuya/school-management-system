import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '@middleware/authMiddleware';
import { db } from '@utils/database';
import { ScheduleService } from '@services/scheduleService';
import { AuditService } from '@services/auditService';
import { logger } from '@utils/logger';

const router = Router();
const scheduleService = new ScheduleService(db);
const auditService = new AuditService(db);

/**
 * POST /api/v1/schedules
 * Create a new schedule entry
 */
router.post(
  '/',
  authenticate,
  requirePermission('schedule:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room_number, academic_session_id } = req.body;
      const userId = (req as any).user.userId;

      const schedule = await scheduleService.createSchedule(
        {
          class_id,
          subject_id,
          teacher_id,
          day_of_week,
          start_time,
          end_time,
          room_number,
          academic_session_id,
        },
        userId
      );

      // Audit log
      await auditService.logAudit({
        entity_type: 'schedule',
        entity_id: schedule.id,
        action: 'create',
        performed_by: userId,
        new_values: schedule,
        reason: `Schedule created for ${schedule.subject_name} on day ${day_of_week}`,
        source: 'api',
      });

      res.status(201).json({
        success: true,
        message: 'Schedule created successfully',
        data: schedule,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/schedules/:scheduleId
 * Get schedule details
 */
router.get(
  '/:scheduleId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { scheduleId } = req.params;

      const schedule = await scheduleService.getScheduleById(scheduleId);

      res.json({
        success: true,
        data: schedule,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/schedules/class/:classId
 * Get class schedule
 */
router.get(
  '/class/:classId',
  authenticate,
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

      const schedule = await scheduleService.getClassSchedule(classId, academicSessionId as string);

      res.json({
        success: true,
        data: schedule,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/schedules/teacher/:teacherId
 * Get teacher schedule
 */
router.get(
  '/teacher/:teacherId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { teacherId } = req.params;
      const { academicSessionId } = req.query;

      if (!academicSessionId) {
        return res.status(400).json({
          success: false,
          error: 'academicSessionId is required',
        });
      }

      const schedule = await scheduleService.getTeacherSchedule(teacherId, academicSessionId as string);

      res.json({
        success: true,
        data: schedule,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/schedules/class/:classId/weekly
 * Get weekly schedule for class
 */
router.get(
  '/class/:classId/weekly',
  authenticate,
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

      const weeklySchedule = await scheduleService.getWeeklySchedule(
        classId,
        academicSessionId as string
      );

      res.json({
        success: true,
        data: weeklySchedule,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/schedules/:scheduleId
 * Update schedule
 */
router.put(
  '/:scheduleId',
  authenticate,
  requirePermission('schedule:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { scheduleId } = req.params;
      const { start_time, end_time, room_number } = req.body;
      const userId = (req as any).user.userId;

      const oldSchedule = await scheduleService.getScheduleById(scheduleId);
      const updatedSchedule = await scheduleService.updateSchedule(
        scheduleId,
        { start_time, end_time, room_number },
        userId
      );

      // Audit log
      await auditService.logAudit({
        entity_type: 'schedule',
        entity_id: scheduleId,
        action: 'update',
        performed_by: userId,
        old_values: oldSchedule,
        new_values: updatedSchedule,
        reason: 'Schedule updated',
        source: 'api',
      });

      res.json({
        success: true,
        message: 'Schedule updated successfully',
        data: updatedSchedule,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/schedules/:scheduleId
 * Delete schedule
 */
router.delete(
  '/:scheduleId',
  authenticate,
  requirePermission('schedule:delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { scheduleId } = req.params;
      const userId = (req as any).user.userId;

      await scheduleService.deleteSchedule(scheduleId);

      // Audit log
      await auditService.logAudit({
        entity_type: 'schedule',
        entity_id: scheduleId,
        action: 'delete',
        performed_by: userId,
        reason: 'Schedule deleted',
        source: 'api',
      });

      res.json({
        success: true,
        message: 'Schedule deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/schedules/class/:classId/publish
 * Publish class schedule
 */
router.post(
  '/class/:classId/publish',
  authenticate,
  requirePermission('schedule:publish'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { classId } = req.params;
      const { academicSessionId } = req.body;
      const userId = (req as any).user.userId;

      if (!academicSessionId) {
        return res.status(400).json({
          success: false,
          error: 'academicSessionId is required',
        });
      }

      const result = await scheduleService.publishSchedule(classId, academicSessionId, userId);

      // Audit log
      await auditService.logAudit({
        entity_type: 'schedule',
        entity_id: classId,
        action: 'publish',
        performed_by: userId,
        new_values: result,
        reason: 'Schedule published for students',
        source: 'api',
      });

      res.json({
        success: true,
        message: 'Schedule published successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/schedules/report
 * Get schedule report for academic session
 */
router.get(
  '/report',
  authenticate,
  requirePermission('schedule:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { academicSessionId } = req.query;

      if (!academicSessionId) {
        return res.status(400).json({
          success: false,
          error: 'academicSessionId is required',
        });
      }

      const report = await scheduleService.getScheduleReport(academicSessionId as string);

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
