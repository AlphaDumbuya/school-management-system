import { describe, it, expect } from 'vitest';
import { paye, computeSlip, validateBands, DEFAULT_PAYE_BANDS } from '../finance/payrollService';
import { cashKeyFor } from '../finance/glService';
import { cleanCategory } from '../finance/expenseService';
import { cleanMoneyAccount } from '../finance/core';

/** Pure finance helpers used by the bursar portal (payroll, books, expenses). */

const settings = { bands: DEFAULT_PAYE_BANDS, nassitEmployeePct: 5, nassitEmployerPct: 10, payeAfterNassit: true };

describe('paye (Sierra Leone monthly bands)', () => {
  it('is zero up to the tax-free band', () => {
    expect(paye(0, DEFAULT_PAYE_BANDS)).toBe(0);
    expect(paye(600, DEFAULT_PAYE_BANDS)).toBe(0);
  });
  it('taxes each slice at its own rate', () => {
    // 600 @0 + 600 @15% = 90
    expect(paye(1200, DEFAULT_PAYE_BANDS)).toBe(90);
    // 90 + 600 @20% (120) + 600 @25% (150) + 600 @30% (180) = 540
    expect(paye(3000, DEFAULT_PAYE_BANDS)).toBe(540);
  });
  it('never decreases as pay rises', () => {
    let prev = -1;
    for (let t = 0; t <= 10000; t += 37.5) {
      const tax = paye(t, DEFAULT_PAYE_BANDS);
      expect(tax).toBeGreaterThanOrEqual(prev);
      expect(tax).toBeLessThanOrEqual(t);
      prev = tax;
    }
  });
});

describe('computeSlip', () => {
  it('deducts NASSIT before PAYE and balances gross = net + deductions', () => {
    const s = computeSlip({ basic_salary: 2000, allowances: [{ name: 'Transport', amount: 200 }], deductions: [{ name: 'Loan', amount: 100 }], paye_applies: true, nassit_applies: true }, settings);
    expect(s.gross).toBe(2200);
    expect(s.nassit_employee).toBe(100); // 5% of basic only
    expect(s.nassit_employer).toBe(200); // 10% of basic, not deducted from pay
    expect(s.taxable).toBe(2100);
    expect(s.paye).toBe(paye(2100, DEFAULT_PAYE_BANDS));
    expect(s.total_deductions).toBe(Math.round((s.paye + 100 + 100) * 100) / 100);
    expect(Math.round((s.net + s.total_deductions) * 100) / 100).toBe(s.gross);
  });
  it('leaves non-taxable allowances out of PAYE and respects the opt-outs', () => {
    const s = computeSlip({ basic_salary: 1000, allowances: [{ name: 'Meal', amount: 500, taxable: false }], deductions: [], paye_applies: false, nassit_applies: false }, settings);
    expect(s.gross).toBe(1500);
    expect(s.taxable).toBe(1000);
    expect(s.paye).toBe(0);
    expect(s.nassit_employee).toBe(0);
    expect(s.net).toBe(1500);
  });
  it('ignores blank or zero lines', () => {
    const s = computeSlip({ basic_salary: 800, allowances: [{ name: '', amount: 50 }, { name: 'X', amount: 0 }], deductions: null, paye_applies: true, nassit_applies: true }, settings);
    expect(s.allowances).toHaveLength(0);
    expect(s.gross).toBe(800);
  });
});

describe('validateBands', () => {
  it('accepts the default bands', () => {
    expect(validateBands(DEFAULT_PAYE_BANDS)).toEqual(DEFAULT_PAYE_BANDS);
  });
  it('rejects empty, out-of-order, open middle bands and bad rates', () => {
    expect(() => validateBands([])).toThrow();
    expect(() => validateBands([{ upto: 1000, rate: 0 }, { upto: 500, rate: 10 }, { upto: null, rate: 20 }])).toThrow();
    expect(() => validateBands([{ upto: null, rate: 0 }, { upto: null, rate: 10 }])).toThrow();
    expect(() => validateBands([{ upto: 1000, rate: 0 }, { upto: 2000, rate: 10 }])).toThrow();
    expect(() => validateBands([{ upto: 1000, rate: -1 }, { upto: null, rate: 10 }])).toThrow();
    expect(() => validateBands([{ upto: 1000, rate: 0 }, { upto: null, rate: 101 }])).toThrow();
  });
});

describe('cashKeyFor (which money account a method lands in)', () => {
  it.each([
    ['cash', 'cash'], ['', 'cash'], [null, 'cash'],
    ['mobile_money', 'mobile'], ['monime', 'mobile'], ['Orange Money', 'mobile'], ['online', 'mobile'],
    ['bank_transfer', 'bank'], ['cheque', 'bank'], ['card', 'bank'], ['POS', 'bank'],
    ['something else', 'cash'],
  ])('%s → %s', (m, key) => expect(cashKeyFor(m)).toBe(key));
});

describe('cleanMoneyAccount', () => {
  it('keeps bank, cash and mobile; anything else falls back', () => {
    expect(cleanMoneyAccount('cash')).toBe('cash');
    expect(cleanMoneyAccount('mobile')).toBe('mobile');
    expect(cleanMoneyAccount('petty')).toBe('bank');
    expect(cleanMoneyAccount(undefined, 'cash')).toBe('cash');
  });
});

describe('cleanCategory', () => {
  it('maps standard names case-insensitively', () => {
    expect(cleanCategory('utilities')).toBe('Utilities');
    expect(cleanCategory('  food & catering ')).toBe('Food & Catering');
  });
  it('keeps a custom name (2–60 chars, spaces collapsed)', () => {
    expect(cleanCategory('Security   uniforms')).toBe('Security uniforms');
  });
  it('rejects too short or too long names', () => {
    expect(() => cleanCategory('')).toThrow();
    expect(() => cleanCategory('x')).toThrow();
    expect(() => cleanCategory('y'.repeat(61))).toThrow();
  });
});
