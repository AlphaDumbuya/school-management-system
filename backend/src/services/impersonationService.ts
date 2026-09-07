/**
 * Impersonation Service (platform / super admin)
 *
 * Mints a scoped session token for a tenant user so a super admin can enter a
 * school for support. The token carries the target user's identity (so the app
 * behaves exactly as that user, and tenantId resolves from the DB row) plus an
 * `impersonatedBy` claim for attribution. Every mint is audited by the caller.
 */
import { db } from '../utils/database';
import { AppError } from '../middleware/errorHandler';
import { JWTService } from './jwtService';

export class ImpersonationService {
  /**
   * Start impersonation. If no targetUserId is given, defaults to the tenant's
   * principal (else any active user in the tenant).
   */
  static async start(
    tenantId: string,
    superAdminId: string,
    targetUserId?: string
  ): Promise<{ access_token: string; user: any }> {
    const tenant = await db('tenants').where({ id: tenantId }).first();
    if (!tenant) throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');

    let target;
    if (targetUserId) {
      target = await db('users').where({ id: targetUserId, tenant_id: tenantId }).first();
    } else {
      target = await db('users')
        .where({ tenant_id: tenantId, role: 'principal' })
        .first();
      if (!target) {
        target = await db('users').where({ tenant_id: tenantId, status: 'active' }).first();
      }
    }
    if (!target) throw new AppError('No user available to impersonate in this tenant', 404, 'USER_NOT_FOUND');

    const access_token = JWTService.generateAccessToken({
      userId: target.id,
      email: target.email,
      role: target.role,
      impersonatedBy: superAdminId,
      impersonation: true,
    } as any);

    return {
      access_token,
      user: {
        id: target.id,
        email: target.email,
        firstName: target.first_name,
        lastName: target.last_name,
        role: target.role,
        tenantId: tenant.id,
        schoolName: tenant.name,
      },
    };
  }
}

export default ImpersonationService;
