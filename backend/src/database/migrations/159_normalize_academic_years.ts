import type { Knex } from 'knex';

/**
 * Normalize academic-year data to the canonical "YYYY/YYYY" format and reconcile
 * academic_sessions so the year foundation is consistent (Academic Year
 * Architecture — Module 0).
 *
 * Steps (all idempotent, non-destructive to real records):
 *  1. Normalize `academic_sessions.name` hyphen→slash (e.g. 2024-2025 → 2024/2025).
 *  2. Merge duplicate (tenant_id, name) sessions into ONE: repoint child rows
 *     (classes, enrollments) to the kept session, then delete the empty dupes.
 *  3. Collapse to a single active session per tenant (keep newest updated).
 *  4. Normalize year strings in transactional tables to slash format.
 *  5. Backfill active classes that have no session → attach to the tenant's
 *     active session.
 *
 * NOTE: migration 158 added unique/partial indexes; on databases where legacy
 * data pre-dated them those indexes may be absent. We DROP & recreate them at
 * the end so the invariants are guaranteed after cleanup.
 */

const SLASH = (v: any): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d{4}\/\d{4}$/.test(s)) return s;
  const h = /^(\d{4})-(\d{4})$/.exec(s);
  if (h) return `${h[1]}/${h[2]}`;
  const one = /^(\d{4})$/.exec(s);
  if (one) { const y = Number(one[1]); return `${y}/${y + 1}`; }
  return s;
};

export async function up(knex: Knex): Promise<void> {
  const hasSessions = await knex.schema.hasTable('academic_sessions');
  if (!hasSessions) return;

  // Drop the invariant indexes up front so we can safely rewrite names/dupes.
  await knex.raw('DROP INDEX IF EXISTS academic_sessions_one_active_per_tenant');
  await knex.raw('DROP INDEX IF EXISTS academic_sessions_tenant_name_unique');

  // ── 1. Normalize session names to slash format ──────────────────────────────
  const sessions = await knex('academic_sessions').select('id', 'name');
  for (const s of sessions) {
    const norm = SLASH(s.name);
    if (norm && norm !== s.name) {
      await knex('academic_sessions').where({ id: s.id }).update({ name: norm, updated_at: new Date() });
    }
  }

  // ── 2. Merge duplicate (tenant_id, name) sessions ───────────────────────────
  const dups: Array<{ tenant_id: string; name: string }> = await knex('academic_sessions')
    .select('tenant_id', 'name')
    .groupBy('tenant_id', 'name')
    .havingRaw('COUNT(*) > 1');
  for (const d of dups) {
    const rows = await knex('academic_sessions')
      .where({ tenant_id: d.tenant_id, name: d.name })
      .orderBy('updated_at', 'desc');
    const keep = rows[0];
    const drop = rows.slice(1);
    for (const r of drop) {
      // Repoint any child rows that reference the duplicate session.
      await knex('classes').where({ academic_session_id: r.id }).update({ academic_session_id: keep.id }).catch(() => undefined);
      await knex('enrollments').where({ academic_session_id: r.id }).update({ academic_session_id: keep.id }).catch(() => undefined);
      await knex('academic_sessions').where({ id: r.id }).del().catch(() => undefined);
    }
  }

  // ── 3. Collapse to one active session per tenant ────────────────────────────
  const multiActive: Array<{ tenant_id: string }> = await knex('academic_sessions')
    .select('tenant_id')
    .where('is_active', true)
    .groupBy('tenant_id')
    .havingRaw('COUNT(*) > 1');
  for (const m of multiActive) {
    const actives = await knex('academic_sessions')
      .where({ tenant_id: m.tenant_id, is_active: true })
      .orderBy('updated_at', 'desc');
    const deactivate = actives.slice(1).map((r: any) => r.id);
    if (deactivate.length) {
      await knex('academic_sessions').whereIn('id', deactivate).update({ is_active: false, updated_at: new Date() });
    }
  }

  // ── 4. Normalize year strings in transactional tables ───────────────────────
  const yearTables = [
    'sl_subject_results', 'sl_report_publications', 'sl_domain_ratings',
    'sl_term_summaries', 'sl_report_card_meta', 'fees', 'fee_structures',
    'examinations', 'student_promotions',
  ];
  for (const t of yearTables) {
    const has = await knex.schema.hasTable(t);
    if (!has) continue;
    const hasCol = await knex.schema.hasColumn(t, 'academic_year');
    if (!hasCol) continue;
    const rows = await knex(t).distinct('academic_year');
    for (const r of rows) {
      const norm = SLASH(r.academic_year);
      if (norm && norm !== r.academic_year) {
        await knex(t).where({ academic_year: r.academic_year }).update({ academic_year: norm }).catch(() => undefined);
      }
    }
  }

  // ── 5. Backfill active classes with no session → the tenant's active session ─
  const orphanClasses = await knex('classes')
    .whereNull('academic_session_id')
    .where('status', 'active')
    .select('id', 'created_by');
  for (const c of orphanClasses) {
    // Resolve the tenant via the class creator, then its active session.
    const creator = c.created_by ? await knex('users').where({ id: c.created_by }).first('tenant_id') : null;
    const tenantId = creator?.tenant_id;
    if (!tenantId) continue;
    const active = await knex('academic_sessions').where({ tenant_id: tenantId, is_active: true }).orderBy('updated_at', 'desc').first();
    if (active?.id) {
      await knex('classes').where({ id: c.id }).update({ academic_session_id: active.id, updated_at: new Date() }).catch(() => undefined);
    }
  }

  // ── 6. Recreate the invariant indexes (post-cleanup they now hold) ──────────
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS academic_sessions_tenant_name_unique
    ON academic_sessions (tenant_id, name)
  `);
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS academic_sessions_one_active_per_tenant
    ON academic_sessions (tenant_id) WHERE is_active
  `);
}

export async function down(_knex: Knex): Promise<void> {
  // No-op: normalization is not reversible (we don't restore hyphen names or
  // re-split merged sessions). Indexes remain from migration 158/159.
}
