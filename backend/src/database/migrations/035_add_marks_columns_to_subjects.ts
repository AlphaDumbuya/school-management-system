import type { Knex } from 'knex';

/**
 * Migration: Add max_marks and pass_marks to 'subjects' table
 */
export async function up(knex: Knex): Promise<void> {
  const hasMaxMarks = await knex.schema.hasColumn('subjects', 'max_marks');
  const hasPassMarks = await knex.schema.hasColumn('subjects', 'pass_marks');

  await knex.schema.alterTable('subjects', (table) => {
    if (!hasMaxMarks) {
      table.integer('max_marks').notNullable().defaultTo(100);
    }
    if (!hasPassMarks) {
      table.integer('pass_marks').notNullable().defaultTo(40);
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  const hasMaxMarks = await knex.schema.hasColumn('subjects', 'max_marks');
  const hasPassMarks = await knex.schema.hasColumn('subjects', 'pass_marks');

  await knex.schema.alterTable('subjects', (table) => {
    if (hasMaxMarks) table.dropColumn('max_marks');
    if (hasPassMarks) table.dropColumn('pass_marks');
  });
}
