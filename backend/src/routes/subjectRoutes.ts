import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '@middleware/authMiddleware';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import knex from 'knex';
import knexConfig from '../../knexfile';

const router = Router();
const db = knex(knexConfig.development);

/**
 * POST /api/v1/subjects
 * Create a new subject
 */
router.post('/', authenticate, authorize('admin', 'principal'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, name, description, credit_points, max_marks, pass_marks } = req.body;
    const createdBy = (req as any).user.id;

    if (!code || !name || max_marks === undefined || pass_marks === undefined) {
      throw new AppError('Missing required fields: code, name, max_marks, pass_marks', 400, 'VALIDATION_ERROR');
    }

    if (max_marks <= pass_marks) {
      throw new AppError('Max marks must be greater than pass marks', 400, 'VALIDATION_ERROR');
    }

    // Check code uniqueness
    const existing = await db('subjects').where('code', code).first();
    if (existing) {
      throw new AppError('Subject code already exists', 409, 'CONFLICT');
    }

    const [id] = await db('subjects').insert({
      code: code.toUpperCase(),
      name: name.trim(),
      description: description || null,
      credit_points: credit_points || 0,
      max_marks,
      pass_marks,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
      created_by: createdBy,
    });

    const subject = await db('subjects').where('id', id).first();

    res.status(201).json({
      message: 'Subject created successfully',
      subject,
    });

    logger.info(`Subject created: ${code} - ${name}`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/subjects
 * List all subjects
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const status = req.query.status as string;

    let query = db('subjects').select('id', 'code', 'name', 'credit_points', 'max_marks', 'pass_marks', 'status', 'created_at');

    if (status) {
      query = query.where('status', status);
    }

    const total = await query.clone().count('* as count').first();
    const subjects = await query.limit(limit).offset(offset).orderBy('code', 'asc');

    res.json({
      data: subjects,
      pagination: {
        page,
        limit,
        total: total.count,
        total_pages: Math.ceil(total.count / limit),
      },
    });
  } catch (error) {
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

    const subject = await db('subjects').where('id', subjectId).first();
    if (!subject) {
      throw new AppError('Subject not found', 404, 'NOT_FOUND');
    }

    res.json(subject);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/subjects/:subjectId
 * Update subject
 */
router.put('/:subjectId', authenticate, authorize('admin', 'principal'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subjectId } = req.params;
    const { code, name, description, credit_points, max_marks, pass_marks, status } = req.body;
    const updatedBy = (req as any).user.id;

    const subject = await db('subjects').where('id', subjectId).first();
    if (!subject) {
      throw new AppError('Subject not found', 404, 'NOT_FOUND');
    }

    const updateData: any = {};
    if (code) {
      const existing = await db('subjects').where('code', code).whereNot('id', subjectId).first();
      if (existing) {
        throw new AppError('Subject code already exists', 409, 'CONFLICT');
      }
      updateData.code = code.toUpperCase();
    }
    if (name) updateData.name = name.trim();
    if (description) updateData.description = description;
    if (credit_points !== undefined) updateData.credit_points = credit_points;
    if (max_marks !== undefined && pass_marks !== undefined) {
      if (max_marks <= pass_marks) {
        throw new AppError('Max marks must be greater than pass marks', 400, 'VALIDATION_ERROR');
      }
      updateData.max_marks = max_marks;
      updateData.pass_marks = pass_marks;
    }
    if (status) updateData.status = status;

    updateData.updated_at = new Date();
    updateData.updated_by = updatedBy;

    await db('subjects').where('id', subjectId).update(updateData);

    const updated = await db('subjects').where('id', subjectId).first();

    res.json({
      message: 'Subject updated successfully',
      subject: updated,
    });

    logger.info(`Subject updated: ${subjectId}`);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/subjects/:subjectId
 * Delete subject (soft delete)
 */
router.delete('/:subjectId', authenticate, authorize('admin', 'principal'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subjectId } = req.params;

    const subject = await db('subjects').where('id', subjectId).first();
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

export default router;
