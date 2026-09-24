import type { Knex } from 'knex';

/**
 * School operating-expense tracking (financial-management spec §3, Req 7).
 *
 * Distinct from `fee_structure_expenses` (which are charges billed TO students).
 * These are the school's own operating costs (salaries, utilities, supplies…),
 * tracked per academic year and optional term, tenant-scoped. `amount` and
 * `category` are NOT NULL so a persisted expense always carries them regardless
 * of the actor (Req 7.1).
 */
export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('school_expenses')) return;

  await knex.schema.createTable('school_expenses', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('category', 100).notNullable();
    t.text('description').nullable();
    t.decimal('amount', 12, 2).notNullable();
    t.date('expense_date').notNullable();
    t.string('academic_year', 20).notNullable();
    t.string('term', 30).nullable(); // first_term | second_term | third_term | null (year-level)
    t.uuid('recorded_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());

    t.index(['tenant_id', 'academic_year'], 'school_expenses_tenant_year_idx');
    t.index(['tenant_id', 'term'], 'school_expenses_tenant_term_idx');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('school_expenses');
}
