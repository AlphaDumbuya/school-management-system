/**
 * verificationService — school verification, reviewed by WiSkul.
 *
 * Lifecycle (verification_records.status, mirrored on the owner's
 * users.verification_status):
 *
 *   unverified ──(owner submits)──► pending ──(super admin)──► verified
 *        ▲                             │
 *        │                             └──(super admin)──► rejected ──(owner resubmits)──► pending
 *        └──(super admin revokes a verified school, with a reason)
 *
 * The account owner enters the school's EMIS code and their government ID.
 * We check the FORMAT of each field, that the name on the ID matches the
 * account owner's name on file, and that no other school is already verified
 * with the same EMIS code. If those pass the submission waits for review;
 * only a platform super admin can approve it. Only 'verified' passes the
 * gates, badges and the school-name lock.
 *
 * The ID number is encrypted at rest; only its last 4 characters are kept
 * readable. The full number is shown to a super admin only on the review
 * detail, and every time it is shown that is audited. The owner's account
 * name is never changed by this flow. Every step is in the platform audit log.
 */
import type { Knex } from 'knex';
import { db } from '@utils/database';
import { logger } from '@utils/logger';
import { AppError } from '@middleware/errorHandler';
import { encryptSecret, decryptSecret } from '@utils/encryption';
import { SCHOOL_LEVEL_VALUES, schoolTypeFor } from '@utils/schoolLevels';
import PlatformAuditService from './platformAuditService';
import notificationService from './notificationService';
import emailService from './emailService';

export type IdType = 'national_id' | 'passport' | 'drivers_license';
export type VerificationState = 'unverified' | 'pending' | 'verified' | 'rejected';
export type ReviewFilter = VerificationState | 'all';

export interface VerifyInput {
  emisCode: string;
  idType: IdType;
  idNumber: string;
  idName: string;
  schoolLevel?: string;
  district?: string;
  yearEstablished?: number;
  /** The owner confirms the details are true and theirs. */
  declaration?: boolean;
}

export interface VerificationStatus {
  status: VerificationState;
  submittedAt?: string | null;
  verifiedAt?: string | null;
  /** Why it was rejected / revoked, or why the last submission failed the checks. */
  lastReason?: string | null;
  /** The account owner's name the ID must match (shown on the form). */
  ownerName?: string;
  /** Last 4 characters of the ID used ("ending 4821"), while pending or verified. */
  idLast4?: string | null;
  emisCode?: string | null;
  // Prefill for a resubmission (never the ID number).
  schoolLevel?: string | null;
  district?: string | null;
  yearEstablished?: number | null;
  idType?: string | null;
  idName?: string | null;
}

/** Request context for audit rows written on behalf of a super admin. */
export interface ReviewMeta {
  ip?: string | null;
  userAgent?: string | null;
}

/** EMIS / school registration codes: letters, digits, "/" and "-" (e.g. MEST/SL/2026/04). */
export const EMIS_RE = /^[A-Za-z0-9][A-Za-z0-9/-]{2,28}[A-Za-z0-9]$/;
const ID_RULES: Record<IdType, { re: RegExp; label: string }> = {
  passport: { re: /^[A-Za-z0-9]{6,12}$/, label: '6–12 letters or digits' },
  national_id: { re: /^[A-Za-z0-9-]{5,20}$/, label: '5–20 letters or digits' },
  drivers_license: { re: /^[A-Za-z0-9-]{5,20}$/, label: '5–20 letters or digits' },
};
/** Same list as the registration form (utils/schoolLevels). Kept under the old name for callers. */
export const SCHOOL_LEVELS = SCHOOL_LEVEL_VALUES;
export const SL_DISTRICTS = [
  'Western Area Urban', 'Western Area Rural', 'Bo', 'Bombali', 'Bonthe', 'Falaba', 'Kailahun', 'Kambia',
  'Karene', 'Kenema', 'Koinadugu', 'Kono', 'Moyamba', 'Port Loko', 'Pujehun', 'Tonkolili',
];
const STATES: VerificationState[] = ['unverified', 'pending', 'verified', 'rejected'];
const REVIEW_FILTERS: ReviewFilter[] = [...STATES, 'all'];
const HISTORY_ACTIONS = [
  'verification.submitted', 'verification.approved', 'verification.rejected', 'verification.revoked',
  'school_verified', 'school_verification_failed',
];
const FAILED_CHECK_TEXT: Record<string, string> = {
  emis_in_use: 'EMIS code already used by a verified school',
  name_mismatch: "Name on the ID didn't match the account owner",
};

