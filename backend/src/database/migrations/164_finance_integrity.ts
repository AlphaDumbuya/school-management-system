import type { Knex } from 'knex';

/**
 * Finance integrity (accountant portal pass). Additive only.
 *  - payments.idempotency_key: one key per "Record payment" submit, so a
 *    double click / retry / second tab can't record the same money twice.
 *  - invoices.voided_at / voided_by / void_reason: voiding needs a reason and
 *    an audit trail; a voided invoice releases its fees for re-invoicing.
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn('payments', 'idempotency_key'))) {
    await knex.schema.alterTable('payments', (t) => {
      t.string('idempotency_key', 80).nullable();
    });
    await knex.raw(
      'CREATE UNIQUE INDEX IF NOT EXISTS payments_tenant_idem_key_uq ON payments (tenant_id, idempotency_key, fee_id) WHERE idempotency_key IS NOT NULL',
    );
  }
  if (!(await knex.schema.hasColumn('invoices', 'voided_at'))) {
    await knex.schema.alterTable('invoices', (t) => {
      t.timestamp('voided_at', { useTz: true }).nullable();
      t.uuid('voided_by').nullable();
      t.text('void_reason').nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS payments_tenant_idem_key_uq');
  if (await knex.schema.hasColumn('payments', 'idempotency_key')) {
    await knex.schema.alterTable('payments', (t) => t.dropColumn('idempotency_key'));
  }
  if (await knex.schema.hasColumn('invoices', 'voided_at')) {
    await knex.schema.alterTable('invoices', (t) => {
      t.dropColumn('voided_at');
      t.dropColumn('voided_by');
      t.dropColumn('void_reason');
    });
  }
}
