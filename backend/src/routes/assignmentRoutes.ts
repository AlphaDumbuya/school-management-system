import { db } from '../utils/database.js';
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '@middleware/authMiddleware';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import { UserRole } from '../types/auth';

const router = Router();
router.use(authenticate);
router.use(attachUserContext);

/**
 * If the caller is a teacher, ensure the assignment belongs to them.
 * Staff-admins (principal / super_admin) bypass this check.
 * Returns true when access is allowed.
 */
async function teacherOwnsAssignment(req: Request, assignmentTeacherId: string): Promise<boolean> {
  if (req.user?.role !== 'teacher') return true;
  const teacher = await db('teachers')
    .join('users', 'teachers.user_id', 'users.id')
    .where('teachers.user_id', req.user.id)
    .where('users.tenant_id', req.user.tenant_id)
    .select('teachers.id')
    .first();
  return !!teacher && teacher.id === assignmentTeacherId;
}

/**
 * POST /api/v1/assignments
 * Create a new assignment
 */
router.post('/', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.TEACHER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, class_id, subject_id, teacher_id, type, assigned_date, due_date, max_marks, instructions, resources, status, client_id } = req.body;
    const createdBy = req.auth?.userId ?? null;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    // Idempotency: a retried offline push with the same client_id returns the
    // already-created assignment instead of creating a duplicate.
    if (client_id) {
      const byClient = await db('assignments').where('client_id', client_id).first();
      if (byClient) {
        return res.status(200).json({ message: 'Assignment already created (idempotent)', data: byClient });
      }
    }

    // Teachers can only create assignments as themselves for classes they teach.
    let effectiveTeacherId = teacher_id;
    if (req.user?.role === 'teacher') {
      const teacher = await db('teachers')
        .join('users', 'teachers.user_id', 'users.id')
        .where('teachers.user_id', req.user.id)
        .where('users.tenant_id', tenantId)
        .select('teachers.id')
        .first();
      if (!teacher) {
        throw new AppError('Teacher profile not found', 403, 'FORBIDDEN');
      }
      effectiveTeacherId = teacher.id; // force own id
      // Must be assigned to (or lead) the target class
      const assigned = await db('teacher_assignments').where({ teacher_id: teacher.id, class_id }).first();
      const led = await db('classes').where({ id: class_id, class_teacher_id: teacher.id }).first();
      if (!assigned && !led) {
        throw new AppError('You are not assigned to this class', 403, 'FORBIDDEN');
      }
    }

    if (!title || !class_id || !subject_id || !effectiveTeacherId || !assigned_date || !due_date) {
      throw new AppError('Missing required fields: title, class_id, subject_id, teacher_id, assigned_date, due_date', 400, 'VALIDATION_ERROR');
    }

    // due_date must not be before assigned_date.
    if (String(due_date) < String(assigned_date)) {
      throw new AppError('Due date cannot be before the assigned date', 400, 'VALIDATION_ERROR');
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

    // Verify subject belongs to this tenant (real tenant_id, legacy created_by fallback).
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

    const [inserted] = await db('assignments').insert({
      title: title.trim(),
      description: description || null,
      class_id,
      subject_id,
      teacher_id: effectiveTeacherId,
      type: type || 'homework',
      assigned_date,
      due_date,
      max_marks: max_marks || 100,
      instructions: instructions || null,
      resources: resources ? JSON.stringify(resources) : null,
      status: status || 'active',
      created_by: createdBy,
      client_id: client_id || null,
      created_at: new Date(),
      updated_at: new Date(),
    }).returning('*');

    res.status(201).json({
      message: 'Assignment created successfully',
      data: inserted,
    });

    logger.info(`Assignment created: ${title}`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/assignments
 * List assignments with filters
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const { class_id, subject_id, teacher_id, status, type, search } = req.query;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    let query = db('assignments')
      .join('classes', 'assignments.class_id', 'classes.id')
      .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
      .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
      .leftJoin('subjects', 'assignments.subject_id', 'subjects.id')
      .leftJoin('teachers', 'assignments.teacher_id', 'teachers.id')
      .leftJoin('users', 'teachers.user_id', 'users.id')
      .where(function () {
        this.where('academic_sessions.tenant_id', tenantId)
          .orWhere(function () {
            this.whereNull('classes.academic_session_id')
              .where('class_creator.tenant_id', tenantId);
          });
      })
      .select(
        'assignments.*',
        'classes.name as class_name',
        'classes.level as class_level',
        'subjects.name as subject_name',
        'subjects.code as subject_code',
        db.raw("COALESCE(users.first_name || ' ' || users.last_name, 'Unknown') as teacher_name")
      );

    // Teacher scoping: teachers only see assignments they created/own. Resolve
    // once and apply to both the data and count queries.
    let teacherScopeId: string | null = null;
    if (req.user?.role === 'teacher') {
      const teacher = await db('teachers')
        .join('users', 'teachers.user_id', 'users.id')
        .where('teachers.user_id', req.user.id)
        .where('users.tenant_id', tenantId)
        .select('teachers.id')
        .first();
      if (!teacher) {
        return res.json({ data: [], pagination: { page, limit, total: 0, total_pages: 0 } });
      }
      teacherScopeId = teacher.id;
      query = query.where('assignments.teacher_id', teacherScopeId);
    }

    // Student scoping: students only see assignments for the class(es) they are
    // actively enrolled in. Resolve once and apply to data + count queries.
    let studentClassIds: string[] | null = null;
    if (req.user?.role === 'student') {
      const student = await db('students')
        .where('user_id', req.user.id)
        .where('tenant_id', tenantId)
        .select('id')
        .first();
      if (!student) {
        return res.json({ data: [], pagination: { page, limit, total: 0, total_pages: 0 } });
      }
      const enrolled = await db('enrollments')
        .where('student_id', student.id)
        .whereIn('status', ['enrolled', 'active'])
        .distinct('class_id');
      studentClassIds = enrolled.map((r: any) => r.class_id);
      if (studentClassIds.length === 0) {
        return res.json({ data: [], pagination: { page, limit, total: 0, total_pages: 0 } });
      }
      query = query.whereIn('assignments.class_id', studentClassIds);
    }

    // Parent/guardian scoping: parents only see assignments for the class(es)
    // their children are enrolled in. Reuses studentClassIds so the count query
    // filter below applies automatically.
    if (req.user?.role === 'parent' || req.user?.role === 'guardian') {
      const guardianRows = await db('guardians as g')
        .join('students as s', 'g.student_id', 's.id')
        .where('g.user_id', req.user.id)
        .where('s.tenant_id', tenantId)
        .distinct('g.student_id');
      const childStudentIds = guardianRows.map((r: any) => r.student_id).filter(Boolean);
      if (childStudentIds.length === 0) {
        return res.json({ data: [], pagination: { page, limit, total: 0, total_pages: 0 } });
      }
      const enrolled = await db('enrollments')
        .whereIn('student_id', childStudentIds)
        .whereIn('status', ['enrolled', 'active'])
        .distinct('class_id');
      studentClassIds = enrolled.map((r: any) => r.class_id).filter(Boolean);
      if (studentClassIds.length === 0) {
        return res.json({ data: [], pagination: { page, limit, total: 0, total_pages: 0 } });
      }
      query = query.whereIn('assignments.class_id', studentClassIds);
    }

    if (class_id) query = query.where('assignments.class_id', class_id as string);
    if (subject_id) query = query.where('assignments.subject_id', subject_id as string);
    if (teacher_id) query = query.where('assignments.teacher_id', teacher_id as string);
    if (status) query = query.where('assignments.status', status as string);
    if (type) query = query.where('assignments.type', type as string);
    if (search) {
      const term = `%${(search as string).trim()}%`;
      query = query.where(function () {
        this.where('assignments.title', 'ilike', term)
          .orWhere('subjects.name', 'ilike', term);
      });
    }

    // Count query — simpler version without submission subquery
    let countQuery = db('assignments')
      .join('classes', 'assignments.class_id', 'classes.id')
      .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
      .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
      .leftJoin('subjects', 'assignments.subject_id', 'subjects.id')
      .where(function () {
        this.where('academic_sessions.tenant_id', tenantId)
          .orWhere(function () {
            this.whereNull('classes.academic_session_id')
              .where('class_creator.tenant_id', tenantId);
          });
      })
      .count('assignments.id as count');

    if (teacherScopeId) countQuery = countQuery.where('assignments.teacher_id', teacherScopeId);
    if (studentClassIds) countQuery = countQuery.whereIn('assignments.class_id', studentClassIds);
    if (class_id) countQuery = countQuery.where('assignments.class_id', class_id as string);
    if (subject_id) countQuery = countQuery.where('assignments.subject_id', subject_id as string);
    if (teacher_id) countQuery = countQuery.where('assignments.teacher_id', teacher_id as string);
    if (status) countQuery = countQuery.where('assignments.status', status as string);
    if (type) countQuery = countQuery.where('assignments.type', type as string);
    if (search) {
      const term = `%${(search as string).trim()}%`;
      countQuery = countQuery.where(function () {
        this.where('assignments.title', 'ilike', term)
          .orWhere('subjects.name', 'ilike', term);
      });
    }

    const totalResult = await countQuery.first();
    const total = Number(totalResult?.count ?? 0);
    const assignments = await query.limit(limit).offset(offset).orderBy('assignments.due_date', 'desc');

    res.json({
      data: assignments,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/assignments/:id
 */
router.get('/:assignmentId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assignmentId } = req.params;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const assignment = await db('assignments')
      .join('classes', 'assignments.class_id', 'classes.id')
      .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
      .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
      .where('assignments.id', assignmentId)
      .where(function () {
        this.where('academic_sessions.tenant_id', tenantId)
          .orWhere(function () {
            this.whereNull('classes.academic_session_id')
              .where('class_creator.tenant_id', tenantId);
          });
      })
      .select('assignments.*')
      .first();

    if (!assignment) throw new AppError('Assignment not found', 404, 'NOT_FOUND');
    if (!(await teacherOwnsAssignment(req, assignment.teacher_id))) {
      throw new AppError('You can only view your own assignments', 403, 'FORBIDDEN');
    }
    res.json(assignment);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/assignments/:id
 */
router.put('/:assignmentId', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.TEACHER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assignmentId } = req.params;
    const { title, description, type, due_date, max_marks, instructions, resources, status } = req.body;
    const updatedBy = req.auth?.userId ?? null;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const assignment = await db('assignments')
      .join('classes', 'assignments.class_id', 'classes.id')
      .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
      .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
      .where('assignments.id', assignmentId)
      .where(function () {
        this.where('academic_sessions.tenant_id', tenantId)
          .orWhere(function () {
            this.whereNull('classes.academic_session_id')
              .where('class_creator.tenant_id', tenantId);
          });
      })
      .select('assignments.*')
      .first();
    if (!assignment) throw new AppError('Assignment not found', 404, 'NOT_FOUND');
    if (!(await teacherOwnsAssignment(req, assignment.teacher_id))) {
      throw new AppError('You can only edit your own assignments', 403, 'FORBIDDEN');
    }

    // A new due_date must not precede the (unchanged) assigned_date.
    if (due_date && assignment.assigned_date && String(due_date) < String(assignment.assigned_date)) {
      throw new AppError('Due date cannot be before the assigned date', 400, 'VALIDATION_ERROR');
    }

    const updateData: any = {};
    if (title) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description || null;
    if (type) updateData.type = type;
    if (due_date) updateData.due_date = due_date;
    if (max_marks !== undefined) updateData.max_marks = max_marks;
    if (instructions !== undefined) updateData.instructions = instructions || null;
    if (resources !== undefined) updateData.resources = resources ? JSON.stringify(resources) : null;
    if (status) updateData.status = status;
    updateData.updated_by = updatedBy;
    updateData.updated_at = new Date();

    await db('assignments').where('id', assignmentId).update(updateData);
    const updated = await db('assignments').where('id', assignmentId).first();

    res.json({ message: 'Assignment updated successfully', data: updated });
    logger.info(`Assignment updated: ${assignmentId}`);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/assignments/:id
 */
router.delete('/:assignmentId', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.TEACHER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assignmentId } = req.params;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const assignment = await db('assignments')
      .join('classes', 'assignments.class_id', 'classes.id')
      .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
      .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
      .where('assignments.id', assignmentId)
      .where(function () {
        this.where('academic_sessions.tenant_id', tenantId)
          .orWhere(function () {
            this.whereNull('classes.academic_session_id')
              .where('class_creator.tenant_id', tenantId);
          });
      })
      .select('assignments.*')
      .first();
    if (!assignment) throw new AppError('Assignment not found', 404, 'NOT_FOUND');
    if (!(await teacherOwnsAssignment(req, assignment.teacher_id))) {
      throw new AppError('You can only delete your own assignments', 403, 'FORBIDDEN');
    }

    // Check for submissions
    const submissions = await db('assignment_submissions').where('assignment_id', assignmentId).count('* as count').first();
    if (Number(submissions?.count ?? 0) > 0) {
      // Soft close instead of delete
      await db('assignments').where('id', assignmentId).update({ status: 'closed', updated_at: new Date() });
      res.json({ message: 'Assignment closed (has submissions)' });
    } else {
      await db('assignments').where('id', assignmentId).del();
      res.json({ message: 'Assignment deleted successfully' });
    }
    logger.info(`Assignment deleted/closed: ${assignmentId}`);
  } catch (error) {
    next(error);
  }
});

export default router;
