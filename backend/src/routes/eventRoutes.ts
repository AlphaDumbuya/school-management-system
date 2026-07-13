/**
 * Event Management API Routes
 * Phase 2.2 - Events Management Module
 * 28+ endpoints for complete event management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { logger } from '../utils/logger.js';
import eventService from '../services/eventService.js';
import eventCategoryService from '../services/eventCategoryService.js';
import eventRegistrationService from '../services/eventRegistrationService.js';
import eventAttendanceService from '../services/eventAttendanceService.js';
import eventAnalyticsService from '../services/eventAnalyticsService.js';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// ==================== EVENT MANAGEMENT ====================

/**
 * POST /api/v1/events
 * Create a new event
 */
router.post(
  '/',
  authorize(['principal', 'teacher', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, description, event_type, start_date, end_date, ...data } = req.body;

      // Validation
      if (!title || !event_type || !start_date || !end_date) {
        return res.status(400).json({
          error: 'Missing required fields: title, event_type, start_date, end_date',
        });
      }

      const event = await eventService.createEvent(
        req.user.tenant_id,
        req.user.id,
        {
          title,
          description,
          event_type,
          start_date: new Date(start_date),
          end_date: new Date(end_date),
          ...data,
        }
      );

      res.status(201).json({ event });
    } catch (error) {
      logger.error('Error creating event:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/events
 * List events with filters and pagination
 */
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 20, status, category, start_date, end_date, search } = req.query;

      const result = await eventService.listEvents(req.user.tenant_id, {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        status: status as string,
        category: category as string,
        start_date: start_date ? new Date(start_date as string) : undefined,
        end_date: end_date ? new Date(end_date as string) : undefined,
        search: search as string,
      });

      res.json(result);
    } catch (error) {
      logger.error('Error listing events:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/events/:eventId
 * Get event details with statistics
 */
router.get(
  '/:eventId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await eventService.getEventDetails(req.params.eventId, req.user.tenant_id);

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      res.json({ event });
    } catch (error) {
      logger.error('Error getting event:', error);
      next(error);
    }
  }
);

/**
 * PUT /api/v1/events/:eventId
 * Update event
 */
router.put(
  '/:eventId',
  authorize(['principal', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await eventService.updateEvent(
        req.params.eventId,
        req.user.tenant_id,
        req.user.id,
        req.body
      );

      res.json({ event });
    } catch (error) {
      logger.error('Error updating event:', error);
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/events/:eventId
 * Delete event
 */
router.delete(
  '/:eventId',
  authorize(['principal', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await eventService.deleteEvent(req.params.eventId, req.user.tenant_id, req.user.id);
      res.status(204).send();
    } catch (error) {
      logger.error('Error deleting event:', error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/events/:eventId/publish
 * Publish event
 */
router.post(
  '/:eventId/publish',
  authorize(['principal', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await eventService.publishEvent(
        req.params.eventId,
        req.user.tenant_id,
        req.user.id
      );

      res.json({ event });
    } catch (error) {
      logger.error('Error publishing event:', error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/events/:eventId/cancel
 * Cancel event
 */
router.post(
  '/:eventId/cancel',
  authorize(['principal', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await eventService.cancelEvent(
        req.params.eventId,
        req.user.tenant_id,
        req.user.id,
        req.body.reason
      );

      res.json({ event });
    } catch (error) {
      logger.error('Error cancelling event:', error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/events/:eventId/complete
 * Mark event as complete
 */
router.post(
  '/:eventId/complete',
  authorize(['principal', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await eventService.completeEvent(
        req.params.eventId,
        req.user.tenant_id,
        req.user.id
      );

      res.json({ event });
    } catch (error) {
      logger.error('Error completing event:', error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/events/:eventId/duplicate
 * Duplicate event
 */
router.post(
  '/:eventId/duplicate',
  authorize(['principal', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await eventService.duplicateEvent(
        req.params.eventId,
        req.user.tenant_id,
        req.user.id
      );

      res.status(201).json({ event });
    } catch (error) {
      logger.error('Error duplicating event:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/events/search
 * Search events
 */
router.get(
  '/search/:query',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const events = await eventService.searchEvents(
        req.user.tenant_id,
        req.params.query,
        parseInt(req.query.limit as string) || 10
      );

      res.json({ events });
    } catch (error) {
      logger.error('Error searching events:', error);
      next(error);
    }
  }
);

// ==================== REGISTRATION MANAGEMENT ====================

/**
 * POST /api/v1/events/:eventId/register
 * Register for event
 */
router.post(
  '/:eventId/register',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const registration = await eventRegistrationService.registerForEvent(
        req.params.eventId,
        req.user.id,
        req.body
      );

      res.status(201).json({ registration });
    } catch (error) {
      logger.error('Error registering for event:', error);
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/events/:eventId/register
 * Cancel registration
 */
router.delete(
  '/:eventId/register',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const registration = await eventRegistrationService.getRegistration(
        req.body.registration_id
      );

      if (!registration || registration.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await eventRegistrationService.cancelRegistration(
        req.body.registration_id,
        req.user.id
      );

      res.status(204).send();
    } catch (error) {
      logger.error('Error cancelling registration:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/events/:eventId/registrations
 * Get event registrations
 */
router.get(
  '/:eventId/registrations',
  authorize(['principal', 'teacher', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const registrations = await eventRegistrationService.getEventRegistrations(
        req.params.eventId,
        { status: req.query.status as string }
      );

      res.json({ registrations });
    } catch (error) {
      logger.error('Error getting registrations:', error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/events/:eventId/registrations/:regId/approve
 * Approve registration
 */
router.post(
  '/:eventId/registrations/:regId/approve',
  authorize(['principal', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const registration = await eventRegistrationService.approveRegistration(
        req.params.regId,
        req.user.id
      );

      res.json({ registration });
    } catch (error) {
      logger.error('Error approving registration:', error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/events/:eventId/registrations/:regId/reject
 * Reject registration
 */
router.post(
  '/:eventId/registrations/:regId/reject',
  authorize(['principal', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const registration = await eventRegistrationService.rejectRegistration(
        req.params.regId,
        req.user.id,
        req.body.reason
      );

      res.json({ registration });
    } catch (error) {
      logger.error('Error rejecting registration:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/events/my-registrations
 * Get user's registrations
 */
router.get(
  '/user/registrations',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const registrations = await eventRegistrationService.getUserRegistrations(
        req.user.id,
        { upcoming: req.query.upcoming === 'true' }
      );

      res.json({ registrations });
    } catch (error) {
      logger.error('Error getting user registrations:', error);
      next(error);
    }
  }
);

/**
 * PUT /api/v1/events/:eventId/registrations/:regId/rsvp
 * Update RSVP status
 */
router.put(
  '/:eventId/registrations/:regId/rsvp',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const registration = await eventRegistrationService.updateRSVPStatus(
        req.params.regId,
        req.user.id,
        req.body.rsvp_status
      );

      res.json({ registration });
    } catch (error) {
      logger.error('Error updating RSVP status:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/events/:eventId/capacity
 * Check event capacity
 */
router.get(
  '/:eventId/capacity',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const capacity = await eventRegistrationService.checkCapacity(
        (global as any).db,
        req.params.eventId
      );

      res.json(capacity);
    } catch (error) {
      logger.error('Error checking capacity:', error);
      next(error);
    }
  }
);

// ==================== ATTENDANCE ====================

/**
 * POST /api/v1/events/:eventId/attendance
 * Mark attendance
 */
router.post(
  '/:eventId/attendance',
  authorize(['principal', 'teacher', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const attendance = await eventAttendanceService.markAttendance(
        req.params.eventId,
        req.body,
        req.user.id
      );

      res.status(201).json({ attendance });
    } catch (error) {
      logger.error('Error marking attendance:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/events/:eventId/attendance
 * Get event attendance
 */
router.get(
  '/:eventId/attendance',
  authorize(['principal', 'teacher', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const attendance = await eventAttendanceService.getEventAttendance(
        req.params.eventId
      );

      res.json({ attendance });
    } catch (error) {
      logger.error('Error getting attendance:', error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/events/:eventId/attendance/qr-code
 * Generate QR code for attendance
 */
router.post(
  '/:eventId/attendance/qr-code',
  authorize(['principal', 'teacher', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const qrCode = await eventAttendanceService.generateAttendanceQRCode(
        req.params.eventId
      );

      res.json({ qr_code: qrCode });
    } catch (error) {
      logger.error('Error generating QR code:', error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/events/:eventId/attendance/check-in
 * Check-in to event
 */
router.post(
  '/:eventId/attendance/check-in',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const attendance = await eventAttendanceService.checkIn(
        req.params.eventId,
        req.user.id
      );

      res.status(201).json({ attendance });
    } catch (error) {
      logger.error('Error checking in:', error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/events/:eventId/attendance/check-out
 * Check-out from event
 */
router.post(
  '/:eventId/attendance/check-out',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const attendance = await eventAttendanceService.checkOut(
        req.params.eventId,
        req.user.id
      );

      res.json({ attendance });
    } catch (error) {
      logger.error('Error checking out:', error);
      next(error);
    }
  }
);

// ==================== CALENDAR & ANALYTICS ====================

/**
 * GET /api/v1/events/calendar
 * Get calendar view (events in date range)
 */
router.get(
  '/view/calendar',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { start_date, end_date } = req.query;

      if (!start_date || !end_date) {
        return res.status(400).json({
          error: 'Missing required query parameters: start_date, end_date',
        });
      }

      const events = await eventService.getCalendarEvents(
        req.user.tenant_id,
        new Date(start_date as string),
        new Date(end_date as string),
        req.user.id
      );

      res.json({ events });
    } catch (error) {
      logger.error('Error getting calendar view:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/events/analytics
 * Get event analytics
 */
router.get(
  '/analytics/dashboard',
  authorize(['principal', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { start_date, end_date } = req.query;

      const analytics = await eventAnalyticsService.getDashboardSummary(
        req.user.tenant_id
      );

      res.json(analytics);
    } catch (error) {
      logger.error('Error getting analytics:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/events/upcoming
 * Get upcoming events for user
 */
router.get(
  '/view/upcoming',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const events = await eventService.getUpcomingEvents(
        req.user.tenant_id,
        req.user.id,
        parseInt(req.query.limit as string) || 10
      );

      res.json({ events });
    } catch (error) {
      logger.error('Error getting upcoming events:', error);
      next(error);
    }
  }
);

// ==================== CATEGORIES ====================

/**
 * GET /api/v1/events/categories
 * List event categories
 */
router.get(
  '/config/categories',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await eventCategoryService.listCategories(
        req.user.tenant_id
      );

      res.json({ categories });
    } catch (error) {
      logger.error('Error getting categories:', error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/events/categories
 * Create category
 */
router.post(
  '/config/categories',
  authorize(['principal', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await eventCategoryService.createCategory(
        req.user.tenant_id,
        req.body
      );

      res.status(201).json({ category });
    } catch (error) {
      logger.error('Error creating category:', error);
      next(error);
    }
  }
);

export default router;
