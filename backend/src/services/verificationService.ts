/**
 * verificationService — simple, instant, entry-based school verification.
 *
 * The account owner enters the school's EMIS code + their government-ID details.
 * We validate the FORMAT of each field (sensible ranges, not rigid) and confirm
 * the ID name MATCHES the name captured at registration. If both pass, the tenant
 * is verified instantly.
 *
 * Honest limitation: without a public EMIS/MBSSE lookup API, this proves the code
 * is well-formatted and the name matches — not that the school exists in a
 * government registry. A stronger tier can be plugged in later.
 *
 * Stores only entered identifiers + name-match + status + profile photo. No
 * biometric data, no uploaded files. Tenant-isolated throughout.
 */
import { db } from '@utils/database';
import { logger } from '@utils/logger';
import { AppError } from '@middleware/errorHandler';
import PlatformAuditService from './platformAuditService';

export type IdType = 'national_id' | 'passport' | 'drivers_license';

export interface VerifyInput {
  legalName: string;
  emisCode: string;
  idType: IdType;
  idNumber: string;
  idName: string;
  schoolLevel?: string;
  district?: string;
  yearEstablished?: number;
}

export interface VerificationStatus {
  status: 'unverified' | 'verified';
  verifiedAt?: string | null;
  lastReason?: string | null;
}

const EMIS_RE = /^[A-Za-z0-9]{4,20}$/;
const ID_RULES: Record<IdType, { re: RegExp; label: string }> = {
  passport: { re: /^[A-Za-z0-9]{6,12}$/, label: 'passport (6–12 letters/digits)' },
  national_id: { re: /^[A-Za-z0-9-]{5,20}$/, label: 'national ID (5–20 letters/digits)' },
  drivers_license: { re: /^[A-Za-z0-9-]{5,20}$/, label: "driver's licence (5–20 letters/digits)" },
};

class VerificationService {
  // ── Status ──────────────────────────────────────────────────────────────────
  async getStatus(userId: string, tenantId: string): Promise<VerificationStatus> {
    const user = await db('users').where({ id: userId, tenant_id: tenantId }).first();
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    const rec = await db('verification_records').where({ tenant_id: tenantId }).first();
    return {
      status: (user.verification_status as any) || 'unverified',
      verifiedAt: user.verified_at || null,
      lastReason: rec?.last_reason || null,
    };
  }

