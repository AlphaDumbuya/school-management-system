// Backfill: give every student a USERNAME = their student ID number, and make
// sure student + parent login accounts exist with a per-account generated demo
// password (never a shared default). Safe to re-run.
//
// - Students sign in with their student ID number (username) + demo password.
// - Parents sign in with the email from their application + demo password.
// - Never-logged-in accounts are (re)issued a fresh demo password; accounts a
//   real user has already signed into are left untouched (password preserved),
//   we only set the missing username.
//
// Usage:
//   node scratch/backfill-usernames.mjs            (all tenants)
//   node scratch/backfill-usernames.mjs <tenantId> (single tenant)
import knex from 'knex';
import knexfile from '../knexfile.js';
import bcrypt from 'bcryptjs';

const env = process.env.NODE_ENV || 'production';
const db = knex(knexfile[env] || knexfile.production);
const tenantArg = process.argv[2];

function genPassword() {
  const length = 12;
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let pwd = 'A' + 'a' + '1' + '!';
  for (let i = pwd.length; i < length; i++) pwd += charset.charAt(Math.floor(Math.random() * charset.length));
  return pwd;
}

async function main() {
  const hasUsername = await db.schema.hasColumn('users', 'username');
  if (!hasUsername) {
    console.error('The users.username column does not exist yet. Run migrations first (npm run migrate).');
    return;
  }

  let q = db('students');
  if (tenantArg) q = q.where('tenant_id', tenantArg);
  const students = await q.select('*');
  console.log(`Processing ${students.length} students...`);

  const hasGuardians = await db.schema.hasTable('guardians');
  let sCreated = 0, sUsernameSet = 0, sHealed = 0, pCreated = 0, pHealed = 0, skipped = 0;

  for (const s of students) {
    const reg = (s.student_id || '').trim();
    if (!reg) { skipped++; continue; }
    const regLower = reg.toLowerCase();

    // ── STUDENT account (username = student ID) ──────────────────────────
    const studentEmail = (s.email || `${regLower}@student.school.com`).toLowerCase().trim();
    // Match by username first, then by email.
    let su = await db('users').where({ tenant_id: s.tenant_id }).whereRaw('lower(username) = ?', [regLower]).first();
    if (!su) su = await db('users').where({ tenant_id: s.tenant_id, email: studentEmail }).first();

    if (!su) {
      const pwd = genPassword();
      const [ins] = await db('users').insert({
        tenant_id: s.tenant_id, email: studentEmail, username: reg,
        first_name: s.first_name || 'Student', last_name: s.last_name || reg,
        password_hash: await bcrypt.hash(pwd, 10), temp_password: pwd,
        role: 'student', status: 'active', created_at: new Date(), updated_at: new Date(),
      }).returning('*');
      su = ins; sCreated++;
    } else if (!su.last_login) {
      const pwd = genPassword();
      await db('users').where('id', su.id).update({
        password_hash: await bcrypt.hash(pwd, 10), temp_password: pwd,
        username: su.username || reg, status: 'active', updated_at: new Date(),
      });
      sHealed++;
    } else if (!su.username) {
      // Real user — keep their password, just set the missing username.
      await db('users').where('id', su.id).update({ username: reg, updated_at: new Date() }).catch(() => {});
      sUsernameSet++;
    }
    if (su && !s.user_id) {
      await db('students').where('id', s.id).update({ user_id: su.id }).catch(() => {});
    }

    // ── PARENT account (email from application + demo password) ───────────
    let guardian = null;
    if (hasGuardians) {
      guardian = await db('guardians').where('student_id', s.id).orderBy('is_primary_guardian', 'desc').orderBy('created_at', 'desc').first();
    }
    const parentEmail = (guardian?.email || s.guardian_email || `${regLower}@parent.school.com`).toLowerCase().trim();
    const gName = (guardian ? `${guardian.first_name || ''} ${guardian.last_name || ''}`.trim() : '') || s.guardian_name || 'Parent';
    const [gFirst, ...gRest] = gName.split(' ');

    let pu = await db('users').where({ tenant_id: s.tenant_id, email: parentEmail }).first();
    if (!pu) {
      const pwd = genPassword();
      const [ins] = await db('users').insert({
        tenant_id: s.tenant_id, email: parentEmail,
        first_name: gFirst || 'Parent', last_name: gRest.join(' ') || s.last_name || reg,
        password_hash: await bcrypt.hash(pwd, 10), temp_password: pwd,
        role: 'parent', status: 'active', created_at: new Date(), updated_at: new Date(),
      }).returning('*');
      pu = ins; pCreated++;
    } else if (!pu.last_login) {
      const pwd = genPassword();
      await db('users').where('id', pu.id).update({
        password_hash: await bcrypt.hash(pwd, 10), temp_password: pwd,
        status: 'active', updated_at: new Date(),
      });
      pHealed++;
    }
    if (pu && hasGuardians && guardian && !guardian.user_id) {
      await db('guardians').where('id', guardian.id).update({ user_id: pu.id, updated_at: new Date() }).catch(() => {});
    }
  }

  console.log('\n=== DONE ===');
  console.log(`Students          : ${students.length} (skipped ${skipped} with no ID)`);
  console.log(`Student accounts  : created ${sCreated}, healed ${sHealed}, username-set ${sUsernameSet}`);
  console.log(`Parent accounts   : created ${pCreated}, healed ${pHealed}`);
}

main().catch(console.error).finally(() => db.destroy());
