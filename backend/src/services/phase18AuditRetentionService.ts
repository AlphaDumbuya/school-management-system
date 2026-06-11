import type { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Phase 18.3: Audit Log Retention and Archival
 * 
 * Manages audit log lifecycle:
 * - Enforces 2+ year retention policy
 * - Archives old logs for long-term storage
 * - Purges logs beyond retention period
 * - Verifies retention compliance
 * - Generates retention reports
 * - Maintains archival index
 */

interface RetentionPolicy {
  tenantId: string;
  retentionDays: number;
  archivalDays: number;
  compressArchives: boolean;
  archiveLocation: string;
  lastPurgeDate?: Date;
  nextPurgeDate: Date;
}

interface ArchiveMetadata {
  id: string;
  tenantId: string;
  archiveName: string;
  archiveDate: Date;
  logsCount: number;
  dateRangeStart: Date;
  dateRangeEnd: Date;
  fileSize: number;
  fileLocation: string;
  compressed: boolean;
  checksumSHA256: string;
  verifiedAt?: Date;
  restoredAt?: Date;
  createdBy: string;
}

export class AuditRetentionService {
  private db: Knex;
  private defaultRetentionDays = 730; // 2 years
  private archiveStoragePath: string;

  /**
   * Initializes audit retention service
   * @param database - Knex database instance
   * @param storagePath - Path for archive storage
   */
  constructor(database: Knex, storagePath: string = './audit_archives') {
    this.db = database;
    this.archiveStoragePath = storagePath;
    logger.info('AuditRetentionService initialized');
    this.initializeArchiveDirectory();
  }

  /**
   * Initializes archive storage directory
   */
  private async initializeArchiveDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.archiveStoragePath, { recursive: true });
      logger.info(`Archive directory initialized: ${this.archiveStoragePath}`);
    } catch (error) {
      logger.error('Failed to initialize archive directory', error);
    }
  }

  /**
   * Sets retention policy for a tenant
   * @param tenantId - Tenant ID
   * @param retentionDays - Number of days to retain logs (minimum 730 = 2 years)
   * @param archivalDays - Number of days before archival
   * @returns Created/updated retention policy
   */
  async setRetentionPolicy(
    tenantId: string,
    retentionDays: number = 730,
    archivalDays: number = 365
  ): Promise<RetentionPolicy> {
    try {
      if (retentionDays < 730) {
        throw new AppError('Retention period must be at least 730 days (2 years)', 400);
      }

      if (archivalDays >= retentionDays) {
        throw new AppError('Archival days must be less than retention days', 400);
      }

      // Calculate next purge date
      const nextPurgeDate = new Date();
      nextPurgeDate.setDate(nextPurgeDate.getDate() + archivalDays);

      // Check if policy exists
      const existing = await this.db('audit_retention_policies')
        .where('tenant_id', tenantId)
        .first();

      if (existing) {
        await this.db('audit_retention_policies')
          .where('tenant_id', tenantId)
          .update({
            retention_days: retentionDays,
            archival_days: archivalDays,
            next_purge_date: nextPurgeDate,
            updated_at: new Date(),
          });
      } else {
        await this.db('audit_retention_policies').insert({
          id: uuidv4(),
          tenant_id: tenantId,
          retention_days: retentionDays,
          archival_days: archivalDays,
          compress_archives: true,
          archive_location: this.archiveStoragePath,
          next_purge_date: nextPurgeDate,
          created_at: new Date(),
        });
      }

      logger.info(
        `Retention policy set for tenant ${tenantId}: ${retentionDays} days retention, ${archivalDays} days archival`
      );

      return {
        tenantId,
        retentionDays,
        archivalDays,
        compressArchives: true,
        archiveLocation: this.archiveStoragePath,
        nextPurgeDate,
      };
    } catch (error) {
      logger.error('Failed to set retention policy', error);
      throw new AppError('Failed to set retention policy', 500, (error as Error).message);
    }
  }

  /**
   * Archives old audit logs
   * @param tenantId - Tenant ID
   * @returns Archive metadata
   */
  async archiveOldLogs(tenantId: string): Promise<ArchiveMetadata> {
    try {
      // Get retention policy
      const policy = await this.db('audit_retention_policies')
        .where('tenant_id', tenantId)
        .first();

      if (!policy) {
        throw new AppError('No retention policy found for tenant', 404);
      }

      // Calculate archival cutoff date
      const archivalCutoffDate = new Date();
      archivalCutoffDate.setDate(archivalCutoffDate.getDate() - policy.archival_days);

      // Get logs to archive
      const logsToArchive = await this.db('audit_logs')
        .where('tenant_id', tenantId)
        .where('created_at', '<', archivalCutoffDate)
        .where('archived', false)
        .select();

      if (logsToArchive.length === 0) {
        throw new AppError('No logs eligible for archival', 400);
      }

      // Create archive file
      const archiveId = uuidv4();
      const archiveName = `audit_archive_${tenantId}_${Date.now()}.json`;
      const archivePath = path.join(this.archiveStoragePath, archiveName);

      // Prepare archive data
      const archiveData = {
        archiveId,
        tenantId,
        createdAt: new Date(),
        logsCount: logsToArchive.length,
        dateRangeStart: logsToArchive[0]?.created_at,
        dateRangeEnd: logsToArchive[logsToArchive.length - 1]?.created_at,
        logs: logsToArchive,
      };

      // Write to file
      const content = JSON.stringify(archiveData, null, 2);
      await fs.writeFile(archivePath, content, 'utf-8');

      // Calculate checksum
      const crypto = await import('crypto');
      const checksum = crypto
        .createHash('sha256')
        .update(content)
        .digest('hex');

      // Get file size
      const stats = await fs.stat(archivePath);
      const fileSize = stats.size;

      // Create archive metadata
      const metadata: ArchiveMetadata = {
        id: archiveId,
        tenantId,
        archiveName,
        archiveDate: new Date(),
        logsCount: logsToArchive.length,
        dateRangeStart: logsToArchive[0]?.created_at,
        dateRangeEnd: logsToArchive[logsToArchive.length - 1]?.created_at,
        fileSize,
        fileLocation: archivePath,
        compressed: policy.compress_archives,
        checksumSHA256: checksum,
        createdBy: 'system',
      };

      // Store metadata in database
      await this.db('audit_archives').insert({
        id: archiveId,
        tenant_id: tenantId,
        archive_name: archiveName,
        archive_date: new Date(),
        logs_count: logsToArchive.length,
        date_range_start: logsToArchive[0]?.created_at,
        date_range_end: logsToArchive[logsToArchive.length - 1]?.created_at,
        file_size: fileSize,
        file_location: archivePath,
        compressed: policy.compress_archives,
        checksum_sha256: checksum,
        created_by: 'system',
        created_at: new Date(),
      });

      // Mark logs as archived
      await this.db('audit_logs')
        .where('tenant_id', tenantId)
        .where('created_at', '<', archivalCutoffDate)
        .where('archived', false)
        .update({
          archived: true,
          archived_at: new Date(),
        });

      logger.info(
        `Archived ${logsToArchive.length} logs for tenant ${tenantId} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`
      );

      return metadata;
    } catch (error) {
      logger.error('Failed to archive old logs', error);
      throw new AppError('Failed to archive old logs', 500, (error as Error).message);
    }
  }

  /**
   * Purges logs beyond retention period
   * @param tenantId - Tenant ID
   * @returns Number of logs purged
   */
  async purgeExpiredLogs(tenantId: string): Promise<number> {
    try {
      // Get retention policy
      const policy = await this.db('audit_retention_policies')
        .where('tenant_id', tenantId)
        .first();

      if (!policy) {
        logger.warn(`No retention policy found for tenant ${tenantId}`);
        // Use default retention
        const defaultCutoffDate = new Date();
        defaultCutoffDate.setDate(defaultCutoffDate.getDate() - this.defaultRetentionDays);

        const deletedCount = await this.db('audit_logs')
          .where('tenant_id', tenantId)
          .where('created_at', '<', defaultCutoffDate)
          .where('archived', true)
          .delete();

        return deletedCount;
      }

      // Calculate retention cutoff date
      const retentionCutoffDate = new Date();
      retentionCutoffDate.setDate(retentionCutoffDate.getDate() - policy.retention_days);

      // Only purge archived logs
      const deletedCount = await this.db('audit_logs')
        .where('tenant_id', tenantId)
        .where('created_at', '<', retentionCutoffDate)
        .where('archived', true)
        .delete();

      // Update last purge date
      await this.db('audit_retention_policies')
        .where('tenant_id', tenantId)
        .update({
          last_purge_date: new Date(),
        });

      logger.info(`Purged ${deletedCount} archived logs for tenant ${tenantId}`);

      return deletedCount;
    } catch (error) {
      logger.error('Failed to purge expired logs', error);
      throw new AppError('Failed to purge expired logs', 500, (error as Error).message);
    }
  }

  /**
   * Verifies retention compliance
   * @param tenantId - Tenant ID
   * @returns Compliance status
   */
  async verifyRetentionCompliance(
    tenantId: string
  ): Promise<{
    compliant: boolean;
    policy: RetentionPolicy | null;
    activeLogsCount: number;
    archivedLogsCount: number;
    oldestActiveLog: Date | null;
    oldestLogAge: number; // in days
    violations: string[];
  }> {
    try {
      const policy = await this.db('audit_retention_policies')
        .where('tenant_id', tenantId)
        .first();

      if (!policy) {
        return {
          compliant: false,
          policy: null,
          activeLogsCount: 0,
          archivedLogsCount: 0,
          oldestActiveLog: null,
          oldestLogAge: 0,
          violations: ['No retention policy defined'],
        };
      }

      // Count active and archived logs
      const activeLogs = await this.db('audit_logs')
        .where('tenant_id', tenantId)
        .where('archived', false)
        .count('* as count')
        .first() as any;

      const archivedLogs = await this.db('audit_logs')
        .where('tenant_id', tenantId)
        .where('archived', true)
        .count('* as count')
        .first() as any;

      // Get oldest log
      const oldestLog = await this.db('audit_logs')
        .where('tenant_id', tenantId)
        .orderBy('created_at', 'asc')
        .first();

      const violations: string[] = [];
      let compliant = true;

      // Check for logs beyond retention period
      const retentionCutoffDate = new Date();
      retentionCutoffDate.setDate(retentionCutoffDate.getDate() - policy.retention_days);

      const expiredLogs = await this.db('audit_logs')
        .where('tenant_id', tenantId)
        .where('created_at', '<', retentionCutoffDate)
        .count('* as count')
        .first() as any;

      if (expiredLogs.count > 0) {
        violations.push(
          `${expiredLogs.count} logs exceed retention period of ${policy.retention_days} days`
        );
        compliant = false;
      }

      const oldestLogAge = oldestLog
        ? Math.floor(
            (new Date().getTime() - new Date(oldestLog.created_at).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : 0;

      return {
        compliant,
        policy: {
          tenantId,
          retentionDays: policy.retention_days,
          archivalDays: policy.archival_days,
          compressArchives: policy.compress_archives,
          archiveLocation: policy.archive_location,
          lastPurgeDate: policy.last_purge_date,
          nextPurgeDate: policy.next_purge_date,
        },
        activeLogsCount: activeLogs.count || 0,
        archivedLogsCount: archivedLogs.count || 0,
        oldestActiveLog: oldestLog?.created_at || null,
        oldestLogAge,
        violations,
      };
    } catch (error) {
      logger.error('Failed to verify retention compliance', error);
      throw new AppError('Failed to verify retention compliance', 500);
    }
  }

  /**
   * Restores logs from archive
   * @param archiveId - Archive ID
   * @param limit - Maximum logs to restore
   * @returns Restored logs count
   */
  async restoreFromArchive(archiveId: string, limit: number = 10000): Promise<number> {
    try {
      // Get archive metadata
      const archive = await this.db('audit_archives')
        .where('id', archiveId)
        .first();

      if (!archive) {
        throw new AppError('Archive not found', 404);
      }

      // Read archive file
      const content = await fs.readFile(archive.file_location, 'utf-8');
      const archiveData = JSON.parse(content);

      // Restore logs (up to limit)
      const logsToRestore = archiveData.logs.slice(0, limit);

      for (const log of logsToRestore) {
        // Check if log already exists
        const existing = await this.db('audit_logs')
          .where('id', log.id)
          .first();

        if (!existing) {
          await this.db('audit_logs').insert({
            id: log.id,
            tenant_id: log.tenant_id,
            user_id: log.user_id,
            action: log.action,
            entity_type: log.entity_type,
            entity_id: log.entity_id,
            old_value: log.old_value,
            new_value: log.new_value,
            status: log.status,
            ip_address: log.ip_address,
            user_agent: log.user_agent,
            reason: log.reason,
            error_message: log.error_message,
            metadata: log.metadata,
            archived: false,
            created_at: log.created_at,
          });
        }
      }

      // Update archive as restored
      await this.db('audit_archives')
        .where('id', archiveId)
        .update({
          restored_at: new Date(),
        });

      logger.info(
        `Restored ${logsToRestore.length} logs from archive ${archiveId}`
      );

      return logsToRestore.length;
    } catch (error) {
      logger.error('Failed to restore from archive', error);
      throw new AppError('Failed to restore from archive', 500, (error as Error).message);
    }
  }

  /**
   * Verifies archive integrity
   * @param archiveId - Archive ID
   * @returns Verification result
   */
  async verifyArchiveIntegrity(archiveId: string): Promise<{
    valid: boolean;
    archiveId: string;
    fileExists: boolean;
    checksumValid: boolean;
    logsCount: number;
    fileSizeBytes: number;
  }> {
    try {
      const archive = await this.db('audit_archives')
        .where('id', archiveId)
        .first();

      if (!archive) {
        throw new AppError('Archive not found', 404);
      }

      // Check if file exists
      let fileExists = false;
      let fileSizeBytes = 0;

      try {
        const stats = await fs.stat(archive.file_location);
        fileExists = true;
        fileSizeBytes = stats.size;
      } catch (error) {
        fileExists = false;
      }

      // Verify checksum if file exists
      let checksumValid = false;
      if (fileExists) {
        const content = await fs.readFile(archive.file_location, 'utf-8');
        const crypto = await import('crypto');
        const calculatedChecksum = crypto
          .createHash('sha256')
          .update(content)
          .digest('hex');

        checksumValid = calculatedChecksum === archive.checksum_sha256;
      }

      const valid = fileExists && checksumValid;

      // Update verified status
      if (valid) {
        await this.db('audit_archives')
          .where('id', archiveId)
          .update({
            verified_at: new Date(),
          });
      }

      return {
        valid,
        archiveId,
        fileExists,
        checksumValid,
        logsCount: archive.logs_count,
        fileSizeBytes,
      };
    } catch (error) {
      logger.error('Failed to verify archive integrity', error);
      throw new AppError('Failed to verify archive integrity', 500, (error as Error).message);
    }
  }

  /**
   * Lists archives for a tenant
   * @param tenantId - Tenant ID
   * @param limit - Result limit
   * @param offset - Result offset
   * @returns Array of archives
   */
  async listArchives(
    tenantId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ArchiveMetadata[]> {
    try {
      const archives = await this.db('audit_archives')
        .where('tenant_id', tenantId)
        .orderBy('archive_date', 'desc')
        .limit(limit)
        .offset(offset)
        .select();

      return archives.map((a: any) => ({
        id: a.id,
        tenantId: a.tenant_id,
        archiveName: a.archive_name,
        archiveDate: a.archive_date,
        logsCount: a.logs_count,
        dateRangeStart: a.date_range_start,
        dateRangeEnd: a.date_range_end,
        fileSize: a.file_size,
        fileLocation: a.file_location,
        compressed: a.compressed,
        checksumSHA256: a.checksum_sha256,
        verifiedAt: a.verified_at,
        restoredAt: a.restored_at,
        createdBy: a.created_by,
      }));
    } catch (error) {
      logger.error('Failed to list archives', error);
      throw new AppError('Failed to list archives', 500);
    }
  }
}

export default AuditRetentionService;
