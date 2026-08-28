/**
 * Event Routes — Integration Tests
 * Multi-tenant aware: every test scopes to a real tenant UUID obtained at setup.
 *
 * What changed from the original broken file:
 *  - import db from '../../utils/database' (was '../../config/database')
 *  - import app from '../../index' via default export
 *  - tenant_id is a UUID (the system creates a tenant before tests run)
 *  - field names: start_date / end_date  (was start_datetime / end_datetime)
 *  - event_type values: 'single' | 'multi_day' | 'recurring'
 *  - non-UUID event IDs return 404, not 500
 *  - registrations/attendance list endpoints now return paginated shape
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../index';
import db from '../../utils/database';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Minimum ISO datetime string one day in the future */
function future(offsetDays = 1): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
}

/** Minimum ISO datetime string N days in the future */
function futureEnd(offsetDays = 1, extraHours = 2): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(d.getHours() + extraHours);
  return d.toISOString();
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

let tenantId: string;
let principalToken: string;
let principalUserId: string;

const PRINCIPAL_EMAIL = `test-principal-${Date.now()}@eventroutes.test`;
const PRINCIPAL_PASS  = 'TestPass123!';

beforeAll(async () => {
  // Create an isolated tenant for this test run
  const [tenant] = await db('tenants')
    .insert({
      name:          `Event Routes Test Tenant ${Date.now()}`,
      slug:          `evt-routes-test-${Date.now()}`,
      status:        'active',
      timezone:      'UTC',
      currency:      'USD',
      language:      'en',
      max_users:     100,
      max_storage_gb: 10,
      settings:      {},
    })
    .returning('id');

  tenantId = tenant.id ?? tenant;

  // Create a principal user for this tenant
  const bcryptjs = await import('bcryptjs');
  const hash = await bcryptjs.default.hash(PRINCIPAL_PASS, 10);

  const [user] = await db('users')
    .insert({
      tenant_id:     tenantId,
      email:         PRINCIPAL_EMAIL,
      password_hash: hash,
      first_name:    'Test',
      last_name:     'Principal',
      role:          'principal',
      status:        'active',
    })
    .returning('id');

  principalUserId = user.id ?? user;

  // Log in to get a token
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: PRINCIPAL_EMAIL, password: PRINCIPAL_PASS });

  principalToken = loginRes.body?.data?.accessToken ?? loginRes.body?.token ?? '';
});

afterAll(async () => {
  // Clean up in reverse FK order
  await db('event_attendance').whereIn(
    'event_id', db('events').select('event_id').where({ tenant_id: tenantId }),
  ).del();
  await db('event_registrations').whereIn(
    'event_id', db('events').select('event_id').where({ tenant_id: tenantId }),
  ).del();
  await db('event_recurrence').whereIn(
    'event_id', db('events').select('event_id').where({ tenant_id: tenantId }),
  ).del();
  await db('event_category_mappings').whereIn(
    'event_id', db('events').select('event_id').where({ tenant_id: tenantId }),
  ).del();
  await db('events').where({ tenant_id: tenantId }).del();
  await db('event_categories').where({ tenant_id: tenantId }).del();
  await db('users').where({ id: principalUserId }).del();
  await db('tenants').where({ id: tenantId }).del();
});

// ── Helper: create a minimal valid event via the API ─────────────────────────

