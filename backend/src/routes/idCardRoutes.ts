import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '../middleware/authMiddleware.js';
import { requirePlanFeature } from '../middleware/subscriptionGuard.js';
import { UserRole } from '../types/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { db } from '../utils/database.js';
import { IdCardService } from '../services/idCardService.js';
import { TemplateService } from '../services/templateService.js';
import { CardLifecycleService } from '../services/cardLifecycleService.js';
import { BulkCardOperationService } from '../services/bulkCardOperationService.js';
import { QrCodeService } from '../services/qrCodeService.js';
import { resolveYearScope, applyYearScope } from '../utils/academicYear.js';

/**
 * ID Card Management Routes
 * Phase 2.1: Identity Management Module
 * Uses shared db singleton to avoid connection pool exhaustion.
 */

const router = Router();

/**
 * Determine the public origin the QR verification URL should point to.
 * Priority: explicit env (canonical prod URL) → request's forwarded host
 * (works automatically behind Vercel/proxies) → request host. This ensures a
 * scanned QR opens a REACHABLE page rather than a baked-in localhost URL.
 */
function resolveRequestOrigin(req: Request): string | undefined {
  // 1) Explicit origin from the client (window.location.origin) — the most
  //    reliable source: it's exactly where the app is served. Trust it unless
  //    it's a localhost value coming from a production request.
  const bodyBase = typeof req.body?.baseUrl === 'string' ? req.body.baseUrl.trim() : '';
  const reqIsLocal = /localhost|127\.0\.0\.1/.test(req.headers['x-forwarded-host'] as string || req.get('host') || '');
  if (bodyBase && (!/localhost|127\.0\.0\.1/.test(bodyBase) || reqIsLocal)) {
    return bodyBase.replace(/\/+$/, '');
  }

  // 2) A non-localhost env override (canonical production URL).
  const envBase = process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.FRONTEND_URL;
  if (envBase && !/localhost|127\.0\.0\.1/.test(envBase)) {
    return envBase.replace(/\/+$/, '');
  }

  // 3) The request's forwarded host (works behind Vercel/proxies).
  const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim() || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string)?.split(',')[0]?.trim() || req.get('host');
  if (host && !/localhost|127\.0\.0\.1/.test(host)) {
    return `${proto}://${host}`;
  }

  // 4) Local dev fallback (env even if localhost, else the body value).
  return (envBase || bodyBase || '').replace(/\/+$/, '') || undefined;
}

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
 * Assert a card belongs to the caller's tenant before any per-card operation.
 * The card/lifecycle service methods look cards up by id ALONE, so without this
 * a user could read/regenerate/revoke/suspend/delete another school's card by
 * id (IDOR + cross-tenant write). Throws 404 if it isn't in the caller's tenant.
 */
async function assertCardInTenant(req: Request, cardId: string): Promise<any> {
  const tenantId = (req as any).user?.tenant_id;
  if (!tenantId) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
  if (!cardId) throw new AppError('Invalid card ID', 400);
  const row = await db('id_cards').where({ id: cardId, tenant_id: tenantId }).first();
  if (!row) throw new AppError('Card not found', 404, 'NOT_FOUND');
  return row;
}

/** Roles that manage ID cards (matches the ID Cards page access). */
function isCardStaff(req: Request): boolean {
  const role = String((req as any).user?.role || (req as any).auth?.role || '');
  return [UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.ADMISSIONS_OFFICER].map(String).includes(role);
}

/**
 * Admissions officers issue STUDENT cards only (staff cards are the
 * principal's). Checked on the server for single, bulk-by-ids and bulk-by-filter.
 */
async function assertAdmissionsStudentsOnly(req: Request, userIds?: unknown, filters?: any) {
  if ((req as any).user?.role !== 'admissions_officer') return;
  const tenantId = (req as any).user.tenant_id;
  if (filters && !userIds) {
    if (String(filters.role || '') !== 'student') throw new AppError('Admissions can only generate student ID cards.', 403, 'STUDENTS_ONLY');
    return;
  }
  const ids = (Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean).map(String);
  if (!ids.length) return;
  const rows = await db('users').where({ tenant_id: tenantId }).whereIn('id', ids).select('id', 'role');
  if (rows.length !== ids.length || rows.some((r: any) => r.role !== 'student')) {
    throw new AppError('Admissions can only generate student ID cards.', 403, 'STUDENTS_ONLY');
  }
}

/** Admissions may change STUDENT cards only (regenerate, revoke, suspend, reactivate, preview). */
async function assertAdmissionsCardIsStudent(req: Request, cardId: string) {
  if ((req as any).user?.role !== 'admissions_officer') return;
  const card = await db('id_cards').where({ id: cardId }).first('user_id');
  if (!card) return;
  const u = await db('users').where({ id: card.user_id }).first('role');
  const isStudent = u ? u.role === 'student' : !!(await db('students').where({ id: card.user_id }).first('id'));
  if (!isStudent) throw new AppError('Admissions can only manage student ID cards.', 403, 'STUDENTS_ONLY');
}

