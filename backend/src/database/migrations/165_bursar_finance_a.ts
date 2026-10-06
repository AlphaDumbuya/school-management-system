import type { Knex } from 'knex';

/**
 * Bursar finance Phase A (.kiro/specs/bursar-finance-phase-a). Additive only.
 *  - finance_sequences: per-school counters (receipt numbers)
 *  - fee_adjustments: non-cash changes to a fee balance (discounts, waivers,
 *    applied credit, late-fee waivers), each auditable and reversible
 *  - discount_rules / discount_grants: sibling, staff child, scholarship…
 *  - student_credits: credit balance movements (overpayments, credit notes)
 *  - payment_plans: tenant/year/term scope for instalment plans
 *  - fees.source / parent_fee_id (late fee → original fee, once only)
 *  - payments.receipt_number (sequential per school/year) + balance_after
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('finance_sequences'))) {
    await knex.schema.createTable('finance_sequences', (t) => {
      t.uuid('tenant_id').notNullable();
      t.string('key', 60).notNullable();
      t.bigInteger('value').notNullable().defaultTo(0);
      t.primary(['tenant_id', 'key']);
    });
  }

  if (!(await knex.schema.hasTable('discount_rules'))) {
    await knex.schema.createTable('discount_rules', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      t.string('name', 120).notNullable();
      t.string('kind', 30).notNullable(); // sibling | staff_child | scholarship | custom
      t.string('basis', 10).notNullable(); // percent | fixed
      t.decimal('value', 14, 2).notNullable();
      t.string('applies_to', 10).notNullable().defaultTo('tuition'); // tuition | all
      t.integer('sibling_order').nullable(); // sibling: applies from the Nth child
      t.boolean('active').notNullable().defaultTo(true);
      t.text('description').nullable();
      t.uuid('created_by').nullable();
      t.timestamps(true, true);
      t.index(['tenant_id', 'active']);
    });
  }

  if (!(await knex.schema.hasTable('discount_grants'))) {
    await knex.schema.createTable('discount_grants', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      t.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
      t.uuid('rule_id').nullable().references('id').inTable('discount_rules').onDelete('SET NULL');
      t.string('label', 120).notNullable();
      t.string('academic_year', 20).notNullable();
      t.string('term', 30).nullable(); // null = whole year
      t.string('basis', 10).notNullable();
      t.decimal('value', 14, 2).notNullable();
      t.string('applies_to', 10).notNullable().defaultTo('tuition');
      t.text('reason').nullable();
      t.string('status', 12).notNullable().defaultTo('pending'); // pending | approved | rejected | revoked
      t.uuid('requested_by').nullable();
      t.uuid('decided_by').nullable();
      t.timestamp('decided_at', { useTz: true }).nullable();
      t.text('decision_reason').nullable();
      t.timestamps(true, true);
      t.index(['tenant_id', 'academic_year', 'status']);
      t.index(['student_id']);
    });
  }

  if (!(await knex.schema.hasTable('fee_adjustments'))) {
    await knex.schema.createTable('fee_adjustments', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('tenant_id').notNullable();
      t.uuid('fee_id').notNullable().references('id').inTable('fees').onDelete('CASCADE');
      t.uuid('student_id').notNullable();
      t.string('kind', 20).notNullable(); // discount | waiver | credit_applied | late_fee_waiver
      t.decimal('amount', 14, 2).notNullable(); // > 0 reduces the fee balance
      t.text('reason').nullable();
      t.uuid('discount_grant_id').nullable().references('id').inTable('discount_grants').onDelete('SET NULL');
      t.uuid('credit_id').nullable();
      t.uuid('created_by').nullable();
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.timestamp('reversed_at', { useTz: true }).nullable();
      t.uuid('reversed_by').nullable();
      t.index(['tenant_id', 'kind']);
      t.index(['fee_id']);
      t.index(['student_id']);
    });
    // One active discount line per (grant, fee): re-applying is idempotent.
    await knex.raw(
      'CREATE UNIQUE INDEX IF NOT EXISTS fee_adj_grant_fee_uq ON fee_adjustments (discount_grant_id, fee_id) WHERE discount_grant_id IS NOT NULL AND reversed_at IS NULL',
    );
  }

  if (!(await knex.schema.hasTable('student_credits'))) {
    await knex.schema.createTable('student_credits', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('tenant_id').notNullable();
      t.uuid('student_id').notNullable().references('id').inTable('students').onDelete('CASCADE');
      t.string('kind', 20).notNullable(); // overpayment | credit_note | applied | refunded
      t.decimal('amount', 14, 2).notNullable(); // + adds credit, − uses it
      t.uuid('payment_id').nullable();
      t.text('reason').nullable();
      t.uuid('created_by').nullable();
      t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      t.index(['tenant_id', 'student_id']);
    });
  }

  const addCol = async (table: string, col: string, fn: (t: Knex.AlterTableBuilder) => void) => {
    if (!(await knex.schema.hasColumn(table, col))) await knex.schema.alterTable(table, fn);
  };
  await addCol('fees', 'source', (t) => { t.string('source', 20).nullable(); });
  await addCol('fees', 'parent_fee_id', (t) => { t.uuid('parent_fee_id').nullable(); });
  await addCol('fees', 'overdue_marked_at', (t) => { t.timestamp('overdue_marked_at', { useTz: true }).nullable(); });
  await knex.raw(
    "CREATE UNIQUE INDEX IF NOT EXISTS fees_one_late_fee_uq ON fees (parent_fee_id) WHERE source = 'late_fee' AND status <> 'deleted'",
  );
  await addCol('payments', 'receipt_number', (t) => { t.string('receipt_number', 40).nullable(); });
  await addCol('payments', 'balance_after', (t) => { t.decimal('balance_after', 14, 2).nullable(); });
  await knex.raw('CREATE INDEX IF NOT EXISTS payments_receipt_idx ON payments (tenant_id, receipt_number)');

  await addCol('payment_plans', 'tenant_id', (t) => { t.uuid('tenant_id').nullable(); });
  await addCol('payment_plans', 'academic_year', (t) => { t.string('academic_year', 20).nullable(); });
  await addCol('payment_plans', 'term', (t) => { t.string('term', 30).nullable(); });
  await addCol('payment_plans', 'cancelled_reason', (t) => { t.text('cancelled_reason').nullable(); });

  // Back-fill: fees made from a fee structure (Tuition + structure expense
  // labels) vs manual; receipt numbers for existing payments, one per
  // submission (rows sharing an idempotency key share a receipt), numbered by
  // school and payment year.
  await knex.raw("UPDATE fees SET source = 'structure' WHERE source IS NULL AND type = 'Tuition'");
  await knex.raw("UPDATE fees SET source = 'manual' WHERE source IS NULL");
  const rows = await knex('payments')
    .whereNull('receipt_number')
    .whereNotNull('tenant_id')
    .orderBy('payment_date').orderBy('created_at')
    .select('id', 'tenant_id', 'payment_date', 'idempotency_key');
  const byKey = new Map<string, string>();
  for (const r of rows) {
    const year = new Date(r.payment_date).getFullYear();
    const groupKey = r.idempotency_key ? `${r.tenant_id}|${r.idempotency_key}` : '';
    let no = groupKey ? byKey.get(groupKey) : undefined;
    if (!no) {
      const seqKey = `receipt:${year}`;
      const [{ value }] = (await knex.raw(
        `INSERT INTO finance_sequences (tenant_id, key, value) VALUES (?, ?, 1)
         ON CONFLICT (tenant_id, key) DO UPDATE SET value = finance_sequences.value + 1 RETURNING value`,
        [r.tenant_id, seqKey],
      )).rows;
      no = `RCP-${year}-${String(value).padStart(6, '0')}`;
      if (groupKey) byKey.set(groupKey, no);
    }
    await knex('payments').where({ id: r.id }).update({ receipt_number: no });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS payments_receipt_idx');
  await knex.raw('DROP INDEX IF EXISTS fees_one_late_fee_uq');
  for (const [t, c] of [
    ['payments', 'receipt_number'], ['payments', 'balance_after'],
    ['fees', 'source'], ['fees', 'parent_fee_id'], ['fees', 'overdue_marked_at'],
    ['payment_plans', 'tenant_id'], ['payment_plans', 'academic_year'], ['payment_plans', 'term'], ['payment_plans', 'cancelled_reason'],
  ] as const) {
    if (await knex.schema.hasColumn(t, c)) await knex.schema.alterTable(t, (x) => x.dropColumn(c));
  }
  await knex.schema.dropTableIfExists('student_credits');
  await knex.schema.dropTableIfExists('fee_adjustments');
  await knex.schema.dropTableIfExists('discount_grants');
  await knex.schema.dropTableIfExists('discount_rules');
  await knex.schema.dropTableIfExists('finance_sequences');
}
