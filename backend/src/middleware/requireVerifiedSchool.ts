/**
 * requireVerifiedSchool — gate high-impact tenant features until the school's
 * account owner has verified the school.
 *
 * Blocks with 403 SCHOOL_VERIFICATION_REQUIRED when the tenant is not verified.
 * The tenant's verification state lives on the owner (principal) user row; we
 * resolve it by tenant so any tenant user hitting a gated route is checked
 * against the tenant's verification status.
 *
 * Backend is the source of truth (the UI also hides these, but this enforces it).
 */
import { Request, Response, NextFunction } from 'express';
import { db } from '@utils/database';
import { AppError } from '@middleware/errorHandler';

export const requireVerifiedSchool = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).auth?.userId;
    if (!userId) throw new AppError('Authentication required', 401, 'NOT_AUTHENTICATED');

    const user = await db('users').select('tenant_id').where({ id: userId }).first();
    if (!user?.tenant_id) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    // The tenant owner (principal) carries the verification_status for the tenant.
    const owner = await db('users')
      .where({ tenant_id: user.tenant_id, role: 'principal' })
      .orderBy('created_at', 'asc')
      .first();

    if (owner?.verification_status === 'verified') {
      return next();
    }

    throw new AppError(
      'This action requires school verification. Please verify your school to continue.',
      403,
      'SCHOOL_VERIFICATION_REQUIRED'
    );
  } catch (error) {
    next(error);
  }
};

export default requireVerifiedSchool;
