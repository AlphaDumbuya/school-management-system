import { Knex } from 'knex';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

export interface AuditLogEntry {
  entity_type?: string;
  entity_id?: string;
  action: string;
  // camelCase aliases used by the finance services (payments, invoices). They
  // were silently dropped, so entity_type was NULL and every finance audit
  // insert failed: payments, refunds and invoices had no audit trail.
  entityType?: string;
  entityId?: string;
  performedBy?: string;
  details?: any;
  timestamp?: Date;
  performed_by?: string;
  performed_by_role?: string;
  old_values?: any;
  new_values?: any;
  changes?: any;
  reason?: string;
  source?: string;
  ip_address?: string;
  user_agent?: string;
}

export class AuditService {
  constructor(private db: Knex) {}

  /**
   * Log an audit entry
   */
  async logAudit(entry: AuditLogEntry): Promise<string> {
    const isUuid = (v?: string) => !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
    const entityId = entry.entity_id ?? entry.entityId;
    const performedBy = entry.performed_by ?? entry.performedBy;
    const newValues = entry.new_values ?? entry.details;
    const [inserted] = await this.db('audit_logs').insert({
      entity_type: entry.entity_type ?? entry.entityType ?? 'unknown',
      // Synthetic ids like "bulk-invoice-123" aren't UUIDs; keep them in the values.
      entity_id: isUuid(entityId) ? entityId : null,
      action: entry.action,
      performed_by: isUuid(performedBy) ? performedBy : null,
      performed_by_role: entry.performed_by_role,
      old_values: entry.old_values ? JSON.stringify(entry.old_values) : null,
      new_values: newValues || (!isUuid(entityId) && entityId)
        ? JSON.stringify({ ...(newValues || {}), ...(!isUuid(entityId) && entityId ? { ref: entityId } : {}) })
        : null,
      changes: entry.changes ? JSON.stringify(entry.changes) : null,
      reason: entry.reason,
      source: entry.source || 'api',
      ip_address: entry.ip_address,
      user_agent: entry.user_agent,
      created_at: entry.timestamp || new Date(),
    }).returning('id');

    // Postgres only returns rows with RETURNING; without it this destructure threw.
    return (inserted as any)?.id ?? inserted;
  }

  /**
   * Log student changes
   */
  async logStudentChange(
    studentId: string,
    action: string,
    oldValues: any,
    newValues: any,
    userId: string,
    reason?: string
  ): Promise<string> {
    const changes = this.calculateChanges(oldValues, newValues);

    return this.logAudit({
      entity_type: 'student',
      entity_id: studentId,
      action,
      performed_by: userId,
      old_values: oldValues,
      new_values: newValues,
      changes,
      reason: reason || `Student ${action}`,
      source: 'api',
    });
  }

  /**
   * Log enrollment changes
   */
  async logEnrollmentChange(
    enrollmentId: string,
    action: string,
    oldValues: any,
    newValues: any,
    userId: string,
    reason?: string
  ): Promise<string> {
    const changes = this.calculateChanges(oldValues, newValues);

    return this.logAudit({
      entity_type: 'enrollment',
      entity_id: enrollmentId,
      action,
      performed_by: userId,
      old_values: oldValues,
      new_values: newValues,
      changes,
      reason: reason || `Enrollment ${action}`,
      source: 'api',
    });
  }

  /**
   * Log enrollment request changes
   */
  async logEnrollmentRequestChange(
    requestId: string,
    action: string,
    oldValues: any,
    newValues: any,
    userId: string,
    reason?: string
  ): Promise<string> {
    const changes = this.calculateChanges(oldValues, newValues);

    return this.logAudit({
      entity_type: 'enrollment_request',
      entity_id: requestId,
      action,
      performed_by: userId,
      old_values: oldValues,
      new_values: newValues,
      changes,
      reason: reason || `Enrollment request ${action}`,
      source: 'api',
    });
  }

  /**
   * Get audit trail for an entity
   */
  async getEntityAuditTrail(
    entityType: string,
    entityId: string,
    filters?: { action?: string; page?: number; limit?: number }
  ): Promise<any> {
    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 50, 100);
    const offset = (page - 1) * limit;

    let query = this.db('audit_logs')
      .where('entity_type', entityType)
      .where('entity_id', entityId);

    if (filters?.action) {
      query = query.where('action', filters.action);
    }

    const countResult = await query.clone().count('* as count').first();
    const total = countResult.count;

    const logs = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    // Parse JSON fields
    const parsedLogs = logs.map((log) => ({
      ...log,
      old_values: log.old_values ? JSON.parse(log.old_values) : null,
      new_values: log.new_values ? JSON.parse(log.new_values) : null,
      changes: log.changes ? JSON.parse(log.changes) : null,
    }));