const normEmis = (s: string) => s.trim().toUpperCase().replace(/\s+/g, '');
const stateOf = (s: unknown): VerificationState => (STATES.includes(s as VerificationState) ? (s as VerificationState) : 'unverified');
const fullName = (u: any) => `${u?.first_name || ''} ${u?.last_name || ''}`.trim();
/** Wait for a best-effort side job, but never longer than `ms` (serverless freezes after the response). */
async function within(p: Promise<unknown>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    p.catch(() => undefined),
    new Promise<void>((resolve) => { timer = setTimeout(resolve, ms); }),
  ]);
  if (timer) clearTimeout(timer);
}

/** Plain text from a reviewer: no tags or control characters, trimmed. */
function plainText(v: unknown): string {
  return String(v ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function reviewReason(v: unknown): string {
  const reason = plainText(v);
  if (reason.length < 5 || reason.length > 500) {
    throw new AppError('Give a reason between 5 and 500 characters.', 400, 'REASON_REQUIRED');
  }
  return reason;
}

class VerificationService {
  /** The tenant's account owner: the named owner, else the first principal who registered the school. */
  private async owner(tenantId: string, conn: Knex = db) {
    return conn('users').where({ tenant_id: tenantId, role: 'principal' }).orderBy([{ column: 'is_owner', order: 'desc' }, { column: 'created_at', order: 'asc' }]).first();
  }

  // ── Status ──────────────────────────────────────────────────────────────────
  async getStatus(userId: string, tenantId: string): Promise<VerificationStatus> {
    const user = await db('users').where({ id: userId, tenant_id: tenantId }).first();
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    const owner = await this.owner(tenantId);
    const rec = await db('verification_records').where({ tenant_id: tenantId }).first();
    // The school's status (it belongs to the school, not to whoever asks).
    const status = stateOf(owner?.verification_status);
    const inReview = status === 'pending' || status === 'verified';
    const out: VerificationStatus = {
      status,
      submittedAt: rec?.submitted_at || null,
      verifiedAt: status === 'verified' ? owner?.verified_at || null : null,
      lastReason: inReview ? null : rec?.last_reason || null,
      ownerName: fullName(owner),
      idLast4: inReview ? rec?.id_last4 || null : null,
      emisCode: rec?.emis_code || null,
    };
    // Prefill the form for a resubmission (never the ID number).
    if (rec && !inReview) {
      out.schoolLevel = rec.school_level || null;
      out.district = rec.district || null;
      out.yearEstablished = rec.year_established ?? null;
      out.idType = rec.id_type || null;
      out.idName = rec.id_name || null;
    }
    return out;
  }

  // ── Submit for review (owner) ───────────────────────────────────────────────
  async verify(userId: string, tenantId: string, input: VerifyInput): Promise<{ status: 'pending'; submittedAt: Date }> {
    const user = await db('users').where({ id: userId, tenant_id: tenantId }).first();
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    // Owner-only: the school owner (or, before one is named, the principal who registered the school).
    const owner = await this.owner(tenantId);
    if (user.role !== 'principal' || !owner || owner.id !== user.id) {
      throw new AppError('Only the school owner can verify the school.', 403, 'NOT_ACCOUNT_OWNER');
    }
    const current = stateOf(user.verification_status);
    const existing = await db('verification_records').where({ tenant_id: tenantId }).first();
    if (current === 'verified') {
      throw new AppError('Your school is already verified.', 409, 'ALREADY_VERIFIED');
    }
    if (current === 'pending' || existing?.status === 'pending') {
      throw new AppError('Your verification is already waiting for review.', 409, 'ALREADY_PENDING');
    }
    if (input.declaration !== true) {
      throw new AppError('Please confirm that these details are true and belong to you.', 400, 'VERIFICATION_FIELD_INVALID');
    }

    const emis = normEmis(input.emisCode || '');
    const idNumber = (input.idNumber || '').trim().replace(/\s+/g, '');
    const idName = (input.idName || '').trim().replace(/\s+/g, ' ').slice(0, 150);
    const ownerName = fullName(user);

    // ── Format checks ──
    if (!EMIS_RE.test(emis)) {
      throw new AppError('Enter your EMIS code or school registration number (4–30 letters or digits; "/" and "-" are allowed).', 400, 'VERIFICATION_FIELD_INVALID');
    }
    const rule = ID_RULES[input.idType];
    if (!rule) throw new AppError('Choose the type of ID.', 400, 'VERIFICATION_FIELD_INVALID');
    if (!rule.re.test(idNumber)) {
      throw new AppError(`That ID number doesn't look right. Expected ${rule.label}.`, 400, 'VERIFICATION_FIELD_INVALID');
    }
    if (!idName) throw new AppError('Enter your name exactly as it is printed on your ID.', 400, 'VERIFICATION_FIELD_INVALID');
    if (input.schoolLevel && !SCHOOL_LEVEL_VALUES.includes(input.schoolLevel)) {
      throw new AppError('Choose the school level.', 400, 'VERIFICATION_FIELD_INVALID');
    }
    if (input.district && !SL_DISTRICTS.includes(input.district)) {
      throw new AppError('Choose the district.', 400, 'VERIFICATION_FIELD_INVALID');
    }
    if (input.yearEstablished != null) {
      const y = Number(input.yearEstablished);
      const now = new Date().getFullYear();
      if (!Number.isInteger(y) || y < 1800 || y > now) {
        throw new AppError(`Year established must be between 1800 and ${now}.`, 400, 'VERIFICATION_FIELD_INVALID');
      }
    }

    // A failed check keeps the school's state (a rejected school stays rejected).
    const failedState: VerificationState = current === 'rejected' ? 'rejected' : 'unverified';

    // ── One school per EMIS code ──
    const taken = await this.emisTakenBy(emis, tenantId, ['verified']);
    if (taken) {
      await this.upsertRecord(db, userId, tenantId, input, emis, idNumber, idName, false, {
        status: failedState,
        last_reason: 'Another school on WiSkul is already verified with this EMIS code.',
      });
      await PlatformAuditService.record({
        tenantId, actorUserId: userId, action: 'school_verification_failed',
        entityType: 'tenant', entityId: tenantId, changes: { reason: 'emis_in_use', emis_code: emis, other_tenant: taken },
      });
      throw new AppError(
        'Another school on WiSkul is already verified with this EMIS code. Check the code, or contact WiSkul support if this is your school.',
        409, 'EMIS_IN_USE'
      );
    }

    // ── Name on the ID must match the account owner's name on file ──
    if (!this.namesMatch(idName, ownerName)) {
      await this.upsertRecord(db, userId, tenantId, input, emis, idNumber, idName, false, {
        status: failedState,
        last_reason: `The name on your ID ("${idName}") doesn't match the account owner name on file ("${ownerName}").`,
      });
      await PlatformAuditService.record({
        tenantId, actorUserId: userId, action: 'school_verification_failed',
        entityType: 'tenant', entityId: tenantId, changes: { reason: 'name_mismatch' },
      });
      throw new AppError(
        `The name on your ID doesn't match the account owner name on file (${ownerName}). Enter your name exactly as it is printed on your ID. If your account name is wrong, correct it in your profile first.`,
        400, 'IDENTITY_NAME_MISMATCH'
      );
    }

    // ── Waiting for review ──
    const submittedAt = new Date();
    await db.transaction(async (trx) => {
      await this.upsertRecord(trx, userId, tenantId, input, emis, idNumber, idName, true, {
        status: 'pending',
        last_reason: null,
        submitted_at: submittedAt,
        reviewed_by: null,
        reviewed_at: null,
        review_notes: null,
      });
      await trx('users').where({ id: userId, tenant_id: tenantId }).update({
        verification_status: 'pending',
        updated_at: submittedAt,
      });
    });

    const resubmission = current === 'rejected' || !!existing?.submitted_at;
    await PlatformAuditService.record({
      tenantId, actorUserId: userId, action: 'verification.submitted',
      entityType: 'tenant', entityId: tenantId,
      changes: { emis_code: emis, id_type: input.idType, id_last4: idNumber.slice(-4), resubmission },
    });
    logger.info(`School verification submitted for review: tenant ${tenantId} by owner ${userId}`);

    // Tell the platform (inbox + email). Best effort: never fails the submission.
    const tenant = await db('tenants').where({ id: tenantId }).first('name').catch(() => null);
    const schoolName = tenant?.name || 'A school';
    await within(
      db('platform_messages').insert({
        name: (ownerName || user.email || 'School owner').slice(0, 200),
        email: String(user.email || '').slice(0, 200),
        phone: null,
        school: schoolName.slice(0, 200),
        role: 'School Owner',
        message: `New school verification to review: ${schoolName}. EMIS ${emis}.${resubmission ? ' (Submitted again after changes.)' : ''}`,
        source: 'verification',
        status: 'unread',
        tenant_id: tenantId,
        created_at: new Date(),
      }).catch((e: any) => logger.warn(`[verification] inbox notice failed for ${tenantId}: ${e?.message || e}`)),
      5_000,
    );
    await within(
      emailService.sendVerificationSubmittedEmail({
        schoolName, ownerName, ownerEmail: user.email, emisCode: emis, tenantId, resubmission,
      }).catch((e: any) => logger.warn(`[verification] team email failed for ${tenantId}: ${e?.message || e}`)),
      8_000,
    );

    return { status: 'pending', submittedAt };
  }

  // ── Review queue (super admin) ──────────────────────────────────────────────

  /** Rows for the review queue / detail. Never selects id_number. */
  private reviewQuery() {
    return db('verification_records as v')
      .join('tenants as t', 't.id', 'v.tenant_id')
      .leftJoin('users as o', 'o.id', 'v.user_id')
      .leftJoin('users as r', 'r.id', 'v.reviewed_by')
      .select(
        'v.tenant_id',
        't.name as school_name',
        't.status as tenant_status',
        db.raw("NULLIF(TRIM(CONCAT_WS(' ', o.first_name, o.last_name)), '') as owner_name"),
        'o.email as owner_email',
        'v.emis_code', 'v.school_level', 'v.district', 'v.year_established',
        'v.id_type', 'v.id_last4', 'v.id_name', 'v.name_match', 'v.status',
        'v.submitted_at', 'v.reviewed_at',
        db.raw("NULLIF(TRIM(CONCAT_WS(' ', r.first_name, r.last_name)), '') as reviewed_by_name"),
        'v.last_reason', 'v.review_notes',
        db.raw(`EXISTS (
          SELECT 1 FROM verification_records v2
          WHERE v2.tenant_id <> v.tenant_id
            AND v2.status IN ('pending', 'verified')
            AND UPPER(REPLACE(v2.emis_code, ' ', '')) = UPPER(REPLACE(v.emis_code, ' ', ''))
        ) as emis_conflict`),
      );
  }

  private shapeRow(r: any) {
    return {
      ...r,
      status: stateOf(r.status),
      name_match: r.name_match === true,
      emis_conflict: r.emis_conflict === true,
    };
  }

  async listForReview(opts: { status?: string; search?: string; limit?: number } = {}) {
    const status = (opts.status || 'pending') as ReviewFilter;
    if (!REVIEW_FILTERS.includes(status)) {
      throw new AppError('Unknown status filter.', 400, 'INVALID_STATUS');
    }
    const limit = Math.min(Math.max(Number(opts.limit) || 100, 1), 500);
    const q = this.reviewQuery();
    if (status !== 'all') q.where('v.status', status);
    // Archived (deleted) schools don't belong in the waiting queue.
    if (status === 'pending') q.whereRaw("COALESCE(t.status, '') <> 'expired'");

    const search = String(opts.search || '').trim().slice(0, 100);
    if (search) {
      const like = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      q.where((b) => {
        b.where('t.name', 'ilike', like)
          .orWhere('v.emis_code', 'ilike', like)
          .orWhere('o.email', 'ilike', like)
          .orWhereRaw("CONCAT_WS(' ', o.first_name, o.last_name) ILIKE ?", [like]);
      });
    }

    if (status === 'pending') q.orderByRaw('COALESCE(v.submitted_at, v.updated_at) ASC');
    else q.orderByRaw('COALESCE(v.reviewed_at, v.submitted_at, v.updated_at) DESC NULLS LAST');

    const rows = await q.limit(limit);
    return rows.map((r: any) => this.shapeRow(r));
  }

  async pendingCount(): Promise<number> {
    const row = await db('verification_records as v')
      .join('tenants as t', 't.id', 'v.tenant_id')
      .where('v.status', 'pending')
      .whereRaw("COALESCE(t.status, '') <> 'expired'")
      .count({ count: '*' })
      .first();
    return parseInt(String((row as any)?.count ?? '0'), 10) || 0;
  }

  async getForReview(tenantId: string, adminUserId: string, meta: ReviewMeta = {}) {
    const row = await this.reviewQuery().where('v.tenant_id', tenantId).first();
    if (!row) throw new AppError('This school has no verification on file.', 404, 'VERIFICATION_NOT_FOUND');
    const rec = await db('verification_records').where({ tenant_id: tenantId }).first('id_number', 'user_id');

    let idNumber: string | null = null;
    try {
      idNumber = rec?.id_number ? decryptSecret(String(rec.id_number)) : null;
    } catch (e: any) {
      logger.warn(`[verification] could not decrypt the ID number for tenant ${tenantId}: ${e?.message || e}`);
    }

    const [owner, school, tenant, schoolType, history] = await Promise.all([
      this.owner(tenantId).catch(() => null),
      db('schools').where({ tenant_id: tenantId }).first('name', 'emis_code', 'phone', 'email', 'address').catch(() => null),
      db('tenants').where({ id: tenantId }).first('name', 'contact_email', 'contact_phone', 'address').catch(() => null),
      schoolTypeFor(db, tenantId),
      this.history(tenantId),
    ]);
    // users has no phone column; a principal may also have a staff (teachers) row with one.
    const ownerId = owner?.id || rec?.user_id;
    const staff = ownerId
      ? await db('teachers').where({ user_id: ownerId }).first('phone').catch(() => null)
      : null;

    if (idNumber) {
      await PlatformAuditService.record({
        tenantId, actorUserId: adminUserId, action: 'verification.id_viewed',
        entityType: 'tenant', entityId: tenantId, ip: meta.ip, userAgent: meta.userAgent,
      });
    }

    return {
      ...this.shapeRow(row),
      owner_name: (owner && fullName(owner)) || row.owner_name || null,
      owner_email: owner?.email || row.owner_email || null,
      owner_phone: staff?.phone || null,
      id_number: idNumber,
      school: {
        name: school?.name || tenant?.name || row.school_name,
        emis_code: school?.emis_code || null,
        phone: school?.phone || tenant?.contact_phone || null,
        email: school?.email || tenant?.contact_email || null,
        address: school?.address || tenant?.address || null,
        school_type: schoolType,
      },
      history,
    };
  }

  private async history(tenantId: string) {
    try {
      const rows = await db('audit_logs as a')
        .leftJoin('users as u', 'u.id', 'a.user_id')
        .where((b) => b.where('a.tenant_id', tenantId).orWhere('a.entity_id', tenantId))
        .whereIn('a.action', HISTORY_ACTIONS)
        .orderBy('a.created_at', 'desc')
        .limit(50)
        .select(
          'a.action',
          'a.created_at as at',
          db.raw("COALESCE(a.actor_name, NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email) as by_name"),
          db.raw("COALESCE(a.reason, a.changes ->> 'reason') as reason"),
        );
      return rows.map((r: any) => ({
        action: r.action,
        at: r.at,
        by_name: r.by_name || null,
        reason: r.reason ? FAILED_CHECK_TEXT[r.reason] || r.reason : null,
      }));
    } catch (e: any) {
      logger.warn(`[verification] history lookup failed for ${tenantId}: ${e?.message || e}`);
      return [];
    }
  }

  // ── Decisions (super admin) ─────────────────────────────────────────────────

  async approve(tenantId: string, adminUserId: string, notes: unknown, meta: ReviewMeta = {}): Promise<{ status: 'verified' }> {
    const rec = await this.recordFor(tenantId);
    if (rec.status !== 'pending') {
      throw new AppError('Only a verification that is waiting for review can be approved.', 409, 'NOT_PENDING');
    }
    const reviewNotes = notes == null || notes === '' ? null : plainText(notes);
    if (reviewNotes && reviewNotes.length > 1000) {
      throw new AppError('Keep the notes under 1000 characters.', 400, 'NOTES_TOO_LONG');
    }
    const emis = normEmis(rec.emis_code || '');
    const taken = await this.emisTakenBy(emis, tenantId, ['verified']);
    if (taken) {
      throw new AppError('Another school on WiSkul is already verified with this EMIS code. Reject this one or revoke the other first.', 409, 'EMIS_IN_USE');
    }

    const now = new Date();
    await db.transaction(async (trx) => {
      const updated = await trx('verification_records').where({ id: rec.id, status: 'pending' }).update({
        status: 'verified', reviewed_by: adminUserId, reviewed_at: now, review_notes: reviewNotes, last_reason: null, updated_at: now,
      });
      if (!updated) throw new AppError('This verification was already reviewed.', 409, 'NOT_PENDING');
      await this.setOwnerState(trx, tenantId, rec.user_id, { verification_status: 'verified', verified_at: now, updated_at: now });

      // Keep the school profile in step (only fills what is empty). A savepoint,
      // so a profile column that can't take the value never undoes the approval.
      const school = await trx('schools').where({ tenant_id: tenantId }).first('school_id', 'emis_code', 'founded_year');
      if (school) {
        const patch: Record<string, any> = {};
        if (!school.emis_code) patch.emis_code = emis;
        if (!school.founded_year && rec.year_established) patch.founded_year = Number(rec.year_established);
        if (Object.keys(patch).length) {
          await trx.transaction(async (sp) => {
            await sp('schools').where({ school_id: school.school_id }).update({ ...patch, updated_at: now });
          }).catch((e: any) => logger.warn(`[verification] school profile not updated for ${tenantId}: ${e?.message || e}`));
        }
      }
    });

    await PlatformAuditService.record({
      tenantId, actorUserId: adminUserId, action: 'verification.approved',
      entityType: 'tenant', entityId: tenantId, ip: meta.ip, userAgent: meta.userAgent,
      changes: { emis_code: emis, notes: reviewNotes },
    });
    logger.info(`School verification approved: tenant ${tenantId} by ${adminUserId}`);
    await this.notifyOwner(tenantId, rec.user_id, 'approved');
    return { status: 'verified' };
  }

  async reject(tenantId: string, adminUserId: string, reasonInput: unknown, meta: ReviewMeta = {}): Promise<{ status: 'rejected' }> {
    const reason = reviewReason(reasonInput);
    const rec = await this.recordFor(tenantId);
    if (rec.status !== 'pending') {
      throw new AppError('Only a verification that is waiting for review can be rejected.', 409, 'NOT_PENDING');
    }
    const now = new Date();
    await db.transaction(async (trx) => {
      const updated = await trx('verification_records').where({ id: rec.id, status: 'pending' }).update({
        status: 'rejected', last_reason: reason, reviewed_by: adminUserId, reviewed_at: now, updated_at: now,
      });
      if (!updated) throw new AppError('This verification was already reviewed.', 409, 'NOT_PENDING');
      await this.setOwnerState(trx, tenantId, rec.user_id, { verification_status: 'rejected', verified_at: null, updated_at: now });
    });

    await PlatformAuditService.record({
      tenantId, actorUserId: adminUserId, action: 'verification.rejected',
      entityType: 'tenant', entityId: tenantId, ip: meta.ip, userAgent: meta.userAgent,
      changes: { reason },
    });
    logger.info(`School verification rejected: tenant ${tenantId} by ${adminUserId}`);
    await this.notifyOwner(tenantId, rec.user_id, 'rejected', reason);
    return { status: 'rejected' };
  }

  async revoke(tenantId: string, adminUserId: string, reasonInput: unknown, meta: ReviewMeta = {}): Promise<{ status: 'unverified' }> {
    const reason = reviewReason(reasonInput);
    const rec = await this.recordFor(tenantId);
    const owner = await this.owner(tenantId);
    if (rec.status !== 'verified' && stateOf(owner?.verification_status) !== 'verified') {
      throw new AppError('Only a verified school can have its verification revoked.', 409, 'NOT_VERIFIED');
    }
    const now = new Date();
    await db.transaction(async (trx) => {
      await trx('verification_records').where({ id: rec.id }).update({
        status: 'unverified', last_reason: reason, reviewed_by: adminUserId, reviewed_at: now, updated_at: now,
      });
      await this.setOwnerState(trx, tenantId, rec.user_id, { verification_status: 'unverified', verified_at: null, updated_at: now });
    });

    await PlatformAuditService.record({
      tenantId, actorUserId: adminUserId, action: 'verification.revoked',
      entityType: 'tenant', entityId: tenantId, ip: meta.ip, userAgent: meta.userAgent,
      changes: { reason },
    });
    logger.info(`School verification revoked: tenant ${tenantId} by ${adminUserId}`);
    await this.notifyOwner(tenantId, rec.user_id, 'revoked', reason);
    return { status: 'unverified' };
  }

  // ── Profile photo ───────────────────────────────────────────────────────────
  async setProfilePhoto(userId: string, tenantId: string, url: string): Promise<void> {
    // Uploaded images only (no links to other sites).
    if (!url || typeof url !== 'string' || !/^data:image\/(png|jpe?g|webp);base64,/i.test(url)) {
      throw new AppError('Choose a PNG, JPG or WEBP photo.', 400, 'VERIFICATION_FIELD_INVALID');
    }
    // Guard against oversized base64 payloads (~3MB decoded max).
    if (url.length > 4 * 1024 * 1024) {
      throw new AppError('Photo is too large. Please use an image under 3MB.', 400, 'VERIFICATION_PHOTO_TOO_LARGE');
    }
    const updated = await db('users').where({ id: userId, tenant_id: tenantId }).update({
      profile_photo_url: url,
      updated_at: new Date(),
    });
    if (!updated) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // ── helpers ──────────────────────────────────────────────────────────────────

  private async recordFor(tenantId: string) {
    const rec = await db('verification_records').where({ tenant_id: tenantId }).first();
    if (!rec) throw new AppError('This school has no verification on file.', 404, 'VERIFICATION_NOT_FOUND');
    return rec;
  }

  /** Another tenant using this (normalised) EMIS code with one of these statuses, or null. */
  private async emisTakenBy(emis: string, tenantId: string, statuses: VerificationState[]): Promise<string | null> {
    const row = await db('verification_records as v')
      .join('users as u', 'u.id', 'v.user_id')
      .whereNot('v.tenant_id', tenantId)
      .whereIn('v.status', statuses)
      .whereRaw("UPPER(REPLACE(v.emis_code, ' ', '')) = ?", [emis])
      .first('v.tenant_id');
    return row?.tenant_id || null;
  }

  /**
   * The school's state lives on the owner row (the gates read the current
   * owner). Update the current owner and, if different, whoever submitted.
   */
  private async setOwnerState(trx: Knex.Transaction, tenantId: string, submitterId: string | null, patch: Record<string, any>) {
    const owner = await this.owner(tenantId, trx);
    const ids = Array.from(new Set([owner?.id, submitterId].filter(Boolean))) as string[];
    if (ids.length) await trx('users').where({ tenant_id: tenantId }).whereIn('id', ids).update(patch);
  }

  /** In-app notice + email to the school owner about a decision. Best effort, after commit. */
  private async notifyOwner(tenantId: string, submitterId: string | null, decision: 'approved' | 'rejected' | 'revoked', reason?: string) {
    try {
      const owner = (await this.owner(tenantId)) || (submitterId ? await db('users').where({ id: submitterId }).first() : null);
      if (!owner) return;
      const tenant = await db('tenants').where({ id: tenantId }).first('name').catch(() => null);
      const schoolName = tenant?.name || 'your school';
      const copy = {
        approved: {
          subject: 'Your school is verified',
          message: `WiSkul approved the verification for ${schoolName}. You can now change your plan and use every feature that needs a verified school.`,
        },
        rejected: {
          subject: 'Your school verification was not approved',
          message: `WiSkul could not approve the verification for ${schoolName}. Reason: ${reason}. Open Verify school to correct the details and submit again.`,
        },
        revoked: {
          subject: 'Your school is no longer verified',
          message: `WiSkul removed the verification for ${schoolName}. Reason: ${reason}. Open Verify school to submit it again.`,
        },
      }[decision];

      await within(
        notificationService.createNotification({
          notificationType: 'account_status',
          recipientId: owner.id,
          subject: copy.subject,
          message: copy.message,
          data: { url: '/verify-school', verification: decision },
          channels: ['in_app'],
        }).catch((e: any) => logger.warn(`[verification] in-app notice failed for ${tenantId}: ${e?.message || e}`)),
        5_000,
      );
      if (owner.email) {
        await within(
          emailService.sendSchoolVerificationDecisionEmail(owner.email, {
            schoolName, ownerName: fullName(owner), decision, reason: reason || null,
          }).catch((e: any) => logger.warn(`[verification] decision email failed for ${tenantId}: ${e?.message || e}`)),
          8_000,
        );
      }
    } catch (e: any) {
      logger.warn(`[verification] owner notice failed for ${tenantId}: ${e?.message || e}`);
    }
  }

  /**
   * Accent/case/punctuation-insensitive and word-order-tolerant. A middle name
   * on one side is fine, but at least two names (first + last) must agree, so
   * "John" alone doesn't match "John Kamara".
   */
  private namesMatch(a: string, b: string): boolean {
    const norm = (s: string) =>
      s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
    const ta = new Set(norm(a));
    const tb = new Set(norm(b));
    if (ta.size === 0 || tb.size === 0) return false;
    const [small, large] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
    for (const tok of small) if (!large.has(tok)) return false;
    return small.size >= Math.min(2, large.size);
  }

  /** One record per tenant: insert or overwrite it (a resubmission overwrites the same row). */
  private async upsertRecord(
    conn: Knex, userId: string, tenantId: string, input: VerifyInput, emis: string, idNumber: string, idName: string,
    nameMatch: boolean, extra: Record<string, any>,
  ): Promise<void> {
    const existing = await conn('verification_records').where({ tenant_id: tenantId }).first('id');
    const row = {
      user_id: userId,
      tenant_id: tenantId,
      emis_code: emis,
      school_level: input.schoolLevel || null,
      district: input.district || null,
      year_established: input.yearEstablished ?? null,
      id_type: input.idType,
      id_number: encryptSecret(idNumber),
      id_last4: idNumber.slice(-4),
      id_name: idName,
      name_match: nameMatch,
      ...extra,
      updated_at: new Date(),
    };
    if (existing) await conn('verification_records').where({ id: existing.id }).update(row);
    else await conn('verification_records').insert({ ...row, created_at: new Date() });
  }
}

export default new VerificationService();
