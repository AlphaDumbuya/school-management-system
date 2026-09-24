import { describe, it, expect } from 'vitest';
import { applyAmount, FeeLike } from '../paymentApplication';

/**
 * Property tests for payment application (Task 6.3 / 7.3).
 *  - Property 3: payment monotonicity (Req 6.3)
 *  - Property 4: (re)application idempotency once balances are settled (Req 6.3)
 */

function rand(n: number) { return Math.floor(Math.random() * n); }
function money() { return Math.round(Math.random() * 5000) / 100; }

function randomFees(count: number): FeeLike[] {
  return Array.from({ length: count }, (_, i) => ({ id: `f-${i}`, balance: money() }));
}

const sum = (fees: FeeLike[]) => fees.reduce((s, f) => s + Math.max(0, f.balance), 0);
const approx = (a: number, b: number) => Math.abs(a - b) < 0.001;

describe('applyAmount — Property 3: payment monotonicity', () => {
  it('reduces total outstanding by exactly min(amount, outstanding); never negative; excess is leftover', () => {
    for (let iter = 0; iter < 500; iter++) {
      const fees = randomFees(rand(8));
      const outstanding = sum(fees);
      const amount = Math.round(Math.random() * (outstanding + 2000) * 100) / 100;

      const { applications, totalApplied, leftover } = applyAmount(fees, amount);

      const expectedApplied = Math.min(amount, outstanding);
      expect(approx(totalApplied, expectedApplied)).toBe(true);

      // No fee balance goes negative.
      for (const app of applications) expect(app.newBalance).toBeGreaterThanOrEqual(0);

      // New total outstanding = old - applied, and never increases.
      const applied = new Map(applications.map((a) => [a.id, a.newBalance]));
      const newTotal = fees.reduce((s, f) => s + (applied.has(f.id) ? applied.get(f.id)! : Math.max(0, f.balance)), 0);
      expect(approx(newTotal, outstanding - totalApplied)).toBe(true);
      expect(newTotal).toBeLessThanOrEqual(outstanding + 0.001);

      // Excess (amount beyond outstanding) is reported as leftover.
      if (amount > outstanding) expect(approx(leftover, amount - outstanding)).toBe(true);
    }
  });
});

describe('applyAmount — Property 4: idempotency after settlement', () => {
  it('re-applying against already-settled balances applies nothing more', () => {
    for (let iter = 0; iter < 300; iter++) {
      const fees = randomFees(rand(6) + 1);
      const outstanding = sum(fees);
      // Pay the full outstanding.
      const first = applyAmount(fees, outstanding);
      const settled: FeeLike[] = fees.map((f) => {
        const a = first.applications.find((x) => x.id === f.id);
        return { id: f.id, balance: a ? a.newBalance : Math.max(0, f.balance) };
      });
      // Everything should now be zero (within fp tolerance); a second
      // application applies effectively nothing more.
      const second = applyAmount(settled, outstanding);
      expect(second.totalApplied).toBeLessThan(0.001);
      expect(sum(settled)).toBeLessThan(0.001);
    }
  });
});
