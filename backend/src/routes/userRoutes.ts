import { db } from '../utils/database.js';
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext, requirePermission } from '@middleware/authMiddleware';
import { UserRole } from '../types/auth';
import { PasswordService } from '@services/passwordService';
import { AppError } from '@middleware/errorHandler';
import { SubscriptionService } from '@services/subscriptionService';
import { logger } from '@utils/logger';
import { assertOwnerManagesLeadership, requireOwner, tenantHasOwner } from '../utils/tenantOwner';
import { clientIp } from '../middleware/rateLimit';
import { setOwnProfilePhoto, removeOwnProfilePhoto } from '@services/profilePhotoService';

const router = Router();

// Every route here needs the DB-backed user context (req.user.tenant_id/role).
// Mounted at /api/v1/users, so a router-wide guard is safe.
router.use(authenticate, attachUserContext);

const STAFF_ROLES = ['teacher', 'accountant', 'admissions_officer', 'principal'];

const isSuperAdmin = (actor: any) => actor?.role === UserRole.SUPER_ADMIN;

/**
 * Tenant isolation: a `users` query restricted to the caller's school.
 * Super admins (platform operators) are not restricted.
 */
function tenantUsers(actor: any) {
  const q = db('users');
  if (!isSuperAdmin(actor)) {
    if (!actor?.tenant_id) throw new AppError('Tenant context is required', 403, 'TENANT_REQUIRED');
    q.where('tenant_id', actor.tenant_id);
  }
  return q;
}

/**
 * PUT /api/v1/users/me/photo  { photo: "data:image/jpeg;base64,...", inline?: boolean }
 * Set or change the signed-in user's OWN profile photo (every role). The account
 * is always the one behind the token. JPG, PNG or WebP, up to 2 MB.
 * Returns the avatar /me now shows: { success, data: { profilePhotoUrl } }.
 */
