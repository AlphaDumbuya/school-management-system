import { db } from '../utils/database.js';
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '@middleware/authMiddleware';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import { UserRole } from '../types/auth';

const router = Router();
router.use(authenticate);
router.use(attachUserContext);

const mapSubject = (subject: any) => {
  if (!subject) return subject;
  const mapped = { ...subject, credit_points: subject.credits ?? 0 };
  delete mapped.credits;
  return mapped;
};

/**
 * Constrain a subjects query to one tenant. Prefers the real `subjects.tenant_id`
 * column (migration 151) and keeps a legacy fallback (created_by -> users) for
 * rows created before tenant_id was backfilled — so no subject silently
 * disappears during rollout. Uses a LEFT join so a NULL created_by never drops
 * a row that already has tenant_id set.
 */
function scopeSubjectsToTenant(query: any, tenantId: string) {
  return query
    .leftJoin('users', 'subjects.created_by', 'users.id')
    .where(function (this: any) {
      this.where('subjects.tenant_id', tenantId).orWhere(function (this: any) {
        this.whereNull('subjects.tenant_id').where('users.tenant_id', tenantId);
      });
    });
}

/**
 * POST /api/v1/subjects
 * Create a new subject
 */
router.post('/', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, name, description, credit_points, max_marks, pass_marks, category, level, department, is_elective } = req.body;
    const createdBy = req.auth?.userId ?? null;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    if (!code || !name) {
      throw new AppError('Missing required fields: code, name', 400, 'VALIDATION_ERROR');
    }

    if (max_marks !== undefined && pass_marks !== undefined && max_marks <= pass_marks) {
      throw new AppError('Max marks must be greater than pass marks', 400, 'VALIDATION_ERROR');
    }

    // Check code uniqueness within this tenant (scope by the real tenant_id,
    // with a legacy fallback for rows created before tenant_id existed).
    const existing = await db('subjects')
      .leftJoin('users', 'subjects.created_by', 'users.id')
      .where('subjects.code', code.toUpperCase())
      .where(function (this: any) {
        this.where('subjects.tenant_id', tenantId).orWhere(function (this: any) {
          this.whereNull('subjects.tenant_id').where('users.tenant_id', tenantId);
        });
      })
      .first();
    if (existing) {
      throw new AppError('Subject code already exists', 409, 'CONFLICT');
    }

    const [inserted] = await db('subjects').insert({
      tenant_id: tenantId,
      code: code.toUpperCase(),
      name: name.trim(),
      description: description || null,
      credits: credit_points || 0,
      max_marks: max_marks || 100,
      pass_marks: pass_marks || 40,
      category: category || null,
      level: level || 'all',
      department: department || null,
      is_elective: is_elective || false,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
      created_by: createdBy,
    }).returning('*');

    res.status(201).json({
      message: 'Subject created successfully',
      subject: mapSubject(inserted),
    });

    logger.info(`Subject created: ${code} - ${name}`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/subjects
 * List all subjects with search, category, level, and status filters
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const { search, status, category, level } = req.query;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    let query = scopeSubjectsToTenant(db('subjects'), tenantId).select('subjects.*');

    if (status) {
      query = query.where('subjects.status', status as string);
    }

    if (category) {
      query = query.where('subjects.category', category as string);
    }

    if (level) {
      query = query.where('subjects.level', level as string);
    }

    if (search) {
      const term = `%${(search as string).trim()}%`;
      query = query.where(function () {
        this.where('subjects.name', 'ilike', term)
          .orWhere('subjects.code', 'ilike', term);
      });
    }

    const totalResult = await query.clone().clearSelect().clearOrder().count('subjects.id as count').first();
    const total = Number(totalResult?.count ?? 0);
    const subjects = await query.limit(limit).offset(offset).orderBy('subjects.code', 'asc');

    res.json({
      data: subjects.map(mapSubject),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/subjects/my?child_id=
 * Subjects for the CALLER's own class:
 *   - student → their active class's subjects
 *   - parent  → their ward's class's subjects (pick a child via ?child_id)
 * Resolved robustly from class_subjects ∪ sl_subject_results ∪ timetable for
 * the class (class_subjects is often unpopulated in real tenants). Declared
 * BEFORE /:subjectId so "my" isn't captured as a subjectId param.
 */
router.get('/my', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user?.tenant_id;
    const userId = req.user?.id;
    const role = req.user?.role;
    if (!tenantId) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');

    // Resolve the target student for this viewer.
    let studentId: string | null = null;
    if (role === 'student') {
      const stu = await db('students').where({ tenant_id: tenantId, user_id: userId }).first();
      studentId = stu?.id ?? null;
    } else if (role === 'parent' || role === 'guardian') {
      const childId = req.query.child_id as string | undefined;
      // Verify the requested child (or the parent's first ward) is linked.
      let g = db('guardians as g')
        .join('students as s', 'g.student_id', 's.id')
        .where('g.user_id', userId)
        .where('s.tenant_id', tenantId);
      if (childId) g = g.where('s.id', childId);
      const row = await g.orderBy('g.is_primary_guardian', 'desc').select('s.id').first();
      studentId = row?.id ?? null;
    } else {
      // Staff hitting this endpoint → no self-scope; return empty (they use the
      // full list). Keeps the endpoint student/parent-focused.
      return res.json({ data: [], pagination: { page: 1, limit: 0, total: 0, total_pages: 0 } });
    }

    if (!studentId) {
      return res.json({ data: [], pagination: { page: 1, limit: 0, total: 0, total_pages: 0 } });
    }

    // Active class for the student.
    const enrolment = await db('enrollments')
      .where('student_id', studentId)
      .whereIn('status', ['active', 'enrolled'])
      .orderBy('created_at', 'desc')
      .select('class_id')
      .first();
    const classId = enrolment?.class_id ?? null;
    if (!classId) {
      return res.json({ data: [], pagination: { page: 1, limit: 0, total: 0, total_pages: 0 } });
    }

    // Union of subject ids linked to this class from all reliable sources.
    const subjectIds = new Set<string>();
    const collect = (rows: any[], key: string) => rows.forEach((r) => { if (r[key]) subjectIds.add(r[key]); });

    collect(await db('class_subjects').where('class_id', classId).select('subject_id').catch(() => []), 'subject_id');
    collect(await db('sl_subject_results').where({ tenant_id: tenantId, class_id: classId }).distinct('subject_id').catch(() => []), 'subject_id');
    collect(await db('results').where('class_id', classId).distinct('subject_id').catch(() => []), 'subject_id');
    // Timetable (schedules) subjects for the class.
    collect(await db('schedules').where('class_id', classId).whereNotNull('subject_id').distinct('subject_id').catch(() => []), 'subject_id');

    if (subjectIds.size === 0) {
      return res.json({ data: [], pagination: { page: 1, limit: 0, total: 0, total_pages: 0 } });
    }

    const subjects = await scopeSubjectsToTenant(db('subjects'), tenantId)
      .whereIn('subjects.id', Array.from(subjectIds))
      .where('subjects.status', 'active')
      .select('subjects.*')
      .orderBy('subjects.code', 'asc');

    res.json({
      data: subjects.map(mapSubject),
      pagination: { page: 1, limit: subjects.length, total: subjects.length, total_pages: 1 },
    });
  } catch (error) {
    logger.error('Error getting my subjects:', error);
    next(error);
  }
});

/**
 * GET /api/v1/subjects/:subjectId
 * Get subject details
 */
router.get('/:subjectId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subjectId } = req.params;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const subject = await scopeSubjectsToTenant(db('subjects'), tenantId)
      .where('subjects.id', subjectId)
      .select('subjects.*')
      .first();

    if (!subject) {
      throw new AppError('Subject not found', 404, 'NOT_FOUND');
    }

    res.json(mapSubject(subject));
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/subjects/:subjectId
 * Update subject
 */
router.put('/:subjectId', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subjectId } = req.params;
    const { code, name, description, credit_points, max_marks, pass_marks, status, category, level, department, is_elective } = req.body;
    const updatedBy = req.auth?.userId ?? null;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const subject = await scopeSubjectsToTenant(db('subjects'), tenantId)
      .where('subjects.id', subjectId)
      .select('subjects.*')
      .first();

    if (!subject) {
      throw new AppError('Subject not found', 404, 'NOT_FOUND');
    }

    const updateData: any = {};
    if (code) {
      const existing = await scopeSubjectsToTenant(db('subjects'), tenantId)
        .where('subjects.code', code.toUpperCase())
        .whereNot('subjects.id', subjectId)
        .first();
      if (existing) {
        throw new AppError('Subject code already exists', 409, 'CONFLICT');
      }
      updateData.code = code.toUpperCase();
    }
    // Backfill tenant_id on legacy rows as they're edited.
    if (!subject.tenant_id) updateData.tenant_id = tenantId;
    if (name) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description || null;
    if (credit_points !== undefined) updateData.credits = credit_points;
    if (max_marks !== undefined && pass_marks !== undefined) {
      if (max_marks <= pass_marks) {
        throw new AppError('Max marks must be greater than pass marks', 400, 'VALIDATION_ERROR');
      }
      updateData.max_marks = max_marks;
      updateData.pass_marks = pass_marks;
    }
    if (status) updateData.status = status;
    if (category !== undefined) updateData.category = category || null;
    if (level !== undefined) updateData.level = level || 'all';
    if (department !== undefined) updateData.department = department || null;
    if (is_elective !== undefined) updateData.is_elective = is_elective;

    updateData.updated_at = new Date();
    updateData.updated_by = updatedBy;

    await db('subjects').where('id', subjectId).update(updateData);

    const updated = await db('subjects').where('id', subjectId).first();

    res.json({
      message: 'Subject updated successfully',
      subject: mapSubject(updated),
    });

    logger.info(`Subject updated: ${subjectId}`);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/subjects/:subjectId
 * Deactivate subject (soft delete)
 */
router.delete('/:subjectId', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subjectId } = req.params;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const subject = await scopeSubjectsToTenant(db('subjects'), tenantId)
      .where('subjects.id', subjectId)
      .select('subjects.*')
      .first();

    if (!subject) {
      throw new AppError('Subject not found', 404, 'NOT_FOUND');
    }

    await db('subjects').where('id', subjectId).update({
      status: 'inactive',
      updated_at: new Date(),
    });

    res.json({
      message: 'Subject deactivated successfully',
    });

    logger.info(`Subject deactivated: ${subjectId}`);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/subjects/:subjectId/permanent
 * Permanently delete a subject (only if no dependencies)
 */
router.delete('/:subjectId/permanent', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subjectId } = req.params;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const subject = await scopeSubjectsToTenant(db('subjects'), tenantId)
      .where('subjects.id', subjectId)
      .select('subjects.*')
      .first();

    if (!subject) {
      throw new AppError('Subject not found', 404, 'NOT_FOUND');
    }

    // Check if subject has any grade records linked
    const gradeCount = await db('grades').where('subject_id', subjectId).count('* as count').first();
    if (Number(gradeCount?.count ?? 0) > 0) {
      throw new AppError('Cannot delete a subject with grade records. Use deactivate instead.', 400, 'HAS_GRADES');
    }

    // Permanently remove
    await db('subjects').where('id', subjectId).del();

    res.json({
      message: 'Subject permanently deleted',
    });

    logger.info(`Subject permanently deleted: ${subjectId}`);
  } catch (error) {
    next(error);
  }
});

export default router;
