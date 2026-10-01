/**
 * Event Management API Routes
 * Phase 2.2 - Events Management Module
 *
 * PRODUCTION FIXES:
 * 1. All static/prefix routes (view/*, analytics/*, config/*, user/*)
 *    are defined BEFORE /:eventId to prevent Express routing conflicts.
 * 2. All responses use consistent { success, data, pagination? } shape.
 * 3. Capacity check uses the imported `db` instead of `(global as any).db`.
 * 4. event_type and visibility filter params added to GET /.
 * 5. Tenant-scoped capacity check passes tenantId for security.
 * 6. delete response returns 200 JSON (frontend expects it).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '../middleware/authMiddleware.js';
import { requirePlanFeature } from '../middleware/subscriptionGuard.js';
import { UserRole } from '../types/auth.js';
import { logger } from '../utils/logger.js';
import db from '../utils/database.js';
import { resolveYearScope } from '../utils/academicYear.js';
import eventService from '../services/eventService.js';
import eventCategoryService from '../services/eventCategoryService.js';
import eventRegistrationService from '../services/eventRegistrationService.js';
import eventAttendanceService from '../services/eventAttendanceService.js';
import eventAnalyticsService from '../services/eventAnalyticsService.js';

const router = Router();

// Apply authentication to all event routes
router.use(authenticate);
router.use(attachUserContext);

/**
 * Multi-tenant guard for any route with an :eventId param.
 * Verifies the referenced event belongs to the caller's tenant BEFORE the
 * handler touches registration/attendance/stats sub-resources. Prevents
 * cross-tenant access to an event's data via a leaked/guessed event id.
 */
const assertEventTenant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const event = await eventService.getEvent(req.params.eventId, req.user!.tenant_id);
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    (req as any).event = event;
    next();
  } catch (error) {
    next(error);
  }
};

// =====================================================================
// STATIC / PREFIX ROUTES — must come before /:eventId
// =====================================================================

/**
 * GET /api/v1/events/view/calendar
 * Calendar events for a date range
 */
router.get(
  '/view/calendar',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { start_date, end_date } = req.query;

      if (!start_date || !end_date) {
        return res.status(400).json({
          success: false,
          error: 'start_date and end_date query params are required',
        });
      }

      const events = await eventService.getCalendarEvents(
        req.user!.tenant_id,
        new Date(start_date as string),
        new Date(end_date as string),
        req.user!.id,
      );

      res.json({ success: true, data: events });
    } catch (error) {
      logger.error('Error getting calendar events:', error);
      next(error);
    }
  },
);

/**
 * GET /api/v1/events/view/upcoming
 * Upcoming published events for the current user/tenant
 */
router.get(
  '/view/upcoming',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

      const events = await eventService.getUpcomingEvents(
        req.user!.tenant_id,
        req.user!.id,
        limit,
      );

      res.json({ success: true, data: events });
    } catch (error) {
      logger.error('Error getting upcoming events:', error);
      next(error);
    }
  },
);

/**
 * GET /api/v1/events/analytics/dashboard
 * Event analytics dashboard summary
 */
router.get(
  '/analytics/dashboard',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { start_date, end_date } = req.query;
      const analytics = await eventAnalyticsService.getDashboardSummary(
        req.user!.tenant_id,
        {
          start_date: start_date ? new Date(start_date as string) : undefined,
          end_date: end_date ? new Date(end_date as string) : undefined,
        },
      );
      res.json({ success: true, data: analytics });
    } catch (error) {
      logger.error('Error getting analytics dashboard:', error);
      next(error);
    }
  },
);

/**
 * GET  /api/v1/events/config/categories
 * POST /api/v1/events/config/categories
 * Event category management
 */
router.get(
  '/config/categories',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await eventCategoryService.listCategories(req.user!.tenant_id);
      res.json({ success: true, data: categories });
    } catch (error) {
      logger.error('Error listing categories:', error);
      next(error);
    }
  },
);

router.post(
  '/config/categories',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.body.name) {
        return res.status(400).json({ success: false, error: 'name is required' });
      }
      const category = await eventCategoryService.createCategory(
        req.user!.tenant_id,
        req.body,
      );
      res.status(201).json({ success: true, data: category });
    } catch (error) {
      logger.error('Error creating category:', error);
      next(error);
    }
  },
);

