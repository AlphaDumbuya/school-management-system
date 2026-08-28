/**
 * Event Recurrence Service
 * Handles recurring event generation and management
 * Phase 2.2 - Events Management Module
 */

import { Knex } from 'knex';
import db from '../utils/database.js';
import { Event, RecurrencePatternDTO } from '../types/event.js';
import { logger } from '../utils/logger.js';

export class EventRecurrenceService {
  /**
   * Create recurring event instances
   */
  async createRecurringEvents(
    trx: Knex.Transaction,
    parentEvent: Event,
    pattern: RecurrencePatternDTO
  ): Promise<void> {
    try {
      const occurrences = this.generateOccurrences(
        parentEvent.start_date,
        parentEvent.end_date,
        pattern
      );

      // Create recurrence record
      await trx('event_recurrence').insert({
        event_id: parentEvent.event_id,
        parent_event_id: null,
        recurrence_pattern: pattern.pattern,
        recurrence_interval: pattern.interval || 1,
        recurrence_days: pattern.days ? JSON.stringify(pattern.days) : null,
        recurrence_end_date: pattern.end_date,
        recurrence_count: pattern.count,
      });

      // Create event instances for each occurrence
      for (const occurrence of occurrences.slice(1)) {
        // Skip first (already created)
        const duration =
          new Date(parentEvent.end_date).getTime() -
          new Date(parentEvent.start_date).getTime();

        const [childEvent] = await trx('events')
          .insert({
            ...parentEvent,
            event_id: undefined,
            start_date: occurrence,
            end_date: new Date(occurrence.getTime() + duration),
          })
          .returning('*');

        // Link to parent
        await trx('event_recurrence').insert({
          event_id: childEvent.event_id,
          parent_event_id: parentEvent.event_id,
          recurrence_pattern: pattern.pattern,
        });
      }

      logger.info(`Created ${occurrences.length} recurring event instances`, {
        parentEventId: parentEvent.event_id,
      });
    } catch (error) {
      logger.error('Error creating recurring events:', error);
      throw error;
    }
  }

  /**
   * Generate occurrence dates based on pattern
   */
  private generateOccurrences(
    startDate: Date,
    endDate: Date,
    pattern: RecurrencePatternDTO
  ): Date[] {
    const occurrences: Date[] = [];
    const start = new Date(startDate);
    const maxOccurrences = pattern.count || 52; // Default to 1 year weekly
    const endLimit = pattern.end_date
      ? new Date(pattern.end_date)
      : new Date(start.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year max

    let current = new Date(start);
    let count = 0;

    while (count < maxOccurrences && current <= endLimit) {
      occurrences.push(new Date(current));
      current = this.getNextOccurrence(current, pattern);
      count++;
    }

    return occurrences;
  }

  /**
   * Get next occurrence date
   */
  private getNextOccurrence(current: Date, pattern: RecurrencePatternDTO): Date {
    const next = new Date(current);
    const interval = pattern.interval || 1;

    switch (pattern.pattern) {
      case 'daily':
        next.setDate(next.getDate() + interval);
        break;

      case 'weekly':
        next.setDate(next.getDate() + 7 * interval);
        break;

      case 'monthly':
        next.setMonth(next.getMonth() + interval);
        break;

      default:
        next.setDate(next.getDate() + interval);
    }

    return next;
  }

  /**
   * Update recurring series
   */
  async updateRecurringSeries(
    parentEventId: string,
    updateData: any
  ): Promise<void> {
    try {
      // Get all child events
      const childEvents = await this.getRecurringInstances(parentEventId);

      // Update all instances
      for (const child of childEvents) {
        await this.updateSingleInstance(child.event_id, updateData);
      }

      logger.info(`Updated recurring series: ${parentEventId}`, {
        instanceCount: childEvents.length,
      });
    } catch (error) {
      logger.error('Error updating recurring series:', error);
      throw error;
    }
  }

  /**
   * Update a single recurring event instance (by its own event_id).
   * Applies only title, description, location, venue_details, and reminder fields
   * — date/time fields are intentionally excluded to preserve the schedule.
   */
  private async updateSingleInstance(eventId: string, updateData: any): Promise<void> {
    const allowedFields = [
      'title', 'description', 'location', 'location_type', 'venue_details',
      'capacity', 'image_url', 'external_link', 'reminder_enabled',
      'reminder_intervals', 'metadata', 'updated_by', 'updated_at',
    ];

    const safeUpdate: Record<string, any> = { updated_at: db.fn.now() };
    for (const field of allowedFields) {
      if (field in updateData) {
        safeUpdate[field] = updateData[field];
      }
    }

    await db('events').where({ event_id: eventId }).update(safeUpdate);
  }

  /**
   * Fetch all child instances of a recurring series (tenant-safe).
   * Returns events that have a parent_event_id pointing to the given parent.
   */
  private async getRecurringInstances(parentEventId: string): Promise<Event[]> {
    // Look up the parent to get its tenant_id for scoping
    const parent = await db('events').where({ event_id: parentEventId }).first();
    if (!parent) return [];

    const children = await db('events')
      .join('event_recurrence', 'events.event_id', 'event_recurrence.event_id')
      .where('event_recurrence.parent_event_id', parentEventId)
      .where('events.tenant_id', parent.tenant_id) // tenant isolation
      .select('events.*');

    return children;
  }

  /**
   * Delete a recurring series — removes all future child instances and the
   * parent event.  Past instances (already completed) are left in place.
   */
  async deleteRecurringSeries(parentEventId: string): Promise<void> {
    const trx = await db.transaction();
    try {
      // Look up tenant for scoping
      const parent = await trx('events').where({ event_id: parentEventId }).first();
      if (!parent) throw new Error('Recurring series not found');

      const now = new Date();

      // Delete future child instances (and their recurrence records cascade-delete via FK)
      const futureChildren = await trx('events')
        .join('event_recurrence', 'events.event_id', 'event_recurrence.event_id')
        .where('event_recurrence.parent_event_id', parentEventId)
        .where('events.tenant_id', parent.tenant_id)
        .where('events.start_date', '>', now)
        .select('events.event_id');

      for (const child of futureChildren) {
        await trx('events')
          .where({ event_id: child.event_id, tenant_id: parent.tenant_id })
          .delete();
      }

      // Cancel (rather than hard-delete) the parent so historical references are preserved
      await trx('events')
        .where({ event_id: parentEventId, tenant_id: parent.tenant_id })
        .update({ status: 'cancelled', updated_at: trx.fn.now() });

      await trx.commit();
      logger.info(`Deleted recurring series: ${parentEventId} (${futureChildren.length} future instances removed)`);
    } catch (error) {
      await trx.rollback();
      logger.error('Error deleting recurring series:', error);
      throw error;
    }
  }
}

export default new EventRecurrenceService();
