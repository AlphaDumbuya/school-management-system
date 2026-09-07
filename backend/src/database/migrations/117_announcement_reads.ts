import type { Knex } from 'knex';

/**
 * Announcement read receipts — tracks which user has read which announcement.
 * One row per (announcement, user). Absence of a row = unread.
 */
export const config = { transaction: false };

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('announcement_reads'))) {
    await knex.schema.createTable('announcement_reads', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('announcement_id').notNullable();
      t.uuid('user_id').notNullable();
      t.timestamp('read_at').notNullable().defaultTo(knex.fn.now());
      t.unique(['announcement_id', 'user_id']);
      t.index('user_id');
      t.index('announcement_id');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('announcement_reads');
}
