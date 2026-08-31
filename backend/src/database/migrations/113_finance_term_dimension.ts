import type { Knex } from 'knex';

/**
 * Add a term + academic_year dimension to fees and invoices so the finance hub
 * can report collections by term (First/Second/Third) and by academic year.
 * Additive & idempotent.
 */
export const config = { transaction: false };

async function safe(knex: Knex, sql: string) {
  try { await knex.raw(sql); } catch (e: any) {
    const msg = String(e?.message || e);
    if (/already exists|does not exist/i.test(msg)) return;
    console.warn(`[113_finance_term] skipped: ${sql} → ${msg}`);
  }
}

export async function up(knex: Knex): Promise<void> {
  await safe(knex, `ALTER TABLE fees ADD COLUMN IF NOT EXISTS term varchar(30)`);
  await safe(knex, `ALTER TABLE fees ADD COLUMN IF NOT EXISTS academic_year varchar(20)`);
  await safe(knex, `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS term varchar(30)`);
  await safe(knex, `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS academic_year varchar(20)`);
  await safe(knex, `CREATE INDEX IF NOT EXISTS idx_fees_term ON fees(term)`);
  await safe(knex, `CREATE INDEX IF NOT EXISTS idx_invoices_term ON invoices(term)`);
}

export async function down(knex: Knex): Promise<void> {
  await safe(knex, `ALTER TABLE fees DROP COLUMN IF EXISTS term`);
  await safe(knex, `ALTER TABLE fees DROP COLUMN IF EXISTS academic_year`);
  await safe(knex, `ALTER TABLE invoices DROP COLUMN IF EXISTS term`);
  await safe(knex, `ALTER TABLE invoices DROP COLUMN IF EXISTS academic_year`);
}
