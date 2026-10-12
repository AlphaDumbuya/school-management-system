/**
 * Admissions pipeline: the rules for moving an application from received to
 * enrolled, enforced on the server.
 *
 *   pending → under_review → interview_scheduled → approved → (enrol) enrolled
 *                        ↘ waitlist / rejected / withdrawn (reopen → under_review)
 *
 * - Every move is checked against TRANSITIONS and recorded on the timeline.
 * - Approving does NOT create a student. Enrolling does, once: in a
 *   transaction, under a per-application lock, into a CURRENT-year class, and
 *   the student is linked back to the application (unique), so a retry or a
 *   double click returns the same student.
 * - Each decision email (approved / waitlist / rejected) is sent once.
 */
import type { Knex } from 'knex';
import { db } from '@utils/database';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import { generateNextId } from '@utils/idGenerator';
import { linkGuardianForStudent } from '@utils/guardianLinking';
import { normalizeAcademicYear, resolveActiveYear } from '@utils/academicYear';
import { tenantTimezone } from '@utils/schoolDate';

export const STATUSES = ['pending', 'under_review', 'interview_scheduled', 'approved', 'waitlist', 'rejected', 'withdrawn', 'enrolled'] as const;
export type AdmStatus = typeof STATUSES[number];

/** Allowed moves. Enrolled is reached only through enrol(). */
export const TRANSITIONS: Record<AdmStatus, AdmStatus[]> = {
  pending: ['under_review', 'interview_scheduled', 'approved', 'waitlist', 'rejected', 'withdrawn'],
  under_review: ['interview_scheduled', 'approved', 'waitlist', 'rejected', 'withdrawn'],
  interview_scheduled: ['interview_scheduled', 'under_review', 'approved', 'waitlist', 'rejected', 'withdrawn'],
  approved: ['under_review', 'withdrawn'],
  waitlist: ['under_review', 'interview_scheduled', 'approved', 'rejected', 'withdrawn'],
  rejected: ['under_review'],
  withdrawn: ['under_review'],
  enrolled: [],
};

export const LABELS: Record<AdmStatus, string> = {
  pending: 'New', under_review: 'Under review', interview_scheduled: 'Interview scheduled', approved: 'Approved',
  waitlist: 'Waitlist', rejected: 'Rejected', withdrawn: 'Withdrawn', enrolled: 'Enrolled',
};

/** Standard documents a school asks for (checklist on each application). */
export const DOCUMENTS = [
  { key: 'birth_certificate', label: 'Birth certificate' },
  { key: 'previous_report', label: 'Last report card' },
  { key: 'transfer_letter', label: 'Transfer / leaving letter' },
  { key: 'passport_photo', label: 'Passport photo' },
  { key: 'medical_record', label: 'Medical / immunisation record' },
  { key: 'guardian_id', label: "Parent's ID" },
] as const;

/** Fields staff may edit before enrolment (same set the form collects). */
const EDITABLE = [
  'child_first_name', 'child_middle_name', 'child_last_name', 'child_dob', 'child_gender', 'child_nationality', 'child_religion',
  'child_place_of_birth', 'class_applying_for', 'child_address', 'previous_school', 'last_grade_attained', 'child_photo_url',
  'guardian_first_name', 'guardian_middle_name', 'guardian_last_name', 'guardian_relationship', 'guardian_phone', 'guardian_alt_phone',
  'guardian_email', 'guardian_occupation', 'guardian_address', 'guardian_nationality', 'guardian_national_id',
  'takes_medication', 'medication_details', 'has_allergies', 'allergy_details', 'has_chronic_illness', 'chronic_illness_details',
  'allow_first_aid', 'emergency_contact_name', 'emergency_contact_relationship', 'emergency_contact_phone',
] as const;
const BOOLS = new Set(['takes_medication', 'has_allergies', 'has_chronic_illness', 'allow_first_aid']);

/** ~2 MB image once base64-encoded (the form caps uploads at 2 MB). */
const MAX_PHOTO_CHARS = 3_000_000;

/**
 * Normalise one form field. Text is trimmed to 500 characters, but the photo
 * is a whole image (a data: URL or a link) and must never be cut, or it is
 * saved broken and the profile shows no picture.
 */
function cleanField(k: string, v: any): any {
  if (BOOLS.has(k)) return v === true;
  if (v === '' || v === null) return null;
  if (k === 'child_photo_url') {
    const s = String(v).trim();
    if (!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(s) && !/^https:\/\//i.test(s)) {
      throw new AppError('The photo must be a PNG, JPG or WEBP image.', 400, 'VALIDATION_ERROR');
    }
    if (s.length > MAX_PHOTO_CHARS) throw new AppError('The photo is too large. Use an image under 2 MB.', 400, 'VALIDATION_ERROR');
    return s;
  }
  return typeof v === 'string' ? v.trim().slice(0, 500) : v;
}

const name = (a: any) => [a.child_first_name || a.first_name, a.child_last_name || a.last_name].filter(Boolean).join(' ').trim();
const guardianName = (a: any) => [a.guardian_first_name, a.guardian_last_name].filter(Boolean).join(' ').trim() || a.parent_name || 'Parent/Guardian';
const today = () => new Date().toISOString().slice(0, 10);

async function event(q: Knex | Knex.Transaction, tenantId: string, applicationId: string, e: { kind: string; from?: string | null; to?: string | null; note?: string | null; by?: string | null }) {
  await q('admission_application_events').insert({
    tenant_id: tenantId, application_id: applicationId, kind: e.kind, from_status: e.from ?? null, to_status: e.to ?? null,
    note: e.note ? String(e.note).slice(0, 2000) : null, created_by: e.by ?? null,
  });
}

