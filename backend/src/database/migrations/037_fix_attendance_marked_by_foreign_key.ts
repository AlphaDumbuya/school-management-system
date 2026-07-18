import type { Knex } from 'knex';

/**
 * Migration: Fix attendance.marked_by foreign key
 * Change from referencing teachers table to users table
 * This allows any authenticated user (teacher, principal, super_admin) to mark attendance
 */
export async function up(knex: Knex): Promise<void> {
  console.log('🔄 Fixing attendance.marked_by foreign key...');

  await knex.schema.alterTable('attendance', (table) => {
    // Drop the existing foreign key constraint
    table.dropForeign('marked_by');
  });

  await knex.schema.alterTable('attendance', (table) => {
    // Add new foreign key referencing users table
    table.foreign('marked_by').references('id').inTable('users').onDelete('SET NULL');
  });

  console.log('✅ attendance.marked_by now references users table');
}

export async function down(knex: Knex): Promise<void> {
  console.log('🔄 Rolling back: Reverting attendance.marked_by foreign key...');

  await knex.schema.alterTable('attendance', (table) => {
    // Drop the users foreign key
    table.dropForeign('marked_by');
  });

  await knex.schema.alterTable('attendance', (table) => {
    // Restore original foreign key to teachers table
    table.foreign('marked_by').references('id').inTable('teachers');
  });

  console.log('✅ Rolled back: attendance.marked_by references teachers table');
}
