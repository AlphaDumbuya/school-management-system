/**
 * Event Attendance Service Tests  
 * Task 7.1 - Service tests for eventAttendanceService
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eventAttendanceService } from '../eventAttendanceService';
import { eventService } from '../eventService';
import { eventRegistrationService } from '../eventRegistrationService';
import db from '../../config/database';

describe('EventAttendanceService', () => {
    let testEventId: number;
    let testRegistrationId: number;
    let testUserId = 100;

    beforeEach(async () => {
        // Clear test data
        await db('event_attendance').where('tenant_id', 1).del();
        await db('event_registrations').where('tenant_id', 1).del();
        await db('events').where('tenant_id', 1).del();

        // Create test event
        const event = await eventService.createEvent({
            tenant_id: 1,
            title: 'Test Event',
            event_type: 'academic' as const,
            start_datetime: new Date(),
            end_datetime: new Date(Date.now() + 3600000), // 1 hour from now
            organizer_id: 1,
            capacity: 50,
            status: 'published' as const
        });

        testEventId = event.data!.event_id;

        // Create test registration
        const registration = await eventRegistrationService.registerForEvent({
            event_id: testEventId,
            user_id: testUserId,
            tenant_id: 1,
            rsvp_status: 'going'
        });

        testRegistrationId = registration.data!.registration_id;
    });

    afterEach(async () => {
        await db('event_attendance').where('tenant_id', 1).del();
        await db('event_registrations').where('tenant_id', 1).del();
        await db('events').where('tenant_id', 1).del();
    });

    describe('markAttendance', () => {
        it('should mark user as present', async () => {
            const result = await eventAttendanceService.markAttendance({
                event_id: testEventId,
                user_id: testUserId,
                tenant_id: 1,
                status: 'present',
                marked_by_id: 1
            });

            expect(result.success).toBe(true);
            expect(result.data?.status).toBe('present');
            expect(result.data?.user_id).toBe(testUserId);
        });

        it('should mark user as absent', async () => {
            const result = await eventAttendanceService.markAttendance({
                event_id: testEventId,
                user_id: testUserId,
                tenant_id: 1,
                status: 'absent',
                marked_by_id: 1
            });

            expect(result.success).toBe(true);
            expect(result.data?.status).toBe('absent');
        });

        it('should update existing attendance record', async () => {
            // Mark as present first
            await eventAttendanceService.markAttendance({
                event_id: testEventId,
                user_id: testUserId,
                tenant_id: 1,
                status: 'present',
                marked_by_id: 1
            });

            // Update to late
            const result = await eventAttendanceService.markAttendance({
                event_id: testEventId,
                user_id: testUserId,
                tenant_id: 1,
                status: 'late',
                marked_by_id: 1
            });

            expect(result.success).toBe(true);
            expect(result.data?.status).toBe('late');
        });

        it('should allow adding notes', async () => {
            const result = await eventAttendanceService.markAttendance({
                event_id: testEventId,
                user_id: testUserId,
                tenant_id: 1,
                status: 'present',
                marked_by_id: 1,
                notes: 'Arrived early'
            });

            expect(result.success).toBe(true);
            expect(result.data?.notes).toBe('Arrived early');
        });
    });

    describe('checkIn', () => {
        it('should check in a user', async () => {
            const result = await eventAttendanceService.checkIn(
                testEventId,
                testUserId,
                1,
                1
            );

            expect(result.success).toBe(true);
            expect(result.data?.check_in_time).toBeDefined();
            expect(result.data?.status).toBe('present');
        });

        it('should not allow duplicate check-ins', async () => {
            // First check-in
            await eventAttendanceService.checkIn(testEventId, testUserId, 1, 1);

            // Second check-in
            const result = await eventAttendanceService.checkIn(testEventId, testUserId, 1, 1);

            // Should update existing record, not create new one
            expect(result.success).toBe(true);
        });
    });

    describe('checkOut', () => {
        it('should check out a user', async () => {
            // Check in first
            await eventAttendanceService.checkIn(testEventId, testUserId, 1, 1);

            // Check out
            const result = await eventAttendanceService.checkOut(
                testEventId,
                testUserId,
                1,
                1
            );

            expect(result.success).toBe(true);
            expect(result.data?.check_out_time).toBeDefined();
        });

        it('should calculate duration on checkout', async () => {
            // Check in
            await eventAttendanceService.checkIn(testEventId, testUserId, 1, 1);

            // Wait a moment
            await new Promise(resolve => setTimeout(resolve, 100));

            // Check out
            const result = await eventAttendanceService.checkOut(
                testEventId,
                testUserId,
                1,
                1
            );

            expect(result.success).toBe(true);
            expect(result.data?.duration_minutes).toBeGreaterThan(0);
        });
    });

    describe('getEventAttendance', () => {
        beforeEach(async () => {
            // Register multiple users
            const user2 = 101;
            const user3 = 102;

            await eventRegistrationService.registerForEvent({
                event_id: testEventId,
                user_id: user2,
                tenant_id: 1,
                rsvp_status: 'going'
            });

            await eventRegistrationService.registerForEvent({
                event_id: testEventId,
                user_id: user3,
                tenant_id: 1,
                rsvp_status: 'going'
            });

            // Mark attendance for all
            await eventAttendanceService.markAttendance({
                event_id: testEventId,
                user_id: testUserId,
                tenant_id: 1,
                status: 'present',
                marked_by_id: 1
            });

            await eventAttendanceService.markAttendance({
                event_id: testEventId,
                user_id: user2,
                tenant_id: 1,
                status: 'present',
                marked_by_id: 1
            });

            await eventAttendanceService.markAttendance({
                event_id: testEventId,
                user_id: user3,
                tenant_id: 1,
                status: 'absent',
                marked_by_id: 1
            });
        });

        it('should get all attendance records', async () => {
            const result = await eventAttendanceService.getEventAttendance(
                testEventId,
                1,
                { page: 1, limit: 10 }
            );

            expect(result.success).toBe(true);
            expect(result.data!.data.length).toBe(3);
        });

        it('should filter by attendance status', async () => {
            const result = await eventAttendanceService.getEventAttendance(
                testEventId,
                1,
                { page: 1, limit: 10, status: 'present' }
            );

            expect(result.success).toBe(true);
            expect(result.data!.data.every(a => a.status === 'present')).toBe(true);
            expect(result.data!.data.length).toBe(2);
        });
    });

    describe('generateQRCode', () => {
        it('should generate QR code for check-in', async () => {
            const result = await eventAttendanceService.generateQRCode(
                testEventId,
                testUserId,
                1
            );

            expect(result.success).toBe(true);
            expect(result.data?.qr_code).toBeDefined();
            expect(result.data?.qr_code).toContain('event_id');
            expect(result.data?.qr_code).toContain('user_id');
        });

        it('should include expiry in QR code data', async () => {
            const result = await eventAttendanceService.generateQRCode(
                testEventId,
                testUserId,
                1
            );

            expect(result.success).toBe(true);
            const qrData = JSON.parse(result.data!.qr_code);
            expect(qrData.expiry).toBeDefined();
        });
    });

    describe('getAttendanceReport', () => {
        beforeEach(async () => {
            // Register and mark attendance for multiple users
            for (let i = 100; i < 110; i++) {
                await eventRegistrationService.registerForEvent({
                    event_id: testEventId,
                    user_id: i,
                    tenant_id: 1,
                    rsvp_status: 'going'
                });

                const status = i < 107 ? 'present' : 'absent';
                await eventAttendanceService.markAttendance({
                    event_id: testEventId,
                    user_id: i,
                    tenant_id: 1,
                    status,
                    marked_by_id: 1
                });
            }
        });

        it('should generate attendance report with statistics', async () => {
            const result = await eventAttendanceService.getAttendanceReport(
                testEventId,
                1
            );

            expect(result.success).toBe(true);
            expect(result.data?.total_registered).toBe(10);
            expect(result.data?.total_present).toBe(7);
            expect(result.data?.total_absent).toBe(3);
            expect(result.data?.attendance_rate).toBeCloseTo(70, 0);
        });
    });

    describe('getUserAttendanceHistory', () => {
        beforeEach(async () => {
            // Create multiple events and mark attendance
            for (let i = 0; i < 3; i++) {
                const event = await eventService.createEvent({
                    tenant_id: 1,
                    title: `Event ${i}`,
                    event_type: 'academic' as const,
                    start_datetime: new Date(),
                    end_datetime: new Date(Date.now() + 3600000),
                    organizer_id: 1,
                    capacity: 50,
                    status: 'published' as const
                });

                await eventRegistrationService.registerForEvent({
                    event_id: event.data!.event_id,
                    user_id: testUserId,
                    tenant_id: 1,
                    rsvp_status: 'going'
                });

                await eventAttendanceService.markAttendance({
                    event_id: event.data!.event_id,
                    user_id: testUserId,
                    tenant_id: 1,
                    status: 'present',
                    marked_by_id: 1
                });
            }
        });

        it('should get user attendance history across events', async () => {
            const result = await eventAttendanceService.getUserAttendanceHistory(
                testUserId,
                1,
                { page: 1, limit: 10 }
            );

            expect(result.success).toBe(true);
            expect(result.data!.data.length).toBeGreaterThanOrEqual(3);
        });
    });
});
