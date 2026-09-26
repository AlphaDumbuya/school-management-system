import type { Knex } from 'knex';

/**
 * subscription_payment_sessions — tracks plan-upgrade / subscription checkout
 * sessions.
 *
 * MONEY ROUTING (critical): subscription revenue is the PLATFORM's income, so
 * these payments settle into the PLATFORM's own Monime account (env creds), NOT
 * the school's account. Kept separate from `payment_sessions` (student-fee
 * scoped, requires student_id) and `restore_payment_sessions` (public no-login
 * restore) so each flow stays isolated and auditable.
 *
 * On payment completion the Monime webhook (callbackState "subscription:<id>")
 * applies the plan change via SubscriptionService.changePlan — the plan only
 * activates AFTER money is confirmed collected.
 */
export async function up(knex: Knex): Promise<void> {
  const has = await knex.schema.hasTable('subscription_payment_sessions');
  if (!has) {
    await knex.schema.createTable('subscription_payment_sessions', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('tenant_id').notNullable();
      // The plan the tenant is paying to move to, and the billing cycle.
      t.string('plan_type', 30).notNullable();       // freetong | combra | bintumani
      t.string('billing_cycle', 10).notNullable();   // monthly | yearly
      t.decimal('amount', 12, 2).notNullable();
      t.string('currency', 10).notNullable().defaultTo('SLE');
      t.string('provider', 30).notNullable().defaultTo('monime');
      t.string('provider_session_id', 200).nullable();
      t.text('redirect_url').nullable();
      // pending | completed | failed | cancelled | expired
      t.string('status', 30).notNullable().defaultTo('pending');
      t.uuid('initiated_by').nullable(); // user who started the upgrade
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
      t.index('tenant_id');
      t.index('provider_session_id');
      t.index('status');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('subscription_payment_sessions');
}
