/**
 * EventAttendanceService — Unit Tests
 * Multi-tenant aware: each test run creates an isolated tenant.
 *
 * Fixed from original:
 *  - import db from '../../utils/database' (was '../../config/database')
 *  - default singleton imports (not named exports)
 *  - tenant_id / user_id / event_id are UUIDs
 *  - service signatures match implementation:
 *      markAttendance(eventId, data, markedBy)
 *      checkIn(eventId, userId, method?)
 *      checkOut(eventId, userId)
 *      bulkMarkAttendance(eventId, attendances, markedBy)
 *      getEventAttendance(eventId)
 *      getUserAttendance(userId, tenantId)
 *      generateAttendanceReport(eventId)
 *  - no { success } wrapper — services throw on error
 *  - QR code test verifies base64 PNG returned (not raw JSON string)
 *  - attendance_service requires user to be registered first
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import eventAttendanceService from '../../services/eventAttendanceService';
import eventRegistrationService from '../../services/eventRegistrationService';
import eventService from '../../services/eventService';
import db from '../../utils/database';

// ── Fixtures ──────────────────────────────────────────────────────────────────

let tenantId: string;
let staffId:  string;   // marks attendance / is marked-by
let userId:   string;   // the attendee

function future(offsetDays = 1): Date {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d;
}
function futureEnd(offsetDays = 1): Date {
  const d = future(offsetDays);
  d.setHours(d.getHours() + 4);
  return d;
}
function minEvent(overrides: Record<string, any> = {}) {
  return { title: 'Test Event', event_type: 'single' as const, start_date: future(1), end_date: futureEnd(1), ...overrides };
}

beforeAll(async () => {
  const [t] = await db('tenants').insert({
    name: `AttSvc Test ${Date.now()}`, slug: `attsvc-${Date.now()}`,
    status: 'active', timezone: 'UTC', currency: 'USD', language: 'en',
    max_users: 100, max_storage_gb: 10, settings: {},
  }).returning('id');
  tenantId = t.id ?? t;

  const bcryptjs = await import('bcryptjs');
  const hash = await bcryptjs.default.hash('TestPass123!', 10);

  const [s] = await db('users').insert({
    tenant_id: tenantId, email: `att-staff-${Date.now()}@test.com`,
    password_hash: hash, first_name: 'Staff', last_name: 'Att',
    role: 'principal', status: 'active',
  }).returning('id');
  staffId = s.id ?? s;

  const [u] = await db('users').insert({
    tenant_id: tenantId, email: `att-user-${Date.now()}@test.com`,
    password_hash: hash, first_name: 'Student', last_name: 'Att',
    role: 'student', status: 'active',
  }).returning('id');
  userId = u.id ?? u;
});

afterAll(async () => {
  await db('event_attendance').whereIn('event_id', db('events').select('event_id').where({ tenant_id: tenantId })).del();
  await db('event_registrations').whereIn('event_id', db('events').select('event_id').where({ tenant_id: tenantId })).del();
  await db('event_category_mappings').whereIn('event_id', db('events').select('event_id').where({ tenant_id: tenantId })).del();
  await db('events').where({ tenant_id: tenantId }).del();
  await db('event_categories').where({ tenant_id: tenantId }).del();
  await db('users').where({ id: userId }).del();
  await db('users').where({ id: staffId }).del();
  await db('tenants').where({ id: tenantId }).del();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Creates a published event and registers userId for it. Returns event. */
async function setupEventWithRegistration(overrides: Record<string, any> = {}) {
  const event = await eventService.createEvent(tenantId, staffId, minEvent(overrides));
  await eventService.publishEvent(event.event_id, tenantId, staffId);
  await eventRegistrationService.registerForEvent(event.event_id, userId, { rsvp_status: 'going' });
  return event;
}

// ── markAttendance ────────────────────────────────────────────────────────────

