/**
 * Event Routes Integration Tests
 * Task 7.3 - API endpoint integration tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../index';
import db from '../../config/database';

describe('Event Routes Integration Tests', () => {
    let authToken: string;
    let testEventId: number;

    beforeEach(async () => {
        // Clear test data
        await db('event_registrations').where('tenant_id', 1).del();
        await db('events').where('tenant_id', 1).del();

        // Get auth token (mock authentication)
        const loginResponse = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: 'admin@school.local',
                password: 'test123',
            });

        authToken = loginResponse.body.token;
    });

    afterEach(async () => {
        await db('event_registrations').where('tenant_id', 1).del();
        await db('events').where('tenant_id', 1).del();
    });

    describe('POST /api/v1/events - Create Event', () => {
        it('should create a new event', async () => {
            const response = await request(app)
                .post('/api/v1/events')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Annual Science Fair',
                    description: 'Student science project exhibition',
                    event_type: 'academic',
                    start_datetime: '2026-09-15T09:00:00',
                    end_datetime: '2026-09-15T17:00:00',
                    location: 'Science Lab',
                    capacity: 100,
                    is_public: true,
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.title).toBe('Annual Science Fair');
            expect(response.body.data.event_id).toBeDefined();

            testEventId = response.body.data.event_id;
        });

        it('should return 401 without authentication', async () => {
            const response = await request(app)
                .post('/api/v1/events')
                .send({
                    title: 'Test Event',
                    event_type: 'academic',
                });

            expect(response.status).toBe(401);
        });

        it('should validate required fields', async () => {
            const response = await request(app)
                .post('/api/v1/events')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Invalid Event',
                    // Missing required fields
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });

        it('should validate date range', async () => {
            const response = await request(app)
                .post('/api/v1/events')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Invalid Date Event',
                    event_type: 'academic',
                    start_datetime: '2026-09-15T17:00:00',
                    end_datetime: '2026-09-15T09:00:00', // End before start
                    capacity: 100,
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('date');
        });
    });

    describe('GET /api/v1/events - List Events', () => {
        beforeEach(async () => {
            // Create test events
            await request(app)
                .post('/api/v1/events')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Sports Day',
                    event_type: 'sports',
                    start_datetime: '2026-08-15T09:00:00',
                    end_datetime: '2026-08-15T17:00:00',
                    capacity: 200,
                    status: 'published',
                });

            await request(app)
                .post('/api/v1/events')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Cultural Night',
                    event_type: 'cultural',
                    start_datetime: '2026-10-15T18:00:00',
                    end_datetime: '2026-10-15T22:00:00',
                    capacity: 150,
                    status: 'published',
                });
        });

        it('should list all events with pagination', async () => {
            const response = await request(app)
                .get('/api/v1/events')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ page: 1, limit: 10 });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.data).toBeInstanceOf(Array);
            expect(response.body.data.data.length).toBeGreaterThan(0);
            expect(response.body.data.pagination).toBeDefined();
        });

        it('should filter events by type', async () => {
            const response = await request(app)
                .get('/api/v1/events')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ event_type: 'sports' });

            expect(response.status).toBe(200);
            expect(response.body.data.data.every((e: any) => e.event_type === 'sports')).toBe(true);
        });

        it('should filter events by status', async () => {
            const response = await request(app)
                .get('/api/v1/events')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ status: 'published' });

            expect(response.status).toBe(200);
            expect(response.body.data.data.every((e: any) => e.status === 'published')).toBe(true);
        });

        it('should search events by title', async () => {
            const response = await request(app)
                .get('/api/v1/events')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ search: 'Sports' });

            expect(response.status).toBe(200);
            expect(response.body.data.data.some((e: any) => e.title.includes('Sports'))).toBe(true);
        });
    });

    describe('GET /api/v1/events/:eventId - Get Event Details', () => {
        beforeEach(async () => {
            const createResponse = await request(app)
                .post('/api/v1/events')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Test Event',
                    event_type: 'academic',
                    start_datetime: '2026-08-15T09:00:00',
                    end_datetime: '2026-08-15T17:00:00',
                    capacity: 100,
                });

            testEventId = createResponse.body.data.event_id;
        });

        it('should get event details', async () => {
            const response = await request(app)
                .get(`/api/v1/events/${testEventId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.event_id).toBe(testEventId);
            expect(response.body.data.title).toBe('Test Event');
        });

        it('should return 404 for non-existent event', async () => {
            const response = await request(app)
                .get('/api/v1/events/99999')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(404);
        });
    });

    describe('PUT /api/v1/events/:eventId - Update Event', () => {
        beforeEach(async () => {
            const createResponse = await request(app)
                .post('/api/v1/events')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Original Title',
                    event_type: 'academic',
                    start_datetime: '2026-08-15T09:00:00',
                    end_datetime: '2026-08-15T17:00:00',
                    capacity: 100,
                });

            testEventId = createResponse.body.data.event_id;
        });

        it('should update event details', async () => {
            const response = await request(app)
                .put(`/api/v1/events/${testEventId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Updated Title',
                    description: 'Updated description',
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.title).toBe('Updated Title');
            expect(response.body.data.description).toBe('Updated description');
        });

        it('should return 404 for non-existent event', async () => {
            const response = await request(app)
                .put('/api/v1/events/99999')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ title: 'Update' });

            expect(response.status).toBe(404);
        });
    });

    describe('DELETE /api/v1/events/:eventId - Delete Event', () => {
        beforeEach(async () => {
            const createResponse = await request(app)
                .post('/api/v1/events')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Event to Delete',
                    event_type: 'academic',
                    start_datetime: '2026-08-15T09:00:00',
                    end_datetime: '2026-08-15T17:00:00',
                    capacity: 100,
                });

            testEventId = createResponse.body.data.event_id;
        });

        it('should delete event', async () => {
            const response = await request(app)
                .delete(`/api/v1/events/${testEventId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            // Verify deletion
            const getResponse = await request(app)
                .get(`/api/v1/events/${testEventId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(getResponse.status).toBe(404);
        });
    });

    describe('POST /api/v1/events/:eventId/publish - Publish Event', () => {
        beforeEach(async () => {
            const createResponse = await request(app)
                .post('/api/v1/events')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Draft Event',
                    event_type: 'academic',
                    start_datetime: '2026-08-15T09:00:00',
                    end_datetime: '2026-08-15T17:00:00',
                    capacity: 100,
                    status: 'draft',
                });

            testEventId = createResponse.body.data.event_id;
        });

        it('should publish draft event', async () => {
            const response = await request(app)
                .post(`/api/v1/events/${testEventId}/publish`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toBe('published');
        });
    });

    describe('POST /api/v1/events/:eventId/register - Register for Event', () => {
        beforeEach(async () => {
            const createResponse = await request(app)
                .post('/api/v1/events')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Registration Event',
                    event_type: 'academic',
                    start_datetime: '2026-08-15T09:00:00',
                    end_datetime: '2026-08-15T17:00:00',
                    capacity: 50,
                    status: 'published',
                });

            testEventId = createResponse.body.data.event_id;
        });

        it('should register user for event', async () => {
            const response = await request(app)
                .post(`/api/v1/events/${testEventId}/register`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    rsvp_status: 'going',
                    guest_count: 2,
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.rsvp_status).toBe('going');
        });

        it('should prevent duplicate registrations', async () => {
            // First registration
            await request(app)
                .post(`/api/v1/events/${testEventId}/register`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ rsvp_status: 'going' });

            // Second registration
            const response = await request(app)
                .post(`/api/v1/events/${testEventId}/register`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ rsvp_status: 'going' });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('already registered');
        });
    });

    describe('GET /api/v1/events/:eventId/registrations - Get Event Registrations', () => {
        beforeEach(async () => {
            const createResponse = await request(app)
                .post('/api/v1/events')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Registration Event',
                    event_type: 'academic',
                    start_datetime: '2026-08-15T09:00:00',
                    end_datetime: '2026-08-15T17:00:00',
                    capacity: 50,
                    status: 'published',
                });

            testEventId = createResponse.body.data.event_id;

            // Create registration
            await request(app)
                .post(`/api/v1/events/${testEventId}/register`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ rsvp_status: 'going' });
        });

        it('should get event registrations', async () => {
            const response = await request(app)
                .get(`/api/v1/events/${testEventId}/registrations`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.data).toBeInstanceOf(Array);
            expect(response.body.data.data.length).toBeGreaterThan(0);
        });
    });

    describe('POST /api/v1/events/:eventId/attendance - Mark Attendance', () => {
        beforeEach(async () => {
            const createResponse = await request(app)
                .post('/api/v1/events')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Attendance Event',
                    event_type: 'academic',
                    start_datetime: new Date().toISOString(),
                    end_datetime: new Date(Date.now() + 3600000).toISOString(),
                    capacity: 50,
                    status: 'published',
                });

            testEventId = createResponse.body.data.event_id;

            // Register first
            await request(app)
                .post(`/api/v1/events/${testEventId}/register`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ rsvp_status: 'going' });
        });

        it('should mark attendance', async () => {
            const response = await request(app)
                .post(`/api/v1/events/${testEventId}/attendance`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    user_id: 1,
                    status: 'present',
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toBe('present');
        });
    });

    describe('GET /api/v1/events/view/calendar - Calendar View', () => {
        it('should get calendar view of events', async () => {
            const response = await request(app)
                .get('/api/v1/events/view/calendar')
                .set('Authorization', `Bearer ${authToken}`)
                .query({
                    start_date: '2026-08-01',
                    end_date: '2026-08-31',
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeInstanceOf(Array);
        });
    });

    describe('GET /api/v1/events/view/upcoming - Upcoming Events', () => {
        it('should get upcoming events', async () => {
            const response = await request(app)
                .get('/api/v1/events/view/upcoming')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ limit: 5 });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeInstanceOf(Array);
        });
    });

    describe('GET /api/v1/events/analytics/dashboard - Analytics', () => {
        it('should get event analytics', async () => {
            const response = await request(app)
                .get('/api/v1/events/analytics/dashboard')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
        });
    });
});
