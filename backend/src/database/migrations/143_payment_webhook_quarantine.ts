import type { Knex } from 'knex';

/**
 * Payment webhook quarantine (financial-management spec §7, Req 1.5).
 *
 * When a payment-provider webhook cannot be matched to a payment session (and
 * therefore to a tenant), we must NOT apply any payment. Instead the raw event
 * is stored here for manual review, and the webhook is still acked (HTTP 200) so
 * the provider stops retrying.
 */
export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('payment_webhook_quarantine')) return;

  await knex.schema.createTable('payment_webhook_quarantine', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('provider', 40).notNullable().defaultTo('monime');
    t.jsonb('raw_payload').nullable();
    t.string('reason', 200).notNullable();
    t.boolean('resolved').notNullable().defaultTo(false);
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.index('resolved');
    t.index('created_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('payment_webhook_quarantine');
}
