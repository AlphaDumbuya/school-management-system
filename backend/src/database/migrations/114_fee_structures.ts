import type { Knex } from 'knex';

/**
 * Fee-structure configurator (Sierra Leone model).
 *
 * fee_structures: one row per (tenant, class, academic_year) holding the three
 *   term tuitions plus flexible, school-defined payment-policy rules (minimum
 *   percentages for new / continuing students and per-term clearance, etc.).
 * fee_structure_expenses: itemised one-off ACADEMIC-YEAR expenses (Uniform,
 *   Exams levy, ID card, Sport, Development levy…) billed once (in Term 1).
 */
export const config = { transaction: false };

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('fee_structures'))) {
    await knex.schema.createTable('fee_structures', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('tenant_id').notNullable();
      t.uuid('class_id').notNullable();
      t.string('academic_year', 20).notNullable();

      t.decimal('term1_tuition', 12, 2).notNullable().defaultTo(0);
      t.decimal('term2_tuition', 12, 2).notNullable().defaultTo(0);
      t.decimal('term3_tuition', 12, 2).notNullable().defaultTo(0);

      // School-defined payment policy — all optional (null = no rule).
      t.integer('min_percent_new').nullable();          // % a newly-enrolled student must pay
      t.integer('min_percent_continuing').nullable();   // % a continuing student must pay
      t.integer('min_percent_term').nullable();         // min % per term to be cleared
      t.boolean('allow_installments').defaultTo(true);
      t.integer('late_fee_percent').nullable();         // optional surcharge on overdue
      t.text('policy_notes').nullable();

      t.uuid('created_by').nullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());

      t.unique(['tenant_id', 'class_id', 'academic_year']);
      t.index('tenant_id');
      t.index('class_id');
    });
  }

  if (!(await knex.schema.hasTable('fee_structure_expenses'))) {
    await knex.schema.createTable('fee_structure_expenses', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('structure_id').notNullable().references('id').inTable('fee_structures').onDelete('CASCADE');
      t.string('label', 150).notNullable();
      t.decimal('amount', 12, 2).notNullable().defaultTo(0);
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.index('structure_id');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('fee_structure_expenses');
  await knex.schema.dropTableIfExists('fee_structures');
}
