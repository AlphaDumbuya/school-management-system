import type { Knex } from 'knex';

/**
 * subscriptions.is_trial — marks a promotional trial subscription.
 *
 * New schools get a time-boxed Bintumani (top-plan) trial so they can explore
 * every V1 feature. When a TRIAL subscription reaches its end date, the tenant
 * is gracefully DOWNGRADED to Freetong (never locked out) — unlike a paid
 * subscription which expires and requires renewal/payment to restore access.
 * This flag lets the expiry sweep tell the two cases apart.
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn('subscriptions', 'is_trial'))) {
    await knex.schema.alterTable('subscriptions', (t) => {
      t.boolean('is_trial').notNullable().defaultTo(false);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('subscriptions', 'is_trial')) {
    await knex.schema.alterTable('subscriptions', (t) => t.dropColumn('is_trial'));
  }
}
