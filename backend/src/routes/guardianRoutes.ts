import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '@middleware/authMiddleware';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import knex from 'knex';
import knexConfig from '../../knexfile';

const router = Router();
router.use(authenticate);
router.use(attachUserContext);
const env = (process.env.NODE_ENV || "development") as keyof typeof knexConfig;
const db = knex(knexConfig[env] || knexConfig.development);

/**
 * POST /api/v1/students/:studentId/guardians
 * Add a guardian to a student
 */
router.post('/:studentId/guardians', authenticate, authorize('admin', 'principal', 'teacher'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;
    const { first_name, last_name, relationship, email, phone_number, occupation, address_line_1, address_line_2, city, state, postal_code, country, is_primary_guardian } = req.body;
    const createdBy = (req as any).user.id;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    // Validate student exists within this tenant
    const student = await db('students')
      .where('tenant_id', tenantId)
      .andWhere(function() {
        this.where('id', studentId).orWhere('student_id', studentId);
      })
      .first();
    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

    // Validate required fields
    if (!first_name || !last_name || !relationship || !email || !phone_number) {
      throw new AppError('Missing required fields', 400, 'VALIDATION_ERROR');
    }

    // Create guardian
    const [id] = await db('guardians').insert({
      student_id: student.id,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      relationship,
      email: email.toLowerCase(),
      phone_number,
      occupation: occupation || null,
      address_line_1: address_line_1 || null,
      address_line_2: address_line_2 || null,
      city: city || null,
      state: state || null,
      postal_code: postal_code || null,
      country: country || null,
      is_primary_guardian: is_primary_guardian || false,
      created_at: new Date(),
      updated_at: new Date(),
      created_by: createdBy,
    }).returning('id');

    const guardian = await db('guardians')
      .select('id', 'student_id', 'first_name', 'last_name', 'relationship', 'email', 'phone_number', 'is_primary_guardian', 'created_at')
      .where('id', id)
      .first();

    res.status(201).json({
      message: 'Guardian added successfully',
      guardian,
    });

    logger.info(`Guardian added for student ${student.student_id}`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/students/:studentId/guardians
 * List guardians for a student
 */
router.get('/:studentId/guardians', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const student = await db('students')
      .where('tenant_id', tenantId)
      .andWhere(function() {
        this.where('id', studentId).orWhere('student_id', studentId);
      })
      .first();
    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

    const guardians = await db('guardians')
      .select('guardians.id', 'guardians.first_name', 'guardians.last_name', 'guardians.relationship', 'guardians.email', 'guardians.phone_number', 'guardians.is_primary_guardian', 'guardians.created_at')
      .where('guardians.student_id', student.id)
      .orderBy('guardians.is_primary_guardian', 'desc')
      .orderBy('guardians.created_at', 'desc');

    res.json({
      student_id: student.student_id,
      guardians,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/guardians/:guardianId
 * Update guardian information
 */
router.put('/:guardianId', authenticate, authorize('admin', 'principal'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { guardianId } = req.params;
    const { first_name, last_name, email, phone_number, occupation, address_line_1, address_line_2, city, state, postal_code, country } = req.body;
    const updatedBy = (req as any).user.id;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const guardian = await db('guardians')
      .join('students', 'guardians.student_id', 'students.id')
      .where('guardians.id', guardianId)
      .where('students.tenant_id', tenantId)
      .select('guardians.*')
      .first();
    if (!guardian) {
      throw new AppError('Guardian not found', 404, 'NOT_FOUND');
    }

    const updateData: any = {};
    if (first_name) updateData.first_name = first_name.trim();
    if (last_name) updateData.last_name = last_name.trim();
    if (email) updateData.email = email.toLowerCase();
    if (phone_number) updateData.phone_number = phone_number;
    if (occupation) updateData.occupation = occupation;
    if (address_line_1) updateData.address_line_1 = address_line_1;
    if (address_line_2) updateData.address_line_2 = address_line_2;
    if (city) updateData.city = city;
    if (state) updateData.state = state;
    if (postal_code) updateData.postal_code = postal_code;
    if (country) updateData.country = country;

    updateData.updated_at = new Date();
    updateData.updated_by = updatedBy;

    await db('guardians').where('id', guardianId).update(updateData);

    const updated = await db('guardians').where('id', guardianId).first();

    res.json({
      message: 'Guardian updated successfully',
      guardian: updated,
    });

    logger.info(`Guardian updated: ${guardianId}`);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/guardians/:guardianId
 * Remove a guardian
 */
router.delete('/:guardianId', authenticate, authorize('admin', 'principal'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { guardianId } = req.params;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const guardian = await db('guardians')
      .join('students', 'guardians.student_id', 'students.id')
      .where('guardians.id', guardianId)
      .where('students.tenant_id', tenantId)
      .select('guardians.*')
      .first();
    if (!guardian) {
      throw new AppError('Guardian not found', 404, 'NOT_FOUND');
    }

    await db('guardians').where('id', guardianId).delete();

    res.json({
      message: 'Guardian removed successfully',
    });

    logger.info(`Guardian removed: ${guardianId}`);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/guardians/:guardianId/set-primary
 * Set guardian as primary for student
 */
router.post('/:guardianId/set-primary', authenticate, authorize('admin', 'principal'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { guardianId } = req.params;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const guardian = await db('guardians')
      .join('students', 'guardians.student_id', 'students.id')
      .where('guardians.id', guardianId)
      .where('students.tenant_id', tenantId)
      .select('guardians.*')
      .first();
    if (!guardian) {
      throw new AppError('Guardian not found', 404, 'NOT_FOUND');
    }

    // Set all guardians for this student to non-primary
    await db('guardians').where('student_id', guardian.student_id).update({ is_primary_guardian: false });

    // Set this guardian as primary
    await db('guardians').where('id', guardianId).update({ is_primary_guardian: true });

    res.json({
      message: 'Guardian set as primary successfully',
    });

    logger.info(`Guardian set as primary: ${guardianId}`);
  } catch (error) {
    next(error);
  }
});

export default router;
