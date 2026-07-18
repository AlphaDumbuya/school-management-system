import type { Knex } from 'knex';

/**
 * Migration: Enhance attendance system with sessions and time tracking
 * - Add session types (morning, afternoon)
 * - Add check_in_time and check_out_time
 * - Add unique constraints for daily attendance
 */
export async function up(knex: Knex): Promise<void> {
  console.log('🔄 Enhancing attendance system...');

  // Add new columns to attendance table
  await knex.schema.alterTable('attendance', (table) => {
    // Add session type for multiple daily sessions
    table.string('session_type', 20).defaultTo('full_day'); // 'morning', 'afternoon', 'full_day'
    
    // Add time tracking
    table.time('check_in_time').nullable(); // When student arrived
    table.time('check_out_time').nullable(); // When student left
    
    // Add marked_at timestamp for tracking when attendance was marked
    table.timestamp('marked_at').defaultTo(knex.fn.now());
    
    // Add index for session type
    table.index('session_type');
  });

  // Create unique constraint to prevent duplicate attendance records per student per day per session
  try {
    await knex.schema.alterTable('attendance', (table) => {
      table.unique(['student_id', 'attendance_date', 'session_type'], 'unique_student_daily_session_attendance');
    });
  } catch (error) {
    console.log('Note: Unique constraint may already exist or there might be duplicate data');
  }

  console.log('✅ Enhanced attendance system migration complete');
}

export async function down(knex: Knex): Promise<void> {
  console.log('🔄 Rolling back attendance system enhancements...');

  // Drop the unique constraint
  try {
    await knex.schema.alterTable('attendance', (table) => {
      table.dropUnique(['student_id', 'attendance_date', 'session_type'], 'unique_student_daily_session_attendance');
    });
  } catch (error) {
    console.log('Note: Unique constraint might not exist');
  }

  // Remove the added columns
  await knex.schema.alterTable('attendance', (table) => {
    table.dropColumn('session_type');
    table.dropColumn('check_in_time');
    table.dropColumn('check_out_time');
    table.dropColumn('marked_at');
  });

  console.log('✅ Rolled back attendance system enhancements');
}