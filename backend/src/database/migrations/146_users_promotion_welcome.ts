import type { Knex } from 'knex';

/**
 * One-time "promotion welcome" payload on the user row.
 *
 * When a staff member's designation changes (e.g. promoted to Principal), we
 * store a small JSON blob here ({ role, label, at }). The portal reads it via
 * GET /auth/me, shows a one-time dismissible welcome-and-guide banner, then
 * clears it (set to null) so it only appears once.
 */
export async function up(knex: Knex): Promise<void> {
  const has = await knex.schema.hasColumn('users', 'promotion_welcome');
  if (!has) {
    await knex.schema.alterTable('users', (t) => {
      // Stored as text (JSON string) for portability across PG/other engines.
      t.text('promotion_welcome').nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('users', 'promotion_welcome')) {
    await knex.schema.alterTable('users', (t) => t.dropColumn('promotion_welcome'));
  }
}
