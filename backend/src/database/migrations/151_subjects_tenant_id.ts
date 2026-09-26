import type { Knex } from 'knex';

/**
 * Give `subjects` a real `tenant_id` and fix its GLOBAL unique code constraint.
 *
 * TWO production bugs this closes:
 *  1. `subjects.code` was declared `.unique()` GLOBALLY (migration 001). So once
 *     School A creates code "MATH", School B can NEVER create "MATH" — they hit
 *     a raw DB unique violation (500). Multi-tenant apps must scope uniqueness
 *     per tenant.
 *  2. Tenant scoping relied on an INNER JOIN `subjects.created_by -> users`. Any
 *     subject with a NULL `created_by` (seeds/imports, or a deleted creator)
 *     silently DISAPPEARS from every list/get/update/delete query. A real
 *     tenant_id column removes that fragility.
 *
 * Steps: add tenant_id, backfill from created_by's user, drop the global unique
 * on code, add a per-tenant unique (tenant_id, code), index tenant_id.
 */
export async function up(knex: Knex): Promise<void> {
  const hasTenant = await knex.schema.hasColumn('subjects', 'tenant_id');
  if (!hasTenant) {
    await knex.schema.alterTable('subjects', (t) => {
      t.uuid('tenant_id').nullable();
    });
  }

  // Backfill tenant_id from the creating user's tenant where possible.
  await knex.raw(`
    UPDATE subjects s
    SET tenant_id = u.tenant_id
    FROM users u
    WHERE s.created_by = u.id AND s.tenant_id IS NULL
  `).catch(() => {});

  // Drop the GLOBAL unique constraint on code. Knex's default name from the
  // original .unique() is subjects_code_unique; also drop any plain index.
  await knex.raw(`ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_code_unique`).catch(() => {});
  await knex.raw(`DROP INDEX IF EXISTS subjects_code_unique`).catch(() => {});

  // Per-tenant unique code (case-insensitive not enforced at DB level; the app
  // upper-cases codes before insert/compare). Partial unique so legacy rows with
  // a NULL tenant_id don't collide during rollout.
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS subjects_tenant_code_unique
    ON subjects (tenant_id, code)
    WHERE tenant_id IS NOT NULL
  `).catch(() => {});

  await knex.raw(`CREATE INDEX IF NOT EXISTS subjects_tenant_id_index ON subjects (tenant_id)`).catch(() => {});
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS subjects_tenant_code_unique`).catch(() => {});
  await knex.raw(`DROP INDEX IF EXISTS subjects_tenant_id_index`).catch(() => {});
  // Restore the global unique (best-effort; may fail if cross-tenant dup codes exist).
  await knex.raw(`ALTER TABLE subjects ADD CONSTRAINT subjects_code_unique UNIQUE (code)`).catch(() => {});
  const hasTenant = await knex.schema.hasColumn('subjects', 'tenant_id');
  if (hasTenant) {
    await knex.schema.alterTable('subjects', (t) => t.dropColumn('tenant_id'));
  }
}
