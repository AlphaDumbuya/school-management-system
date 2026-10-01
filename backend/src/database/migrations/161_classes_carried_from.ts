import type { Knex } from 'knex';

/**
 * classes.carried_from_id — links a new-year class to the previous-year class
 * it was carried forward from (JSS 3 2027/2028 ← JSS 3 2026/2027).
 *
 * Lets the year rollover be re-run safely (idempotent), lets promotions decided
 * on last year's class land in THIS year's classes, and keeps history intact.
 * Additive: nullable column + index, no data changed.
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn('classes', 'carried_from_id'))) {
    await knex.schema.alterTable('classes', (t) => {
      t.uuid('carried_from_id').nullable().references('id').inTable('classes').onDelete('SET NULL');
      t.index(['carried_from_id'], 'classes_carried_from_idx');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('classes', 'carried_from_id')) {
    await knex.schema.alterTable('classes', (t) => {
      t.dropIndex(['carried_from_id'], 'classes_carried_from_idx');
      t.dropColumn('carried_from_id');
    });
  }
}
