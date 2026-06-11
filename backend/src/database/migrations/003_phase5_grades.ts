import type { Knex } from 'knex';

/**
 * Phase 5 Migration: Grade Management System
 * Creates table for grade recording and management
 */

export async function up(knex: Knex): Promise<void> {
  // Modify grades table if it doesn't have all needed columns
  const hasGradesTable = await knex.schema.hasTable('grades');
  
  if (!hasGradesTable) {
    // Create grades table
    await knex.schema.createTable('grades', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
      table.uuid('subject_id').notNullable().references('id').inTable('subjects').onDelete('CASCADE');
      table.uuid('class_id').notNullable().references('id').inTable('classes').onDelete('CASCADE');
      table.uuid('academic_session_id').notNullable().references('id').inTable('academic_sessions').onDelete('CASCADE');
      
      // Grade data
      table.decimal('grade_value', 5, 2).notNullable(); // 0-100
      table.text('remarks');
      
      // Status and tracking
      table.string('status', 50).defaultTo('pending'); // pending, finalized, deleted
      table.uuid('recorded_by').references('id').inTable('users').onDelete('SET NULL');
      table.uuid('finalized_by').references('id').inTable('users').onDelete('SET NULL');
      
      // Timestamps
      table.timestamp('recorded_at').defaultTo(knex.fn.now());
      table.timestamp('finalized_at');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      // Indexes for performance
      table.index('student_id');
      table.index('subject_id');
      table.index('class_id');
      table.index('academic_session_id');
      table.index('status');
      
      // Composite index to prevent duplicates
      table.unique(['student_id', 'subject_id', 'class_id', 'academic_session_id']);
    });
  } else {
    // Add columns if they don't exist
    const hasFinalized = await knex.schema.hasColumn('grades', 'finalized_by');
    if (!hasFinalized) {
      await knex.schema.table('grades', (table) => {
        table.uuid('finalized_by').references('id').inTable('users').onDelete('SET NULL');
        table.timestamp('finalized_at');
      });
    }
  }

  // Create grade_distributions table for analytics
  const hasGradeDistributions = await knex.schema.hasTable('grade_distributions');
  if (!hasGradeDistributions) {
    await knex.schema.createTable('grade_distributions', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('class_id').notNullable().references('id').inTable('classes').onDelete('CASCADE');
      table.uuid('academic_session_id').notNullable().references('id').inTable('academic_sessions').onDelete('CASCADE');
      
      // Distribution statistics
      table.integer('total_students').defaultTo(0);
      table.integer('total_grades').defaultTo(0);
      table.decimal('average_grade', 5, 2).defaultTo(0);
      table.decimal('highest_grade', 5, 2);
      table.decimal('lowest_grade', 5, 2);
      
      // Grade breakdowns
      table.integer('a_count').defaultTo(0); // 80-100
      table.integer('b_count').defaultTo(0); // 70-79
      table.integer('c_count').defaultTo(0); // 60-69
      table.integer('d_count').defaultTo(0); // 50-59
      table.integer('f_count').defaultTo(0); // Below 50
      
      // Timestamps
      table.timestamp('calculated_at').defaultTo(knex.fn.now());
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      // Indexes
      table.index('class_id');
      table.index('academic_session_id');
      table.unique(['class_id', 'academic_session_id']);
    });
  }

  // Create grading_scale table for configurable grading
  const hasGradingScales = await knex.schema.hasTable('grading_scales');
  if (!hasGradingScales) {
    await knex.schema.createTable('grading_scales', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      
      // Scale definition
      table.string('name', 100).notNullable();
      table.text('description');
      table.boolean('is_default').defaultTo(false);
      
      // Grade breakpoints
      table.jsonb('grades'); // {A: {min: 80, max: 100}, B: {...}}
      
      // Timestamps
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      // Index
      table.index('is_default');
    });
  }

  // Add grading_scale_id to academic_sessions
  const hasSessionColumn = await knex.schema.hasColumn('academic_sessions', 'grading_scale_id');
  if (!hasSessionColumn) {
    await knex.schema.table('academic_sessions', (table) => {
      table.uuid('grading_scale_id').references('id').inTable('grading_scales').onDelete('SET NULL');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop in reverse order
  // Only drop tables created by this migration
  // grades table is created in migration 001, not here - so don't drop it
  
  const hasSessionColumn = await knex.schema.hasColumn('academic_sessions', 'grading_scale_id');
  if (hasSessionColumn) {
    await knex.schema.table('academic_sessions', (table) => {
      table.dropColumn('grading_scale_id');
    });
  }
  
  await knex.schema.dropTableIfExists('grading_scales');
  await knex.schema.dropTableIfExists('grade_distributions');
  // grades table stays - it's created in migration 001
}
