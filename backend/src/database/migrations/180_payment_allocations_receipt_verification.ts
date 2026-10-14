import type { Knex } from 'knex';

/**
 * Receipts that say exactly what was paid for, and can be checked.
 * Additive only (two new tables, no change to existing ones):
 *
 *  - payment_allocations: one row per charge a payment settled (fee type, term,
 *    academic year, amount). Staff-recorded payments already point at one fee
 *    each (payments.fee_id); online payments are one row spread over the oldest
 *    fees and the split was never kept. From now on every payment writes its
 *    split here, so receipts and finance reports can say "Tuition, Term 2: Le X;
 *    Uniform: Le Y". Past staff-recorded payments are back-filled below. Past
 *    online payments cannot be reconstructed and keep their generic label.
 *  - receipt_verifications: one random, unguessable code per receipt. It is
 *    printed on the PDF (as text and as a QR code) and resolves on a public
 *    page that shows the receipt as the school recorded it, so a copied or
 *    edited receipt does not match.
 */
const POLICY = 'tenant_isolation';

async function secure(knex: Knex, table: string): Promise<void> {
  // Same backward-compatible tenant policy migration 149 puts on every tenant table.
  await knex.raw('ALTER TABLE ?? ENABLE ROW LEVEL SECURITY', [table]);
  await knex.raw('ALTER TABLE ?? FORCE ROW LEVEL SECURITY', [table]);
  await knex.raw(`DROP POLICY IF EXISTS ${POLICY} ON ??`, [table]);
  await knex.raw(
    `CREATE POLICY ${POLICY} ON ??
     USING (
       current_setting('app.current_tenant', true) IS NULL
       OR current_setting('app.current_tenant', true) = ''
       OR tenant_id IS NULL
       OR tenant_id::text = current_setting('app.current_tenant', true)
     )
     WITH CHECK (
       current_setting('app.current_tenant', true) IS NULL
       OR current_setting('app.current_tenant', true) = ''
       OR tenant_id IS NULL
       OR tenant_id::text = current_setting('app.current_tenant', true)
     )`,
    [table],
  );
}

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('payment_allocations'))) {
    await knex.schema.createTable('payment_allocations', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      // payments.id is a uuid. No foreign key on purpose: a payment row is never
      // deleted (it is marked refunded), and a hard failure here must not be able
      // to block recording a payment.
      t.uuid('payment_id').notNullable();
      t.string('receipt_number', 40).nullable();
      // The charge settled; null for money kept as account credit.
      t.uuid('fee_id').nullable();
      // 'fee' = a charge on the student's account; 'credit' = extra held as account credit.
      t.string('kind', 16).notNullable().defaultTo('fee');
      // Snapshot of the charge at payment time, so the receipt never changes if
      // the fee is edited or removed later.
      t.string('fee_type', 160).nullable();
      t.string('term', 40).nullable();
      t.string('academic_year', 20).nullable();
      t.string('description', 255).nullable();
      t.decimal('amount', 14, 2).notNullable();
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    });
    await knex.raw('CREATE INDEX IF NOT EXISTS payment_alloc_payment_idx ON payment_allocations (payment_id)');
    await knex.raw('CREATE INDEX IF NOT EXISTS payment_alloc_receipt_idx ON payment_allocations (tenant_id, receipt_number)');
    await knex.raw('CREATE INDEX IF NOT EXISTS payment_alloc_type_idx ON payment_allocations (tenant_id, fee_type, academic_year)');
    await secure(knex, 'payment_allocations');
  }

  if (!(await knex.schema.hasTable('receipt_verifications'))) {
    await knex.schema.createTable('receipt_verifications', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      t.string('receipt_number', 40).notNullable();
      // Random, unguessable (see receiptVerifyService). Unique across all schools.
      t.string('code', 32).notNullable().unique();
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      t.unique(['tenant_id', 'receipt_number']);
    });
    await secure(knex, 'receipt_verifications');
  }

  // Back-fill: past staff-recorded payments point at one fee each. Insert-only,
  // and safe to run again (skips payments that already have a row).
  if (await knex.schema.hasTable('payments') && await knex.schema.hasTable('fees')) {
    await knex.raw(`
      INSERT INTO payment_allocations
        (tenant_id, payment_id, receipt_number, fee_id, kind, fee_type, term, academic_year, description, amount, created_at)
      SELECT p.tenant_id, p.id, p.receipt_number, f.id, 'fee',
             LEFT(COALESCE(NULLIF(f.type, ''), 'Fee'), 160), LEFT(f.term, 40), LEFT(f.academic_year, 20), LEFT(f.description, 255),
             p.amount, COALESCE(p.created_at, NOW())
        FROM payments p
        JOIN fees f ON f.id::text = p.fee_id::text
       WHERE p.tenant_id IS NOT NULL
         AND p.fee_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM payment_allocations a WHERE a.payment_id = p.id)
    `);
    // Past overpayments kept as account credit.
    await knex.raw(`
      INSERT INTO payment_allocations
        (tenant_id, payment_id, receipt_number, fee_id, kind, fee_type, description, amount, created_at)
      SELECT p.tenant_id, p.id, p.receipt_number, NULL, 'credit', 'Account credit', 'Extra amount held as account credit',
             p.amount, COALESCE(p.created_at, NOW())
        FROM payments p
       WHERE p.tenant_id IS NOT NULL
         AND p.fee_id IS NULL
         AND COALESCE(p.notes, '') ILIKE '%overpayment%'
         AND NOT EXISTS (SELECT 1 FROM payment_allocations a WHERE a.payment_id = p.id)
    `);
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('receipt_verifications');
  await knex.schema.dropTableIfExists('payment_allocations');
}
