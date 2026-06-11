import type { Express, Request, Response, NextFunction } from 'express';
import type { Knex } from 'knex';
import { EncryptionService } from '@services/phase17EncryptionService';
import { SecurityHeadersService } from '@services/phase17SecurityHeadersService';
import { AuditLoggingService } from '@services/phase17AuditLoggingService';
import { AccessControlService } from '@services/phase17AccessControlService';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

/**
 * Phase 17: Data Security and Privacy Routes
 * 
 * Provides endpoints for:
 * - Encryption key management
 * - Security headers configuration
 * - Audit log viewing
 * - Access control management
 * - Security alerts
 */

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    tenantId: string;
    email: string;
    role: string;
  };
}

export function registerPhase17Routes(app: Express, db: Knex): void {
  // Initialize services
  const encryptionService = new EncryptionService(process.env.ENCRYPTION_MASTER_KEY);
  const securityHeadersService = new SecurityHeadersService();
  const auditLoggingService = new AuditLoggingService(db);
  const accessControlService = new AccessControlService(db);

  // Middleware
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
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
      throw new AppError('Admin access required', 403);
    }
    next();
  };

  /**
   * POST /api/v1/security/audit-logs
   * Get audit logs with filtering
   */
  app.post(
    '/api/v1/security/audit-logs',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          throw new AppError('Authentication required', 401);
        }

        const { userId, action, entityType, status, dateFrom, dateTo, limit, offset } = req.body;

        const logs = await auditLoggingService.getAuditLogs({
          tenantId: req.user.tenantId,
          userId,
          action,
          entityType,
          status,
          dateFrom: dateFrom ? new Date(dateFrom) : undefined,
          dateTo: dateTo ? new Date(dateTo) : undefined,
          limit: limit || 100,
          offset: offset || 0,
        });

        res.json({
          success: true,
          data: logs,
          pagination: { limit: limit || 100, offset: offset || 0 },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/security/audit-summary
   * Get audit log summary statistics
   */
  app.get(
    '/api/v1/security/audit-summary',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          throw new AppError('Authentication required', 401);
        }

        const { dateFrom, dateTo } = req.query;

        const summary = await auditLoggingService.getAuditSummary(
          req.user.tenantId,
          dateFrom ? new Date(dateFrom as string) : undefined,
          dateTo ? new Date(dateTo as string) : undefined
        );

        res.json({ success: true, data: summary });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/security/audit-export
   * Export audit logs as CSV
   */
  app.get(
    '/api/v1/security/audit-export',
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          throw new AppError('Authentication required', 401);
        }

        const { dateFrom, dateTo } = req.query;

        const csv = await auditLoggingService.exportAuditLogsAsCSV({
          tenantId: req.user.tenantId,
          dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
          dateTo: dateTo ? new Date(dateTo as string) : undefined,
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
        res.send(csv);

        logger.info(`Audit logs exported for tenant ${req.user.tenantId}`);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/security/access-history/:identifier
   * Get access history for user or IP
   */
  app.get(
    '/api/v1/security/access-history/:identifier',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          throw new AppError('Authentication required', 401);
        }

        const { identifier } = req.params;
        const { limit = '100' } = req.query;

        const history = await accessControlService.getAccessHistory(
          identifier,
          parseInt(limit as string)
        );

        res.json({ success: true, data: history });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/v1/security/ip-block
   * Block an IP address
   */
  app.post(
    '/api/v1/security/ip-block',
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          throw new AppError('Authentication required', 401);
        }

        const { ipAddress, reason, duration } = req.body;

        await accessControlService.blockIP(ipAddress, reason, duration);

        logger.info(`IP blocked: ${ipAddress} by user ${req.user.id}`);

        res.json({ success: true, message: `IP ${ipAddress} blocked successfully` });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/v1/security/ip-unblock
   * Unblock an IP address
   */
  app.post(
    '/api/v1/security/ip-unblock',
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          throw new AppError('Authentication required', 401);
        }

        const { ipAddress } = req.body;

        await accessControlService.unblockIP(ipAddress);

        logger.info(`IP unblocked: ${ipAddress} by user ${req.user.id}`);

        res.json({ success: true, message: `IP ${ipAddress} unblocked successfully` });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/v1/security/lock-account
   * Lock a user account
   */
  app.post(
    '/api/v1/security/lock-account',
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          throw new AppError('Authentication required', 401);
        }

        const { userId, reason, duration } = req.body;

        await accessControlService.lockUserAccount(userId, reason, duration);

        logger.info(`User account locked: ${userId} by user ${req.user.id}`);

        res.json({ success: true, message: `User account locked successfully` });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/v1/security/unlock-account
   * Unlock a user account
   */
  app.post(
    '/api/v1/security/unlock-account',
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          throw new AppError('Authentication required', 401);
        }

        const { userId } = req.body;

        await accessControlService.unlockUserAccount(userId);

        logger.info(`User account unlocked: ${userId} by user ${req.user.id}`);

        res.json({ success: true, message: `User account unlocked successfully` });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/security/security-alerts
   * Get security alerts
   */
  app.get(
    '/api/v1/security/security-alerts',
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { severity, limit = '100' } = req.query;

        const alerts = await accessControlService.getSecurityAlerts(
          severity as string,
          parseInt(limit as string)
        );

        res.json({ success: true, data: alerts });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/v1/security/security-alerts/:id/acknowledge
   * Acknowledge a security alert
   */
  app.post(
    '/api/v1/security/security-alerts/:id/acknowledge',
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;

        await accessControlService.acknowledgeSecurityAlert(id);

        res.json({ success: true, message: 'Security alert acknowledged' });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/security/encryption-health
   * Get encryption service health
   */
  app.get(
    '/api/v1/security/encryption-health',
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const health = encryptionService.getEncryptionHealth();
        res.json({ success: true, data: health });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/security/security-headers-health
   * Get security headers health
   */
  app.get(
    '/api/v1/security/security-headers-health',
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const health = securityHeadersService.getSecurityHeadersHealth();
        res.json({ success: true, data: health });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/security/access-control-health
   * Get access control health
   */
  app.get(
    '/api/v1/security/access-control-health',
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const health = await accessControlService.getAccessControlHealth();
        res.json({ success: true, data: health });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/v1/security/audit-logging-health
   * Get audit logging health
   */
  app.get(
    '/api/v1/security/audit-logging-health',
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          throw new AppError('Authentication required', 401);
        }

        const health = await auditLoggingService.getAuditLoggingHealth(req.user.tenantId);
        res.json({ success: true, data: health });
      } catch (error) {
        next(error);
      }
    }
  );

  logger.info('Phase 17 Security & Privacy routes registered');
}

export default registerPhase17Routes;