async function getApp(q: Knex | Knex.Transaction, tenantId: string, id: string, lock = false) {
  const query = q('admission_applications').where({ id, tenant_id: tenantId });
  if (lock) query.forUpdate();
  const a = await query.first();
  if (!a) throw new AppError('Application not found', 404, 'NOT_FOUND');
  return a;
}

/** Classes applicants can join: the active year's active classes (plus legacy no-session classes). */
export async function currentYearClasses(tenantId: string) {
  const { sessionId } = await resolveActiveYear(tenantId);
  const rows = await db('classes as c')
    .leftJoin('users as cu', 'cu.id', 'c.created_by')
    .where((w) => {
      if (sessionId) w.where('c.academic_session_id', sessionId);
      w.orWhere((w2) => w2.whereNull('c.academic_session_id').where('cu.tenant_id', tenantId));
    })
    .where((w) => w.whereNull('c.status').orWhere('c.status', 'active'))
    .select('c.id', 'c.name', 'c.level', 'c.section', 'c.capacity', 'c.academic_session_id',
      db.raw("(SELECT COUNT(*) FROM enrollments e WHERE e.class_id = c.id AND e.status IN ('enrolled','active'))::int as enrolled"))
    .orderBy('c.name');
  const { yearString } = await resolveActiveYear(tenantId);
  const billed = rows.length ? await db('fees').where({ tenant_id: tenantId, academic_year: yearString, source: 'structure' }).whereNot('status', 'deleted')
    .whereIn('class_id', rows.map((r: any) => r.id)).where('type', 'Tuition').distinct('class_id', 'term') : [];
  const termsOf = (id: string) => ['First Term', 'Second Term', 'Third Term'].filter((t) => billed.some((b: any) => b.class_id === id && b.term === t));
  return rows.map((c: any) => ({ ...c, capacity: Number(c.capacity) || null, enrolled: Number(c.enrolled) || 0, full: !!c.capacity && Number(c.enrolled) >= Number(c.capacity), billed_terms: termsOf(c.id) }));
}

/**
 * Bill a newly enrolled student the terms already billed to their class this
 * year (same structure, same due dates as the class), then apply any approved
 * discounts. Same rules and lock as Fee Structures → Bill, so nothing doubles.
 */
async function billCatchUp(tenantId: string, studentId: string, classId: string, year: string, terms: string[]) {
  const out = { billed: [] as string[], amount: 0 };
  if (!terms.length) return out;
  const s = await db('fee_structures').where({ tenant_id: tenantId, class_id: classId, academic_year: year }).first();
  if (!s) return out;
  const { billOneTerm, TERM_LABELS } = await import('../../routes/feeStructureRoutes.js');
  await db.transaction(async (trx) => {
    await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`fee-bill:${s.id}`]);
    for (const n of [1, 2, 3] as const) {
      const label = TERM_LABELS[n];
      if (!terms.includes(label)) continue;
      // The class's due date for that term.
      const ref = await trx('fees').where({ tenant_id: tenantId, class_id: classId, academic_year: year, term: label, source: 'structure', type: 'Tuition' })
        .whereNot('status', 'deleted').orderBy('due_date').first('due_date');
      if (!ref) continue;
      const before = Number((await trx('fees').where({ tenant_id: tenantId, student_id: studentId }).whereNot('status', 'deleted').sum({ s: 'amount' }).first() as any)?.s) || 0;
      const ids = await billOneTerm(trx, tenantId, s, n, new Date(ref.due_date), [{ id: studentId }]);
      const after = Number((await trx('fees').where({ tenant_id: tenantId, student_id: studentId }).whereNot('status', 'deleted').sum({ s: 'amount' }).first() as any)?.s) || 0;
      if (ids.size) { out.billed.push(label); out.amount += after - before; }
    }
    const { discountService } = await import('../finance/discountService.js');
    await discountService.applyApprovedGrantsForStudent(trx, tenantId, studentId, year);
  });
  out.amount = Math.round(out.amount * 100) / 100;
  return out;
}

/** Same-name + same-birthday children already applying or at school. */
async function duplicatesOf(tenantId: string, a: any) {
  const first = String(a.child_first_name || a.first_name || '').trim().toLowerCase();
  const last = String(a.child_last_name || a.last_name || '').trim().toLowerCase();
  const dob = a.child_dob || a.date_of_birth;
  if (!first || !last) return { applications: [], students: [] };
  const apps = await db('admission_applications').where({ tenant_id: tenantId }).whereNot('id', a.id || '00000000-0000-0000-0000-000000000000')
    .whereRaw('LOWER(TRIM(COALESCE(child_first_name, first_name))) = ? AND LOWER(TRIM(COALESCE(child_last_name, last_name))) = ?', [first, last])
    .modify((q) => { if (dob) q.whereRaw('COALESCE(child_dob, date_of_birth)::date = ?::date', [dob]); })
    .select('id', 'application_number', 'status', 'academic_year').limit(10);
  const studs = await db('students').where({ tenant_id: tenantId })
    .whereRaw('LOWER(TRIM(first_name)) = ? AND LOWER(TRIM(last_name)) = ?', [first, last])
    .modify((q) => { if (dob) q.whereRaw('date_of_birth::date = ?::date', [dob]); })
    .whereNot('id', a.student_id || '00000000-0000-0000-0000-000000000000')
    .select('id', 'student_id', 'status').limit(10);
  return { applications: apps, students: studs };
}

