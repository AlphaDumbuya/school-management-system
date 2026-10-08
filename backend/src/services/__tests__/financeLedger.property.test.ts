import { describe, it, expect } from 'vitest';
import { projectLedger, SL_TERMS, LedgerCharge, LedgerTerm } from '../financeLedgerService';

/**
 * Property-based tests for the ledger projection (Task 3.3).
 * Uses a generative loop over randomized charge sets — no external PBT lib.
 *  - Property 2: ledger conservation (Req 2.3, 9.3)
 *  - Property 7: term zero-fill (Req 2.5)
 */

const YEARS = ['2024/2025', '2025/2026', '2026/2027'];
const TERMS: (LedgerTerm | null)[] = [...SL_TERMS, null];

function rand(n: number) { return Math.floor(Math.random() * n); }
function money() { return Math.round(Math.random() * 100000) / 100; }

function randomCharges(count: number): LedgerCharge[] {
  const charges: LedgerCharge[] = [];
  for (let i = 0; i < count; i++) {
    const amount = money();
    // outstanding is between 0 and amount (a partial/complete settlement)
    const outstanding = Math.round(Math.random() * amount * 100) / 100;
    charges.push({
      id: `c-${i}`,
      type: 'Tuition',
      description: null,
      amount,
      outstanding,
      status: outstanding <= 0 ? 'paid' : 'pending',
      due_date: null,
      term: TERMS[rand(TERMS.length)],
      academic_year: YEARS[rand(YEARS.length)],
    });
  }
  return charges;
}

const approx = (a: number, b: number) => Math.abs(a - b) < 0.01;

describe('projectLedger — Property 2: ledger conservation', () => {
  it('year.billed == Σ term.billed, year.outstanding == billed - paid, totals == Σ years', () => {
    for (let iter = 0; iter < 300; iter++) {
      const charges = randomCharges(rand(40));
      const ledger = projectLedger('stu', 'ten', charges);

      let totBilled = 0, totPaid = 0, totOut = 0;
      for (const y of ledger.years) {
        const sumTermBilled = y.terms.reduce((s, t) => s + t.billed, 0);
        const sumTermOut = y.terms.reduce((s, t) => s + t.outstanding, 0);
        expect(approx(y.billed, sumTermBilled)).toBe(true);
        expect(approx(y.outstanding, sumTermOut)).toBe(true);
        // paid is defined as billed - outstanding at every level
        expect(approx(y.paid, y.billed - y.outstanding)).toBe(true);
        for (const t of y.terms) {
          expect(approx(t.paid, t.billed - t.outstanding)).toBe(true);
        }
        totBilled += y.billed; totPaid += y.paid; totOut += y.outstanding;
      }
      expect(approx(ledger.totals.billed, totBilled)).toBe(true);
      expect(approx(ledger.totals.paid, totPaid)).toBe(true);
      expect(approx(ledger.totals.outstanding, totOut)).toBe(true);

      // Global conservation: total billed equals the sum of all input amounts.
      const inputBilled = charges.reduce((s, c) => s + c.amount, 0);
      expect(approx(ledger.totals.billed, inputBilled)).toBe(true);
    }
  });
});

describe('projectLedger — Property 7: term zero-fill', () => {
  it('every year bucket exposes exactly the three terms in canonical order', () => {
    for (let iter = 0; iter < 200; iter++) {
      const ledger = projectLedger('stu', 'ten', randomCharges(rand(30)));
      for (const y of ledger.years) {
        expect(y.terms.map((t) => t.term)).toEqual([...SL_TERMS]);
      }
    }
  });

  it('a year with no charges for a term still shows that term with zero billed', () => {
    const charges: LedgerCharge[] = [{
      id: 'only', type: 'Tuition', description: null, amount: 500, outstanding: 500,
      status: 'pending', due_date: null, term: 'second_term', academic_year: '2026/2027',
    }];
    const ledger = projectLedger('stu', 'ten', charges);
    const y = ledger.years.find((yr) => yr.academic_year === '2026/2027')!;
    const first = y.terms.find((t) => t.term === 'first_term')!;
    const third = y.terms.find((t) => t.term === 'third_term')!;
    expect(first.billed).toBe(0);
    expect(first.outstanding).toBe(0);
    expect(third.billed).toBe(0);
  });
});

describe('projectLedger — discounts and credit are not cash paid', () => {
  it('billed == paid + discounted + credit_applied + outstanding at every level', () => {
    for (let run = 0; run < 100; run++) {
      const charges = randomCharges(1 + rand(25)).map((c) => {
        // Split what was settled into cash, discount and credit.
        const settled = c.amount - c.outstanding;
        const discounted = Math.round(settled * Math.random() * 100) / 100;
        const credit_applied = Math.round((settled - discounted) * Math.random() * 100) / 100;
        return { ...c, discounted, credit_applied };
      });
      const ledger = projectLedger('s', 't', charges);
      const check = (b: any) => expect(approx(b.billed, b.paid + b.discounted + b.credit_applied + b.outstanding)).toBe(true);
      for (const y of ledger.years) { check(y); y.terms.forEach(check); }
      check(ledger.totals);
      const inputDiscount = charges.reduce((s, c) => s + (c.discounted || 0), 0);
      expect(approx(ledger.totals.discounted, inputDiscount)).toBe(true);
    }
  });

  it('a fully discounted fee shows 0 paid', () => {
    const ledger = projectLedger('s', 't', [{ id: 'a', type: 'Tuition', description: null, amount: 900, outstanding: 0, discounted: 900, credit_applied: 0, status: 'paid', due_date: null, term: 'first_term', academic_year: '2027/2028', required: true }]);
    expect(ledger.totals.paid).toBe(0);
    expect(ledger.totals.discounted).toBe(900);
  });
});
