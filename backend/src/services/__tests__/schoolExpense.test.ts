import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for schoolExpenseService validation + summary math (Task 4.5).
 * The db module is mocked. Property 6 (summary agreement) is validated at the
 * arithmetic level here and end-to-end in the integration suite.
 */

let expensesRows: any[] = [];

// Minimal chainable stub covering the queries the service uses.
function makeDb() {
  return (_table: string) => {
    const state: any = { where: {}, agg: null };
    const chain: any = {
      insert(row: any) { return { returning: () => Promise.resolve([{ id: 'exp-1', ...row }]) }; },
      where(w: any) { Object.assign(state.where, w); return chain; },
      orderBy() { return Promise.resolve(expensesRows); },
      first() {
        if (state.summing) {
          const total = expensesRows.reduce((s, r) => s + Number(r.amount || 0), 0);
          return Promise.resolve({ total });
        }
        return Promise.resolve(expensesRows[0] ?? null);
      },
      sum() { state.summing = true; return chain; },
      groupBy() { state.grouping = true; return chain; },
      select() {
        if (state.grouping) {
          const byTerm: Record<string, number> = {};
          for (const r of expensesRows) {
            const k = r.term || null;
            byTerm[String(k)] = (byTerm[String(k)] || 0) + Number(r.amount || 0);
          }
          return Promise.resolve(Object.entries(byTerm).map(([term, total]) => ({ term: term === 'null' ? null : term, total })));
        }
        return chain;
      },
      update() { return { returning: () => Promise.resolve([{ id: 'exp-1' }]) }; },
      del() { return Promise.resolve(1); },
    };
    return chain;
  };
}

vi.mock('../../utils/database.js', () => ({
  db: Object.assign((t: string) => (global as any).__DB__(t), { raw: (s: string) => s }),
}));

import { schoolExpenseService } from '../schoolExpenseService';
import { AppError } from '../../middleware/errorHandler';

beforeEach(() => {
  expensesRows = [];
  (global as any).__DB__ = makeDb();
});

describe('schoolExpenseService.create — validation', () => {
  const base = { category: 'Utilities', amount: 100, expense_date: '2026-09-01', academic_year: '2026/2027' };

  it('rejects a missing category', async () => {
    await expect(schoolExpenseService.create('t', 'u', { ...base, category: '' } as any)).rejects.toBeInstanceOf(AppError);
  });
  it('rejects a non-positive amount', async () => {
    await expect(schoolExpenseService.create('t', 'u', { ...base, amount: 0 } as any)).rejects.toBeInstanceOf(AppError);
  });
  it('rejects an invalid term', async () => {
    await expect(schoolExpenseService.create('t', 'u', { ...base, term: 'fourth_term' } as any)).rejects.toBeInstanceOf(AppError);
  });
  it('accepts a valid expense', async () => {
    const row = await schoolExpenseService.create('t', 'u', base as any);
    expect(row.id).toBe('exp-1');
    expect(row.category).toBe('Utilities');
  });
});

describe('schoolExpenseService.summaryByYear — Property 6 arithmetic', () => {
  it('total equals the sum of expense amounts', async () => {
    expensesRows = [{ amount: 100 }, { amount: 250.5 }, { amount: 49.5 }];
    const summary = await schoolExpenseService.summaryByYear('t', '2026/2027');
    expect(summary.total).toBe(400);
  });
  it('is zero when there are no expenses', async () => {
    expensesRows = [];
    const summary = await schoolExpenseService.summaryByYear('t', '2026/2027');
    expect(summary.total).toBe(0);
  });
});
