/**
 * Event Registration Service Tests
 * Task 7.1 - Service tests for eventRegistrationService
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eventRegistrationService } from '../eventRegistrationService';
import { eventService } from '../eventService';
import db from '../../config/database';

describe('EventRegistrationService', () => {
    let testEventId: number;

    beforeEach(async () => {
        // Clear test data
        await db('event_registrations').where('tenant_id', 1).del();
        await db('events').where('tenant_id', 1).del();

        // Create test event
        const event = await eventService.createEvent({
            tenant_id: 1,
            title: 'Test Event',
            event_type: 'academic' as const,
            start_datetime: new Date('2026-08-15T09:00:00'),
            end_datetime: new Date('2026-08-15T17:00:00'),
            organizer_id: 1,
            capacity: 50,
            status: 'published' as const,
            requires_approval: false
        });

        testEventId = event.data!.event_id;
    });

    afterEach(async () => {
        await db('event_registrations').where('tenant_id', 1).del();
        await db('events').where('tenant_id', 1).del();
    });

    describe('registerForEvent', () => {
        it('should register user for event successfully', async () => {
            const result = await eventRegistrationService.registerForEvent({
                event_id: testEventId,
                user_id: 100,
                tenant_id: 1,
                rsvp_status: 'going',
                guest_count: 1
            });

            expect(result.success).toBe(true);
            expect(result.data?.event_id).toBe(testEventId);
            expect(result.data?.user_id).toBe(100);
            expect(result.data?.rsvp_status).toBe('going');
        });

        it('should prevent duplicate registrations', async () => {
            // First registration
            await eventRegistrationService.registerForEvent({
                event_id: testEventId,
                user_id: 100,
                tenant_id: 1,
                rsvp_status: 'going'
            });

            // Second registration (duplicate)
            const result = await eventRegistrationService.registerForEvent({
                event_id: testEventId,
                user_id: 100,
                tenant_id: 1,
                rsvp_status: 'going'
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('already registered');
        });

        it('should handle capacity limits', async () => {
            // Create event with capacity of 1
            const limitedEvent = await eventService.createEvent({
                tenant_id: 1,
                title: 'Limited Event',
                event_type: 'academic' as const,
                start_datetime: new Date('2026-08-15T09:00:00'),
                end_datetime: new Date('2026-08-15T17:00:00'),
                organizer_id: 1,
                capacity: 1,
                status: 'published' as const
            });

            const eventId = limitedEvent.data!.event_id;

            // First registration (should succeed)
            const firstReg = await eventRegistrationService.registerForEvent({
                event_id: eventId,
                user_id: 100,
                tenant_id: 1,
                rsvp_status: 'going'
            });

            expect(firstReg.success).toBe(true);

            // Second registration (should fail - at capacity)
            const secondReg = await eventRegistrationService.registerForEvent({
                event_id: eventId,
                user_id: 101,
                tenant_id: 1,
                rsvp_status: 'going'
            });

            expect(secondReg.success).toBe(false);
            expect(secondReg.error).toContain('capacity');
        });

        it('should add to waitlist when event is full', async () => {
            // Create event with capacity of 1
            const limitedEvent = await eventService.createEvent({
                tenant_id: 1,
                title: 'Waitlist Event',
                event_type: 'academic' as const,
                start_datetime: new Date('2026-08-15T09:00:00'),
                end_datetime: new Date('2026-08-15T17:00:00'),
                organizer_id: 1,
                capacity: 1,
                status: 'published' as const,
                enable_waitlist: true
            });

            const eventId = limitedEvent.data!.event_id;

            // First registration
            await eventRegistrationService.registerForEvent({
                event_id: eventId,
                user_id: 100,
                tenant_id: 1,
                rsvp_status: 'going'
            });

            // Second registration (should be waitlisted)
            const result = await eventRegistrationService.registerForEvent({
                event_id: eventId,
                user_id: 101,
                tenant_id: 1,
                rsvp_status: 'going'
            });

            expect(result.success).toBe(true);
            expect(result.data?.is_waitlisted).toBe(true);
        });
    });

    describe('cancelRegistration', () => {
        it('should cancel a registration', async () => {
            // Create registration
            const registration = await eventRegistrationService.registerForEvent({
                event_id: testEventId,
                user_id: 100,
                tenant_id: 1,
                rsvp_status: 'going'
            });

            const registrationId = registration.data!.registration_id;

            // Cancel registration
            const result = await eventRegistrationService.cancelRegistration(
                registrationId,
                100,
                1
            );

            expect(result.success).toBe(true);
        });

        it('should not allow cancellation by other users', async () => {
            // Create registration for user 100
            const registration = await eventRegistrationService.registerForEvent({
                event_id: testEventId,
                user_id: 100,
                tenant_id: 1,
                rsvp_status: 'going'
            });

            const registrationId = registration.data!.registration_id;

            // Try to cancel as user 101
            const result = await eventRegistrationService.cancelRegistration(
                registrationId,
                101,
                1
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('not authorized');
        });
    });

    describe('updateRSVPStatus', () => {
        it('should update RSVP status', async () => {
            const registration = await eventRegistrationService.registerForEvent({
                event_id: testEventId,
                user_id: 100,
                tenant_id: 1,
                rsvp_status: 'maybe'
            });

            const registrationId = registration.data!.registration_id;

            const result = await eventRegistrationService.updateRSVPStatus(
                registrationId,
                100,
                1,
                'going'
            );

            expect(result.success).toBe(true);
            expect(result.data?.rsvp_status).toBe('going');
        });
    });

    describe('getEventRegistrations', () => {
        beforeEach(async () => {
            // Create multiple registrations
            await eventRegistrationService.registerForEvent({
                event_id: testEventId,
                user_id: 100,
                tenant_id: 1,
                rsvp_status: 'going'
            });

            await eventRegistrationService.registerForEvent({
                event_id: testEventId,
                user_id: 101,
                tenant_id: 1,
                rsvp_status: 'maybe'
            });

            await eventRegistrationService.registerForEvent({
                event_id: testEventId,
                user_id: 102,
                tenant_id: 1,
                rsvp_status: 'not_going'
            });
        });

        it('should get all registrations for an event', async () => {
            const result = await eventRegistrationService.getEventRegistrations(
                testEventId,
                1,
                { page: 1, limit: 10 }
            );

            expect(result.success).toBe(true);
            expect(result.data!.data.length).toBe(3);
        });

        it('should filter by RSVP status', async () => {
            const result = await eventRegistrationService.getEventRegistrations(
                testEventId,
                1,
                { page: 1, limit: 10, rsvp_status: 'going' }
            );

            expect(result.success).toBe(true);
            expect(result.data!.data.every(r => r.rsvp_status === 'going')).toBe(true);
        });
    });

    describe('getUserRegistrations', () => {
        beforeEach(async () => {
            // Create second event
            const event2 = await eventService.createEvent({
                tenant_id: 1,
                title: 'Second Event',
                event_type: 'sports' as const,
                start_datetime: new Date('2026-09-15T09:00:00'),
                end_datetime: new Date('2026-09-15T17:00:00'),
                organizer_id: 1,
                capacity: 50,
                status: 'published' as const
            });

            // Register for both events
            await eventRegistrationService.registerForEvent({
                event_id: testEventId,
                user_id: 100,
                tenant_id: 1,
                rsvp_status: 'going'
            });

            await eventRegistrationService.registerForEvent({
                event_id: event2.data!.event_id,
                user_id: 100,
                tenant_id: 1,
                rsvp_status: 'maybe'
            });
        });

        it('should get all registrations for a user', async () => {
            const result = await eventRegistrationService.getUserRegistrations(
                100,
                1,
                { page: 1, limit: 10 }
            );

            expect(result.success).toBe(true);
            expect(result.data!.data.length).toBe(2);
        });
    });

    describe('approveRegistration', () => {
        it('should approve a pending registration', async () => {
            // Create event requiring approval
            const approvalEvent = await eventService.createEvent({
                tenant_id: 1,
                title: 'Approval Required Event',
                event_type: 'academic' as const,
                start_datetime: new Date('2026-08-15T09:00:00'),
                end_datetime: new Date('2026-08-15T17:00:00'),
                organizer_id: 1,
                capacity: 50,
                status: 'published' as const,
                requires_approval: true
            });

            const eventId = approvalEvent.data!.event_id;

            // Register (will be pending)
            const registration = await eventRegistrationService.registerForEvent({
                event_id: eventId,
                user_id: 100,
                tenant_id: 1,
                rsvp_status: 'going'
            });

            const registrationId = registration.data!.registration_id;

            // Approve registration
            const result = await eventRegistrationService.approveRegistration(
                registrationId,
                1,
                1
            );

            expect(result.success).toBe(true);
            expect(result.data?.approval_status).toBe('approved');
        });
    });

    describe('getEventCapacity', () => {
        it('should return correct capacity information', async () => {
            // Register 2 users
            await eventRegistrationService.registerForEvent({
                event_id: testEventId,
                user_id: 100,
                tenant_id: 1,
                rsvp_status: 'going'
            });

            await eventRegistrationService.registerForEvent({
                event_id: testEventId,
                user_id: 101,
                tenant_id: 1,
                rsvp_status: 'going'
            });

            const result = await eventRegistrationService.getEventCapacity(testEventId, 1);

            expect(result.success).toBe(true);
            expect(result.data?.total_capacity).toBe(50);
            expect(result.data?.registered_count).toBe(2);
            expect(result.data?.available_spots).toBe(48);
        });
    });
});
