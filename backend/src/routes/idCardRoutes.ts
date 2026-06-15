import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import knex from 'knex';
import knexConfig from '../../knexfile.js';
import { IdCardService } from '../services/idCardService.js';
import { TemplateService } from '../services/templateService.js';
import { CardLifecycleService } from '../services/cardLifecycleService.js';
import { BulkCardOperationService } from '../services/bulkCardOperationService.js';
import { QrCodeService } from '../services/qrCodeService.js';

/**
 * ID Card Management Routes
 * Phase 2.1: Identity Management Module
 */

const router = Router();
const db = knex(knexConfig.development);

// Initialize services
const idCardService = new IdCardService(db);
const templateService = new TemplateService(db);
const lifecycleService = new CardLifecycleService(db);
const bulkService = new BulkCardOperationService(db);
const qrCodeService = new QrCodeService(db);

/**
 * POST /api/v1/id-cards/generate
 * Generate a single ID card
 */
router.post(
  '/generate',
  authenticate,
  authorize('principal', 'admin_staff'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, templateId, format, expirationDate } = req.body;
      const issuedBy = (req as any).user.id;
      const tenantId = (req as any).user.tenant_id;

      if (!userId || !format) {
        throw new AppError('Missing required fields: userId, format', 400);
      }

      if (!['pvc', 'badge'].includes(format)) {
        throw new AppError('Invalid format. Must be "pvc" or "badge"', 400);
      }

      const result = await idCardService.generateCard(userId, tenantId, {
        templateId,
        format,
        expirationDate: expirationDate ? new Date(expirationDate) : undefined,
        issuedBy,
      });

      res.status(201).json({
        message: 'ID card generated successfully',
        card: result,
      });

      logger.info(`ID card generated for user ${userId} by ${issuedBy}`);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/id-cards/regenerate/:cardId
 * Regenerate an existing card
 */
router.post(
  '/regenerate/:cardId',
  authenticate,
  authorize('principal', 'admin_staff'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cardId } = req.params;

      const result = await idCardService.regenerateCard(cardId);

      res.json({
        message: 'ID card regenerated successfully',
        card: result,
      });

      logger.info(`ID card ${cardId} regenerated`);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/id-cards/:cardId
 * Get card details by ID
 */
router.get(
  '/:cardId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cardId } = req.params;

      const card = await idCardService.getCardById(cardId);

      res.json({ card });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/id-cards/user/:userId
 * Get all cards for a user
 */
router.get(
  '/user/:userId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;

      const cards = await idCardService.getCardsByUserId(userId);

      res.json({ cards });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/id-cards/preview
 * Preview card before generation
 */
router.post(
  '/preview',
  authenticate,
  authorize('principal', 'admin_staff'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, templateId } = req.body;
      const tenantId = (req as any).user.tenant_id;

      if (!userId || !templateId) {
        throw new AppError('Missing required fields: userId, templateId', 400);
      }

      const pdfBuffer = await idCardService.previewCard(userId, tenantId, templateId);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=card-preview.pdf`);
      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/id-cards/:cardId/revoke
 * Revoke a card
 */
router.post(
  '/:cardId/revoke',
  authenticate,
  authorize('principal', 'admin_staff'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cardId } = req.params;
      const { reason } = req.body;
      const revokedBy = (req as any).user.id;

      if (!reason) {
        throw new AppError('Reason for revocation is required', 400);
      }

      await lifecycleService.revokeCard(cardId, revokedBy, reason);

      res.json({ message: 'Card revoked successfully' });

      logger.info(`Card ${cardId} revoked by ${revokedBy}`);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/id-cards/:cardId/report-lost
 * Report card as lost
 */
router.post(
  '/:cardId/report-lost',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cardId } = req.params;
      const { reason } = req.body;
      const reportedBy = (req as any).user.id;

      await lifecycleService.reportLost(cardId, reportedBy, reason);

      res.json({ message: 'Card reported as lost successfully' });

      logger.info(`Card ${cardId} reported lost by ${reportedBy}`);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/id-cards/:cardId/suspend
 * Suspend a card
 */
router.post(
  '/:cardId/suspend',
  authenticate,
  authorize('principal', 'admin_staff'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cardId } = req.params;
      const { reason } = req.body;
      const suspendedBy = (req as any).user.id;

      if (!reason) {
        throw new AppError('Reason for suspension is required', 400);
      }

      await lifecycleService.suspendCard(cardId, suspendedBy, reason);

      res.json({ message: 'Card suspended successfully' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/id-cards/:cardId/reactivate
 * Reactivate a suspended card
 */
router.post(
  '/:cardId/reactivate',
  authenticate,
  authorize('principal', 'admin_staff'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cardId } = req.params;
      const reactivatedBy = (req as any).user.id;

      await lifecycleService.reactivateCard(cardId, reactivatedBy);

      res.json({ message: 'Card reactivated successfully' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/id-cards/:cardId/history
 * Get card history
 */
router.get(
  '/:cardId/history',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cardId } = req.params;

      const history = await lifecycleService.getCardHistory(cardId);

      res.json({ history });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/id-cards/bulk
 * Create bulk card generation job
 */
router.post(
  '/bulk',
  authenticate,
  authorize('principal', 'admin_staff'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userIds, filters, templateId, format } = req.body;
      const requestedBy = (req as any).user.id;
      const tenantId = (req as any).user.tenant_id;

      if (!format) {
        throw new AppError('Format is required', 400);
      }

      if (!userIds && !filters) {
        throw new AppError('Either userIds or filters must be provided', 400);
      }

      const result = await bulkService.createBulkJob({
        tenantId,
        userIds,
        filters,
        templateId,
        format,
        requestedBy,
      });

      res.status(201).json({
        message: 'Bulk job created successfully',
        job: result,
      });

      logger.info(`Bulk job ${result.jobId} created by ${requestedBy}`);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/id-cards/bulk/:jobId/status
 * Get bulk job status
 */
router.get(
  '/bulk/:jobId/status',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;

      const status = await bulkService.getBulkJobStatus(jobId);

      res.json({ status });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/id-cards/bulk/:jobId/cancel
 * Cancel a bulk job
 */
router.post(
  '/bulk/:jobId/cancel',
  authenticate,
  authorize('principal', 'admin_staff'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;

      await bulkService.cancelBulkJob(jobId);

      res.json({ message: 'Bulk job cancelled successfully' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/id-cards/bulk/:jobId/report
 * Get bulk job report
 */
router.get(
  '/bulk/:jobId/report',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;

      const report = await bulkService.getBulkJobReport(jobId);

      res.json({ report });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/qr-codes/verify
 * Verify a scanned QR code
 */
router.post(
  '/qr-codes/verify',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { qrCodeContent, scanningDeviceId } = req.body;
      const scanningUserId = (req as any).user.id;
      const tenantId = (req as any).user.tenant_id;

      if (!qrCodeContent || !scanningDeviceId) {
        throw new AppError('Missing required fields: qrCodeContent, scanningDeviceId', 400);
      }

      const result = await qrCodeService.verifyQrCode(
        qrCodeContent,
        scanningUserId,
        scanningDeviceId,
        tenantId
      );

      res.json({ verification: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/id-cards/reports/expiring
 * Get cards expiring soon
 */
router.get(
  '/reports/expiring',
  authenticate,
  authorize('principal', 'admin_staff'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).user.tenant_id;
      const daysThreshold = parseInt(req.query.days as string) || 30;

      const expiringCards = await lifecycleService.checkExpiringSoon(
        tenantId,
        daysThreshold
      );

      res.json({
        cards: expiringCards,
        count: expiringCards.length,
        daysThreshold,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
