/**
 * Tenant User Service (platform / super admin)
 *
 * Lets a super admin resolve access problems for users INSIDE a tenant without
 * logging in as the school: list users, reset password, unlock, toggle status,
 * and disable 2FA. Every method is tenant-scoped — a userId is only ever acted
 * upon after confirming it belongs to the given tenant.
 */
import bcryptjs from 'bcryptjs';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

export class TenantUserService {
  /** Confirm the user belongs to the tenant, else 404 (prevents cross-tenant access). */
  private static async requireTenantUser(tenantId: string, userId: string) {
    const user = await db('users').where({ id: userId, tenant_id: tenantId }).first();
    if (!user) {
      throw new AppError('User not found in this tenant', 404, 'USER_NOT_FOUND');
    }
    return user;
  }

  static async listUsers(
    tenantId: string,
    filters?: { search?: string; role?: string; status?: string }
  ) {
    let query = db('users')
      .where({ tenant_id: tenantId })
      .select(
        'id', 'email', 'first_name', 'last_name', 'role', 'status',
        'last_login', 'two_factor_enabled', 'created_at'
      )
      .orderBy('created_at', 'desc');

    if (filters?.role) query = query.where('role', filters.role);
    if (filters?.status) query = query.where('status', filters.status);
    if (filters?.search) {
      query = query.where((b) => {
        b.where('email', 'ilike', `%${filters.search}%`)
          .orWhere('first_name', 'ilike', `%${filters.search}%`)
          .orWhere('last_name', 'ilike', `%${filters.search}%`);
      });
    }
    return query;
  }

  /** Generate a temporary password, hash it, and return the plaintext ONCE. */
  static async resetPassword(tenantId: string, userId: string): Promise<{ tempPassword: string; email: string }> {
    const user = await this.requireTenantUser(tenantId, userId);
    const tempPassword = 'WiSkul@' + Math.random().toString(36).substring(2, 8).toUpperCase() + '!';
    const hash = await bcryptjs.hash(tempPassword, 10);
    await db('users').where({ id: userId }).update({ password_hash: hash, updated_at: new Date() });
    logger.info(`[TenantUserService] Password reset for user ${userId} in tenant ${tenantId}`);
    return { tempPassword, email: user.email };
  }

  static async setStatus(tenantId: string, userId: string, status: 'active' | 'inactive'): Promise<void> {
    await this.requireTenantUser(tenantId, userId);
    if (status !== 'active' && status !== 'inactive') {
      throw new AppError("status must be 'active' or 'inactive'", 400, 'VALIDATION_ERROR');
    }
    await db('users').where({ id: userId }).update({ status, updated_at: new Date() });
    logger.info(`[TenantUserService] User ${userId} status set to ${status} (tenant ${tenantId})`);
  }

  /** Reactivate a user and clear any lockout artefacts if such columns exist. */
  static async unlock(tenantId: string, userId: string): Promise<void> {
    await this.requireTenantUser(tenantId, userId);
    const patch: any = { status: 'active', updated_at: new Date() };
    if (await db.schema.hasColumn('users', 'failed_login_attempts')) patch.failed_login_attempts = 0;
    if (await db.schema.hasColumn('users', 'locked_until')) patch.locked_until = null;
    await db('users').where({ id: userId }).update(patch);
    logger.info(`[TenantUserService] User ${userId} unlocked (tenant ${tenantId})`);
  }

  static async disableTwoFactor(tenantId: string, userId: string): Promise<void> {
    await this.requireTenantUser(tenantId, userId);
    await db('users').where({ id: userId }).update({
      two_factor_enabled: false,
      two_factor_secret: null,
      two_factor_backup_codes: null,
      two_factor_enabled_at: null,
      updated_at: new Date(),
    });
    // Clear any pending MFA challenges for a clean state.
    if (await db.schema.hasTable('mfa_challenges')) {
      await db('mfa_challenges').where({ user_id: userId }).del().catch(() => undefined);
    }
    logger.info(`[TenantUserService] 2FA disabled for user ${userId} (tenant ${tenantId})`);
  }
}

export default TenantUserService;
