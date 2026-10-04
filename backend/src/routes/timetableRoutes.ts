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

/** The academic session a class belongs to, and whether it's the active year. */
async function classYear(classId: string): Promise<{ sessionId: string | null; isPast: boolean }> {
  const row = await db('classes')
    .leftJoin('academic_sessions as s', 'classes.academic_session_id', 's.id')
    .where('classes.id', classId)
    .first('classes.academic_session_id as session_id', 's.is_active as session_active');
  const sessionId = row?.session_id ?? null;
  // Legacy classes with no session are treated as current.
  return { sessionId, isPast: !!sessionId && row?.session_active === false };
}

/** A past year's timetable is read-only history. */
function assertCurrentYear(isPast: boolean) {
  if (isPast) {
    throw new AppError('This timetable belongs to a past academic year and is read-only', 409, 'PAST_YEAR_READ_ONLY');
  }
}

/**
 * Teacher double-booking only counts within the SAME academic year. After a
 * rollover every slot has a twin in last year's copy of the class; those must
 * not block editing this year's timetable.
 */
function sameYearSchedules(sessionId: string | null) {
  const q = db('schedules').join('classes as yc', 'schedules.class_id', 'yc.id');
  if (sessionId) q.where('yc.academic_session_id', sessionId);
  else q.whereNull('yc.academic_session_id');
  return q;
}

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
    const target = await classYear(class_id);
    assertCurrentYear(target.isPast);

    // Verify teacher belongs to this tenant
    const teacherCheck = await db('teachers')
      .join('users', 'teachers.user_id', 'users.id')
      .where('teachers.id', teacher_id)
      .where('users.tenant_id', tenantId)
      .first();
    if (!teacherCheck) {
      throw new AppError('Teacher not found or access denied', 404, 'NOT_FOUND');
    }

    // Verify subject belongs to this tenant (prefer real tenant_id, legacy
    // fallback via created_by so pre-migration-151 rows still validate).
    const subjectCheck = await db('subjects')
      .leftJoin('users as subj_creator', 'subjects.created_by', 'subj_creator.id')
      .where('subjects.id', subject_id)
      .where(function () {
        this.where('subjects.tenant_id', tenantId).orWhere(function () {
          this.whereNull('subjects.tenant_id').where('subj_creator.tenant_id', tenantId);
        });
      })
      .first();
    if (!subjectCheck) {
      throw new AppError('Subject not found or access denied', 404, 'NOT_FOUND');
    }

    if (!DAYS_OF_WEEK.includes(day_of_week)) {
      throw new AppError('Invalid day_of_week. Must be Monday–Friday', 400, 'VALIDATION_ERROR');
    }

    // start_time must be strictly before end_time, else the overlap logic breaks.
    if (String(start_time) >= String(end_time)) {
      throw new AppError('Start time must be before end time', 400, 'VALIDATION_ERROR');
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

    // Check teacher availability (same academic year only)
    const teacherConflict = await sameYearSchedules(target.sessionId)
      .where('schedules.teacher_id', teacher_id)
      .where('schedules.day_of_week', day_of_week)
      .where(function () {
        this.where('schedules.start_time', '<', end_time).andWhere('schedules.end_time', '>', start_time);
      })
      .first('schedules.id');

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
      // Tag the slot with its year (the class's session) and author.
      academic_session_id: target.sessionId,
      created_by: req.user?.id ?? null,
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

    // Student / parent scoping: only a class the student is or was in (or,
    // for a parent, one of their linked children). Any other id → 403.
    const viewerRole = req.user?.role as string | undefined;
    if (viewerRole === 'student' || viewerRole === 'parent' || viewerRole === 'guardian') {
      const studentIds = viewerRole === 'student'
        ? (await db('students').where({ user_id: req.user!.id, tenant_id: tenantId }).select('id')).map((r: any) => r.id)
        : (await db('guardians as g').join('students as s', 'g.student_id', 's.id')
            .where('g.user_id', req.user!.id).where('s.tenant_id', tenantId).select('s.id')).map((r: any) => r.id);
      const inClass = studentIds.length
        ? await db('enrollments').whereIn('student_id', studentIds).where('class_id', classId).first('id')
        : null;
      if (!inClass) {
        throw new AppError(viewerRole === 'student' ? 'You can only view your own class timetable' : "You can only view your children's class timetables", 403, 'FORBIDDEN');
      }
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
    const slotYear = await classYear(slot.class_id);
    assertCurrentYear(slotYear.isPast);

    // If the teacher or subject is being changed, verify tenant ownership.
    if (teacher_id) {
      const teacherCheck = await db('teachers')
        .join('users', 'teachers.user_id', 'users.id')
        .where('teachers.id', teacher_id)
        .where('users.tenant_id', tenantId)
        .first();
      if (!teacherCheck) throw new AppError('Teacher not found or access denied', 404, 'NOT_FOUND');
    }
    if (subject_id) {
      const subjectCheck = await db('subjects')
        .leftJoin('users as subj_creator', 'subjects.created_by', 'subj_creator.id')
        .where('subjects.id', subject_id)
        .where(function () {
          this.where('subjects.tenant_id', tenantId).orWhere(function () {
            this.whereNull('subjects.tenant_id').where('subj_creator.tenant_id', tenantId);
          });
        })
        .first();
      if (!subjectCheck) throw new AppError('Subject not found or access denied', 404, 'NOT_FOUND');
    }
    if (day_of_week && !DAYS_OF_WEEK.includes(day_of_week)) {
      throw new AppError('Invalid day_of_week. Must be Monday–Friday', 400, 'VALIDATION_ERROR');
    }

    const updateData: any = {};
    if (subject_id) updateData.subject_id = subject_id;
    if (teacher_id) updateData.teacher_id = teacher_id;
    if (day_of_week) updateData.day_of_week = day_of_week;
    if (start_time) updateData.start_time = start_time;
    if (end_time) updateData.end_time = end_time;
    if (room_number !== undefined) updateData.room_number = room_number || null;
    updateData.updated_at = new Date();

    // Resolve the effective slot values after this update for conflict checks.
    const checkDay = day_of_week || slot.day_of_week;
    const checkStart = start_time || slot.start_time;
    const checkEnd = end_time || slot.end_time;
    const checkTeacher = teacher_id || slot.teacher_id;

    if (String(checkStart) >= String(checkEnd)) {
      throw new AppError('Start time must be before end time', 400, 'VALIDATION_ERROR');
    }

    // Class time-conflict (if day/time changed).
    if (start_time || end_time || day_of_week) {
      const conflict = await db('schedules')
        .where('class_id', slot.class_id)
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

    // Teacher double-booking check (if teacher/day/time changed) — this was
    // missing on update, so an edit could put a teacher in two classes at once.
    if (teacher_id || start_time || end_time || day_of_week) {
      const teacherConflict = await sameYearSchedules(slotYear.sessionId)
        .where('schedules.teacher_id', checkTeacher)
        .where('schedules.day_of_week', checkDay)
        .whereNot('schedules.id', slotId)
        .where(function () {
          this.where('schedules.start_time', '<', checkEnd).andWhere('schedules.end_time', '>', checkStart);
        })
        .first('schedules.id');
      if (teacherConflict) {
        throw new AppError('Teacher is already assigned to another class during this time', 409, 'TEACHER_CONFLICT');
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
    assertCurrentYear((await classYear(slot.class_id)).isPast);

    await db('schedules').where('id', slotId).del();

    res.json({ message: 'Timetable slot deleted successfully' });

    logger.info(`Timetable slot deleted: ${slotId}`);
  } catch (error) {
    next(error);
  }
});

// ── Period Configuration (tenant-scoped) ──────────────────────────────────────

/**
 * GET /api/v1/timetable/period-configs
 * Get all period configs for the current tenant
 */
router.get('/period-configs', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const configs = await db('timetable_period_configs')
      .where({ tenant_id: tenantId, is_active: true })
      .select('id', 'school_level', 'periods', 'is_active', 'created_at', 'updated_at');

    res.json({ data: configs });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/timetable/period-configs/:level
 * Get period config for a specific school level
 */
router.get('/period-configs/:level', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user?.tenant_id;
    const { level } = req.params;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const validLevels = ['nursery', 'primary', 'jss', 'sss'];
    if (!validLevels.includes(level)) {
      throw new AppError('Invalid school level', 400, 'VALIDATION_ERROR');
    }

    const config = await db('timetable_period_configs')
      .where({ tenant_id: tenantId, school_level: level, is_active: true })
      .first();

    res.json({ data: config || null });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/timetable/period-configs/:level
 * Create or update period config for a school level (upsert)
 */
router.put('/period-configs/:level', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user?.tenant_id;
    const { level } = req.params;
    const { periods } = req.body;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const validLevels = ['nursery', 'primary', 'jss', 'sss'];
    if (!validLevels.includes(level)) {
      throw new AppError('Invalid school level', 400, 'VALIDATION_ERROR');
    }

    if (!Array.isArray(periods) || periods.length === 0) {
      throw new AppError('Periods array is required and must not be empty', 400, 'VALIDATION_ERROR');
    }

    // Validate each period has the required fields
    for (const p of periods) {
      if (!p.label || !p.start || !p.end) {
        throw new AppError('Each period must have label, start, and end', 400, 'VALIDATION_ERROR');
      }
    }

    // Upsert: insert or update if exists
    const existing = await db('timetable_period_configs')
      .where({ tenant_id: tenantId, school_level: level })
      .first();

    if (existing) {
      await db('timetable_period_configs')
        .where({ id: existing.id })
        .update({
          periods: JSON.stringify(periods),
          updated_at: new Date(),
        });
    } else {
      await db('timetable_period_configs').insert({
        tenant_id: tenantId,
        school_level: level,
        periods: JSON.stringify(periods),
        is_active: true,
        created_by: req.user?.id || null,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    logger.info(`Period config saved for level ${level} (tenant: ${tenantId})`);

    res.json({
      message: 'Period configuration saved successfully',
      data: { school_level: level, periods },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/timetable/period-configs/:level
 * Reset period config for a school level (reverts to system defaults)
 */
router.delete('/period-configs/:level', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user?.tenant_id;
    const { level } = req.params;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    await db('timetable_period_configs')
      .where({ tenant_id: tenantId, school_level: level })
      .del();

    logger.info(`Period config reset for level ${level} (tenant: ${tenantId})`);

    res.json({ message: 'Period configuration reset to system defaults' });
  } catch (error) {
    next(error);
  }
});

export default router;
