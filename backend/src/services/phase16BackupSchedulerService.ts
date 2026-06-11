import type { Knex } from 'knex';
import * as cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

/**
 * Phase 16.1: Automated Backup System
 * 
 * Handles cron-based backup scheduling, automated execution, and retention policy enforcement.
 * Creates both full and incremental backups on a configurable schedule.
 */

interface BackupScheduleConfig {
  cronExpression: string;
  backupType: 'full' | 'incremental';
  retentionDays: number;
  maxConcurrentBackups: number;
  enabled: boolean;
}

interface BackupTaskConfig {
  tenantId: string;
  createdBy: string;
  backupType: 'full' | 'incremental';
}

interface ScheduledBackupJob {
  tenantId: string;
  task: cron.ScheduledTask;
  config: BackupScheduleConfig;
}

export class BackupSchedulerService {
  private db: Knex;
  private scheduledJobs: Map<string, ScheduledBackupJob> = new Map();
  private activeBackups: Map<string, number> = new Map();

  /**
   * Initializes the backup scheduler service
   * @param database - Knex database instance
   */
  constructor(database: Knex) {
    this.db = database;
    logger.info('BackupSchedulerService initialized');
  }

  /**
   * Initializes backup scheduling for all active tenants
   * Should be called on application startup
   */
  async initializeSchedules(): Promise<void> {
    try {
      logger.info('Initializing backup schedules for all tenants');

      const schedules = await this.db('backup_schedule')
        .where('enabled', true)
        .select('*');

      for (const schedule of schedules) {
        await this.scheduleBackup(schedule.tenant_id);
      }

      logger.info(`Initialized ${schedules.length} backup schedules`);
    } catch (error) {
      logger.error('Error initializing backup schedules', error);
      throw new AppError('Failed to initialize backup schedules', 500, error);
    }
  }

  /**
   * Schedules automated backups for a specific tenant
   * @param tenantId - Tenant ID to schedule backups for
   */
  async scheduleBackup(tenantId: string): Promise<void> {
    try {
      // Check if already scheduled
      if (this.scheduledJobs.has(tenantId)) {
        throw new AppError(`Backup schedule already exists for tenant ${tenantId}`, 400);
      }

      // Get or create schedule configuration
      let schedule = await this.db('backup_schedule')
        .where('tenant_id', tenantId)
        .first();

      if (!schedule) {
        schedule = await this.createDefaultSchedule(tenantId);
      }

      // Create and schedule the cron job
      const task = cron.schedule(schedule.cron_expression, async () => {
        await this.executeBackup(tenantId);
      });

      // Store the scheduled job
      this.scheduledJobs.set(tenantId, {
        tenantId,
        task,
        config: {
          cronExpression: schedule.cron_expression,
          backupType: schedule.backup_type,
          retentionDays: schedule.retention_days,
          maxConcurrentBackups: schedule.max_concurrent_backups,
          enabled: schedule.enabled,
        },
      });

      logger.info(`Backup scheduled for tenant ${tenantId} with cron: ${schedule.cron_expression}`);
    } catch (error) {
      logger.error(`Error scheduling backup for tenant ${tenantId}`, error);
      throw new AppError(`Failed to schedule backup for tenant ${tenantId}`, 500, error);
    }
  }

  /**
   * Executes a backup for a specific tenant
   * @param tenantId - Tenant ID to backup
   */
  async executeBackup(tenantId: string): Promise<string> {
    const backupId = uuidv4();
    const operationId = `backup-${tenantId}-${Date.now()}`;

    try {
      // Get schedule config
      const schedule = await this.db('backup_schedule')
        .where('tenant_id', tenantId)
        .first();

      if (!schedule || !schedule.enabled) {
        logger.warn(`Backup schedule not found or disabled for tenant ${tenantId}`);
        return '';
      }

      // Check concurrent backup limit
      const activeCount = this.activeBackups.get(tenantId) || 0;
      if (activeCount >= schedule.max_concurrent_backups) {
        logger.warn(
          `Max concurrent backups (${schedule.max_concurrent_backups}) reached for tenant ${tenantId}`
        );
        throw new AppError(
          `Max concurrent backups reached for tenant ${tenantId}`,
          429
        );
      }

      // Track active backup
      this.activeBackups.set(tenantId, activeCount + 1);

      // Create backup record
      const backup = await this.createBackup(tenantId, schedule.backup_type);

      // Log backup started
      await this.logBackupOperation(backup.id, 'backup_started', 'success', 'Backup started');

      logger.info(`Backup started for tenant ${tenantId} (ID: ${backup.id})`);

      return backup.id;
    } catch (error) {
      logger.error(`Error executing backup for tenant ${tenantId}`, error);

      // Log error
      try {
        await this.logBackupError(tenantId, operationId, error);
      } catch (logError) {
        logger.error('Failed to log backup error', logError);
      }

      throw error;
    } finally {
      // Decrement active backup count
      const activeCount = this.activeBackups.get(tenantId) || 0;
      if (activeCount > 0) {
        this.activeBackups.set(tenantId, activeCount - 1);
      }
    }
  }