async function createTestEvent(overrides: Record<string, any> = {}) {
  const res = await request(app)
    .post('/api/v1/events')
    .set('Authorization', `Bearer ${principalToken}`)
    .send({
      title:      'Test Event',
      event_type: 'single',
      start_date: future(1),
      end_date:   futureEnd(1),
      ...overrides,
    });
  return res;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/v1/events — Create Event', () => {
  it('creates a new event and returns 201', async () => {
    const res = await createTestEvent({ title: 'Annual Science Fair', location: 'Science Lab', capacity: 100 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Annual Science Fair');
    expect(res.body.data.event_id).toBeDefined();
    expect(res.body.data.tenant_id).toBe(tenantId); // tenant isolation
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .post('/api/v1/events')
      .send({ title: 'No Auth', event_type: 'single', start_date: future(1), end_date: futureEnd(1) });

    expect(res.status).toBe(401);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({ title: 'Missing dates' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when end_date is before start_date', async () => {
    const res = await request(app)
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({
        title:      'Bad Dates',
        event_type: 'single',
        start_date: futureEnd(2),   // later
        end_date:   future(1),      // earlier
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/end_date/i);
  });
});

describe('GET /api/v1/events — List Events', () => {
  beforeEach(async () => {
    // Seed two published events scoped to our tenant
    await createTestEvent({ title: 'Sports Day',   event_type: 'single' });
    await createTestEvent({ title: 'Cultural Night', event_type: 'single' });
  });

  it('returns paginated event list', async () => {
    const res = await request(app)
      .get('/api/v1/events')
      .set('Authorization', `Bearer ${principalToken}`)
      .query({ page: 1, limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    // Tenant isolation: all events belong to our tenant
    res.body.data.forEach((e: any) => expect(e.tenant_id).toBe(tenantId));
  });

  it('filters by event_type', async () => {
    await createTestEvent({ title: 'Recurring Talk', event_type: 'recurring' });

    const res = await request(app)
      .get('/api/v1/events')
      .set('Authorization', `Bearer ${principalToken}`)
      .query({ event_type: 'recurring' });

    expect(res.status).toBe(200);
    expect(res.body.data.every((e: any) => e.event_type === 'recurring')).toBe(true);
  });

  it('filters by status', async () => {
    const createRes = await createTestEvent({ title: 'Draft Event' });
    // events start as draft — check draft filter
    const res = await request(app)
      .get('/api/v1/events')
      .set('Authorization', `Bearer ${principalToken}`)
      .query({ status: 'draft' });

    expect(res.status).toBe(200);
    expect(res.body.data.every((e: any) => e.status === 'draft')).toBe(true);
  });

  it('searches by title', async () => {
    await createTestEvent({ title: 'UniqueSearchTitle_XYZ' });

    const res = await request(app)
      .get('/api/v1/events')
      .set('Authorization', `Bearer ${principalToken}`)
      .query({ search: 'UniqueSearchTitle_XYZ' });

    expect(res.status).toBe(200);
    expect(res.body.data.some((e: any) => e.title.includes('UniqueSearchTitle_XYZ'))).toBe(true);
  });
});

describe('GET /api/v1/events/:eventId — Event Details', () => {
  it('returns full event details', async () => {
    const created = await createTestEvent({ title: 'Detail Test Event' });
    const eventId = created.body.data.event_id;

    const res = await request(app)
      .get(`/api/v1/events/${eventId}`)
      .set('Authorization', `Bearer ${principalToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.event_id).toBe(eventId);
    expect(res.body.data.tenant_id).toBe(tenantId);
  });

  it('returns 404 for a non-existent UUID', async () => {
    const res = await request(app)
      .get('/api/v1/events/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${principalToken}`);

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/events/:eventId — Update Event', () => {
  it('updates title and description', async () => {
    const created = await createTestEvent({ title: 'Original Title' });
    const eventId = created.body.data.event_id;

    const res = await request(app)
      .put(`/api/v1/events/${eventId}`)
      .set('Authorization', `Bearer ${principalToken}`)
      .send({ title: 'Updated Title', description: 'New desc' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Updated Title');
    expect(res.body.data.description).toBe('New desc');
  });

  it('returns 404 for a non-existent event', async () => {
    const res = await request(app)
      .put('/api/v1/events/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${principalToken}`)
      .send({ title: 'Ghost' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/events/:eventId — Delete Event', () => {
  it('deletes an event with no registrations', async () => {
    const created = await createTestEvent({ title: 'To Be Deleted' });
    const eventId = created.body.data.event_id;

    const delRes = await request(app)
      .delete(`/api/v1/events/${eventId}`)
      .set('Authorization', `Bearer ${principalToken}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    const getRes = await request(app)
      .get(`/api/v1/events/${eventId}`)
      .set('Authorization', `Bearer ${principalToken}`);

    expect(getRes.status).toBe(404);
  });
});

describe('POST /api/v1/events/:eventId/publish — Publish Event', () => {
  it('publishes a draft event', async () => {
    const created = await createTestEvent({ title: 'Draft to Publish' });
    const eventId = created.body.data.event_id;

    const res = await request(app)
      .post(`/api/v1/events/${eventId}/publish`)
      .set('Authorization', `Bearer ${principalToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('published');
    expect(res.body.data.tenant_id).toBe(tenantId);
  });
});

describe('POST /api/v1/events/:eventId/duplicate — Duplicate Event', () => {
  it('creates a copy with (Copy) suffix in draft status', async () => {
    const created = await createTestEvent({ title: 'Original' });
    const eventId = created.body.data.event_id;

    const res = await request(app)
      .post(`/api/v1/events/${eventId}/duplicate`)
      .set('Authorization', `Bearer ${principalToken}`);

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Original (Copy)');
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.tenant_id).toBe(tenantId);
    expect(res.body.data.event_id).not.toBe(eventId);
  });
});

describe('POST /api/v1/events/:eventId/register — Register for Event', () => {
  it('registers the principal for a published event', async () => {
    const created = await createTestEvent({ title: 'Registrable Event', capacity: 50 });
    const eventId = created.body.data.event_id;

    // Publish first
    await request(app)
      .post(`/api/v1/events/${eventId}/publish`)
      .set('Authorization', `Bearer ${principalToken}`);

    const res = await request(app)
      .post(`/api/v1/events/${eventId}/register`)
      .set('Authorization', `Bearer ${principalToken}`)
      .send({ rsvp_status: 'going', guests_count: 0 });

    expect(res.status).toBe(201);
    expect(res.body.data.event_id).toBe(eventId);
  });

  it('prevents duplicate registration', async () => {
    const created = await createTestEvent({ title: 'No Dupes Event', capacity: 50 });
    const eventId = created.body.data.event_id;
    await request(app).post(`/api/v1/events/${eventId}/publish`).set('Authorization', `Bearer ${principalToken}`);

    await request(app)
      .post(`/api/v1/events/${eventId}/register`)
      .set('Authorization', `Bearer ${principalToken}`)
      .send({ rsvp_status: 'going' });

    const res = await request(app)
      .post(`/api/v1/events/${eventId}/register`)
      .set('Authorization', `Bearer ${principalToken}`)
      .send({ rsvp_status: 'going' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already registered/i);
  });
});

describe('GET /api/v1/events/:eventId/registrations — List Registrations', () => {
  it('returns paginated registrations for staff', async () => {
    const created = await createTestEvent({ title: 'Reg List Event', capacity: 50 });
    const eventId = created.body.data.event_id;
    await request(app).post(`/api/v1/events/${eventId}/publish`).set('Authorization', `Bearer ${principalToken}`);
    await request(app).post(`/api/v1/events/${eventId}/register`).set('Authorization', `Bearer ${principalToken}`).send({ rsvp_status: 'going' });

    const res = await request(app)
      .get(`/api/v1/events/${eventId}/registrations`)
      .set('Authorization', `Bearer ${principalToken}`)
      .query({ page: 1, limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.page).toBe(1);
    expect(res.body.totalPages).toBeGreaterThanOrEqual(1);
  });
});

describe('GET /api/v1/events/view/calendar — Calendar View', () => {
  it('returns events for a date range', async () => {
    const res = await request(app)
      .get('/api/v1/events/view/calendar')
      .set('Authorization', `Bearer ${principalToken}`)
      .query({ start_date: future(0), end_date: future(30) });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    // All returned events must belong to the caller's tenant
    res.body.data.forEach((e: any) => expect(e.tenant_id).toBe(tenantId));
  });

  it('returns 400 when dates are missing', async () => {
    const res = await request(app)
      .get('/api/v1/events/view/calendar')
      .set('Authorization', `Bearer ${principalToken}`);

    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/events/view/upcoming — Upcoming Events', () => {
  it('returns upcoming published events for the tenant', async () => {
    const res = await request(app)
      .get('/api/v1/events/view/upcoming')
      .set('Authorization', `Bearer ${principalToken}`)
      .query({ limit: 5 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('GET /api/v1/events/analytics/dashboard — Analytics', () => {
  it('returns analytics summary for the tenant', async () => {
    const res = await request(app)
      .get('/api/v1/events/analytics/dashboard')
      .set('Authorization', `Bearer ${principalToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.total_events).toBe('number');
    expect(typeof res.body.data.total_registrations).toBe('number');
    expect(Array.isArray(res.body.data.trends)).toBe(true);
  });
});

describe('GET /api/v1/events/user/registrations — My Registrations', () => {
  it('returns only the current user\'s registrations', async () => {
    // Register for an event first
    const created = await createTestEvent({ title: 'My Reg Event', capacity: 50 });
    const eventId = created.body.data.event_id;
    await request(app).post(`/api/v1/events/${eventId}/publish`).set('Authorization', `Bearer ${principalToken}`);
    await request(app).post(`/api/v1/events/${eventId}/register`).set('Authorization', `Bearer ${principalToken}`).send({ rsvp_status: 'going' });

    const res = await request(app)
      .get('/api/v1/events/user/registrations')
      .set('Authorization', `Bearer ${principalToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    // Every registration belongs to the current user
    res.body.data.forEach((r: any) => expect(r.user_id).toBe(principalUserId));
  });
});

describe('Tenant isolation', () => {
  it('cannot see events from another tenant', async () => {
    // Create a second isolated tenant + principal
    const [tenant2] = await db('tenants')
      .insert({ name: 'Isolation Test Tenant 2', slug: `isolation-test-${Date.now()}`, status: 'active', timezone: 'UTC', currency: 'USD', language: 'en', max_users: 10, max_storage_gb: 1, settings: {} })
      .returning('id');

    const t2Id = tenant2.id ?? tenant2;
    const bcryptjs = await import('bcryptjs');
    const hash = await bcryptjs.default.hash('TestPass123!', 10);
    const [u2] = await db('users')
      .insert({ tenant_id: t2Id, email: `t2-${Date.now()}@test.com`, password_hash: hash, first_name: 'T2', last_name: 'User', role: 'principal', status: 'active' })
      .returning('id');

    const loginRes = await request(app).post('/api/v1/auth/login').send({ email: `t2-${Date.now()}@test.com`, password: 'TestPass123!' });
    // (re-read the email from the user we just inserted)
    const u2Email = (await db('users').where({ id: u2.id ?? u2 }).select('email').first())?.email;
    const login2 = await request(app).post('/api/v1/auth/login').send({ email: u2Email, password: 'TestPass123!' });
    const t2Token = login2.body?.data?.accessToken ?? login2.body?.token ?? '';

    // Create event as tenant 1
    const created = await createTestEvent({ title: 'Tenant 1 Secret Event' });
    const eventId = created.body.data.event_id;

    // Tenant 2 tries to access it — should get 404 (not found in their scope)
    const res = await request(app)
      .get(`/api/v1/events/${eventId}`)
      .set('Authorization', `Bearer ${t2Token}`);

    expect(res.status).toBe(404);

    // Cleanup
    await db('users').where({ id: u2.id ?? u2 }).del();
    await db('tenants').where({ id: t2Id }).del();
  });
});
