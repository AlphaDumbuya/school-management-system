import type { Knex } from 'knex';

/**
 * Bursar finance, final pass (additive only):
 *  - payroll_runs.paid_from: which money account paid the net salaries
 *    (bank | cash | mobile), so the books credit the right one.
 *  - petty_cash_entries.money_account: where a top-up came from / a return
 *    went to (bank | cash | mobile).
 *  - discount_grants.credit_shortfall: when fees are already paid, put the
 *    part that couldn't come off on the student's account credit;
 *    credited_amount records how much was credited (so it's never doubled).
 *  - finance_notices: one row per reminder sent (e.g. an instalment due soon),
 *    so the daily job never sends the same reminder twice.
 */
export async function up(knex: Knex): Promise<void> {
  const addCol = async (table: string, col: string, fn: (t: Knex.AlterTableBuilder) => void) => {
    if (!(await knex.schema.hasColumn(table, col))) await knex.schema.alterTable(table, fn);
  };
  await addCol('payroll_runs', 'paid_from', (t) => { t.string('paid_from', 10).nullable(); });
  await addCol('petty_cash_entries', 'money_account', (t) => { t.string('money_account', 10).nullable(); });
  await addCol('discount_grants', 'credit_shortfall', (t) => { t.boolean('credit_shortfall').notNullable().defaultTo(false); });
  await addCol('discount_grants', 'credited_amount', (t) => { t.decimal('credited_amount', 12, 2).notNullable().defaultTo(0); });
  if (!(await knex.schema.hasTable('finance_notices'))) {
    await knex.schema.createTable('finance_notices', (t) => {
      t.uuid('tenant_id').notNullable();
      t.string('key', 200).notNullable();
      t.timestamp('sent_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.primary(['tenant_id', 'key']);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('finance_notices');
  for (const [t, c] of [['payroll_runs', 'paid_from'], ['petty_cash_entries', 'money_account'], ['discount_grants', 'credit_shortfall'], ['discount_grants', 'credited_amount']] as const) {
    if (await knex.schema.hasColumn(t, c)) await knex.schema.alterTable(t, (x) => x.dropColumn(c));
  }
}
