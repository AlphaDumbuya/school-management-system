/**
 * studentRecordService — completing the records of students who were enrolled before the system.
 *
 *  - Staff create a personal, expiring link per student. Only the SHA-256 of the secret is stored.
 *  - A parent opens the link (no login), sees what the school already holds, and sends corrections.
 *  - The corrections wait in a queue. Nothing on the student changes until the officer approves.
 *  - At a parents' session the officer enters the same fields directly (saved at once, and logged).
 *  - Completeness (which required fields are still empty, which students have no photo) is computed from the
 *    live student and guardian rows, so it is always current.
 */
import crypto from 'crypto';
import { db } from '../utils/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { linkGuardianForStudent } from '../utils/guardianLinking';

const WELCOME_KEY = 'records_welcome_message';
/**
 * What parents read before the form. {school} becomes the school's own name. The school can replace it in
 * Student Records; blank paragraphs separate the paragraphs.
 */
export const DEFAULT_WELCOME = [
  'Dear Parent or Guardian,',
  '{school} is moving to a digital school management system. Report cards, attendance, fees, timetables and announcements will be kept in one secure place, and you will be able to follow your child\'s progress from your phone.',
  'To make this possible, we are asking the parents and guardians of every student already enrolled to confirm and complete their child\'s information. The records we hold from earlier years are incomplete. Accurate details help us to reach you quickly, to look after your child in an emergency, and to give you access to your own parent portal.',
  'Please complete one form for each child. It takes about three minutes. Your details are used only for your child\'s school record, and the school checks every form before anything is changed.',
  'Thank you for your cooperation and for your continued trust in {school}.',
].join('\n\n');
const renderWelcome = (text: string, school: string) => text.replace(/\{school\}/gi, school);
/** Welcome text, contact details and school identity for the public pages. */
async function publicIntro(tenantId: string) {
  // WiSkul serves many schools: name, contacts and colour come from THIS school's own record.
  const row = await db('schools').where({ tenant_id: tenantId }).select('name', 'logo_url', 'phone', 'email', 'brand_color').first();
  const tenant = await db('tenants').where({ id: tenantId }).first('name', 'slug');
  const name = row?.name || tenant?.name || '';
  const custom = await db('school_config_settings').where({ tenant_id: tenantId, setting_key: WELCOME_KEY }).first('setting_value').catch(() => null);
  const text = String(custom?.setting_value || '').trim() || DEFAULT_WELCOME;
  const colour = String(row?.brand_color || '').trim();
  return {
    school: { name, logo_url: row?.logo_url || null, brand_color: /^#[0-9a-fA-F]{6}$/.test(colour) ? colour.toUpperCase() : null, slug: tenant?.slug || null },
    welcome: renderWelcome(text, name),
    contact: { phone: row?.phone || null, email: row?.email || null },
  };
}
const referenceOf = (id: unknown) => String(id || '').replace(/-/g, '').slice(0, 8).toUpperCase();

type FieldType = 'text' | 'long' | 'date' | 'gender' | 'phone' | 'email';
export interface RecordField { key: string; label: string; type: FieldType; required?: boolean; placeholder?: string; help?: string; why?: string; group: 'child' | 'guardian' | 'emergency' }

/** The single list the forms, the completeness check and the validation all read. */
export const RECORD_FIELDS: RecordField[] = [
  { key: 'date_of_birth', label: 'Date of birth', type: 'date', required: true, group: 'child' },
  { key: 'gender', label: 'Sex', type: 'gender', required: true, group: 'child' },
  { key: 'nationality', label: 'Nationality', type: 'text', required: true, placeholder: 'e.g. Sierra Leonean', group: 'child' },
  { key: 'religion', label: 'Religion', type: 'text', placeholder: 'e.g. Christian or Muslim', group: 'child' },
  { key: 'place_of_birth', label: 'Place of birth', type: 'text', placeholder: 'Town or city where the child was born', group: 'child' },
  { key: 'address', label: 'Home address', type: 'long', required: true, placeholder: 'House number, street and area', group: 'child' },
  { key: 'previous_school', label: 'Previous school', type: 'text', placeholder: 'Last school attended, if any', group: 'child' },
  { key: 'medical_conditions', label: 'Medical conditions or allergies (write "none" if there are none)', type: 'long', placeholder: 'e.g. asthma, a food allergy, or write none', group: 'child' },
  { key: 'guardian_name', label: 'Parent or guardian full name', type: 'text', required: true, placeholder: 'First and last name', group: 'guardian' },
  { key: 'guardian_relationship', label: 'Relationship to the child', type: 'text', required: true, placeholder: 'e.g. Mother, Father, Aunt', group: 'guardian' },
  { key: 'guardian_phone', label: 'Phone number', type: 'phone', required: true, placeholder: 'e.g. +232 76 123456', group: 'guardian' },
  { key: 'guardian_email', label: 'Email (for the parent portal)', type: 'email', required: true, placeholder: 'name@example.com', group: 'guardian' },
  { key: 'guardian_occupation', label: 'Occupation', type: 'text', placeholder: 'e.g. Trader, Teacher, Nurse', group: 'guardian' },
  { key: 'emergency_contact_name', label: 'Emergency contact name', type: 'text', required: true, placeholder: 'Someone we can call if we cannot reach you', group: 'emergency' },
  { key: 'emergency_contact_relationship', label: 'Emergency contact relationship', type: 'text', placeholder: 'e.g. Uncle, Neighbour', group: 'emergency' },
  { key: 'emergency_contact', label: 'Emergency contact phone', type: 'phone', required: true, placeholder: 'e.g. +232 77 123456', group: 'emergency' },
];
/**
 * Why each required field is needed. The forms show `help` under the field and `why` in the error when it is left
 * empty, so a parent understands the school is not asking for no reason.
 */
const EXPLAIN: Record<string, { help?: string; why: string }> = {
  date_of_birth: { why: "The school keeps your child's exact date of birth for official records and examinations." },
  gender: { why: "It is part of your child's official school record." },
  nationality: { why: "It is part of your child's official school record." },
  address: { why: "The school needs to know where your child lives, for safety and so we can reach you." },
  guardian_name: { why: 'We need to know who to contact about your child.' },
  guardian_relationship: { why: 'We need to know how you are related to the child (for example mother, father or aunt).' },
  guardian_phone: { why: 'The school must be able to call you about your child, for example if the child is ill.' },
  guardian_email: {
    help: 'Used to create your parent portal account, send you your child\'s results and fee notices, and let you reset your password.',
    why: 'Your email address is how the school creates your parent portal account and sends you your child\'s results, fee notices and announcements, and it lets you reset your password. '
      + 'Every parent or guardian needs one. If you do not have an email address, ask a family member or friend to help you create a free one (for example with Gmail), then come back to this form: what you typed is saved on this phone.',
  },
  emergency_contact_name: { why: 'If we cannot reach you in an emergency, the school must have someone else to call.' },
  emergency_contact: { why: 'We need a phone number for the emergency contact so we can reach them quickly.' },
};
for (const f of RECORD_FIELDS) Object.assign(f, EXPLAIN[f.key] || {});
const FIELD = new Map(RECORD_FIELDS.map((f) => [f.key, f]));
/** A message for the fields still empty, each with the reason it is needed. */
const missingMessage = (keys: string[]) => {
  const f = keys.map((k) => FIELD.get(k)).filter((x): x is RecordField => !!x);
  return `Please fill in: ${f.map((x) => x.label).join(', ')}. ` + f.filter((x) => x.why).map((x) => `${x.label.replace(/ \(.*\)$/, '')}: ${x.why}`).join(' ');
};
const REQUIRED = RECORD_FIELDS.filter((f) => f.required);
const MAX_LEN: Record<FieldType, number> = { text: 200, long: 500, date: 10, gender: 10, phone: 20, email: 255 };
/** Columns of `students` written directly. */
const STUDENT_COLUMNS = new Set([
  'date_of_birth', 'gender', 'nationality', 'religion', 'place_of_birth', 'address', 'previous_school', 'medical_conditions',
  'guardian_name', 'guardian_relationship', 'guardian_phone', 'guardian_occupation',
  'emergency_contact_name', 'emergency_contact_relationship', 'emergency_contact',
]);
const GUARDIAN_KEYS = ['guardian_name', 'guardian_relationship', 'guardian_phone', 'guardian_email', 'guardian_occupation'];

const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const isoDate = (v: any): string => {
  if (!v) return '';
  if (typeof v === 'string') return v.slice(0, 10);
  const d = v as Date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Validate what a parent or officer sent. Unknown keys are dropped and blanks are ignored (never erase data). */
export function cleanRecord(input: any): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(input && typeof input === 'object' ? input : {})) {
    const f = FIELD.get(key);
    if (!f || raw == null) continue;
    if (typeof raw !== 'string') throw new AppError(`${f.label}: please enter text`, 400, 'INVALID_FIELDS');
    const v = raw.trim();
    if (!v) continue;
    if (v.length > MAX_LEN[f.type]) throw new AppError(`${f.label} is too long`, 400, 'INVALID_FIELDS');
    if (f.type === 'date') {
      const d = new Date(v);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v || d > new Date() || d.getFullYear() < 1985) {
        throw new AppError('Please enter a valid date of birth', 400, 'INVALID_DOB');
      }
    }
    if (f.type === 'gender' && !['male', 'female'].includes(v.toLowerCase())) throw new AppError('Please choose male or female', 400, 'INVALID_GENDER');
    if (f.type === 'phone' && !/^\+?[\d\s()-]{6,20}$/.test(v)) throw new AppError(`${f.label}: please enter a valid phone number`, 400, 'INVALID_PHONE');
    if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new AppError('Please enter a valid email address', 400, 'INVALID_EMAIL');
    out[key] = f.type === 'gender' ? v.toLowerCase() : v;
  }
  return out;
}