describe('markAttendance', () => {
  afterEach(async () => {
    await db('event_attendance').whereIn('event_id', db('events').select('event_id').where({ tenant_id: tenantId })).del();
    await db('event_registrations').whereIn('event_id', db('events').select('event_id').where({ tenant_id: tenantId })).del();
    await db('events').where({ tenant_id: tenantId }).del();
  });

  it('marks a registered user as present', async () => {
    const event = await setupEventWithRegistration({ title: 'Attendance Test' });

    const attendance = await eventAttendanceService.markAttendance(
      event.event_id,
      { user_id: userId, status: 'present' },
      staffId,
    );

    expect(attendance.status).toBe('present');
    expect(attendance.event_id).toBe(event.event_id);
    expect(attendance.user_id).toBe(userId);
    expect(attendance.marked_by).toBe(staffId);
  });

  it('marks a registered user as absent', async () => {
    const event = await setupEventWithRegistration();

    const attendance = await eventAttendanceService.markAttendance(
      event.event_id,
      { user_id: userId, status: 'absent' },
      staffId,
    );

    expect(attendance.status).toBe('absent');
  });

  it('updates an existing attendance record (upsert)', async () => {
    const event = await setupEventWithRegistration();

    await eventAttendanceService.markAttendance(event.event_id, { user_id: userId, status: 'present' }, staffId);
    const updated = await eventAttendanceService.markAttendance(event.event_id, { user_id: userId, status: 'late' }, staffId);

    expect(updated.status).toBe('late');

    // Verify only one record exists
    const rows = await db('event_attendance').where({ event_id: event.event_id, user_id: userId });
    expect(rows.length).toBe(1);
  });

  it('saves notes on the attendance record', async () => {
    const event = await setupEventWithRegistration();

    const attendance = await eventAttendanceService.markAttendance(
      event.event_id,
      { user_id: userId, status: 'present', notes: 'Arrived early' },
      staffId,
    );

    expect(attendance.notes).toBe('Arrived early');
  });

  it('throws when the user is not registered for the event', async () => {
    const event = await eventService.createEvent(tenantId, staffId, minEvent({ title: 'Unregistered Test' }));
    await eventService.publishEvent(event.event_id, tenantId, staffId);
    // No registration created

    await expect(
      eventAttendanceService.markAttendance(event.event_id, { user_id: userId, status: 'present' }, staffId),
    ).rejects.toThrow(/not registered/i);
  });
});

// ── checkIn ───────────────────────────────────────────────────────────────────

describe('checkIn', () => {
  afterEach(async () => {
    await db('event_attendance').whereIn('event_id', db('events').select('event_id').where({ tenant_id: tenantId })).del();
    await db('event_registrations').whereIn('event_id', db('events').select('event_id').where({ tenant_id: tenantId })).del();
    await db('events').where({ tenant_id: tenantId }).del();
  });

  it('records check-in time and marks user present', async () => {
    const event = await setupEventWithRegistration({ title: 'Check-in Test' });

    const attendance = await eventAttendanceService.checkIn(event.event_id, userId);

    expect(attendance.status).toBe('present');
    expect(attendance.check_in_time).toBeTruthy();
  });

  it('throws when the user checks in twice', async () => {
    const event = await setupEventWithRegistration();
    await eventAttendanceService.checkIn(event.event_id, userId);

    await expect(
      eventAttendanceService.checkIn(event.event_id, userId),
    ).rejects.toThrow(/already checked in/i);
  });
});

// ── checkOut ──────────────────────────────────────────────────────────────────

describe('checkOut', () => {
  afterEach(async () => {
    await db('event_attendance').whereIn('event_id', db('events').select('event_id').where({ tenant_id: tenantId })).del();
    await db('event_registrations').whereIn('event_id', db('events').select('event_id').where({ tenant_id: tenantId })).del();
    await db('events').where({ tenant_id: tenantId }).del();
  });

  it('records check-out time after a check-in', async () => {
    const event = await setupEventWithRegistration({ title: 'Check-out Test' });
    await eventAttendanceService.checkIn(event.event_id, userId);

    const attendance = await eventAttendanceService.checkOut(event.event_id, userId);

    expect(attendance.check_out_time).toBeTruthy();
    expect(new Date(attendance.check_out_time!) > new Date(attendance.check_in_time!)).toBe(true);
  });

  it('throws when there is no check-in record to check out', async () => {
    const event = await setupEventWithRegistration({ title: 'No Checkin' });

    await expect(
      eventAttendanceService.checkOut(event.event_id, userId),
    ).rejects.toThrow(/not found/i);
  });
});

