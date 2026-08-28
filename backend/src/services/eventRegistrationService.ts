/**
 * Event Registration Service
 * Handles event registration, RSVP, capacity management, and waitlist
 * Phase 2.2 - Events Management Module
 */

import db from '../utils/database.js';
import {
  EventRegistration,
  RegisterForEventDTO,
  CapacityInfo,
} from '../types/event.js';
import { logger } from '../utils/logger.js';

export class EventRegistrationService {
  /**
   * Register user for event
   */
  async registerForEvent(
    eventId: string,
    userId: string,
    data: RegisterForEventDTO
  ): Promise<EventRegistration> {
    const trx = await db.transaction();

    try {
      // Get event details — must include tenant_id so we can scope further queries
      const event = await trx('events')
        .where({ event_id: eventId })
        .first();

      if (!event) {
        throw new Error('Event not found');
      }

      if (event.status !== 'published') {
        throw new Error('Event is not open for registration');
      }

      // Check registration deadline
      if (event.registration_deadline) {
        const deadline = new Date(event.registration_deadline);
        if (new Date() > deadline) {
          throw new Error('Registration deadline has passed');
        }
      }

      // Check if already registered
      const existing = await trx('event_registrations')
        .where({ event_id: eventId, user_id: userId })
        .first();

      if (existing) {
        throw new Error('Already registered for this event');
      }

      // Check capacity
      const capacity = await this.checkCapacity(trx, eventId, event.capacity);

      let status = 'confirmed';
      if (event.capacity && capacity.is_full) {
        status = 'waitlist';
      }

      if (event.approval_required) {
        status = 'pending';
      }

      // Validate guest count
      const guestsCount = data.guests_count || 0;
      if (guestsCount > 0 && !event.allow_guests) {
        throw new Error('Guests are not allowed for this event');
      }

      if (guestsCount > event.max_guests_per_registration) {
        throw new Error(
          `Maximum ${event.max_guests_per_registration} guests allowed per registration`
        );
      }

      // Create registration
      const [registration] = await trx('event_registrations')
        .insert({
          event_id: eventId,
          user_id: userId,
          status,
          rsvp_status: data.rsvp_status,
          guests_count: guestsCount,
          registration_data: data.registration_data
            ? JSON.stringify(data.registration_data)
            : null,
          approval_status: event.approval_required ? 'pending' : null,
        })
        .returning('*');

      await trx.commit();

      logger.info(`User registered for event: ${eventId}`, {
        userId,
        status,
      });

      // Send in-app confirmation notification (fire-and-forget — don't fail the registration)
      this.sendEventNotification(eventId, userId, 'event_registration_confirmed', {
        title: `Registration confirmed: "${event.title}"`,
        message: status === 'waitlist'
          ? `You have been added to the waitlist for "${event.title}".`
          : status === 'pending'
          ? `Your registration for "${event.title}" is pending approval.`
          : `You are registered for "${event.title}" on ${new Date(event.start_date).toLocaleDateString()}.`,
        tenantId: event.tenant_id,
      }).catch((err) => logger.warn('Could not send registration notification:', err));

      return registration;
    } catch (error) {
      await trx.rollback();
      logger.error('Error registering for event:', error);
      throw error;
    }
  }

  /**
   * Cancel registration
   */
  async cancelRegistration(
    registrationId: string,
    userId: string
  ): Promise<void> {
    const trx = await db.transaction();

    try {
      const registration = await trx('event_registrations')
        .where({ registration_id: registrationId, user_id: userId })
        .first();

      if (!registration) {
        throw new Error('Registration not found');
      }

      if (registration.status === 'cancelled') {
        throw new Error('Registration already cancelled');
      }

      // Update status to cancelled
      await trx('event_registrations')
        .where({ registration_id: registrationId })
        .update({
          status: 'cancelled',
          updated_at: db.fn.now(),
        });

      // Check if someone from waitlist can be moved
      await this.processWaitlist(trx, registration.event_id);

      await trx.commit();

      logger.info(`Registration cancelled: ${registrationId}`, { userId });

      // Send in-app cancellation notification (fire-and-forget)
      const event = await db('events').where({ event_id: registration.event_id }).first();
      if (event) {
        this.sendEventNotification(registration.event_id, userId, 'event_registration_cancelled', {
          title: `Registration cancelled: "${event.title}"`,
          message: `Your registration for "${event.title}" has been cancelled.`,
          tenantId: event.tenant_id,
        }).catch((err) => logger.warn('Could not send cancellation notification:', err));
      }
    } catch (error) {
      await trx.rollback();
      logger.error('Error cancelling registration:', error);
      throw error;
    }
  }

  /**
   * Update RSVP status
   */
  async updateRSVPStatus(
    registrationId: string,
    userId: string,
    rsvpStatus: 'going' | 'maybe' | 'not_going'
  ): Promise<EventRegistration> {
    try {
      const [updated] = await db('event_registrations')
        .where({ registration_id: registrationId, user_id: userId })
        .update({
          rsvp_status: rsvpStatus,
          updated_at: db.fn.now(),
        })
        .returning('*');

      if (!updated) {
        throw new Error('Registration not found');
      }

      logger.info(`RSVP status updated: ${registrationId}`, {
        userId,
        rsvpStatus,
      });

      return updated;
    } catch (error) {
      logger.error('Error updating RSVP status:', error);
      throw error;
    }
  }