router.put(
  '/config/categories/:categoryId',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await eventCategoryService.updateCategory(
        req.params.categoryId,
        req.user!.tenant_id,
        req.body,
      );
      res.json({ success: true, data: category });
    } catch (error) {
      logger.error('Error updating category:', error);
      next(error);
    }
  },
);

router.delete(
  '/config/categories/:categoryId',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await eventCategoryService.deleteCategory(
        req.params.categoryId,
        req.user!.tenant_id,
      );
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting category:', error);
      next(error);
    }
  },
);

/**
 * GET /api/v1/events/user/registrations
 * Current user's event registrations
 */
router.get(
  '/user/registrations',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const registrations = await eventRegistrationService.getUserRegistrations(
        req.user!.id,
        { upcoming: req.query.upcoming === 'true' },
      );
      res.json({ success: true, data: registrations });
    } catch (error) {
      logger.error('Error getting user registrations:', error);
      next(error);
    }
  },
);

/**
 * GET /api/v1/events/search/:query
 * Full-text search across tenant events
 */
router.get(
  '/search/:query',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      const events = await eventService.searchEvents(
        req.user!.tenant_id,
        req.params.query,
        limit,
      );
      res.json({ success: true, data: events });
    } catch (error) {
      logger.error('Error searching events:', error);
      next(error);
    }
  },
);

// =====================================================================
// COLLECTION ROUTES
// =====================================================================

/**
 * GET /api/v1/events
 * List events with filters and pagination
 */
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        page = '1',
        limit = '20',
        status,
        event_type,
        category,
        start_date,
        end_date,
        search,
        organizer_id,
        visibility,
      } = req.query;

      // Non-managers (students/parents/etc.) must only ever see PUBLISHED events
      // — never drafts, cancelled, or completed. Managers (principal/admin/
      // teacher) may filter by any status they choose.
      const isManager = ['principal', 'super_admin', 'teacher'].includes(req.user!.role);
      const requestedStatus = (status && String(status).trim()) ? String(status).trim() : undefined;
      const effectiveStatus = isManager ? requestedStatus : 'published';

      // Optional ?academic_year= → that year's date window (session start up
      // to the next year's start). Unknown year → empty window.
      const yearScope = await resolveYearScope(req.user!.tenant_id, req.query.academic_year);

      const result: any = await eventService.listEvents(req.user!.tenant_id, {
        year_from:    yearScope?.from ?? null,
        year_to:      yearScope?.to ?? null,
        page: Math.max(1, parseInt(page as string) || 1),
        limit: Math.min(100, parseInt(limit as string) || 20),
        // Strip empty strings — treat '' same as undefined
        status:       effectiveStatus,
        event_type:   (event_type && String(event_type).trim()) ? String(event_type).trim() : undefined,
        category:     (category && String(category).trim())   ? String(category).trim()     : undefined,
        organizer_id: (organizer_id && String(organizer_id).trim()) ? String(organizer_id).trim() : undefined,
        visibility:   (visibility && String(visibility).trim()) ? String(visibility).trim() : undefined,
        start_date:   start_date ? new Date(start_date as string) : undefined,
        end_date:     end_date   ? new Date(end_date as string)   : undefined,
        search:       (search && String(search).trim())       ? String(search).trim()       : undefined,
      });

      // result shape: { data, total, page, limit, totalPages }
      res.json({
        success: true,
        data: result.data,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        summary: result.summary,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          total_pages: result.totalPages,
        },
      });
    } catch (error) {
      logger.error('Error listing events:', error);
      next(error);
    }
  },
);

/**
 * POST /api/v1/events
 * Create a new event
 */
router.post(
  '/',
  authorize(UserRole.PRINCIPAL, UserRole.TEACHER, UserRole.SUPER_ADMIN),
  requirePlanFeature('events'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, event_type, start_date, end_date } = req.body;

      if (!title || !event_type || !start_date || !end_date) {
        return res.status(400).json({
          success: false,
          error: 'title, event_type, start_date and end_date are required',
        });
      }

      // Validate date order
      if (new Date(start_date) >= new Date(end_date)) {
        return res.status(400).json({
          success: false,
          error: 'end_date must be after start_date',
        });
      }

      const event = await eventService.createEvent(req.user!.tenant_id, req.user!.id, {
        ...req.body,
        start_date: new Date(start_date),
        end_date: new Date(end_date),
      });

      res.status(201).json({ success: true, data: event });
    } catch (error) {
      logger.error('Error creating event:', error);
      next(error);
    }
  },
);

