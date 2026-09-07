import type { Knex } from 'knex';

/**
 * Platform newsletter / marketing.
 *
 * newsletter_subscribers — the marketing list. Consent-aware: auto-added
 *   contacts start 'unsubscribed' and are only marketed to after explicit opt-in.
 * newsletter_campaigns — a log of sent marketing campaigns with delivery counts.
 */
export const config = { transaction: false };

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('newsletter_subscribers'))) {
    await knex.schema.createTable('newsletter_subscribers', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.string('email', 255).notNullable().unique();
      t.string('name', 200).nullable();
      // 'tenant' | 'contact' | 'public' | 'manual'
      t.string('source', 20).notNullable().defaultTo('public');
      t.uuid('tenant_id').nullable();
      // 'subscribed' | 'unsubscribed'
      t.string('status', 20).notNullable().defaultTo('unsubscribed');
      t.string('unsubscribe_token', 64).notNullable().unique();
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      t.timestamp('unsubscribed_at').nullable();
      t.index(['status']);
      t.index(['source']);
    });
  }

  if (!(await knex.schema.hasTable('newsletter_campaigns'))) {
    await knex.schema.createTable('newsletter_campaigns', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('sent_by').notNullable();
      t.string('subject', 300).notNullable();
      t.text('body').notNullable();
      // 'all' | 'tenants' | 'prospects'
      t.string('segment', 20).notNullable().defaultTo('all');
      t.integer('recipients_count').notNullable().defaultTo(0);
      t.integer('delivered_count').notNullable().defaultTo(0);
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      t.index(['created_at']);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('newsletter_campaigns');
  await knex.schema.dropTableIfExists('newsletter_subscribers');
}
