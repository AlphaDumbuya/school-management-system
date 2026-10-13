/**
 * The school owner (proprietor) tier: owner > principal > other staff.
 *
 * An owner is a `principal` account flagged `users.is_owner`. Everywhere in the
 * app an owner acts as a principal, so none of the existing role checks change.
 * On top of that the owner alone holds a short list of items (subscription and
 * billing, the school's payment settings, backups, school verification, and
 * creating, changing or removing principals and owners).
 *
 * Schools that have not named an owner yet keep working exactly as before: with
 * no owner account, their principals count as owners. The moment an owner
 * exists, only the owner passes the owner-only gates.
 */
import type { Request, Response, NextFunction } from 'express';
import { db } from './database';
import { AppError } from '../middleware/errorHandler';

export interface OwnerCheckUser {
  id?: string;
  role?: string | null;
  tenant_id?: string | null;
  is_owner?: boolean | null;
}

/** Does this school have a named owner account? (false if the column isn't there yet) */
export async function tenantHasOwner(tenantId?: string | null): Promise<boolean> {
  if (!tenantId) return false;
  try {
    const row = await db('users').where({ tenant_id: tenantId, is_owner: true }).first('id');
    return !!row;
  } catch {
    return false;
  }
}

/** Is this user an owner of their school (named owner, or a principal in a school with none yet)? */
export async function isTenantOwner(user: OwnerCheckUser | null | undefined): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  if (user.is_owner === true) return true;
  if (user.role === 'principal') return !(await tenantHasOwner(user.tenant_id));
  return false;
}

/**
 * Route guard for owner-only items. Reads the user from the database (never
 * trusts the token), so it works whether or not attachUserContext ran.
 */
export const requireOwner = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).auth?.userId ?? (req as any).user?.id;
    if (!userId) throw new AppError('Authentication required', 401, 'NOT_AUTHENTICATED');
    const row = await db('users').where({ id: userId }).first('id', 'role', 'tenant_id', 'is_owner');
    if (!row) throw new AppError('Your session has ended. Please sign in again.', 401, 'SESSION_INVALID');
    if (await isTenantOwner(row)) return next();
    throw new AppError(
      'Only the school owner can do this. Please ask the school owner.',
      403,
      'OWNER_ONLY'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Principal and owner accounts belong to the owner. In a school with a named
 * owner, a principal may not create, promote, edit, reset, deactivate or demote
 * another principal or an owner. Throws 403 OWNER_ONLY when the actor is not
 * allowed.
 *
 *  - targetId/targetRole/targetIsOwner: the account being changed (omit when creating).
 *  - newRole: the role the account would get (creating or changing a role).
 *  - allowSelf: let people change their own harmless profile details.
 */
export async function assertOwnerManagesLeadership(
  actorId: string,
  p: { targetId?: string; targetRole?: string | null; targetIsOwner?: boolean | null; newRole?: string | null; allowSelf?: boolean }
): Promise<void> {
  const actor = await db('users').where({ id: actorId }).first('id', 'role', 'tenant_id', 'is_owner');
  if (!actor) throw new AppError('Your session has ended. Please sign in again.', 401, 'SESSION_INVALID');
  if (await isTenantOwner(actor)) return;
  // Only reaches here for a non-owner: a principal in a school with an owner, or other staff.
  if (p.allowSelf && p.targetId && String(p.targetId) === String(actor.id)) return;
  const touchesLeadership =
    p.targetIsOwner === true || p.targetRole === 'principal' || p.newRole === 'principal';
  if (!touchesLeadership) return;
  throw new AppError(
    'Principal and owner accounts are managed by the school owner only.',
    403,
    'OWNER_ONLY'
  );
}
