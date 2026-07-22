import type { Knex } from 'knex';

/**
 * Tenant-scoped messaging settings: configurable opt-out (STOP) and
 * opt-in (START) keywords, supporting multiple languages per tenant.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('messaging_settings', (table) => {
    table.uuid('settings_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().unique().references('id').inTable('tenants').onDelete('CASCADE');
    table.text('stop_keywords').nullable(); // JSON array of strings, e.g. ["STOP","ARRET"]
    table.text('start_keywords').nullable(); // JSON array of strings, e.g. ["START","UNSTOP"]
    table.string('default_language', 10).nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('messaging_settings');
}
