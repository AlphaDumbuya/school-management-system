import type { Knex } from 'knex';

/**
 * Migration: Add temp_password to users table to persist temporary credentials for admins to view
 */
export async function up(knex: Knex): Promise<void> {
  console.log('🔄 Adding temp_password column to users table...');
  const hasColumn = await knex.schema.hasColumn('users', 'temp_password');
  if (!hasColumn) {
    await knex.schema.alterTable('users', (table) => {
      table.string('temp_password', 255).nullable();
    });
  }
  console.log('✅ Added temp_password column to users table');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('temp_password');
  });
}
