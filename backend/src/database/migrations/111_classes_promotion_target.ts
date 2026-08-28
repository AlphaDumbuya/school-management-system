import type { Knex } from 'knex';

/**
 * Class promotion target
 * ======================
 * Adds the mapping needed for AUTOMATIC promotion:
 *   - next_class_id: the class students are promoted INTO when they pass.
 *   - is_final_year: when true, passing students GRADUATE (no next class).
 * With this mapping, publishing final results can auto-upgrade each passing
 * student's class without manual target selection.
 */
export async function up(knex: Knex): Promise<void> {
  const hasNext = await knex.schema.hasColumn('classes', 'next_class_id');
  const hasFinal = await knex.schema.hasColumn('classes', 'is_final_year');

  if (!hasNext || !hasFinal) {
    await knex.schema.alterTable('classes', (table) => {
      if (!hasNext) {
        table.uuid('next_class_id').references('id').inTable('classes').onDelete('SET NULL');
      }
      if (!hasFinal) {
        table.boolean('is_final_year').notNullable().defaultTo(false);
      }
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasNext = await knex.schema.hasColumn('classes', 'next_class_id');
  const hasFinal = await knex.schema.hasColumn('classes', 'is_final_year');
  await knex.schema.alterTable('classes', (table) => {
    if (hasNext) table.dropColumn('next_class_id');
    if (hasFinal) table.dropColumn('is_final_year');
  });
}
