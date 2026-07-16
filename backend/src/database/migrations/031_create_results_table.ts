import type { Knex } from 'knex';

/**
 * Migration: Create results table for Sierra Leone internal school grading
 * 
 * Structure: CA (30%) + Exam (70%) = Total (100%)
 * Grade letters: A (75-100), B (65-74), C (50-64), D (40-49), E (30-39), F (0-29)
 */
export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('results');
  if (!exists) {
    await knex.schema.createTable('results', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
      table.uuid('subject_id').notNullable().references('id').inTable('subjects').onDelete('CASCADE');
      table.uuid('class_id').notNullable().references('id').inTable('classes').onDelete('CASCADE');
      table.uuid('examination_id').nullable().references('id').inTable('examinations').onDelete('SET NULL');
      table.string('academic_year', 20).notNullable(); // e.g. 2025/2026
      table.string('term', 30).notNullable(); // first_term, second_term, third_term
      table.decimal('ca_score', 5, 2).notNullable().defaultTo(0); // out of 30
      table.decimal('exam_score', 5, 2).notNullable().defaultTo(0); // out of 70
      table.decimal('total_score', 5, 2).notNullable().defaultTo(0); // out of 100
      table.string('grade_letter', 5).notNullable(); // A, B, C, D, E, F
      table.string('remark', 50).notNullable(); // Excellent, Very Good, etc.
      table.integer('position'); // Class position for this subject
      table.uuid('entered_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      // Prevent duplicate entries
      table.unique(['student_id', 'subject_id', 'class_id', 'term', 'academic_year']);
      
      table.index('student_id');
      table.index('subject_id');
      table.index('class_id');
      table.index('term');
      table.index('academic_year');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('results');
}
