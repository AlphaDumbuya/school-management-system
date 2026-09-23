import type { Knex } from 'knex';

/**
 * Migration: add `username` to users.
 *
 * Students log in with their student ID number (reg_id) as a username instead
 * of an email. Username is tenant-scoped unique (two schools can each have a
 * student "STU001"). Email remains for parents/staff and stays unique globally
 * as before. Login accepts either a username or an email.
 */
export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('users', 'username');
  if (!hasColumn) {
    await knex.schema.alterTable('users', (table) => {
      table.string('username', 100).nullable();
    });
    // Tenant-scoped unique index (partial: only where username is set).
    await knex.raw(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_tenant_username_unique
      ON users (tenant_id, lower(username))
      WHERE username IS NOT NULL
    `);
    // Fast lookup on login.
    await knex.raw(`
      CREATE INDEX IF NOT EXISTS users_username_idx
      ON users (lower(username))
      WHERE username IS NOT NULL
    `);
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS users_tenant_username_unique');
  await knex.raw('DROP INDEX IF EXISTS users_username_idx');
  const hasColumn = await knex.schema.hasColumn('users', 'username');
  if (hasColumn) {
    await knex.schema.alterTable('users', (table) => {
      table.dropColumn('username');
    });
  }
}
