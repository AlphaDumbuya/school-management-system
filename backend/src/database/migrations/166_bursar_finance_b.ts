import type { Knex } from 'knex';

/**
 * Bursar finance Phase B (.kiro/specs/bursar-finance-phase-b). Additive only:
 * richer expenses (void instead of delete, source links), petty cash, budgets,
 * payroll (pay profiles, runs, payslips).
 */
export async function up(knex: Knex): Promise<void> {
  const addCol = async (table: string, col: string, fn: (t: Knex.AlterTableBuilder) => void) => {
    if (!(await knex.schema.hasColumn(table, col))) await knex.schema.alterTable(table, fn);
  };
  await addCol('school_expenses', 'vendor', (t) => { t.string('vendor', 150).nullable(); });
  await addCol('school_expenses', 'payment_method', (t) => { t.string('payment_method', 30).nullable(); });
  await addCol('school_expenses', 'reference', (t) => { t.string('reference', 100).nullable(); });
  await addCol('school_expenses', 'receipt_url', (t) => { t.text('receipt_url').nullable(); });
  await addCol('school_expenses', 'department', (t) => { t.string('department', 100).nullable(); });
  await addCol('school_expenses', 'source', (t) => { t.string('source', 20).notNullable().defaultTo('manual'); });
  await addCol('school_expenses', 'source_id', (t) => { t.uuid('source_id').nullable(); });
  await addCol('school_expenses', 'voided_at', (t) => { t.timestamp('voided_at', { useTz: true }).nullable(); });
  await addCol('school_expenses', 'voided_by', (t) => { t.uuid('voided_by').nullable(); });
  await addCol('school_expenses', 'void_reason', (t) => { t.text('void_reason').nullable(); });

  if (!(await knex.schema.hasTable('petty_cash_funds'))) {
    await knex.schema.createTable('petty_cash_funds', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      t.string('name', 120).notNullable();
      t.uuid('custodian_user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
      t.decimal('float_amount', 14, 2).notNullable().defaultTo(0);
      t.boolean('active').notNullable().defaultTo(true);
      t.uuid('created_by').nullable();
      t.timestamps(true, true);
    });
  }
  if (!(await knex.schema.hasTable('petty_cash_entries'))) {
    await knex.schema.createTable('petty_cash_entries', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('tenant_id').notNullable();
      t.uuid('fund_id').notNullable().references('id').inTable('petty_cash_funds').onDelete('CASCADE');
      t.string('kind', 10).notNullable(); // top_up | spend | return
      t.decimal('amount', 14, 2).notNullable();
      t.string('category', 60).nullable();
      t.text('description').nullable();
      t.date('entry_date').notNullable();
      t.string('academic_year', 20).nullable();
      t.text('receipt_url').nullable();
      t.uuid('expense_id').nullable();
      t.uuid('recorded_by').nullable();
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.timestamp('voided_at', { useTz: true }).nullable();
      t.uuid('voided_by').nullable();
      t.text('void_reason').nullable();
      t.index(['fund_id', 'entry_date']);
    });
  }

  if (!(await knex.schema.hasTable('budgets'))) {
    await knex.schema.createTable('budgets', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      t.string('academic_year', 20).notNullable();
      t.string('status', 12).notNullable().defaultTo('draft'); // draft | approved
      t.text('notes').nullable();
      t.uuid('approved_by').nullable();
      t.timestamp('approved_at', { useTz: true }).nullable();
      t.uuid('created_by').nullable();
      t.timestamps(true, true);
      t.unique(['tenant_id', 'academic_year']);
    });
  }
  if (!(await knex.schema.hasTable('budget_lines'))) {
    await knex.schema.createTable('budget_lines', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('budget_id').notNullable().references('id').inTable('budgets').onDelete('CASCADE');
      t.string('category', 60).notNullable();
      t.string('department', 100).nullable();
      t.decimal('amount', 14, 2).notNullable();
      t.text('notes').nullable();
    });
  }

  if (!(await knex.schema.hasTable('staff_pay_profiles'))) {
    await knex.schema.createTable('staff_pay_profiles', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      t.string('staff_kind', 10).notNullable(); // staff (teachers.id) | support (support_staff.id)
      t.uuid('staff_ref_id').notNullable();
      t.decimal('basic_salary', 14, 2).notNullable().defaultTo(0);
      t.jsonb('allowances').notNullable().defaultTo(knex.raw("'[]'::jsonb"));
      t.jsonb('deductions').notNullable().defaultTo(knex.raw("'[]'::jsonb"));
      t.boolean('paye_applies').notNullable().defaultTo(true);
      t.boolean('nassit_applies').notNullable().defaultTo(true);
      t.string('payment_method', 20).notNullable().defaultTo('bank');
      t.string('bank_name', 100).nullable();
      t.string('account_number', 60).nullable();
      t.boolean('active').notNullable().defaultTo(true);
      t.uuid('updated_by').nullable();
      t.timestamps(true, true);
      t.unique(['tenant_id', 'staff_kind', 'staff_ref_id']);
    });
  }
  if (!(await knex.schema.hasTable('payroll_runs'))) {
    await knex.schema.createTable('payroll_runs', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      t.string('period', 7).notNullable(); // YYYY-MM
      t.string('academic_year', 20).nullable();
      t.string('status', 12).notNullable().defaultTo('draft'); // draft | approved | paid | cancelled
      for (const c of ['gross', 'paye', 'nassit_employee', 'nassit_employer', 'other_deductions', 'net']) t.decimal(c, 14, 2).notNullable().defaultTo(0);
      t.integer('staff_count').notNullable().defaultTo(0);
      t.text('notes').nullable();
      t.uuid('created_by').nullable();
      t.uuid('approved_by').nullable();
      t.timestamp('approved_at', { useTz: true }).nullable();
      t.uuid('paid_by').nullable();
      t.timestamp('paid_at', { useTz: true }).nullable();
      t.date('payment_date').nullable();
      t.text('cancelled_reason').nullable();
      t.timestamps(true, true);
    });
    await knex.raw("CREATE UNIQUE INDEX IF NOT EXISTS payroll_runs_period_uq ON payroll_runs (tenant_id, period) WHERE status <> 'cancelled'");
  }
  if (!(await knex.schema.hasTable('payslips'))) {
    await knex.schema.createTable('payslips', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('run_id').notNullable().references('id').inTable('payroll_runs').onDelete('CASCADE');
      t.uuid('tenant_id').notNullable();
      t.string('staff_kind', 10).notNullable();
      t.uuid('staff_ref_id').notNullable();
      t.uuid('user_id').nullable();
      t.string('staff_name', 200).notNullable();
      t.string('staff_number', 60).nullable();
      t.string('designation', 100).nullable();
      t.decimal('basic', 14, 2).notNullable().defaultTo(0);
      t.jsonb('allowances').notNullable().defaultTo(knex.raw("'[]'::jsonb"));
      t.jsonb('extras').notNullable().defaultTo(knex.raw("'[]'::jsonb")); // one-off: [{name, amount, taxable}]
      t.jsonb('deductions').notNullable().defaultTo(knex.raw("'[]'::jsonb"));
      for (const c of ['gross', 'taxable', 'paye', 'nassit_employee', 'nassit_employer', 'total_deductions', 'net']) t.decimal(c, 14, 2).notNullable().defaultTo(0);
      t.string('payment_method', 20).nullable();
      t.string('bank_name', 100).nullable();
      t.string('account_number', 60).nullable();
      t.string('email', 255).nullable();
      t.timestamps(true, true);
      t.unique(['run_id', 'staff_kind', 'staff_ref_id']);
      t.index(['tenant_id', 'user_id']);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('payslips');
  await knex.raw('DROP INDEX IF EXISTS payroll_runs_period_uq');
  await knex.schema.dropTableIfExists('payroll_runs');
  await knex.schema.dropTableIfExists('staff_pay_profiles');
  await knex.schema.dropTableIfExists('budget_lines');
  await knex.schema.dropTableIfExists('budgets');
  await knex.schema.dropTableIfExists('petty_cash_entries');
  await knex.schema.dropTableIfExists('petty_cash_funds');
  for (const c of ['vendor', 'payment_method', 'reference', 'receipt_url', 'department', 'source', 'source_id', 'voided_at', 'voided_by', 'void_reason']) {
    if (await knex.schema.hasColumn('school_expenses', c)) await knex.schema.alterTable('school_expenses', (t) => t.dropColumn(c));
  }
}
