import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import knex from 'knex';
import knexConfig from '../../knexfile.js';
import { IdCardReportingService } from '../services/idCardReportingService.js';

/**
 * ID Card Reporting and Analytics Routes
 * Phase 2.1: Identity Management Module
 * 
 * Provides endpoints for dashboard statistics, issuance reports,
 * scan analytics, and security alerts.
 */

const router = Router();
const db = knex(knexConfig.development);

// Initialize service
const reportingService = new IdCardReportingService(db);

/**
 * GET /api/v1/id-cards/reports/dashboard
 * Get dashboard statistics
 * Requirements: 9.1
 */
router.get(
  '/dashboard',
  authenticate,
  authorize('principal', 'admin_staff'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).user.tenant_id;
      const academicSessionId = req.query.sessionId as string | undefined;

      const statistics = await reportingService.getDashboardStatistics(
        tenantId,
        academicSessionId
      );

      res.json({ statistics });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/id-cards/reports/issuance
 * Get card issuance report
 * Requirements: 9.2
 */
router.get(
  '/issuance',
  authenticate,
  authorize('principal', 'admin_staff'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).user.tenant_id;
      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : new Date();
      const groupBy = (req.query.groupBy as 'day' | 'month' | 'role') || 'day';

      if (!['day', 'month', 'role'].includes(groupBy)) {
        throw new AppError('Invalid groupBy parameter. Must be "day", "month", or "role"', 400);
      }

      const report = await reportingService.getIssuanceReport(
        tenantId,
        startDate,
        endDate,
        groupBy
      );

      res.json({
        report,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        groupBy,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/id-cards/reports/scans/:userId
 * Get QR code scan analytics for a user
 * Requirements: 9.4
 */
router.get(
  '/scans/:userId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : undefined;
      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : undefined;

      // Check if user is requesting their own data or is admin
      const requestingUserId = (req as any).user.id;
      const requestingUserRole = (req as any).user.role;

      if (
        userId !== requestingUserId &&
        !['principal', 'admin_staff'].includes(requestingUserRole)
      ) {
        throw new AppError('You can only view your own scan analytics', 403);
      }

      const analytics = await reportingService.getUserScanAnalytics(
        userId,
        startDate,
        endDate
      );

      res.json({ analytics });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/id-cards/reports/volume
 * Get card generation volume statistics
 * Requirements: 9.5
 */
router.get(
  '/volume',
  authenticate,
  authorize('principal', 'admin_staff'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).user.tenant_id;
      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // Default: last year
      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : new Date();

      const stats = await reportingService.getGenerationVolumeStats(
        tenantId,
        startDate,
        endDate
      );

      res.json({
        stats,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/id-cards/reports/security-alerts
 * Get security alerts
 * Requirements: 9.6
 */
router.get(
  '/security-alerts',
  authenticate,
  authorize('principal', 'admin_staff'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).user.tenant_id;

      const alerts = await reportingService.detectSecurityAlerts(tenantId);

      res.json({
        alerts,
        count: alerts.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/id-cards/reports/scan-history
 * Get scan history for analytics
 */
router.get(
  '/scan-history',
  authenticate,
  authorize('principal', 'admin_staff'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).user.tenant_id;
      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default: last 7 days
      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : new Date();

      const history = await reportingService.getScanHistory(
        tenantId,
        startDate,
        endDate
      );

      res.json({
        history,
        count: history.length,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