  /**
   * Approve registration (for events requiring approval)
   */
  async approveRegistration(
    registrationId: string,
    approverId: string
  ): Promise<EventRegistration> {
    const trx = await db.transaction();

    try {
      const registration = await trx('event_registrations')
        .where({ registration_id: registrationId })
        .first();

      if (!registration) {
        throw new Error('Registration not found');
      }

      if (registration.approval_status !== 'pending') {
        throw new Error('Registration is not pending approval');
      }

      // Check capacity before approving
      const event = await trx('events')
        .where({ event_id: registration.event_id })
        .first();

      const capacity = await this.checkCapacity(
        trx,
        registration.event_id,
        event?.capacity
      );

      let status = 'confirmed';
      if (event?.capacity && capacity.is_full) {
        status = 'waitlist';
      }

      const [updated] = await trx('event_registrations')
        .where({ registration_id: registrationId })
        .update({
          approval_status: 'approved',
          status,
          approved_by: approverId,
          approved_at: db.fn.now(),
          updated_at: db.fn.now(),
        })
        .returning('*');

      await trx.commit();

      logger.info(`Registration approved: ${registrationId}`, { approverId });

      // Send in-app approval notification (fire-and-forget)
      const approvedEvent = await db('events').where({ event_id: registration.event_id }).first();
      if (approvedEvent) {
        this.sendEventNotification(registration.event_id, registration.user_id, 'event_registration_approved', {
          title: `Registration approved: "${approvedEvent.title}"`,
          message: `Your registration for "${approvedEvent.title}" has been approved. See you there!`,
          tenantId: approvedEvent.tenant_id,
        }).catch((err) => logger.warn('Could not send approval notification:', err));
      }

      return updated;
    } catch (error) {
      await trx.rollback();
      logger.error('Error approving registration:', error);
      throw error;
    }
  }

  /**
   * Reject registration
   */
  async rejectRegistration(
    registrationId: string,
    approverId: string,
    reason?: string
  ): Promise<EventRegistration> {
    try {
      const [updated] = await db('event_registrations')
        .where({ registration_id: registrationId })
        .update({
          approval_status: 'rejected',
          status: 'cancelled',
          approved_by: approverId,
          approved_at: db.fn.now(),
          notes: reason || null,
          updated_at: db.fn.now(),
        })
        .returning('*');

      if (!updated) {
        throw new Error('Registration not found');
      }

      logger.info(`Registration rejected: ${registrationId}`, {
        approverId,
        reason,
      });

      // Send in-app rejection notification (fire-and-forget)
      const event = await db('events').where({ event_id: updated.event_id }).first();
      if (event) {
        this.sendEventNotification(updated.event_id, updated.user_id, 'event_registration_rejected', {
          title: `Registration not approved: "${event.title}"`,
          message: reason
            ? `Your registration for "${event.title}" was not approved. Reason: ${reason}`
            : `Your registration for "${event.title}" was not approved.`,
          tenantId: event.tenant_id,
        }).catch((err) => logger.warn('Could not send rejection notification:', err));
      }

      return updated;
    } catch (error) {
      logger.error('Error rejecting registration:', error);
      throw error;
    }
  }

  /**
   * Get event registrations
   */
  async getEventRegistrations(
    eventId: string,
    filters?: { status?: string }
  ): Promise<EventRegistration[]> {
    try {
      let query = db('event_registrations')
        .where({ event_id: eventId })
        .orderBy('created_at', 'asc');

      if (filters?.status) {
        query = query.where({ status: filters.status });
      }

      const registrations = await query;

      // Parse JSON fields
      registrations.forEach((reg) => {
        if (reg.registration_data) {
          reg.registration_data = JSON.parse(reg.registration_data);
        }
      });

      return registrations;
    } catch (error) {
      logger.error('Error getting event registrations:', error);
      throw new Error('Failed to get event registrations');
    }
  }

  /**
   * Get user's registrations
   */
  async getUserRegistrations(
    userId: string,
    filters?: { upcoming?: boolean }
  ): Promise<any[]> {
    try {
      let query = db('event_registrations')
        .join('events', 'event_registrations.event_id', 'events.event_id')
        .where('event_registrations.user_id', userId)
        .where('event_registrations.status', '!=', 'cancelled')
        .select(
          'event_registrations.*',
          'events.title',
          'events.start_date',
          'events.end_date',
          'events.location',
          'events.status as event_status'
        )
        .orderBy('events.start_date', 'asc');

      if (filters?.upcoming) {
        query = query.where('events.start_date', '>', new Date());
      }

      const registrations = await query;

      return registrations;
    } catch (error) {
      logger.error('Error getting user registrations:', error);
      throw new Error('Failed to get user registrations');
    }
  }