const ROW_SQL = `
  SELECT s.*, g.id AS g_id, g.first_name AS g_first, g.last_name AS g_last, g.relationship AS g_rel, g.email AS g_email,
         g.phone_number AS g_phone, g.occupation AS g_occ,
         cl.class_id, cl.class_name
  FROM students s
  LEFT JOIN LATERAL (SELECT * FROM guardians WHERE student_id = s.id ORDER BY is_primary_guardian DESC NULLS LAST, created_at ASC LIMIT 1) g ON true
  LEFT JOIN LATERAL (SELECT c.id AS class_id, c.name AS class_name FROM enrollments e JOIN classes c ON c.id = e.class_id
                     WHERE e.student_id = s.id AND e.status IN ('enrolled','active') ORDER BY e.enrollment_date DESC NULLS LAST LIMIT 1) cl ON true
  WHERE s.tenant_id = ?`;

/** The field values the school holds for one student row (from ROW_SQL). */
function valuesOf(r: any): Record<string, string> {
  const gName = r.guardian_name || [r.g_first, r.g_last].filter(Boolean).join(' ');
  return {
    date_of_birth: isoDate(r.date_of_birth), gender: r.gender || '', nationality: r.nationality || '', religion: r.religion || '',
    place_of_birth: r.place_of_birth || '', address: r.address || '', previous_school: r.previous_school || '',
    medical_conditions: r.medical_conditions || '', guardian_name: gName || '', guardian_relationship: r.guardian_relationship || r.g_rel || '',
    guardian_phone: r.guardian_phone || r.g_phone || '', guardian_email: r.g_email || '', guardian_occupation: r.guardian_occupation || r.g_occ || '',
    emergency_contact_name: r.emergency_contact_name || '', emergency_contact_relationship: r.emergency_contact_relationship || '',
    emergency_contact: r.emergency_contact || '',
  };
}
const missingOf = (values: Record<string, string>) => REQUIRED.filter((f) => !String(values[f.key] || '').trim()).map((f) => f.key);
const hasPhoto = (r: any) => !!String(r.photo_url || '').trim();
const fullName = (r: any) => [r.first_name, r.last_name].filter(Boolean).join(' ');

