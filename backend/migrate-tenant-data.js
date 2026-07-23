/**
 * Tenant Data Migration Script
 * ============================================================
 * This script fixes students (and related records) that were
 * incorrectly assigned to the DEFAULT tenant instead of the
 * tenant whose admin created them.
 *
 * Strategy:
 *  1. Find all non-default tenants.
 *  2. For each such tenant, find its admin users.
 *  3. Find admission_applications those users created.
 *  4. Find students whose names match those applications
 *     OR who are linked via user_id to the correct tenant.
 *  5. Reassign those students + auto-created user accounts
 *     to the correct tenant.
 *  6. Also fix any admission_applications rows missing tenant_id.
 *
 * Run with:  node migrate-tenant-data.js
 * Dry run:   node migrate-tenant-data.js --dry-run
 * ============================================================
 */

require('dotenv').config({ path: '../.env' });

const { Client } = require('pg');

const DRY_RUN = process.argv.includes('--dry-run');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log('\n✅  Connected to database');
  console.log(DRY_RUN ? '🔍  DRY RUN — no changes will be made\n' : '⚡  LIVE RUN — changes will be committed\n');

  try {
    // --------------------------------------------------------
    // 1. List all tenants
    // --------------------------------------------------------
    const { rows: tenants } = await client.query(
      `SELECT id, name, slug, created_at FROM tenants ORDER BY created_at ASC`
    );

    console.log(`Found ${tenants.length} tenant(s):`);
    tenants.forEach((t, i) => {
      console.log(`  [${i + 1}] ${t.name} (${t.slug}) — id: ${t.id}  created: ${t.created_at}`);
    });

    if (tenants.length < 2) {
      console.log('\nOnly one tenant exists — nothing to migrate.');
      return;
    }

    const defaultTenant = tenants[0]; // oldest = seeded default
    const otherTenants = tenants.slice(1);

    console.log(`\n📌  Default/seed tenant: "${defaultTenant.name}" (${defaultTenant.id})`);
    console.log(`📌  Tenant(s) to migrate INTO: ${otherTenants.map(t => `"${t.name}"`).join(', ')}\n`);

    // --------------------------------------------------------
    // 2. Student counts per tenant (before)
    // --------------------------------------------------------
    const { rows: countsBefore } = await client.query(
      `SELECT s.tenant_id, t.name AS tenant_name, COUNT(*) AS count
       FROM students s
       LEFT JOIN tenants t ON t.id = s.tenant_id
       GROUP BY s.tenant_id, t.name
       ORDER BY t.name`
    );
    console.log('── Student counts BEFORE migration ──');
    countsBefore.forEach(r => console.log(`  ${r.tenant_name || '(null)'} [${r.tenant_id}]: ${r.count} student(s)`));
    console.log('');

    let totalMigrated = 0;

    // --------------------------------------------------------
    // 3. For each non-default tenant, identify its admins and
    //    the students that were accidentally put in default.
    // --------------------------------------------------------
    for (const targetTenant of otherTenants) {
      console.log(`\n🔎  Processing tenant: "${targetTenant.name}" (${targetTenant.id})`);

      // All users belonging to this tenant
      const { rows: tenantUsers } = await client.query(
        `SELECT id, email, role FROM users WHERE tenant_id = $1`,
        [targetTenant.id]
      );

      if (tenantUsers.length === 0) {
        console.log('     No users found for this tenant — skipping.');
        continue;
      }
      console.log(`     Users in this tenant: ${tenantUsers.map(u => u.email).join(', ')}`);

      const tenantUserIds = tenantUsers.map(u => u.id);

      // Admission applications created by those users
      const { rows: apps } = await client.query(
        `SELECT id, application_number, child_first_name, child_last_name,
                first_name, last_name, tenant_id, created_at, created_by
         FROM admission_applications
         WHERE created_by = ANY($1::uuid[])`,
        [tenantUserIds]
      );

      console.log(`     Admission applications created by tenant users: ${apps.length}`);

      // Fix admission_applications tenant_id while we're here
      if (!DRY_RUN && apps.length > 0) {
        const appIds = apps.map(a => a.id);
        const { rowCount } = await client.query(
          `UPDATE admission_applications
           SET tenant_id = $1, updated_at = NOW()
           WHERE id = ANY($2::uuid[]) AND (tenant_id IS NULL OR tenant_id != $1)`,
          [targetTenant.id, appIds]
        );
        if (rowCount > 0) {
          console.log(`     ✔  Fixed ${rowCount} admission_application(s) tenant_id → "${targetTenant.name}"`);
        }
      } else if (DRY_RUN && apps.length > 0) {
        const wrongApps = apps.filter(a => a.tenant_id !== targetTenant.id);
        if (wrongApps.length > 0) {
          console.log(`     [DRY RUN] Would fix ${wrongApps.length} admission_application(s) tenant_id`);
        }
      }

      // --------------------------------------------------------
      // 4. Find students in the DEFAULT tenant that belong here.
      //    Match by name against applications created by this tenant's users.
      // --------------------------------------------------------
      const studentsToMove = [];

      for (const app of apps) {
        const firstName = (app.child_first_name || app.first_name || '').trim().toLowerCase();
        const lastName  = (app.child_last_name  || app.last_name  || '').trim().toLowerCase();

        if (!firstName || !lastName) continue;

        const { rows: matches } = await client.query(
          `SELECT id, student_id, first_name, last_name, tenant_id, created_at
           FROM students
           WHERE tenant_id = $1
             AND LOWER(first_name) = $2
             AND LOWER(last_name)  = $3`,
          [defaultTenant.id, firstName, lastName]
        );

        for (const s of matches) {
          if (!studentsToMove.find(x => x.id === s.id)) {
            studentsToMove.push({ ...s, source_app: app.application_number });
          }
        }
      }

      // Also catch students whose linked user account belongs to the correct tenant
      const { rows: extraMatches } = await client.query(
        `SELECT s.id, s.student_id, s.first_name, s.last_name, s.tenant_id, s.created_at
         FROM students s
         INNER JOIN users u ON u.id = s.user_id
         WHERE s.tenant_id = $1
           AND u.tenant_id = $2`,
        [defaultTenant.id, targetTenant.id]
      );
      for (const s of extraMatches) {
        if (!studentsToMove.find(x => x.id === s.id)) {
          studentsToMove.push({ ...s, source_app: 'via user_id link' });
        }
      }

      if (studentsToMove.length === 0) {
        console.log('     No misplaced students found for this tenant.');
        continue;
      }

      console.log(`\n     🎒  Found ${studentsToMove.length} misplaced student(s):`);
      studentsToMove.forEach(s => {
        console.log(`        - ${s.first_name} ${s.last_name} (${s.student_id}) [app: ${s.source_app}]`);
      });

      if (!DRY_RUN) {
        const studentIds = studentsToMove.map(s => s.id);

        // Move the students
        const { rowCount: stuCount } = await client.query(
          `UPDATE students SET tenant_id = $1, updated_at = NOW()
           WHERE id = ANY($2::uuid[])`,
          [targetTenant.id, studentIds]
        );
        console.log(`\n     ✔  Moved ${stuCount} student(s) to "${targetTenant.name}"`);

        // Fix auto-created student user accounts
        const { rowCount: usrCount } = await client.query(
          `UPDATE users u SET tenant_id = $1, updated_at = NOW()
           FROM students s
           WHERE s.id = ANY($2::uuid[])
             AND u.id = s.user_id
             AND u.tenant_id = $3`,
          [targetTenant.id, studentIds, defaultTenant.id]
        );
        if (usrCount > 0) console.log(`     ✔  Fixed ${usrCount} linked student user account(s)`);

        // Fix auto-created parent/guardian accounts (pattern: studentid@parent.school.com)
        let parentFixed = 0;
        for (const s of studentsToMove) {
          const sid = s.student_id.toLowerCase();
          const { rowCount: pCount } = await client.query(
            `UPDATE users SET tenant_id = $1, updated_at = NOW()
             WHERE email IN ($2, $3) AND tenant_id = $4`,
            [targetTenant.id, `${sid}@parent.school.com`, `${sid}@student.school.com`, defaultTenant.id]
          );
          parentFixed += pCount;
        }
        if (parentFixed > 0) console.log(`     ✔  Fixed ${parentFixed} auto-generated parent/student user account(s)`);

        totalMigrated += stuCount;
      } else {
        console.log(`\n     [DRY RUN] Would move ${studentsToMove.length} student(s) + related user accounts`);
      }
    }

    // --------------------------------------------------------
    // 5. Student counts per tenant (after)
    // --------------------------------------------------------
    const { rows: countsAfter } = await client.query(
      `SELECT s.tenant_id, t.name AS tenant_name, COUNT(*) AS count
       FROM students s
       LEFT JOIN tenants t ON t.id = s.tenant_id
       GROUP BY s.tenant_id, t.name
       ORDER BY t.name`
    );
    console.log('\n── Student counts AFTER migration ──');
    countsAfter.forEach(r => console.log(`  ${r.tenant_name || '(null)'} [${r.tenant_id}]: ${r.count} student(s)`));

    console.log(`\n${ DRY_RUN
      ? '🔍  DRY RUN complete — re-run without --dry-run to apply changes'
      : `✅  Migration complete — ${totalMigrated} student(s) reassigned`
    }\n`);

  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('\n❌  Migration failed:', err.message);
  process.exit(1);
});