// =====================================================================
// ITEM ROUTES  /:eventId  (dynamic — AFTER all static paths)
// =====================================================================

/**
 * GET /api/v1/events/:eventId
 * Event with full detail (categories, registration stats, attendance stats)
 */
router.get(
  '/:eventId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await eventService.getEventDetails(
        req.params.eventId,
        req.user!.tenant_id,
        req.user!.id,
      );

      if (!event) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }

      res.json({ success: true, data: event });
    } catch (error) {
      logger.error('Error getting event:', error);
      next(error);
    }
  },
);

/**
 * PUT /api/v1/events/:eventId
 * Update event (principal / super_admin only)
 */
router.put(
  '/:eventId',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await eventService.updateEvent(
        req.params.eventId,
        req.user!.tenant_id,
        req.user!.id,
        req.body,
      );
      res.json({ success: true, data: event });
    } catch (error) {
      logger.error('Error updating event:', error);
      next(error);
    }
  },
);

/**
 * DELETE /api/v1/events/:eventId
 * Delete event — blocks if registrations exist
 */
router.delete(
  '/:eventId',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await eventService.deleteEvent(req.params.eventId, req.user!.tenant_id, req.user!.id);
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting event:', error);
      next(error);
    }
  },
);

/**
 * POST /api/v1/events/:eventId/publish
 */
router.post(
  '/:eventId/publish',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await eventService.publishEvent(
        req.params.eventId,
        req.user!.tenant_id,
        req.user!.id,
      );
      res.json({ success: true, data: event });
    } catch (error) {
      logger.error('Error publishing event:', error);
      next(error);
    }
  },
);

/**
 * POST /api/v1/events/:eventId/cancel
 */
router.post(
  '/:eventId/cancel',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await eventService.cancelEvent(
        req.params.eventId,
        req.user!.tenant_id,
        req.user!.id,
        req.body.reason,
      );
      res.json({ success: true, data: event });
    } catch (error) {
      logger.error('Error cancelling event:', error);
      next(error);
    }
  },
);

/**
 * POST /api/v1/events/:eventId/complete
 */
router.post(
  '/:eventId/complete',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await eventService.completeEvent(
        req.params.eventId,
        req.user!.tenant_id,
        req.user!.id,
      );
      res.json({ success: true, data: event });
    } catch (error) {
      logger.error('Error completing event:', error);
      next(error);
    }
  },
);

/**
 * POST /api/v1/events/:eventId/duplicate
 */
router.post(
  '/:eventId/duplicate',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await eventService.duplicateEvent(
        req.params.eventId,
        req.user!.tenant_id,
        req.user!.id,
      );
      res.status(201).json({ success: true, data: event });
    } catch (error) {
      logger.error('Error duplicating event:', error);
      next(error);
    }
  },
);

// ── REGISTRATION sub-routes ────────────────────────────────────────────────

/**
 * POST /api/v1/events/:eventId/register
 * Register current user for an event
 */
router.post(
  '/:eventId/register',
  assertEventTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const registration = await eventRegistrationService.registerForEvent(
        req.params.eventId,
        req.user!.id,
        req.body,
      );
      res.status(201).json({ success: true, data: registration });
    } catch (error: any) {
      logger.error('Error registering for event:', error);
      // Return structured 400 for known business-rule errors
      if (
        error.message?.includes('already registered') ||
        error.message?.includes('not open') ||
        error.message?.includes('deadline') ||
        error.message?.includes('guests') ||
        error.message?.includes('capacity')
      ) {
        return res.status(400).json({ success: false, error: error.message });
      }
      next(error);
    }
  },
);

/**
 * DELETE /api/v1/events/:eventId/register
 * Cancel current user's registration
 */