async function loadStudent(tenantId: string, studentId: string) {
  const { rows } = await db.raw(`${ROW_SQL} AND s.id = ?`, [tenantId, studentId]);
  if (!rows[0]) throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');
  return rows[0];
}

/** Write cleaned values to the student, and to the primary guardian when the guardian fields changed. */
async function applyToStudent(tenantId: string, studentId: string, clean: Record<string, string>, userId: string | null): Promise<void> {
  const student = await loadStudent(tenantId, studentId);
  let needsGuardianLink = false;
  await db.transaction(async (trx) => {
    const upd: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(clean)) if (STUDENT_COLUMNS.has(k)) upd[k] = v;
    if (Object.keys(upd).length) await trx('students').where({ id: studentId, tenant_id: tenantId }).update({ ...upd, updated_at: new Date() });
    if (GUARDIAN_KEYS.some((k) => k in clean)) {
      if (student.g_id) {
        const g: Record<string, unknown> = {};
        if (clean.guardian_name) {
          const parts = clean.guardian_name.split(/\s+/);
          g.first_name = parts[0];
          g.last_name = parts.slice(1).join(' ') || student.last_name || '-';
        }
        if (clean.guardian_relationship) g.relationship = clean.guardian_relationship;
        if (clean.guardian_phone) g.phone_number = clean.guardian_phone;
        if (clean.guardian_email) g.email = clean.guardian_email.toLowerCase();
        if (clean.guardian_occupation) g.occupation = clean.guardian_occupation;
        if (Object.keys(g).length) await trx('guardians').where({ id: student.g_id, student_id: studentId }).update({ ...g, updated_at: new Date() });
      } else {
        needsGuardianLink = true;
      }
    }
  });
  if (needsGuardianLink) {
    const v = { ...valuesOf(student), ...clean };
    await linkGuardianForStudent(db, tenantId, studentId, student.last_name || '', {
      guardian_name: v.guardian_name, guardian_email: v.guardian_email, guardian_phone: v.guardian_phone,
      guardian_relationship: v.guardian_relationship, guardian_occupation: v.guardian_occupation,
    }, userId);
  }
}

const changesOf = (current: Record<string, string>, proposed: Record<string, string>) =>
  Object.entries(proposed).filter(([k, v]) => (current[k] || '') !== v)
    .map(([key, value]) => ({ key, label: FIELD.get(key)?.label || key, current: current[key] || '', proposed: value }));