/** In-app note to everyone who handles admissions (officers, duty teachers, principal). */
export async function notifyAdmissionsStaff(tenantId: string, n: { subject: string; message: string; url: string; sourceId?: string; exceptUserId?: string | null }) {
  try {
    const rows = await db('users').where({ tenant_id: tenantId, status: 'active' })
      .where((q) => q.whereIn('role', ['admissions_officer', 'principal'])
        .orWhere((q2) => q2.where('role', 'teacher').whereRaw("staff_duties::jsonb @> '[\"admissions_officer\"]'::jsonb")))
      .select('id');
    const { default: notificationService } = await import('@services/notificationService');
    for (const r of rows) {
      if (r.id === n.exceptUserId) continue;
      await notificationService.createNotification({
        recipientId: r.id, notificationType: 'enrollment', subject: n.subject, message: n.message,
        data: { url: n.url }, channels: ['in_app'], sourceType: 'admission_application', sourceId: n.sourceId,
      } as any).catch(() => null);
    }
  } catch (e) { logger.warn(`Admissions staff notice failed: ${(e as any)?.message || e}`); }
}

const esc = (t: string) => String(t).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' } as any)[c]);

/** A short branded admissions email (interview invitation, enrolment). Best-effort. */
async function emailApplicant(tenantId: string, to: string, toName: string, subject: string, lines: string[], cta?: { label: string; path: string }): Promise<boolean> {
  try {
    const { default: emailService } = await import('@services/emailService');
    const { resolveTenantBranding, appLink } = await import('@services/email/emailBranding');
    const { renderEmail, emailButton } = await import('@services/email/emailLayout');
    const branding: any = await resolveTenantBranding(tenantId);
    const contact = branding?.contactEmail
      ? `<p style="color:#6b7280;font-size:13px;">Questions? Reply to this email or contact the admissions office at <a href="mailto:${esc(branding.contactEmail)}">${esc(branding.contactEmail)}</a>${branding.contactPhone ? ` or ${esc(branding.contactPhone)}` : ''}.</p>`
      : '';
    const res: any = await (emailService as any).sendEmail({
      ...(emailService as any).senderFromBranding?.(branding),
      to, subject: `${subject} — ${branding?.name || 'School'}`,
      body: renderEmail({ branding, eyebrow: 'Admissions', heading: subject, preheader: lines[0]?.slice(0, 120),
        bodyHtml: `<p>Dear ${esc(toName)},</p>${lines.map((l) => `<p>${esc(l)}</p>`).join('')}${cta ? emailButton(cta.label, appLink(cta.path)) : ''}${contact}` } as any),
      isHtml: true,
    });
    return res?.success !== false;
  } catch { return false; }
}

