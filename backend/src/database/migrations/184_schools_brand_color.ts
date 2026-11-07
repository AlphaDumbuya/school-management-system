import type { Knex } from 'knex';

/**
 * schools.brand_color: the school's main colour (#RRGGBB). The app, emails and
 * documents use it as their accent, so renaming or recolouring a school is a
 * Settings change, not a code change. Additive and nullable: a school with no
 * colour set keeps the default blue.
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn('schools', 'brand_color'))) {
    await knex.schema.alterTable('schools', (t) => {
      t.string('brand_color', 7).nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('schools', 'brand_color')) {
    await knex.schema.alterTable('schools', (t) => {
      t.dropColumn('brand_color');
    });
  }
}
