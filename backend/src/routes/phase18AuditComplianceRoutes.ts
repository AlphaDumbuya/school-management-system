import type { Express, Request, Response } from 'express';
import type { Knex } from 'knex';
import { authenticate, attachUserContext, authorize } from '@middleware/authMiddleware';
import { AppError } from '@middleware/errorHandler';
import { UserRole } from '../types/auth';
import { logger } from '@utils/logger';
import ComplianceReportingService from '@services/phase18ComplianceReportingService';
import SensitiveActionService from '@services/phase18SensitiveActionService';
import AuditRetentionService from '@services/phase18AuditRetentionService';

/**
 * Phase 18: Audit Trail and Compliance Routes
 * 
 * API endpoints for:
 * - Compliance report generation and export
 * - Sensitive action logging and approval
 * - Audit retention and archival management
 * - Compliance verification
 */

export default function registerPhase18Routes(
  app: Express,
  db: Knex,
  archiveStoragePath?: string
): void {
  const complianceService = new ComplianceReportingService(db);
  const sensitiveActionService = new SensitiveActionService(db);
  const retentionService = new AuditRetentionService(db, archiveStoragePath);

  // SECURITY: audit/compliance data and retention operations (archive, purge,
  // restore, approvals) are school-admin only. Only "my pending approvals"
  // stays open to any signed-in user (it is scoped to req.user.id).
  const adminOnly = [
    authenticate,
    attachUserContext,
    authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  ];

  /** 404 unless the row belongs to the caller's tenant (super_admin bypasses). */
  async function assertTenantOwns(table: string, id: string, req: Request): Promise<void> {
    if (req.user?.role === UserRole.SUPER_ADMIN) return;
    const row = await db(table).where({ id, tenant_id: req.user?.tenantId }).first('id');
    if (!row) throw new AppError('Not found', 404, 'NOT_FOUND');
  }

  /**
   * POST /api/v1/compliance/reports
   * Generates a compliance report
   */
  app.post('/api/v1/compliance/reports', ...adminOnly, async (req: Request, res: Response) => {
    try {
      const { reportType, startDate, endDate } = req.body;
      const tenantId = req.user?.tenantId;
      const userId = req.user?.id;

      if (!tenantId || !userId) {
        throw new AppError('User context required', 401);
      }

      if (!reportType || !startDate || !endDate) {
        throw new AppError('reportType, startDate, and endDate are required', 400);
      }

      const validReportTypes = [
        'audit_trail',
        'access_summary',
        'incident_report',
        'user_activity',
      ];
      if (!validReportTypes.includes(reportType)) {
        throw new AppError(
          `Invalid report type. Must be one of: ${validReportTypes.join(', ')}`,
          400
        );
      }

      const report = await complianceService.generateComplianceReport(
        tenantId,
        reportType,
        new Date(startDate),
        new Date(endDate),
        userId
      );

      res.status(201).json({
        success: true,
        data: report,
      });
    } catch (error) {
      logger.error('Failed to generate compliance report', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/compliance/reports
   * Lists compliance reports
   */
  app.get('/api/v1/compliance/reports', ...adminOnly, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      const { reportType, limit = 50, offset = 0 } = req.query;

      if (!tenantId) {
        throw new AppError('User context required', 401);
      }

      const reports = await complianceService.listComplianceReports(
        tenantId,
        reportType as string | undefined,
        parseInt(limit as string) || 50,
        parseInt(offset as string) || 0
      );

      res.status(200).json({
        success: true,
        data: reports,
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
        },
      });
    } catch (error) {
      logger.error('Failed to list compliance reports', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/compliance/reports/:reportId
   * Gets a specific compliance report
   */
  app.get(
    '/api/v1/compliance/reports/:reportId',
    ...adminOnly,
    async (req: Request, res: Response) => {
      try {
        const { reportId } = req.params;
        const tenantId = req.user?.tenantId;

        if (!tenantId) {
          throw new AppError('User context required', 401);
        }

        const report = await db('compliance_reports')
          .where('id', reportId)
          .where('tenant_id', tenantId)
          .first();

        if (!report) {
          throw new AppError('Compliance report not found', 404);
        }

        res.status(200).json({
          success: true,
          data: {
            ...report,
            metrics: JSON.parse(report.metrics),
          },
        });
      } catch (error) {
        logger.error('Failed to get compliance report', error);
        throw error;
      }
    }
  );

  /**
   * GET /api/v1/compliance/reports/:reportId/export
   * Exports a compliance report
   */
  app.get(
    '/api/v1/compliance/reports/:reportId/export',
    ...adminOnly,
    async (req: Request, res: Response) => {
      try {
        const { reportId } = req.params;
        await assertTenantOwns('compliance_reports', reportId, req);
        const { format = 'json' } = req.query;

        if (!['csv', 'json', 'pdf'].includes(format as string)) {
          throw new AppError('Invalid export format. Must be csv, json, or pdf', 400);
        }

        const content = await complianceService.exportComplianceReport(
          reportId,
          format as 'csv' | 'json' | 'pdf'
        );

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="compliance_report_${reportId}.${format}"`
        );
        res.send(content);
      } catch (error) {
        logger.error('Failed to export compliance report', error);
        throw error;
      }
    }
  );

  /**
   * POST /api/v1/sensitive-actions
   * Logs a sensitive action
   */
  app.post(
    '/api/v1/sensitive-actions',
    ...adminOnly,
    async (req: Request, res: Response) => {
      try {
        const {
          actionType,
          entityType,
          entityId,
          description,
          reason,
          metadata,
        } = req.body;
        const tenantId = req.user?.tenantId;
        const userId = req.user?.id;
        const ipAddress = req.ip;
        const userAgent = req.get('user-agent');

        if (!tenantId || !userId) {
          throw new AppError('User context required', 401);
        }

        if (!actionType || !entityType || !entityId || !description || !reason) {
          throw new AppError(
            'actionType, entityType, entityId, description, and reason are required',
            400
          );
        }

        const action = await sensitiveActionService.logSensitiveAction(
          tenantId,
          userId,
          actionType,
          entityType,
          entityId,
          description,
          reason,
          metadata,
          ipAddress,
          userAgent
        );

        res.status(201).json({
          success: true,
          data: action,
        });
      } catch (error) {
        logger.error('Failed to log sensitive action', error);
        throw error;
      }
    }
  );

  /**
   * GET /api/v1/sensitive-actions
   * Lists sensitive actions with filtering
   */
  app.get(
    '/api/v1/sensitive-actions',
    ...adminOnly,
    async (req: Request, res: Response) => {
      try {
        const tenantId = req.user?.tenantId;
        const {
          actionType,
          status,
          userId,
          startDate,
          endDate,
          limit = 100,
          offset = 0,
        } = req.query;

        if (!tenantId) {
          throw new AppError('User context required', 401);
        }

        const actions = await sensitiveActionService.getSensitiveActions(tenantId, {
          actionType: actionType as string | undefined,
          status: status as string | undefined,
          userId: userId as string | undefined,
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined,
          limit: parseInt(limit as string) || 100,
          offset: parseInt(offset as string) || 0,
        });

        res.status(200).json({
          success: true,
          data: actions,
          pagination: {
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
          },
        });
      } catch (error) {
        logger.error('Failed to get sensitive actions', error);
        throw error;
      }
    }
  );

  /**
   * GET /api/v1/sensitive-actions/:actionId
   * Gets a specific sensitive action
   */
  app.get(
    '/api/v1/sensitive-actions/:actionId',
    ...adminOnly,
    async (req: Request, res: Response) => {
      try {
        const { actionId } = req.params;
        const tenantId = req.user?.tenantId;

        if (!tenantId) {
          throw new AppError('User context required', 401);
        }

        const action = await db('sensitive_actions')
          .where('id', actionId)
          .where('tenant_id', tenantId)
          .first();

        if (!action) {
          throw new AppError('Sensitive action not found', 404);
        }

        res.status(200).json({
          success: true,
          data: action,
        });
      } catch (error) {
        logger.error('Failed to get sensitive action', error);
        throw error;
      }
    }
  );

  /**
   * POST /api/v1/sensitive-actions/:actionId/approve
   * Approves a pending sensitive action
   */
  app.post(
    '/api/v1/sensitive-actions/:actionId/approve',
    ...adminOnly,
    async (req: Request, res: Response) => {
      try {
        const { actionId } = req.params;
        await assertTenantOwns('sensitive_actions', actionId, req);
        const userId = req.user?.id;

        if (!userId) {
          throw new AppError('User context required', 401);
        }

        const action = await sensitiveActionService.approveSensitiveAction(actionId, userId);

        res.status(200).json({
          success: true,
          data: action,
        });
      } catch (error) {
        logger.error('Failed to approve sensitive action', error);
        throw error;
      }
    }
  );

  /**
   * POST /api/v1/sensitive-actions/:actionId/reject
   * Rejects a pending sensitive action
   */
  app.post(
    '/api/v1/sensitive-actions/:actionId/reject',
    ...adminOnly,
    async (req: Request, res: Response) => {
      try {
        const { actionId } = req.params;
        await assertTenantOwns('sensitive_actions', actionId, req);
        const { reason } = req.body;
        const userId = req.user?.id;

        if (!userId) {
          throw new AppError('User context required', 401);
        }

        if (!reason) {
          throw new AppError('Rejection reason is required', 400);
        }

        const action = await sensitiveActionService.rejectSensitiveAction(
          actionId,
          userId,
          reason
        );

        res.status(200).json({
          success: true,
          data: action,
        });
      } catch (error) {
        logger.error('Failed to reject sensitive action', error);
        throw error;
      }
    }
  );

  /**
   * POST /api/v1/sensitive-actions/:actionId/complete
   * Marks a sensitive action as completed
   */
  app.post(
    '/api/v1/sensitive-actions/:actionId/complete',
    ...adminOnly,
    async (req: Request, res: Response) => {
      try {
        const { actionId } = req.params;
        await assertTenantOwns('sensitive_actions', actionId, req);
        const { result } = req.body;
        const userId = req.user?.id;

        if (!userId) {
          throw new AppError('User context required', 401);
        }

        const action = await sensitiveActionService.completeSensitiveAction(
          actionId,
          userId,
          result
        );

        res.status(200).json({
          success: true,
          data: action,
        });
      } catch (error) {
        logger.error('Failed to complete sensitive action', error);
        throw error;
      }
    }
  );

  /**
   * GET /api/v1/sensitive-actions/:actionId/audit-trail
   * Gets audit trail for a sensitive action
   */
  app.get(
    '/api/v1/sensitive-actions/:actionId/audit-trail',
    ...adminOnly,
    async (req: Request, res: Response) => {
      try {
        const { actionId } = req.params;
        await assertTenantOwns('sensitive_actions', actionId, req);
        const trail = await sensitiveActionService.getActionAuditTrail(actionId);

        res.status(200).json({
          success: true,
          data: trail,
        });
      } catch (error) {
        logger.error('Failed to get action audit trail', error);
        throw error;
      }
    }
  );

  /**
   * GET /api/v1/approvals/pending
   * Gets pending approvals for current user
   */
  app.get(
    '/api/v1/approvals/pending',
    authenticate,
    attachUserContext,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user?.id;
        const { limit = 50, offset = 0 } = req.query;

        if (!userId) {
          throw new AppError('User context required', 401);
        }

        const approvals = await sensitiveActionService.getPendingApprovalsForUser(
          userId,
          parseInt(limit as string) || 50,
          parseInt(offset as string) || 0
        );

        res.status(200).json({
          success: true,
          data: approvals,
          pagination: {
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
          },
        });
      } catch (error) {
        logger.error('Failed to get pending approvals', error);
        throw error;
      }
    }
  );

  /**
   * POST /api/v1/audit/retention-policy
   * Sets audit retention policy
   */
  app.post(
    '/api/v1/audit/retention-policy',
    ...adminOnly,
    async (req: Request, res: Response) => {
      try {
        const { retentionDays, archivalDays } = req.body;
        const tenantId = req.user?.tenantId;

        if (!tenantId) {
          throw new AppError('User context required', 401);
        }

        if (!retentionDays || !archivalDays) {
          throw new AppError('retentionDays and archivalDays are required', 400);
        }

        const policy = await retentionService.setRetentionPolicy(
          tenantId,
          retentionDays,
          archivalDays
        );

        res.status(201).json({
          success: true,
          data: policy,
        });
      } catch (error) {
        logger.error('Failed to set retention policy', error);
        throw error;
      }
    }
  );

  /**
   * POST /api/v1/audit/archive
   * Archives old audit logs
   */
  app.post('/api/v1/audit/archive', ...adminOnly, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new AppError('User context required', 401);
      }

      const archive = await retentionService.archiveOldLogs(tenantId);

      res.status(201).json({
        success: true,
        data: archive,
      });
    } catch (error) {
      logger.error('Failed to archive logs', error);
      throw error;
    }
  });

  /**
   * POST /api/v1/audit/purge
   * Purges expired audit logs
   */
  app.post('/api/v1/audit/purge', ...adminOnly, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new AppError('User context required', 401);
      }

      const purgedCount = await retentionService.purgeExpiredLogs(tenantId);

      res.status(200).json({
        success: true,
        data: {
          purgedCount,
        },
      });
    } catch (error) {
      logger.error('Failed to purge logs', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/audit/compliance
   * Verifies audit retention compliance
   */
  app.get('/api/v1/audit/compliance', ...adminOnly, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new AppError('User context required', 401);
      }

      const compliance = await retentionService.verifyRetentionCompliance(tenantId);

      res.status(200).json({
        success: true,
        data: compliance,
      });
    } catch (error) {
      logger.error('Failed to verify compliance', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/audit/archives
   * Lists audit archives
   */
  app.get('/api/v1/audit/archives', ...adminOnly, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      const { limit = 50, offset = 0 } = req.query;

      if (!tenantId) {
        throw new AppError('User context required', 401);
      }

      const archives = await retentionService.listArchives(
        tenantId,
        parseInt(limit as string) || 50,
        parseInt(offset as string) || 0
      );

      res.status(200).json({
        success: true,
        data: archives,
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
        },
      });
    } catch (error) {
      logger.error('Failed to list archives', error);
      throw error;
    }
  });

  /**
   * POST /api/v1/audit/archives/:archiveId/restore
   * Restores logs from archive
   */
  app.post(
    '/api/v1/audit/archives/:archiveId/restore',
    ...adminOnly,
    async (req: Request, res: Response) => {
      try {
        const { archiveId } = req.params;
        await assertTenantOwns('audit_archives', archiveId, req);
        const { limit = 10000 } = req.body;

        const restoredCount = await retentionService.restoreFromArchive(archiveId, limit);

        res.status(200).json({
          success: true,
          data: {
            restoredCount,
          },
        });
      } catch (error) {
        logger.error('Failed to restore from archive', error);
        throw error;
      }
    }
  );

  /**
   * GET /api/v1/audit/archives/:archiveId/verify
   * Verifies archive integrity
   */
  app.get(
    '/api/v1/audit/archives/:archiveId/verify',
    ...adminOnly,
    async (req: Request, res: Response) => {
      try {
        const { archiveId } = req.params;
        await assertTenantOwns('audit_archives', archiveId, req);

        const verification = await retentionService.verifyArchiveIntegrity(archiveId);

        res.status(200).json({
          success: true,
          data: verification,
        });
      } catch (error) {
        logger.error('Failed to verify archive', error);
        throw error;
      }
    }
  );

  logger.info('Phase 18 Audit Compliance routes registered (12 endpoints)');
}
