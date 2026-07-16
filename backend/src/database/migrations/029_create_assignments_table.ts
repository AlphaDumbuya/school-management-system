import type { Knex } from 'knex';

/**
 * Migration: Create assignments table
 * 
 * Assignments are tasks given by teachers to students for a specific
 * class and subject, with due dates and submission tracking.
 */
export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('assignments');
  if (!exists) {
    await knex.schema.createTable('assignments', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('title', 200).notNullable();
      table.text('description');
      table.uuid('class_id').notNullable().references('id').inTable('classes').onDelete('CASCADE');
      table.uuid('subject_id').notNullable().references('id').inTable('subjects').onDelete('CASCADE');
      table.uuid('teacher_id').notNullable().references('id').inTable('teachers').onDelete('CASCADE');
      table.string('type', 50).notNullable().defaultTo('homework'); // homework, classwork, project, test, quiz
      table.date('assigned_date').notNullable();
      table.date('due_date').notNullable();
      table.integer('max_marks').defaultTo(100);
      table.string('status', 30).notNullable().defaultTo('active'); // active, closed, draft
      table.text('instructions');
      table.text('resources'); // JSON array of resource URLs/names
      table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index('class_id');
      table.index('subject_id');
      table.index('teacher_id');
      table.index('status');
      table.index('due_date');
    });
  }

  // Submissions table — tracks student submissions per assignment
  const submissionsExist = await knex.schema.hasTable('assignment_submissions');
  if (!submissionsExist) {
    await knex.schema.createTable('assignment_submissions', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('assignment_id').notNullable().references('id').inTable('assignments').onDelete('CASCADE');
      table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
      table.string('status', 30).notNullable().defaultTo('pending'); // pending, submitted, graded, late
      table.text('submission_text');
      table.text('file_urls'); // JSON array
      table.timestamp('submitted_at');
      table.integer('marks_obtained');
      table.text('teacher_feedback');
      table.uuid('graded_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('graded_at');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.unique(['assignment_id', 'student_id']);
      table.index('assignment_id');
      table.index('student_id');
      table.index('status');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('assignment_submissions');
  await knex.schema.dropTableIfExists('assignments');
}
