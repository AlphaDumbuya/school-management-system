import type { Knex } from 'knex';

/**
 * 131_timetable_period_configs.ts
 *
 * Stores tenant-scoped, level-specific timetable period configurations so
 * that custom period times are shared across all users/devices within a
 * school, instead of being locked to a single browser's localStorage.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('timetable_period_configs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable();
    table.string('school_level', 20).notNullable(); // nursery | primary | jss | sss
    table.jsonb('periods').notNullable(); // PeriodDefinition[]
    table.boolean('is_active').notNullable().defaultTo(true);
    table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);

    // One config per level per tenant
    table.unique(['tenant_id', 'school_level']);
    table.index(['tenant_id']);

    table.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('timetable_period_configs');
}
