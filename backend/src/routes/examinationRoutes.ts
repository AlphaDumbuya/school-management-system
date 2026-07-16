import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '@middleware/authMiddleware';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import { UserRole } from '../types/auth';
import knex from 'knex';
import knexConfig from '../../knexfile';

const router = Router();
const env = (process.env.NODE_ENV || "development") as keyof typeof knexConfig;
const db = knex(knexConfig[env] || knexConfig.development);

/**
 * POST /api/v1/examinations
 */
router.post('/', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, type, term, academic_year, class_id, subject_id, start_date, end_date, total_marks, pass_marks, duration_minutes, venue, instructions, status } = req.body;
    const createdBy = req.auth?.userId ?? null;

    if (!title || !type || !term || !academic_year || !start_date) {
      throw new AppError('Missing required fields: title, type, term, academic_year, start_date', 400, 'VALIDATION_ERROR');
    }

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

    let query = db('examinations')
      .select(
        'examinations.*',
        'classes.name as class_name',
        'classes.level as class_level',
        'subjects.name as subject_name',
        'subjects.code as subject_code'
      )
      .leftJoin('classes', 'examinations.class_id', 'classes.id')
      .leftJoin('subjects', 'examinations.subject_id', 'subjects.id');

    if (type) query = query.where('examinations.type', type as string);
    if (term) query = query.where('examinations.term', term as string);
    if (academic_year) query = query.where('examinations.academic_year', academic_year as string);
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
    let countQuery = db('examinations').count('id as count');
    if (type) countQuery = countQuery.where('type', type as string);
    if (term) countQuery = countQuery.where('term', term as string);
    if (academic_year) countQuery = countQuery.where('academic_year', academic_year as string);
    if (class_id) countQuery = countQuery.where('class_id', class_id as string);
    if (status) countQuery = countQuery.where('status', status as string);

    const totalResult = await countQuery.first();
    const total = Number(totalResult?.count ?? 0);
    const examinations = await query.limit(limit).offset(offset).orderBy('examinations.start_date', 'desc');

    res.json({
      data: examinations,
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
    const exam = await db('examinations').where('id', examId).first();
    if (!exam) throw new AppError('Examination not found', 404, 'NOT_FOUND');
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

    const exam = await db('examinations').where('id', examId).first();
    if (!exam) throw new AppError('Examination not found', 404, 'NOT_FOUND');

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
    const exam = await db('examinations').where('id', examId).first();
    if (!exam) throw new AppError('Examination not found', 404, 'NOT_FOUND');

    await db('examinations').where('id', examId).del();
    res.json({ message: 'Examination deleted successfully' });
    logger.info(`Examination deleted: ${examId}`);
  } catch (error) {
    next(error);
  }
});

export default router;
