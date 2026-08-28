// Backfill: ensure every student has a working student + parent login account.
// Heals never-logged-in accounts to the default password. Safe to re-run.
//
// Usage:
//   node scratch/backfill-student-accounts.mjs            (all tenants)
//   node scratch/backfill-student-accounts.mjs <tenantId> (single tenant)
import knex from 'knex';
import knexfile from '../knexfile.js';
import bcrypt from 'bcryptjs';

const env = process.env.NODE_ENV || 'production';
const db = knex(knexfile[env] || knexfile.production);

const STUDENT_DEFAULT = 'Student123!';
const PARENT_DEFAULT = 'Parent123!';
const tenantArg = process.argv[2];

async function ensureUser({ tenantId, email, first, last, role, password }) {
  email = (email || '').toLowerCase().trim();
  if (!email) return null;
  let u = await db('users').where({ tenant_id: tenantId, email }).first();
  if (!u) {
    const hash = await bcrypt.hash(password, 10);
    const [ins] = await db('users').insert({
      tenant_id: tenantId, email, first_name: first || 'User', last_name: last || '',
      password_hash: hash, role, status: 'active', created_at: new Date(), updated_at: new Date(),
    }).returning('*');
    return { user: ins, created: true, healed: false };
  }
  if (!u.last_login) {
    await db('users').where('id', u.id).update({
      password_hash: await bcrypt.hash(password, 10), status: 'active', updated_at: new Date(),
    });
    return { user: u, created: false, healed: true };
  }
  return { user: u, created: false, healed: false };
}

async function main() {
  let q = db('students');
  if (tenantArg) q = q.where('tenant_id', tenantArg);
  const students = await q.select('*');
  console.log(`Processing ${students.length} students...`);

  const hasGuardians = await db.schema.hasTable('guardians');
  let sCreated = 0, sHealed = 0, pCreated = 0, pHealed = 0;

  for (const s of students) {
    const reg = (s.student_id || 'student').toLowerCase();

    // Student account
    const studentEmail = s.email || `${reg}@student.school.com`;
    const sr = await ensureUser({
      tenantId: s.tenant_id, email: studentEmail,
      first: s.first_name || 'Student', last: s.last_name || s.student_id,
      role: 'student', password: STUDENT_DEFAULT,
    });
    if (sr?.created) sCreated++; if (sr?.healed) sHealed++;
    if (sr?.user && !s.user_id) {
      await db('students').where('id', s.id).update({ user_id: sr.user.id }).catch(() => {});
    }

    // Guardian → parent email
    let guardian = null;
    if (hasGuardians) {
      guardian = await db('guardians').where('student_id', s.id).orderBy('is_primary_guardian', 'desc').first();
    }
    const parentEmail = guardian?.email || `${reg}@parent.school.com`;
    const gName = (guardian ? `${guardian.first_name || ''} ${guardian.last_name || ''}`.trim() : '') || s.guardian_name || 'Parent';
    const [gFirst, ...gRest] = gName.split(' ');
    const pr = await ensureUser({
      tenantId: s.tenant_id, email: parentEmail,
      first: gFirst || 'Parent', last: gRest.join(' ') || s.last_name || reg,
      role: 'parent', password: PARENT_DEFAULT,
    });
    if (pr?.created) pCreated++; if (pr?.healed) pHealed++;
    if (pr?.user && hasGuardians && guardian && !guardian.user_id) {
      await db('guardians').where('id', guardian.id).update({ user_id: pr.user.id, updated_at: new Date() }).catch(() => {});
    }
  }

  console.log('\n=== DONE ===');
  console.log(`Student accounts: created ${sCreated}, healed ${sHealed}`);
  console.log(`Parent accounts : created ${pCreated}, healed ${pHealed}`);
}

main().catch(console.error).finally(() => db.destroy());
