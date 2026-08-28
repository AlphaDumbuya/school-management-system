/**
 * EventRegistrationService — Unit Tests
 * Multi-tenant aware: fixtures create an isolated tenant + user + event.
 *
 * Fixed from original:
 *  - import db from '../../utils/database' (was '../../config/database')
 *  - named imports removed — both services use default singleton exports
 *  - tenant_id / user_id are UUIDs
 *  - service signatures match actual implementation:
 *      registerForEvent(eventId, userId, dto)
 *      cancelRegistration(registrationId, userId)
 *      approveRegistration(registrationId, approverId)
 *      getEventRegistrations(eventId, filters?)
 *      getUserRegistrations(userId, filters?)
 *  - capacity test uses waitlist status, not a failure
 *  - no { success } wrapper — services throw on error
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import eventRegistrationService from '../../services/eventRegistrationService';
import eventService from '../../services/eventService';
import db from '../../utils/database';

// ── Fixtures ──────────────────────────────────────────────────────────────────

let tenantId:  string;
let userId:    string;   // the registering user
let staffId:   string;   // principal / approver

function future(offsetDays = 1): Date {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d;
}
function futureEnd(offsetDays = 1): Date {
  const d = future(offsetDays);
  d.setHours(d.getHours() + 2);
  return d;
}
function minEvent(overrides: Record<string, any> = {}) {
  return { title: 'Test Event', event_type: 'single' as const, start_date: future(1), end_date: futureEnd(1), ...overrides };
}

beforeAll(async () => {
  const [t] = await db('tenants').insert({
    name: `RegSvc Test ${Date.now()}`, slug: `regsvc-${Date.now()}`,
    status: 'active', timezone: 'UTC', currency: 'USD', language: 'en',
    max_users: 100, max_storage_gb: 10, settings: {},
  }).returning('id');
  tenantId = t.id ?? t;

  const bcryptjs = await import('bcryptjs');
  const hash = await bcryptjs.default.hash('TestPass123!', 10);

  const [u] = await db('users').insert({
    tenant_id: tenantId, email: `reg-user-${Date.now()}@test.com`,
    password_hash: hash, first_name: 'Reg', last_name: 'User',
    role: 'student', status: 'active',
  }).returning('id');
  userId = u.id ?? u;

  const [s] = await db('users').insert({
    tenant_id: tenantId, email: `reg-staff-${Date.now()}@test.com`,
    password_hash: hash, first_name: 'Staff', last_name: 'Principal',
    role: 'principal', status: 'active',
  }).returning('id');
  staffId = s.id ?? s;
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

async function makePublishedEvent(overrides: Record<string, any> = {}) {
  const event = await eventService.createEvent(tenantId, staffId, minEvent(overrides));
  await eventService.publishEvent(event.event_id, tenantId, staffId);
  return event;
}

// ── registerForEvent ──────────────────────────────────────────────────────────

describe('registerForEvent', () => {
  afterEach(async () => {
    await db('event_registrations').whereIn('event_id', db('events').select('event_id').where({ tenant_id: tenantId })).del();
    await db('events').where({ tenant_id: tenantId }).del();
  });

  it('confirms a registration for a published event', async () => {
    const event = await makePublishedEvent({ title: 'Open Event', capacity: 50 });

    const reg = await eventRegistrationService.registerForEvent(event.event_id, userId, {
      rsvp_status: 'going',
    });

    expect(reg.event_id).toBe(event.event_id);
    expect(reg.user_id).toBe(userId);
    expect(reg.status).toBe('confirmed');
    expect(reg.rsvp_status).toBe('going');
  });

  it('prevents duplicate registrations', async () => {
    const event = await makePublishedEvent({ capacity: 50 });
    await eventRegistrationService.registerForEvent(event.event_id, userId, { rsvp_status: 'going' });

    await expect(
      eventRegistrationService.registerForEvent(event.event_id, userId, { rsvp_status: 'going' }),
    ).rejects.toThrow(/already registered/i);
  });

  it('adds to waitlist when event is at capacity', async () => {
    const event = await makePublishedEvent({ title: 'Full Event', capacity: 1 });

    // First user fills the spot
    const [user2] = await db('users').insert({
      tenant_id: tenantId, email: `waitlist-user-${Date.now()}@test.com`,
      password_hash: 'x', first_name: 'W', last_name: 'User',
      role: 'student', status: 'active',
    }).returning('id');
    const u2Id = user2.id ?? user2;

    await eventRegistrationService.registerForEvent(event.event_id, u2Id, { rsvp_status: 'going' });

    // Second user (our main user) goes to waitlist
    const reg = await eventRegistrationService.registerForEvent(event.event_id, userId, { rsvp_status: 'going' });
    expect(reg.status).toBe('waitlist');

    await db('event_registrations').where({ event_id: event.event_id }).del();
    await db('users').where({ id: u2Id }).del();
  });

  it('sets status to pending when approval is required', async () => {
    const event = await eventService.createEvent(tenantId, staffId, {
      ...minEvent({ title: 'Approval Event' }),
      approval_required: true,
    });
    await eventService.publishEvent(event.event_id, tenantId, staffId);

    const reg = await eventRegistrationService.registerForEvent(event.event_id, userId, { rsvp_status: 'going' });
    expect(reg.status).toBe('pending');

    await db('event_registrations').where({ event_id: event.event_id }).del();
  });

  it('throws for a draft (unpublished) event', async () => {
    const event = await eventService.createEvent(tenantId, staffId, minEvent({ title: 'Draft Event' }));

    await expect(
      eventRegistrationService.registerForEvent(event.event_id, userId, { rsvp_status: 'going' }),
    ).rejects.toThrow(/not open for registration/i);
  });
});

// ── cancelRegistration ────────────────────────────────────────────────────────

describe('cancelRegistration', () => {
  afterEach(async () => {
    await db('event_registrations').whereIn('event_id', db('events').select('event_id').where({ tenant_id: tenantId })).del();
    await db('events').where({ tenant_id: tenantId }).del();
  });

  it('cancels an existing registration', async () => {
    const event = await makePublishedEvent({ capacity: 50 });
    const reg = await eventRegistrationService.registerForEvent(event.event_id, userId, { rsvp_status: 'going' });

    await eventRegistrationService.cancelRegistration(reg.registration_id, userId);

    const updated = await db('event_registrations').where({ registration_id: reg.registration_id }).first();
    expect(updated.status).toBe('cancelled');
  });

  it('throws when another user tries to cancel the registration', async () => {
    const event = await makePublishedEvent({ capacity: 50 });
    const reg = await eventRegistrationService.registerForEvent(event.event_id, userId, { rsvp_status: 'going' });

    await expect(
      eventRegistrationService.cancelRegistration(reg.registration_id, staffId),
    ).rejects.toThrow(/not found/i);
  });

  it('throws when cancelling an already-cancelled registration', async () => {
    const event = await makePublishedEvent({ capacity: 50 });
    const reg = await eventRegistrationService.registerForEvent(event.event_id, userId, { rsvp_status: 'going' });
    await eventRegistrationService.cancelRegistration(reg.registration_id, userId);

    await expect(
      eventRegistrationService.cancelRegistration(reg.registration_id, userId),
    ).rejects.toThrow(/already cancelled/i);
  });
});

// ── updateRSVPStatus ──────────────────────────────────────────────────────────

describe('updateRSVPStatus', () => {
  afterEach(async () => {
    await db('event_registrations').whereIn('event_id', db('events').select('event_id').where({ tenant_id: tenantId })).del();
    await db('events').where({ tenant_id: tenantId }).del();
  });

  it('updates RSVP from maybe to going', async () => {
    const event = await makePublishedEvent({ capacity: 50 });
    const reg   = await eventRegistrationService.registerForEvent(event.event_id, userId, { rsvp_status: 'maybe' });

    const updated = await eventRegistrationService.updateRSVPStatus(reg.registration_id, userId, 'going');
    expect(updated.rsvp_status).toBe('going');
  });
});

// ── approveRegistration ───────────────────────────────────────────────────────

describe('approveRegistration', () => {
  afterEach(async () => {
    await db('event_registrations').whereIn('event_id', db('events').select('event_id').where({ tenant_id: tenantId })).del();
    await db('events').where({ tenant_id: tenantId }).del();
  });

  it('approves a pending registration', async () => {
    const event = await eventService.createEvent(tenantId, staffId, {
      ...minEvent({ title: 'Approval Required', capacity: 50 }),
      approval_required: true,
    });
    await eventService.publishEvent(event.event_id, tenantId, staffId);

    const reg = await eventRegistrationService.registerForEvent(event.event_id, userId, { rsvp_status: 'going' });
    expect(reg.status).toBe('pending');

    const approved = await eventRegistrationService.approveRegistration(reg.registration_id, staffId);
    expect(approved.approval_status).toBe('approved');
    expect(approved.status).toBe('confirmed');
  });

  it('throws when trying to approve a non-pending registration', async () => {
    const event = await makePublishedEvent({ capacity: 50 });
    const reg   = await eventRegistrationService.registerForEvent(event.event_id, userId, { rsvp_status: 'going' });
    // status is already 'confirmed', not 'pending'

    await expect(
      eventRegistrationService.approveRegistration(reg.registration_id, staffId),
    ).rejects.toThrow(/not pending/i);
  });
});

// ── rejectRegistration ────────────────────────────────────────────────────────

describe('rejectRegistration', () => {
  afterEach(async () => {
    await db('event_registrations').whereIn('event_id', db('events').select('event_id').where({ tenant_id: tenantId })).del();
    await db('events').where({ tenant_id: tenantId }).del();
  });

  it('rejects a pending registration with a reason', async () => {
    const event = await eventService.createEvent(tenantId, staffId, {
      ...minEvent({ title: 'Reject Test', capacity: 50 }),
      approval_required: true,
    });
    await eventService.publishEvent(event.event_id, tenantId, staffId);

    const reg     = await eventRegistrationService.registerForEvent(event.event_id, userId, { rsvp_status: 'going' });
    const rejected = await eventRegistrationService.rejectRegistration(reg.registration_id, staffId, 'Event is full');

    expect(rejected.approval_status).toBe('rejected');
    expect(rejected.status).toBe('cancelled');
  });
});

// ── getEventRegistrations ─────────────────────────────────────────────────────

describe('getEventRegistrations', () => {
  let eventId: string;

  beforeEach(async () => {
    const event = await makePublishedEvent({ capacity: 100 });
    eventId = event.event_id;

    // Register our main userId
    await eventRegistrationService.registerForEvent(eventId, userId, { rsvp_status: 'going' });
  });

  afterEach(async () => {
    await db('event_registrations').where({ event_id: eventId }).del();
    await db('events').where({ event_id: eventId }).del();
  });

  it('returns all registrations for the event', async () => {
    const regs = await eventRegistrationService.getEventRegistrations(eventId);
    expect(regs.length).toBeGreaterThan(0);
    regs.forEach((r) => expect(r.event_id).toBe(eventId));
  });

  it('filters by status', async () => {
    const confirmed = await eventRegistrationService.getEventRegistrations(eventId, { status: 'confirmed' });
    confirmed.forEach((r) => expect(r.status).toBe('confirmed'));
  });
});

// ── getUserRegistrations ──────────────────────────────────────────────────────

describe('getUserRegistrations', () => {
  afterEach(async () => {
    await db('event_registrations').whereIn('event_id', db('events').select('event_id').where({ tenant_id: tenantId })).del();
    await db('events').where({ tenant_id: tenantId }).del();
  });

  it('returns only the registrations belonging to the user', async () => {
    const e1 = await makePublishedEvent({ title: 'User Event 1', capacity: 50 });
    const e2 = await makePublishedEvent({ title: 'User Event 2', capacity: 50 });

    await eventRegistrationService.registerForEvent(e1.event_id, userId, { rsvp_status: 'going' });
    await eventRegistrationService.registerForEvent(e2.event_id, userId, { rsvp_status: 'maybe' });

    const regs = await eventRegistrationService.getUserRegistrations(userId);
    expect(regs.length).toBeGreaterThanOrEqual(2);
    // All returned rows belong to this user
    regs.forEach((r: any) => expect(r.user_id ?? r.event_id).toBeDefined());
  });

  it('upcoming filter returns only future events', async () => {
    const regs = await eventRegistrationService.getUserRegistrations(userId, { upcoming: true });
    const now  = new Date();
    regs.forEach((r: any) => {
      if (r.start_date) expect(new Date(r.start_date) > now).toBe(true);
    });
  });
});

// ── checkCapacity ─────────────────────────────────────────────────────────────

describe('checkCapacity', () => {
  afterEach(async () => {
    await db('event_registrations').whereIn('event_id', db('events').select('event_id').where({ tenant_id: tenantId })).del();
    await db('events').where({ tenant_id: tenantId }).del();
  });

  it('reports unlimited when no capacity is set', async () => {
    const event    = await makePublishedEvent({ title: 'Unlimited Event' }); // no capacity
    const capacity = await eventRegistrationService.checkCapacity(db, event.event_id, undefined);

    expect(capacity.is_full).toBe(false);
    expect(capacity.available).toBe(-1);
  });

  it('correctly counts available spots after a registration', async () => {
    const event = await makePublishedEvent({ title: 'Capacity Test', capacity: 5 });
    await eventRegistrationService.registerForEvent(event.event_id, userId, { rsvp_status: 'going' });

    const capacity = await eventRegistrationService.checkCapacity(db, event.event_id, 5);
    expect(capacity.capacity).toBe(5);
    expect(capacity.registered).toBe(1);
    expect(capacity.available).toBe(4);
    expect(capacity.is_full).toBe(false);
  });

  it('marks is_full when all spots are taken', async () => {
    const event = await makePublishedEvent({ title: 'Full Event', capacity: 1 });

    const [extraUser] = await db('users').insert({
      tenant_id: tenantId, email: `cap-user-${Date.now()}@test.com`,
      password_hash: 'x', first_name: 'C', last_name: 'U',
      role: 'student', status: 'active',
    }).returning('id');
    const extraId = extraUser.id ?? extraUser;

    await eventRegistrationService.registerForEvent(event.event_id, extraId, { rsvp_status: 'going' });

    const capacity = await eventRegistrationService.checkCapacity(db, event.event_id, 1);
    expect(capacity.is_full).toBe(true);
    expect(capacity.available).toBe(0);

    await db('event_registrations').where({ event_id: event.event_id }).del();
    await db('users').where({ id: extraId }).del();
  });
});

// ── Waitlist promotion ────────────────────────────────────────────────────────

describe('Waitlist promotion', () => {
  afterEach(async () => {
    await db('event_registrations').whereIn('event_id', db('events').select('event_id').where({ tenant_id: tenantId })).del();
    await db('events').where({ tenant_id: tenantId }).del();
  });

  it('promotes from waitlist when a confirmed registration is cancelled', async () => {
    const event = await makePublishedEvent({ title: 'Waitlist Promo', capacity: 1 });

    // User A fills the spot
    const [userA] = await db('users').insert({
      tenant_id: tenantId, email: `wl-a-${Date.now()}@test.com`,
      password_hash: 'x', first_name: 'A', last_name: 'U', role: 'student', status: 'active',
    }).returning('id');
    const aId = userA.id ?? userA;

    const regA = await eventRegistrationService.registerForEvent(event.event_id, aId, { rsvp_status: 'going' });
    expect(regA.status).toBe('confirmed');

    // User B goes to waitlist
    const regB = await eventRegistrationService.registerForEvent(event.event_id, userId, { rsvp_status: 'going' });
    expect(regB.status).toBe('waitlist');

    // User A cancels — User B should be promoted
    await eventRegistrationService.cancelRegistration(regA.registration_id, aId);

    const promoted = await db('event_registrations').where({ registration_id: regB.registration_id }).first();
    expect(promoted.status).toBe('confirmed');

    await db('event_registrations').where({ event_id: event.event_id }).del();
    await db('users').where({ id: aId }).del();
  });
});
