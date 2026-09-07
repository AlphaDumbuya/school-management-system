import type { Knex } from 'knex';

/**
 * Platform communications hub (super admin).
 *
 * platform_messages — inbound messages the platform receives (contact-form
 *   submissions, replies) that form the operator's inbox.
 * platform_broadcasts — outbound announcements/emails the operator sends to
 *   schools, with an audience filter and delivery counts.
 */
export const config = { transaction: false };

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('platform_messages'))) {
    await knex.schema.createTable('platform_messages', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.string('name', 200).notNullable();
      t.string('email', 200).notNullable();
      t.string('phone', 50).nullable();
      t.string('school', 200).nullable();
      t.string('role', 100).nullable();
      t.text('message').notNullable();
      // 'contact' (public form) | 'reply' (from a school) | 'other'
      t.string('source', 30).notNullable().defaultTo('contact');
      t.string('status', 20).notNullable().defaultTo('unread'); // unread | read | archived
      // Optional link to a tenant when the sender is a known school.
      t.uuid('tenant_id').nullable();
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      t.timestamp('read_at').nullable();
      t.index(['status']);
      t.index(['created_at']);
    });
  }

  if (!(await knex.schema.hasTable('platform_broadcasts'))) {
    await knex.schema.createTable('platform_broadcasts', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('sent_by').notNullable();
      t.string('subject', 300).notNullable();
      t.text('body').notNullable();
      // audience: 'all' | 'active' | 'trial' | 'suspended'
      t.string('audience', 30).notNullable().defaultTo('all');
      t.integer('recipients_count').notNullable().defaultTo(0);
      t.integer('delivered_count').notNullable().defaultTo(0);
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      t.index(['created_at']);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('platform_broadcasts');
  await knex.schema.dropTableIfExists('platform_messages');
}
