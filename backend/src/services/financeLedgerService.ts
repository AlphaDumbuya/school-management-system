import { db } from '../utils/database.js';
import { assertStudentInTenant } from '../middleware/financeGuard.js';

/**
 * Finance ledger projection (financial-management spec §2).
 *
 * A READ-ONLY projection of the existing `fees` and `payments` rows into a
 * per-student, per-year, per-term ledger. There is no separate ledger table —
 * everything is derived from the source rows so staff reports and family portals
 * always show identical figures.
 *
 * Balances:
 *  - `billed`      = Σ fee.amount for the bucket
 *  - `outstanding` = Σ fee.balance (falling back to amount) for non-void fees
 *  - `paid`        = billed - outstanding  (what has been settled against charges)
 *
 * All three terms are always represented per year (zero-filled) — Req 2.5.
 */

export const SL_TERMS = ['first_term', 'second_term', 'third_term'] as const;
export type LedgerTerm = (typeof SL_TERMS)[number];

const TERM_ALIASES: Record<string, LedgerTerm> = {
  first_term: 'first_term', 'first term': 'first_term', '1': 'first_term', term1: 'first_term', 'first': 'first_term',
  second_term: 'second_term', 'second term': 'second_term', '2': 'second_term', term2: 'second_term', 'second': 'second_term',
  third_term: 'third_term', 'third term': 'third_term', '3': 'third_term', term3: 'third_term', 'third': 'third_term',
};

function normaliseTerm(raw: string | null | undefined): LedgerTerm | null {
  if (!raw) return null;
  return TERM_ALIASES[String(raw).trim().toLowerCase()] ?? null;
}

export interface LedgerCharge {
  id: string;
  type: string | null;
  description: string | null;
  amount: number;
  outstanding: number;
  status: string | null;
  due_date: string | null;
  term: LedgerTerm | null;
  academic_year: string | null;
}

export interface TermBucket {
  term: LedgerTerm;
  billed: number;
  paid: number;
  outstanding: number;
  charges: LedgerCharge[];
}

export interface YearBucket {
  academic_year: string;
  billed: number;
  paid: number;
  outstanding: number;
  terms: TermBucket[];
}

export interface StudentLedger {
  student_id: string;
  tenant_id: string;
  years: YearBucket[];
  totals: { billed: number; paid: number; outstanding: number };
}

