import type { Knex } from 'knex';

/**
 * payments.receipt_emailed_at: when the receipt email for this payment was
 * successfully sent. Lets the daily job re-send any online (Monime) receipt
 * whose email failed, instead of a family silently never getting it.
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('payments'))) return;
  if (!(await knex.schema.hasColumn('payments', 'receipt_emailed_at'))) {
    await knex.schema.alterTable('payments', (t) => { t.timestamp('receipt_emailed_at').nullable(); });
  }
  // Mark every payment that already exists as handled, so the new re-send job
  // only ever looks at payments made from now on.
  await knex('payments').whereNull('receipt_emailed_at').update({ receipt_emailed_at: knex.fn.now() });
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('payments', 'receipt_emailed_at')) {
    await knex.schema.alterTable('payments', (t) => { t.dropColumn('receipt_emailed_at'); });
  }
}
