/**
 * studentAccounts — provision login accounts for a student and their parent.
 *
 * Ensures a `users` row exists (role student / parent) with a RANDOM, per-account
 * temporary password (never a shared/guessable default). The generated password
 * is stored in `users.temp_password` so a principal can view + hand it out, and
 * the account holder should change it on first login. Best-effort: failures are
 * logged and swallowed so they never block student creation.
 *
 * Existing accounts are only "healed" (fresh temp password + reactivated) when
 * they have NEVER logged in (last_login is null), so a real user's chosen
 * password is never overwritten.
 */

import type { Knex } from 'knex';
import { PasswordService } from '../services/passwordService.js';
import { logger } from './logger.js';

export interface StudentAccountInfo {
  student_id: string;               // internal students.id
  reg_id: string;                   // human student_id (roll no.)
  email?: string | null;            // student's email
  first_name?: string | null;
  last_name?: string | null;
  guardian_name?: string | null;
  guardian_email?: string | null;
  guardian_phone?: string | null;
}

/**
 * Ensure student + parent user accounts exist with working default credentials.
 * Also links the student's guardian row to the parent user when possible.
 */
export async function provisionStudentAccounts(
  db: Knex,
  tenantId: string,
  info: StudentAccountInfo,
): Promise<{
  studentUserId: string | null;
  parentUserId: string | null;
  studentUsername: string | null;
  parentEmail: string;
  studentPassword: string | null;
  parentPassword: string | null;
}> {
  let studentUserId: string | null = null;
  let parentUserId: string | null = null;
  let studentPassword: string | null = null;
  let parentPassword: string | null = null;

  const reg = (info.reg_id || 'student').toLowerCase();

  // ── Student user account ────────────────────────────────────────────────
  // Students sign in with their STUDENT ID NUMBER (reg_id) as the username plus
  // a generated demo password. A synthetic email is still stored because the
  // users table requires a unique (tenant_id, email) — but it is not used to
  // sign in.
  const studentUsername = (info.reg_id || '').trim();
  try {
    const studentEmail = (info.email || `${reg}@student.school.com`).toLowerCase().trim();
    // Prefer matching an existing account by username (ID number); fall back to email.
    let su = studentUsername
      ? await db('users').where({ tenant_id: tenantId }).whereRaw('lower(username) = ?', [studentUsername.toLowerCase()]).first()
      : null;
    if (!su) su = await db('users').where({ tenant_id: tenantId, email: studentEmail }).first();
    if (!su) {
      const pwd = PasswordService.generateTemporaryPassword();
      const hash = await PasswordService.hashPassword(pwd);
      const [inserted] = await db('users').insert({
        tenant_id: tenantId,
        email: studentEmail,
        username: studentUsername || null,
        first_name: info.first_name || 'Student',
        last_name: info.last_name || info.reg_id,
        password_hash: hash,
        temp_password: pwd,
        role: 'student',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      }).returning('*');
      su = inserted;
      studentPassword = pwd;
    } else if (!su.last_login && !su.temp_password) {
      // Never-logged-in account that has NO demo password on file yet — set one
      // ONCE. We must NOT regenerate on every profile view (that would rotate
      // the password so the displayed one never matches the stored hash).
      const pwd = PasswordService.generateTemporaryPassword();
      await db('users').where('id', su.id).update({
        password_hash: await PasswordService.hashPassword(pwd),
        temp_password: pwd,
        username: studentUsername || su.username || null,
        status: 'active',
        updated_at: new Date(),
      });
      studentPassword = pwd;
    } else {
      // Existing account (logged in OR already has a demo password) — NEVER
      // touch the password. Just ensure the username (ID number) is set and
      // surface the stored demo password (if any).
      if (studentUsername && !su.username) {
        await db('users').where('id', su.id).update({ username: studentUsername, updated_at: new Date() }).catch(() => {});
      }
      studentPassword = su.temp_password || null;
    }
    studentUserId = su?.id ?? null;
    // Link students.user_id
    if (studentUserId) {
      await db('students').where('id', info.student_id).update({ user_id: studentUserId }).catch(() => {});
    }
  } catch (e: any) {
    logger.warn('provisionStudentAccounts: student account step failed', { error: e?.message });
  }

  // ── Parent user account ─────────────────────────────────────────────────
  const parentEmail = (info.guardian_email || `${reg}@parent.school.com`).toLowerCase().trim();
  // No parent login on plans without the parent portal (guardian contact
  // details are still kept on the student).
  const { portalAllowed } = await import('../services/entitlementService.js');
  if (!(await portalAllowed(tenantId, 'parent').catch(() => true))) {
    return { studentUserId, parentUserId: null, studentUsername: studentUsername || null, parentEmail: '', studentPassword, parentPassword: null };
  }
  try {
    let pu = await db('users').where({ tenant_id: tenantId, email: parentEmail }).first();
    const gName = (info.guardian_name || '').trim();
    const [gFirst, ...gRest] = gName ? gName.split(' ') : ['Parent'];
    if (!pu) {
      const pwd = PasswordService.generateTemporaryPassword();
      const hash = await PasswordService.hashPassword(pwd);
      const [inserted] = await db('users').insert({
        tenant_id: tenantId,
        email: parentEmail,
        first_name: gFirst || 'Parent',
        last_name: gRest.join(' ') || info.last_name || reg,
        password_hash: hash,
        temp_password: pwd,
        role: 'parent',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      }).returning('*');
      pu = inserted;
      parentPassword = pwd;
    } else if (!pu.last_login && !pu.temp_password) {
      // Set a demo password ONCE for a never-logged-in account with none on
      // file. Do NOT regenerate on every profile view (that rotates it so the
      // displayed password never matches the stored hash).
      const pwd = PasswordService.generateTemporaryPassword();
      await db('users').where('id', pu.id).update({
        password_hash: await PasswordService.hashPassword(pwd),
        temp_password: pwd,
        status: 'active',
        updated_at: new Date(),
      });
      parentPassword = pwd;
    } else {
      parentPassword = pu.temp_password || null;
    }
    parentUserId = pu?.id ?? null;

    // Ensure an AUTHORITATIVE guardian row exists linking this student to the
    // parent user. Parent-portal access + release notifications depend on the
    // guardians table (not the synthetic email), so we create one if missing
    // and always (re)link it to the parent user id.
    if (parentUserId) {
      try {
        if (await db.schema.hasTable('guardians')) {
          const existingGuardian = await db('guardians')
            .where('student_id', info.student_id)
            .first()
            .catch(() => null);

          if (!existingGuardian) {
            await db('guardians').insert({
              student_id: info.student_id,
              first_name: gFirst || 'Parent',
              last_name: gRest.join(' ') || info.last_name || reg,
              email: info.guardian_email || null,
              phone_number: info.guardian_phone || null,
              relationship: 'Guardian',
              is_primary_guardian: true,
              user_id: parentUserId,
              created_at: new Date(),
              updated_at: new Date(),
            }).catch((e) => logger.warn('provisionStudentAccounts: guardian insert failed', { error: e?.message }));
          } else {
            // Link any unlinked guardian rows for this student to the parent user.
            await db('guardians')
              .where('student_id', info.student_id)
              .whereNull('user_id')
              .update({ user_id: parentUserId, updated_at: new Date() })
              .catch(() => {});
          }
        }
      } catch (_) { /* ignore */ }
    }
  } catch (e: any) {
    logger.warn('provisionStudentAccounts: parent account step failed', { error: e?.message });
  }

  return { studentUserId, parentUserId, studentUsername: studentUsername || null, parentEmail, studentPassword, parentPassword };
}