function num(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * PURE projection: turn a flat list of charges into the year/term-bucketed
 * ledger. Extracted so the correctness properties (conservation, zero-fill) can
 * be tested without a database. Each input charge carries its own year/term and
 * `amount` / `outstanding`.
 */
export function projectLedger(
  studentId: string,
  tenantId: string,
  charges: LedgerCharge[],
): StudentLedger {
  const byYear = new Map<string, Map<LedgerTerm, LedgerCharge[]>>();
  for (const c of charges) {
    const year = c.academic_year || 'Unassigned';
    const term = c.term ?? 'first_term'; // untermed charges roll into first term
    if (!byYear.has(year)) byYear.set(year, new Map());
    const termMap = byYear.get(year)!;
    if (!termMap.has(term)) termMap.set(term, []);
    termMap.get(term)!.push(c);
  }

  const years: YearBucket[] = Array.from(byYear.entries())
    .map(([academic_year, termMap]) => {
      const terms: TermBucket[] = SL_TERMS.map((term) => {
        const list = termMap.get(term) ?? [];
        const billed = list.reduce((s, c) => s + c.amount, 0);
        const outstanding = list.reduce((s, c) => s + c.outstanding, 0);
        return { term, billed, paid: billed - outstanding, outstanding, charges: list };
      });
      const billed = terms.reduce((s, t) => s + t.billed, 0);
      const outstanding = terms.reduce((s, t) => s + t.outstanding, 0);
      return { academic_year, billed, paid: billed - outstanding, outstanding, terms };
    })
    .sort((a, b) => b.academic_year.localeCompare(a.academic_year));

  const totals = years.reduce(
    (acc, y) => ({ billed: acc.billed + y.billed, paid: acc.paid + y.paid, outstanding: acc.outstanding + y.outstanding }),
    { billed: 0, paid: 0, outstanding: 0 },
  );

  return { student_id: studentId, tenant_id: tenantId, years, totals };
}

class FinanceLedgerService {
  /**
   * Full per-student ledger, grouped by academic year then term, zero-filled to
   * three terms per year. Tenant-scoped via the student.
   */
  async getStudentLedger(tenantId: string, studentId: string): Promise<StudentLedger> {
    await assertStudentInTenant(studentId, tenantId);

    const fees = await db('fees')
      .where({ tenant_id: tenantId, student_id: studentId })
      .whereNot('status', 'deleted')
      .select('id', 'type', 'description', 'amount', 'balance', 'status', 'due_date', 'term', 'academic_year');

    const charges: LedgerCharge[] = fees.map((f: any) => ({
      id: f.id,
      type: f.type ?? null,
      description: f.description ?? null,
      amount: num(f.amount),
      outstanding: num(f.balance ?? f.amount),
      status: f.status ?? null,
      due_date: f.due_date ? new Date(f.due_date).toISOString().slice(0, 10) : null,
      term: normaliseTerm(f.term),
      academic_year: f.academic_year ?? null,
    }));

    return projectLedger(studentId, tenantId, charges);
  }

  /**
   * Tenant-wide finance summary for a year: total billed, collected, and
   * outstanding. Derived from the same fee rows as the student ledger (Req 9.3).
   */
  async getTenantSummary(
    tenantId: string,
    academicYear: string,
  ): Promise<{ academic_year: string; billed: number; collected: number; outstanding: number }> {
    const row = await db('fees')
      .where({ tenant_id: tenantId, academic_year: academicYear })
      .whereNot('status', 'deleted')
      .select(
        db.raw('COALESCE(SUM(amount),0) as billed'),
        db.raw('COALESCE(SUM(COALESCE(balance, amount)),0) as outstanding'),
      )
      .first();
    const billed = num(row?.billed);
    const outstanding = num(row?.outstanding);
    return { academic_year: academicYear, billed, collected: billed - outstanding, outstanding };
  }

  /**
   * Collection / outstanding broken down by term, class, or level for a year.
   */
  async getBreakdown(
    tenantId: string,
    academicYear: string,
    by: 'term' | 'class' | 'level',
  ): Promise<Array<{ key: string; billed: number; collected: number; outstanding: number }>> {
    if (by === 'term') {
      const rows = await db('fees')
        .where({ tenant_id: tenantId, academic_year: academicYear })
        .whereNot('status', 'deleted')
        .groupBy('term')
        .select(
          'term',
          db.raw('COALESCE(SUM(amount),0) as billed'),
          db.raw('COALESCE(SUM(COALESCE(balance, amount)),0) as outstanding'),
        );
      return rows.map((r: any) => {
        const billed = num(r.billed);
        const outstanding = num(r.outstanding);
        return { key: normaliseTerm(r.term) ?? 'unassigned', billed, collected: billed - outstanding, outstanding };
      });
    }

    // class / level: join classes for the label.
    const labelCol = by === 'class' ? 'classes.name' : 'classes.level';
    const rows = await db('fees')
      .leftJoin('classes', 'fees.class_id', 'classes.id')
      .where({ 'fees.tenant_id': tenantId, 'fees.academic_year': academicYear })
      .whereNot('fees.status', 'deleted')
      .groupBy(labelCol)
      .select(
        db.raw(`COALESCE(${labelCol}, 'Unassigned') as key`),
        db.raw('COALESCE(SUM(fees.amount),0) as billed'),
        db.raw('COALESCE(SUM(COALESCE(fees.balance, fees.amount)),0) as outstanding'),
      );
    return rows.map((r: any) => {
      const billed = num(r.billed);
      const outstanding = num(r.outstanding);
      return { key: r.key || 'Unassigned', billed, collected: billed - outstanding, outstanding };
    });
  }
}

export const financeLedgerService = new FinanceLedgerService();
export default financeLedgerService;