export const admissionPipelineService = {
  STATUSES, TRANSITIONS, LABELS, DOCUMENTS,

  /** List with filters; counts follow the same filters. */
  async list(tenantId: string, f: { page?: number; limit?: number; status?: string; academic_year?: string; search?: string; class_id?: string; source?: string }) {
    const page = Math.max(1, Number(f.page) || 1);
    const limit = Math.min(Math.max(1, Number(f.limit) || 20), 100);
    const year = f.academic_year && f.academic_year !== 'all' ? normalizeAcademicYear(f.academic_year) : null;
    const base = () => {
      const q = db('admission_applications as a').where('a.tenant_id', tenantId);
      if (year) q.where('a.academic_year', year);
      if (f.class_id) q.where('a.class_applying_for', f.class_id);
      if (f.source === 'online') q.where('a.application_source', 'online');
      if (f.source === 'office') q.where((w) => w.whereNull('a.application_source').orWhereNot('a.application_source', 'online'));
      const term = String(f.search || '').trim();
      if (term) {
        const like = `%${term}%`;
        q.where((w) => w.whereRaw("CONCAT_WS(' ', a.child_first_name, a.child_middle_name, a.child_last_name) ILIKE ?", [like])
          .orWhere('a.application_number', 'ilike', like).orWhere('a.guardian_phone', 'ilike', like)
          .orWhere('a.guardian_email', 'ilike', like).orWhereRaw("CONCAT_WS(' ', a.guardian_first_name, a.guardian_last_name) ILIKE ?", [like]));
      }
      return q;
    };
    const statusCounts: Record<string, number> = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const r of await base().clone().select('a.status').count({ n: '*' }).groupBy('a.status') as any[]) statusCounts[String(r.status)] = Number(r.n);
    const listQ = base();
    if (f.status && STATUSES.includes(f.status as AdmStatus)) listQ.where('a.status', f.status);
    const total = Number((await listQ.clone().clearSelect().count({ n: '*' }).first() as any)?.n) || 0;
    const rows = await listQ.leftJoin('classes as c', 'c.id', 'a.class_applying_for').leftJoin('classes as ec', 'ec.id', 'a.enrolled_class_id')
      .leftJoin('students as s', 's.id', 'a.student_id')
      .select('a.*', 'c.name as class_name', 'ec.name as enrolled_class_name', 's.student_id as student_number')
      .orderBy('a.created_at', 'desc').limit(limit).offset((page - 1) * limit);
    return { data: rows, pagination: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) }, counts: statusCounts };
  },

  async get(tenantId: string, id: string) {
    const a = await db('admission_applications as a').where('a.tenant_id', tenantId)
      .where((w) => w.where('a.id', id).orWhere('a.application_number', id))
      .leftJoin('classes as c', 'c.id', 'a.class_applying_for').leftJoin('classes as ec', 'ec.id', 'a.enrolled_class_id')
      .leftJoin('students as s', 's.id', 'a.student_id').leftJoin('users as du', 'du.id', 'a.decided_by')
      .select('a.*', 'c.name as class_name', 'c.academic_session_id as class_session_id', 'ec.name as enrolled_class_name',
        's.student_id as student_number', db.raw("TRIM(CONCAT_WS(' ', du.first_name, du.last_name)) as decided_by_name"))
      .first();
    if (!a) throw new AppError('Application not found', 404, 'NOT_FOUND');
    const events = await db('admission_application_events as e').leftJoin('users as u', 'u.id', 'e.created_by')
      .where({ 'e.application_id': a.id, 'e.tenant_id': tenantId })
      .select('e.*', db.raw("TRIM(CONCAT_WS(' ', u.first_name, u.last_name)) as by_name")).orderBy('e.created_at', 'desc');
    const { sessionId } = await resolveActiveYear(tenantId);
    const classIsCurrent = !a.class_applying_for || !a.class_session_id || a.class_session_id === sessionId;
    return {
      ...a, events, duplicates: await duplicatesOf(tenantId, a),
      allowed: TRANSITIONS[a.status as AdmStatus] || [], can_enrol: a.status === 'approved' && !a.student_id,
      class_is_current: classIsCurrent, documents_list: DOCUMENTS,
    };
  },

  /** Staff-entered application (walk-in). Optionally enrol straight away. */
  async create(tenantId: string, user: { id: string; role: string }, body: any) {
    const childFirst = String(body?.child_first_name || '').trim(), childLast = String(body?.child_last_name || '').trim();
    if (!childFirst || !childLast) throw new AppError("Enter the child's first and last name.", 400, 'VALIDATION_ERROR');
    if (!String(body?.guardian_first_name || '').trim() || !String(body?.guardian_phone || '').trim()) throw new AppError("Enter the parent or guardian's name and phone.", 400, 'VALIDATION_ERROR');
    if (body?.child_dob && (!/^\d{4}-\d{2}-\d{2}$/.test(body.child_dob) || body.child_dob > today())) throw new AppError('Enter a valid date of birth.', 400, 'VALIDATION_ERROR');
    if (body?.guardian_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.guardian_email).trim())) throw new AppError('Enter a valid email address.', 400, 'VALIDATION_ERROR');
    const year = (await resolveActiveYear(tenantId)).yearString;
    if (body?.class_applying_for) {
      const ok = (await currentYearClasses(tenantId)).some((c: any) => c.id === body.class_applying_for);
      if (!ok) throw new AppError(`Choose a class from ${year}.`, 400, 'INVALID_CLASS');
    }
    const row: Record<string, any> = {};
    for (const k of EDITABLE) if (body?.[k] !== undefined) row[k] = cleanField(k, body[k]);
    const docs = cleanDocs(body?.documents);
    let created: any;
    await db.transaction(async (trx) => {
      await trx.raw('SELECT pg_advisory_xact_lock(?)', [62106125]); // same lock as the public form numbering
      const number = await generateNextId(trx, tenantId, 'admission');
      [created] = await trx('admission_applications').insert({
        ...row, tenant_id: tenantId, application_number: number, academic_year: year,
        first_name: childFirst, last_name: childLast, date_of_birth: row.child_dob || null, gender: row.child_gender || null,
        parent_name: [row.guardian_first_name, row.guardian_last_name].filter(Boolean).join(' ') || null,
        parent_phone: row.guardian_phone || null, parent_email: row.guardian_email || null,
        status: 'pending', application_source: 'office', documents: JSON.stringify(docs),
        created_by: user.id, created_at: new Date(), updated_at: new Date(),
      }).returning('*');
      await event(trx, tenantId, created.id, { kind: 'created', to: 'pending', note: 'Entered at the school office', by: user.id });
    });
    let enrolment: any = null;
    if (body?.enrol_now === true) {
      if (!created.class_applying_for) throw new AppError('Choose a class to enrol into.', 400, 'VALIDATION_ERROR');
      await this.changeStatus(tenantId, user, created.id, { status: 'approved', note: 'Accepted at the office', silent: true });
      enrolment = await this.enrol(tenantId, user, created.id, { class_id: created.class_applying_for, bill_terms: Array.isArray(body?.bill_terms) ? body.bill_terms : undefined, bill_all: !Array.isArray(body?.bill_terms) });
    }
    return { application: await this.get(tenantId, created.id), enrolment };
  },

  async update(tenantId: string, user: { id: string }, id: string, body: any) {
    const a = await getApp(db, tenantId, id);
    if (a.status === 'enrolled') throw new AppError('This applicant is already a student. Edit their record in Student Profiles.', 409, 'ALREADY_ENROLLED');
    const patch: Record<string, any> = {};
    for (const k of EDITABLE) if (body?.[k] !== undefined) patch[k] = cleanField(k, body[k]);
    if (patch.child_dob && (!/^\d{4}-\d{2}-\d{2}$/.test(patch.child_dob) || patch.child_dob > today())) throw new AppError('Enter a valid date of birth.', 400, 'VALIDATION_ERROR');
    if (patch.guardian_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.guardian_email)) throw new AppError('Enter a valid email address.', 400, 'VALIDATION_ERROR');
    if (patch.class_applying_for && patch.class_applying_for !== a.class_applying_for) {
      const ok = (await currentYearClasses(tenantId)).some((c: any) => c.id === patch.class_applying_for);
      if (!ok) throw new AppError('Choose a class from the current year.', 400, 'INVALID_CLASS');
    }
    if (body?.documents !== undefined) patch.documents = JSON.stringify(cleanDocs(body.documents));
    if (!Object.keys(patch).length) return this.get(tenantId, id);
    // Keep the legacy mirror columns in step.
    if (patch.child_first_name) patch.first_name = patch.child_first_name;
    if (patch.child_last_name) patch.last_name = patch.child_last_name;
    if (patch.child_dob !== undefined) patch.date_of_birth = patch.child_dob;
    if (patch.guardian_phone) patch.parent_phone = patch.guardian_phone;
    if (patch.guardian_email !== undefined) patch.parent_email = patch.guardian_email;
    await db('admission_applications').where({ id: a.id }).update({ ...patch, updated_by: user.id, updated_at: new Date() });
    const changed = Object.keys(patch).filter((k) => !['first_name', 'last_name', 'date_of_birth', 'parent_phone', 'parent_email'].includes(k));
    await event(db, tenantId, a.id, { kind: changed.length === 1 && changed[0] === 'documents' ? 'documents' : 'edit', note: changed.length === 1 && changed[0] === 'documents' ? 'Documents checklist updated' : `Edited: ${changed.map((k) => k.replace(/_/g, ' ')).join(', ')}`, by: user.id });
    return this.get(tenantId, id);
  },

  async addNote(tenantId: string, user: { id: string }, id: string, note: string) {
    const text = String(note || '').trim();
    if (text.length < 2) throw new AppError('Write a note first.', 400, 'VALIDATION_ERROR');
    const a = await getApp(db, tenantId, id);
    await event(db, tenantId, a.id, { kind: 'note', note: text, by: user.id });
    return this.get(tenantId, id);
  },

  /** Move an application to another stage (never to enrolled; see enrol). */
  async changeStatus(tenantId: string, user: { id: string; role?: string }, id: string,
    body: { status?: string; note?: string; interview_date?: string; interview_location?: string; assessment_score?: any; silent?: boolean }) {
    const to = String(body?.status || '') as AdmStatus;
    if (to === 'enrolled') throw new AppError('Use Enrol to make an approved applicant a student.', 400, 'USE_ENROL');
    if (!STATUSES.includes(to)) throw new AppError(`Status must be one of: ${STATUSES.filter((s) => s !== 'enrolled').join(', ')}`, 400, 'VALIDATION_ERROR');
    const note = String(body?.note || '').trim();
    if (['rejected', 'withdrawn'].includes(to) && note.length < 5) throw new AppError('Give a reason (at least 5 characters).', 400, 'VALIDATION_ERROR');
    let interviewAt: Date | null = null;
    if (to === 'interview_scheduled') {
      interviewAt = body?.interview_date ? new Date(body.interview_date) : null;
      if (!interviewAt || Number.isNaN(interviewAt.getTime())) throw new AppError('Set the interview date and time.', 400, 'VALIDATION_ERROR');
    }
    let score: number | null | undefined;
    if (body?.assessment_score !== undefined && body.assessment_score !== '' && body.assessment_score !== null) {
      score = Number(body.assessment_score);
      if (!Number.isFinite(score) || score < 0 || score > 100) throw new AppError('The assessment score must be between 0 and 100.', 400, 'VALIDATION_ERROR');
    }
    // Interview times are shown in the school's timezone (emails and timeline).
    const tz = interviewAt ? await tenantTimezone(tenantId) : 'UTC';
    const whenText = (d: Date, style: 'full' | 'short') => {
      try { return d.toLocaleString('en-GB', { timeZone: tz, ...(style === 'full' ? { dateStyle: 'full', timeStyle: 'short' } : { dateStyle: 'medium', timeStyle: 'short' }) } as any); }
      catch { return d.toISOString().slice(0, 16).replace('T', ' '); }
    };
    let from: AdmStatus = 'pending';
    let app: any;
    await db.transaction(async (trx) => {
      app = await getApp(trx, tenantId, id, true);
      from = app.status as AdmStatus;
      if (!(TRANSITIONS[from] || []).includes(to)) {
        throw new AppError(`An application that is "${LABELS[from] || from}" can't be moved to "${LABELS[to]}".`, 409, 'INVALID_TRANSITION');
      }
      const upd: any = { status: to, updated_at: new Date(), updated_by: user.id };
      if (['approved', 'rejected', 'waitlist'].includes(to)) { upd.decided_by = user.id; upd.decided_at = new Date(); upd.decision_notes = note || null; }
      if (to === 'interview_scheduled') { upd.interview_date = interviewAt; upd.interview_location = String(body?.interview_location || '').trim().slice(0, 200) || null; }
      if (to === 'withdrawn') upd.withdrawn_reason = note.slice(0, 500);
      if (score !== undefined) upd.assessment_score = score;
      await trx('admission_applications').where({ id: app.id }).update(upd);
      const extra = [
        to === 'interview_scheduled' ? `Interview ${whenText(interviewAt!, 'short')}${upd.interview_location ? ` at ${upd.interview_location}` : ''}` : '',
        score !== undefined && score !== null ? `Assessment score ${score}` : '',
        note,
      ].filter(Boolean).join(' · ');
      await event(trx, tenantId, app.id, { kind: 'status', from, to, note: extra || null, by: user.id });
    });

    // Tell the family (best-effort, once per decision).
    let emailSent: boolean | null = null;
    const to_email = app.guardian_email || app.parent_email;
    if (!body?.silent && to_email) {
      const sent: string[] = Array.isArray(app.emailed_decisions) ? app.emailed_decisions : [];
      const key = to === 'interview_scheduled' ? `interview:${interviewAt!.toISOString()}` : to;
      if (['approved', 'rejected', 'waitlist', 'interview_scheduled'].includes(to) && !sent.includes(key)) {
        try {
          if (to === 'interview_scheduled') {
            const when = whenText(interviewAt!, 'full');
            emailSent = await emailApplicant(tenantId, to_email, guardianName(app), 'Admission interview', [
              `${name(app)} is invited for an admission interview on ${when}${body?.interview_location ? ` at ${String(body.interview_location).trim()}` : ''}.`,
              `Application number: ${app.application_number}. Please bring the child and any documents the school asked for.`,
            ]);
          } else {
            const cls = app.class_applying_for ? (await db('classes').where({ id: app.class_applying_for }).first('name'))?.name : undefined;
            const { default: emailService } = await import('@services/emailService');
            const r: any = await emailService.sendAdmissionDecisionEmail(tenantId, to_email, {
              guardianName: guardianName(app), studentName: name(app), decision: to, applicationNumber: app.application_number,
              className: cls, notes: to === 'rejected' ? undefined : note || undefined, publicApplicant: true,
            });
            emailSent = r?.status === 'sent';
          }
          if (emailSent) {
            await db('admission_applications').where({ id: app.id }).update({ emailed_decisions: JSON.stringify([...sent, key]) });
            await event(db, tenantId, app.id, { kind: 'email', to, note: `Email sent to ${to_email}`, by: user.id });
          }
        } catch (e) { logger.warn(`Admission email failed for ${app.application_number}: ${(e as any)?.message || e}`); emailSent = false; }
      }
    }
    return { ...(await this.get(tenantId, app.id)), email_sent: emailSent };
  },

  /**
   * Enrol an approved applicant: create the student once, enrol them in a
   * current-year class, link parents and provision logins. Idempotent.
   */
  async enrol(tenantId: string, user: { id: string; role?: string }, id: string, body: { class_id?: string; allow_over_capacity?: boolean; bill_terms?: string[]; bill_all?: boolean }) {
    const pre = await getApp(db, tenantId, id);
    if (pre.student_id) {
      const s = await db('students').where({ id: pre.student_id }).first('id', 'student_id');
      return { already: true, student: s, application: await this.get(tenantId, id), accounts: null };
    }
    const classId = String(body?.class_id || pre.class_applying_for || '');
    if (!classId) throw new AppError('Choose the class to enrol into.', 400, 'VALIDATION_ERROR');
    const classes = await currentYearClasses(tenantId);
    const cls = classes.find((c: any) => c.id === classId);
    const { sessionId, yearString } = await resolveActiveYear(tenantId);
    if (!cls) throw new AppError(`Choose a ${yearString} class. Last year's classes can't take new students.`, 400, 'INVALID_CLASS');
    if (cls.full && body?.allow_over_capacity !== true) {
      throw new AppError(`${cls.name} is full (${cls.enrolled} of ${cls.capacity}). Choose another class or confirm enrolling over capacity.`, 409, 'CLASS_FULL');
    }
    // Plan limit (same rule as adding a student by hand).
    try {
      const { SubscriptionService } = await import('@services/subscriptionService');
      const lim = await (SubscriptionService as any).checkLimit(tenantId, 'students');
      if (lim && lim.allowed === false) throw new AppError(`The school's plan allows ${lim.max} students (${lim.current} now). Ask the principal to upgrade the plan.`, 403, 'PLAN_LIMIT_REACHED');
    } catch (e) { if (e instanceof AppError) throw e; }

    let student: any; let app: any; let already = false;
    await db.transaction(async (trx) => {
      await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`admission-enrol:${id}`]);
      app = await getApp(trx, tenantId, id, true);
      if (app.student_id) { already = true; student = await trx('students').where({ id: app.student_id }).first(); return; }
      if (app.status !== 'approved') throw new AppError(`Only approved applications can be enrolled (this one is "${LABELS[app.status as AdmStatus] || app.status}").`, 409, 'NOT_APPROVED');
      // Student numbers are unique across schools: serialise their generation.
      await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', ['student-number']);
      const number = await generateNextId(trx, tenantId, 'student');
      [student] = await trx('students').insert({
        tenant_id: tenantId, user_id: null, student_id: number,
        first_name: app.child_first_name || app.first_name, last_name: app.child_last_name || app.last_name,
        email: app.guardian_email || app.parent_email || null,
        date_of_birth: app.child_dob || app.date_of_birth || null, gender: app.child_gender || app.gender || null,
        phone: app.guardian_phone || app.parent_phone || null, address: app.child_address || app.address || null,
        country: 'Sierra Leone', enrollment_date: today(), photo_url: app.child_photo_url || null,
        religion: app.child_religion || null, nationality: app.child_nationality || null, place_of_birth: app.child_place_of_birth || null,
        guardian_name: guardianName(app), guardian_phone: app.guardian_phone || app.parent_phone || null,
        guardian_relationship: app.guardian_relationship || null, guardian_occupation: app.guardian_occupation || null,
        emergency_contact: app.emergency_contact_phone || null, previous_school: app.previous_school || null,
        medical_conditions: [app.medication_details, app.allergy_details, app.chronic_illness_details].filter(Boolean).join('; ') || null,
        status: 'active', created_at: new Date(), updated_at: new Date(),
      }).returning('*');
      await trx('enrollments').insert({
        student_id: student.id, class_id: cls.id, academic_session_id: cls.academic_session_id || sessionId || null,
        enrollment_date: today(), status: 'active', created_at: new Date(), updated_at: new Date(),
      });
      await trx('admission_applications').where({ id: app.id }).update({
        status: 'enrolled', student_id: student.id, enrolled_class_id: cls.id, enrolled_at: new Date(), updated_by: user.id, updated_at: new Date(),
      });
      await event(trx, tenantId, app.id, { kind: 'enrolled', from: 'approved', to: 'enrolled', note: `Student ${number} · ${cls.name} (${yearString})`, by: user.id });
    });
    if (already) return { already: true, student: { id: student?.id, student_id: student?.student_id }, application: await this.get(tenantId, id), accounts: null };

    // After commit: parents and logins (best-effort; the student exists either way).
    const warnings: string[] = [];
    try {
      await linkGuardianForStudent(db, tenantId, student.id, student.last_name || '', {
        guardian_name: guardianName(app), guardian_email: app.guardian_email || app.parent_email || null,
        guardian_phone: app.guardian_phone || app.parent_phone || null, guardian_relationship: app.guardian_relationship || null,
        guardian_occupation: app.guardian_occupation || null,
      }, user.id);
    } catch (e) { warnings.push('Parent could not be linked automatically. Link them in Student Profiles.'); logger.warn(`Guardian link failed: ${(e as any)?.message || e}`); }
    let accounts: any = null;
    try {
      const { provisionStudentAccounts } = await import('@utils/studentAccounts');
      accounts = await provisionStudentAccounts(db, tenantId, {
        student_id: student.id, reg_id: student.student_id, email: student.email, first_name: student.first_name, last_name: student.last_name,
        guardian_name: guardianName(app), guardian_email: app.guardian_email || app.parent_email || null, guardian_phone: app.guardian_phone || app.parent_phone || null,
      } as any);
    } catch (e) { warnings.push('Portal logins could not be created. Create them in Student Profiles.'); logger.warn(`Account provisioning failed: ${(e as any)?.message || e}`); }

    // Fees: bill the terms the class has already been billed (the officer chose which).
    let fees = { billed: [] as string[], amount: 0 };
    const wanted = (body?.bill_all ? (cls.billed_terms || []) : Array.isArray(body?.bill_terms) ? body.bill_terms : []).map(String).filter((t) => (cls.billed_terms || []).includes(t));
    try { fees = await billCatchUp(tenantId, student.id, cls.id, yearString, wanted); }
    catch (e) { warnings.push('Fees could not be billed automatically. Ask the bursar to bill this student.'); logger.warn(`Catch-up billing failed: ${(e as any)?.message || e}`); }
    const notBilled = (cls.billed_terms || []).filter((t: string) => !fees.billed.includes(t));

    // Family: the new fees just billed (in-app + email). Billing has committed
    // (billCatchUp runs its own transaction); fire-and-forget.
    if (fees.billed.length && fees.amount > 0) {
      const billedAmount = fees.amount;
      import('../finance/core.js')
        .then(({ notifyFeesBilled }) => notifyFeesBilled(tenantId, [{ studentId: student.id, amount: billedAmount }]))
        .catch((e) => logger.warn(`Enrolment fees notice failed: ${(e as any)?.message || e}`));
    }

    // Bursar: a new student to bill / who was billed.
    try {
      const { notifyFinanceStaff } = await import('../finance/core.js');
      await notifyFinanceStaff(tenantId, ['accountant'], {
        subject: 'New student enrolled',
        message: `${name(app)} (${student.student_id}) joined ${cls.name}.`
          + (fees.billed.length ? ` Billed ${fees.billed.join(', ')} (Le ${fees.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}).` : '')
          + (notBilled.length ? ` Not billed: ${notBilled.join(', ')}.` : '')
          + (!(cls.billed_terms || []).length ? ' The class has no fees billed yet this year.' : ''),
        url: '/finance/fees', sourceType: 'student', sourceId: student.id, exceptUserId: user.id,
      });
    } catch { /* best-effort */ }
    // Class teacher: a new pupil in their register.
    try {
      const ct = await db('classes as c').join('teachers as t', 't.id', 'c.class_teacher_id').where('c.id', cls.id).first('t.user_id');
      if (ct?.user_id && ct.user_id !== user.id) {
        const { notifyUsers } = await import('../finance/core.js');
        await notifyUsers([ct.user_id], { subject: 'New student in your class', message: `${name(app)} (${student.student_id}) has joined ${cls.name}.`, url: '/academic/classes', sourceType: 'student', sourceId: student.id });
      }
    } catch { /* best-effort */ }

    const to = app.guardian_email || app.parent_email;
    if (to) {
      const ok = await emailApplicant(tenantId, to, guardianName(app), 'Enrolment confirmed', [
        `${name(app)} is now enrolled in ${cls.name} for ${yearString}. Student number: ${student.student_id}.`,
        accounts?.parentEmail ? `Your parent portal sign-in is ${accounts.parentEmail}. The school office will give you the password.` : 'The school office will give you the parent portal sign-in details.',
      ], { label: 'Open the parent portal', path: '/login' });
      if (ok) await event(db, tenantId, app.id, { kind: 'email', to: 'enrolled', note: `Email sent to ${to}`, by: user.id });
    }
    await notifyAdmissionsStaff(tenantId, {
      subject: 'New student enrolled', message: `${name(app)} (${student.student_id}) joined ${cls.name}.`,
      url: '/students/directory', sourceId: app.id, exceptUserId: user.id,
    });
    return {
      already: false, student: { id: student.id, student_id: student.student_id }, class: { id: cls.id, name: cls.name }, warnings, fees: { ...fees, not_billed: notBilled },
      accounts: accounts ? { student_username: accounts.studentUsername, student_password: accounts.studentPassword, parent_email: accounts.parentEmail, parent_password: accounts.parentPassword } : null,
      application: await this.get(tenantId, id),
    };
  },

  /** Principal only. Never deletes an application that became a student. */
  async remove(tenantId: string, user: { id: string }, id: string) {
    const a = await getApp(db, tenantId, id);
    if (a.student_id || a.status === 'enrolled') throw new AppError('This applicant is now a student, so the application is kept as their admission record.', 409, 'ENROLLED_KEEP');
    await db('admission_applications').where({ id: a.id }).del();
    try {
      await db('audit_logs').insert({ user_id: user.id, action: 'delete', entity_type: 'admission_application', entity_id: a.id,
        changes: JSON.stringify({ application_number: a.application_number, child: name(a), status: a.status }), created_at: new Date() });
    } catch { /* audit is best-effort */ }
    return { id: a.id };
  },

  /** Dashboard numbers for one intake year (default: the active year). */
  async overview(tenantId: string, rawYear?: string) {
    const all = rawYear === 'all';
    const year = all ? null : normalizeAcademicYear(rawYear || null) || (await resolveActiveYear(tenantId)).yearString;
    const scoped = () => { const q = db('admission_applications').where('tenant_id', tenantId); if (year) q.where('academic_year', year); return q; };
    const byStatus: Record<string, number> = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const r of await scoped().select('status').count({ n: '*' }).groupBy('status') as any[]) byStatus[String(r.status)] = Number(r.n);
    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
    const thisMonth = Number((await scoped().where('created_at', '>=', db.raw("date_trunc('month', NOW())")).count({ n: '*' }).first() as any)?.n) || 0;
    const online = Number((await scoped().where('application_source', 'online').count({ n: '*' }).first() as any)?.n) || 0;
    const decided = byStatus.approved + byStatus.rejected + byStatus.enrolled + byStatus.waitlist;
    const acceptanceRate = decided ? Math.round(((byStatus.approved + byStatus.enrolled) / decided) * 100) : 0;
    const accepted = byStatus.approved + byStatus.enrolled;
    const enrollmentRate = accepted ? Math.round((byStatus.enrolled / accepted) * 100) : 0;
    const upcoming = await scoped().where('status', 'interview_scheduled').where('interview_date', '>=', db.raw('NOW() - interval \'1 day\''))
      .orderBy('interview_date').limit(10)
      .select('id', 'application_number', 'child_first_name', 'child_last_name', 'interview_date', 'interview_location');
    const byClass = await db('admission_applications as a').leftJoin('classes as c', 'c.id', 'a.class_applying_for')
      .where('a.tenant_id', tenantId).modify((q) => { if (year) q.where('a.academic_year', year); })
      .groupBy('c.name').select(db.raw("COALESCE(c.name, 'No class chosen') as class_name"),
        db.raw('COUNT(*)::int as applications'), db.raw("COUNT(*) FILTER (WHERE a.status = 'enrolled')::int as enrolled"),
        db.raw("COUNT(*) FILTER (WHERE a.status IN ('pending','under_review','interview_scheduled','waitlist'))::int as open"))
      .orderBy('applications', 'desc');
    // Applications received per calendar month (online vs office), zero-filled
    // from the first to the last month so the chart line has no gaps.
    const monthRows = await scoped()
      .select(db.raw("to_char(date_trunc('month', created_at), 'YYYY-MM') as ym"),
        db.raw('COUNT(*)::int as total'),
        db.raw("COUNT(*) FILTER (WHERE application_source = 'online')::int as online"))
      .groupByRaw("date_trunc('month', created_at)").orderByRaw("date_trunc('month', created_at)") as any[];
    const monthMap = new Map<string, { total: number; online: number }>(monthRows.map((r) => [String(r.ym), { total: Number(r.total), online: Number(r.online) }]));
    const byMonth: { month: string; total: number; online: number; office: number }[] = [];
    if (monthRows.length) {
      let [y, m] = String(monthRows[0].ym).split('-').map(Number);
      const [ly, lm] = String(monthRows[monthRows.length - 1].ym).split('-').map(Number);
      while (y < ly || (y === ly && m <= lm)) {
        const key = `${y}-${String(m).padStart(2, '0')}`;
        const v = monthMap.get(key) || { total: 0, online: 0 };
        byMonth.push({ month: key, total: v.total, online: v.online, office: v.total - v.online });
        if (m === 12) { y += 1; m = 1; } else m += 1;
      }
    }
    const recent = await db('admission_applications as a').leftJoin('classes as c', 'c.id', 'a.class_applying_for')
      .where('a.tenant_id', tenantId).modify((q) => { if (year) q.where('a.academic_year', year); })
      .select('a.id', 'a.application_number', 'a.child_first_name', 'a.child_last_name', 'a.guardian_first_name', 'a.guardian_last_name',
        'a.status', 'a.created_at', 'c.name as class_name')
      .orderBy('a.created_at', 'desc').limit(60);
    return {
      academicYear: year, totalApplications: total, thisMonth, online, acceptanceRate, enrollmentRate, byStatus,
      upcomingInterviews: upcoming.map((u: any) => ({ id: u.id, applicationNumber: u.application_number, studentName: [u.child_first_name, u.child_last_name].filter(Boolean).join(' '), at: u.interview_date, location: u.interview_location })),
      byClass, byMonth,
      applications: recent.map((a: any) => ({
        id: a.id, applicationNumber: a.application_number, studentName: [a.child_first_name, a.child_last_name].filter(Boolean).join(' ') || '—',
        parentName: [a.guardian_first_name, a.guardian_last_name].filter(Boolean).join(' ') || '—', className: a.class_name || '—', status: a.status, applicationDate: a.created_at,
      })),
    };
  },

  duplicatesOf,
};

function cleanDocs(v: any): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  const src = v && typeof v === 'object' ? v : {};
  for (const d of DOCUMENTS) if (src[d.key] === true) out[d.key] = true;
  return out;
}

export default admissionPipelineService;
