import type { Knex } from 'knex';

/**
 * House ballot: the houses must stay level. A sibling only follows a brother or
 * sister while the house stays within `level_gap` students of the smallest house.
 * Additive only.
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn('house_settings', 'level_gap'))) {
    await knex.schema.alterTable('house_settings', (t) => {
      t.smallint('level_gap').notNullable().defaultTo(2);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('house_settings', 'level_gap')) {
    await knex.schema.alterTable('house_settings', (t) => { t.dropColumn('level_gap'); });
  }
}
