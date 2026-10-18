/**
 * requireVerifiedSchool — gate high-impact tenant features until the school's
 * account owner has verified the school.
 *
 * Blocks with 403 SCHOOL_VERIFICATION_REQUIRED unless the tenant is 'verified'
 * (approved by WiSkul). 'pending' and 'rejected' schools are blocked too; the
 * message says which state the school is in.
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

    const user = await db('users').select('tenant_id', 'role').where({ id: userId }).first();
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    // Platform super admins are not tenant owners — never gate them.
    if (user.role === 'super_admin') return next();

    if (!user.tenant_id) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    // The tenant owner (principal) carries the verification_status for the tenant.
    const owner = await db('users')
      .where({ tenant_id: user.tenant_id, role: 'principal' })
      .orderBy([{ column: 'is_owner', order: 'desc' }, { column: 'created_at', order: 'asc' }])
      .first();

    if (owner?.verification_status === 'verified') {
      return next();
    }

    // Verification is reviewed by WiSkul: say where the school is in that process.
    // (AppError carries only message/status/code, so the state is in the message.)
    const message =
      owner?.verification_status === 'pending'
        ? 'Your school verification is waiting for review by WiSkul. You can change your plan once it is approved.'
        : owner?.verification_status === 'rejected'
          ? 'Your school verification was not approved. Open Verify school to see why and submit again.'
          : 'Verify your school before changing your plan. WiSkul reviews it, usually within one working day.';

    throw new AppError(message, 403, 'SCHOOL_VERIFICATION_REQUIRED');
  } catch (error) {
    next(error);
  }
};

export default requireVerifiedSchool;