router.delete(
  '/:eventId/register',
  assertEventTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { registration_id } = req.body;

      if (!registration_id) {
        return res.status(400).json({ success: false, error: 'registration_id is required' });
      }

      const registration = await eventRegistrationService.getRegistration(registration_id);

      if (!registration) {
        return res.status(404).json({ success: false, error: 'Registration not found' });
      }

      // Tenant guard: only owner or admin can cancel
      if (registration.user_id !== req.user!.id) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }

      await eventRegistrationService.cancelRegistration(registration_id, req.user!.id);
      res.json({ success: true });
    } catch (error) {
      logger.error('Error cancelling registration:', error);
      next(error);
    }
  },
);

/**
 * PUT /api/v1/events/:eventId/register
 * Update current user's RSVP / guest count
 */
router.put(
  '/:eventId/register',
  assertEventTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { registration_id, rsvp_status, guests_count } = req.body;

      if (!registration_id) {
        return res.status(400).json({ success: false, error: 'registration_id is required' });
      }

      const registration = await eventRegistrationService.getRegistration(registration_id);

      if (!registration || registration.user_id !== req.user!.id) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }

      const updated = await eventRegistrationService.updateRSVPStatus(
        registration_id,
        req.user!.id,
        rsvp_status,
      );
      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('Error updating registration:', error);
      next(error);
    }
  },
);

/**
 * GET  /api/v1/events/:eventId/registrations
 * List all registrations for an event (staff only) — paginated
 */
router.get(
  '/:eventId/registrations',
  authorize(UserRole.PRINCIPAL, UserRole.TEACHER, UserRole.SUPER_ADMIN),
  assertEventTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
      const limit = Math.min(100, parseInt(req.query.limit as string) || 50);

      const registrations = await eventRegistrationService.getEventRegistrations(
        req.params.eventId,
        { status: req.query.status as string | undefined },
      );

      // Paginate in-memory (the underlying query is already tenant-scoped via event FK)
      const total = registrations.length;
      const start = (page - 1) * limit;
      const paged = registrations.slice(start, start + limit);

      res.json({
        success: true,
        data: paged,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        pagination: { total, page, limit, total_pages: Math.ceil(total / limit) },
      });
    } catch (error) {
      logger.error('Error getting registrations:', error);
      next(error);
    }
  },
);

/**
 * POST /api/v1/events/:eventId/registrations/:regId/approve
 */
router.post(
  '/:eventId/registrations/:regId/approve',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  assertEventTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const registration = await eventRegistrationService.approveRegistration(
        req.params.regId,
        req.user!.id,
      );
      res.json({ success: true, data: registration });
    } catch (error) {
      logger.error('Error approving registration:', error);
      next(error);
    }
  },
);

/**
 * POST /api/v1/events/:eventId/registrations/:regId/reject
 */
router.post(
  '/:eventId/registrations/:regId/reject',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  assertEventTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const registration = await eventRegistrationService.rejectRegistration(
        req.params.regId,
        req.user!.id,
        req.body.reason,
      );
      res.json({ success: true, data: registration });
    } catch (error) {
      logger.error('Error rejecting registration:', error);
      next(error);
    }
  },
);

/**
 * GET /api/v1/events/:eventId/capacity
 */
router.get(
  '/:eventId/capacity',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Fetch event first to validate tenant access
      const event = await eventService.getEvent(req.params.eventId, req.user!.tenant_id);
      if (!event) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }

      const capacity = await eventRegistrationService.checkCapacity(
        db,
        req.params.eventId,
        event.capacity,
      );
      res.json({ success: true, data: capacity });
    } catch (error) {
      logger.error('Error checking capacity:', error);
      next(error);
    }
  },
);

// ── ATTENDANCE sub-routes ──────────────────────────────────────────────────

/**
 * POST /api/v1/events/:eventId/attendance
 * Mark individual attendance
 */
router.post(
  '/:eventId/attendance',
  authorize(UserRole.PRINCIPAL, UserRole.TEACHER, UserRole.SUPER_ADMIN),
  assertEventTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.body.user_id || !req.body.status) {
        return res.status(400).json({ success: false, error: 'user_id and status are required' });
      }
      const attendance = await eventAttendanceService.markAttendance(
        req.params.eventId,
        req.body,
        req.user!.id,
      );
      res.json({ success: true, data: attendance });
    } catch (error) {
      logger.error('Error marking attendance:', error);
      next(error);
    }
  },
);

/**
 * POST /api/v1/events/:eventId/attendance/bulk
 * Bulk mark attendance
 */
