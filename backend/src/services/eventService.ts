/**
 * Event Service
 * Core event management functionality
 * Phase 2.2 - Events Management Module
 */

import db from '../utils/database.js';
import {
  Event,
  CreateEventDTO,
  UpdateEventDTO,
  EventFilters,
  PaginatedResult,
} from '../types/event.js';
import { logger } from '../utils/logger.js';
import eventCategoryService from './eventCategoryService.js';
import eventRecurrenceService from './eventRecurrenceService.js';

export class EventService {
  /**
   * Create a new event
   */
  async createEvent(
    tenantId: string,
    userId: string,
    data: CreateEventDTO
  ): Promise<Event> {
    const trx = await db.transaction();

    try {
      // Validate dates
      if (new Date(data.start_date) >= new Date(data.end_date)) {
        throw new Error('End date must be after start date');
      }

      // Create event
      const [event] = await trx('events')
        .insert({
          tenant_id: tenantId,
          title: data.title,
          description: data.description,
          event_type: data.event_type,
          start_date: data.start_date,
          end_date: data.end_date,
          all_day: data.all_day || false,
          location: data.location,
          location_type: data.location_type,
          venue_details: data.venue_details,
          capacity: data.capacity,
          organizer_id: data.organizer_id || userId,
          status: 'draft',
          visibility: data.visibility || 'public',
          visible_to_roles: data.visible_to_roles
            ? JSON.stringify(data.visible_to_roles)
            : null,
          registration_required: data.registration_required || false,
          registration_deadline: data.registration_deadline,
          approval_required: data.approval_required || false,
          allow_guests: data.allow_guests || false,
          max_guests_per_registration: data.max_guests_per_registration || 0,
          image_url: data.image_url,
          external_link: data.external_link,
          reminder_enabled: data.reminder_enabled !== false,
          reminder_intervals: data.reminder_intervals
            ? JSON.stringify(data.reminder_intervals)
            : JSON.stringify([24, 1]),
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
          created_by: userId,
        })
        .returning('*');

      // Assign categories
      if (data.categories && data.categories.length > 0) {
        await eventCategoryService.assignCategoriesToEvent(
          event.event_id,
          data.categories
        );
      }

      // Handle recurring events
      if (data.event_type === 'recurring' && data.recurrence) {
        await eventRecurrenceService.createRecurringEvents(
          trx,
          event,
          data.recurrence
        );
      }

      await trx.commit();

      logger.info(`Event created: ${event.event_id}`, {
        tenantId,
        userId,
        eventType: data.event_type,
      });

      return event;
    } catch (error) {
      await trx.rollback();
      logger.error('Error creating event:', error);
      throw error;
    }
  }

  /**
   * Update event
   */
  async updateEvent(
    eventId: string,
    tenantId: string,
    userId: string,
    data: UpdateEventDTO
  ): Promise<Event> {
    const trx = await db.transaction();

    try {
      // Check event exists and user has permission
      const existing = await trx('events')
        .where({ event_id: eventId, tenant_id: tenantId })
        .first();

      if (!existing) {
        throw new Error('Event not found');
      }

      // Validate dates if provided
      const startDate = data.start_date
        ? new Date(data.start_date)
        : new Date(existing.start_date);
      const endDate = data.end_date
        ? new Date(data.end_date)
        : new Date(existing.end_date);

      if (startDate >= endDate) {
        throw new Error('End date must be after start date');
      }

      // Prepare update data
      const updateData: any = {
        ...data,
        updated_by: userId,
        updated_at: db.fn.now(),
      };

      // Handle JSON fields
      if (data.visible_to_roles) {
        updateData.visible_to_roles = JSON.stringify(data.visible_to_roles);
      }
      if (data.reminder_intervals) {
        updateData.reminder_intervals = JSON.stringify(data.reminder_intervals);
      }
      if (data.metadata) {
        updateData.metadata = JSON.stringify(data.metadata);
      }

      // Remove categories from update data (handled separately)
      delete updateData.categories;
      delete updateData.recurrence;

      const [updated] = await trx('events')
        .where({ event_id: eventId, tenant_id: tenantId })
        .update(updateData)
        .returning('*');

      // Update categories if provided
      if (data.categories !== undefined) {
        await eventCategoryService.assignCategoriesToEvent(
          eventId,
          data.categories
        );
      }

      await trx.commit();

      logger.info(`Event updated: ${eventId}`, { tenantId, userId });

      return updated;
    } catch (error) {
      await trx.rollback();
      logger.error('Error updating event:', error);
      throw error;
    }
  }

