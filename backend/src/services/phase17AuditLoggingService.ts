import type { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

/**
 * Phase 17.3: Comprehensive Audit Logging
 * 
 * Logs all data access and modifications:
 * - User identification
 * - Timestamp of access
 * - Data accessed
 * - Action performed (read, create, update, delete)
 * - IP address and user agent
 * - Result status (success/failure)
 * - Reason for sensitive actions
 */

interface AuditLogEntry {
  id: string;
  tenantId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: any;
  newValue?: any;
  status: 'success' | 'failure';
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

interface AuditFilterCriteria {
  tenantId: string;
  userId?: string;
  action?: string;
  entityType?: string;
  status?: 'success' | 'failure';
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export class AuditLoggingService {
  private db: Knex;
  private sensitiveFields = [
    'password',
    'email',
    'phone',
    'ssn',
    'accountNumber',
    'bankAccount',
    'creditCard',
  ];

  /**
   * Initializes audit logging service
   * @param database - Knex database instance
   */
  constructor(database: Knex) {
    this.db = database;
    logger.info('AuditLoggingService initialized');
  }

  /**
   * Logs an audit entry
   * @param entry - Audit log entry
   */
  async logAuditEntry(entry: AuditLogEntry): Promise<void> {
    try {
      // Sanitize sensitive data
      const sanitizedEntry = this.sanitizeSensitiveData(entry);

      // Store in database
      await this.db('audit_logs')
        .insert({
          id: uuidv4(),
          tenant_id: sanitizedEntry.tenantId,
          user_id: sanitizedEntry.userId,
          action: sanitizedEntry.action,
          entity_type: sanitizedEntry.entityType,
          entity_id: sanitizedEntry.entityId || null,
          old_value: sanitizedEntry.oldValue ? JSON.stringify(sanitizedEntry.oldValue) : null,
          new_value: sanitizedEntry.newValue ? JSON.stringify(sanitizedEntry.newValue) : null,
          status: sanitizedEntry.status,
          ip_address: sanitizedEntry.ipAddress || null,
          user_agent: sanitizedEntry.userAgent || null,
          reason: sanitizedEntry.reason || null,
          error_message: sanitizedEntry.errorMessage || null,
          metadata: sanitizedEntry.metadata ? JSON.stringify(sanitizedEntry.metadata) : null,
          created_at: new Date(),
        });

      logger.debug(
        `Audit logged: ${sanitizedEntry.action} on ${sanitizedEntry.entityType} by ${sanitizedEntry.userId}`
      );
    } catch (error) {
      logger.error('Failed to log audit entry', error);
      // Don't throw - audit logging should not break the main operation
    }
  }

  /**
   * Logs data access
   * @param tenantId - Tenant ID
   * @param userId - User ID
   * @param entityType - Type of entity accessed
   * @param entityId - ID of entity
   * @param ipAddress - Client IP address
   * @param userAgent - User agent string
   */
  async logDataAccess(
    tenantId: string,
    userId: string,
    entityType: string,
    entityId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logAuditEntry({
      id: uuidv4(),
      tenantId,
      userId,
      action: 'read',
      entityType,
      entityId,
      status: 'success',
      ipAddress,
      userAgent,
      createdAt: new Date(),
    });
  }

  /**
   * Logs data modification
   * @param tenantId - Tenant ID
   * @param userId - User ID
   * @param action - Action performed (create/update/delete)
   * @param entityType - Type of entity
   * @param entityId - ID of entity
   * @param oldValue - Previous value
   * @param newValue - New value
   * @param ipAddress - Client IP address
   * @param userAgent - User agent string
   * @param reason - Reason for modification (for sensitive actions)
   */
  async logDataModification(
    tenantId: string,
    userId: string,
    action: 'create' | 'update' | 'delete',
    entityType: string,
    entityId: string,
    oldValue?: any,
    newValue?: any,
    ipAddress?: string,
    userAgent?: string,
    reason?: string
  ): Promise<void> {
    await this.logAuditEntry({
      id: uuidv4(),
      tenantId,
      userId,
      action,
      entityType,
      entityId,
      oldValue,
      newValue,
      status: 'success',
      ipAddress,
      userAgent,
      reason,
      createdAt: new Date(),
    });
  }

  /**
   * Logs failed operation
   * @param tenantId - Tenant ID
   * @param userId - User ID
   * @param action - Action attempted
   * @param entityType - Type of entity
   * @param errorMessage - Error message
   * @param ipAddress - Client IP address
   * @param userAgent - User agent string
   */
  async logFailedOperation(
    tenantId: string,
    userId: string,
    action: string,
    entityType: string,
    errorMessage: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logAuditEntry({
      id: uuidv4(),
      tenantId,
      userId,
      action,
      entityType,
      status: 'failure',
      errorMessage,
      ipAddress,
      userAgent,
      createdAt: new Date(),
    });
  }

  /**
   * Retrieves audit logs with filtering
   * @param criteria - Filter criteria
   * @returns Array of audit log entries
   */
  async getAuditLogs(criteria: AuditFilterCriteria): Promise<AuditLogEntry[]> {
    try {
      let query = this.db('audit_logs')
        .where('tenant_id', criteria.tenantId);

      if (criteria.userId) {
        query = query.where('user_id', criteria.userId);
      }

      if (criteria.action) {
        query = query.where('action', criteria.action);
      }

      if (criteria.entityType) {
        query = query.where('entity_type', criteria.entityType);
      }

      if (criteria.status) {
        query = query.where('status', criteria.status);
      }

      if (criteria.dateFrom) {
        query = query.where('created_at', '>=', criteria.dateFrom);
      }

      if (criteria.dateTo) {
        query = query.where('created_at', '<=', criteria.dateTo);
      }

      const limit = criteria.limit || 100;
      const offset = criteria.offset || 0;

      const logs = await query
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .select();

      return logs.map((log: any) => ({
        id: log.id,
        tenantId: log.tenant_id,
        userId: log.user_id,
        action: log.action,
        entityType: log.entity_type,
        entityId: log.entity_id,
        oldValue: log.old_value ? JSON.parse(log.old_value) : null,
        newValue: log.new_value ? JSON.parse(log.new_value) : null,
        status: log.status,
        ipAddress: log.ip_address,
        userAgent: log.user_agent,
        reason: log.reason,
        errorMessage: log.error_message,
        metadata: log.metadata ? JSON.parse(log.metadata) : null,
        createdAt: log.created_at,
      }));
    } catch (error) {
      logger.error('Failed to retrieve audit logs', error);
      throw new AppError('Failed to retrieve audit logs', 500, (error as Error).message);
    }
  }

  /**
   * Gets audit log summary
   * @param tenantId - Tenant ID
   * @param dateFrom - Start date
   * @param dateTo - End date
   * @returns Summary statistics
   */
  async getAuditSummary(
    tenantId: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<Record<string, any>> {
    try {
      let query = this.db('audit_logs')
        .where('tenant_id', tenantId);

      if (dateFrom) {
        query = query.where('created_at', '>=', dateFrom);
      }

      if (dateTo) {
        query = query.where('created_at', '<=', dateTo);
      }

      // Get action counts
      const actionCounts = await query
        .clone()
        .groupBy('action')
        .select('action')
        .count('* as count');

      // Get status counts
      const statusCounts = await query
        .clone()
        .groupBy('status')
        .select('status')
        .count('* as count');

      // Get entity type counts
      const entityCounts = await query
        .clone()
        .groupBy('entity_type')
        .select('entity_type')
        .count('* as count');

      // Get user activity
      const userActivity = await query
        .clone()
        .groupBy('user_id')
        .select('user_id')
        .count('* as count')
        .orderBy('count', 'desc')
        .limit(10);

      // Get total logs
      const totalLogs = await query
        .clone()
        .count('* as count')
        .first() as any;

      return {
        totalLogs: totalLogs?.count || 0,
        actionBreakdown: Object.fromEntries(
          actionCounts.map((a: any) => [a.action, a.count])
        ),
        statusBreakdown: Object.fromEntries(
          statusCounts.map((s: any) => [s.status, s.count])
        ),
        entityBreakdown: Object.fromEntries(
          entityCounts.map((e: any) => [e.entity_type, e.count])
        ),
        topUsers: userActivity.map((u: any) => ({
          userId: u.user_id,
          activities: u.count,
        })),
      };
    } catch (error) {
      logger.error('Failed to get audit summary', error);
      throw new AppError('Failed to get audit summary', 500);
    }
  }

  /**
   * Exports audit logs as CSV
   * @param criteria - Filter criteria
   * @returns CSV content
   */
  async exportAuditLogsAsCSV(criteria: AuditFilterCriteria): Promise<string> {
    try {
      const logs = await this.getAuditLogs({
        ...criteria,
        limit: 10000,
      });

      // Build CSV
      const headers = [
        'Timestamp',
        'User ID',
        'Action',
        'Entity Type',
        'Entity ID',
        'Status',
        'IP Address',
        'Reason',
        'Error Message',
      ];

      const rows = logs.map((log) => [
        log.createdAt.toISOString(),
        log.userId,
        log.action,
        log.entityType,
        log.entityId || '',
        log.status,
        log.ipAddress || '',
        log.reason || '',
        log.errorMessage || '',
      ]);

      const csv = [
        headers.join(','),
        ...rows.map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ),
      ].join('\n');

      return csv;
    } catch (error) {
      logger.error('Failed to export audit logs', error);
      throw new AppError('Failed to export audit logs', 500);
    }
  }

  /**
   * Purges old audit logs based on retention policy
   * @param retentionDays - Keep logs for this many days
   * @returns Number of logs purged
   */
  async purgeOldAuditLogs(retentionDays: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await this.db('audit_logs')
        .where('created_at', '<', cutoffDate)
        .delete();

      logger.info(`Purged ${result} old audit logs (older than ${retentionDays} days)`);
      return result;
    } catch (error) {
      logger.error('Failed to purge old audit logs', error);
      throw new AppError('Failed to purge old audit logs', 500);
    }
  }

  /**
   * Archives audit logs (marks for archival)
   * @param tenantId - Tenant ID
   * @param archiveDate - Date to archive up to
   * @returns Number of logs archived
   */
  async archiveAuditLogs(tenantId: string, archiveDate: Date): Promise<number> {
    try {
      const result = await this.db('audit_logs')
        .where('tenant_id', tenantId)
        .where('created_at', '<', archiveDate)
        .update({
          archived: true,
          archived_at: new Date(),
        });

      logger.info(`Archived ${result} audit logs for tenant ${tenantId}`);
      return result;
    } catch (error) {
      logger.error('Failed to archive audit logs', error);
      throw new AppError('Failed to archive audit logs', 500);
    }
  }

  /**
   * Sanitizes sensitive data from audit entries
   * @param entry - Audit log entry
   * @returns Sanitized entry
   */
  private sanitizeSensitiveData(entry: AuditLogEntry): AuditLogEntry {
    const sanitized = { ...entry };

    // Sanitize old value
    if (sanitized.oldValue) {
      sanitized.oldValue = this.maskSensitiveFields(sanitized.oldValue);
    }

    // Sanitize new value
    if (sanitized.newValue) {
      sanitized.newValue = this.maskSensitiveFields(sanitized.newValue);
    }

    return sanitized;
  }

  /**
   * Masks sensitive fields in an object
   * @param obj - Object to mask
   * @returns Object with masked sensitive fields
   */
  private maskSensitiveFields(obj: any): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const masked = { ...obj };

    for (const field of this.sensitiveFields) {
      if (field in masked && masked[field]) {
        masked[field] = '[REDACTED]';
      }
    }

    return masked;
  }

  /**
   * Gets audit logging health status
   * @param tenantId - Tenant ID
   * @returns Health status
   */
  async getAuditLoggingHealth(tenantId: string): Promise<{
    status: string;
    recentLogs: number;
    oldestLog?: Date;
    newestLog?: Date;
    failureRate: number;
  }> {
    try {
      // Get recent logs (last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const recentCount = await this.db('audit_logs')
        .where('tenant_id', tenantId)
        .where('created_at', '>=', yesterday)
        .count('* as count')
        .first() as any;

      // Get oldest and newest logs
      const dates = await this.db('audit_logs')
        .where('tenant_id', tenantId)
        .select(
          this.db.raw('MIN(created_at) as oldest'),
          this.db.raw('MAX(created_at) as newest')
        )
        .first() as any;

      // Get failure rate
      const total = await this.db('audit_logs')
        .where('tenant_id', tenantId)
        .count('* as count')
        .first() as any;

      const failures = await this.db('audit_logs')
        .where('tenant_id', tenantId)
        .where('status', 'failure')
        .count('* as count')
        .first() as any;

      const failureRate = total?.count ? (failures?.count / total.count) * 100 : 0;

      return {
        status: recentCount?.count > 0 ? 'healthy' : 'warning',
        recentLogs: recentCount?.count || 0,
        oldestLog: dates?.oldest,
        newestLog: dates?.newest,
        failureRate: Math.round(failureRate * 100) / 100,
      };
    } catch (error) {
      logger.error('Failed to get audit logging health', error);
      return {
        status: 'error',
        recentLogs: 0,
        failureRate: 0,
      };
    }
  }
}

export default AuditLoggingService;
