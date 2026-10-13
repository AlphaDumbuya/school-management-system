/**
 * verificationService — instant, self-declared school verification.
 *
 * The account owner confirms the school's EMIS code and their government ID.
 * We check the FORMAT of each field, that the name on the ID matches the
 * account owner's name on file, and that no other school has already
 * verified with the same EMIS code. If all pass, the school is verified at
 * once.
 *
 * This is a declaration, not a registry check (there is no public EMIS /
 * MBSSE lookup): the owner confirms the details are true, and every
 * submission is recorded in the platform audit log.
 *
 * The ID number is encrypted at rest; only its last 4 characters are kept
 * readable. The owner's account name is never changed by this flow.
 */
import { db } from '@utils/database';
import { logger } from '@utils/logger';
import { AppError } from '@middleware/errorHandler';
import { encryptSecret } from '@utils/encryption';
import PlatformAuditService from './platformAuditService';

export type IdType = 'national_id' | 'passport' | 'drivers_license';

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
  status: 'unverified' | 'verified';
  verifiedAt?: string | null;
  lastReason?: string | null;
  /** The account owner's name the ID must match (shown on the form). */
  ownerName?: string;
  /** Last 4 characters of the ID used ("ending 4821"), once verified. */
  idLast4?: string | null;
  emisCode?: string | null;
}

/** EMIS / school registration codes: letters, digits, "/" and "-" (e.g. MEST/SL/2026/04). */
export const EMIS_RE = /^[A-Za-z0-9][A-Za-z0-9/-]{2,28}[A-Za-z0-9]$/;
const ID_RULES: Record<IdType, { re: RegExp; label: string }> = {
  passport: { re: /^[A-Za-z0-9]{6,12}$/, label: '6–12 letters or digits' },
  national_id: { re: /^[A-Za-z0-9-]{5,20}$/, label: '5–20 letters or digits' },
  drivers_license: { re: /^[A-Za-z0-9-]{5,20}$/, label: '5–20 letters or digits' },
};
export const SCHOOL_LEVELS = ['Pre-primary', 'Primary', 'Junior Secondary (JSS)', 'Senior Secondary (SSS)', 'Primary & JSS', 'JSS & SSS', 'Primary to SSS'];
export const SL_DISTRICTS = [
  'Western Area Urban', 'Western Area Rural', 'Bo', 'Bombali', 'Bonthe', 'Falaba', 'Kailahun', 'Kambia',
  'Karene', 'Kenema', 'Koinadugu', 'Kono', 'Moyamba', 'Port Loko', 'Pujehun', 'Tonkolili',
];
const normEmis = (s: string) => s.trim().toUpperCase().replace(/\s+/g, '');

class VerificationService {
  /** The tenant's account owner: the named owner, else the first principal who registered the school. */
  private async owner(tenantId: string) {
    return db('users').where({ tenant_id: tenantId, role: 'principal' }).orderBy([{ column: 'is_owner', order: 'desc' }, { column: 'created_at', order: 'asc' }]).first();
  }

  // ── Status ──────────────────────────────────────────────────────────────────
  async getStatus(userId: string, tenantId: string): Promise<VerificationStatus> {
    const user = await db('users').where({ id: userId, tenant_id: tenantId }).first();
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    const owner = await this.owner(tenantId);
    const rec = await db('verification_records').where({ tenant_id: tenantId }).first();
    const verified = owner?.verification_status === 'verified';
    return {
      // The school's status (it belongs to the school, not to whoever asks).
      status: verified ? 'verified' : 'unverified',
      verifiedAt: verified ? owner?.verified_at || null : null,
      lastReason: verified ? null : rec?.last_reason || null,
      ownerName: `${owner?.first_name || ''} ${owner?.last_name || ''}`.trim(),
      idLast4: verified ? rec?.id_last4 || null : null,
      emisCode: rec?.emis_code || null,
    };
  }