    return {
      data: parsedLogs,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get audit logs by entity type
   */
  async getAuditLogsByEntityType(
    entityType: string,
    filters?: { action?: string; page?: number; limit?: number }
  ): Promise<any> {
    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 50, 100);
    const offset = (page - 1) * limit;

    let query = this.db('audit_logs').where('entity_type', entityType);

    if (filters?.action) {
      query = query.where('action', filters.action);
    }

    const countResult = await query.clone().count('* as count').first();
    const total = countResult.count;

    const logs = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    const parsedLogs = logs.map((log) => ({
      ...log,
      old_values: log.old_values ? JSON.parse(log.old_values) : null,
      new_values: log.new_values ? JSON.parse(log.new_values) : null,
      changes: log.changes ? JSON.parse(log.changes) : null,
    }));

    return {
      data: parsedLogs,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get audit logs by user
   */
  async getAuditLogsByUser(
    userId: string,
    filters?: { entity_type?: string; action?: string; page?: number; limit?: number }
  ): Promise<any> {
    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 50, 100);
    const offset = (page - 1) * limit;

    let query = this.db('audit_logs').where('performed_by', userId);

    if (filters?.entity_type) {
      query = query.where('entity_type', filters.entity_type);
    }

    if (filters?.action) {
      query = query.where('action', filters.action);
    }

    const countResult = await query.clone().count('* as count').first();
    const total = countResult.count;

    const logs = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    const parsedLogs = logs.map((log) => ({
      ...log,
      old_values: log.old_values ? JSON.parse(log.old_values) : null,
      new_values: log.new_values ? JSON.parse(log.new_values) : null,
      changes: log.changes ? JSON.parse(log.changes) : null,
    }));

    return {
      data: parsedLogs,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get audit logs within date range
   */
  async getAuditLogsByDateRange(
    startDate: string,
    endDate: string,
    filters?: { entity_type?: string; action?: string; page?: number; limit?: number }
  ): Promise<any> {
    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 50, 100);
    const offset = (page - 1) * limit;

    let query = this.db('audit_logs')
      .where('created_at', '>=', startDate)
      .where('created_at', '<=', endDate);

    if (filters?.entity_type) {
      query = query.where('entity_type', filters.entity_type);
    }

    if (filters?.action) {
      query = query.where('action', filters.action);
    }

    const countResult = await query.clone().count('* as count').first();
    const total = countResult.count;

    const logs = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    const parsedLogs = logs.map((log) => ({
      ...log,
      old_values: log.old_values ? JSON.parse(log.old_values) : null,
      new_values: log.new_values ? JSON.parse(log.new_values) : null,
      changes: log.changes ? JSON.parse(log.changes) : null,
    }));

    return {
      data: parsedLogs,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get audit statistics
   */
  async getAuditStatistics(startDate?: string, endDate?: string): Promise<any> {
    let query = this.db('audit_logs');

    if (startDate) {
      query = query.where('created_at', '>=', startDate);
    }

    if (endDate) {
      query = query.where('created_at', '<=', endDate);
    }

    // Count by entity type
    const byEntityType = await query
      .clone()
      .select('entity_type')
      .count('* as count')
      .groupBy('entity_type');

    // Count by action
    const byAction = await query
      .clone()
      .select('action')
      .count('* as count')
      .groupBy('action');

    // Count by user
    const byUser = await query
      .clone()
      .select('performed_by', 'performed_by_role')
      .count('* as count')
      .groupBy('performed_by', 'performed_by_role')
      .limit(10);

    // Total count
    const total = await query.clone().count('* as count').first();

    return {
      total_events: total.count,
      by_entity_type: byEntityType,
      by_action: byAction,
      top_users: byUser,
    };
  }

  /**
   * Calculate what changed between old and new values
   */
  private calculateChanges(oldValues: any, newValues: any): Record<string, any> {
    const changes: Record<string, any> = {};

    for (const key in newValues) {
      if (oldValues[key] !== newValues[key]) {
        changes[key] = {
          old: oldValues[key],
          new: newValues[key],
        };
      }
    }

    return changes;
  }

  /**
   * Archive old audit logs (for data management)
   */
  async archiveOldLogs(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.db('audit_logs')
      .where('created_at', '<', cutoffDate)
      .del();

    logger.info(`Archived ${result} old audit logs (older than ${daysToKeep} days)`);
    return result;
  }

  /**
   * Export audit trail as CSV
   */
  async exportAuditTrailAsCSV(
    entityType: string,
    entityId: string
  ): Promise<string> {
    const result = await this.getEntityAuditTrail(entityType, entityId, { limit: 10000 });
    const logs = result.data;

    if (logs.length === 0) {
      return 'No audit logs found';
    }

    const headers = [
      'Timestamp',
      'Action',
      'Performed By',
      'Changes',
      'Reason',
    ];

    const rows = logs.map((log) =>
      [
        log.created_at,
        log.action,
        log.performed_by || 'System',
        JSON.stringify(log.changes || {}),
        log.reason || '',
      ]
        .map((val) => `"${String(val).replace(/"/g, '""')}"`)
        .join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }
}
