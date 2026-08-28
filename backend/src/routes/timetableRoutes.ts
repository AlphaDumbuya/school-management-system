import { db } from '../utils/database.js';
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '@middleware/authMiddleware';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import { UserRole } from '../types/auth';

const router = Router();
router.use(authenticate);
router.use(attachUserContext);

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

/**
 * POST /api/v1/timetable
 * Create a new timetable slot
 */
router.post('/', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room_number } = req.body;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    if (!class_id || !subject_id || !teacher_id || !day_of_week || !start_time || !end_time) {
      throw new AppError('Missing required fields: class_id, subject_id, teacher_id, day_of_week, start_time, end_time', 400, 'VALIDATION_ERROR');
    }

    // Verify class belongs to this tenant
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

    // Verify teacher belongs to this tenant
    const teacherCheck = await db('teachers')
      .join('users', 'teachers.user_id', 'users.id')
      .where('teachers.id', teacher_id)
      .where('users.tenant_id', tenantId)
      .first();
    if (!teacherCheck) {
      throw new AppError('Teacher not found or access denied', 404, 'NOT_FOUND');
    }

    if (!DAYS_OF_WEEK.includes(day_of_week)) {
      throw new AppError('Invalid day_of_week. Must be Monday–Friday', 400, 'VALIDATION_ERROR');
    }

    // Check for time conflicts in the same class/day
    const conflict = await db('schedules')
      .where('class_id', class_id)
      .where('day_of_week', day_of_week)
      .where(function () {
        this.where('start_time', '<', end_time).andWhere('end_time', '>', start_time);
      })
      .first();

    if (conflict) {
      throw new AppError('Time conflict: another slot already occupies this time for this class', 409, 'TIME_CONFLICT');
    }

    // Check teacher availability
    const teacherConflict = await db('schedules')
      .where('teacher_id', teacher_id)
      .where('day_of_week', day_of_week)
      .where(function () {
        this.where('start_time', '<', end_time).andWhere('end_time', '>', start_time);
      })
      .first();

    if (teacherConflict) {
      throw new AppError('Teacher is already assigned to another class during this time', 409, 'TEACHER_CONFLICT');
    }

    const [inserted] = await db('schedules').insert({
      class_id,
      subject_id,
      teacher_id,
      day_of_week,
      start_time,
      end_time,
      room_number: room_number || null,
      created_at: new Date(),
      updated_at: new Date(),
    }).returning('*');

    res.status(201).json({
      message: 'Timetable slot created successfully',
      data: inserted,
    });

    logger.info(`Timetable slot created: ${day_of_week} ${start_time}-${end_time}`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/timetable
 * List all slots with optional filters
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { class_id, teacher_id, day_of_week } = req.query;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    let query = db('schedules')
      .join('classes', 'schedules.class_id', 'classes.id')
      .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
      .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
      .leftJoin('subjects', 'schedules.subject_id', 'subjects.id')
      .leftJoin('teachers', 'schedules.teacher_id', 'teachers.id')
      .leftJoin('users', 'teachers.user_id', 'users.id')
      .where(function () {
        this.where('academic_sessions.tenant_id', tenantId)
          .orWhere(function () {
            this.whereNull('classes.academic_session_id')
              .where('class_creator.tenant_id', tenantId);
          });
      })
      .select(
        'schedules.*',
        'classes.name as class_name',
        'classes.level as class_level',
        'subjects.name as subject_name',
        'subjects.code as subject_code',
        'subjects.category as subject_category',
        db.raw("COALESCE(users.first_name || ' ' || users.last_name, 'Unknown') as teacher_name")
      );

    // Teacher scoping: teachers only see their own timetable slots.
    if (req.user?.role === 'teacher') {
      const teacher = await db('teachers')
        .join('users', 'teachers.user_id', 'users.id')
        .where('teachers.user_id', req.user.id)
        .where('users.tenant_id', tenantId)
        .select('teachers.id')
        .first();
      if (!teacher) {
        return res.json({ data: [], total: 0 });
      }
      query = query.where('schedules.teacher_id', teacher.id);
    }

    if (class_id) query = query.where('schedules.class_id', class_id as string);
    if (teacher_id) query = query.where('schedules.teacher_id', teacher_id as string);
    if (day_of_week) query = query.where('schedules.day_of_week', day_of_week as string);

    const slots = await query.orderBy('schedules.day_of_week', 'asc').orderBy('schedules.start_time', 'asc');

    res.json({
      data: slots,
      total: slots.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/timetable/weekly/:classId
 * Get full weekly timetable grid for a class
 */
router.get('/weekly/:classId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { classId } = req.params;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const classData = await db('classes')
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
      .select('classes.*')
      .first();
    if (!classData) {
      throw new AppError('Class not found', 404, 'NOT_FOUND');
    }

    // Teacher scoping: a teacher may only view the weekly grid of a class they
    // teach (teacher_assignments) or lead (class_teacher_id).
    if (req.user?.role === 'teacher') {
      const teacher = await db('teachers')
        .join('users', 'teachers.user_id', 'users.id')
        .where('teachers.user_id', req.user.id)
        .where('users.tenant_id', tenantId)
        .select('teachers.id')
        .first();
      let allowed = false;
      if (teacher) {
        const assigned = await db('teacher_assignments').where({ teacher_id: teacher.id, class_id: classId }).first();
        const led = classData.class_teacher_id === teacher.id;
        allowed = !!(assigned || led);
      }
      if (!allowed) {
        throw new AppError('You are not assigned to this class', 403, 'FORBIDDEN');
      }
    }

    const slots = await db('schedules')
      .select(
        'schedules.*',
        'subjects.name as subject_name',
        'subjects.code as subject_code',
        'subjects.category as subject_category',
        db.raw("COALESCE(users.first_name || ' ' || users.last_name, 'Unknown') as teacher_name")
      )
      .leftJoin('subjects', 'schedules.subject_id', 'subjects.id')
      .leftJoin('teachers', 'schedules.teacher_id', 'teachers.id')
      .leftJoin('users', 'teachers.user_id', 'users.id')
      .where('schedules.class_id', classId)
      .orderBy('schedules.start_time', 'asc');

    // Group by day
    const weekly: Record<string, any[]> = {};
    DAYS_OF_WEEK.forEach((day) => { weekly[day] = []; });
    slots.forEach((slot: any) => {
      if (weekly[slot.day_of_week]) {
        weekly[slot.day_of_week].push(slot);
      }
    });

    res.json({
      class_id: classId,
      class_name: classData.name,
      class_level: classData.level,
      weekly,
      total_slots: slots.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/timetable/teachers
 * Get list of teachers for dropdown
 */
router.get('/teachers', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const teachers = await db('teachers')
      .select(
        'teachers.id',
        'teachers.teacher_id as staff_id',
        'teachers.user_id',
        'users.first_name',
        'users.last_name',
        'teachers.specialization'
      )
      .leftJoin('users', 'teachers.user_id', 'users.id')
      .where('users.tenant_id', tenantId)
      .where('teachers.status', 'active')
      .orderBy('users.first_name', 'asc');

    res.json({ data: teachers });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/timetable/:slotId
 * Update a timetable slot
 */
router.put('/:slotId', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slotId } = req.params;
    const { subject_id, teacher_id, day_of_week, start_time, end_time, room_number } = req.body;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const slot = await db('schedules')
      .join('classes', 'schedules.class_id', 'classes.id')
      .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
      .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
      .where('schedules.id', slotId)
      .where(function () {
        this.where('academic_sessions.tenant_id', tenantId)
          .orWhere(function () {
            this.whereNull('classes.academic_session_id')
              .where('class_creator.tenant_id', tenantId);
          });
      })
      .select('schedules.*')
      .first();
    if (!slot) {
      throw new AppError('Timetable slot not found', 404, 'NOT_FOUND');
    }

    const updateData: any = {};
    if (subject_id) updateData.subject_id = subject_id;
    if (teacher_id) updateData.teacher_id = teacher_id;
    if (day_of_week) updateData.day_of_week = day_of_week;
    if (start_time) updateData.start_time = start_time;
    if (end_time) updateData.end_time = end_time;
    if (room_number !== undefined) updateData.room_number = room_number || null;
    updateData.updated_at = new Date();

    // Check for time conflicts if time changed
    if (start_time || end_time || day_of_week) {
      const checkDay = day_of_week || slot.day_of_week;
      const checkStart = start_time || slot.start_time;
      const checkEnd = end_time || slot.end_time;
      const checkClassId = slot.class_id;

      const conflict = await db('schedules')
        .where('class_id', checkClassId)
        .where('day_of_week', checkDay)
        .whereNot('id', slotId)
        .where(function () {
          this.where('start_time', '<', checkEnd).andWhere('end_time', '>', checkStart);
        })
        .first();

      if (conflict) {
        throw new AppError('Time conflict with another slot', 409, 'TIME_CONFLICT');
      }
    }

    await db('schedules').where('id', slotId).update(updateData);
    const updated = await db('schedules').where('id', slotId).first();

    res.json({
      message: 'Timetable slot updated successfully',
      data: updated,
    });

    logger.info(`Timetable slot updated: ${slotId}`);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/timetable/:slotId
 * Delete a timetable slot
 */
router.delete('/:slotId', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slotId } = req.params;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const slot = await db('schedules')
      .join('classes', 'schedules.class_id', 'classes.id')
      .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
      .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
      .where('schedules.id', slotId)
      .where(function () {
        this.where('academic_sessions.tenant_id', tenantId)
          .orWhere(function () {
            this.whereNull('classes.academic_session_id')
              .where('class_creator.tenant_id', tenantId);
          });
      })
      .select('schedules.*')
      .first();
    if (!slot) {
      throw new AppError('Timetable slot not found', 404, 'NOT_FOUND');
    }

    await db('schedules').where('id', slotId).del();

    res.json({ message: 'Timetable slot deleted successfully' });

    logger.info(`Timetable slot deleted: ${slotId}`);
  } catch (error) {
    next(error);
  }
});

export default router;
