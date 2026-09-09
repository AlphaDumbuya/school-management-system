import type { Knex } from 'knex';

/**
 * Add EMIS code to the schools table.
 *
 * The EMIS code (MBSSE Education Management Information System school identifier)
 * is captured in School Settings and used to prefill the school-verification flow.
 * Idempotent (guarded) so it's safe to re-run.
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn('schools', 'emis_code'))) {
    await knex.schema.alterTable('schools', (t) => {
      t.string('emis_code', 20).nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('schools', 'emis_code')) {
    await knex.schema.alterTable('schools', (t) => t.dropColumn('emis_code'));
  }
}
