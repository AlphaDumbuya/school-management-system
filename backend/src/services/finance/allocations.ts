/**
 * Payment allocations: what each payment paid for.
 *
 * Every payment records the charges it settled (fee type, term, academic year,
 * amount) in `payment_allocations`, as a snapshot taken when the money came in.
 * Receipts read it to say exactly what was paid for, and the finance reports
 * read it to total collections by fee type.
 *
 * Recording runs inside the payment's own transaction, in a SAVEPOINT, so a
 * problem here (for example the table not being there yet during a deploy) is
 * logged and skipped instead of aborting the payment.
 */
import type { Knex } from 'knex';
import { logger } from '@utils/logger';

export interface AllocationInput {
  tenantId: string;
  paymentId: string;
  receiptNumber?: string | null;
  feeId?: string | null;
  kind?: 'fee' | 'credit';
  feeType?: string | null;
  term?: string | null;
  academicYear?: string | null;
  description?: string | null;
  amount: number;
}

const cut = (v: unknown, n: number): string | null => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, n) : null;
};

/** The charge a fee row represents, as stored on the allocation. */
export function allocationForFee(
  base: { tenantId: string; paymentId: string; receiptNumber?: string | null },
  fee: { id?: string; type?: string | null; term?: string | null; academic_year?: string | null; description?: string | null },
  amount: number,
): AllocationInput {
  return {
    ...base, feeId: fee.id ?? null, kind: 'fee',
    feeType: fee.type || 'Fee', term: fee.term, academicYear: fee.academic_year, description: fee.description, amount,
  };
}

/** Money above what was owed, kept as account credit. */
export function allocationForCredit(
  base: { tenantId: string; paymentId: string; receiptNumber?: string | null },
  amount: number,
  /** Replaces the default wording, e.g. for an online payment above the fees due. */
  label?: { feeType: string; description: string },
): AllocationInput {
  return {
    ...base, feeId: null, kind: 'credit',
    feeType: label?.feeType ?? 'Account credit',
    description: label?.description ?? 'Extra amount held as account credit',
    amount,
  };
}

export async function recordAllocations(trx: Knex | Knex.Transaction, rows: AllocationInput[]): Promise<void> {
  const list = rows.filter((r) => r && r.paymentId && Number(r.amount) > 0);
  if (!list.length) return;
  try {
    // A nested transaction on a transaction is a savepoint: a failure rolls back
    // only this insert, never the payment around it.
    const run = async (q: Knex | Knex.Transaction) => {
      await q('payment_allocations').insert(list.map((r) => ({
        tenant_id: r.tenantId,
        payment_id: r.paymentId,
        receipt_number: cut(r.receiptNumber, 40),
        fee_id: r.feeId || null,
        kind: r.kind || 'fee',
        fee_type: cut(r.feeType, 160),
        term: cut(r.term, 40),
        academic_year: cut(r.academicYear, 20),
        description: cut(r.description, 255),
        amount: Math.round(Number(r.amount) * 100) / 100,
      })));
    };
    if (typeof (trx as Knex.Transaction).savepoint === 'function' || (trx as any).isTransaction) {
      await (trx as Knex.Transaction).transaction(async (sp) => { await run(sp); });
    } else {
      await run(trx);
    }
  } catch (e: any) {
    logger.warn(`Could not record what payment ${list[0].paymentId} paid for: ${e?.message || e}`);
  }
}
