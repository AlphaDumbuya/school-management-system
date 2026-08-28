import { db } from '../utils/database.js';
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '../middleware/authMiddleware.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { UserRole } from '../types/auth.js';

const router = Router();
router.use(authenticate);
router.use(attachUserContext);

// ── Grace School of Science Standard Sierra Leone Grading Scale ────────────────

function getGrade(totalScore: number): { letter: string; remark: string } {
  if (totalScore >= 85) return { letter: 'A', remark: 'Excellent' };
  if (totalScore >= 75) return { letter: 'B', remark: 'Very Good' };
  if (totalScore >= 60) return { letter: 'C', remark: 'Good' };
  if (totalScore >= 50) return { letter: 'D', remark: 'Satisfying' };
  return { letter: 'F', remark: 'Unsatisfying' };
}

/**
 * POST /api/v1/results
 * Enter a single grade
 */
router.post('/', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.TEACHER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { student_id, subject_id, class_id, examination_id, academic_year, term, ca_score, exam_score } = req.body;
    const enteredBy = req.auth?.userId ?? null;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    if (!student_id || !subject_id || !class_id || !academic_year || !term) {
      throw new AppError('Missing required fields', 400, 'VALIDATION_ERROR');
    }
    const student = await db('students').where({ id: student_id, tenant_id: tenantId }).first();
    if (!student) {
      throw new AppError('Student not found or access denied', 404, 'NOT_FOUND');
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

    if (ca_score < 0 || ca_score > 30) throw new AppError('CA score must be 0-30', 400, 'VALIDATION_ERROR');
    if (exam_score < 0 || exam_score > 70) throw new AppError('Exam score must be 0-70', 400, 'VALIDATION_ERROR');

    const totalScore = Number(ca_score) + Number(exam_score);
    const { letter, remark } = getGrade(totalScore);

    const [inserted] = await db('results').insert({
      student_id,
      subject_id,
      class_id,
      examination_id: examination_id || null,
      academic_year,
      term,
      ca_score,
      exam_score,
      total_score: totalScore,
      grade_letter: letter,
      remark,
      entered_by: enteredBy,
      created_at: new Date(),
      updated_at: new Date(),
    }).returning('*');

    res.status(201).json({ message: 'Grade entered successfully', data: inserted });
    logger.info(`Grade entered for student ${student_id} in subject ${subject_id}`);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/results/bulk
 * Bulk enter grades for a class + subject
 */
router.post('/bulk', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.TEACHER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { class_id, subject_id, academic_year, term, examination_id, grades } = req.body;
    const enteredBy = req.auth?.userId ?? null;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    if (!class_id || !subject_id || !academic_year || !term || !grades || !Array.isArray(grades)) {
      throw new AppError('Missing required fields: class_id, subject_id, academic_year, term, grades[]', 400, 'VALIDATION_ERROR');
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

    const records = grades.map((g: { student_id: string; ca_score: number; exam_score: number }) => {
      const total = Number(g.ca_score) + Number(g.exam_score);
      const { letter, remark } = getGrade(total);
      return {
        student_id: g.student_id,
        subject_id,
        class_id,
        examination_id: examination_id || null,
        academic_year,
        term,
        ca_score: g.ca_score,
        exam_score: g.exam_score,
        total_score: total,
        grade_letter: letter,
        remark,
        entered_by: enteredBy,
        created_at: new Date(),
        updated_at: new Date(),
      };
    });

    // Upsert — update if exists, insert if not
    for (const record of records) {
      // Verify student belongs to this tenant
      const studentCheck = await db('students').where({ id: record.student_id, tenant_id: tenantId }).first();
      if (!studentCheck) continue;

      const existing = await db('results')
        .where({ student_id: record.student_id, subject_id: record.subject_id, class_id: record.class_id, term: record.term, academic_year: record.academic_year })
        .first();

      if (existing) {
        await db('results').where('id', existing.id).update({
          ca_score: record.ca_score,
          exam_score: record.exam_score,
          total_score: record.total_score,
          grade_letter: record.grade_letter,
          remark: record.remark,
          entered_by: record.entered_by,
          updated_at: new Date(),
        });
      } else {
        await db('results').insert(record);
      }
    }

    res.json({ message: `${records.length} grades entered successfully`, count: records.length });
    logger.info(`Bulk grades entered: ${records.length} records for class ${class_id}`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/results
 * List results with filters
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = (page - 1) * limit;
    const { class_id, subject_id, student_id, term, academic_year, search } = req.query;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    let query = db('results')
      .join('students', 'results.student_id', 'students.id')
      .leftJoin('users', 'students.user_id', 'users.id')
      .leftJoin('subjects', 'results.subject_id', 'subjects.id')
      .leftJoin('classes', 'results.class_id', 'classes.id')
      .where('students.tenant_id', tenantId)
      .select(
        'results.*',
        db.raw("COALESCE(users.first_name || ' ' || users.last_name, 'Unknown') as student_name"),
        'students.student_id as student_roll_number',
        'subjects.name as subject_name',
        'subjects.code as subject_code',
        'classes.name as class_name'
      );

    if (class_id) query = query.where('results.class_id', class_id as string);
    if (subject_id) query = query.where('results.subject_id', subject_id as string);
    if (student_id) query = query.where('results.student_id', student_id as string);
    if (term) query = query.where('results.term', term as string);
    if (academic_year) query = query.where('results.academic_year', academic_year as string);
    if (search) {
      const searchTerm = `%${(search as string).trim()}%`;
      query = query.where(function () {
        this.where('users.first_name', 'ilike', searchTerm)
          .orWhere('users.last_name', 'ilike', searchTerm)
          .orWhere('subjects.name', 'ilike', searchTerm);
      });
    }

    // Count query
    let countQuery = db('results')
      .join('students', 'results.student_id', 'students.id')
      .where('students.tenant_id', tenantId)
      .count('results.id as count');
    if (class_id) countQuery = countQuery.where('results.class_id', class_id as string);
    if (subject_id) countQuery = countQuery.where('results.subject_id', subject_id as string);
    if (student_id) countQuery = countQuery.where('results.student_id', student_id as string);
    if (term) countQuery = countQuery.where('results.term', term as string);
    if (academic_year) countQuery = countQuery.where('results.academic_year', academic_year as string);

    const totalResult = await countQuery.first();
    const total = Number(totalResult?.count ?? 0);
    const results = await query.limit(limit).offset(offset).orderBy('results.total_score', 'desc');

    res.json({
      data: results,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/results/summary
 * Get summary stats for a class + subject + term
 */
router.get('/summary', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { class_id, subject_id, term, academic_year } = req.query;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    if (!class_id || !subject_id || !term || !academic_year) {
      throw new AppError('Required: class_id, subject_id, term, academic_year', 400, 'VALIDATION_ERROR');
    }

    const stats = await db('results')
      .join('students', 'results.student_id', 'students.id')
      .where('students.tenant_id', tenantId)
      .where({ 'results.class_id': class_id as string, 'results.subject_id': subject_id as string, 'results.term': term as string, 'results.academic_year': academic_year as string })
      .select(
        db.raw('COUNT(*) as total_students'),
        db.raw('MAX(results.total_score) as highest_score'),
        db.raw('MIN(results.total_score) as lowest_score'),
        db.raw('AVG(results.total_score) as average_score'),
        db.raw("SUM(CASE WHEN results.total_score >= 50 THEN 1 ELSE 0 END) as pass_count"),
        db.raw("SUM(CASE WHEN results.total_score < 50 THEN 1 ELSE 0 END) as fail_count")
      )
      .first();

    res.json({
      class_id,
      subject_id,
      term,
      academic_year,
      total_students: Number(stats?.total_students ?? 0),
      highest_score: Number(stats?.highest_score ?? 0),
      lowest_score: Number(stats?.lowest_score ?? 0),
      average_score: Math.round(Number(stats?.average_score ?? 0) * 10) / 10,
      pass_count: Number(stats?.pass_count ?? 0),
      fail_count: Number(stats?.fail_count ?? 0),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/results/:id
 */
router.put('/:resultId', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.TEACHER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { resultId } = req.params;
    const { ca_score, exam_score } = req.body;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const result = await db('results')
      .join('students', 'results.student_id', 'students.id')
      .where('results.id', resultId)
      .where('students.tenant_id', tenantId)
      .select('results.*')
      .first();
    if (!result) throw new AppError('Result not found', 404, 'NOT_FOUND');

    const newCa = ca_score !== undefined ? ca_score : result.ca_score;
    const newExam = exam_score !== undefined ? exam_score : result.exam_score;
    const totalScore = Number(newCa) + Number(newExam);
    const { letter, remark } = getGrade(totalScore);

    await db('results').where('id', resultId).update({
      ca_score: newCa,
      exam_score: newExam,
      total_score: totalScore,
      grade_letter: letter,
      remark,
      updated_at: new Date(),
    });

    const updated = await db('results').where('id', resultId).first();
    res.json({ message: 'Grade updated', data: updated });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/results/:id
 */
router.delete('/:resultId', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { resultId } = req.params;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const result = await db('results')
      .join('students', 'results.student_id', 'students.id')
      .where('results.id', resultId)
      .where('students.tenant_id', tenantId)
      .select('results.*')
      .first();
    if (!result) throw new AppError('Result not found', 404, 'NOT_FOUND');

    await db('results').where('id', resultId).del();
    res.json({ message: 'Result deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
