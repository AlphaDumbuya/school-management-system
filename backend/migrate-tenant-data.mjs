/**
 * Tenant Data Migration Script (ESM version)
 * ============================================================
 * Run with:  node migrate-tenant-data.mjs
 * Dry run:   node migrate-tenant-data.mjs --dry-run
 * ============================================================
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually (avoid ESM dotenv quirks)
function loadEnv(envPath) {
  try {
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  } catch (e) {
    console.warn('Could not load .env file:', e.message);
  }
}

loadEnv(resolve(__dirname, '../.env'));
loadEnv(resolve(__dirname, '.env'));

const { Client } = pg;
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
    // 1. List all tenants
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
    const otherTenants  = tenants.slice(1);

    console.log(`\n📌  Default/seed tenant : "${defaultTenant.name}" (${defaultTenant.id})`);
    console.log(`📌  Target tenant(s)    : ${otherTenants.map(t => `"${t.name}"`).join(', ')}\n`);

    // Student counts before
    const { rows: countsBefore } = await client.query(
      `SELECT s.tenant_id, t.name AS tenant_name, COUNT(*) AS count
       FROM students s LEFT JOIN tenants t ON t.id = s.tenant_id
       GROUP BY s.tenant_id, t.name ORDER BY t.name`
    );
    console.log('── Student counts BEFORE ──');
    countsBefore.forEach(r => console.log(`  ${r.tenant_name || '(null)'} [${r.tenant_id}]: ${r.count}`));
    console.log('');

    let totalMigrated = 0;

    for (const targetTenant of otherTenants) {
      console.log(`\n🔎  Tenant: "${targetTenant.name}" (${targetTenant.id})`);

      const { rows: tenantUsers } = await client.query(
        `SELECT id, email, role FROM users WHERE tenant_id = $1`,
        [targetTenant.id]
      );

      if (tenantUsers.length === 0) {
        console.log('     ⚠  No users found — skipping.');
        continue;
      }
      console.log(`     Users: ${tenantUsers.map(u => `${u.email} (${u.role})`).join(', ')}`);

      const tenantUserIds = tenantUsers.map(u => u.id);

      // Find admission applications created by this tenant's users
      const { rows: apps } = await client.query(
        `SELECT id, application_number, child_first_name, child_last_name,
                first_name, last_name, tenant_id, created_at, created_by
         FROM admission_applications
         WHERE created_by = ANY($1::uuid[])`,
        [tenantUserIds]
      );

      console.log(`     Admission applications: ${apps.length}`);

      // Fix admission_applications tenant_id
      if (apps.length > 0) {
        const wrongApps = apps.filter(a => a.tenant_id !== targetTenant.id);
        if (wrongApps.length > 0) {
          if (!DRY_RUN) {
            const appIds = wrongApps.map(a => a.id);
            const { rowCount } = await client.query(
              `UPDATE admission_applications SET tenant_id = $1, updated_at = NOW()
               WHERE id = ANY($2::uuid[])`,
              [targetTenant.id, appIds]
            );
            console.log(`     ✔  Fixed ${rowCount} admission_application tenant_id(s)`);
          } else {
            console.log(`     [DRY RUN] Would fix ${wrongApps.length} admission_application(s) tenant_id`);
          }
        }
      }

      // Find misplaced students (in default tenant but belong here)
      const studentsToMove = [];

      // Method A: name match against applications
      for (const app of apps) {
        const firstName = (app.child_first_name || app.first_name || '').trim().toLowerCase();
        const lastName  = (app.child_last_name  || app.last_name  || '').trim().toLowerCase();
        if (!firstName || !lastName) continue;

        const { rows: matches } = await client.query(
          `SELECT id, student_id, first_name, last_name, tenant_id, user_id
           FROM students
           WHERE tenant_id = $1
             AND LOWER(first_name) = $2
             AND LOWER(last_name)  = $3`,
          [defaultTenant.id, firstName, lastName]
        );
        for (const s of matches) {
          if (!studentsToMove.find(x => x.id === s.id)) {
            studentsToMove.push({ ...s, _source: `app ${app.application_number}` });
          }
        }
      }

      // Method B: student's linked user account already in correct tenant
      const { rows: byUser } = await client.query(
        `SELECT s.id, s.student_id, s.first_name, s.last_name, s.tenant_id, s.user_id
         FROM students s
         INNER JOIN users u ON u.id = s.user_id
         WHERE s.tenant_id = $1 AND u.tenant_id = $2`,
        [defaultTenant.id, targetTenant.id]
      );
      for (const s of byUser) {
        if (!studentsToMove.find(x => x.id === s.id)) {
          studentsToMove.push({ ...s, _source: 'user_id link' });
        }
      }

      if (studentsToMove.length === 0) {
        console.log('     ✓  No misplaced students found.');
        continue;
      }

      console.log(`\n     🎒  Misplaced students (${studentsToMove.length}):`);
      studentsToMove.forEach(s => {
        console.log(`        • ${s.first_name} ${s.last_name} (${s.student_id}) [${s._source}]`);
      });

      if (!DRY_RUN) {
        const studentIds = studentsToMove.map(s => s.id);

        // Move students
        const { rowCount: stuCount } = await client.query(
          `UPDATE students SET tenant_id = $1, updated_at = NOW() WHERE id = ANY($2::uuid[])`,
          [targetTenant.id, studentIds]
        );
        console.log(`\n     ✔  Moved ${stuCount} student(s) → "${targetTenant.name}"`);

        // Fix their linked user accounts (student users)
        const { rowCount: usrCount } = await client.query(
          `UPDATE users SET tenant_id = $1, updated_at = NOW()
           WHERE id IN (
             SELECT user_id FROM students
             WHERE id = ANY($2::uuid[]) AND user_id IS NOT NULL
           ) AND tenant_id = $3`,
          [targetTenant.id, studentIds, defaultTenant.id]
        );
        if (usrCount > 0) console.log(`     ✔  Fixed ${usrCount} student user account(s)`);

        // Fix auto-generated @student.school.com / @parent.school.com accounts
        let ghostFixed = 0;
        for (const s of studentsToMove) {
          const sid = (s.student_id || '').toLowerCase();
          const { rowCount } = await client.query(
            `UPDATE users SET tenant_id = $1, updated_at = NOW()
             WHERE email IN ($2, $3) AND tenant_id = $4`,
            [targetTenant.id,
             `${sid}@student.school.com`,
             `${sid}@parent.school.com`,
             defaultTenant.id]
          );
          ghostFixed += rowCount;
        }
        if (ghostFixed > 0) console.log(`     ✔  Fixed ${ghostFixed} auto-generated ghost account(s)`);

        totalMigrated += stuCount;
      } else {
        console.log(`\n     [DRY RUN] Would move ${studentsToMove.length} student(s) + related user accounts`);
      }
    }

    // Student counts after
    const { rows: countsAfter } = await client.query(
      `SELECT s.tenant_id, t.name AS tenant_name, COUNT(*) AS count
       FROM students s LEFT JOIN tenants t ON t.id = s.tenant_id
       GROUP BY s.tenant_id, t.name ORDER BY t.name`
    );
    console.log('\n── Student counts AFTER ──');
    countsAfter.forEach(r => console.log(`  ${r.tenant_name || '(null)'} [${r.tenant_id}]: ${r.count}`));

    console.log(`\n${DRY_RUN
      ? '🔍  Dry run done. Re-run without --dry-run to apply.'
      : `✅  Done — ${totalMigrated} student(s) migrated.`
    }\n`);

  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('\n❌  Error:', err.message);
  process.exit(1);
});
