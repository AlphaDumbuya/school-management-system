import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '../middleware/authMiddleware.js';
import { UserRole } from '../types/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { db } from '../utils/database.js';
import { IdCardService } from '../services/idCardService.js';
import { TemplateService } from '../services/templateService.js';
import { CardLifecycleService } from '../services/cardLifecycleService.js';
import { BulkCardOperationService } from '../services/bulkCardOperationService.js';
import { QrCodeService } from '../services/qrCodeService.js';

/**
 * ID Card Management Routes
 * Phase 2.1: Identity Management Module
 * Uses shared db singleton to avoid connection pool exhaustion.
 */

const router = Router();

// Initialize services
const idCardService = new IdCardService(db);
const templateService = new TemplateService(db);
const lifecycleService = new CardLifecycleService(db);
const bulkService = new BulkCardOperationService(db);
const qrCodeService = new QrCodeService(db);

// Apply auth + user context to all routes
router.use(authenticate);
router.use(attachUserContext);

/**
 * GET /api/v1/id-cards
 * List all cards with pagination and filters
 */
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 25, 100);
      const offset = (page - 1) * limit;
      const { status, search } = req.query;
      const tenantId = (req as any).user?.tenant_id;

      // Scoped to tenant — mandatory in multi-tenant system
      if (!tenantId) {
        throw new AppError('Tenant context required', 400, 'TENANT_REQUIRED');
      }

      let query = db('id_cards')
        .select(
          'id_cards.*',
          db.raw("COALESCE(users.first_name, students.first_name, 'Member') as first_name"),
          db.raw("COALESCE(users.last_name, students.last_name, '') as last_name"),
          db.raw("COALESCE(users.email, '') as email"),
          db.raw("COALESCE(users.role, 'student') as user_role"),
          db.raw("COALESCE(students.photo_url, users.photo_url, NULL) as photo_url"),
          'students.date_of_birth as student_dob',
          'students.student_id as student_reg_id',
          'classes.level as student_grade',
          'classes.name as class_name',
          'teachers.teacher_id as teacher_code',
          'teachers.department as teacher_department'
        )
        .leftJoin('students', function () {
          this.on('students.user_id', '=', 'id_cards.user_id')
            .orOn('students.id', '=', 'id_cards.user_id');
        })
        .leftJoin('users', function () {
          this.on('users.id', '=', 'id_cards.user_id')
            .orOn('users.id', '=', 'students.user_id');
        })
        .leftJoin('enrollments', 'enrollments.student_id', 'students.id')
        .leftJoin('classes', 'classes.id', 'enrollments.class_id')
        .leftJoin('teachers', function () {
          this.on('teachers.user_id', '=', 'id_cards.user_id')
            .orOn('teachers.id', '=', 'id_cards.user_id');
        })
        .where('id_cards.tenant_id', tenantId);

      if (status) {
        query = query.where('id_cards.status', status as string);
      }

      if (search) {
        const term = `%${(search as string).trim()}%`;
        query = query.where(function () {
          this.where('id_cards.card_number', 'ilike', term)
            .orWhere('users.first_name', 'ilike', term)
            .orWhere('users.last_name', 'ilike', term)
            .orWhere('students.first_name', 'ilike', term)
            .orWhere('students.last_name', 'ilike', term)
            .orWhere('users.email', 'ilike', term)
            .orWhere('students.student_id', 'ilike', term);
        });
      }

      const countResult = await query.clone().clearSelect().clearOrder().count('id_cards.id as count').first();
      const total = Number(countResult?.count ?? 0);

      const cards = await query
        .orderBy('id_cards.created_at', 'desc')
        .limit(limit)
        .offset(offset);

      // Map to frontend-friendly format
      const mappedCards = cards.map((c: any) => ({
        id: c.id,
        tenantId: c.tenant_id,
        userId: c.user_id,
        templateId: c.template_id,
        cardNumber: c.card_number,
        format: c.format,
        status: c.status,
        pdfUrl: c.pdf_url,
        issuedAt: c.issued_at,
        expiresAt: c.expires_at,
        issuedBy: c.issued_by,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        user: {
          id: c.user_id,
          firstName: c.first_name || 'Member',
          lastName: c.last_name || '',
          email: c.email || '',
          role: c.user_role || 'student',
          photoUrl: c.photo_url || null,
          dob: c.student_dob || null,
          memberId: c.student_reg_id || c.teacher_code || c.card_number,
          departmentOrGrade: c.class_name || c.student_grade || c.teacher_department || null,
        },
      }));

      res.json({
        data: mappedCards,
        pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
      });
    } catch (error) {
      logger.error('Error listing ID cards:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/id-cards/stats
 * Dashboard statistics
 */
router.get(
  '/stats',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).user?.tenant_id;

      const baseQuery = db('id_cards');
      const scoped = tenantId ? baseQuery.where('tenant_id', tenantId) : baseQuery;

      const [activeResult] = await scoped.clone().where('status', 'active').count('id as count');
      const [expiredResult] = await scoped.clone().where('status', 'expired').count('id as count');
      const [revokedResult] = await scoped.clone().where('status', 'revoked').count('id as count');
      const [lostResult] = await scoped.clone().where('status', 'lost').count('id as count');

      // Expiring within 30 days
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const [expiringResult] = await scoped.clone()
        .where('status', 'active')
        .where('expires_at', '<=', thirtyDaysFromNow)
        .where('expires_at', '>', new Date())
        .count('id as count');

      res.json({
        totalActive: Number(activeResult?.count ?? 0),
        totalExpired: Number(expiredResult?.count ?? 0),
        totalRevoked: Number(revokedResult?.count ?? 0),
        totalLost: Number(lostResult?.count ?? 0),
        expiringSoon: Number(expiringResult?.count ?? 0),
      });
    } catch (error) {
      logger.error('Error fetching ID card stats:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/id-cards/eligible-members
 * List enrolled students and staff eligible for ID card generation.
 * Queries the students and teachers tables directly.
 */
router.get(
  '/eligible-members',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search, role } = req.query;
      const tenantId = (req as any).user?.tenant_id;

      if (!tenantId) {
        throw new AppError('Tenant context required', 400, 'TENANT_REQUIRED');
      }

      let results: any[] = [];

      // Students — scoped to tenant
      if (!role || role === 'student') {
        let studentsQuery = db('students')
          .select(
            'students.id',
            'students.user_id',
            'students.first_name',
            'students.last_name',
            'students.student_id as member_id',
            'students.photo_url',
            db.raw("'student' as role")
          )
          .where('students.status', 'active')
          .where('students.tenant_id', tenantId);

        if (search) {
          const term = `%${(search as string).trim()}%`;
          studentsQuery = studentsQuery.where(function() {
            this.where('students.first_name', 'ilike', term)
              .orWhere('students.last_name', 'ilike', term)
              .orWhere('students.student_id', 'ilike', term);
          });
        }

        const students = await studentsQuery.limit(100);
        results = results.concat(students);
      }

      // Teachers — scoped to tenant via users join
      if (!role || role === 'teacher') {
        let teachersQuery = db('teachers')
          .select(
            'teachers.id',
            'teachers.user_id',
            'teachers.teacher_id as member_id',
            'users.first_name',
            'users.last_name',
            'users.photo_url',
            db.raw("'teacher' as role")
          )
          .leftJoin('users', 'teachers.user_id', 'users.id')
          .where('teachers.status', 'active')
          .where('users.tenant_id', tenantId);

        if (search) {
          const term = `%${(search as string).trim()}%`;
          teachersQuery = teachersQuery.where(function() {
            this.where('users.first_name', 'ilike', term)
              .orWhere('users.last_name', 'ilike', term)
              .orWhere('teachers.teacher_id', 'ilike', term);
          });
        }

        const teachers = await teachersQuery.limit(100);
        results = results.concat(teachers);
      }

      const data = results.map((r: any) => ({
        userId: r.user_id || r.id,
        firstName: r.first_name || '',
        lastName: r.last_name || '',
        memberId: r.member_id || '',
        role: r.role,
        photoUrl: r.photo_url || null,
      }));

      res.json({ data });
    } catch (error) {
      logger.error('Error fetching eligible members:', error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/id-cards/generate
 * Generate a single ID card
 */
router.post(
  '/generate',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.ADMISSIONS_OFFICER),
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
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.ADMISSIONS_OFFICER),
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cardId } = req.params;

      const card = await idCardService.getCardById(cardId);

      // Return both card and data for frontend robustness
      res.json({ card, data: card });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/id-cards/:cardId
 * Delete card
 */
router.delete(
  '/:cardId',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cardId } = req.params;

      await idCardService.deleteCard(cardId);

      res.json({
        success: true,
        message: 'ID card deleted successfully',
      });
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
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.ADMISSIONS_OFFICER),
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
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.ADMISSIONS_OFFICER),
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
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.ADMISSIONS_OFFICER),
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
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.ADMISSIONS_OFFICER),
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
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.ADMISSIONS_OFFICER),
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
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.ADMISSIONS_OFFICER),
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
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.ADMISSIONS_OFFICER),
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
