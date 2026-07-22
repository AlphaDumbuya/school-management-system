import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('sms_whatsapp_providers', table => {
    table.text('api_key').nullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex('sms_whatsapp_providers')
    .whereNull('api_key')
    .update({ api_key: '' });

  await knex.schema.alterTable('sms_whatsapp_providers', table => {
    table.text('api_key').notNullable().alter();
  });
}