  /**
   * Creates a new backup record
   * @param tenantId - Tenant ID
   * @param type - Backup type (full or incremental)
   * @returns Backup record
   */
  private async createBackup(
    tenantId: string,
    type: 'full' | 'incremental'
  ): Promise<any> {
    const backupId = `backup-${tenantId}-${Date.now()}`;
    const storagePath = this.generateStoragePath(tenantId, backupId);

    const backup = await this.db('backups')
      .insert({
        id: uuidv4(),
        tenant_id: tenantId,
        backup_id: backupId,
        type,
        status: 'in_progress',
        storage_path: storagePath,
        started_at: new Date(),
        created_by: 'system', // System-initiated backup
      })
      .returning('*');

    return backup[0];
  }

  /**
   * Completes a backup operation
   * @param backupId - Backup ID
   * @param size - Backup size in bytes
   * @param checksum - Data checksum
   * @param recordCount - Total records backed up
   */
  async completeBackup(
    backupId: string,
    size: number,
    checksum: string,
    recordCount: number
  ): Promise<void> {
    try {
      const backup = await this.db('backups')
        .where('id', backupId)
        .first();

      if (!backup) {
        throw new AppError(`Backup ${backupId} not found`, 404);
      }

      // Update backup record
      await this.db('backups')
        .where('id', backupId)
        .update({
          status: 'completed',
          completed_at: new Date(),
          size,
        });

      // Create backup metadata
      await this.db('backup_metadata')
        .insert({
          id: uuidv4(),
          backup_id: backupId,
          data_checksum: checksum,
          record_count: recordCount,
          version: '1.0',
        });

      // Log completion
      await this.logBackupOperation(
        backupId,
        'backup_completed',
        'success',
        `Backup completed. Size: ${this.formatBytes(size)}, Records: ${recordCount}`
      );

      logger.info(`Backup ${backupId} completed successfully`);

      // Enforce retention policy
      await this.enforceRetentionPolicy(backup.tenant_id);
    } catch (error) {
      logger.error(`Error completing backup ${backupId}`, error);
      throw new AppError(`Failed to complete backup ${backupId}`, 500, error);
    }
  }

  /**
   * Fails a backup operation
   * @param backupId - Backup ID
   * @param errorMessage - Error message
   */
  async failBackup(backupId: string, errorMessage: string): Promise<void> {
    try {
      const backup = await this.db('backups')
        .where('id', backupId)
        .first();

      if (!backup) {
        throw new AppError(`Backup ${backupId} not found`, 404);
      }

      // Update backup record
      await this.db('backups')
        .where('id', backupId)
        .update({
          status: 'failed',
          completed_at: new Date(),
          error_message: errorMessage,
        });

      // Log failure
      await this.logBackupOperation(
        backupId,
        'backup_failed',
        'failed',
        errorMessage
      );

      logger.error(`Backup ${backupId} failed: ${errorMessage}`);
    } catch (error) {
      logger.error(`Error failing backup ${backupId}`, error);
      throw new AppError(`Failed to update backup status ${backupId}`, 500, error);
    }
  }