  /**
   * Delete event
   */
  async deleteEvent(eventId: string, tenantId: string, userId: string): Promise<void> {
    try {
      const event = await db('events')
        .where({ event_id: eventId, tenant_id: tenantId })
        .first();

      if (!event) {
        throw new Error('Event not found');
      }

      // Check if event has registrations
      const registrationCount = await db('event_registrations')
        .where({ event_id: eventId })
        .count('* as count')
        .first();

      if (registrationCount && parseInt(registrationCount.count as string) > 0) {
        throw new Error(
          'Cannot delete event with existing registrations. Cancel the event instead.'
        );
      }

      await db('events').where({ event_id: eventId, tenant_id: tenantId }).delete();

      logger.info(`Event deleted: ${eventId}`, { tenantId, userId });
    } catch (error) {
      logger.error('Error deleting event:', error);
      throw error;
    }
  }

  /**
   * Get event by ID
   */
  async getEvent(eventId: string, tenantId: string): Promise<Event | null> {
    try {
      const event = await db('events')
        .where({ event_id: eventId, tenant_id: tenantId })
        .first();

      if (!event) {
        return null;
      }

      // Parse JSON fields — only call JSON.parse when Postgres returns a raw string
      // (some drivers/versions auto-parse jsonb columns into objects already)
      if (event.visible_to_roles && typeof event.visible_to_roles === 'string') {
        event.visible_to_roles = JSON.parse(event.visible_to_roles);
      }
      if (event.reminder_intervals && typeof event.reminder_intervals === 'string') {
        event.reminder_intervals = JSON.parse(event.reminder_intervals);
      }
      if (event.metadata && typeof event.metadata === 'string') {
        event.metadata = JSON.parse(event.metadata);
      }

      return event;
    } catch (error) {
      logger.error('Error getting event:', error);
      throw new Error('Failed to get event');
    }
  }

  /**
   * Get event with full details (including categories, registration stats)
   */
  async getEventDetails(eventId: string, tenantId: string, userId?: string): Promise<any> {
    try {
      const event = await this.getEvent(eventId, tenantId);

      if (!event) {
        throw new Error('Event not found');
      }

      // Get categories
      const categories = await eventCategoryService.getEventCategories(eventId);

      // Get registration stats
      const registrationStats = await db('event_registrations')
        .where({ event_id: eventId })
        .select(
          db.raw("COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_count"),
          db.raw("COUNT(*) FILTER (WHERE status = 'waitlist') as waitlist_count"),
          db.raw('COUNT(*) as total_registrations')
        )
        .first();

      // Get attendance stats
      const attendanceStats = await db('event_attendance')
        .where({ event_id: eventId })
        .select(
          db.raw("COUNT(*) FILTER (WHERE status = 'present') as present_count"),
          db.raw('COUNT(*) as total_attendance')
        )
        .first();

      const confirmed = parseInt(registrationStats?.confirmed_count || '0');
      const waitlist = parseInt(registrationStats?.waitlist_count || '0');
      const totalRegistrations = parseInt(registrationStats?.total_registrations || '0');

      // Look up the current user's own registration (for RSVP state on the UI)
      let userRegistration: any = null;
      if (userId) {
        const reg = await db('event_registrations')
          .where({ event_id: eventId, user_id: userId })
          .whereNot('status', 'cancelled')
          .first();
        if (reg) {
          if (reg.registration_data && typeof reg.registration_data === 'string') {
            try { reg.registration_data = JSON.parse(reg.registration_data); } catch { /* ignore */ }
          }
          userRegistration = reg;
        }
      }

      return {
        ...event,
        categories,
        // Flat count used by list/detail UI components
        registrations_count: totalRegistrations,
        registration_stats: {
          confirmed,
          waitlist,
          total: totalRegistrations,
        },
        attendance_stats: {
          present: parseInt(attendanceStats?.present_count || '0'),
          total: parseInt(attendanceStats?.total_attendance || '0'),
        },
        // RSVP state for the requesting user
        is_registered: !!userRegistration,
        user_registration: userRegistration,
      };
    } catch (error) {
      logger.error('Error getting event details:', error);
      throw error;
    }
  }

