import type { Knex } from 'knex';

/**
 * restore_payment_sessions — tracks "pay to restore access" checkout sessions for
 * suspended tenants paying WITHOUT logging in (public restore flow). Kept
 * separate from `payment_sessions` (which is student-fee scoped and requires a
 * student_id) so we don't overload that table or loosen its constraints.
 */
export async function up(knex: Knex): Promise<void> {
  const has = await knex.schema.hasTable('restore_payment_sessions');
  if (!has) {
    await knex.schema.createTable('restore_payment_sessions', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('tenant_id').notNullable();
      t.decimal('amount', 12, 2).notNullable();
      t.string('currency', 10).notNullable().defaultTo('SLE');
      t.string('provider', 30).notNullable().defaultTo('monime');
      t.string('provider_session_id', 200).nullable();
      t.text('redirect_url').nullable();
      // pending | completed | failed | cancelled | expired
      t.string('status', 30).notNullable().defaultTo('pending');
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
      t.index('tenant_id');
      t.index('provider_session_id');
      t.index('status');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('restore_payment_sessions');
}
