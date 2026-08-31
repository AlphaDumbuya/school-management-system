import type { Knex } from 'knex';

/**
 * Finance v1 + Monime online payments.
 *
 * Adds the columns the fee/payment/invoice services + the Monime webhook write,
 * plus a payment_sessions table to track hosted-checkout sessions.
 *
 * IMPORTANT: run WITHOUT a wrapping transaction (`config.transaction = false`)
 * so that a single ALTER that no-ops/fails (e.g. a column that already exists
 * with a different definition) cannot poison the whole migration — each raw
 * statement is independent and individually guarded.
 */
export const config = { transaction: false };

// Run one statement, ignoring "already exists"/benign errors so the migration
// is idempotent and resilient on partially-migrated databases.
async function safe(knex: Knex, sql: string) {
  try {
    await knex.raw(sql);
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (/already exists|does not exist|cannot be cast|is in a primary key|duplicate/i.test(msg)) return;
    // Log-and-continue: never abort the whole migration for one column.
    // eslint-disable-next-line no-console
    console.warn(`[112_finance] skipped: ${sql} → ${msg}`);
  }
}

export async function up(knex: Knex): Promise<void> {
  // ── fees ──────────────────────────────────────────────────────────────────
  await safe(knex, `ALTER TABLE fees ADD COLUMN IF NOT EXISTS tenant_id uuid`);
  await safe(knex, `ALTER TABLE fees ADD COLUMN IF NOT EXISTS type varchar(100)`);
  await safe(knex, `ALTER TABLE fees ADD COLUMN IF NOT EXISTS description text`);
  await safe(knex, `ALTER TABLE fees ADD COLUMN IF NOT EXISTS class_id uuid`);
  await safe(knex, `ALTER TABLE fees ADD COLUMN IF NOT EXISTS academic_session varchar(50)`);
  await safe(knex, `ALTER TABLE fees ADD COLUMN IF NOT EXISTS balance numeric(12,2)`);
  await safe(knex, `ALTER TABLE fees ALTER COLUMN fee_type_id DROP NOT NULL`);
  await safe(knex, `ALTER TABLE fees ALTER COLUMN id DROP DEFAULT`);
  await safe(knex, `ALTER TABLE fees ALTER COLUMN id TYPE text USING id::text`);
  await safe(knex, `UPDATE fees SET balance = amount WHERE balance IS NULL`);
  await safe(knex, `UPDATE fees SET tenant_id = s.tenant_id FROM students s WHERE fees.student_id = s.id AND fees.tenant_id IS NULL`);

  // ── payments ────────────────────────────────────────────────────────────────
  await safe(knex, `ALTER TABLE payments ADD COLUMN IF NOT EXISTS tenant_id uuid`);
  await safe(knex, `ALTER TABLE payments ADD COLUMN IF NOT EXISTS fee_id text`);
  await safe(knex, `ALTER TABLE payments ADD COLUMN IF NOT EXISTS invoice_id text`);
  await safe(knex, `ALTER TABLE payments ADD COLUMN IF NOT EXISTS method varchar(50)`);
  await safe(knex, `ALTER TABLE payments ADD COLUMN IF NOT EXISTS transaction_reference varchar(200)`);
  await safe(knex, `ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes text`);
  await safe(knex, `ALTER TABLE payments ADD COLUMN IF NOT EXISTS created_by uuid`);
  await safe(knex, `ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider varchar(40)`);
  await safe(knex, `ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_reference varchar(200)`);
  await safe(knex, `ALTER TABLE payments ADD COLUMN IF NOT EXISTS channel varchar(40)`);
  await safe(knex, `ALTER TABLE payments ALTER COLUMN payment_method DROP NOT NULL`);
  await safe(knex, `ALTER TABLE payments ALTER COLUMN id DROP DEFAULT`);
  await safe(knex, `ALTER TABLE payments ALTER COLUMN id TYPE text USING id::text`);
  await safe(knex, `UPDATE payments SET tenant_id = s.tenant_id FROM students s WHERE payments.student_id = s.id AND payments.tenant_id IS NULL`);

  // ── invoices ──────────────────────────────────────────────────────────────
  await safe(knex, `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tenant_id uuid`);
  await safe(knex, `ALTER TABLE invoices ALTER COLUMN generated_by DROP NOT NULL`);
  await safe(knex, `ALTER TABLE invoices ALTER COLUMN id DROP DEFAULT`);
  await safe(knex, `ALTER TABLE invoices ALTER COLUMN id TYPE text USING id::text`);
  await safe(knex, `UPDATE invoices SET tenant_id = s.tenant_id FROM students s WHERE invoices.student_id = s.id AND invoices.tenant_id IS NULL`);

  // ── invoice_items (FK columns must match invoices.id / fees.id text type) ──
  await safe(knex, `ALTER TABLE invoice_items ALTER COLUMN id DROP DEFAULT`);
  await safe(knex, `ALTER TABLE invoice_items ALTER COLUMN id TYPE text USING id::text`);
  await safe(knex, `ALTER TABLE invoice_items ALTER COLUMN invoice_id TYPE text USING invoice_id::text`);
  await safe(knex, `ALTER TABLE invoice_items ALTER COLUMN fee_id TYPE text USING fee_id::text`);

  // ── payment_sessions ──────────────────────────────────────────────────────
  const hasSessions = await knex.schema.hasTable('payment_sessions');
  if (!hasSessions) {
    await knex.schema.createTable('payment_sessions', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('tenant_id').notNullable();
      t.uuid('student_id').notNullable();
      t.text('invoice_id').nullable();
      t.decimal('amount', 12, 2).notNullable();
      t.string('currency', 8).notNullable().defaultTo('SLE');
      t.string('provider', 40).notNullable().defaultTo('monime');
      t.string('provider_session_id', 200).nullable();
      t.text('redirect_url').nullable();
      t.string('status', 30).notNullable().defaultTo('pending');
      t.uuid('initiated_by').nullable();
      t.text('payment_id').nullable();
      t.jsonb('metadata').nullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
      t.index('tenant_id');
      t.index('student_id');
      t.index('provider_session_id');
      t.index('status');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('payment_sessions');
}
