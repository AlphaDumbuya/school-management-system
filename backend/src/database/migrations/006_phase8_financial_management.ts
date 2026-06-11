import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Migration 001 now handles fees, payments, and fee_types creation with UUIDs
  // This migration only adds new financial tables not in migration 001

  // Create refunds table
  const hasRefunds = await knex.schema.hasTable('refunds');
  if (!hasRefunds) {
    await knex.schema.createTable('refunds', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('original_payment_id').notNullable().references('id').inTable('payments');
    table.decimal('amount', 10, 2).notNullable();
    table.text('reason').notNullable();
    table.timestamp('refund_date').notNullable();
    table.enum('status', ['completed', 'pending', 'rejected']).defaultTo('completed');
    table.uuid('processed_by').notNullable().references('id').inTable('users');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index('original_payment_id');
    table.index('refund_date');
    table.index('status');
    });
  }

  // Create invoices table
  const hasInvoices = await knex.schema.hasTable('invoices');
  if (!hasInvoices) {
    await knex.schema.createTable('invoices', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('invoice_number', 100).unique().notNullable();
    table.uuid('student_id').notNullable().references('id').inTable('students');
    table.decimal('total_amount', 10, 2).notNullable();
    table.decimal('total_paid', 10, 2).defaultTo(0);
    table.decimal('balance', 10, 2).notNullable();
    table.date('due_date').notNullable();
    table.enum('status', ['pending', 'partial', 'paid', 'overdue', 'cancelled']).defaultTo('pending');
    table.text('notes').nullable();
    table.uuid('generated_by').notNullable().references('id').inTable('users');
    table.timestamp('generated_at').defaultTo(knex.fn.now());
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.index('invoice_number');
    table.index('student_id');
    table.index('status');
    table.index('due_date');
    table.index('generated_at');
    table.index(['student_id', 'status']);
    });
  }

  // Create invoice_items table (junction table for invoices and fees)
  const hasInvoiceItems = await knex.schema.hasTable('invoice_items');
  if (!hasInvoiceItems) {
    await knex.schema.createTable('invoice_items', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('invoice_id').notNullable().references('id').inTable('invoices').onDelete('CASCADE');
    table.uuid('fee_id').notNullable().references('id').inTable('fees').onDelete('CASCADE');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index('invoice_id');
    table.index('fee_id');
    table.unique(['invoice_id', 'fee_id']);
    });
  }

  // Create payment_plans table
  const hasPaymentPlans = await knex.schema.hasTable('payment_plans');
  if (!hasPaymentPlans) {
    await knex.schema.createTable('payment_plans', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
    table.decimal('total_amount', 10, 2).notNullable();
    table.integer('number_of_installments').notNullable();
    table.decimal('installment_amount', 10, 2).notNullable();
    table.date('start_date').notNullable();
    table.date('end_date').notNullable();
    table.enum('status', ['active', 'completed', 'cancelled', 'suspended']).defaultTo('active');
    table.text('notes').nullable();
    table.uuid('created_by').notNullable().references('id').inTable('users');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.index('student_id');
    table.index('status');
    table.index(['student_id', 'status']);
    });
  }

  // Create payment_plan_installments table
  const hasPaymentPlanInstallments = await knex.schema.hasTable('payment_plan_installments');
  if (!hasPaymentPlanInstallments) {
    await knex.schema.createTable('payment_plan_installments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('payment_plan_id').notNullable().references('id').inTable('payment_plans').onDelete('CASCADE');
    table.integer('installment_number').notNullable();
    table.decimal('amount', 10, 2).notNullable();
    table.date('due_date').notNullable();
    table.uuid('payment_id').nullable().references('id').inTable('payments');
    table.enum('status', ['pending', 'paid', 'overdue', 'waived']).defaultTo('pending');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.index('payment_plan_id');
    table.index('status');
    table.index('due_date');
    });
  }

  // Create financial_reports table
  const hasFinancialReports = await knex.schema.hasTable('financial_reports');
  if (!hasFinancialReports) {
    await knex.schema.createTable('financial_reports', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.enum('report_type', [
      'fee_collection',
      'outstanding_balance',
      'payment_summary',
      'payment_methods',
      'student_ledger',
      'class_summary',
      'financial_summary',
    ]);
    table.json('filters').nullable();
    table.json('data').nullable();
    table.uuid('generated_by').notNullable().references('id').inTable('users');
    table.timestamp('generated_at').defaultTo(knex.fn.now());
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index('report_type');
    table.index('generated_at');
    });
  }

  // Create financial_transactions table (audit log for financial operations)
  const hasFinancialTransactions = await knex.schema.hasTable('financial_transactions');
  if (!hasFinancialTransactions) {
    await knex.schema.createTable('financial_transactions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.enum('transaction_type', [
      'fee_created',
      'payment_received',
      'refund_issued',
      'invoice_generated',
      'fee_waived',
      'fee_adjusted',
    ]);
    table.uuid('reference_id').nullable();
    table.uuid('student_id').nullable().references('id').inTable('students');
    table.decimal('amount', 10, 2).notNullable();
    table.uuid('performed_by').notNullable().references('id').inTable('users');
    table.text('notes').nullable();
    table.timestamp('transaction_date').defaultTo(knex.fn.now());
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index('transaction_type');
    table.index('student_id');
    table.index('transaction_date');
    });
  }

  // Add indexes for invoices for better query performance
  await knex.schema.table('invoices', (table) => {
    table.index(['due_date', 'status']);
    table.index(['generated_at', 'status']);
  });
}

export async function down(knex: Knex): Promise<void> {
  // Drop tables in reverse order of creation (respecting foreign keys)
  await knex.schema.dropTableIfExists('financial_transactions');
  await knex.schema.dropTableIfExists('financial_reports');
  await knex.schema.dropTableIfExists('payment_plan_installments');
  await knex.schema.dropTableIfExists('payment_plans');
  await knex.schema.dropTableIfExists('invoice_items');
  await knex.schema.dropTableIfExists('invoices');
  await knex.schema.dropTableIfExists('refunds');
}