router.post(
  '/:eventId/attendance/bulk',
  authorize(UserRole.PRINCIPAL, UserRole.TEACHER, UserRole.SUPER_ADMIN),
  assertEventTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { attendances } = req.body;
      if (!Array.isArray(attendances) || attendances.length === 0) {
        return res.status(400).json({ success: false, error: 'attendances array is required' });
      }
      await eventAttendanceService.bulkMarkAttendance(
        req.params.eventId,
        attendances,
        req.user!.id,
      );
      res.json({ success: true });
    } catch (error) {
      logger.error('Error bulk marking attendance:', error);
      next(error);
    }
  },
);

/**
 * GET /api/v1/events/:eventId/attendance
 * Returns paginated attendance records for the event (staff only).
 */
router.get(
  '/:eventId/attendance',
  authorize(UserRole.PRINCIPAL, UserRole.TEACHER, UserRole.SUPER_ADMIN),
  assertEventTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
      const limit = Math.min(100, parseInt(req.query.limit as string) || 50);

      const attendance = await eventAttendanceService.getEventAttendance(req.params.eventId);

      const total = attendance.length;
      const start = (page - 1) * limit;
      const paged = attendance.slice(start, start + limit);

      res.json({
        success: true,
        data: paged,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        pagination: { total, page, limit, total_pages: Math.ceil(total / limit) },
      });
    } catch (error) {
      logger.error('Error getting attendance:', error);
      next(error);
    }
  },
);

/**
 * GET /api/v1/events/:eventId/attendance/report
 */
router.get(
  '/:eventId/attendance/report',
  authorize(UserRole.PRINCIPAL, UserRole.TEACHER, UserRole.SUPER_ADMIN),
  assertEventTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await eventAttendanceService.generateAttendanceReport(req.params.eventId);
      res.json({ success: true, data: report });
    } catch (error) {
      logger.error('Error generating attendance report:', error);
      next(error);
    }
  },
);

/**
 * POST /api/v1/events/:eventId/attendance/qr-code
 * Generate QR code for event check-in station
 */
router.post(
  '/:eventId/attendance/qr-code',
  authorize(UserRole.PRINCIPAL, UserRole.TEACHER, UserRole.SUPER_ADMIN),
  assertEventTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const qrCode = await eventAttendanceService.generateAttendanceQRCode(req.params.eventId);
      res.json({ success: true, data: { qr_code: qrCode } });
    } catch (error) {
      logger.error('Error generating QR code:', error);
      next(error);
    }
  },
);

/**
 * POST /api/v1/events/:eventId/attendance/check-in
 * Self check-in (any authenticated user)
 */
router.post(
  '/:eventId/attendance/check-in',
  assertEventTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const method = req.body.qr_data ? 'qr_code' : 'manual';
      let attendance;

      if (req.body.qr_data) {
        attendance = await eventAttendanceService.checkInWithQRCode(
          req.body.qr_data,
          req.user!.id,
        );
      } else {
        attendance = await eventAttendanceService.checkIn(req.params.eventId, req.user!.id);
      }

      res.json({ success: true, data: attendance });
    } catch (error: any) {
      logger.error('Error checking in:', error);
      if (error.message === 'QR code expired' || error.message === 'Invalid QR code') {
        return res.status(400).json({ success: false, error: error.message });
      }
      next(error);
    }
  },
);

/**
 * POST /api/v1/events/:eventId/attendance/check-out
 * Self check-out
 */
router.post(
  '/:eventId/attendance/check-out',
  assertEventTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const attendance = await eventAttendanceService.checkOut(
        req.params.eventId,
        req.user!.id,
      );
      res.json({ success: true, data: attendance });
    } catch (error) {
      logger.error('Error checking out:', error);
      next(error);
    }
  },
);

/**
 * GET /api/v1/events/:eventId/stats
 * Registration + attendance summary — staff only
 */
router.get(
  '/:eventId/stats',
  authorize(UserRole.PRINCIPAL, UserRole.TEACHER, UserRole.SUPER_ADMIN),
  assertEventTenant,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await eventAnalyticsService.getEventStats(req.params.eventId);
      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error('Error getting event stats:', error);
      next(error);
    }
  },
);

export default router;
