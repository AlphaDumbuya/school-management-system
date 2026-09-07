import type { Knex } from 'knex';

/**
 * Class-scoped announcements.
 *
 * Adds an optional class_id to announcements. When set, the announcement targets
 * only that class's students and their guardians (plus school admins). This lets
 * teachers post to just the classes they teach, rather than the whole school.
 * A null class_id keeps the previous tenant-wide-by-audience behaviour (used by
 * principals/super admins).
 */
export const config = { transaction: false };

export async function up(knex: Knex): Promise<void> {
  const has = await knex.schema.hasColumn('announcements', 'class_id');
  if (!has) {
    await knex.schema.alterTable('announcements', (t) => {
      t.uuid('class_id').nullable();
      t.index(['tenant_id', 'class_id']);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('announcements', 'class_id')) {
    await knex.schema.alterTable('announcements', (t) => t.dropColumn('class_id'));
  }
}