/** Assert a bulk job belongs to the caller's tenant. */
async function assertBulkJobInTenant(req: Request, jobId: string): Promise<void> {
  const tenantId = (req as any).user?.tenant_id;
  if (!tenantId) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
  if (!jobId) throw new AppError('Invalid job ID', 400);
  const row = await db('bulk_card_jobs').where({ id: jobId, tenant_id: tenantId }).first().catch(() => null);
  if (!row) throw new AppError('Bulk job not found', 404, 'NOT_FOUND');
}

/**
 * GET /api/v1/id-cards
 * List all cards with pagination and filters
 */
router.get(
  '/',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.ADMISSIONS_OFFICER),
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

      // NOTE: A student can have MULTIPLE enrollment rows (several classes /
      // terms). A plain leftJoin to enrollments+classes fans out the result so
      // one card appears once per enrollment (e.g. 4 duplicate rows). We use
      // DISTINCT ON (id_cards.id) to collapse back to exactly one row per card.
      let query = db('id_cards')
        .distinctOn('id_cards.id')
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
          'teachers.department as teacher_department',
          'card_templates.name as template_name',
          'card_templates.config as template_config',
          'card_templates.logo_url as template_logo_url',
          'qr.image_url as qr_image_url'
        )
        .leftJoin('card_templates', 'card_templates.id', 'id_cards.template_id')
        // Newest QR image per card (id is a random UUID, so pick by created_at).
        .leftJoin(
          db('qr_codes')
            .distinctOn('card_id')
            .select('card_id', 'image_url')
            .whereNotNull('card_id')
            .orderBy([{ column: 'card_id' }, { column: 'created_at', order: 'desc' }])
            .as('qr'),
          'qr.card_id', 'id_cards.id',
        )
        .leftJoin('students', function () {
          this.on('students.user_id', '=', 'id_cards.user_id')
            .orOn('students.id', '=', 'id_cards.user_id');
        })
        .leftJoin('users', function () {
          this.on('users.id', '=', 'id_cards.user_id')
            .orOn('users.id', '=', 'students.user_id');
        })
        .leftJoin('enrollments', function () {
          this.on('enrollments.student_id', '=', 'students.id')
            .andOn('enrollments.status', '=', db.raw('?', ['active']));
        })
        .leftJoin('classes', 'classes.id', 'enrollments.class_id')
        .leftJoin('teachers', function () {
          this.on('teachers.user_id', '=', 'id_cards.user_id')
            .orOn('teachers.id', '=', 'id_cards.user_id');
        })
        .where('id_cards.tenant_id', tenantId);

      // ?academic_year= → cards issued during that year (cards are valid for
      // one academic year). Omitted/'all' = every year.
      applyYearScope(query, await resolveYearScope(tenantId, req.query.academic_year), null, 'id_cards.issued_at');

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

      // Count DISTINCT cards (the join can still fan out before DISTINCT ON).
      const countResult = await query
        .clone()
        .clearSelect()
        .clearOrder()
        .countDistinct('id_cards.id as count')
        .first();
      const total = Number(countResult?.count ?? 0);

      // DISTINCT ON requires the distinct expression to lead the ORDER BY.
      // We order by id_cards.id (for DISTINCT ON) then created_at, and finally
      // re-sort the collapsed rows by created_at for display.
      const rows = await query
        .orderByRaw('id_cards.id, id_cards.created_at DESC')
        .limit(limit)
        .offset(offset);

      const cards = rows.sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

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
        qrImageUrl: c.qr_image_url || null,
        template: {
          name: c.template_name || 'Unknown',
          config: c.template_config || {},
          logoUrl: c.template_logo_url || null,
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
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.ADMISSIONS_OFFICER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).user?.tenant_id;
      const role = (req as any).user?.role;

      // Require tenant context (except platform super admins) so stats can never
      // span tenants — matching every other id-card route.
      if (!tenantId && role !== 'super_admin') {
        throw new AppError('Tenant context required', 400, 'TENANT_REQUIRED');
      }

      const baseQuery = db('id_cards');
      const scoped = tenantId ? baseQuery.where('tenant_id', tenantId) : baseQuery;
      // Same academic-year scope as the card list (by issue date).
      if (tenantId) applyYearScope(scoped, await resolveYearScope(tenantId, req.query.academic_year), null, 'issued_at');

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
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.ADMISSIONS_OFFICER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { search, role, classId } = req.query;
      const tenantId = (req as any).user?.tenant_id;

      if (!tenantId) {
        throw new AppError('Tenant context required', 400, 'TENANT_REQUIRED');
      }

      let results: any[] = [];

      // A class filter only makes sense for students; if provided, teachers are excluded.
      const classFilter = classId ? String(classId) : undefined;

      // Students — scoped to tenant
      if (!role || role === 'student') {
        let studentsQuery = db('students')
          .distinctOn('students.id')
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

        // Optional class filter — restrict to students actively enrolled in the class.
        if (classFilter) {
          studentsQuery = studentsQuery
            .join('enrollments', function () {
              this.on('enrollments.student_id', '=', 'students.id')
                .andOn('enrollments.status', '=', db.raw('?', ['active']));
            })
            .where('enrollments.class_id', classFilter);
        }

        if (search) {
          const term = `%${(search as string).trim()}%`;
          studentsQuery = studentsQuery.where(function() {
            this.where('students.first_name', 'ilike', term)
              .orWhere('students.last_name', 'ilike', term)
              .orWhere('students.student_id', 'ilike', term)
              .orWhereRaw("CONCAT_WS(' ', students.first_name, students.last_name) ILIKE ?", [term])
              .orWhereRaw("CONCAT_WS(' ', students.last_name, students.first_name) ILIKE ?", [term]);
          });
        }

        // DISTINCT ON (students.id) requires students.id to lead the ORDER BY,
        // so we sort by id in SQL (for the dedup) and then re-sort by the ID
        // number (member_id) in memory for the 001, 002, 003 … display order.
        const studentsRaw = await studentsQuery.orderBy('students.id', 'asc').limit(5000);
        const students = studentsRaw.sort((a: any, b: any) =>
          String(a.member_id || '').localeCompare(String(b.member_id || ''), undefined, { numeric: true })
        );
        results = results.concat(students);
      }

      // Teachers — scoped to tenant via users join (skipped when filtering by class)
      if (!classFilter && (!role || role === 'teacher')) {
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
              .orWhere('teachers.teacher_id', 'ilike', term)
              .orWhereRaw("CONCAT_WS(' ', users.first_name, users.last_name) ILIKE ?", [term])
              .orWhereRaw("CONCAT_WS(' ', users.last_name, users.first_name) ILIKE ?", [term]);
          });
        }

        const teachers = await teachersQuery.orderBy('teachers.teacher_id', 'asc').limit(5000);
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
  requirePlanFeature('id_cards'),
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
      await assertAdmissionsStudentsOnly(req, userId);

      const result = await idCardService.generateCard(userId, tenantId, {
        templateId,
        format,
        expirationDate: expirationDate ? new Date(expirationDate) : undefined,
        issuedBy,
        baseUrl: resolveRequestOrigin(req),
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
      await assertCardInTenant(req, cardId); // tenant guard
      await assertAdmissionsCardIsStudent(req, cardId);

      const result = await idCardService.regenerateCard(cardId, resolveRequestOrigin(req));

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
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.ADMISSIONS_OFFICER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cardId } = req.params;
      await assertCardInTenant(req, cardId); // tenant guard

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
      await assertCardInTenant(req, cardId); // tenant guard

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
      const tenantId = (req as any).user?.tenant_id;
      if (!tenantId) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
      // Staff can look up anyone; everyone else only their own cards.
      if (!isCardStaff(req) && String((req as any).user?.id) !== String(userId)) {
        throw new AppError('You can only view your own ID cards', 403, 'FORBIDDEN');
      }
      // Only return cards whose card row is in the caller's tenant — never let a
      // userId from another school surface cards.
      const cards = await idCardService.getCardsByUserId(userId);
      const scoped = (cards || []).filter((c: any) => (c.tenantId ?? c.tenant_id) === tenantId);

      res.json({ cards: scoped });
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
      await assertAdmissionsStudentsOnly(req, userId);

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
      await assertCardInTenant(req, cardId); // tenant guard
      await assertAdmissionsCardIsStudent(req, cardId);

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
      const card = await assertCardInTenant(req, cardId); // tenant guard
      // Card holders may report their own card lost; staff may report any.
      if (!isCardStaff(req) && String(card.user_id) !== String(reportedBy)) {
        throw new AppError('You can only report your own card as lost', 403, 'FORBIDDEN');
      }

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
      await assertCardInTenant(req, cardId); // tenant guard
      await assertAdmissionsCardIsStudent(req, cardId);

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
      await assertCardInTenant(req, cardId); // tenant guard
      await assertAdmissionsCardIsStudent(req, cardId);

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
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.ADMISSIONS_OFFICER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cardId } = req.params;
      await assertCardInTenant(req, cardId); // tenant guard

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
      const { userIds, filters, templateId, format, expirationDate } = req.body;
      const requestedBy = (req as any).user.id;
      const tenantId = (req as any).user.tenant_id;

      if (!format) {
        throw new AppError('Format is required', 400);
      }

      if (!userIds && !filters) {
        throw new AppError('Either userIds or filters must be provided', 400);
      }
      await assertAdmissionsStudentsOnly(req, userIds, filters);

      const result = await bulkService.createBulkJob({
        tenantId,
        userIds,
        filters,
        templateId,
        format,
        expirationDate,
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
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.ADMISSIONS_OFFICER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;
      await assertBulkJobInTenant(req, jobId); // tenant guard

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
      await assertBulkJobInTenant(req, jobId); // tenant guard

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
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.ADMISSIONS_OFFICER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;
      await assertBulkJobInTenant(req, jobId); // tenant guard

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
