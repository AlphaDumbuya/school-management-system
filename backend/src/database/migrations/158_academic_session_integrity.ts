import type { Knex } from 'knex';

/**
 * Academic-session integrity — make the "current year" model bullet-proof for
 * multi-decade history.
 *
 * Two DB-level guarantees (previously only enforced in application code):
 *   1. At most ONE active session per tenant  → partial unique index on
 *      (tenant_id) WHERE is_active. Prevents two "current years" from ever
 *      coexisting (which would make new classes bind to an arbitrary session).
 *   2. No duplicate year NAME per tenant       → unique index on (tenant_id, name).
 *      Prevents accidentally creating "2025/2026" twice.
 *
 * Both are ADDITIVE and touch NO historical data (enrollments, grades, results,
 * fees are untouched). Before adding each index we clean up any pre-existing
 * violations so the migration can't fail on legacy data:
 *   - collapse duplicate-named sessions into the newest row (older dupes renamed
 *     with a "(dup <id-prefix>)" suffix so nothing is deleted / history kept),
 *   - keep only the most-recently-updated active session active per tenant.
 */
export async function up(knex: Knex): Promise<void> {
  const has = await knex.schema.hasTable('academic_sessions');
  if (!has) return;

  // ── 1. Resolve duplicate (tenant_id, name) before the unique index ──────────
  // Keep the newest row per (tenant_id, name); rename older duplicates so the
  // unique index can be created without deleting any data.
  const dupNames: Array<{ tenant_id: string; name: string }> = await knex('academic_sessions')
    .select('tenant_id', 'name')
    .groupBy('tenant_id', 'name')
    .havingRaw('COUNT(*) > 1');

  for (const d of dupNames) {
    const rows = await knex('academic_sessions')
      .where({ tenant_id: d.tenant_id, name: d.name })
      .orderBy('updated_at', 'desc');
    // rows[0] keeps the name; the rest get a suffix (data preserved).
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const suffix = String(r.id).slice(0, 8);
      await knex('academic_sessions')
        .where({ id: r.id })
        .update({ name: `${d.name} (dup ${suffix})`, updated_at: new Date() });
    }
  }

  // ── 2. Resolve multiple active sessions before the partial unique index ─────
  // Keep only the most-recently-updated active session active per tenant.
  const multiActive: Array<{ tenant_id: string }> = await knex('academic_sessions')
    .select('tenant_id')
    .where('is_active', true)
    .groupBy('tenant_id')
    .havingRaw('COUNT(*) > 1');

  for (const m of multiActive) {
    const actives = await knex('academic_sessions')
      .where({ tenant_id: m.tenant_id, is_active: true })
      .orderBy('updated_at', 'desc');
    // Deactivate all but the newest.
    const keepId = actives[0]?.id;
    const deactivateIds = actives.slice(1).map((r: any) => r.id);
    if (deactivateIds.length) {
      await knex('academic_sessions')
        .whereIn('id', deactivateIds)
        .update({ is_active: false, updated_at: new Date() });
    }
    void keepId;
  }

  // ── 3. Create the indexes (Postgres). Guarded with IF NOT EXISTS. ───────────
  // Unique name per tenant.
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS academic_sessions_tenant_name_unique
    ON academic_sessions (tenant_id, name)
  `);
  // At most one active session per tenant (partial unique index).
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS academic_sessions_one_active_per_tenant
    ON academic_sessions (tenant_id)
    WHERE is_active
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS academic_sessions_one_active_per_tenant');
  await knex.raw('DROP INDEX IF EXISTS academic_sessions_tenant_name_unique');
  // Renamed dup sessions are intentionally left as-is (no data destruction).
}
