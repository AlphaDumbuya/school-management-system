import type { Knex } from 'knex';

/**
 * step_up_codes: one-time codes emailed to a school owner to confirm a
 * sensitive change (where the school's fee money goes), as a second check on
 * top of the password when the owner has no authenticator app set up.
 *
 * Additive only. Codes are never stored in clear: code_hash is a keyed hash.
 * A code expires after a few minutes, allows a few attempts, and is consumed
 * on first successful use. Old rows are harmless and can be pruned any time.
 */
export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('step_up_codes')) return;
  await knex.schema.createTable('step_up_codes', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.uuid('tenant_id').nullable();
    t.string('purpose', 40).notNullable(); // e.g. 'payment_settings'
    t.string('code_hash', 128).notNullable();
    t.timestamp('expires_at', { useTz: true }).notNullable();
    t.smallint('attempts').notNullable().defaultTo(0);
    t.timestamp('consumed_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.raw('CREATE INDEX IF NOT EXISTS step_up_codes_user_purpose_idx ON step_up_codes (user_id, purpose, created_at DESC)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('step_up_codes');
}
