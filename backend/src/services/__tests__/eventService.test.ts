/**
 * EventService — Unit Tests
 * Multi-tenant aware: each describe block gets its own tenant UUID.
 *
 * Fixed from original:
 *  - import db from '../../utils/database' (was '../../config/database')
 *  - import eventService as default (was named export)
 *  - field names: start_date / end_date (was start_datetime / end_datetime)
 *  - tenant_id is a UUID, organizer_id is a UUID
 *  - event_type values: 'single' | 'multi_day' | 'recurring'
 *  - service signatures: createEvent(tenantId, userId, data)
 *  - listEvents returns { data, total, page, limit, totalPages }
 *  - getUpcomingEvents(tenantId, userId, limit) — no { success } wrapper
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import eventService from '../../services/eventService';
import db from '../../utils/database';

// ── Tenant + user fixtures ────────────────────────────────────────────────────

let tenantId: string;
let userId: string;

beforeAll(async () => {
  const [tenant] = await db('tenants')
    .insert({
      name:           `EventService Test Tenant ${Date.now()}`,
      slug:           `evt-svc-test-${Date.now()}`,
      status:         'active',
      timezone:       'UTC',
      currency:       'USD',
      language:       'en',
      max_users:      100,
      max_storage_gb: 10,
      settings:       {},
    })
    .returning('id');

  tenantId = tenant.id ?? tenant;

  const bcryptjs = await import('bcryptjs');
  const hash = await bcryptjs.default.hash('TestPass123!', 10);

  const [user] = await db('users')
    .insert({
      tenant_id:     tenantId,
      email:         `evtsvc-${Date.now()}@test.com`,
      password_hash: hash,
      first_name:    'Svc',
      last_name:     'Test',
      role:          'principal',
      status:        'active',
    })
    .returning('id');

  userId = user.id ?? user;
});

afterAll(async () => {
  await db('event_category_mappings').whereIn(
    'event_id', db('events').select('event_id').where({ tenant_id: tenantId }),
  ).del();
  await db('event_recurrence').whereIn(
    'event_id', db('events').select('event_id').where({ tenant_id: tenantId }),
  ).del();
  await db('event_registrations').whereIn(
    'event_id', db('events').select('event_id').where({ tenant_id: tenantId }),
  ).del();
  await db('events').where({ tenant_id: tenantId }).del();
  await db('event_categories').where({ tenant_id: tenantId }).del();
  await db('users').where({ id: userId }).del();
  await db('tenants').where({ id: tenantId }).del();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function future(offsetDays = 1): Date {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d;
}

function futureEnd(offsetDays = 1, extraHours = 2): Date {
  const d = future(offsetDays);
  d.setHours(d.getHours() + extraHours);
  return d;
}

function minimalEvent(overrides: Record<string, any> = {}) {
  return {
    title:      'Test Event',
    event_type: 'single' as const,
    start_date: future(1),
    end_date:   futureEnd(1),
    ...overrides,
  };
}

// ── createEvent ───────────────────────────────────────────────────────────────

describe('createEvent', () => {
  afterEach(async () => {
    await db('events').where({ tenant_id: tenantId }).del();
  });

  it('creates an event scoped to the tenant', async () => {
    const event = await eventService.createEvent(tenantId, userId, minimalEvent({ title: 'Annual Sports Day' }));

    expect(event.title).toBe('Annual Sports Day');
    expect(event.tenant_id).toBe(tenantId);
    expect(event.status).toBe('draft');
    expect(event.event_id).toBeDefined();
  });

  it('throws when required fields are missing', async () => {
    await expect(
      eventService.createEvent(tenantId, userId, {} as any),
    ).rejects.toThrow();
  });

  it('throws when end_date is before start_date', async () => {
    await expect(
      eventService.createEvent(tenantId, userId, {
        title:      'Bad Dates',
        event_type: 'single',
        start_date: futureEnd(2),
        end_date:   future(1),   // earlier than start
      }),
    ).rejects.toThrow(/end date must be after start date/i);
  });

  it('sets organizer_id to userId when not provided', async () => {
    const event = await eventService.createEvent(tenantId, userId, minimalEvent());
    expect(event.organizer_id).toBe(userId);
  });
});

// ── getEvent ──────────────────────────────────────────────────────────────────

describe('getEvent', () => {
  let eventId: string;

  beforeAll(async () => {
    const event = await eventService.createEvent(tenantId, userId, minimalEvent({ title: 'Fetch Me' }));
    eventId = event.event_id;
  });

  afterAll(async () => {
    await db('events').where({ tenant_id: tenantId }).del();
  });

  it('returns the event for the correct tenant', async () => {
    const event = await eventService.getEvent(eventId, tenantId);
    expect(event).not.toBeNull();
    expect(event!.event_id).toBe(eventId);
    expect(event!.title).toBe('Fetch Me');
  });

  it('returns null for a non-existent event_id', async () => {
    const event = await eventService.getEvent('00000000-0000-0000-0000-000000000000', tenantId);
    expect(event).toBeNull();
  });

  it('enforces tenant isolation — wrong tenant returns null', async () => {
    const event = await eventService.getEvent(eventId, '00000000-0000-0000-0000-000000000001');
    expect(event).toBeNull();
  });
});

// ── updateEvent ───────────────────────────────────────────────────────────────

describe('updateEvent', () => {
  let eventId: string;

  beforeEach(async () => {
    const event = await eventService.createEvent(tenantId, userId, minimalEvent({ title: 'Original' }));
    eventId = event.event_id;
  });

  afterEach(async () => {
    await db('events').where({ tenant_id: tenantId }).del();
  });

  it('updates title and description', async () => {
    const updated = await eventService.updateEvent(eventId, tenantId, userId, {
      title:       'Updated Title',
      description: 'New description',
    });

    expect(updated.title).toBe('Updated Title');
    expect(updated.description).toBe('New description');
    expect(updated.tenant_id).toBe(tenantId);
  });

  it('throws when event does not exist in the tenant', async () => {
    await expect(
      eventService.updateEvent('00000000-0000-0000-0000-000000000000', tenantId, userId, { title: 'Ghost' }),
    ).rejects.toThrow(/not found/i);
  });

  it('throws when updated dates are invalid', async () => {
    await expect(
      eventService.updateEvent(eventId, tenantId, userId, {
        start_date: futureEnd(5) as any,
        end_date:   future(1) as any,
      }),
    ).rejects.toThrow(/end date must be after start date/i);
  });
});

// ── deleteEvent ───────────────────────────────────────────────────────────────

describe('deleteEvent', () => {
  afterEach(async () => {
    await db('events').where({ tenant_id: tenantId }).del();
  });

  it('hard-deletes an event with no registrations', async () => {
    const event = await eventService.createEvent(tenantId, userId, minimalEvent({ title: 'Delete Me' }));
    await eventService.deleteEvent(event.event_id, tenantId, userId);

    const found = await eventService.getEvent(event.event_id, tenantId);
    expect(found).toBeNull();
  });

  it('throws when the event has existing registrations', async () => {
    const event = await eventService.createEvent(tenantId, userId, minimalEvent({ title: 'Has Registrations' }));

    // Insert a fake registration directly
    await db('event_registrations').insert({
      event_id: event.event_id,
      user_id:  userId,
      status:   'confirmed',
    });

    await expect(
      eventService.deleteEvent(event.event_id, tenantId, userId),
    ).rejects.toThrow(/registrations/i);

    // Cleanup registration
    await db('event_registrations').where({ event_id: event.event_id }).del();
  });
});

// ── publishEvent ──────────────────────────────────────────────────────────────

describe('publishEvent', () => {
  afterEach(async () => {
    await db('events').where({ tenant_id: tenantId }).del();
  });

  it('transitions status from draft to published', async () => {
    const event = await eventService.createEvent(tenantId, userId, minimalEvent());
    expect(event.status).toBe('draft');

    const published = await eventService.publishEvent(event.event_id, tenantId, userId);
    expect(published.status).toBe('published');
    expect(published.tenant_id).toBe(tenantId);
  });
});

// ── cancelEvent ───────────────────────────────────────────────────────────────

describe('cancelEvent', () => {
  afterEach(async () => {
    await db('events').where({ tenant_id: tenantId }).del();
  });

  it('cancels a published event', async () => {
    const event    = await eventService.createEvent(tenantId, userId, minimalEvent());
    await eventService.publishEvent(event.event_id, tenantId, userId);

    const cancelled = await eventService.cancelEvent(event.event_id, tenantId, userId, 'Weather conditions');
    expect(cancelled.status).toBe('cancelled');
  });
});

// ── duplicateEvent ────────────────────────────────────────────────────────────

describe('duplicateEvent', () => {
  afterEach(async () => {
    await db('events').where({ tenant_id: tenantId }).del();
  });

  it('creates a draft copy with "(Copy)" suffix', async () => {
    const original  = await eventService.createEvent(tenantId, userId, minimalEvent({ title: 'Original', capacity: 100 }));
    const duplicate = await eventService.duplicateEvent(original.event_id, tenantId, userId);

    expect(duplicate.title).toBe('Original (Copy)');
    expect(duplicate.status).toBe('draft');
    expect(duplicate.event_id).not.toBe(original.event_id);
    expect(duplicate.tenant_id).toBe(tenantId);
  });
});

// ── listEvents ────────────────────────────────────────────────────────────────

describe('listEvents', () => {
  beforeEach(async () => {
    await eventService.createEvent(tenantId, userId, minimalEvent({ title: 'Published Event 1' })).then(
      (e) => eventService.publishEvent(e.event_id, tenantId, userId),
    );
    await eventService.createEvent(tenantId, userId, minimalEvent({ title: 'Sports Event', event_type: 'multi_day' }));
    await eventService.createEvent(tenantId, userId, minimalEvent({ title: 'Draft Event' }));
  });

  afterEach(async () => {
    await db('event_registrations').whereIn('event_id', db('events').select('event_id').where({ tenant_id: tenantId })).del();
    await db('events').where({ tenant_id: tenantId }).del();
  });

  it('returns paginated results with metadata', async () => {
    const result = await eventService.listEvents(tenantId, { page: 1, limit: 10 });

    expect(Array.isArray(result.data)).toBe(true);
    expect(typeof result.total).toBe('number');
    expect(result.page).toBe(1);
    expect(result.totalPages).toBeGreaterThanOrEqual(1);
    // Tenant isolation
    result.data.forEach((e) => expect(e.tenant_id).toBe(tenantId));
  });

  it('filters by status', async () => {
    const result = await eventService.listEvents(tenantId, { status: 'draft', page: 1, limit: 20 });
    expect(result.data.every((e) => e.status === 'draft')).toBe(true);
  });

  it('filters by event_type', async () => {
    const result = await eventService.listEvents(tenantId, { event_type: 'multi_day', page: 1, limit: 20 } as any);
    expect(result.data.every((e) => e.event_type === 'multi_day')).toBe(true);
  });

  it('searches by title (case-insensitive)', async () => {
    const result = await eventService.listEvents(tenantId, { search: 'sports', page: 1, limit: 20 });
    expect(result.data.some((e) => e.title.toLowerCase().includes('sports'))).toBe(true);
  });

  it('respects pagination — page 2 offset works', async () => {
    // Create 3 events total (already done in beforeEach)
    const page1 = await eventService.listEvents(tenantId, { page: 1, limit: 2 });
    const page2 = await eventService.listEvents(tenantId, { page: 2, limit: 2 });

    const ids1 = page1.data.map((e) => e.event_id);
    const ids2 = page2.data.map((e) => e.event_id);
    // No overlap between pages
    expect(ids1.every((id) => !ids2.includes(id))).toBe(true);
  });
});

// ── getUpcomingEvents ─────────────────────────────────────────────────────────

describe('getUpcomingEvents', () => {
  afterEach(async () => {
    await db('events').where({ tenant_id: tenantId }).del();
  });

  it('returns only future published events', async () => {
    // Create a published future event
    const future1 = await eventService.createEvent(tenantId, userId, minimalEvent({
      title: 'Future Published',
      start_date: future(5),
      end_date:   futureEnd(5),
    }));
    await eventService.publishEvent(future1.event_id, tenantId, userId);

    // Create a past completed event (insert directly to bypass date validation)
    await db('events').insert({
      tenant_id:            tenantId,
      title:                'Past Event',
      event_type:           'single',
      start_date:           new Date('2020-01-01'),
      end_date:             new Date('2020-01-01T23:59:59'),
      all_day:              false,
      organizer_id:         userId,
      status:               'completed',
      visibility:           'public',
      registration_required: false,
      approval_required:    false,
      allow_guests:         false,
      max_guests_per_registration: 0,
      reminder_enabled:     false,
    });

    const upcoming = await eventService.getUpcomingEvents(tenantId, userId, 10);

    expect(Array.isArray(upcoming)).toBe(true);
    const now = new Date();
    upcoming.forEach((e) => {
      expect(new Date(e.start_date) > now).toBe(true);
      expect(e.status).toBe('published');
      expect(e.tenant_id).toBe(tenantId);
    });
  });
});

// ── getCalendarEvents ─────────────────────────────────────────────────────────

describe('getCalendarEvents', () => {
  afterEach(async () => {
    await db('events').where({ tenant_id: tenantId }).del();
  });

  it('returns only events that fall within the date range', async () => {
    const inRange = await eventService.createEvent(tenantId, userId, minimalEvent({
      title:      'In Range',
      start_date: future(3),
      end_date:   futureEnd(3),
    }));
    await eventService.publishEvent(inRange.event_id, tenantId, userId);

    const outOfRange = await eventService.createEvent(tenantId, userId, minimalEvent({
      title:      'Out of Range',
      start_date: future(60),
      end_date:   futureEnd(60),
    }));
    await eventService.publishEvent(outOfRange.event_id, tenantId, userId);

    const events = await eventService.getCalendarEvents(tenantId, future(1), future(10));

    const ids = events.map((e) => e.event_id);
    expect(ids).toContain(inRange.event_id);
    expect(ids).not.toContain(outOfRange.event_id);
    // Tenant isolation
    events.forEach((e) => expect(e.tenant_id).toBe(tenantId));
  });
});