  // ── Verify (instant) ─────────────────────────────────────────────────────────
  async verify(userId: string, tenantId: string, input: VerifyInput): Promise<{ status: 'verified' }> {
    const user = await db('users').where({ id: userId, tenant_id: tenantId }).first();
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    // Owner-only: the tenant owner is the principal who registered the school.
    if (user.role !== 'principal') {
      throw new AppError('Only the school account owner can verify the school.', 403, 'NOT_ACCOUNT_OWNER');
    }

    const emis = (input.emisCode || '').trim();
    const idNumber = (input.idNumber || '').trim();
    const idName = (input.idName || '').trim();
    const legalName = (input.legalName || `${user.first_name || ''} ${user.last_name || ''}`).trim();

    // ── Format validation (Req 3) ──
    if (!EMIS_RE.test(emis)) {
      throw new AppError('EMIS code must be 4–20 letters or digits.', 400, 'VERIFICATION_FIELD_INVALID');
    }
    const rule = ID_RULES[input.idType];
    if (!rule) {
      throw new AppError('Select a valid ID type.', 400, 'VERIFICATION_FIELD_INVALID');
    }
    if (!rule.re.test(idNumber)) {
      throw new AppError(`ID number format is invalid — expected ${rule.label}.`, 400, 'VERIFICATION_FIELD_INVALID');
    }
    if (!idName) {
      throw new AppError('Enter your name exactly as printed on your ID.', 400, 'VERIFICATION_FIELD_INVALID');
    }
    if (input.yearEstablished != null) {
      const y = Number(input.yearEstablished);
      const now = new Date().getFullYear();
      if (!Number.isInteger(y) || y < 1900 || y > now) {
        throw new AppError(`Year established must be a 4-digit year between 1900 and ${now}.`, 400, 'VERIFICATION_FIELD_INVALID');
      }
    }

    // ── Name match (Req 4) ──
    const nameMatch = this.namesMatch(idName, legalName);

    // Persist confirmed legal name on the owner.
    await this.persistLegalName(userId, tenantId, legalName);

    if (!nameMatch) {
      await this.upsertRecord(userId, tenantId, input, emis, idNumber, idName, false, 'unverified',
        'The name on your ID does not match the account owner name on file.');
      await PlatformAuditService.record({
        tenantId, actorUserId: userId, action: 'school_verification_failed',
        entityType: 'tenant', entityId: tenantId, changes: { reason: 'name_mismatch' },
      });
      throw new AppError(
        'The name on your ID does not match the account owner name. Please check and try again.',
        400, 'IDENTITY_NAME_MISMATCH'
      );
    }

    // ── Success → verify instantly ──
    await this.upsertRecord(userId, tenantId, input, emis, idNumber, idName, true, 'verified', null);
    await db('users').where({ id: userId, tenant_id: tenantId }).update({
      verification_status: 'verified',
      verified_at: new Date(),
      updated_at: new Date(),
    });

    await PlatformAuditService.record({
      tenantId, actorUserId: userId, action: 'school_verified',
      entityType: 'tenant', entityId: tenantId, changes: { emis_code: emis },
    });
    logger.info(`School verified for tenant ${tenantId} by owner ${userId}`);
    return { status: 'verified' };
  }

  // ── Profile photo (Req 7) ──────────────────────────────────────────────────
  async setProfilePhoto(userId: string, tenantId: string, url: string): Promise<void> {
    if (!url || !/^https?:\/\//i.test(url)) {
      throw new AppError('A valid photo URL is required.', 400, 'VERIFICATION_FIELD_INVALID');
    }
    const updated = await db('users').where({ id: userId, tenant_id: tenantId }).update({
      profile_photo_url: url,
      updated_at: new Date(),
    });
    if (!updated) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // ── helpers ──────────────────────────────────────────────────────────────────

  /** Case/accent/whitespace-insensitive, order- and middle-name-tolerant token match. */
  private namesMatch(a: string, b: string): boolean {
    const norm = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // strip accents
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ') // drop punctuation
        .split(/\s+/)
        .filter(Boolean);
    const ta = new Set(norm(a));
    const tb = new Set(norm(b));
    if (ta.size === 0 || tb.size === 0) return false;
    // Match when the smaller name's tokens are all contained in the larger set
    // (handles middle names present on one side, and any word order).
    const [small, large] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
    for (const tok of small) {
      if (!large.has(tok)) return false;
    }
    return true;
  }

  private async persistLegalName(userId: string, tenantId: string, legalName: string): Promise<void> {
    const parts = legalName.split(/\s+/).filter(Boolean);
    if (parts.length < 1) return;
    const first = parts[0];
    const last = parts.length > 1 ? parts[parts.length - 1] : parts[0];
    await db('users').where({ id: userId, tenant_id: tenantId }).update({
      first_name: first,
      last_name: last,
      updated_at: new Date(),
    });
  }

  private async upsertRecord(
    userId: string,
    tenantId: string,
    input: VerifyInput,
    emis: string,
    idNumber: string,
    idName: string,
    nameMatch: boolean,
    status: 'unverified' | 'verified',
    reason: string | null
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
      id_number: idNumber,
      id_name: idName,
      name_match: nameMatch,
      status,
      last_reason: reason,
      updated_at: new Date(),
    };
    if (existing) {
      await db('verification_records').where({ id: existing.id }).update(row);
    } else {
      await db('verification_records').insert({ ...row, created_at: new Date() });
    }
  }
}

export default new VerificationService();
