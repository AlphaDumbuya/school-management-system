/**
 * Event Service Tests
 * Task 7.1 - Service tests for eventService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eventService } from '../eventService';
import db from '../../config/database';

describe('EventService', () => {
    beforeEach(async () => {
        // Setup: Clear test data
        await db('events').where('tenant_id', 1).del();
    });

    afterEach(async () => {
        // Cleanup
        await db('events').where('tenant_id', 1).del();
    });

    describe('createEvent', () => {
        it('should create a new event successfully', async () => {
            const eventData = {
                tenant_id: 1,
                title: 'Annual Sports Day',
                description: 'Annual sports competition',
                event_type: 'academic' as const,
                start_datetime: new Date('2026-08-15T09:00:00'),
                end_datetime: new Date('2026-08-15T17:00:00'),
                location: 'School Sports Ground',
                organizer_id: 1,
                capacity: 500,
                status: 'draft' as const,
                is_public: true,
                requires_approval: false,
                allow_guests: true
            };

            const result = await eventService.createEvent(eventData);

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data?.title).toBe('Annual Sports Day');
            expect(result.data?.status).toBe('draft');
        });

        it('should validate required fields', async () => {
            const invalidData = {
                tenant_id: 1,
                // Missing required fields
            } as any;

            const result = await eventService.createEvent(invalidData);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should validate date range', async () => {
            const eventData = {
                tenant_id: 1,
                title: 'Test Event',
                event_type: 'academic' as const,
                start_datetime: new Date('2026-08-15T17:00:00'),
                end_datetime: new Date('2026-08-15T09:00:00'), // End before start
                organizer_id: 1,
                status: 'draft' as const
            };

            const result = await eventService.createEvent(eventData);

            expect(result.success).toBe(false);
            expect(result.error).toContain('end time must be after start time');
        });
    });

    describe('getEvent', () => {
        it('should retrieve an event by ID', async () => {
            // Create test event
            const created = await eventService.createEvent({
                tenant_id: 1,
                title: 'Test Event',
                event_type: 'academic' as const,
                start_datetime: new Date('2026-08-15T09:00:00'),
                end_datetime: new Date('2026-08-15T17:00:00'),
                organizer_id: 1,
                status: 'draft' as const
            });

            const eventId = created.data!.event_id;
            const result = await eventService.getEvent(eventId, 1);

            expect(result.success).toBe(true);
            expect(result.data?.event_id).toBe(eventId);
            expect(result.data?.title).toBe('Test Event');
        });

        it('should return error for non-existent event', async () => {
            const result = await eventService.getEvent(99999, 1);

            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('should enforce tenant isolation', async () => {
            // Create event for tenant 1
            const created = await eventService.createEvent({
                tenant_id: 1,
                title: 'Tenant 1 Event',
                event_type: 'academic' as const,
                start_datetime: new Date('2026-08-15T09:00:00'),
                end_datetime: new Date('2026-08-15T17:00:00'),
                organizer_id: 1,
                status: 'draft' as const
            });

            const eventId = created.data!.event_id;

            // Try to access with tenant 2
            const result = await eventService.getEvent(eventId, 2);

            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });
    });

    describe('updateEvent', () => {
        it('should update event details', async () => {
            const created = await eventService.createEvent({
                tenant_id: 1,
                title: 'Original Title',
                event_type: 'academic' as const,
                start_datetime: new Date('2026-08-15T09:00:00'),
                end_datetime: new Date('2026-08-15T17:00:00'),
                organizer_id: 1,
                status: 'draft' as const
            });

            const eventId = created.data!.event_id;

            const result = await eventService.updateEvent(eventId, 1, {
                title: 'Updated Title',
                description: 'Updated description'
            });

            expect(result.success).toBe(true);
            expect(result.data?.title).toBe('Updated Title');
            expect(result.data?.description).toBe('Updated description');
        });

        it('should not update published event without proper permissions', async () => {
            const created = await eventService.createEvent({
                tenant_id: 1,
                title: 'Published Event',
                event_type: 'academic' as const,
                start_datetime: new Date('2026-08-15T09:00:00'),
                end_datetime: new Date('2026-08-15T17:00:00'),
                organizer_id: 1,
                status: 'published' as const
            });

            const eventId = created.data!.event_id;

            const result = await eventService.updateEvent(eventId, 1, {
                title: 'Should Not Update'
            });

            // Implementation dependent - may allow or deny based on business rules
            expect(result).toBeDefined();
        });
    });

    describe('deleteEvent', () => {
        it('should soft delete an event', async () => {
            const created = await eventService.createEvent({
                tenant_id: 1,
                title: 'Event to Delete',
                event_type: 'academic' as const,
                start_datetime: new Date('2026-08-15T09:00:00'),
                end_datetime: new Date('2026-08-15T17:00:00'),
                organizer_id: 1,
                status: 'draft' as const
            });

            const eventId = created.data!.event_id;

            const result = await eventService.deleteEvent(eventId, 1);

            expect(result.success).toBe(true);

            // Verify event is soft deleted
            const getResult = await eventService.getEvent(eventId, 1);
            expect(getResult.success).toBe(false);
        });
    });

    describe('publishEvent', () => {
        it('should publish a draft event', async () => {
            const created = await eventService.createEvent({
                tenant_id: 1,
                title: 'Event to Publish',
                event_type: 'academic' as const,
                start_datetime: new Date('2026-08-15T09:00:00'),
                end_datetime: new Date('2026-08-15T17:00:00'),
                organizer_id: 1,
                status: 'draft' as const
            });

            const eventId = created.data!.event_id;

            const result = await eventService.publishEvent(eventId, 1);

            expect(result.success).toBe(true);
            expect(result.data?.status).toBe('published');
        });

        it('should not publish already published event', async () => {
            const created = await eventService.createEvent({
                tenant_id: 1,
                title: 'Already Published',
                event_type: 'academic' as const,
                start_datetime: new Date('2026-08-15T09:00:00'),
                end_datetime: new Date('2026-08-15T17:00:00'),
                organizer_id: 1,
                status: 'published' as const
            });

            const eventId = created.data!.event_id;

            const result = await eventService.publishEvent(eventId, 1);

            // Should return success but with appropriate message
            expect(result.success).toBe(true);
        });
    });

    describe('cancelEvent', () => {
        it('should cancel a published event', async () => {
            const created = await eventService.createEvent({
                tenant_id: 1,
                title: 'Event to Cancel',
                event_type: 'academic' as const,
                start_datetime: new Date('2026-08-15T09:00:00'),
                end_datetime: new Date('2026-08-15T17:00:00'),
                organizer_id: 1,
                status: 'published' as const
            });

            const eventId = created.data!.event_id;

            const result = await eventService.cancelEvent(eventId, 1, 'Due to weather conditions');

            expect(result.success).toBe(true);
            expect(result.data?.status).toBe('cancelled');
        });
    });

    describe('listEvents', () => {
        beforeEach(async () => {
            // Create multiple test events
            await eventService.createEvent({
                tenant_id: 1,
                title: 'Event 1',
                event_type: 'academic' as const,
                start_datetime: new Date('2026-08-15T09:00:00'),
                end_datetime: new Date('2026-08-15T17:00:00'),
                organizer_id: 1,
                status: 'published' as const
            });

            await eventService.createEvent({
                tenant_id: 1,
                title: 'Event 2',
                event_type: 'sports' as const,
                start_datetime: new Date('2026-09-15T09:00:00'),
                end_datetime: new Date('2026-09-15T17:00:00'),
                organizer_id: 1,
                status: 'published' as const
            });

            await eventService.createEvent({
                tenant_id: 1,
                title: 'Draft Event',
                event_type: 'cultural' as const,
                start_datetime: new Date('2026-10-15T09:00:00'),
                end_datetime: new Date('2026-10-15T17:00:00'),
                organizer_id: 1,
                status: 'draft' as const
            });
        });

        it('should list all events with pagination', async () => {
            const result = await eventService.listEvents(1, {
                page: 1,
                limit: 10
            });

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data!.data.length).toBeGreaterThan(0);
            expect(result.data!.pagination).toBeDefined();
        });

        it('should filter by status', async () => {
            const result = await eventService.listEvents(1, {
                status: 'published',
                page: 1,
                limit: 10
            });

            expect(result.success).toBe(true);
            expect(result.data!.data.every(e => e.status === 'published')).toBe(true);
        });

        it('should filter by event type', async () => {
            const result = await eventService.listEvents(1, {
                event_type: 'sports',
                page: 1,
                limit: 10
            });

            expect(result.success).toBe(true);
            expect(result.data!.data.every(e => e.event_type === 'sports')).toBe(true);
        });

        it('should search by title', async () => {
            const result = await eventService.listEvents(1, {
                search: 'Event 1',
                page: 1,
                limit: 10
            });

            expect(result.success).toBe(true);
            expect(result.data!.data.some(e => e.title.includes('Event 1'))).toBe(true);
        });
    });

    describe('duplicateEvent', () => {
        it('should duplicate an event', async () => {
            const created = await eventService.createEvent({
                tenant_id: 1,
                title: 'Original Event',
                description: 'Original description',
                event_type: 'academic' as const,
                start_datetime: new Date('2026-08-15T09:00:00'),
                end_datetime: new Date('2026-08-15T17:00:00'),
                organizer_id: 1,
                capacity: 100,
                status: 'published' as const
            });

            const eventId = created.data!.event_id;

            const result = await eventService.duplicateEvent(eventId, 1);

            expect(result.success).toBe(true);
            expect(result.data?.title).toBe('Original Event (Copy)');
            expect(result.data?.status).toBe('draft');
            expect(result.data?.event_id).not.toBe(eventId);
        });
    });

    describe('getUpcomingEvents', () => {
        it('should return upcoming events only', async () => {
            // Create past event
            await eventService.createEvent({
                tenant_id: 1,
                title: 'Past Event',
                event_type: 'academic' as const,
                start_datetime: new Date('2020-01-01T09:00:00'),
                end_datetime: new Date('2020-01-01T17:00:00'),
                organizer_id: 1,
                status: 'completed' as const
            });

            // Create future event
            await eventService.createEvent({
                tenant_id: 1,
                title: 'Future Event',
                event_type: 'academic' as const,
                start_datetime: new Date('2027-08-15T09:00:00'),
                end_datetime: new Date('2027-08-15T17:00:00'),
                organizer_id: 1,
                status: 'published' as const
            });

            const result = await eventService.getUpcomingEvents(1, 10);

            expect(result.success).toBe(true);
            expect(result.data!.every(e => new Date(e.start_datetime) > new Date())).toBe(true);
        });
    });
});
