import type { Knex } from 'knex';

/**
 * Add `motto` column to the `schools` table.
 * Previously motto was stored in school_config_settings as a workaround;
 * now it's a first-class column on schools.
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn('schools', 'motto'))) {
    await knex.schema.alterTable('schools', (table) => {
      table.text('motto').nullable();
    });
  }

  // Migrate any existing motto from school_config_settings into the new column
  try {
    const settings = await knex('school_config_settings')
      .where('setting_key', 'motto')
      .select('school_id', 'setting_value');

    for (const s of settings) {
      if (s.setting_value) {
        const school = await knex('schools').where({ school_id: s.school_id }).first();
        if (school) {
          await knex('schools').where({ tenant_id: school.tenant_id }).update({ motto: s.setting_value });
        }
      }
    }
  } catch {
    // school_config_settings table may not exist — no-op
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('schools', 'motto')) {
    await knex.schema.alterTable('schools', (table) => {
      table.dropColumn('motto');
    });
  }
}
