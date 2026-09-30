import type { Knex } from 'knex';

/**
 * Live portal sync — a per-tenant change counter.
 *
 * `tenants.sync_version` is bumped whenever something structural changes for a
 * school (promotion, new academic year, role/status change, enrollment/class
 * change, results published). Open apps poll a tiny endpoint for this number
 * and, when it moves, refetch their data + re-check the user's role — so
 * portals update within seconds without a re-login.
 *
 * Additive and idempotent: one bigint column, default 0. No data touched.
 */
export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('tenants');
  if (!hasTable) return;
  const hasCol = await knex.schema.hasColumn('tenants', 'sync_version');
  if (!hasCol) {
    await knex.schema.alterTable('tenants', (table) => {
      table.bigInteger('sync_version').notNullable().defaultTo(0);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasCol = await knex.schema.hasColumn('tenants', 'sync_version');
  if (hasCol) {
    await knex.schema.alterTable('tenants', (table) => {
      table.dropColumn('sync_version');
    });
  }
}
