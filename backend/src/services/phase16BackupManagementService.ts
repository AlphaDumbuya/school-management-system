import type { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

/**
 * Phase 16.4: Backup Management System
 * 
 * Handles backup listing, viewing, deletion, downloading, and storage management.
 * Provides comprehensive backup administration interface.
 */

interface BackupInfo {
  id: string;
  backupId: string;
  type: 'full' | 'incremental';
  status: string;
  size: number;
  createdAt: Date;
  completedAt?: Date;
  expiresAt?: Date;
  storePath: string;
  verified: boolean;
}

interface StorageStats {
  totalSize: number;
  backupCount: number;
  oldestBackupDate?: Date;
  newestBackupDate?: Date;
  usagePercentage: number;
}

export class BackupManagementService {
  private db: Knex;
  private maxStorageSize: number = 100 * 1024 * 1024 * 1024; // 100 GB default

  /**
   * Initializes the backup management service
   * @param database - Knex database instance
   * @param maxStorageSize - Maximum storage size in bytes (optional)
   */
  constructor(database: Knex, maxStorageSize?: number) {
    this.db = database;
    if (maxStorageSize) {
      this.maxStorageSize = maxStorageSize;
    }
    logger.info('BackupManagementService initialized');
  }

  /**
   * Lists all backups for a tenant
   * @param tenantId - Tenant ID
   * @param status - Filter by status (optional)
   * @param limit - Maximum number of backups to return
   * @param offset - Pagination offset
   * @returns Array of backup information
   */
  async listBackups(
    tenantId: string,
    status?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    try {
      let query = this.db('backups')
        .where('tenant_id', tenantId);

      if (status) {
        query = query.where('status', status);
      }

      const backups = await query
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .select();

      // Enrich with metadata
      const enriched = await Promise.all(
        backups.map(async (backup) => {
          const metadata = await this.db('backup_metadata')
            .where('backup_id', backup.id)
            .first();

          return {
            id: backup.id,
            backupId: backup.backup_id,
            type: backup.type,
            status: backup.status,
            size: this.formatBytes(backup.size),
            sizeBytes: backup.size,
            createdAt: backup.created_at,
            completedAt: backup.completed_at,
            expiresAt: backup.expires_at,
            storagePath: backup.storage_path,
            verified: !!metadata?.verified_at,
            recordCount: metadata?.record_count || 0,
            checksum: metadata?.data_checksum,
          };
        })
      );

      logger.info(
        `Listed ${enriched.length} backups for tenant ${tenantId}`
      );

      return enriched;
    } catch (error) {
      logger.error(`Error listing backups for tenant ${tenantId}`, error);
      throw new AppError(`Failed to list backups`, 500, error);
    }
  }

  /**
   * Gets details for a specific backup
   * @param backupId - Backup ID
   * @param tenantId - Tenant ID (for authorization)
   * @returns Detailed backup information
   */
  async getBackupDetails(backupId: string, tenantId: string): Promise<any> {
    try {
      const backup = await this.db('backups')
        .where('id', backupId)
        .where('tenant_id', tenantId)
        .first();

      if (!backup) {
        throw new AppError(`Backup ${backupId} not found`, 404);
      }

      // Get metadata
      const metadata = await this.db('backup_metadata')
        .where('backup_id', backupId)
        .first();

      // Get logs
      const logs = await this.db('backup_logs')
        .where('backup_id', backupId)
        .orderBy('created_at', 'desc')
        .select();

      // Get restore history
      const restores = await this.db('backup_restores')
        .where('backup_id', backupId)
        .orderBy('created_at', 'desc')
        .select();

      return {
        id: backup.id,
        backupId: backup.backup_id,
        type: backup.type,
        status: backup.status,
        size: this.formatBytes(backup.size),
        sizeBytes: backup.size,
        createdAt: backup.created_at,
        completedAt: backup.completed_at,
        expiresAt: backup.expires_at,
        storagePath: backup.storage_path,
        errorMessage: backup.error_message,
        createdBy: backup.created_by,
        metadata: metadata ? {
          recordCount: metadata.record_count,
          checksum: metadata.data_checksum,
          version: metadata.version,
          verifiedAt: metadata.verified_at,
          tableStats: metadata.table_stats,
          encrypted: metadata.encrypted,
        } : null,
        logs,
        restores,
      };
    } catch (error) {
      logger.error(
        `Error getting backup details for backup ${backupId}`,
        error
      );
      throw error instanceof AppError
        ? error
        : new AppError(`Failed to get backup details`, 500, error);
    }
  }

  /**
   * Deletes a backup
   * @param backupId - Backup ID to delete
   * @param tenantId - Tenant ID (for authorization)
   * @returns Deletion result
   */
  async deleteBackup(backupId: string, tenantId: string): Promise<void> {
    try {
      const backup = await this.db('backups')
        .where('id', backupId)
        .where('tenant_id', tenantId)
        .first();

      if (!backup) {
        throw new AppError(`Backup ${backupId} not found`, 404);
      }

      // Check if backup is in use (active restore)
      const activeRestore = await this.db('backup_restores')
        .where('backup_id', backupId)
        .where('status', 'in_progress')
        .first();

      if (activeRestore) {
        throw new AppError(
          'Cannot delete backup while restore is in progress',
          409
        );
      }

      // Delete backup metadata
      await this.db('backup_metadata')
        .where('backup_id', backupId)
        .delete();

      // Delete backup logs
      await this.db('backup_logs')
        .where('backup_id', backupId)
        .delete();

      // Delete backup restores
      await this.db('backup_restores')
        .where('backup_id', backupId)
        .delete();

      // Delete backup record
      await this.db('backups')
        .where('id', backupId)
        .delete();

      logger.info(`Backup ${backupId} deleted successfully`);
    } catch (error) {
      logger.error(`Error deleting backup ${backupId}`, error);
      throw error instanceof AppError
        ? error
        : new AppError(`Failed to delete backup`, 500, error);
    }
  }

  /**
   * Downloads backup file
   * @param backupId - Backup ID
   * @param tenantId - Tenant ID (for authorization)
   * @returns Backup file information
   */
  async downloadBackup(
    backupId: string,
    tenantId: string
  ): Promise<{
    filename: string;
    path: string;
    size: number;
  }> {
    try {
      const backup = await this.db('backups')
        .where('id', backupId)
        .where('tenant_id', tenantId)
        .first();

      if (!backup) {
        throw new AppError(`Backup ${backupId} not found`, 404);
      }

      if (backup.status !== 'completed' && backup.status !== 'verified') {
        throw new AppError(
          'Can only download completed or verified backups',
          400
        );
      }

      // Log download
      await this.db('backup_logs')
        .insert({
          id: uuidv4(),
          backup_id: backupId,
          action: 'backup_downloaded',
          status: 'success',
          message: `Backup downloaded by user`,
        });

      logger.info(`Backup ${backupId} download initiated`);

      return {
        filename: `${backup.backup_id}.backup`,
        path: backup.storage_path,
        size: backup.size,
      };
    } catch (error) {
      logger.error(`Error downloading backup ${backupId}`, error);
      throw error instanceof AppError
        ? error
        : new AppError(`Failed to download backup`, 500, error);
    }
  }

  /**
   * Gets storage statistics for a tenant
   * @param tenantId - Tenant ID
   * @returns Storage statistics
   */
  async getStorageStats(tenantId: string): Promise<StorageStats> {
    try {
      // Get or create storage stats record
      let stats = await this.db('backup_storage_stats')
        .where('tenant_id', tenantId)
        .first();

      if (!stats || this.isStatsStale(stats.calculated_at)) {
        stats = await this.calculateStorageStats(tenantId);
      }

      return {
        totalSize: stats.total_size,
        backupCount: stats.backup_count,
        oldestBackupDate: stats.oldest_backup_date
          ? new Date(stats.oldest_backup_date)
          : undefined,
        newestBackupDate: stats.newest_backup_date
          ? new Date(stats.newest_backup_date)
          : undefined,
        usagePercentage: stats.usage_percentage,
      };
    } catch (error) {
      logger.error(
        `Error getting storage stats for tenant ${tenantId}`,
        error
      );
      throw new AppError(`Failed to get storage stats`, 500, error);
    }
  }

  /**
   * Calculates storage statistics
   * @param tenantId - Tenant ID
   * @returns Updated storage statistics
   */
  private async calculateStorageStats(tenantId: string): Promise<any> {
    try {
      // Get all backups for tenant
      const backups = await this.db('backups')
        .where('tenant_id', tenantId)
        .where('status', '!=', 'expired')
        .select('size', 'created_at');

      // Calculate totals
      const totalSize = backups.reduce((sum, b) => sum + (b.size || 0), 0);
      const backupCount = backups.length;

      let oldestBackupDate = null;
      let newestBackupDate = null;

      if (backups.length > 0) {
        oldestBackupDate = Math.min(...backups.map(b => b.created_at.getTime()));
        newestBackupDate = Math.max(...backups.map(b => b.created_at.getTime()));
      }

      const usagePercentage = Math.round(
        (totalSize / this.maxStorageSize) * 100
      );

      // Update or create storage stats record
      const existing = await this.db('backup_storage_stats')
        .where('tenant_id', tenantId)
        .first();

      if (existing) {
        await this.db('backup_storage_stats')
          .where('tenant_id', tenantId)
          .update({
            total_size: totalSize,
            backup_count: backupCount,
            oldest_backup_date: oldestBackupDate,
            newest_backup_date: newestBackupDate,
            usage_percentage: usagePercentage,
            calculated_at: new Date(),
          });
      } else {
        await this.db('backup_storage_stats')
          .insert({
            id: uuidv4(),
            tenant_id: tenantId,
            total_size: totalSize,
            backup_count: backupCount,
            oldest_backup_date: oldestBackupDate,
            newest_backup_date: newestBackupDate,
            usage_percentage: usagePercentage,
          });
      }

      logger.info(
        `Storage stats calculated for tenant ${tenantId}: ${this.formatBytes(totalSize)} (${usagePercentage}%)`
      );

      return {
        total_size: totalSize,
        backup_count: backupCount,
        oldest_backup_date: oldestBackupDate,
        newest_backup_date: newestBackupDate,
        usage_percentage: usagePercentage,
      };
    } catch (error) {
      logger.error(
        `Error calculating storage stats for tenant ${tenantId}`,
        error
      );
      throw new AppError(`Failed to calculate storage stats`, 500, error);
    }
  }

  /**
   * Gets backup logs
   * @param backupId - Backup ID
   * @param limit - Maximum number of logs to return
   * @returns Array of backup logs
   */
  async getBackupLogs(
    backupId: string,
    limit: number = 100
  ): Promise<any[]> {
    try {
      const logs = await this.db('backup_logs')
        .where('backup_id', backupId)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .select();

      return logs;
    } catch (error) {
      logger.error(
        `Error getting backup logs for backup ${backupId}`,
        error
      );
      throw new AppError(`Failed to get backup logs`, 500, error);
    }
  }

  /**
   * Searches backups by various criteria
   * @param tenantId - Tenant ID
   * @param criteria - Search criteria
   * @returns Array of matching backups
   */
  async searchBackups(
    tenantId: string,
    criteria: {
      type?: string;
      status?: string;
      dateFrom?: Date;
      dateTo?: Date;
      minSize?: number;
      maxSize?: number;
    }
  ): Promise<any[]> {
    try {
      let query = this.db('backups')
        .where('tenant_id', tenantId);

      if (criteria.type) {
        query = query.where('type', criteria.type);
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

      if (criteria.minSize !== undefined) {
        query = query.where('size', '>=', criteria.minSize);
      }

      if (criteria.maxSize !== undefined) {
        query = query.where('size', '<=', criteria.maxSize);
      }

      const backups = await query
        .orderBy('created_at', 'desc')
        .select();

      return backups;
    } catch (error) {
      logger.error(
        `Error searching backups for tenant ${tenantId}`,
        error
      );
      throw new AppError(`Failed to search backups`, 500, error);
    }
  }

  /**
   * Gets backup retention policy
   * @param tenantId - Tenant ID
   * @returns Retention policy details
   */
  async getRetentionPolicy(tenantId: string): Promise<any> {
    try {
      const schedule = await this.db('backup_schedule')
        .where('tenant_id', tenantId)
        .first();

      if (!schedule) {
        return {
          retentionDays: 30,
          autoDelete: true,
        };
      }

      return {
        retentionDays: schedule.retention_days,
        autoDelete: true,
        maxConcurrentBackups: schedule.max_concurrent_backups,
      };
    } catch (error) {
      logger.error(
        `Error getting retention policy for tenant ${tenantId}`,
        error
      );
      throw new AppError(`Failed to get retention policy`, 500, error);
    }
  }

  /**
   * Exports backup metadata as CSV
   * @param tenantId - Tenant ID
   * @returns CSV content
   */
  async exportBackupMetadata(tenantId: string): Promise<string> {
    try {
      const backups = await this.db('backups')
        .where('tenant_id', tenantId)
        .orderBy('created_at', 'desc')
        .select();

      // Build CSV
      const headers = [
        'Backup ID',
        'Type',
        'Status',
        'Size (MB)',
        'Created',
        'Completed',
        'Expires',
        'Verified',
      ];

      const rows = await Promise.all(
        backups.map(async (backup) => {
          const metadata = await this.db('backup_metadata')
            .where('backup_id', backup.id)
            .first();

          return [
            backup.backup_id,
            backup.type,
            backup.status,
            (backup.size / (1024 * 1024)).toFixed(2),
            backup.created_at.toISOString(),
            backup.completed_at?.toISOString() || 'N/A',
            backup.expires_at?.toISOString() || 'N/A',
            metadata?.verified_at ? 'Yes' : 'No',
          ];
        })
      );

      // Combine headers and rows
      const csv = [
        headers.join(','),
        ...rows.map((row) =>
          row.map((cell) => `"${cell}"`).join(',')
        ),
      ].join('\n');

      logger.info(`Exported backup metadata for tenant ${tenantId}`);

      return csv;
    } catch (error) {
      logger.error(
        `Error exporting backup metadata for tenant ${tenantId}`,
        error
      );
      throw new AppError(`Failed to export backup metadata`, 500, error);
    }
  }

  /**
   * Gets cleanup recommendations
   * @param tenantId - Tenant ID
   * @returns Cleanup recommendations
   */
  async getCleanupRecommendations(tenantId: string): Promise<any[]> {
    try {
      const recommendations: any[] = [];

      // Get storage stats
      const stats = await this.getStorageStats(tenantId);

      // Check storage usage
      if (stats.usagePercentage > 80) {
        recommendations.push({
          type: 'high_storage_usage',
          severity: 'warning',
          message: `Storage usage is ${stats.usagePercentage}%. Consider deleting old backups.`,
          action: 'delete_old_backups',
        });
      }

      // Check for failed backups
      const failedBackups = await this.db('backups')
        .where('tenant_id', tenantId)
        .where('status', 'failed')
        .select();

      if (failedBackups.length > 5) {
        recommendations.push({
          type: 'failed_backups',
          severity: 'info',
          message: `You have ${failedBackups.length} failed backups. Consider deleting them.`,
          action: 'delete_failed_backups',
        });
      }

      // Check for unverified backups
      const unverifiedResult = await this.db('backups')
        .where('tenant_id', tenantId)
        .where('status', 'completed')
        .whereNotExists((qb) => {
          qb.select('*')
            .from('backup_metadata')
            .whereRaw('backup_metadata.backup_id = backups.id')
            .where('backup_metadata.verified_at', '!=', null);
        })
        .count('* as count')
        .first() as { count: string | number } | undefined;
      const unverifiedCount = unverifiedResult ? parseInt(String(unverifiedResult.count)) || 0 : 0;

      if (unverifiedCount > 0) {
        recommendations.push({
          type: 'unverified_backups',
          severity: 'warning',
          message: `You have ${unverifiedCount} unverified backups. Consider verifying them.`,
          action: 'verify_backups',
        });
      }

      return recommendations;
    } catch (error) {
      logger.error(
        `Error getting cleanup recommendations for tenant ${tenantId}`,
        error
      );
      throw new AppError(`Failed to get cleanup recommendations`, 500, error);
    }
  }

  /**
   * Checks if storage stats are stale
   * @param lastCalculated - Last calculation timestamp
   * @returns true if stale, false otherwise
   */
  private isStatsStale(lastCalculated: Date): boolean {
    const ONE_HOUR = 60 * 60 * 1000;
    return Date.now() - lastCalculated.getTime() > ONE_HOUR;
  }

  /**
   * Formats bytes to human readable format
   * @param bytes - Number of bytes
   * @returns Formatted string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

export default BackupManagementService;
