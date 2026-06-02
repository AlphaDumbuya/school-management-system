import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, requirePermission } from '@middleware/authMiddleware';
import { PasswordService } from '@services/passwordService';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import knex from 'knex';
import knexConfig from '../../../knexfile';

const router = Router();
const db = knex(knexConfig.development);

/**
 * POST /api/v1/users
 * Create a new user (admin only)
 */
router.post('/', authenticate, authorize('admin', 'principal'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, first_name, last_name, role, status } = req.body;
    const createdBy = (req as any).user.id;

    // Validate input
    if (!email || !first_name || !last_name || !role) {
      throw new AppError('Missing required fields', 400, 'VALIDATION_ERROR');
    }

    // Check if user already exists
    const existingUser = await db('users').where('email', email).first();
    if (existingUser) {
      throw new AppError('Email already registered', 409, 'CONFLICT');
    }

    // Generate temporary password
    const tempPassword = PasswordService.generateTemporaryPassword();
    const passwordHash = await PasswordService.hashPassword(tempPassword);

    // Create user
    const [userId] = await db('users').insert({
      email,
      first_name,
      last_name,
      password_hash: passwordHash,
      role,
      status: status || 'active',
      created_by: createdBy,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Fetch created user
    const user = await db('users')
      .select('id', 'email', 'first_name', 'last_name', 'role', 'status', 'created_at')
      .where('id', userId)
      .first();

    res.status(201).json({
      message: 'User created successfully',
      user,
      temporary_password: tempPassword,
      note: 'User should change password on first login',
    });

    logger.info(`User created: ${email} by ${(req as any).user.email}`);

    // TODO: Send email with temporary password
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/users
 * List all users with pagination (admin only)
 */
router.get('/', authenticate, authorize('admin', 'principal'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const offset = (page - 1) * limit;
    const role = req.query.role as string;
    const status = req.query.status as string;

    let query = db('users').select('id', 'email', 'first_name', 'last_name', 'role', 'status', 'last_login', 'created_at');

    if (role) {
      query = query.where('role', role);
    }
    if (status) {
      query = query.where('status', status);
    }

    const total = await db('users').count('* as count').first();
    const users = await query.limit(limit).offset(offset);

    res.json({
      data: users,
      pagination: {
        page,
        limit,
        total: total.count,
        total_pages: Math.ceil(total.count / limit),
      },
    });

    logger.info(`Listed users: page ${page}, limit ${limit}`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/users/:id
 * Get user by ID
 */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.id;
    const currentUser = (req as any).user;

    // Users can only view their own profile unless they're admin
    if (userId !== currentUser.id && !['admin', 'principal'].includes(currentUser.role)) {
      throw new AppError('Unauthorized', 403, 'AUTHORIZATION_ERROR');
    }

    const user = await db('users')
      .select('id', 'email', 'first_name', 'last_name', 'role', 'status', 'last_login', 'created_at', 'updated_at')
      .where('id', userId)
      .first();

    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/users/:id
 * Update user profile
 */
router.put('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.id;
    const currentUser = (req as any).user;
    const { first_name, last_name, status } = req.body;

    // Users can only update their own profile unless they're admin
    if (userId !== currentUser.id && !['admin', 'principal'].includes(currentUser.role)) {
      throw new AppError('Unauthorized', 403, 'AUTHORIZATION_ERROR');
    }

    // Admin/principal can change status, but users cannot
    const updateData: any = {};
    if (first_name) updateData.first_name = first_name;
    if (last_name) updateData.last_name = last_name;

    if (status && ['admin', 'principal'].includes(currentUser.role)) {
      updateData.status = status;
    }

    updateData.updated_at = new Date();
    if (currentUser.id !== userId) {
      updateData.updated_by = currentUser.id;
    }

    await db('users').where('id', userId).update(updateData);

    const user = await db('users')
      .select('id', 'email', 'first_name', 'last_name', 'role', 'status', 'created_at', 'updated_at')
      .where('id', userId)
      .first();

    res.json({
      message: 'User updated successfully',
      user,
    });

    logger.info(`User updated: ${user.email}`);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/users/:id
 * Soft delete user (deactivate)
 */
router.delete('/:id', authenticate, authorize('admin', 'principal'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.id;
    const currentUser = (req as any).user;

    // Prevent self-deletion
    if (userId === currentUser.id) {
      throw new AppError('Cannot delete your own account', 400, 'VALIDATION_ERROR');
    }

    const user = await db('users').where('id', userId).first();
    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    // Soft delete
    await db('users').where('id', userId).update({
      status: 'inactive',
      updated_at: new Date(),
      updated_by: currentUser.id,
    });

    res.json({
      message: 'User deactivated successfully',
    });

    logger.info(`User deactivated: ${user.email} by ${currentUser.email}`);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/users/:id/role
 * Update user role (admin only)
 */
router.put('/:id/role', authenticate, authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.id;
    const { role } = req.body;
    const currentUser = (req as any).user;

    const validRoles = ['admin', 'principal', 'teacher', 'student', 'parent', 'accountant', 'admissions_officer'];
    if (!role || !validRoles.includes(role)) {
      throw new AppError(`Invalid role. Must be one of: ${validRoles.join(', ')}`, 400, 'VALIDATION_ERROR');
    }

    const user = await db('users').where('id', userId).first();
    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    await db('users').where('id', userId).update({
      role,
      updated_at: new Date(),
      updated_by: currentUser.id,
    });

    res.json({
      message: 'User role updated successfully',
      user: { ...user, role },
    });

    logger.info(`User role updated: ${user.email} -> ${role}`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/users/role/:role
 * Get users by role (admin only)
 */
router.get('/role/:role', authenticate, authorize('admin', 'principal'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.params.role;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const offset = (page - 1) * limit;

    const validRoles = ['admin', 'principal', 'teacher', 'student', 'parent', 'accountant', 'admissions_officer'];
    if (!validRoles.includes(role)) {
      throw new AppError(`Invalid role. Must be one of: ${validRoles.join(', ')}`, 400, 'VALIDATION_ERROR');
    }

    const total = await db('users').where('role', role).count('* as count').first();
    const users = await db('users')
      .select('id', 'email', 'first_name', 'last_name', 'role', 'status', 'created_at')
      .where('role', role)
      .limit(limit)
      .offset(offset);

    res.json({
      data: users,
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

export default router;
