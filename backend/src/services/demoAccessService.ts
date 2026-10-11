/**
 * Demo access by request ("Book a live demo" on the marketing site).
 *
 * A visitor leaves their details; we email personal one-click links into each
 * portal of the read-only demo school (plus the shared app sign-in), valid for
 * 7 days. Every open is recorded so the super admin can see who tried the
 * demo, which portals, and follow up. Only the SHA-256 of a link token is
 * stored, so a database leak can't be replayed as sign-in links.
 */
import crypto from 'crypto';
import { db } from '@utils/database';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import { appUrl } from '@utils/publicUrl';
import { DEMO_EMAIL_DOMAIN, DEMO_TENANT_SLUG } from '@utils/demo';

export const LINK_DAYS = 7;
export const ROLES = ['owner', 'principal', 'teacher', 'bursar', 'administrator', 'other'] as const;
export const STUDENT_COUNTS = ['under 200', '200-600', '600-1500', 'over 1500'] as const;

/** Portals of the demo school: who you sign in as. */
export const DEMO_PORTALS = [
  { key: 'principal', portal: 'Principal', person: 'Mrs Mariama Kamara, Principal', identifier: `principal@${DEMO_EMAIL_DOMAIN}` },
  { key: 'teacher', portal: 'Teacher', person: 'Mr Ibrahim Sesay, JSS 2 form teacher', identifier: `teacher@${DEMO_EMAIL_DOMAIN}` },
  { key: 'student', portal: 'Student', person: 'Mohamed Bangura, JSS 2', identifier: 'DEMO-0001' },
  { key: 'parent', portal: 'Parent', person: 'Mrs Aminata Bangura, parent of 2', identifier: `parent@${DEMO_EMAIL_DOMAIN}` },
  { key: 'bursar', portal: 'Bursar', person: 'Ms Fatmata Conteh, Bursar', identifier: `bursar@${DEMO_EMAIL_DOMAIN}` },
  { key: 'admissions', portal: 'Admissions Officer', person: 'Mr Abdul Koroma, Admissions Officer', identifier: `admissions@${DEMO_EMAIL_DOMAIN}` },
] as const;

const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const newToken = () => crypto.randomBytes(24).toString('base64url');
const clean = (v: unknown, n: number) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const linkFor = (token: string, portal: string) => appUrl(`/demo/start?t=${encodeURIComponent(token)}&portal=${portal}`);

async function demoTenant() {
  const t = await db('tenants').where({ slug: DEMO_TENANT_SLUG }).first('id', 'settings', 'status');
  if (!t) return null;
  const s = typeof t.settings === 'string' ? JSON.parse(t.settings || '{}') : t.settings || {};
  return s.demo === true ? { id: t.id as string, password: (s.demo_password as string) || null, status: t.status } : null;
}

async function event(requestId: string, kind: string, extra: { portal?: string | null; note?: string | null; by?: string | null } = {}) {
  await db('demo_request_events').insert({ request_id: requestId, kind, portal: extra.portal ?? null, note: extra.note ?? null, created_by: extra.by ?? null })
    .catch((e) => logger.warn(`demo event failed: ${e?.message || e}`));
}

async function sendLinks(row: any, token: string): Promise<boolean> {
  const tenant = await demoTenant();
  const { sendDemoAccessEmail } = await import('./emailService.js');
  const r: any = await sendDemoAccessEmail({
    toEmail: row.email, name: row.full_name, password: tenant?.password ?? null, expiresAt: new Date(row.expires_at),
    links: DEMO_PORTALS.map((p) => ({ portal: p.portal, person: p.person, identifier: p.identifier, url: linkFor(token, p.key) })),
  });
  const ok = r?.status === 'sent' || r?.status === 'disabled';
  await event(row.id, 'link_sent', { note: ok ? `Demo links emailed to ${row.email}` : 'The email could not be sent' });
  return ok;
}

