import type { Knex } from 'knex';

/**
 * Bursar finance Phase C (.kiro/specs/bursar-finance-phase-c). Additive only:
 * double-entry books (chart of accounts, journal entries + lines) and bank
 * reconciliation (imported statement lines, matches to journal lines).
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('gl_accounts'))) {
    await knex.schema.createTable('gl_accounts', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      t.string('code', 10).notNullable();
      t.string('name', 120).notNullable();
      t.string('type', 10).notNullable(); // asset | liability | equity | income | expense
      t.string('subtype', 20).nullable(); // cash | receivable | control | payable | contra
      t.string('system_key', 80).nullable(); // e.g. 'cash', 'ar', 'exp:utilities'
      t.boolean('is_system').notNullable().defaultTo(false);
      t.boolean('is_active').notNullable().defaultTo(true);
      t.text('description').nullable();
      t.timestamps(true, true);
      t.unique(['tenant_id', 'code']);
    });
    await knex.raw('CREATE UNIQUE INDEX IF NOT EXISTS gl_accounts_key_uq ON gl_accounts (tenant_id, system_key) WHERE system_key IS NOT NULL');
  }

  if (!(await knex.schema.hasTable('gl_entries'))) {
    await knex.schema.createTable('gl_entries', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      t.string('entry_no', 20).notNullable();
      t.date('entry_date').notNullable();
      t.string('academic_year', 20).nullable();
      t.text('memo').nullable();
      t.string('kind', 10).notNullable().defaultTo('auto'); // auto | manual
      t.string('source_type', 20).notNullable(); // fee | payment | refund | adjustment | credit | expense | petty_cash | payroll | manual
      t.uuid('source_id').nullable();
      t.uuid('reverses_id').nullable();
      t.uuid('reversed_by_id').nullable();
      t.text('reverse_reason').nullable();
      t.uuid('created_by').nullable();
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.index(['tenant_id', 'entry_date']);
      t.index(['tenant_id', 'source_type', 'source_id']);
      t.unique(['tenant_id', 'entry_no']);
    });
  }

  if (!(await knex.schema.hasTable('gl_lines'))) {
    await knex.schema.createTable('gl_lines', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('entry_id').notNullable().references('id').inTable('gl_entries').onDelete('CASCADE');
      t.uuid('tenant_id').notNullable();
      t.uuid('account_id').notNullable().references('id').inTable('gl_accounts').onDelete('RESTRICT');
      t.decimal('debit', 14, 2).notNullable().defaultTo(0);
      t.decimal('credit', 14, 2).notNullable().defaultTo(0);
      t.text('memo').nullable();
      t.uuid('student_id').nullable();
      t.index(['tenant_id', 'account_id']);
      t.index(['entry_id']);
    });
  }

  if (!(await knex.schema.hasTable('bank_statement_lines'))) {
    await knex.schema.createTable('bank_statement_lines', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      t.uuid('account_id').notNullable().references('id').inTable('gl_accounts').onDelete('CASCADE');
      t.date('txn_date').notNullable();
      t.text('description').nullable();
      t.string('reference', 120).nullable();
      t.decimal('amount', 14, 2).notNullable(); // + money in, − money out
      t.decimal('balance', 14, 2).nullable();
      t.string('status', 10).notNullable().defaultTo('unmatched'); // unmatched | matched | ignored
      t.string('dedupe_key', 300).notNullable();
      t.string('import_batch', 40).notNullable();
      t.uuid('imported_by').nullable();
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.unique(['account_id', 'dedupe_key']);
      t.index(['tenant_id', 'account_id', 'txn_date']);
    });
  }

  if (!(await knex.schema.hasTable('bank_matches'))) {
    await knex.schema.createTable('bank_matches', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('tenant_id').notNullable();
      t.uuid('statement_line_id').notNullable().references('id').inTable('bank_statement_lines').onDelete('CASCADE');
      t.uuid('gl_line_id').notNullable().references('id').inTable('gl_lines').onDelete('CASCADE');
      t.uuid('created_by').nullable();
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.unique(['gl_line_id']);
      t.index(['statement_line_id']);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('bank_matches');
  await knex.schema.dropTableIfExists('bank_statement_lines');
  await knex.schema.dropTableIfExists('gl_lines');
  await knex.schema.dropTableIfExists('gl_entries');
  await knex.raw('DROP INDEX IF EXISTS gl_accounts_key_uq');
  await knex.schema.dropTableIfExists('gl_accounts');
}
