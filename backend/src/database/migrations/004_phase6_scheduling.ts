import type { Knex } from 'knex';

/**
 * Phase 6 Migration: Class Scheduling System
 */

export async function up(knex: Knex): Promise<void> {
  // Schedules table already created in migration 001, but enhance it with additional columns if needed
  if (await knex.schema.hasTable('schedules')) {
    // Add new columns to existing schedules table if they don't exist
    const hasAcademicSessionIdColumn = await knex.schema.hasColumn('schedules', 'academic_session_id');
    const hasIsPublishedColumn = await knex.schema.hasColumn('schedules', 'is_published');
    const hasPublishedByColumn = await knex.schema.hasColumn('schedules', 'published_by');
    const hasPublishedAtColumn = await knex.schema.hasColumn('schedules', 'published_at');
    const hasCreatedByColumn = await knex.schema.hasColumn('schedules', 'created_by');
    const hasDayOfWeekIntColumn = await knex.schema.hasColumn('schedules', 'day_of_week');

    if (!hasAcademicSessionIdColumn || !hasIsPublishedColumn || !hasPublishedByColumn || !hasPublishedAtColumn || !hasCreatedByColumn) {
      await knex.schema.table('schedules', (table) => {
        if (!hasAcademicSessionIdColumn) {
          table.uuid('academic_session_id').notNullable().references('id').inTable('academic_sessions').onDelete('CASCADE');
        }
        if (!hasIsPublishedColumn) {
          table.boolean('is_published').defaultTo(false);
        }
        if (!hasPublishedByColumn) {
          table.uuid('published_by').references('id').inTable('users').onDelete('SET NULL');
        }
        if (!hasPublishedAtColumn) {
          table.timestamp('published_at');
        }
        if (!hasCreatedByColumn) {
          table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
        }
      });
    }

    // Add index for academic_session_id if not exists
    const indexes = await knex.raw(`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'schedules' AND indexname = 'schedules_academic_session_id_index'
    `);
    if (!indexes.rows || indexes.rows.length === 0) {
      await knex.schema.table('schedules', (table) => {
        table.index('academic_session_id');
      });
    }
  }

  // Create schedule_changes table for audit trail
  const hasScheduleChanges = await knex.schema.hasTable('schedule_changes');
  if (!hasScheduleChanges) {
    await knex.schema.createTable('schedule_changes', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('schedule_id').notNullable().references('id').inTable('schedules').onDelete('CASCADE');
      
      // Change details
      table.string('change_type', 50).notNullable(); // creation, modification, deletion, publication
      table.jsonb('old_values');
      table.jsonb('new_values');
      table.text('reason');
      
      // Who made the change
      table.uuid('changed_by').references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('changed_at').defaultTo(knex.fn.now());
      
      // Indexes
      table.index('schedule_id');
      table.index('changed_by');
      table.index('changed_at');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // Only drop tables created in this migration (schedule_changes)
  // schedules table was created in migration 001, not here
  await knex.schema.dropTableIfExists('schedule_changes');
}
