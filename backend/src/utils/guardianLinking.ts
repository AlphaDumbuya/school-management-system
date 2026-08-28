/**
 * guardianLinking — smart parent/guardian linking helper
 *
 * Given a newly created student and guardian details, create a `guardians`
 * row and, when a matching parent already exists in the tenant (by email or
 * phone), link the guardian to that same parent user so siblings share one
 * parent account in the portal.
 *
 * This is intentionally best-effort: any failure is logged and swallowed so
 * it never blocks student creation.
 */

import type { Knex } from 'knex';
import { logger } from './logger.js';

export interface GuardianInput {
  guardian_name?: string | null;
  guardian_email?: string | null;
  guardian_phone?: string | null;
  guardian_relationship?: string | null;
  guardian_occupation?: string | null;
}

export interface LinkedParentResult {
  user_id: string | null;
  has_account: boolean;
  name: string;
  email: string | null;
}

/**
 * Create a guardian row for a student and link to an existing parent if found.
 * Returns the linked parent summary when a match was made, otherwise null.
 */
export async function linkGuardianForStudent(
  db: Knex,
  tenantId: string,
  studentId: string,
  studentLastName: string,
  input: GuardianInput,
  createdBy?: string | null,
): Promise<LinkedParentResult | null> {
  const gEmail = (input.guardian_email || '').trim().toLowerCase();
  const gPhone = (input.guardian_phone || '').trim();
  const gName = (input.guardian_name || '').trim();

  if (!studentId || (!gName && !gEmail && !gPhone)) return null;

  try {
    // 1) Strong match: an existing parent user account (by email).
    let parentUser: any = null;
    if (gEmail) {
      parentUser = await db('users')
        .where({ tenant_id: tenantId, email: gEmail })
        .whereIn('role', ['parent', 'guardian'])
        .first();
    }

    // 2) Fallback: an existing guardian record (reuse its linked user + identity).
    let existingGuardian: any = null;
    if (!parentUser && (gEmail || gPhone)) {
      existingGuardian = await db('guardians as g')
        .join('students as s', 'g.student_id', 's.id')
        .where('s.tenant_id', tenantId)
        .where(function (this: any) {
          if (gEmail) this.orWhereRaw('LOWER(g.email) = ?', [gEmail]);
          if (gPhone) this.orWhere('g.phone_number', gPhone);
        })
        .select('g.first_name', 'g.last_name', 'g.email', 'g.phone_number', 'g.user_id', 'g.relationship', 'g.occupation')
        .first();
    }

    const gFirst = parentUser?.first_name || existingGuardian?.first_name || (gName ? gName.split(' ')[0] : 'Parent');
    const gLast = parentUser?.last_name || existingGuardian?.last_name || (gName ? gName.split(' ').slice(1).join(' ') : studentLastName);
    const linkedUserId = parentUser?.id || existingGuardian?.user_id || null;

    await db('guardians').insert({
      student_id: studentId,
      first_name: gFirst,
      last_name: gLast,
      email: gEmail || parentUser?.email || existingGuardian?.email || null,
      phone_number: gPhone || existingGuardian?.phone_number || null,
      relationship: input.guardian_relationship || existingGuardian?.relationship || 'Parent',
      occupation: input.guardian_occupation || existingGuardian?.occupation || null,
      is_primary_guardian: true,
      user_id: linkedUserId,
      created_at: new Date(),
      updated_at: new Date(),
      created_by: createdBy || null,
    });

    if (parentUser || existingGuardian) {
      const result: LinkedParentResult = {
        user_id: linkedUserId,
        has_account: !!parentUser,
        name: `${gFirst} ${gLast}`.trim(),
        email: gEmail || parentUser?.email || existingGuardian?.email || null,
      };
      logger.info(`Student ${studentId} linked to existing parent (${result.email || linkedUserId})`);
      return result;
    }
    return null;
  } catch (err: any) {
    logger.warn('Smart guardian linking skipped:', { error: err?.message });
    return null;
  }
}