/** Words of a person's name, lower-case, letters only. */
const nameTokens = (n: string) => String(n || '').toLowerCase().replace(/[^a-z\s'-]/g, ' ').split(/[\s]+/).map((t) => t.replace(/[^a-z]/g, '')).filter((t) => t.length >= 2);
const phoneDigits = (s: string) => String(s || '').replace(/\D/g, '');
/** The phone (last 7 digits, so +232 / 0 prefixes do not matter) or email a parent typed is one the school holds for the family. */
function contactMatches(r: any, typed: string, asEmail: boolean): boolean {
  if (asEmail) {
    const t = typed.trim().toLowerCase();
    return [r.g_email, r.guardian_email].some((e) => String(e || '').trim().toLowerCase() === t);
  }
  const t = phoneDigits(typed).slice(-7);
  return [r.guardian_phone, r.g_phone, r.emergency_contact].some((p) => {
    const d = phoneDigits(String(p || ''));
    return d.length >= 7 && d.slice(-7) === t;
  });
}

// ── The "I checked my child" pass: signed, short-lived, bound to one school and one student ─────────────────
// Prefixed with its purpose so it can never be mistaken for (or used as) a login token.
const VERIFY_TTL_MS = 30 * 60 * 1000;
function signingKey(): string {
  const k = process.env.JWT_SECRET;
  if (!k) throw new AppError('Checking a record is not available right now. Please contact the school.', 503, 'NOT_CONFIGURED');
  return `student-record-verify:${k}`;
}
const signBody = (body: string) => crypto.createHmac('sha256', signingKey()).update(body).digest('base64url');
function issueVerifyToken(tenantId: string, studentId: string, linkId: string): string {
  const body = Buffer.from(JSON.stringify({ t: tenantId, s: studentId, l: linkId, e: Date.now() + VERIFY_TTL_MS })).toString('base64url');
  return `${body}.${signBody(body)}`;
}
function readVerifyToken(token: unknown): { t: string; s: string; l: string } | null {
  const [body, sig, extra] = String(token || '').split('.');
  if (!body || !sig || extra !== undefined) return null;
  const expected = Buffer.from(signBody(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!p || typeof p.t !== 'string' || typeof p.s !== 'string' || typeof p.e !== 'number' || p.e < Date.now()) return null;
    return { t: p.t, s: p.s, l: String(p.l || '') };
  } catch { return null; }
}

/** Students whose name fits what a parent typed (every word the parent wrote appears in the school's name). */
function nameFits(r: any, claimed: string[]): boolean {
  const have = new Set(nameTokens(`${r.first_name} ${r.last_name}`));
  return claimed.length >= 2 && claimed.every((t) => have.has(t));
}

export const studentRecordService = {
  fields: RECORD_FIELDS,

  /** Every student with what is still missing, whether a link is out, and whether an update is waiting. */
  async completeness(tenantId: string, q: { class_id?: string; search?: string; filter?: string; page?: number; limit?: number }) {
    const params: any[] = [tenantId];
    let sql = `${ROW_SQL} AND COALESCE(s.status, 'active') = 'active'`;
    if (q.class_id) { sql += ' AND cl.class_id = ?'; params.push(q.class_id); }
    const term = String(q.search || '').trim();
    if (term) {
      sql += " AND (LOWER(COALESCE(s.first_name,'') || ' ' || COALESCE(s.last_name,'')) LIKE ? OR LOWER(s.student_id) LIKE ?)";
      params.push(`%${term.toLowerCase()}%`, `%${term.toLowerCase()}%`);
    }
    sql += ' ORDER BY cl.class_name NULLS LAST, s.last_name, s.first_name LIMIT 5000';
    const { rows } = await db.raw(sql, params);
    const ids = rows.map((r: any) => r.id);
    const links = ids.length ? await db('student_update_links').where({ tenant_id: tenantId }).whereIn('student_id', ids)
      .whereNull('revoked_at').where('expires_at', '>', new Date()).select('student_id', 'expires_at', 'last_opened_at') : [];
    const pending = ids.length ? await db('student_record_updates').where({ tenant_id: tenantId, status: 'pending' }).whereIn('student_id', ids).select('id', 'student_id') : [];
    const linkBy = new Map<string, any>(links.map((l: any) => [l.student_id, l]));
    const pendBy = new Map<string, any>(pending.map((p: any) => [p.student_id, p]));
    const all = rows.map((r: any) => {
      const miss = missingOf(valuesOf(r));
      const link = linkBy.get(r.id);
      return {
        id: r.id, student_id: r.student_id, name: fullName(r), class_id: r.class_id || null, class_name: r.class_name || null,
        guardian_name: valuesOf(r).guardian_name, guardian_phone: valuesOf(r).guardian_phone, guardian_email: valuesOf(r).guardian_email,
        missing: miss, percent: Math.round(((REQUIRED.length - miss.length) / REQUIRED.length) * 100),
        has_photo: hasPhoto(r), has_link: !!link, link_opened: !!link?.last_opened_at, link_expires_at: link?.expires_at || null,
        pending_update_id: pendBy.get(r.id)?.id || null,
      };
    });
    const summary = {
      students: all.length,
      complete: all.filter((s: any) => s.missing.length === 0).length,
      incomplete: all.filter((s: any) => s.missing.length > 0).length,
      no_photo: all.filter((s: any) => !s.has_photo).length,
      pending_updates: all.filter((s: any) => s.pending_update_id).length,
      average_percent: all.length ? Math.round(all.reduce((a: number, s: any) => a + s.percent, 0) / all.length) : 0,
    };
    const f = q.filter || 'all';
    const shown = all.filter((s: any) => f === 'incomplete' ? s.missing.length > 0 : f === 'complete' ? s.missing.length === 0
      : f === 'no_photo' ? !s.has_photo : f === 'pending' ? !!s.pending_update_id : f === 'no_link' ? (!s.has_link && s.missing.length > 0) : true);
    const limit = Math.min(200, Math.max(1, Number(q.limit) || 50));
    const page = Math.max(1, Number(q.page) || 1);
    return { summary, total: shown.length, page, limit, items: shown.slice((page - 1) * limit, page * limit) };
  },

  /** One student's current values (for the session form). */
  async detail(tenantId: string, studentId: string) {
    const r = await loadStudent(tenantId, studentId);
    return { id: r.id, student_id: r.student_id, name: fullName(r), class_name: r.class_name || null, photo_url: r.photo_url || null, values: valuesOf(r), missing: missingOf(valuesOf(r)) };
  },

  /** New personal links. Older links for the same students stop working. The secrets are returned once, here. */
  async createLinks(tenantId: string, userId: string, body: { student_ids?: string[]; class_id?: string; only_incomplete?: boolean; days?: number }) {
    let ids: string[] = Array.isArray(body.student_ids) ? body.student_ids.map(String) : [];
    if (!ids.length && body.class_id) {
      const { rows } = await db.raw(`${ROW_SQL} AND cl.class_id = ? AND COALESCE(s.status,'active') = 'active'`, [tenantId, body.class_id]);
      ids = rows.filter((r: any) => !body.only_incomplete || missingOf(valuesOf(r)).length > 0).map((r: any) => r.id);
    }
    if (!ids.length) throw new AppError('Choose a class or at least one student', 400, 'NO_STUDENTS');
    if (ids.length > 1000) throw new AppError('Create links for up to 1000 students at a time', 400, 'TOO_MANY');
    const days = Math.min(90, Math.max(1, Number(body.days) || 14));
    const expires = new Date(Date.now() + days * 24 * 3600 * 1000);
    const { publicAppUrl } = await import('../utils/publicUrl.js');
    const base = publicAppUrl().replace(/\/+$/, '');
    const { rows } = await db.raw(`${ROW_SQL} AND s.id = ANY(?::uuid[])`, [tenantId, ids]);
    const out: any[] = [];
    await db.transaction(async (trx) => {
      await trx('student_update_links').where({ tenant_id: tenantId }).whereIn('student_id', rows.map((r: any) => r.id)).whereNull('revoked_at').update({ revoked_at: new Date() });
      for (const r of rows) {
        const token = crypto.randomBytes(32).toString('base64url');
        await trx('student_update_links').insert({ tenant_id: tenantId, student_id: r.id, token_hash: sha(token), expires_at: expires, created_by: userId });
        const v = valuesOf(r);
        out.push({
          student_id: r.id, admission_no: r.student_id, name: fullName(r), class_name: r.class_name || '',
          guardian_name: v.guardian_name, guardian_phone: v.guardian_phone, guardian_email: v.guardian_email,
          url: `${base}/update-record/${token}`, expires_at: expires.toISOString(),
        });
      }
    });
    return { days, count: out.length, links: out };
  },

  async listUpdates(tenantId: string, status = 'pending') {
    const recs = await db('student_record_updates').where({ tenant_id: tenantId, status }).orderBy('created_at', 'desc').limit(200);
    if (!recs.length) return [];
    const ids = recs.map((r: any) => r.student_id).filter(Boolean);
    const rows = ids.length ? (await db.raw(`${ROW_SQL} AND s.id = ANY(?::uuid[])`, [tenantId, ids])).rows : [];
    const by = new Map<string, any>(rows.map((r: any) => [r.id, r]));
    let suggestionBudget = 20;
    const out: any[] = [];
    for (const rec of recs) {
      const s = by.get(rec.student_id);
      const payload = typeof rec.payload === 'string' ? JSON.parse(rec.payload) : rec.payload || {};
      let candidates: any[] = [];
      if (!rec.student_id && suggestionBudget-- > 0) {
        // Not matched by name: offer students who share a word with what the parent wrote.
        const tokens = nameTokens(rec.claimed_name || '');
        if (tokens.length) {
          const { rows: cand } = await db.raw(`${ROW_SQL} AND COALESCE(s.status,'active') = 'active' AND (LOWER(s.first_name) = ANY(?) OR LOWER(s.last_name) = ANY(?)) LIMIT 8`, [tenantId, tokens, tokens]);
          candidates = cand.map((c: any) => ({ id: c.id, student_id: c.student_id, name: fullName(c), class_name: c.class_name || null }));
        }
      }
      out.push({
        id: rec.id, reference: referenceOf(rec.id), status: rec.status, created_at: rec.created_at, review_note: rec.review_note, source: rec.source || 'personal',
        claimed: rec.claimed_name ? { name: rec.claimed_name, class_name: rec.claimed_class_name || null } : null,
        student: rec.student_id ? { id: rec.student_id, student_id: s?.student_id, name: s ? fullName(s) : '', class_name: s?.class_name || null } : null,
        candidates,
        changes: changesOf(s ? valuesOf(s) : {}, payload),
      });
    }
    return out;
  },

  /** Attach an unmatched submission (from the shared link) to the student the officer chose. */
  async matchUpdate(tenantId: string, updateId: string, studentId: string) {
    await loadStudent(tenantId, studentId);
    const n = await db('student_record_updates').where({ id: updateId, tenant_id: tenantId, status: 'pending' }).update({ student_id: studentId });
    if (!n) throw new AppError('Update not found or already handled', 404, 'NOT_FOUND');
    return { ok: true };
  },

  /** The message parents read first: the school's own wording if it set one, else the default. */
  async getWelcome(tenantId: string) {
    const row = await db('school_config_settings').where({ tenant_id: tenantId, setting_key: WELCOME_KEY }).first('setting_value');
    const custom = String(row?.setting_value || '').trim();
    return { message: custom || DEFAULT_WELCOME, is_custom: !!custom, default_message: DEFAULT_WELCOME };
  },
  /** Save the school's own wording; an empty text goes back to the default. */
  async setWelcome(tenantId: string, userId: string, text: unknown) {
    const message = String(text ?? '').trim();
    if (message.length > 3000) throw new AppError('The message is too long (3000 characters at most)', 400, 'TOO_LONG');
    if (!message || message === DEFAULT_WELCOME) {
      await db('school_config_settings').where({ tenant_id: tenantId, setting_key: WELCOME_KEY }).del();
      return this.getWelcome(tenantId);
    }
    const school = await db('schools').where({ tenant_id: tenantId }).first('school_id');
    if (!school) throw new AppError('School not found', 404, 'SCHOOL_NOT_FOUND');
    const existing = await db('school_config_settings').where({ tenant_id: tenantId, setting_key: WELCOME_KEY }).first('id');
    if (existing) {
      await db('school_config_settings').where({ id: existing.id }).update({ setting_value: message, updated_by: userId, updated_at: new Date() });
    } else {
      await db('school_config_settings').insert({
        school_id: school.school_id, tenant_id: tenantId, setting_key: WELCOME_KEY, setting_value: message, data_type: 'string', is_public: false,
        created_by: userId, created_at: new Date(), updated_at: new Date(),
      });
    }
    return this.getWelcome(tenantId);
  },

  // ── The school's shared link (posted once in the parents' WhatsApp group) ─────────────────────────────
  async sharedLink(tenantId: string) {
    const l = await db('student_record_shared_links').where({ tenant_id: tenantId }).whereNull('closed_at')
      .where((q) => q.whereNull('expires_at').orWhere('expires_at', '>', new Date())).orderBy('created_at', 'desc').first();
    if (!l) return null;
    const { publicAppUrl } = await import('../utils/publicUrl.js');
    return { url: `${publicAppUrl().replace(/\/+$/, '')}/update-record/school/${l.token}`, expires_at: l.expires_at, created_at: l.created_at };
  },
  async createSharedLink(tenantId: string, userId: string, days?: number) {
    const d = Number(days);
    const expires = d > 0 ? new Date(Date.now() + Math.min(180, d) * 24 * 3600 * 1000) : null;
    await db.transaction(async (trx) => {
      await trx('student_record_shared_links').where({ tenant_id: tenantId }).whereNull('closed_at').update({ closed_at: new Date() });
      await trx('student_record_shared_links').insert({ tenant_id: tenantId, token: crypto.randomBytes(24).toString('base64url'), expires_at: expires, created_by: userId });
    });
    return this.sharedLink(tenantId);
  },
  async closeSharedLink(tenantId: string) {
    await db('student_record_shared_links').where({ tenant_id: tenantId }).whereNull('closed_at').update({ closed_at: new Date() });
    return { ok: true };
  },

  async approve(tenantId: string, user: { id: string }, updateId: string, overrides?: any) {
    const rec = await db('student_record_updates').where({ id: updateId, tenant_id: tenantId }).first();
    if (!rec) throw new AppError('Update not found', 404, 'NOT_FOUND');
    if (rec.status !== 'pending') throw new AppError('This update has already been handled', 409, 'ALREADY_HANDLED');
    if (!rec.student_id) throw new AppError('Choose which student this is first', 400, 'NO_STUDENT');
    const payload = typeof rec.payload === 'string' ? JSON.parse(rec.payload) : rec.payload || {};
    const clean = { ...payload, ...cleanRecord(overrides) };
    await applyToStudent(tenantId, rec.student_id, clean, user.id);
    await db('student_record_updates').where({ id: updateId }).update({ status: 'approved', payload: JSON.stringify(clean), reviewed_by: user.id, reviewed_at: new Date() });
    return { ok: true };
  },

  async reject(tenantId: string, user: { id: string }, updateId: string, note?: string) {
    const n = await db('student_record_updates').where({ id: updateId, tenant_id: tenantId, status: 'pending' })
      .update({ status: 'rejected', review_note: String(note || '').slice(0, 500) || null, reviewed_by: user.id, reviewed_at: new Date() });
    if (!n) throw new AppError('Update not found or already handled', 404, 'NOT_FOUND');
    return { ok: true };
  },

  /** Parents' session: the officer enters the values with the parent present. Saved at once and logged. */
  async saveDirect(tenantId: string, user: { id: string }, studentId: string, input: any) {
    const clean = cleanRecord(input);
    if (!Object.keys(clean).length) throw new AppError('Nothing to save', 400, 'EMPTY');
    await applyToStudent(tenantId, studentId, clean, user.id);
    await db('student_record_updates').insert({
      tenant_id: tenantId, student_id: studentId, status: 'approved', payload: JSON.stringify(clean),
      review_note: 'Entered at the school', reviewed_by: user.id, reviewed_at: new Date(),
    });
    return this.detail(tenantId, studentId);
  },

  // ── Public: the shared link ──────────────────────────────────────────────────────────────────────────
  async sharedFor(token: string) {
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(String(token || ''))) throw new AppError('This link is not valid', 404, 'LINK_INVALID');
    const link = await db('student_record_shared_links').where({ token }).first();
    if (!link) throw new AppError('This link is not valid', 404, 'LINK_INVALID');
    if (link.closed_at || (link.expires_at && new Date(link.expires_at) < new Date())) {
      throw new AppError('This link is no longer open. Please ask the school for the new link.', 410, 'LINK_EXPIRED');
    }
    return link;
  },

  /** The shared form is blank: it shows nothing the school holds, so a forwarded link reveals no one's details. */
  async openShared(token: string) {
    const link = await this.sharedFor(token);
    const intro = await publicIntro(link.tenant_id);
    const { rows } = await db.raw(`SELECT DISTINCT c.id, c.name FROM students s JOIN enrollments e ON e.student_id = s.id AND e.status IN ('enrolled','active')
      JOIN classes c ON c.id = e.class_id WHERE s.tenant_id = ? AND COALESCE(s.status,'active') = 'active' ORDER BY c.name`, [link.tenant_id]);
    return { ...intro, classes: rows, fields: RECORD_FIELDS, expires_at: link.expires_at };
  },

  async submitShared(token: string, input: { child_first_name?: unknown; child_last_name?: unknown; class_id?: unknown; values?: unknown }) {
    const link = await this.sharedFor(token);
    const first = String(input.child_first_name || '').trim();
    const last = String(input.child_last_name || '').trim();
    if (first.length < 2 || last.length < 2 || first.length > 100 || last.length > 100) throw new AppError("Please write the child's first and last name", 400, 'INVALID_NAME');
    const clean = cleanRecord(input.values);
    if (!Object.keys(clean).length) throw new AppError('Please fill in the form before submitting', 400, 'EMPTY');
    const lacking = REQUIRED.filter((f) => !clean[f.key]);
    if (lacking.length) throw new AppError(missingMessage(lacking.map((f) => f.key)), 400, 'MISSING_FIELDS');
    const tenantId = link.tenant_id;
    const classId = typeof input.class_id === 'string' && /^[0-9a-f-]{36}$/i.test(input.class_id) ? input.class_id : null;
    const claimed = nameTokens(`${first} ${last}`);

    // Match by name (and class, and date of birth if several fit). Exactly one fit = matched; otherwise the officer decides.
    let cls: { name: string } | undefined;
    if (classId) cls = (await db.raw('SELECT c.name FROM classes c WHERE c.id = ?', [classId])).rows[0];
    const pool = async (withClass: boolean) => (await db.raw(`${ROW_SQL} AND COALESCE(s.status,'active') = 'active'${withClass ? ' AND cl.class_id = ?' : ''} LIMIT 5000`,
      withClass ? [tenantId, classId] : [tenantId])).rows.filter((r: any) => nameFits(r, claimed));
    let fits = classId ? await pool(true) : [];
    if (!fits.length) fits = await pool(false);
    if (fits.length > 1 && clean.date_of_birth) fits = fits.filter((r: any) => isoDate(r.date_of_birth) === clean.date_of_birth);
    const matched = fits.length === 1 ? fits[0] : null;

    let changedCount = Object.keys(clean).length;
    let payload: Record<string, string> = clean;
    let status = 'pending';
    if (matched) {
      const current = valuesOf(matched);
      payload = Object.fromEntries(Object.entries(clean).filter(([k, v]) => (current[k] || '') !== v));
      changedCount = Object.keys(payload).length;
      if (!changedCount) status = 'approved'; // the parent only confirmed what the school already has
    }
    let recordId: unknown = null;
    await db.transaction(async (trx) => {
      if (matched && status === 'pending') {
        await trx('student_record_updates').where({ tenant_id: tenantId, student_id: matched.id, status: 'pending' }).update({ status: 'superseded' });
      }
      const [inserted] = await trx('student_record_updates').insert({
        tenant_id: tenantId, student_id: matched?.id || null, status, source: 'shared', payload: JSON.stringify(payload),
        claimed_name: `${first} ${last}`, claimed_class_id: classId, claimed_class_name: cls?.name || null,
        ...(status === 'approved' ? { review_note: 'Parent confirmed the record is correct', reviewed_at: new Date() } : {}),
      }).returning('id');
      recordId = (inserted as any)?.id ?? inserted;
    });
    if (status === 'pending') {
      try {
        const { notifyAdmissionsStaff } = await import('./admissions/admissionPipelineService.js');
        await notifyAdmissionsStaff(tenantId, {
          subject: 'Record update to review',
          message: `A parent sent details for ${first} ${last}${cls?.name ? ` (${cls.name})` : ''}${matched ? '' : '. It needs to be matched to a student'}.`,
          url: '/students/records', sourceId: matched?.id || link.id,
        });
      } catch (e) { logger.warn(`Record-update notice failed: ${(e as any)?.message || e}`); }
    }
    // The reply never says whether a child was found, so the form cannot be used to check who is enrolled.
    return { received: true, reference: referenceOf(recordId) };
  },

  // ── Public: a personal link ──────────────────────────────────────────────────────────────────────────
  async linkFor(token: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(String(token || ''))) throw new AppError('This link is not valid', 404, 'LINK_INVALID');
    const link = await db('student_update_links').where({ token_hash: sha(token) }).first();
    if (!link) throw new AppError('This link is not valid', 404, 'LINK_INVALID');
    if (link.revoked_at || new Date(link.expires_at) < new Date()) {
      throw new AppError('This link has expired. Please ask the school for a new one.', 410, 'LINK_EXPIRED');
    }
    return link;
  },

  async openLink(token: string) {
    const link = await this.linkFor(token);
    const r = await loadStudent(link.tenant_id, link.student_id);
    await db('student_update_links').where({ id: link.id }).update({ last_opened_at: new Date() }).catch(() => null);
    const intro = await publicIntro(link.tenant_id);
    return {
      ...intro,
      student: { first_name: r.first_name, last_name: r.last_name, class_name: r.class_name || null },
      fields: RECORD_FIELDS, values: valuesOf(r), photo_note: hasPhoto(r) ? null : 'The school will take your child\'s photo at school.',
      expires_at: link.expires_at,
    };
  },

  async submitLink(token: string, input: any) {
    const link = await this.linkFor(token);
    return submitForStudent(link.tenant_id, link.student_id, link.id, 'personal', input, 'Parent confirmed the record is correct');
  },

  // ── Public: "Is my child registered?" on the shared link ─────────────────────────────────────────────
  /**
   * A parent proves they know the child's record: the child's name, date of birth AND a phone number or email the
   * school holds for the family. Only then is the record shown (to review and correct) and a short-lived, signed
   * pass is issued. A wrong or partial answer gets the same reply whatever the reason, so the check cannot be used
   * to find out who is enrolled. The route is also tightly rate limited.
   */
  async verifyShared(token: string, input: { child_first_name?: unknown; child_last_name?: unknown; date_of_birth?: unknown; contact?: unknown }) {
    const link = await this.sharedFor(token);
    const first = String(input.child_first_name || '').trim();
    const last = String(input.child_last_name || '').trim();
    const dob = String(input.date_of_birth || '').trim();
    const contact = String(input.contact || '').trim();
    if (first.length < 2 || last.length < 2 || first.length > 100 || last.length > 100) throw new AppError("Please write the child's first and last name", 400, 'INVALID_NAME');
    cleanRecord({ date_of_birth: dob }); // the same date rules as the form (also rejects a missing date)
    if (!dob) throw new AppError("Please enter the child's date of birth", 400, 'INVALID_DOB');
    const asEmail = contact.includes('@');
    if (asEmail ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) : phoneDigits(contact).length < 7) {
      throw new AppError('Enter the phone number or email address you gave the school', 400, 'INVALID_CONTACT');
    }
    const claimed = nameTokens(`${first} ${last}`);
    const { rows } = await db.raw(`${ROW_SQL} AND COALESCE(s.status,'active') = 'active' AND s.date_of_birth::date = ?::date LIMIT 60`, [link.tenant_id, dob]);
    const fits = rows.filter((r: any) => nameFits(r, claimed) && contactMatches(r, contact, asEmail));
    const notFound = { verified: false as const };
    if (fits.length !== 1) return notFound;
    const r = fits[0];
    const values = valuesOf(r);
    const intro = await publicIntro(link.tenant_id);
    return {
      verified: true as const,
      session: issueVerifyToken(link.tenant_id, r.id, link.id),
      student: { first_name: r.first_name, last_name: r.last_name, class_name: r.class_name || null, student_number: r.student_id || null },
      fields: RECORD_FIELDS, values, missing: missingOf(values),
      photo_note: hasPhoto(r) ? null : "The school will take your child's photo at school.",
      school: intro.school, contact: intro.contact,
    };
  },

  /** The verified parent confirms or corrects the record. Changes still wait for the school to approve them. */
  async submitVerified(token: string, session: string, values: unknown) {
    const link = await this.sharedFor(token);
    const pass = readVerifyToken(session);
    if (!pass || pass.t !== link.tenant_id) throw new AppError('Your check has expired. Please check your child again.', 401, 'VERIFY_EXPIRED');
    return submitForStudent(link.tenant_id, pass.s, null, 'verified', values, 'Parent checked the record and confirmed it is correct');
  },
};

