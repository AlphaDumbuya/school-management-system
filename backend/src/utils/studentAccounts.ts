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
  try {
    const studentEmail = (info.email || `${reg}@student.school.com`).toLowerCase().trim();
    let su = await db('users').where({ tenant_id: tenantId, email: studentEmail }).first();
    if (!su) {
      const pwd = PasswordService.generateTemporaryPassword();
      const hash = await PasswordService.hashPassword(pwd);
      const [inserted] = await db('users').insert({
        tenant_id: tenantId,
        email: studentEmail,
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
    } else if (!su.last_login) {
      // Heal never-logged-in account with a fresh random temp password.
      const pwd = PasswordService.generateTemporaryPassword();
      await db('users').where('id', su.id).update({
        password_hash: await PasswordService.hashPassword(pwd),
        temp_password: pwd,
        status: 'active',
        updated_at: new Date(),
      });
      studentPassword = pwd;
    } else {
      // Real user (has logged in) — never touch their password; show stored temp if any.
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
    } else if (!pu.last_login) {
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

    // Link guardian rows for this student to the parent user.
    if (parentUserId) {
      try {
        if (await db.schema.hasTable('guardians')) {
          await db('guardians')
            .where('student_id', info.student_id)
            .whereNull('user_id')
            .update({ user_id: parentUserId, updated_at: new Date() })
            .catch(() => {});
        }
      } catch (_) { /* ignore */ }
    }
  } catch (e: any) {
    logger.warn('provisionStudentAccounts: parent account step failed', { error: e?.message });
  }

  return { studentUserId, parentUserId, parentEmail, studentPassword, parentPassword };
}