export const demoAccessService = {
  /** Public form. Always answers the same way for a valid form (no account probing). */
  async request(body: any, meta: { ip?: string; userAgent?: string }) {
    if (clean(body?.website, 200)) return { ok: true }; // honeypot: bots fill every field
    const full_name = clean(body?.full_name, 150);
    const email = clean(body?.email, 255).toLowerCase();
    const phone = clean(body?.phone, 40);
    const school_name = clean(body?.school_name, 200);
    const role = clean(body?.role, 40);
    const student_count = clean(body?.student_count, 20) || null;
    if (full_name.length < 2) throw new AppError('Enter your full name.', 400, 'VALIDATION_ERROR');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new AppError('Enter a valid email address.', 400, 'VALIDATION_ERROR');
    if (email.endsWith(`@${DEMO_EMAIL_DOMAIN}`)) throw new AppError('Enter your own email address.', 400, 'VALIDATION_ERROR');
    if (phone.replace(/\D/g, '').length < 7) throw new AppError('Enter a phone number we can reach you on.', 400, 'VALIDATION_ERROR');
    if (school_name.length < 2) throw new AppError('Enter your school name.', 400, 'VALIDATION_ERROR');
    if (!(ROLES as readonly string[]).includes(role)) throw new AppError('Choose your role.', 400, 'VALIDATION_ERROR');
    if (student_count && !(STUDENT_COUNTS as readonly string[]).includes(student_count)) throw new AppError('Choose the number of students.', 400, 'VALIDATION_ERROR');
    if (!(await demoTenant())) throw new AppError('The demo is being refreshed. Please try again in a few minutes.', 503, 'DEMO_UNAVAILABLE');

    // Database caps that hold across serverless instances.
    if (meta.ip) {
      const recent = Number((await db('demo_requests').where({ ip: meta.ip }).where('updated_at', '>', db.raw("NOW() - interval '1 hour'")).count({ n: '*' }).first() as any)?.n) || 0;
      if (recent >= 10) throw new AppError('Too many demo requests from this connection. Please try again later.', 429, 'RATE_LIMITED');
    }
    const existing = await db('demo_requests').whereRaw('LOWER(email) = ?', [email]).first();
    if (existing && Date.now() - new Date(existing.updated_at).getTime() < 60_000) return { ok: true, email }; // double submit

    const token = newToken();
    const expires_at = new Date(Date.now() + LINK_DAYS * 86400_000);
    const fields = {
      full_name, email, phone, school_name, role, student_count, consent_followup: body?.consent_followup === true,
      token_hash: sha(token), expires_at, ip: meta.ip?.slice(0, 64) || null, user_agent: meta.userAgent?.slice(0, 300) || null, updated_at: new Date(),
    };
    let row: any;
    if (existing) {
      [row] = await db('demo_requests').where({ id: existing.id }).update({ ...fields, request_count: db.raw('request_count + 1') }).returning('*');
      await event(row.id, 'requested', { note: 'Asked for the demo again (new links sent)' });
    } else {
      [row] = await db('demo_requests').insert(fields).returning('*');
      await event(row.id, 'requested', { note: `${school_name} · ${role}${student_count ? ` · ${student_count} students` : ''}` });
    }
    await sendLinks(row, token).catch((e) => logger.warn(`Demo email failed for ${email}: ${e?.message || e}`));
    // Heads-up for the sales inbox (best-effort).
    const inbox = process.env.DEMO_LEADS_EMAIL || process.env.CONTACT_EMAIL;
    if (inbox && !existing) {
      import('./emailService.js').then(({ default: es }: any) => es.sendEmail({
        ...es.platformSenderFor?.('info'), to: inbox, subject: `New demo request: ${school_name}`, isHtml: false,
        body: `${full_name} (${role}) from ${school_name} asked for the demo.\nEmail: ${email}\nPhone: ${phone}\nStudents: ${student_count || 'not given'}\nFollow-up emails: ${fields.consent_followup ? 'yes' : 'no'}\n\nSee Platform → Demo requests.`,
      })).catch(() => undefined);
    }
    return { ok: true, email };
  },

  /** An emailed link: sign in to the demo school as that portal. */
  async startSession(token: string, portal: string) {
    const p = DEMO_PORTALS.find((x) => x.key === portal);
    if (!p || !token || token.length > 100) throw new AppError('This demo link is not valid.', 400, 'DEMO_LINK_INVALID');
    const row = await db('demo_requests').where({ token_hash: sha(token) }).first();
    if (!row) throw new AppError('This demo link is not valid. Ask for a new one on the WiSkul website.', 404, 'DEMO_LINK_INVALID');
    if (new Date(row.expires_at).getTime() < Date.now()) throw new AppError('This demo link has expired. Ask for a new one on the WiSkul website; it only takes a minute.', 410, 'DEMO_LINK_EXPIRED');
    const tenant = await demoTenant();
    if (!tenant || tenant.status !== 'active') throw new AppError('The demo is being refreshed. Please try again in a few minutes.', 503, 'DEMO_UNAVAILABLE');
    const user = p.identifier.includes('@')
      ? await db('users').where({ tenant_id: tenant.id, email: p.identifier }).first('id')
      : await db('users').where({ tenant_id: tenant.id }).whereRaw('LOWER(username) = ?', [p.identifier.toLowerCase()]).first('id');
    if (!user) throw new AppError('The demo is being refreshed. Please try again in a few minutes.', 503, 'DEMO_UNAVAILABLE');
    const { AuthService } = await import('./authService.js');
    const session = await new AuthService(db).issueSessionForUserId(user.id);
    await db('demo_requests').where({ id: row.id }).update({
      open_count: db.raw('open_count + 1'),
      portals_opened: db.raw(`jsonb_set(portals_opened, ARRAY[?]::text[], to_jsonb(COALESCE((portals_opened->>?)::int, 0) + 1))`, [p.key, p.key]),
      first_opened_at: db.raw('COALESCE(first_opened_at, NOW())'), last_opened_at: db.fn.now(),
    });
    await event(row.id, 'opened', { portal: p.key });
    return { ...session, demo: { name: row.full_name, portal: p.key } };
  },

  // ── Super admin ───────────────────────────────────────────────────────────
  async list(f: { search?: string; filter?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(f.page) || 1);
    const limit = Math.min(Math.max(1, Number(f.limit) || 25), 200);
    const base = () => {
      const q = db('demo_requests as r')
        .joinRaw(`LEFT JOIN LATERAL (
          SELECT t.id AS tenant_id, t.name AS tenant_name, u.created_at AS registered_at FROM users u JOIN tenants t ON t.id = u.tenant_id
          WHERE LOWER(u.email) = LOWER(r.email) AND u.role = 'principal' AND t.slug <> ? ORDER BY u.created_at LIMIT 1) AS conv ON true`, [DEMO_TENANT_SLUG]);
      const s = clean(f.search, 100);
      if (s) q.where((w) => w.whereILike('r.full_name', `%${s}%`).orWhereILike('r.email', `%${s}%`).orWhereILike('r.school_name', `%${s}%`).orWhereILike('r.phone', `%${s}%`));
      if (f.filter === 'opened') q.where('r.open_count', '>', 0);
      if (f.filter === 'not_opened') q.where('r.open_count', 0);
      if (f.filter === 'converted') q.whereNotNull('conv.tenant_id');
      if (f.filter === 'followup') q.where('r.consent_followup', true).whereNull('conv.tenant_id');
      return q;
    };
    const total = Number((await base().count({ n: '*' }).first() as any)?.n) || 0;
    const rows = await base().select('r.*', 'conv.tenant_id as converted_tenant_id', 'conv.tenant_name as converted_school', 'conv.registered_at')
      .orderBy('r.created_at', 'desc').limit(limit).offset((page - 1) * limit);
    const stats: any = (await db.raw(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE r.created_at > NOW() - interval '7 days')::int AS this_week,
             COUNT(*) FILTER (WHERE r.open_count > 0)::int AS opened,
             COUNT(conv.tenant_id)::int AS converted
      FROM demo_requests r LEFT JOIN LATERAL (
        SELECT t.id AS tenant_id FROM users u JOIN tenants t ON t.id = u.tenant_id
        WHERE LOWER(u.email) = LOWER(r.email) AND u.role = 'principal' AND t.slug <> ? LIMIT 1) conv ON true`, [DEMO_TENANT_SLUG])).rows[0];
    return { data: rows.map(({ token_hash, ...r }: any) => ({ ...r, link_expired: new Date(r.expires_at).getTime() < Date.now() })), pagination: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) }, stats };
  },

  async get(id: string) {
    const row = await db('demo_requests').where({ id }).first();
    if (!row) throw new AppError('Demo request not found', 404, 'NOT_FOUND');
    const events = await db('demo_request_events as e').leftJoin('users as u', 'u.id', 'e.created_by').where('e.request_id', id)
      .select('e.*', db.raw("TRIM(CONCAT_WS(' ', u.first_name, u.last_name)) as by_name")).orderBy('e.created_at', 'desc').limit(200);
    const { token_hash, ...rest } = row;
    return { ...rest, link_expired: new Date(row.expires_at).getTime() < Date.now(), events };
  },

  /** New links (the old ones stop working) and a fresh 7 days. */
  async resend(id: string, by: string) {
    const token = newToken();
    const [row] = await db('demo_requests').where({ id }).update({ token_hash: sha(token), expires_at: new Date(Date.now() + LINK_DAYS * 86400_000), updated_at: new Date() }).returning('*');
    if (!row) throw new AppError('Demo request not found', 404, 'NOT_FOUND');
    await event(row.id, 'note', { note: 'New demo links sent by the WiSkul team', by });
    const ok = await sendLinks(row, token);
    return { sent: ok };
  },

  /** Emails only people who agreed to follow-up emails. */
  async followUp(ids: string[], subject: string, message: string, by: string) {
    const s = clean(subject, 150), m = String(message || '').trim().slice(0, 5000);
    if (s.length < 3) throw new AppError('Write a subject.', 400, 'VALIDATION_ERROR');
    if (m.length < 10) throw new AppError('Write the message (at least 10 characters).', 400, 'VALIDATION_ERROR');
    if (!Array.isArray(ids) || !ids.length || ids.length > 500) throw new AppError('Choose who to email (up to 500 at a time).', 400, 'VALIDATION_ERROR');
    const rows = await db('demo_requests').whereIn('id', ids);
    const { sendDemoFollowUpEmail } = await import('./emailService.js');
    let sent = 0, skipped = 0, failed = 0;
    for (const r of rows) {
      if (!r.consent_followup) { skipped++; continue; }
      try {
        const res: any = await sendDemoFollowUpEmail({ toEmail: r.email, name: r.full_name, subject: s, message: m, demoUrl: appUrl('/#demo') });
        if (res?.status === 'sent' || res?.status === 'disabled') {
          sent++;
          await db('demo_requests').where({ id: r.id }).update({ followups_sent: db.raw('followups_sent + 1'), last_followup_at: db.fn.now() });
          await event(r.id, 'followup', { note: s, by });
        } else failed++;
      } catch (e: any) { failed++; logger.warn(`Demo follow-up to ${r.email} failed: ${e?.message || e}`); }
    }
    return { sent, skipped, failed };
  },

  async saveNotes(id: string, notes: string, by: string) {
    const n = String(notes || '').slice(0, 5000);
    const updated = await db('demo_requests').where({ id }).update({ notes: n || null, updated_at: new Date() });
    if (!updated) throw new AppError('Demo request not found', 404, 'NOT_FOUND');
    await event(id, 'note', { note: 'Notes updated', by });
    return this.get(id);
  },

  /** Privacy: remove a tester completely (on request). */
  async remove(id: string) {
    const n = await db('demo_requests').where({ id }).del();
    if (!n) throw new AppError('Demo request not found', 404, 'NOT_FOUND');
    return { removed: true };
  },

  async csv(): Promise<string> {
    const { data } = await this.list({ limit: 200, page: 1 });
    const all: any[] = [...data];
    for (let page = 2; all.length < 10000; page++) {
      const r = await this.list({ limit: 200, page });
      if (!r.data.length) break;
      all.push(...r.data);
    }
    const head = ['Requested', 'Name', 'Email', 'Phone', 'School', 'Role', 'Students', 'Follow-up OK', 'Opens', 'Portals', 'Last opened', 'Follow-ups', 'Registered school'];
    const esc = (v: any) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"` : s; };
    const lines = all.map((r) => [
      new Date(r.created_at).toISOString().slice(0, 16).replace('T', ' '), r.full_name, r.email, r.phone, r.school_name, r.role, r.student_count,
      r.consent_followup ? 'yes' : 'no', r.open_count, Object.keys(r.portals_opened || {}).join(' '), r.last_opened_at ? new Date(r.last_opened_at).toISOString().slice(0, 16).replace('T', ' ') : '',
      r.followups_sent, r.converted_school || '',
    ].map(esc).join(','));
    return [head.join(','), ...lines].join('\n');
  },
};

export default demoAccessService;
