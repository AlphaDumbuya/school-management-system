/**
 * Pure payment-application logic (financial-management spec §7 / Properties 3 & 4).
 *
 * Extracted so the monotonicity and idempotency invariants can be unit-tested
 * without a database. Given a list of fees (each with a current balance) and an
 * amount, compute the new balance/status per fee, applying oldest-first.
 */

export interface FeeLike {
  id: string;
  balance: number;   // current outstanding on this fee
}

export interface FeeApplication {
  id: string;
  newBalance: number;
  status: 'paid' | 'partial';
  applied: number;
}

export interface ApplyResult {
  applications: FeeApplication[];
  totalApplied: number;
  leftover: number;   // amount that could not be applied (excess)
}

/**
 * Apply `amount` across `fees` (assumed already ordered oldest-first), reducing
 * each fee's balance. Never applies more than a fee's balance; any excess is
 * returned as `leftover`. Fees with a zero/negative balance are skipped.
 */
export function applyAmount(fees: FeeLike[], amount: number): ApplyResult {
  let remaining = Math.max(0, Number(amount) || 0);
  const applications: FeeApplication[] = [];
  let totalApplied = 0;

  for (const fee of fees) {
    const bal = Math.max(0, Number(fee.balance) || 0);
    if (remaining <= 0) break;
    if (bal <= 0) continue;
    const applied = Math.min(bal, remaining);
    const newBalance = bal - applied;
    applications.push({
      id: fee.id,
      newBalance,
      status: newBalance <= 0 ? 'paid' : 'partial',
      applied,
    });
    totalApplied += applied;
    remaining -= applied;
  }

  return { applications, totalApplied, leftover: remaining };
}
