import type { Knex } from 'knex';

/**
 * Migration: Make attendance.class_id nullable
 * This allows attendance to be marked for "All Students" mode without specifying a class
 */
export async function up(knex: Knex): Promise<void> {
  console.log('🔄 Making attendance.class_id nullable...');

  await knex.schema.alterTable('attendance', (table) => {
    // Drop the NOT NULL constraint from class_id
    table.uuid('class_id').nullable().alter();
  });

  console.log('✅ attendance.class_id is now nullable');
}

export async function down(knex: Knex): Promise<void> {
  console.log('🔄 Rolling back: Making attendance.class_id NOT NULL again...');

  // Before making it NOT NULL again, we need to set a default value for any null entries
  // or delete them
  const nullCount = await knex('attendance').whereNull('class_id').count('* as count').first();
  
  if (nullCount && Number(nullCount.count) > 0) {
    console.log(`⚠️  Found ${nullCount.count} attendance records with null class_id`);
    console.log('   These records will need to be handled before rolling back');
    console.log('   Options: Delete them or assign a class_id');
  }

  await knex.schema.alterTable('attendance', (table) => {
    table.uuid('class_id').notNullable().alter();
  });

  console.log('✅ Rolled back: attendance.class_id is now NOT NULL');
}
