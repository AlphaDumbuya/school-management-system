// Backfill: ensure every student has an AUTHORITATIVE guardians row linked to
// their parent user account. Parent-portal access + release notifications
// depend on the guardians table (guardians.student_id + guardians.user_id),
// not the synthetic {reg}@parent.school.com email. Safe to re-run.
//
// For each student:
//   1. Find/derive the parent user (guardian email, else student's own email
//      match, else the synthetic {reg}@parent.school.com account).
//   2. Create a guardians row if none exists (using the student's guardian_*
//      columns), else link the existing unlinked guardian row to the parent.
//
// Usage:
//   node scratch/backfill-guardian-links.mjs            (all tenants)
//   node scratch/backfill-guardian-links.mjs <tenantId> (single tenant)
import knex from 'knex';
import knexfile from '../knexfile.js';

const env = process.env.NODE_ENV || 'production';
const db = knex(knexfile[env] || knexfile.production);
const tenantArg = process.argv[2];

async function main() {
  if (!(await db.schema.hasTable('guardians'))) {
    console.error('guardians table does not exist.'); return;
  }
  let q = db('students');
  if (tenantArg) q = q.where('tenant_id', tenantArg);
  const students = await q.select('*');
  console.log(`Processing ${students.length} students...`);

  let created = 0, linked = 0, alreadyOk = 0, noParent = 0;

  for (const s of students) {
    const reg = (s.student_id || '').trim();
    if (!reg) continue;
    const regLower = reg.toLowerCase();

    // Resolve the parent user for this student.
    // Priority: guardian_email → student's own registration email → synthetic.
    const candidateEmails = [
      (s.guardian_email || '').toLowerCase().trim(),
      `${regLower}@parent.school.com`,
    ].filter(Boolean);

    let parent = null;
    for (const em of candidateEmails) {
      parent = await db('users').where({ tenant_id: s.tenant_id, email: em, role: 'parent' }).first();
      if (parent) break;
    }
    if (!parent) { noParent++; continue; }

    const existing = await db('guardians').where('student_id', s.id).first();
    const gName = (s.guardian_name || `${parent.first_name || ''} ${parent.last_name || ''}`.trim() || 'Parent');
    const [gFirst, ...gRest] = gName.split(' ');

    if (!existing) {
      await db('guardians').insert({
        student_id: s.id,
        first_name: gFirst || 'Parent',
        last_name: gRest.join(' ') || s.last_name || reg,
        email: s.guardian_email || parent.email || null,
        phone_number: s.guardian_phone || null,
        relationship: 'Guardian',
        is_primary_guardian: true,
        user_id: parent.id,
        created_at: new Date(),
        updated_at: new Date(),
      });
      created++;
    } else if (!existing.user_id) {
      await db('guardians').where('id', existing.id).update({ user_id: parent.id, updated_at: new Date() });
      linked++;
    } else {
      alreadyOk++;
    }
  }

  console.log('\n=== DONE ===');
  console.log(`Guardian rows created : ${created}`);
  console.log(`Existing rows linked  : ${linked}`);
  console.log(`Already linked        : ${alreadyOk}`);
  console.log(`No parent user found  : ${noParent}`);
}

main().catch(console.error).finally(() => db.destroy());