  /**
   * List events with filters and pagination
   */
  async listEvents(
    tenantId: string,
    filters: EventFilters
  ): Promise<PaginatedResult<Event>> {
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const offset = (page - 1) * limit;

      let query = db('events').where('events.tenant_id', tenantId);

      // Apply filters
      if (filters.status) {
        query = query.where('events.status', filters.status);
      }

      if ((filters as any).event_type) {
        query = query.where('events.event_type', (filters as any).event_type);
      }

      if (filters.organizer_id) {
        query = query.where('events.organizer_id', filters.organizer_id);
      }

      if (filters.visibility) {
        query = query.where('events.visibility', filters.visibility);
      }

      if (filters.start_date) {
        query = query.where('events.start_date', '>=', filters.start_date);
      }

      if (filters.end_date) {
        query = query.where('events.end_date', '<=', filters.end_date);
      }

      // Academic-year window (events are date-keyed, not session-keyed).
      if (filters.year_from) {
        query = query.where('events.start_date', '>=', filters.year_from);
      }
      if (filters.year_to) {
        query = query.where('events.start_date', '<', filters.year_to);
      }

      if (filters.category) {
        query = query
          .join(
            'event_category_mappings',
            'events.event_id',
            'event_category_mappings.event_id'
          )
          .where('event_category_mappings.category_id', filters.category);
      }

      if (filters.search) {
        query = query.where((builder) => {
          builder
            .where('events.title', 'ilike', `%${filters.search}%`)
            .orWhere('events.description', 'ilike', `%${filters.search}%`)
            .orWhere('events.location', 'ilike', `%${filters.search}%`);
        });
      }

      // Get total count — use db.raw to emit COUNT(DISTINCT ...) correctly
      const countQuery = query.clone();
      const countResult = await countQuery
        .countDistinct('events.event_id as count')
        .first();
      const total = parseInt(String(countResult?.count ?? '0'), 10);

      // KPI summary over the WHOLE filtered set (not just this page).
      const summaryRow: any = await query.clone()
        .select(
          db.raw('COUNT(DISTINCT events.event_id) FILTER (WHERE events.start_date > NOW()) as upcoming'),
          db.raw("COUNT(DISTINCT events.event_id) FILTER (WHERE events.status = 'published') as published"),
        )
        .first();
      const regRow: any = await db('event_registrations')
        .where('status', 'confirmed')
        .whereIn('event_id', query.clone().clearSelect().clearOrder().select('events.event_id'))
        .count('* as c')
        .first();
      const summary = {
        total,
        upcoming: Number(summaryRow?.upcoming ?? 0),
        published: Number(summaryRow?.published ?? 0),
        registrations: Number(regRow?.c ?? 0),
      };

      // Get paginated results — include a confirmed-registration count per event
      // so the UI list/KPIs can show real numbers instead of always 0.
      const events = await query
        .select(
          'events.*',
          db.raw(
            "(SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = events.event_id AND er.status = 'confirmed') as registrations_count"
          )
        )
        .orderBy('events.start_date', 'desc')
        .limit(limit)
        .offset(offset);

      events.forEach((event: any) => {
        event.registrations_count = parseInt(event.registrations_count || '0', 10);
      });

      // Parse JSON fields — only call JSON.parse when Postgres returns a raw string
      // (some drivers/versions auto-parse jsonb columns into objects already)
      events.forEach((event) => {
        if (event.visible_to_roles && typeof event.visible_to_roles === 'string') {
          event.visible_to_roles = JSON.parse(event.visible_to_roles);
        }
        if (event.reminder_intervals && typeof event.reminder_intervals === 'string') {
          event.reminder_intervals = JSON.parse(event.reminder_intervals);
        }
        if (event.metadata && typeof event.metadata === 'string') {
          event.metadata = JSON.parse(event.metadata);
        }
      });

      return {
        data: events,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        summary,
      } as PaginatedResult<Event> & { summary: typeof summary };
    } catch (error) {
      logger.error('Error listing events:', error);
      throw new Error('Failed to list events');
    }
  }

  /**
   * Publish event
   */
  async publishEvent(
    eventId: string,
    tenantId: string,
    userId: string
  ): Promise<Event> {
    try {
      const [event] = await db('events')
        .where({ event_id: eventId, tenant_id: tenantId })
        .update({
          status: 'published',
          updated_by: userId,
          updated_at: db.fn.now(),
        })
        .returning('*');

      if (!event) {
        throw new Error('Event not found');
      }

      logger.info(`Event published: ${eventId}`, { tenantId, userId });

      return event;
    } catch (error) {
      logger.error('Error publishing event:', error);
      throw error;
    }
  }

  /**
   * Cancel event
   */
  async cancelEvent(
    eventId: string,
    tenantId: string,
    userId: string,
    reason?: string
  ): Promise<Event> {
    try {
      const metadata = reason ? { cancellation_reason: reason } : undefined;

      const [event] = await db('events')
        .where({ event_id: eventId, tenant_id: tenantId })
        .update({
          status: 'cancelled',
          metadata: metadata ? JSON.stringify(metadata) : db.raw('metadata'),
          updated_by: userId,
          updated_at: db.fn.now(),
        })
        .returning('*');

      if (!event) {
        throw new Error('Event not found');
      }

      logger.info(`Event cancelled: ${eventId}`, { tenantId, userId, reason });

      // Send in-app notifications to all confirmed registrants (fire-and-forget)
      this.notifyCancellation(eventId, tenantId, event.title, reason)
        .catch((err) => logger.warn('Could not send cancellation notifications:', err));

      return event;
    } catch (error) {
      logger.error('Error cancelling event:', error);
      throw error;
    }
  }

  /**
   * Complete event
   */
  async completeEvent(
    eventId: string,
    tenantId: string,
    userId: string
  ): Promise<Event> {
    try {
      const [event] = await db('events')
        .where({ event_id: eventId, tenant_id: tenantId })
        .update({
          status: 'completed',
          updated_by: userId,
          updated_at: db.fn.now(),
        })
        .returning('*');

      if (!event) {
        throw new Error('Event not found');
      }

      logger.info(`Event completed: ${eventId}`, { tenantId, userId });

      return event;
    } catch (error) {
      logger.error('Error completing event:', error);
      throw error;
    }
  }

  /**
   * Duplicate event
   */
  async duplicateEvent(
    eventId: string,
    tenantId: string,
    userId: string
  ): Promise<Event> {
    const trx = await db.transaction();

    try {
      const original = await trx('events')
        .where({ event_id: eventId, tenant_id: tenantId })
        .first();

      if (!original) {
        throw new Error('Event not found');
      }

      // Get categories
      const categories = await eventCategoryService.getEventCategories(eventId);

      // Create duplicate
      // jsonb columns (reminder_intervals, visible_to_roles, metadata) are returned
      // as parsed JS objects by the pg driver — re-serialize them before insert so
      // Postgres receives valid JSON strings instead of [object Object].
      const duplicateData = {
        ...original,
        title: `${original.title} (Copy)`,
        status: 'draft',
        created_by: userId,
        updated_by: null,
        created_at: undefined,
        updated_at: undefined,
        event_id: undefined,
        reminder_intervals:
          original.reminder_intervals != null && typeof original.reminder_intervals !== 'string'
            ? JSON.stringify(original.reminder_intervals)
            : original.reminder_intervals,
        visible_to_roles:
          original.visible_to_roles != null && typeof original.visible_to_roles !== 'string'
            ? JSON.stringify(original.visible_to_roles)
            : original.visible_to_roles,
        metadata:
          original.metadata != null && typeof original.metadata !== 'string'
            ? JSON.stringify(original.metadata)
            : original.metadata,
      };

      delete duplicateData.event_id;
      delete duplicateData.created_at;
      delete duplicateData.updated_at;

      const [duplicate] = await trx('events').insert(duplicateData).returning('*');

      // Copy categories
      if (categories.length > 0) {
        await eventCategoryService.assignCategoriesToEvent(
          duplicate.event_id,
          categories.map((c) => c.category_id)
        );
      }

      await trx.commit();

      logger.info(`Event duplicated: ${eventId} -> ${duplicate.event_id}`, {
        tenantId,
        userId,
      });

      return duplicate;
    } catch (error) {
      await trx.rollback();
      logger.error('Error duplicating event:', error);
      throw error;
    }
  }

  /**
   * Search events
   */
  async searchEvents(tenantId: string, query: string, limit = 10): Promise<Event[]> {
    try {
      const events = await db('events')
        .where('tenant_id', tenantId)
        .where((builder) => {
          builder
            .where('title', 'ilike', `%${query}%`)
            .orWhere('description', 'ilike', `%${query}%`)
            .orWhere('location', 'ilike', `%${query}%`);
        })
        .where('status', '!=', 'cancelled')
        .orderBy('start_date', 'asc')
        .limit(limit);

      return events;
    } catch (error) {
      logger.error('Error searching events:', error);
      throw new Error('Failed to search events');
    }
  }

  /**
   * Get upcoming events for user
   */
  async getUpcomingEvents(
    tenantId: string,
    userId: string,
    limit = 10
  ): Promise<Event[]> {
    try {
      const now = new Date();

      const events = await db('events')
        .leftJoin('event_registrations', function () {
          this.on('events.event_id', '=', 'event_registrations.event_id').andOn(
            'event_registrations.user_id',
            '=',
            db.raw('?', [userId])
          );
        })
        .where('events.tenant_id', tenantId)
        .where('events.status', 'published')
        .where('events.start_date', '>', now)
        .where((builder) => {
          builder
            .where('events.visibility', 'public')
            .orWhereNotNull('event_registrations.registration_id');
        })
        .select('events.*')
        .distinct()
        .orderBy('events.start_date', 'asc')
        .limit(limit);

      return events;
    } catch (error) {
      logger.error('Error getting upcoming events:', error);
      throw new Error('Failed to get upcoming events');
    }
  }

  /**
   * Get calendar view (events in date range)
   */
  async getCalendarEvents(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<Event[]> {
    try {
      let query = db('events')
        .where('events.tenant_id', tenantId)
        .where('events.status', 'published')
        .where((builder) => {
          builder
            .whereBetween('events.start_date', [startDate, endDate])
            .orWhereBetween('events.end_date', [startDate, endDate])
            .orWhere((subBuilder) => {
              subBuilder
                .where('events.start_date', '<=', startDate)
                .where('events.end_date', '>=', endDate);
            });
        });

      if (userId) {
        query = query
          .leftJoin('event_registrations', function () {
            this.on('events.event_id', '=', 'event_registrations.event_id').andOn(
              'event_registrations.user_id',
              '=',
              db.raw('?', [userId])
            );
          })
          .where((builder) => {
            builder
              .where('events.visibility', 'public')
              .orWhereNotNull('event_registrations.registration_id');
          });
      } else {
        query = query.where('events.visibility', 'public');
      }

      const events = await query.select('events.*').distinct().orderBy('events.start_date', 'asc');

      return events;
    } catch (error) {
      logger.error('Error getting calendar events:', error);
      throw new Error('Failed to get calendar events');
    }
  }

  /**
   * Send in-app cancellation notifications to all confirmed registrants.
   * Tenant-scoped: only users in this tenant receive the notification.
   * Called fire-and-forget — must never throw to the caller.
   */
  private async notifyCancellation(
    eventId: string,
    tenantId: string,
    eventTitle: string,
    reason?: string,
  ): Promise<void> {
    const registrations = await db('event_registrations')
      .where({ event_id: eventId, status: 'confirmed' })
      .select('user_id');

    if (registrations.length === 0) return;

    const message = reason
      ? `"${eventTitle}" has been cancelled. Reason: ${reason}`
      : `"${eventTitle}" has been cancelled.`;

    const notifications = registrations.map((r: any) => ({
      user_id: r.user_id,
      tenant_id: tenantId,
      type: 'event_cancelled',
      title: `Event cancelled: "${eventTitle}"`,
      message,
      is_read: false,
      created_at: db.fn.now(),
    }));

    // Insert in batches of 100
    for (let i = 0; i < notifications.length; i += 100) {
      await db('in_app_notifications')
        .insert(notifications.slice(i, i + 100))
        .catch(() => null); // Table may not exist in all deployments
    }

    logger.info(`Sent cancellation notifications for event ${eventId} to ${registrations.length} users`);
  }
}

export default new EventService();
