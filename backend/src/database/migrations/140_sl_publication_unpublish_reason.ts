import type { Knex } from 'knex';

/**
 * Adds an `unpublish_reason` column to sl_report_publications so that when a
 * principal pulls back (unreleases) a class's report cards, they can record a
 * reason. The reason is surfaced to parents/students in the release
 * notification so they understand why previously visible results were withdrawn.
 */
export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('sl_report_publications');
  if (!hasTable) return;

  const hasColumn = await knex.schema.hasColumn('sl_report_publications', 'unpublish_reason');
  if (!hasColumn) {
    await knex.schema.alterTable('sl_report_publications', (table) => {
      table.text('unpublish_reason');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('sl_report_publications');
  if (!hasTable) return;

  const hasColumn = await knex.schema.hasColumn('sl_report_publications', 'unpublish_reason');
  if (hasColumn) {
    await knex.schema.alterTable('sl_report_publications', (table) => {
      table.dropColumn('unpublish_reason');
    });
  }
}
