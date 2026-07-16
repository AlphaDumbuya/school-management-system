import type { Knex } from 'knex';

/**
 * Migration: Create examinations table
 * 
 * Examinations are formal assessments scheduled for specific classes,
 * subjects, and time periods. Follows Sierra Leone school structure:
 * - Internal: Mid-Term, End-of-Term, Mock, Promotion
 * - External: NPSE, BECE, WASSCE
 * - Continuous Assessment tracking
 */
export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('examinations');
  if (!exists) {
    await knex.schema.createTable('examinations', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('title', 200).notNullable();
      table.text('description');
      table.string('type', 50).notNullable(); // mid_term, end_of_term, mock, promotion, npse, bece, wassce, continuous_assessment
      table.string('term', 30).notNullable(); // first_term, second_term, third_term
      table.string('academic_year', 20).notNullable(); // e.g. 2025/2026
      table.uuid('class_id').nullable().references('id').inTable('classes').onDelete('SET NULL');
      table.uuid('subject_id').nullable().references('id').inTable('subjects').onDelete('SET NULL');
      table.date('start_date').notNullable();
      table.date('end_date');
      table.integer('total_marks').defaultTo(100);
      table.integer('pass_marks').defaultTo(40);
      table.integer('duration_minutes').defaultTo(120); // exam duration
      table.string('venue', 200);
      table.string('status', 30).notNullable().defaultTo('scheduled'); // scheduled, ongoing, completed, cancelled
      table.text('instructions');
      table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index('type');
      table.index('term');
      table.index('academic_year');
      table.index('class_id');
      table.index('status');
      table.index('start_date');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('examinations');
}