// ── bulkMarkAttendance ────────────────────────────────────────────────────────

describe('bulkMarkAttendance', () => {
  afterEach(async () => {
    await db('event_attendance').whereIn('event_id', db('events').select('event_id').where({ tenant_id: tenantId })).del();
    await db('event_registrations').whereIn('event_id', db('events').select('event_id').where({ tenant_id: tenantId })).del();
    await db('events').where({ tenant_id: tenantId }).del();
  });

  it('marks attendance for multiple users in one call', async () => {
    const event = await eventService.createEvent(tenantId, staffId, minEvent({ title: 'Bulk Test', capacity: 10 }));
    await eventService.publishEvent(event.event_id, tenantId, staffId);

    // Create 3 extra users and register them
    const extraIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const [u] = await db('users').insert({
        tenant_id: tenantId, email: `bulk-u${i}-${Date.now()}@test.com`,
        password_hash: 'x', first_name: `B${i}`, last_name: 'U',
        role: 'student', status: 'active',
      }).returning('id');
      const uid = u.id ?? u;
      extraIds.push(uid);
      await eventRegistrationService.registerForEvent(event.event_id, uid, { rsvp_status: 'going' });
    }

    const attendances = extraIds.map((uid, i) => ({
      user_id: uid,
      status: (i < 2 ? 'present' : 'absent') as 'present' | 'absent',
    }));

    await eventAttendanceService.bulkMarkAttendance(event.event_id, attendances, staffId);

    const records = await db('event_attendance').where({ event_id: event.event_id });
    expect(records.length).toBe(3);

    const statuses = records.map((r: any) => r.status);
    expect(statuses.filter((s: string) => s === 'present').length).toBe(2);
    expect(statuses.filter((s: string) => s === 'absent').length).toBe(1);

    // Cleanup
    await db('event_registrations').where({ event_id: event.event_id }).del();
    for (const uid of extraIds) {
      await db('users').where({ id: uid }).del();
    }
  });
});

// ── getEventAttendance ────────────────────────────────────────────────────────

describe('getEventAttendance', () => {
  afterEach(async () => {
    await db('event_attendance').whereIn('event_id', db('events').select('event_id').where({ tenant_id: tenantId })).del();
    await db('event_registrations').whereIn('event_id', db('events').select('event_id').where({ tenant_id: tenantId })).del();
    await db('events').where({ tenant_id: tenantId }).del();
  });

  it('returns attendance records with user info joined', async () => {
    const event = await setupEventWithRegistration({ title: 'Get Attendance Test' });
    await eventAttendanceService.markAttendance(event.event_id, { user_id: userId, status: 'present' }, staffId);

    const records = await eventAttendanceService.getEventAttendance(event.event_id);

    expect(records.length).toBe(1);
    expect(records[0].user_id).toBe(userId);
    expect(records[0].status).toBe('present');
    // Should include joined user fields
    expect(records[0].first_name).toBeDefined();
    expect(records[0].email).toBeDefined();
  });

  it('scopes to the correct event (tenant isolation via event FK)', async () => {
    const event1 = await setupEventWithRegistration({ title: 'Event Isolation 1' });
    await eventAttendanceService.markAttendance(event1.event_id, { user_id: userId, status: 'present' }, staffId);

    // Create another event and register userId for it too
    const event2 = await eventService.createEvent(tenantId, staffId, minEvent({ title: 'Event Isolation 2' }));
    await eventService.publishEvent(event2.event_id, tenantId, staffId);
    await eventRegistrationService.registerForEvent(event2.event_id, userId, { rsvp_status: 'going' });
    await eventAttendanceService.markAttendance(event2.event_id, { user_id: userId, status: 'absent' }, staffId);

    const records1 = await eventAttendanceService.getEventAttendance(event1.event_id);
    expect(records1.every((r: any) => r.event_id === event1.event_id)).toBe(true);

    const records2 = await eventAttendanceService.getEventAttendance(event2.event_id);
    expect(records2.every((r: any) => r.event_id === event2.event_id)).toBe(true);
  });
});

