import type { Knex } from 'knex';

/**
 * Add a nullable text_value column to app_stats so we can store string values
 * (e.g. the published APK Blob URL) alongside numeric counters. Idempotent.
 */
export async function up(knex: Knex): Promise<void> {
  const has = await knex.schema.hasTable('app_stats');
  if (!has) return;
  const hasCol = await knex.schema.hasColumn('app_stats', 'text_value');
  if (!hasCol) {
    await knex.schema.alterTable('app_stats', (table) => {
      table.text('text_value').nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const has = await knex.schema.hasTable('app_stats');
  if (!has) return;
  const hasCol = await knex.schema.hasColumn('app_stats', 'text_value');
  if (hasCol) {
    await knex.schema.alterTable('app_stats', (table) => {
      table.dropColumn('text_value');
    });
  }
}
