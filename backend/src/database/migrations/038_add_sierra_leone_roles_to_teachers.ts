import type { Knex } from 'knex';

/**
 * Migration: Add Sierra Leone school role structural fields to teachers table
 * Fields added: designation, department, employment_type
 */
export async function up(knex: Knex): Promise<void> {
  console.log('🔄 Adding Sierra Leone roles fields to teachers table...');

  await knex.schema.alterTable('teachers', (table) => {
    table.string('designation', 100).nullable().defaultTo('subject_teacher');
    table.string('department', 100).nullable().defaultTo('none');
    table.string('employment_type', 100).nullable().defaultTo('full_time');
  });

  console.log('✅ Added designation, department, and employment_type to teachers');
}

export async function down(knex: Knex): Promise<void> {
  console.log('🔄 Rolling back: Removing Sierra Leone roles fields...');

  await knex.schema.alterTable('teachers', (table) => {
    table.dropColumn('designation');
    table.dropColumn('department');
    table.dropColumn('employment_type');
  });

  console.log('✅ Reverted teachers table schema');
}
