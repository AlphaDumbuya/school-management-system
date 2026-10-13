import type { Knex } from 'knex';

/**
 * users.is_owner: marks the school owner (proprietor), the top of the chain
 * (owner > principal > other staff). An owner is a `principal` account that
 * also holds the owner-only items: subscription and billing, the school's
 * payment (Monime) settings, backups, school verification, and creating or
 * removing principals.
 *
 * Additive and safe for existing schools: nobody is flagged by this migration.
 * A school with no owner account behaves exactly as before (its principals act
 * as owners) until an owner is named.
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn('users', 'is_owner'))) {
    await knex.schema.alterTable('users', (t) => {
      t.boolean('is_owner').notNullable().defaultTo(false);
    });
  }
  // Fast "does this school have an owner yet?" lookups.
  await knex.raw(
    'CREATE INDEX IF NOT EXISTS users_tenant_owner_idx ON users (tenant_id) WHERE is_owner = true'
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS users_tenant_owner_idx');
  if (await knex.schema.hasColumn('users', 'is_owner')) {
    await knex.schema.alterTable('users', (t) => t.dropColumn('is_owner'));
  }
}