router.put('/me/photo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) throw new AppError('Please sign in again.', 401, 'UNAUTHORIZED');
    const data = await setOwnProfilePhoto(userId, req.body?.photo, { inline: req.body?.inline === true });
    res.json({ success: true, message: 'Profile photo saved', data });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/users/me/photo
 * Remove the signed-in user's own profile photo.
 */
router.delete('/me/photo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) throw new AppError('Please sign in again.', 401, 'UNAUTHORIZED');
    const data = await removeOwnProfilePhoto(userId);
    res.json({ success: true, message: 'Profile photo removed', data });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/users
 * Create a new user (principal only)
 */
router.post('/', authenticate, attachUserContext, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, first_name, last_name, role, status } = req.body;
    const createdBy = (req as any).user.id;

    // Validate input
    if (!email || !first_name || !last_name || !role) {
      throw new AppError('Missing required fields', 400, 'VALIDATION_ERROR');
    }
    // Principal accounts are the school owner's to create.
    await assertOwnerManagesLeadership(createdBy, { newRole: String(role) });
    // Only a super admin may mint another super admin.
    if (String(role) === UserRole.SUPER_ADMIN && !isSuperAdmin((req as any).user)) {
      throw new AppError('You cannot create a super admin account', 403, 'FORBIDDEN');
    }

    // Enforce the plan's staff limit when creating a staff-role account (closes
    // the /users bypass of the staff cap). Blocked when at capacity or the
    // subscription is expired/suspended.
    const creatorTenantId = (req as any).user?.tenant_id;
    if (creatorTenantId && STAFF_ROLES.includes(String(role))) {
      const sub = await SubscriptionService.getActiveSubscription(creatorTenantId);
      if (sub.status === 'expired' || sub.status === 'suspended') {
        throw new AppError(`Your school subscription has ${sub.status}. Renew to add staff.`, 403, 'SUBSCRIPTION_EXPIRED');
      }
      const limit = await SubscriptionService.checkLimit(creatorTenantId, 'staff');
      if (!limit.allowed) {
        throw new AppError(
          `You have reached your plan's staff limit (${limit.current}/${limit.max}). Upgrade your plan to add more staff.`,
          403,
          'PLAN_LIMIT_REACHED'
        );
      }
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
      // New accounts belong to the creator's school (never tenant-less).
      tenant_id: creatorTenantId || null,
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
 * POST /api/v1/users/:id/reset-password
 * Principal / super_admin resets ANY user in their tenant back to a fresh
 * auto-generated DEMO password (stored in temp_password so it's visible again).
 * Works for every role — student, parent, teacher, accountant, admissions,
 * even a fellow principal. Tenant-scoped: a principal can only reset users in
 * their own school.
 */
router.post(
  '/:id/reset-password',
  authenticate,
  attachUserContext,
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.ADMISSIONS_OFFICER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const targetId = req.params.id;
      const actor = (req as any).user;
      const tenantId = actor?.tenant_id;

      const target = await db('users').where({ id: targetId }).first();
      if (!target) throw new AppError('User not found', 404, 'NOT_FOUND');

      // Tenant isolation: a principal may only reset users within their tenant.
      // Super admins (platform operators) may reset across tenants.
      if (actor.role !== 'super_admin' && target.tenant_id !== tenantId) {
        throw new AppError('You can only reset passwords for users in your school', 403, 'FORBIDDEN');
      }

      await assertOwnerManagesLeadership(actor.id, { targetId: target.id, targetRole: target.role, targetIsOwner: target.is_owner, allowSelf: true });

      // The admissions office hands out family logins: students and parents only.
      if (actor.role === 'admissions_officer' && !['student', 'parent', 'guardian'].includes(String(target.role))) {
        throw new AppError('Admissions can reset student and parent logins only. Ask the principal for staff accounts.', 403, 'FORBIDDEN');
      }
      // Never allow resetting a super_admin via this route.
      if (target.role === 'super_admin') {
        throw new AppError('Super admin passwords cannot be reset here', 403, 'FORBIDDEN');
      }

      const newPassword = PasswordService.generateTemporaryPassword();
      const passwordHash = await PasswordService.hashPassword(newPassword);

      await db('users').where({ id: targetId }).update({
        password_hash: passwordHash,
        temp_password: newPassword,   // visible to the principal until the user changes it
        status: 'active',
        // Clear MFA + last_login so the account is truly back to demo state and
        // the holder is treated as first-login again.
        two_factor_enabled: false,
        two_factor_secret: null,
        two_factor_backup_codes: null,
        two_factor_enabled_at: null,
        last_login: null,
        updated_at: new Date(),
      });

      logger.info(`Password reset for user ${target.email} by ${actor.email}`);

      // The login identifier is the username (students) or email (everyone else).
      const loginId = target.username || target.email;
      res.json({
        success: true,
        message: 'Password reset to a new demo password',
        data: {
          user_id: target.id,
          role: target.role,
          login_id: loginId,
          email: target.email,
          username: target.username || null,
          temporary_password: newPassword,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/v1/users
 * List all users with pagination (principal only)
 */
router.get('/', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.ADMISSIONS_OFFICER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const offset = (page - 1) * limit;
    const role = req.query.role as string;
    const status = req.query.status as string;
    const search = req.query.search as string;

    const actor = (req as any).user;
    let query = tenantUsers(actor).select('id', 'email', 'first_name', 'last_name', 'role', 'status', 'is_owner', 'last_login', 'created_at');

    if (role) {
      query = query.where('role', role);
    }
    if (status) {
      query = query.where('status', status);
    }
    if (search) {
      const term = `%${search.trim()}%`;
      query = query.where(function() {
        this.where('first_name', 'ilike', term)
          .orWhere('last_name', 'ilike', term)
          .orWhere('email', 'ilike', term);
      });
    }

    const countQuery = tenantUsers(actor);
    if (role) countQuery.where('role', role);
    if (status) countQuery.where('status', status);
    if (search) {
      const term = `%${search.trim()}%`;
      countQuery.where(function() {
        this.where('first_name', 'ilike', term)
          .orWhere('last_name', 'ilike', term)
          .orWhere('email', 'ilike', term);
      });
    }
    const total = await countQuery.count('* as count').first();
    const users = await query.limit(limit).offset(offset);

    res.json({
      data: users.map((u: any) => ({
        ...u,
        firstName: u.first_name,
        lastName: u.last_name,
      })),
      pagination: {
        page,
        limit,
        total: Number(total?.count ?? 0),
        total_pages: Math.ceil(Number(total?.count ?? 0) / limit),
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
    const isSelf = String(userId) === String(currentUser.id);

    // Users can only view their own profile unless they're principal/super admin
    if (!isSelf && currentUser.role !== 'principal' && !isSuperAdmin(currentUser)) {
      throw new AppError('Unauthorized', 403, 'AUTHORIZATION_ERROR');
    }

    // Tenant-scoped: a principal only sees users in their own school.
    const user = await (isSelf ? db('users') : tenantUsers(currentUser))
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

    const isSelf = String(userId) === String(currentUser.id);
    const isAdmin = currentUser.role === 'principal' || isSuperAdmin(currentUser);

    // Users can only update their own profile unless they're principal/super admin
    if (!isSelf && !isAdmin) {
      throw new AppError('Unauthorized', 403, 'AUTHORIZATION_ERROR');
    }

    // Tenant isolation + never let a principal edit a super admin.
    if (!isSelf) {
      const target = await tenantUsers(currentUser).where('id', userId).first('id', 'role', 'is_owner');
      if (!target) throw new AppError('User not found', 404, 'NOT_FOUND');
      await assertOwnerManagesLeadership(currentUser.id, { targetId: target.id, targetRole: target.role, targetIsOwner: target.is_owner });
      if (target.role === UserRole.SUPER_ADMIN && !isSuperAdmin(currentUser)) {
        throw new AppError('You cannot modify a super admin account', 403, 'FORBIDDEN');
      }
    }

    // Admin/principal can change status, but users cannot
    const updateData: any = {};
    if (first_name) updateData.first_name = first_name;
    if (last_name) updateData.last_name = last_name;

    if (status && isAdmin) {
      updateData.status = status;
    }

    updateData.updated_at = new Date();
    if (!isSelf) {
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
router.delete('/:id', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.id;
    const currentUser = (req as any).user;

    // Prevent self-deletion
    if (String(userId) === String(currentUser.id)) {
      throw new AppError('Cannot delete your own account', 400, 'VALIDATION_ERROR');
    }

    // Tenant-scoped lookup: a principal can only deactivate users in their school.
    const user = await tenantUsers(currentUser).where('id', userId).first();
    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }
    if (user.role === UserRole.SUPER_ADMIN && !isSuperAdmin(currentUser)) {
      throw new AppError('You cannot deactivate a super admin account', 403, 'FORBIDDEN');
    }
    await assertOwnerManagesLeadership(currentUser.id, { targetId: user.id, targetRole: user.role, targetIsOwner: user.is_owner });

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
 * Update user role (principal only)
 */
router.put('/:id/role', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.id;
    const { role } = req.body;
    const currentUser = (req as any).user;

    const validRoles = ['principal', 'teacher', 'student', 'parent', 'accountant', 'admissions_officer'];
    if (!role || !validRoles.includes(role)) {
      throw new AppError(`Invalid role. Must be one of: ${validRoles.join(', ')}`, 400, 'VALIDATION_ERROR');
    }

    // Tenant-scoped lookup: a principal can only change roles in their school.
    const user = await tenantUsers(currentUser).where('id', userId).first();
    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }
    if (user.role === UserRole.SUPER_ADMIN && !isSuperAdmin(currentUser)) {
      throw new AppError('You cannot change a super admin account', 403, 'FORBIDDEN');
    }
    await assertOwnerManagesLeadership(currentUser.id, { targetId: user.id, targetRole: user.role, targetIsOwner: user.is_owner, newRole: role });
    if (user.is_owner && role !== 'principal') {
      throw new AppError('This person is a school owner. Remove their ownership first.', 400, 'VALIDATION_ERROR');
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
 * POST /api/v1/users/:id/ownership   { grant: boolean, currentPassword, twoFactorCode?, confirm? }
 * Name (grant) or remove (revoke) a school owner. Owner-only, and the owner proves it
 * is really them again (password, plus 2FA if enabled). A school always keeps at
 * least one owner. Handing ownership to someone else when you are not yet a named
 * owner (a school that has no owner account) needs `confirm: true`, because it
 * moves billing, payment settings and verification away from you.
 */
router.post('/:id/ownership', requireOwner, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = (req as any).user;
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const { grant, currentPassword, twoFactorCode, confirm } = body;
    if (typeof grant !== 'boolean') throw new AppError('grant must be true or false', 400, 'VALIDATION_ERROR');

    const target = await tenantUsers(actor).where('id', req.params.id).first();
    if (!target) throw new AppError('User not found', 404, 'NOT_FOUND');
    if (target.role !== 'principal') {
      throw new AppError('A school owner holds a principal account. Make this person a principal first.', 400, 'VALIDATION_ERROR');
    }
    if (grant && String(target.status || '').toLowerCase() !== 'active') {
      throw new AppError('Only an active account can be made an owner.', 400, 'VALIDATION_ERROR');
    }

    const security = await import('../services/paymentSettingsSecurity');
    const { default: twoFactor } = await import('../services/twoFactorService');
    const meta = { ip: clientIp(req), userAgent: String(req.headers['user-agent'] || '').slice(0, 300) };
    security.assertNotImpersonated(req);
    await security.assertStepUp(db, { userId: actor.id, role: String(actor.primary_role || actor.role), password: currentPassword, twoFactorCode, ...meta }, twoFactor);

    const tenantId = target.tenant_id;
    if (grant) {
      if (target.is_owner) throw new AppError('This person is already a school owner.', 409, 'CONFLICT');
      const handingOver = !(await tenantHasOwner(tenantId)) && String(target.id) !== String(actor.id) && !isSuperAdmin(actor);
      if (handingOver && confirm !== true) {
        throw new AppError('Making someone else the owner moves billing, payment settings and verification away from you. Confirm to continue.', 409, 'OWNER_HANDOVER_CONFIRM');
      }
      await db('users').where({ id: target.id }).update({ is_owner: true, updated_at: new Date(), updated_by: actor.id });
    } else {
      if (!target.is_owner) throw new AppError('This person is not a school owner.', 409, 'CONFLICT');
      const others: any = await db('users').where({ tenant_id: tenantId, is_owner: true }).whereNot('id', target.id).where('status', 'active').count('* as n').first();
      if (Number(others?.n || 0) < 1) {
        throw new AppError('A school must always have at least one owner. Name another owner first.', 400, 'LAST_OWNER');
      }
      await db('users').where({ id: target.id }).update({ is_owner: false, updated_at: new Date(), updated_by: actor.id });
    }

    await db('audit_logs').insert({
      user_id: actor.id, performed_by: actor.id, performed_by_role: String(actor.primary_role || actor.role),
      action: grant ? 'ownership.grant' : 'ownership.revoke', entity_type: 'user', entity_id: target.id,
      new_values: JSON.stringify({ tenantId, target: target.email }),
      ip_address: meta.ip || null, user_agent: meta.userAgent || null, source: 'api', created_at: new Date(),
    }).catch((e: any) => logger.warn(`Could not record an ownership change: ${e?.message || e}`));
    logger.info(`Ownership ${grant ? 'granted to' : 'removed from'} ${target.email} by ${actor.email}`);

    // Tell the person affected, the school's owners (after the change) and the
    // actor. Awaited (serverless freezes after the response) but never fails the change.
    try {
      const { schoolOwners, leadTitleFor } = await import('../utils/schoolLeaders');
      const [owners, actorRow, leadTitle] = await Promise.all([
        schoolOwners(tenantId),
        db('users').where({ id: actor.id }).first('email', 'first_name', 'last_name'),
        leadTitleFor(tenantId),
      ]);
      const fullName = (u: any) => [u?.first_name, u?.last_name].filter(Boolean).join(' ');
      const targetName = fullName(target) || target.email;
      const actorName = fullName(actorRow) || actorRow?.email || 'A school owner';
      const people = new Map<string, { email: string; name: string; isTarget: boolean }>();
      const add = (email: string | null | undefined, name: string, isTarget: boolean) => {
        const k = String(email || '').trim().toLowerCase();
        if (k && !people.has(k)) people.set(k, { email: String(email).trim(), name, isTarget });
      };
      add(target.email, targetName, true);
      for (const o of owners) add(o.email, o.name, false);
      add(actorRow?.email, actorName, false);
      const { default: emailService } = await import('../services/emailService');
      const when = new Date();
      await Promise.allSettled([...people.values()].map((p) =>
        emailService.sendOwnershipChangedEmail(tenantId, p.email, {
          recipientName: p.name, targetName, isTarget: p.isTarget, actorName,
          granted: grant, when, ip: meta.ip || undefined, leadTitle,
        })));
    } catch (e: any) {
      logger.warn(`Ownership change email failed: ${e?.message || e}`);
    }

    res.json({ success: true, message: grant ? 'Owner added.' : 'Ownership removed.', data: { id: target.id, isOwner: grant } });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/users/role/:role
 * Get users by role (principal only)
 */
router.get('/role/:role', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.params.role;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const offset = (page - 1) * limit;

    const validRoles = ['principal', 'teacher', 'student', 'parent', 'accountant', 'admissions_officer'];
    if (!validRoles.includes(role)) {
      throw new AppError(`Invalid role. Must be one of: ${validRoles.join(', ')}`, 400, 'VALIDATION_ERROR');
    }

    const actor = (req as any).user;
    const total: any = await tenantUsers(actor).where('role', role).count('* as count').first();
    const users = await tenantUsers(actor)
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
