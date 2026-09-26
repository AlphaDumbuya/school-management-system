import type { Knex } from 'knex';

/**
 * Row-Level Security (RLS) — defence-in-depth tenant isolation at the DATABASE
 * layer, so a forgotten application-layer `WHERE tenant_id = ?` can no longer
 * leak one school's data to another.
 *
 * DESIGN — SAFE, INCREMENTAL ROLLOUT:
 *  - We discover every table that actually has a `tenant_id` column from the
 *    catalog (self-correcting; no hand-maintained list to drift).
 *  - We ENABLE + FORCE RLS on each (FORCE so the table owner is also subject to
 *    the policy — Neon connects as the owner).
 *  - The policy is intentionally BACKWARD-COMPATIBLE:
 *        USING (
 *          current_setting('app.current_tenant', true) IS NULL
 *          OR current_setting('app.current_tenant', true) = ''
 *          OR tenant_id::text = current_setting('app.current_tenant', true)
 *          OR tenant_id IS NULL
 *        )
 *    i.e. when the session variable is unset (every query not yet routed
 *    through withTenant), access is unchanged. Isolation only kicks in for
 *    connections that set app.current_tenant. This lets us adopt withTenant
 *    route-by-route with ZERO risk of a query suddenly returning nothing.
 *  - Rows with NULL tenant_id (public admissions, platform rows) stay visible.
 *
 * A LATER migration can drop the "IS NULL/empty" escape once every hot path
 * sets the variable, turning this into hard enforcement.
 */

const POLICY = 'tenant_isolation';

async function tenantScopedTables(knex: Knex): Promise<string[]> {
  const rows = await knex.raw(`
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_name = c.table_name AND t.table_schema = c.table_schema
    WHERE c.column_name = 'tenant_id'
      AND c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name <> 'tenants'
    ORDER BY c.table_name
  `);
  return (rows.rows ?? rows).map((r: any) => r.table_name);
}

export async function up(knex: Knex): Promise<void> {
  const tables = await tenantScopedTables(knex);

  for (const table of tables) {
    try {
      await knex.raw(`ALTER TABLE ??  ENABLE ROW LEVEL SECURITY`, [table]);
      await knex.raw(`ALTER TABLE ??  FORCE  ROW LEVEL SECURITY`, [table]);

      // Recreate the policy idempotently.
      await knex.raw(`DROP POLICY IF EXISTS ${POLICY} ON ??`, [table]);
      await knex.raw(
        `
        CREATE POLICY ${POLICY} ON ??
        USING (
          current_setting('app.current_tenant', true) IS NULL
          OR current_setting('app.current_tenant', true) = ''
          OR tenant_id IS NULL
          OR tenant_id::text = current_setting('app.current_tenant', true)
        )
        WITH CHECK (
          current_setting('app.current_tenant', true) IS NULL
          OR current_setting('app.current_tenant', true) = ''
          OR tenant_id IS NULL
          OR tenant_id::text = current_setting('app.current_tenant', true)
        )
        `,
        [table]
      );
    } catch (e) {
      // Never fail the whole migration on one table (e.g. a view or an odd
      // tenant_id type); log via the raised order and continue.
      // eslint-disable-next-line no-console
      console.warn(`RLS: skipped table ${table}: ${(e as Error).message}`);
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  const tables = await tenantScopedTables(knex);
  for (const table of tables) {
    try {
      await knex.raw(`DROP POLICY IF EXISTS ${POLICY} ON ??`, [table]);
      await knex.raw(`ALTER TABLE ??  NO FORCE ROW LEVEL SECURITY`, [table]);
      await knex.raw(`ALTER TABLE ??  DISABLE ROW LEVEL SECURITY`, [table]);
    } catch {
      /* ignore */
    }
  }
}
