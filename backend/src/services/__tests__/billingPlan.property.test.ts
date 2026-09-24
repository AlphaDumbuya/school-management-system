import { describe, it, expect } from 'vitest';
import { planStudentBill, ExistingCharge, PlannedCharge } from '../billingPlan';

/**
 * Property test for term-billing idempotency (Task 7.3 / Property 5, Req 4.3).
 * Billing the same (class, term, year) twice never creates a duplicate tuition
 * charge, while still adding other applicable charges exactly once.
 */

const YEAR = '2026/2027';
const TERM = 'First Term';

function chargesFromPlan(plan: PlannedCharge[]): ExistingCharge[] {
  return plan.map((p) => ({ type: p.type, term: TERM, academic_year: YEAR }));
}

describe('planStudentBill — Property 5: billing idempotency', () => {
  it('a second billing run with the first run applied plans nothing', () => {
    const input = {
      termLabel: TERM,
      academicYear: YEAR,
      tuition: 1500,
      expenses: [
        { label: 'Uniform', amount: 300 },
        { label: 'ID Card', amount: 50 },
        { label: 'Exams Levy', amount: 120 },
      ],
      existing: [] as ExistingCharge[],
    };

    const firstRun = planStudentBill(input);
    // First run creates tuition + 3 expenses.
    expect(firstRun).toHaveLength(4);

    // Apply the first run, then bill again — nothing new should be planned.
    const secondRun = planStudentBill({ ...input, existing: chargesFromPlan(firstRun) });
    expect(secondRun).toHaveLength(0);
  });

  it('skips only the duplicate tuition while still adding new expenses', () => {
    const input = {
      termLabel: TERM,
      academicYear: YEAR,
      tuition: 1500,
      expenses: [{ label: 'Uniform', amount: 300 }, { label: 'Sports', amount: 80 }],
      // Student already has tuition + Uniform, but not Sports.
      existing: [
        { type: 'Tuition', term: TERM, academic_year: YEAR },
        { type: 'Uniform', term: TERM, academic_year: YEAR },
      ] as ExistingCharge[],
    };
    const plan = planStudentBill(input);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ type: 'Sports', kind: 'expense' });
  });

  it('does not plan tuition when tuition is zero', () => {
    const plan = planStudentBill({
      termLabel: TERM, academicYear: YEAR, tuition: 0,
      expenses: [{ label: 'Uniform', amount: 300 }], existing: [],
    });
    expect(plan.every((p) => p.kind !== 'tuition')).toBe(true);
    expect(plan).toHaveLength(1);
  });
});
