import { db } from '../utils/database.js';
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '@middleware/authMiddleware';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import { UserRole } from '../types/auth';
import { normalizeAcademicYear, resolveActiveYear } from '../utils/academicYear.js';
import { isStudentOrParent, viewerStudentIds, viewerYearClasses, viewerInClass } from '../utils/studentScope.js';

const router = Router();
router.use(authenticate);
router.use(attachUserContext);

/**
 * A past academic year's exam timetable is read-only history. An exam is
 * "past" when its class belongs to an inactive session, or its academic_year
 * isn't the school's active year (legacy classes with no session count as current).
 */
async function assertExamCurrentYear(tenantId: string, classId?: string | null, academicYear?: string | null) {
  if (classId) {
    const cls = await db('classes')
      .leftJoin('academic_sessions as s', 'classes.academic_session_id', 's.id')
      .where('classes.id', classId)
      .first('s.id as session_id', 's.is_active');
    if (cls?.session_id && cls.is_active === false) {
      throw new AppError('This exam timetable belongs to a past academic year and is read-only', 409, 'PAST_YEAR_READ_ONLY');
    }
  }
  if (academicYear) {
    const { yearString } = await resolveActiveYear(tenantId);
    if (normalizeAcademicYear(academicYear) !== yearString) {
      throw new AppError('Exams can only be scheduled in the current academic year', 409, 'PAST_YEAR_READ_ONLY');
    }
  }
}

/**
 * POST /api/v1/examinations
 */
