import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission, attachUserContext } from '@middleware/authMiddleware';
import { db } from '@utils/database';
import { ScheduleService } from '@services/scheduleService';
import { AuditService } from '@services/auditService';
import { logger } from '@utils/logger';
import { AppError } from '@middleware/errorHandler';

const router = Router();
router.use(authenticate);
router.use(attachUserContext);
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
      const tenantId = req.user?.tenant_id;

      if (!tenantId) {
        throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
      }

      // Verify class belongs to tenant
      const classCheck = await db('classes')
        .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
        .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
        .where('classes.id', class_id)
        .where(function () {
          this.where('academic_sessions.tenant_id', tenantId)
            .orWhere(function () {
              this.whereNull('classes.academic_session_id')
                .where('class_creator.tenant_id', tenantId);
            });
        })
        .first();
      if (!classCheck) {
        throw new AppError('Class not found or access denied', 404, 'NOT_FOUND');
      }

      // Verify subject belongs to tenant
      const subjectCheck = await db('subjects')
        .join('users', 'subjects.created_by', 'users.id')
        .where('subjects.id', subject_id)
        .where('users.tenant_id', tenantId)
        .first();
      if (!subjectCheck) {
        throw new AppError('Subject not found or access denied', 404, 'NOT_FOUND');
      }

      // Verify teacher belongs to tenant
      const teacherCheck = await db('teachers')
        .join('users', 'teachers.user_id', 'users.id')
        .where('teachers.id', teacher_id)
        .where('users.tenant_id', tenantId)
        .first();
      if (!teacherCheck) {
        throw new AppError('Teacher not found or access denied', 404, 'NOT_FOUND');
      }

      // Verify session belongs to tenant
      const sessionCheck = await db('academic_sessions').where({ id: academic_session_id, tenant_id: tenantId }).first();
      if (!sessionCheck) {
        throw new AppError('Academic session not found or access denied', 404, 'NOT_FOUND');
      }

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
      const tenantId = req.user?.tenant_id;

      if (!tenantId) {
        throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
      }

      // Verify schedule belongs to tenant
      const scheduleCheck = await db('schedules')
        .join('classes', 'schedules.class_id', 'classes.id')
        .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
        .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
        .where('schedules.id', scheduleId)
        .where(function () {
          this.where('academic_sessions.tenant_id', tenantId)
            .orWhere(function () {
              this.whereNull('classes.academic_session_id')
                .where('class_creator.tenant_id', tenantId);
            });
        })
        .first();
      if (!scheduleCheck) {
        throw new AppError('Schedule not found or access denied', 404, 'NOT_FOUND');
      }

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

      // Verify class belongs to tenant
      const classCheck = await db('classes')
        .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
        .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
        .where('classes.id', classId)
        .where(function () {
          this.where('academic_sessions.tenant_id', tenantId)
            .orWhere(function () {
              this.whereNull('classes.academic_session_id')
                .where('class_creator.tenant_id', tenantId);
            });
        })
        .first();
      if (!classCheck) {
        throw new AppError('Class not found or access denied', 404, 'NOT_FOUND');
      }

      // Verify session belongs to tenant
      const sessionCheck = await db('academic_sessions').where({ id: academicSessionId as string, tenant_id: tenantId }).first();
      if (!sessionCheck) {
        throw new AppError('Academic session not found or access denied', 404, 'NOT_FOUND');
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

      // Verify teacher belongs to tenant
      const teacherCheck = await db('teachers')
        .join('users', 'teachers.user_id', 'users.id')
        .where('teachers.id', teacherId)
        .where('users.tenant_id', tenantId)
        .first();
      if (!teacherCheck) {
        throw new AppError('Teacher not found or access denied', 404, 'NOT_FOUND');
      }

      // Verify session belongs to tenant
      const sessionCheck = await db('academic_sessions').where({ id: academicSessionId as string, tenant_id: tenantId }).first();
      if (!sessionCheck) {
        throw new AppError('Academic session not found or access denied', 404, 'NOT_FOUND');
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

      // Verify class belongs to tenant
      const classCheck = await db('classes')
        .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
        .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
        .where('classes.id', classId)
        .where(function () {
          this.where('academic_sessions.tenant_id', tenantId)
            .orWhere(function () {
              this.whereNull('classes.academic_session_id')
                .where('class_creator.tenant_id', tenantId);
            });
        })
        .first();
      if (!classCheck) {
        throw new AppError('Class not found or access denied', 404, 'NOT_FOUND');
      }

      // Verify session belongs to tenant
      const sessionCheck = await db('academic_sessions').where({ id: academicSessionId as string, tenant_id: tenantId }).first();
      if (!sessionCheck) {
        throw new AppError('Academic session not found or access denied', 404, 'NOT_FOUND');
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
      const tenantId = req.user?.tenant_id;

      if (!tenantId) {
        throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
      }

      // Verify schedule belongs to tenant
      const scheduleCheck = await db('schedules')
        .join('classes', 'schedules.class_id', 'classes.id')
        .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
        .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
        .where('schedules.id', scheduleId)
        .where(function () {
          this.where('academic_sessions.tenant_id', tenantId)
            .orWhere(function () {
              this.whereNull('classes.academic_session_id')
                .where('class_creator.tenant_id', tenantId);
            });
        })
        .first();
      if (!scheduleCheck) {
        throw new AppError('Schedule not found or access denied', 404, 'NOT_FOUND');
      }

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
      const tenantId = req.user?.tenant_id;

      if (!tenantId) {
        throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
      }

      // Verify schedule belongs to tenant
      const scheduleCheck = await db('schedules')
        .join('classes', 'schedules.class_id', 'classes.id')
        .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
        .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
        .where('schedules.id', scheduleId)
        .where(function () {
          this.where('academic_sessions.tenant_id', tenantId)
            .orWhere(function () {
              this.whereNull('classes.academic_session_id')
                .where('class_creator.tenant_id', tenantId);
            });
        })
        .first();
      if (!scheduleCheck) {
        throw new AppError('Schedule not found or access denied', 404, 'NOT_FOUND');
      }

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

      // Verify class belongs to tenant
      const classCheck = await db('classes')
        .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
        .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
        .where('classes.id', classId)
        .where(function () {
          this.where('academic_sessions.tenant_id', tenantId)
            .orWhere(function () {
              this.whereNull('classes.academic_session_id')
                .where('class_creator.tenant_id', tenantId);
            });
        })
        .first();
      if (!classCheck) {
        throw new AppError('Class not found or access denied', 404, 'NOT_FOUND');
      }

      // Verify session belongs to tenant
      const sessionCheck = await db('academic_sessions').where({ id: academicSessionId, tenant_id: tenantId }).first();
      if (!sessionCheck) {
        throw new AppError('Academic session not found or access denied', 404, 'NOT_FOUND');
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

      // Verify session belongs to tenant
      const sessionCheck = await db('academic_sessions').where({ id: academicSessionId as string, tenant_id: tenantId }).first();
      if (!sessionCheck) {
        throw new AppError('Academic session not found or access denied', 404, 'NOT_FOUND');
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