/** Save what a parent sent for ONE known student: changes wait for review; a pure confirmation is recorded as approved. */
async function submitForStudent(tenantId: string, studentId: string, linkId: string | null, source: string, input: any, confirmedNote: string) {
  const clean = cleanRecord(input);
  const current = valuesOf(await loadStudent(tenantId, studentId));
  const changed = Object.fromEntries(Object.entries(clean).filter(([k, v]) => (current[k] || '') !== v));
  const missingAfter = missingOf({ ...current, ...clean });
  if (!Object.keys(clean).length) throw new AppError('Please fill in the form before submitting', 400, 'EMPTY');
  if (missingAfter.length) throw new AppError(missingMessage(missingAfter), 400, 'MISSING_FIELDS');
  let recordId: unknown = null;
  await db.transaction(async (trx) => {
    await trx('student_record_updates').where({ tenant_id: tenantId, student_id: studentId, status: 'pending' }).update({ status: 'superseded' });
    const [inserted] = await trx('student_record_updates').insert(Object.keys(changed).length
      ? { tenant_id: tenantId, student_id: studentId, link_id: linkId, source, status: 'pending', payload: JSON.stringify(changed) }
      : { tenant_id: tenantId, student_id: studentId, link_id: linkId, source, status: 'approved', payload: '{}', review_note: confirmedNote, reviewed_at: new Date() }).returning('id');
    recordId = (inserted as any)?.id ?? inserted;
  });
  if (Object.keys(changed).length) {
    try {
      const s = await loadStudent(tenantId, studentId);
      const { notifyAdmissionsStaff } = await import('./admissions/admissionPipelineService.js');
      await notifyAdmissionsStaff(tenantId, {
        subject: 'Record update to review', message: `A parent sent updated details for ${fullName(s)}${s.class_name ? ` (${s.class_name})` : ''}.`,
        url: '/students/records', sourceId: studentId,
      });
    } catch (e) { logger.warn(`Record-update notice failed: ${(e as any)?.message || e}`); }
  }
  return { received: true, changed: Object.keys(changed).length, still_missing: missingAfter.length, reference: referenceOf(recordId) };
}
export default studentRecordService;