router.post('/', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, type, term, academic_year, class_id, subject_id, start_date, end_date, total_marks, pass_marks, duration_minutes, venue, instructions, status } = req.body;
    const createdBy = req.auth?.userId ?? null;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    if (!title || !type || !term || !academic_year || !start_date) {
      throw new AppError('Missing required fields: title, type, term, academic_year, start_date', 400, 'VALIDATION_ERROR');
    }

    // Verify class belongs to this tenant if provided
    if (class_id) {
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
    }

    // Verify subject belongs to this tenant if provided.
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
      if (!subjectCheck) {
        throw new AppError('Subject not found or access denied', 404, 'NOT_FOUND');
      }
    }

    // If an end_date is given it must not precede the start_date.
    if (end_date && String(end_date) < String(start_date)) {
      throw new AppError('End date/time cannot be before the start', 400, 'VALIDATION_ERROR');
    }
    await assertExamCurrentYear(tenantId, class_id, academic_year);

    const [inserted] = await db('examinations').insert({
      title: title.trim(),
      description: description || null,
      type,
      term,
      academic_year,
      class_id: class_id || null,
      subject_id: subject_id || null,
      start_date,
      end_date: end_date || null,
      total_marks: total_marks || 100,
      pass_marks: pass_marks || 40,
      duration_minutes: duration_minutes || 120,
      venue: venue || null,
      instructions: instructions || null,
      status: status || 'scheduled',
      created_by: createdBy,
      created_at: new Date(),
      updated_at: new Date(),
    }).returning('*');

    res.status(201).json({ message: 'Examination created successfully', data: inserted });
    logger.info(`Examination created: ${title}`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/examinations
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const { type, term, academic_year, class_id, status, search } = req.query;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    let query = db('examinations')
      .join('users', 'examinations.created_by', 'users.id')
      .where('users.tenant_id', tenantId)
      .select(
        'examinations.*',
        'classes.name as class_name',
        'classes.level as class_level',
        'subjects.name as subject_name',
        'subjects.code as subject_code'
      )
      .leftJoin('classes', 'examinations.class_id', 'classes.id')
      .leftJoin('subjects', 'examinations.subject_id', 'subjects.id');

    // Teacher scoping: only see exams for classes/subjects they teach or lead.
    let teacherClassIds: string[] | null = null;
    if (req.user?.role === 'teacher') {
      const teacher = await db('teachers')
        .join('users as u', 'teachers.user_id', 'u.id')
        .where('teachers.user_id', req.user.id)
        .where('u.tenant_id', tenantId)
        .select('teachers.id')
        .first();
      if (!teacher) {
        return res.json({ data: [], pagination: { page, limit, total: 0, total_pages: 0 } });
      }
      // Classes the teacher teaches (any subject) plus classes they lead
      const assigned = await db('teacher_assignments').where('teacher_id', teacher.id).distinct('class_id');
      const led = await db('classes').where('class_teacher_id', teacher.id).select('id');
      teacherClassIds = Array.from(new Set<string>([
        ...assigned.map((r: any) => r.class_id),
        ...led.map((r: any) => r.id),
      ]));
      if (teacherClassIds.length === 0) {
        return res.json({ data: [], pagination: { page, limit, total: 0, total_pages: 0 } });
      }
      query = query.whereIn('examinations.class_id', teacherClassIds);
    }

    // Student / parent scoping: the class(es) the student (or the parent's
    // child) was in during the requested year (default = the active year), and
    // only that year's exams. Every class that year counts (promoted mid-year →
    // both). Last year's class is NOT used during an unfinished rollover: its
    // exams are over, so the year shows empty with the rollover notice.
    let viewerClassIds: string[] | null = null;
    let viewerMeta: any = null;
    let viewerYear: string | null = null;
    const viewer = isStudentOrParent(req.user?.role as string | undefined);
    if (viewer) {
      const scope = await viewerYearClasses(req.user?.role as string, req.user!.id, tenantId, {
        academicYear: (academic_year as string | undefined) || null,
        childId: (req.query.child_id as string | undefined) || null,
        useTransitionClass: false,
      });
      viewerMeta = scope.meta;
      viewerYear = scope.meta.academic_year;
      viewerClassIds = scope.classIds;
      // A class outside their own year scope → nothing (never another class's exams).
      if (class_id && !viewerClassIds.includes(String(class_id))) viewerClassIds = [];
      if (viewerClassIds.length === 0 || !viewerYear) {
        return res.json({ data: [], meta: viewerMeta, pagination: { page, limit, total: 0, total_pages: 0 } });
      }
      query = query.whereIn('examinations.class_id', viewerClassIds);
    }
    // Exams store "YYYY/YYYY"; match the canonical form of the requested year.
    const yearFilter = viewer ? viewerYear : (academic_year ? (normalizeAcademicYear(academic_year as string) || (academic_year as string)) : null);

    if (type) query = query.where('examinations.type', type as string);
    if (term) query = query.where('examinations.term', term as string);
    if (yearFilter) query = query.where('examinations.academic_year', yearFilter);
    if (class_id) query = query.where('examinations.class_id', class_id as string);
    if (status) query = query.where('examinations.status', status as string);
    if (search) {
      const searchTerm = `%${(search as string).trim()}%`;
      query = query.where(function () {
        this.where('examinations.title', 'ilike', searchTerm)
          .orWhere('subjects.name', 'ilike', searchTerm);
      });
    }

    // Separate count query
    let countQuery = db('examinations')
      .join('users', 'examinations.created_by', 'users.id')
      .where('users.tenant_id', tenantId)
      .count('examinations.id as count');
    if (teacherClassIds) countQuery = countQuery.whereIn('examinations.class_id', teacherClassIds);
    if (viewerClassIds) countQuery = countQuery.whereIn('examinations.class_id', viewerClassIds);
    if (type) countQuery = countQuery.where('examinations.type', type as string);
    if (term) countQuery = countQuery.where('examinations.term', term as string);
    if (yearFilter) countQuery = countQuery.where('examinations.academic_year', yearFilter);
    if (class_id) countQuery = countQuery.where('examinations.class_id', class_id as string);
    if (status) countQuery = countQuery.where('examinations.status', status as string);

    const totalResult = await countQuery.first();
    const total = Number(totalResult?.count ?? 0);
    const examinations = await query.limit(limit).offset(offset).orderBy('examinations.start_date', 'desc');

    res.json({
      data: examinations,
      ...(viewer ? { meta: viewerMeta } : {}),
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/examinations/:id
 */
router.get('/:examId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { examId } = req.params;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const exam = await db('examinations')
      .join('users', 'examinations.created_by', 'users.id')
      .where('examinations.id', examId)
      .where('users.tenant_id', tenantId)
      .select('examinations.*')
      .first();

    if (!exam) throw new AppError('Examination not found', 404, 'NOT_FOUND');
    // Students / parents: only exams for a class the student (or one of the
    // parent's children) is or was in. School-wide exams (no class) are fine.
    const role = req.user?.role as string | undefined;
    if (isStudentOrParent(role) && exam.class_id) {
      const ids = await viewerStudentIds(role, req.user!.id, tenantId, (req.query.child_id as string | undefined) || null);
      if (!(await viewerInClass(ids, exam.class_id))) {
        throw new AppError(role === 'student' ? 'You can only view exams for your own classes' : "You can only view your children's exams", 403, 'FORBIDDEN');
      }
    }
    res.json(exam);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/examinations/:id
 */
router.put('/:examId', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { examId } = req.params;
    const { title, description, type, term, academic_year, class_id, subject_id, start_date, end_date, total_marks, pass_marks, duration_minutes, venue, instructions, status } = req.body;
    const updatedBy = req.auth?.userId ?? null;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const exam = await db('examinations')
      .join('users', 'examinations.created_by', 'users.id')
      .where('examinations.id', examId)
      .where('users.tenant_id', tenantId)
      .select('examinations.*')
      .first();
    if (!exam) throw new AppError('Examination not found', 404, 'NOT_FOUND');
    // Neither the existing exam nor its new target may be in a past year.
    await assertExamCurrentYear(tenantId, exam.class_id, exam.academic_year);
    await assertExamCurrentYear(tenantId, class_id || null, academic_year || null);

    // Validate any changed class/subject belong to this tenant.
    if (class_id) {
      const classCheck = await db('classes')
        .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
        .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
        .where('classes.id', class_id)
        .where(function () {
          this.where('academic_sessions.tenant_id', tenantId).orWhere(function () {
            this.whereNull('classes.academic_session_id').where('class_creator.tenant_id', tenantId);
          });
        })
        .first();
      if (!classCheck) throw new AppError('Class not found or access denied', 404, 'NOT_FOUND');
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
    // Date ordering against the effective values after this update.
    const effStart = start_date || exam.start_date;
    const effEnd = end_date !== undefined ? end_date : exam.end_date;
    if (effEnd && effStart && String(effEnd) < String(effStart)) {
      throw new AppError('End date/time cannot be before the start', 400, 'VALIDATION_ERROR');
    }

    const updateData: any = {};
    if (title) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description || null;
    if (type) updateData.type = type;
    if (term) updateData.term = term;
    if (academic_year) updateData.academic_year = academic_year;
    if (class_id !== undefined) updateData.class_id = class_id || null;
    if (subject_id !== undefined) updateData.subject_id = subject_id || null;
    if (start_date) updateData.start_date = start_date;
    if (end_date !== undefined) updateData.end_date = end_date || null;
    if (total_marks !== undefined) updateData.total_marks = total_marks;
    if (pass_marks !== undefined) updateData.pass_marks = pass_marks;
    if (duration_minutes !== undefined) updateData.duration_minutes = duration_minutes;
    if (venue !== undefined) updateData.venue = venue || null;
    if (instructions !== undefined) updateData.instructions = instructions || null;
    if (status) updateData.status = status;
    updateData.updated_by = updatedBy;
    updateData.updated_at = new Date();

    await db('examinations').where('id', examId).update(updateData);
    const updated = await db('examinations').where('id', examId).first();

    res.json({ message: 'Examination updated successfully', data: updated });
    logger.info(`Examination updated: ${examId}`);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/examinations/:id
 */
router.delete('/:examId', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { examId } = req.params;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const exam = await db('examinations')
      .join('users', 'examinations.created_by', 'users.id')
      .where('examinations.id', examId)
      .where('users.tenant_id', tenantId)
      .select('examinations.*')
      .first();
    if (!exam) throw new AppError('Examination not found', 404, 'NOT_FOUND');
    await assertExamCurrentYear(tenantId, exam.class_id, exam.academic_year);

    await db('examinations').where('id', examId).del();
    res.json({ message: 'Examination deleted successfully' });
    logger.info(`Examination deleted: ${examId}`);
  } catch (error) {
    next(error);
  }
});

export default router;