  /**
   * Check event capacity
   */
  async checkCapacity(
    trxOrDb: any,
    eventId: string,
    capacity?: number
  ): Promise<CapacityInfo> {
    try {
      if (!capacity) {
        return {
          capacity: 0,
          registered: 0,
          available: -1, // Unlimited
          waitlist: 0,
          is_full: false,
        };
      }

      const stats = await trxOrDb('event_registrations')
        .where({ event_id: eventId })
        .select(
          trxOrDb.raw(
            "COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed"
          ),
          trxOrDb.raw(
            "COUNT(*) FILTER (WHERE status = 'waitlist') as waitlist"
          )
        )
        .first();

      const confirmed = parseInt(stats?.confirmed || '0');
      const waitlist = parseInt(stats?.waitlist || '0');
      const available = capacity - confirmed;
      const isFull = confirmed >= capacity;

      return {
        capacity,
        registered: confirmed,
        available: Math.max(0, available),
        waitlist,
        is_full: isFull,
      };
    } catch (error) {
      logger.error('Error checking capacity:', error);
      throw new Error('Failed to check capacity');
    }
  }

  /**
   * Get registration by ID
   */
  async getRegistration(
    registrationId: string
  ): Promise<EventRegistration | null> {
    try {
      const registration = await db('event_registrations')
        .where({ registration_id: registrationId })
        .first();

      if (!registration) {
        return null;
      }

      if (registration.registration_data) {
        registration.registration_data = JSON.parse(
          registration.registration_data
        );
      }

      return registration;
    } catch (error) {
      logger.error('Error getting registration:', error);
      throw new Error('Failed to get registration');
    }
  }

  /**
   * Process waitlist (move users from waitlist to confirmed when space available)
   */
  private async processWaitlist(trx: any, eventId: string): Promise<void> {
    try {
      // Get event capacity
      const event = await trx('events').where({ event_id: eventId }).first();

      if (!event?.capacity) {
        return; // No capacity limit
      }

      const capacity = await this.checkCapacity(trx, eventId, event.capacity);

      if (capacity.available <= 0) {
        return; // No space available
      }

      // Get waitlist users (ordered by registration time)
      const waitlistUsers = await trx('event_registrations')
        .where({ event_id: eventId, status: 'waitlist' })
        .orderBy('created_at', 'asc')
        .limit(capacity.available);

      // Move to confirmed
      for (const registration of waitlistUsers) {
        await trx('event_registrations')
          .where({ registration_id: registration.registration_id })
          .update({
            status: 'confirmed',
            updated_at: db.fn.now(),
          });

        logger.info(
          `Moved from waitlist to confirmed: ${registration.registration_id}`
        );

        // Send in-app promotion notification (fire-and-forget)
        const event = await db('events').where({ event_id: eventId }).first();
        if (event) {
          this.sendEventNotification(eventId, registration.user_id, 'event_waitlist_promoted', {
            title: `Spot available: "${event.title}"`,
            message: `Good news! A spot opened up for "${event.title}" and your registration has been confirmed.`,
            tenantId: event.tenant_id,
          }).catch((err) => logger.warn('Could not send waitlist promotion notification:', err));
        }
      }
    } catch (error) {
      logger.error('Error processing waitlist:', error);
      // Don't throw - this is a background operation
    }
  }

  /**
   * Get registration statistics
   */
  async getRegistrationStats(eventId: string): Promise<{
    total: number;
    confirmed: number;
    waitlist: number;
    pending: number;
    cancelled: number;
    capacity_info: CapacityInfo;
  }> {
    try {
      const event = await db('events').where({ event_id: eventId }).first();

      const stats = await db('event_registrations')
        .where({ event_id: eventId })
        .select(
          db.raw("COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed"),
          db.raw("COUNT(*) FILTER (WHERE status = 'waitlist') as waitlist"),
          db.raw("COUNT(*) FILTER (WHERE status = 'pending') as pending"),
          db.raw("COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled"),
          db.raw('COUNT(*) as total')
        )
        .first();

      const capacityInfo = await this.checkCapacity(
        db,
        eventId,
        event?.capacity
      );

      return {
        total: parseInt(stats?.total || '0'),
        confirmed: parseInt(stats?.confirmed || '0'),
        waitlist: parseInt(stats?.waitlist || '0'),
        pending: parseInt(stats?.pending || '0'),
        cancelled: parseInt(stats?.cancelled || '0'),
        capacity_info: capacityInfo,
      };
    } catch (error) {
      logger.error('Error getting registration stats:', error);
      throw new Error('Failed to get registration statistics');
    }
  }

  /**
   * Send an in-app notification for an event action.
   * This is a fire-and-forget helper — callers must .catch() it themselves.
   * Inserts directly into in_app_notifications to avoid coupling to the
   * full notificationService (which uses a different schema).
   */
  private async sendEventNotification(
    eventId: string,
    userId: string,
    type: string,
    payload: { title: string; message: string; tenantId: string },
  ): Promise<void> {
    await db('in_app_notifications').insert({
      user_id: userId,
      tenant_id: payload.tenantId,
      type,
      title: payload.title,
      message: payload.message,
      is_read: false,
      created_at: db.fn.now(),
    });
  }
}

export default new EventRegistrationService();
