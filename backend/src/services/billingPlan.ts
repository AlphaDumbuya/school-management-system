/**
 * Pure term-billing planner (financial-management spec §4 / Property 5).
 *
 * Given the tuition + year-expense line items for a term and the charges a
 * student ALREADY has, decide which new charges to create. Tuition is skipped
 * only when a tuition charge already exists for the (term, year); each expense
 * is deduped independently by its label within the year. Extracted so the
 * billing-idempotency invariant can be unit-tested without a database.
 */

export interface ExistingCharge {
  type: string;
  term: string | null;
  academic_year: string | null;
}

export interface PlannedCharge {
  type: string;
  amount: number;
  kind: 'tuition' | 'expense';
}

export interface BillTermInput {
  termLabel: string;
  academicYear: string;
  tuition: number;
  expenses: Array<{ label: string; amount: number }>;
  existing: ExistingCharge[];
}

export function planStudentBill(input: BillTermInput): PlannedCharge[] {
  const planned: PlannedCharge[] = [];

  const hasTuition = input.existing.some(
    (c) => c.type === 'Tuition' && c.term === input.termLabel && c.academic_year === input.academicYear,
  );
  if (input.tuition > 0 && !hasTuition) {
    planned.push({ type: 'Tuition', amount: input.tuition, kind: 'tuition' });
  }

  for (const e of input.expenses) {
    const amt = Number(e.amount) || 0;
    if (amt <= 0) continue;
    const hasExpense = input.existing.some((c) => c.type === e.label && c.academic_year === input.academicYear);
    if (hasExpense) continue;
    planned.push({ type: e.label, amount: amt, kind: 'expense' });
  }

  return planned;
}