  // ── Verify (instant) ─────────────────────────────────────────────────────────
  async verify(userId: string, tenantId: string, input: VerifyInput): Promise<{ status: 'verified' }> {
    const user = await db('users').where({ id: userId, tenant_id: tenantId }).first();
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    // Owner-only: the school owner (or, before one is named, the principal who registered the school).
    const owner = await this.owner(tenantId);
    if (user.role !== 'principal' || !owner || owner.id !== user.id) {
      throw new AppError('Only the school owner can verify the school.', 403, 'NOT_ACCOUNT_OWNER');
    }
    if (user.verification_status === 'verified') {
      throw new AppError('Your school is already verified.', 409, 'ALREADY_VERIFIED');
    }
    if (input.declaration !== true) {
      throw new AppError('Please confirm that these details are true and belong to you.', 400, 'VERIFICATION_FIELD_INVALID');
    }

    const emis = normEmis(input.emisCode || '');
    const idNumber = (input.idNumber || '').trim().replace(/\s+/g, '');
    const idName = (input.idName || '').trim().replace(/\s+/g, ' ').slice(0, 150);
    const ownerName = `${user.first_name || ''} ${user.last_name || ''}`.trim();

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
    if (input.schoolLevel && !SCHOOL_LEVELS.includes(input.schoolLevel)) {
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

    // ── One school per EMIS code ──
    const taken = await db('verification_records as v')
      .join('users as u', 'u.id', 'v.user_id')
      .whereNot('v.tenant_id', tenantId)
      .where('v.status', 'verified')
      .whereRaw("UPPER(REPLACE(v.emis_code, ' ', '')) = ?", [emis])
      .first('v.tenant_id');
    if (taken) {
      await this.upsertRecord(userId, tenantId, input, emis, idNumber, idName, false, 'unverified',
        'Another school on WiSkul is already verified with this EMIS code.');
      await PlatformAuditService.record({
        tenantId, actorUserId: userId, action: 'school_verification_failed',
        entityType: 'tenant', entityId: tenantId, changes: { reason: 'emis_in_use', emis_code: emis, other_tenant: taken.tenant_id },
      });
      throw new AppError(
        'Another school on WiSkul is already verified with this EMIS code. Check the code, or contact WiSkul support if this is your school.',
        409, 'EMIS_IN_USE'
      );
    }

    // ── Name on the ID must match the account owner's name on file ──
    if (!this.namesMatch(idName, ownerName)) {
      await this.upsertRecord(userId, tenantId, input, emis, idNumber, idName, false, 'unverified',
        `The name on your ID ("${idName}") doesn't match the account owner name on file ("${ownerName}").`);
      await PlatformAuditService.record({
        tenantId, actorUserId: userId, action: 'school_verification_failed',
        entityType: 'tenant', entityId: tenantId, changes: { reason: 'name_mismatch' },
      });
      throw new AppError(
        `The name on your ID doesn't match the account owner name on file (${ownerName}). Enter your name exactly as it is printed on your ID. If your account name is wrong, correct it in your profile first.`,
        400, 'IDENTITY_NAME_MISMATCH'
      );
    }

    // ── Verified ──
    await this.upsertRecord(userId, tenantId, input, emis, idNumber, idName, true, 'verified', null);
    await db('users').where({ id: userId, tenant_id: tenantId }).update({
      verification_status: 'verified',
      verified_at: new Date(),
      updated_at: new Date(),
    });
    // Keep the school profile in step (only fills what is empty).
    const school = await db('schools').where({ tenant_id: tenantId }).first('school_id', 'emis_code', 'founded_year');
    if (school) {
      const patch: Record<string, any> = {};
      if (!school.emis_code) patch.emis_code = emis;
      if (!school.founded_year && input.yearEstablished) patch.founded_year = Number(input.yearEstablished);
      if (Object.keys(patch).length) await db('schools').where({ school_id: school.school_id }).update({ ...patch, updated_at: new Date() }).catch(() => undefined);
    }

    await PlatformAuditService.record({
      tenantId, actorUserId: userId, action: 'school_verified',
      entityType: 'tenant', entityId: tenantId, changes: { emis_code: emis, id_type: input.idType, id_last4: idNumber.slice(-4) },
    });
    logger.info(`School verified for tenant ${tenantId} by owner ${userId}`);
    return { status: 'verified' };
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

  private async upsertRecord(
    userId: string, tenantId: string, input: VerifyInput, emis: string, idNumber: string, idName: string,
    nameMatch: boolean, status: 'unverified' | 'verified', reason: string | null,
  ): Promise<void> {
    const existing = await db('verification_records').where({ tenant_id: tenantId }).first();
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
      status,
      last_reason: reason,
      updated_at: new Date(),
    };
    if (existing) await db('verification_records').where({ id: existing.id }).update(row);
    else await db('verification_records').insert({ ...row, created_at: new Date() });
  }
}

export default new VerificationService();