// ── generateAttendanceQRCode ──────────────────────────────────────────────────

describe('generateAttendanceQRCode', () => {
  afterEach(async () => {
    await db('events').where({ tenant_id: tenantId }).del();
  });

  it('returns a base64 PNG data URL', async () => {
    const event = await eventService.createEvent(tenantId, staffId, minEvent({ title: 'QR Test' }));
    await eventService.publishEvent(event.event_id, tenantId, staffId);

    const qrImage = await eventAttendanceService.generateAttendanceQRCode(event.event_id);

    expect(typeof qrImage).toBe('string');
    expect(qrImage.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('throws for a non-existent event', async () => {
    await expect(
      eventAttendanceService.generateAttendanceQRCode('00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow(/not found/i);
  });
});

// ── generateAttendanceReport ──────────────────────────────────────────────────

describe('generateAttendanceReport', () => {
  afterEach(async () => {
    await db('event_attendance').whereIn('event_id', db('events').select('event_id').where({ tenant_id: tenantId })).del();
    await db('event_registrations').whereIn('event_id', db('events').select('event_id').where({ tenant_id: tenantId })).del();
    await db('events').where({ tenant_id: tenantId }).del();
  });

  it('generates a report with correct totals', async () => {
    const event = await eventService.createEvent(tenantId, staffId, minEvent({ title: 'Report Test', capacity: 20 }));
    await eventService.publishEvent(event.event_id, tenantId, staffId);

    // Create 5 users, register them, mark 3 present and 2 absent
    const testUsers: string[] = [];
    for (let i = 0; i < 5; i++) {
      const [u] = await db('users').insert({
        tenant_id: tenantId, email: `rpt-u${i}-${Date.now()}@test.com`,
        password_hash: 'x', first_name: `R${i}`, last_name: 'User',
        role: 'student', status: 'active',
      }).returning('id');
      const uid = u.id ?? u;
      testUsers.push(uid);
      await eventRegistrationService.registerForEvent(event.event_id, uid, { rsvp_status: 'going' });
      await eventAttendanceService.markAttendance(
        event.event_id,
        { user_id: uid, status: i < 3 ? 'present' : 'absent' },
        staffId,
      );
    }

    const report = await eventAttendanceService.generateAttendanceReport(event.event_id);

    expect(report.event_id).toBe(event.event_id);
    expect(report.total_present).toBe(3);
    expect(report.total_absent).toBe(2);
    expect(report.total_registered).toBeGreaterThanOrEqual(5);
    expect(report.attendance_rate).toBeGreaterThan(0);
    expect(Array.isArray(report.attendees)).toBe(true);
    expect(report.attendees.length).toBe(5);

    // Cleanup
    await db('event_registrations').where({ event_id: event.event_id }).del();
    for (const uid of testUsers) {
      await db('users').where({ id: uid }).del();
    }
  });
});

// ── getAttendanceStats ────────────────────────────────────────────────────────

describe('getAttendanceStats', () => {
  afterEach(async () => {
    await db('event_attendance').whereIn('event_id', db('events').select('event_id').where({ tenant_id: tenantId })).del();
    await db('event_registrations').whereIn('event_id', db('events').select('event_id').where({ tenant_id: tenantId })).del();
    await db('events').where({ tenant_id: tenantId }).del();
  });

  it('returns correct present / absent breakdown', async () => {
    const event = await setupEventWithRegistration({ title: 'Stats Test', capacity: 10 });
    await eventAttendanceService.markAttendance(event.event_id, { user_id: userId, status: 'present' }, staffId);

    const stats = await eventAttendanceService.getAttendanceStats(event.event_id);

    expect(stats.present).toBe(1);
    expect(stats.absent).toBe(0);
    expect(stats.attendance_rate).toBeGreaterThan(0);
  });
});