  /**
   * Enforces retention policy for tenant backups
   * Deletes backups older than retention period
   * @param tenantId - Tenant ID
   */
  private async enforceRetentionPolicy(tenantId: string): Promise<void> {
    try {
      const schedule = await this.db('backup_schedule')
        .where('tenant_id', tenantId)
        .first();

      if (!schedule) {
        return;
      }

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() - schedule.retention_days);

      // Find and delete expired backups
      const expiredBackups = await this.db('backups')
        .where('tenant_id', tenantId)
        .where('created_at', '<', expiryDate)
        .where('status', 'completed')
        .select('id', 'storage_path');

      for (const backup of expiredBackups) {
        try {
          // Update expiry date
          await this.db('backups')
            .where('id', backup.id)
            .update({
              expires_at: new Date(),
              status: 'expired',
            });

          logger.info(`Marked backup ${backup.id} as expired (retention policy)`);
        } catch (error) {
          logger.error(`Error marking backup ${backup.id} as expired`, error);
        }
      }

      logger.info(`Retention policy enforced for tenant ${tenantId}. Expired ${expiredBackups.length} backups`);
    } catch (error) {
      logger.error(`Error enforcing retention policy for tenant ${tenantId}`, error);
      throw new AppError(`Failed to enforce retention policy`, 500, error);
    }
  }

  /**
   * Updates the backup schedule for a tenant
   * @param tenantId - Tenant ID
   * @param config - New schedule configuration
   */
  async updateSchedule(
    tenantId: string,
    config: Partial<BackupScheduleConfig>
  ): Promise<void> {
    try {
      // Validate cron expression if provided
      if (config.cronExpression) {
        if (!cron.validate(config.cronExpression)) {
          throw new AppError('Invalid cron expression', 400);
        }
      }

      // Update or create schedule
      const existingSchedule = await this.db('backup_schedule')
        .where('tenant_id', tenantId)
        .first();

      if (existingSchedule) {
        await this.db('backup_schedule')
          .where('tenant_id', tenantId)
          .update({
            ...config,
            updated_at: new Date(),
          });
      } else {
        await this.db('backup_schedule')
          .insert({
            id: uuidv4(),
            tenant_id: tenantId,
            cron_expression: config.cronExpression || '0 2 * * *',
            backup_type: config.backupType || 'full',
            retention_days: config.retentionDays || 30,
            max_concurrent_backups: config.maxConcurrentBackups || 1,
            enabled: config.enabled !== undefined ? config.enabled : true,
          });
      }

      // Reschedule if already scheduled
      if (this.scheduledJobs.has(tenantId)) {
        this.unscheduleBackup(tenantId);
        await this.scheduleBackup(tenantId);
      }

      logger.info(`Backup schedule updated for tenant ${tenantId}`);
    } catch (error) {
      logger.error(`Error updating backup schedule for tenant ${tenantId}`, error);
      throw new AppError(`Failed to update backup schedule`, 500, error);
    }
  }

  /**
   * Gets the backup schedule for a tenant
   * @param tenantId - Tenant ID
   * @returns Backup schedule configuration
   */
  async getSchedule(tenantId: string): Promise<BackupScheduleConfig | null> {
    try {
      const schedule = await this.db('backup_schedule')
        .where('tenant_id', tenantId)
        .first();

      if (!schedule) {
        return null;
      }

      return {
        cronExpression: schedule.cron_expression,
        backupType: schedule.backup_type,
        retentionDays: schedule.retention_days,
        maxConcurrentBackups: schedule.max_concurrent_backups,
        enabled: schedule.enabled,
      };
    } catch (error) {
      logger.error(`Error retrieving backup schedule for tenant ${tenantId}`, error);
      throw new AppError(`Failed to retrieve backup schedule`, 500, error);
    }
  }

  /**
   * Unschedules backups for a tenant
   * @param tenantId - Tenant ID
   */
  unscheduleBackup(tenantId: string): void {
    const job = this.scheduledJobs.get(tenantId);
    if (job) {
      job.task.stop();
      this.scheduledJobs.delete(tenantId);
      logger.info(`Backup unscheduled for tenant ${tenantId}`);
    }
  }

  /**
   * Gets list of scheduled backup jobs
   * @returns Array of scheduled jobs
   */
  getScheduledJobs(): Array<{
    tenantId: string;
    cron: string;
    enabled: boolean;
  }> {
    const jobs: Array<any> = [];
    this.scheduledJobs.forEach((job) => {
      jobs.push({
        tenantId: job.tenantId,
        cron: job.config.cronExpression,
        enabled: job.config.enabled,
      });
    });
    return jobs;
  }

  /**
   * Logs a backup operation
   * @param backupId - Backup ID
   * @param action - Action name
   * @param status - Operation status
   * @param message - Status message
   */
  private async logBackupOperation(
    backupId: string,
    action: string,
    status: 'success' | 'failed' | 'warning',
    message: string
  ): Promise<void> {
    try {
      await this.db('backup_logs')
        .insert({
          id: uuidv4(),
          backup_id: backupId,
          action,
          status,
          message,
        });
    } catch (error) {
      logger.error(`Error logging backup operation for backup ${backupId}`, error);
    }
  }

  /**
   * Logs a backup error
   * @param tenantId - Tenant ID
   * @param operationId - Operation ID
   * @param error - Error object
   */
  private async logBackupError(
    tenantId: string,
    operationId: string,
    error: any
  ): Promise<void> {
    try {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        `Backup error for tenant ${tenantId} (operation ${operationId}): ${errorMessage}`
      );
    } catch (logError) {
      logger.error('Error logging backup error', logError);
    }
  }

  /**
   * Creates default schedule for a tenant
   * @param tenantId - Tenant ID
   * @returns Default schedule
   */
  private async createDefaultSchedule(tenantId: string): Promise<any> {
    const schedule = await this.db('backup_schedule')
      .insert({
        id: uuidv4(),
        tenant_id: tenantId,
        cron_expression: '0 2 * * *', // Daily at 2 AM
        backup_type: 'full',
        retention_days: 30,
        max_concurrent_backups: 1,
        enabled: true,
      })
      .returning('*');

    return schedule[0];
  }

  /**
   * Generates storage path for backup
   * @param tenantId - Tenant ID
   * @param backupId - Backup ID
   * @returns Storage path
   */
  private generateStoragePath(tenantId: string, backupId: string): string {
    const timestamp = new Date().toISOString().slice(0, 10);
    return `/backups/${tenantId}/${timestamp}/${backupId}`;
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

  /**
   * Stops all scheduled jobs
   * Should be called on application shutdown
   */
  stopAllSchedules(): void {
    this.scheduledJobs.forEach((job) => {
      job.task.stop();
    });
    this.scheduledJobs.clear();
    logger.info('All backup schedules stopped');
  }
}

export default BackupSchedulerService;
