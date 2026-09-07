import type { Knex } from 'knex';

/**
 * Announcements — tenant-scoped school announcements posted by principals/teachers.
 *
 * A row targets an audience (all, or a specific role) within the tenant. It is
 * shown in-app to matching users. Delivery/email is best-effort at post time.
 */
export const config = { transaction: false };

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('announcements'))) {
    await knex.schema.createTable('announcements', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('tenant_id').notNullable();
      t.uuid('author_id').notNullable();
      t.string('title', 200).notNullable();
      t.text('body').notNullable();
      // Audience: 'all' | 'teacher' | 'student' | 'parent' | 'accountant' | 'admissions_officer'
      t.string('audience', 40).notNullable().defaultTo('all');
      // Priority: 'normal' | 'high'
      t.string('priority', 20).notNullable().defaultTo('normal');
      t.boolean('email_sent').notNullable().defaultTo(false);
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
      t.index('tenant_id');
      t.index(['tenant_id', 'audience']);
      t.index(['tenant_id', 'created_at']);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('announcements');
}
