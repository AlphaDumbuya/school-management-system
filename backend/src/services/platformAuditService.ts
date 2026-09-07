/**
 * Platform Audit Service
 *
 * Thin wrapper over the existing `audit_logs` table so every super-admin action
 * on a tenant (lifecycle, billing, user support, impersonation) leaves an
 * attributable trail. Never throws into the caller's happy path — auditing must
 * not break the operation it records.
 */
import { db } from '../utils/database';
import { logger } from '../utils/logger';

export interface AuditRecordInput {
  tenantId?: string | null;
  actorUserId: string;
  action: string;
  entityType?: string;
  entityId?: string | null;
  changes?: Record<string, any> | null;
  ip?: string | null;
  userAgent?: string | null;
}

export class PlatformAuditService {
  static async record(input: AuditRecordInput): Promise<void> {
    try {
      await db('audit_logs').insert({
        user_id: input.actorUserId,
        action: input.action,
        entity_type: input.entityType || 'tenant',
        entity_id: input.entityId || input.tenantId || null,
        changes: input.changes ? JSON.stringify({ ...input.changes, tenant_id: input.tenantId }) : JSON.stringify({ tenant_id: input.tenantId }),
        ip_address: input.ip || null,
        user_agent: input.userAgent || null,
        created_at: new Date(),
      });
    } catch (error) {
      // Audit failures are logged but never block the primary action.
      logger.error(`[PlatformAuditService] Failed to record audit '${input.action}': ${error}`);
    }
  }

  /**
   * List audit entries. When tenantId is provided, only entries whose changes
   * blob references that tenant are returned (entity_id or embedded tenant_id).
   */
  static async list(filters: { tenantId?: string; action?: string; limit?: number; offset?: number }) {
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    let query = db('audit_logs')
      .leftJoin('users', 'audit_logs.user_id', 'users.id')
      .select(
        'audit_logs.*',
        'users.first_name as actor_first_name',
        'users.last_name as actor_last_name',
        'users.email as actor_email',
        'users.role as actor_role'
      )
      .orderBy('audit_logs.created_at', 'desc');

    if (filters.tenantId) {
      query = query.where((b) => {
        b.where('audit_logs.entity_id', filters.tenantId).orWhereRaw(
          "audit_logs.changes::text LIKE ?",
          [`%${filters.tenantId}%`]
        );
      });
    }
    if (filters.action) {
      query = query.where('audit_logs.action', filters.action);
    }

    const rows = await query.limit(limit).offset(offset);
    return rows;
  }
}

export default PlatformAuditService;
