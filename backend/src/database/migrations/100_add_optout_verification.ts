import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.table('sms_whatsapp_opt_outs', (table) => {
    table.string('verification_code', 20).nullable();
    table.timestamp('verification_expires_at').nullable();
    table.timestamp('verified_at').nullable();
    table.uuid('verified_by').nullable().references('id').inTable('users');
    table.timestamp('expires_at').nullable(); // optional opt-out expiry
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('sms_whatsapp_opt_outs', (table) => {
    table.dropColumn('verification_code');
    table.dropColumn('verification_expires_at');
    table.dropColumn('verified_at');
    table.dropColumn('verified_by');
    table.dropColumn('expires_at');
  });
}
