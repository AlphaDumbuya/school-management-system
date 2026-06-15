import type { Express, Request, Response, NextFunction } from 'express';
import type { Knex } from 'knex';
import { BackupSchedulerService } from '@services/phase16BackupSchedulerService';
import { BackupVerificationService } from '@services/phase16BackupVerificationService';
import { BackupRestoreService } from '@services/phase16BackupRestoreService';
import { BackupManagementService } from '@services/phase16BackupManagementService';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

/**
 * Phase 16: Backup and Disaster Recovery Routes
 * 
 * Implements all backup management endpoints for scheduling, verification,
 * restoration, and administration.
 */

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    tenantId: string;
    email: string;
    role: string;
  };
}

export function registerPhase16Routes(app: Express, db: Knex): void {
  // Initialize services
  const schedulerService = new BackupSchedulerService(db);
  const verificationService = new BackupVerificationService(db);
  const restoreService = new BackupRestoreService(db);
  const managementService = new BackupManagementService(db);

  // Middleware to ensure user is authenticated and is admin
  const requireAuth = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    next();
  };

  const requireAdmin = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }
    if (req.user.role !== 'principal' && req.user.role !== 'super_admin') {
      throw new AppError('Principal or Super Admin access required', 403);
    }
    next();
  };

  /**
   * POST /api/v1/backup/create
   * Manually create a backup
   */
  app.post(
    '/api/v1/backup/create',
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { tenantId, type = 'full' } = req.body;

        if (!tenantId || !req.user) {
          throw new AppError('Invalid request parameters', 400);
        }

        // Verify tenant access
        if (req.user.tenantId !== tenantId && req.user.role !== 'super_admin') {
          throw new AppError('Tenant access denied', 403);
        }

        // Execute backup
        const backupId = await schedulerService.executeBackup(tenantId);

        logger.info(
          `Manual backup created for tenant ${tenantId} by user ${req.user.id}`
        );

        res.status(201).json({
          success: true,
          message: 'Backup created successfully',
          data: {
            backupId,
            type,
            status: 'in_progress',
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/backup/list
   * List all backups for a tenant
   */
  app.get(
    '/api/v1/backup/list',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { status, limit = '50', offset = '0' } = req.query;

        if (!req.user) {
          throw new AppError('Authentication required', 401);
        }

        const backups = await managementService.listBackups(
          req.user.tenantId,
          status as string | undefined,
          parseInt(limit as string),
          parseInt(offset as string)
        );

        res.json({
          success: true,
          data: backups,
          pagination: {
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
            total: backups.length,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/backup/:id
   * Get backup details
   */
  app.get(
    '/api/v1/backup/:id',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;

        if (!req.user) {
          throw new AppError('Authentication required', 401);
        }

        const backup = await managementService.getBackupDetails(
          id,
          req.user.tenantId
        );

        res.json({
          success: true,
          data: backup,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/v1/backup/:id/verify
   * Verify backup integrity
   */
  app.post(
    '/api/v1/backup/:id/verify',
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;

        if (!req.user) {
          throw new AppError('Authentication required', 401);
        }

        const result = await verificationService.verifyBackup(id);

        res.json({
          success: true,
          message: 'Backup verification initiated',
          data: result,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/v1/backup/:id/restore
   * Start backup restoration
   */
  app.post(
    '/api/v1/backup/:id/restore',
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;

        if (!req.user) {
          throw new AppError('Authentication required', 401);
        }

        const restore = await restoreService.initiateRestore(
          id,
          req.user.tenantId,
          req.user.id
        );

        // Start restoration in background
        restoreService
          .restoreData(id, id, req.user.tenantId)
          .catch((error) => {
            logger.error('Background restore failed', error);
          });

        logger.info(
          `Restore initiated for backup ${id} by user ${req.user.id}`
        );

        res.status(201).json({
          success: true,
          message: 'Restore operation started',
          data: restore,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/backup/restore/:restoreId
   * Get restore operation status
   */
  app.get(
    '/api/v1/backup/restore/:restoreId',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { restoreId } = req.params;

        if (!req.user) {
          throw new AppError('Authentication required', 401);
        }

        const progress = await restoreService.getRestoreProgress(restoreId);

        res.json({
          success: true,
          data: progress,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * DELETE /api/v1/backup/:id
   * Delete a backup
   */
  app.delete(
    '/api/v1/backup/:id',
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;

        if (!req.user) {
          throw new AppError('Authentication required', 401);
        }

        await managementService.deleteBackup(id, req.user.tenantId);

        logger.info(
          `Backup ${id} deleted by user ${req.user.id}`
        );

        res.json({
          success: true,
          message: 'Backup deleted successfully',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/backup/schedule
   * Get backup schedule configuration
   */
  app.get(
    '/api/v1/backup/schedule',
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          throw new AppError('Authentication required', 401);
        }

        const schedule = await schedulerService.getSchedule(req.user.tenantId);

        res.json({
          success: true,
          data: schedule || {
            cronExpression: '0 2 * * *',
            backupType: 'full',
            retentionDays: 30,
            maxConcurrentBackups: 1,
            enabled: true,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * PUT /api/v1/backup/schedule
   * Update backup schedule configuration
   */
  app.put(
    '/api/v1/backup/schedule',
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const {
          cronExpression,
          backupType,
          retentionDays,
          maxConcurrentBackups,
          enabled,
        } = req.body;

        if (!req.user) {
          throw new AppError('Authentication required', 401);
        }

        await schedulerService.updateSchedule(req.user.tenantId, {
          cronExpression,
          backupType,
          retentionDays,
          maxConcurrentBackups,
          enabled,
        });

        logger.info(
          `Backup schedule updated for tenant ${req.user.tenantId} by user ${req.user.id}`
        );

        res.json({
          success: true,
          message: 'Backup schedule updated successfully',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/backup/storage-usage
   * Get storage utilization statistics
   */
  app.get(
    '/api/v1/backup/storage-usage',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          throw new AppError('Authentication required', 401);
        }

        const stats = await managementService.getStorageStats(
          req.user.tenantId
        );

        res.json({
          success: true,
          data: stats,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/v1/backup/:id/download
   * Download backup file
   */
  app.post(
    '/api/v1/backup/:id/download',
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;

        if (!req.user) {
          throw new AppError('Authentication required', 401);
        }

        const backupInfo = await managementService.downloadBackup(
          id,
          req.user.tenantId
        );

        logger.info(
          `Backup ${id} download prepared for user ${req.user.id}`
        );

        res.json({
          success: true,
          message: 'Backup ready for download',
          data: {
            filename: backupInfo.filename,
            size: backupInfo.size,
            downloadUrl: `/api/v1/backup/${id}/file`,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/backup/logs
   * Get backup logs
   */
  app.get(
    '/api/v1/backup/logs',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { backupId, limit = '100' } = req.query;

        if (!backupId) {
          throw new AppError('backupId is required', 400);
        }

        const logs = await managementService.getBackupLogs(
          backupId as string,
          parseInt(limit as string)
        );

        res.json({
          success: true,
          data: logs,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/v1/backup/search
   * Search backups by criteria
   */
  app.post(
    '/api/v1/backup/search',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { type, status, dateFrom, dateTo, minSize, maxSize } = req.body;

        if (!req.user) {
          throw new AppError('Authentication required', 401);
        }

        const results = await managementService.searchBackups(
          req.user.tenantId,
          {
            type,
            status,
            dateFrom: dateFrom ? new Date(dateFrom) : undefined,
            dateTo: dateTo ? new Date(dateTo) : undefined,
            minSize,
            maxSize,
          }
        );

        res.json({
          success: true,
          data: results,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/backup/export
   * Export backup metadata as CSV
   */
  app.get(
    '/api/v1/backup/export',
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          throw new AppError('Authentication required', 401);
        }

        const csv = await managementService.exportBackupMetadata(
          req.user.tenantId
        );

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="backups.csv"'
        );
        res.send(csv);

        logger.info(
          `Backup metadata exported for tenant ${req.user.tenantId} by user ${req.user.id}`
        );
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/backup/recommendations
   * Get cleanup recommendations
   */
  app.get(
    '/api/v1/backup/recommendations',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          throw new AppError('Authentication required', 401);
        }

        const recommendations =
          await managementService.getCleanupRecommendations(
            req.user.tenantId
          );

        res.json({
          success: true,
          data: recommendations,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/v1/backup/:restoreId/rollback
   * Rollback a restore operation
   */
  app.post(
    '/api/v1/backup/:restoreId/rollback',
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { restoreId } = req.params;
        const { reason } = req.body;

        if (!req.user) {
          throw new AppError('Authentication required', 401);
        }

        if (!reason) {
          throw new AppError('Rollback reason is required', 400);
        }

        const result = await restoreService.rollbackRestore(
          restoreId,
          reason
        );

        logger.info(
          `Restore rollback initiated for ${restoreId} by user ${req.user.id}`
        );

        res.json({
          success: true,
          message: 'Restore rollback completed',
          data: result,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/v1/backup/:restoreId/cancel
   * Cancel a restore operation in progress
   */
  app.post(
    '/api/v1/backup/:restoreId/cancel',
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { restoreId } = req.params;

        if (!req.user) {
          throw new AppError('Authentication required', 401);
        }

        const result = await restoreService.cancelRestore(restoreId);

        logger.info(
          `Restore cancelled for ${restoreId} by user ${req.user.id}`
        );

        res.json({
          success: true,
          message: 'Restore cancelled successfully',
          data: result,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  logger.info('Phase 16 Backup Management routes registered');
}

export default registerPhase16Routes;
