/**
 * Double-entry books (bursar Phase C, R1–R4).
 *
 * Posting works by reconciliation, not by hooking every write path: each
 * source document (fee, payment, refund, adjustment, credit, expense, petty
 * cash entry, payroll run) has an EXPECTED set of lines. sync() compares that
 * with what is already posted for the document and posts the difference as
 * one balanced entry. Idempotent (nothing posts twice) and self-correcting
 * (an edit, void, refund or cancellation posts a correcting entry).
 * All amounts are handled in whole cents to keep entries exactly balanced.
 */
import type { Knex } from 'knex';
import { db } from '@utils/database';
import { AppError } from '@middleware/errorHandler';
import { tenantToday } from '@utils/schoolDate';
import { normalizeAcademicYear, resolveActiveYear } from '@utils/academicYear';
import { audit } from './core';

type AccType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';
export const ACCOUNT_TYPES: AccType[] = ['asset', 'liability', 'equity', 'income', 'expense'];

/** [code, name, type, subtype, system_key] */
const DEFAULT_CHART: Array<[string, string, AccType, string | null, string]> = [
  ['1000', 'Cash on hand', 'asset', 'cash', 'cash'],
  ['1010', 'Bank', 'asset', 'cash', 'bank'],
  ['1020', 'Mobile money & online', 'asset', 'cash', 'mobile'],
  ['1030', 'Petty cash', 'asset', 'cash', 'petty'],
  ['1100', 'Fees receivable', 'asset', 'receivable', 'ar'],
  ['2000', 'Student credit (fees paid in advance)', 'liability', 'control', 'credit'],
  ['2100', 'PAYE payable (NRA)', 'liability', 'payable', 'paye'],
  ['2110', 'NASSIT payable', 'liability', 'payable', 'nassit'],
  ['2120', 'Other payroll deductions payable', 'liability', 'payable', 'payded'],
  ['2200', 'Accounts payable', 'liability', 'payable', 'ap'],
  ['3000', 'Accumulated fund (opening balances)', 'equity', null, 'equity'],
  ['4000', 'Tuition fees', 'income', null, 'inc:tuition'],
  ['4010', 'Other fee charges', 'income', null, 'inc:other'],
  ['4020', 'Late fees', 'income', null, 'inc:late'],
  ['4500', 'Discounts, scholarships & waivers', 'income', 'contra', 'inc:discount'],
  ['4900', 'Other income & donations', 'income', null, 'inc:misc'],
  ['5000', 'Salaries', 'expense', null, 'exp:salaries'],
  ['5010', 'Employer NASSIT & statutory', 'expense', null, 'exp:statutory (paye/nassit)'],
  ['5100', 'Utilities', 'expense', null, 'exp:utilities'],
  ['5110', 'Supplies', 'expense', null, 'exp:supplies'],
  ['5120', 'Maintenance', 'expense', null, 'exp:maintenance'],
  ['5130', 'Transport', 'expense', null, 'exp:transport'],
  ['5140', 'Food & Catering', 'expense', null, 'exp:food & catering'],
  ['5150', 'Rent', 'expense', null, 'exp:rent'],
  ['5160', 'Events', 'expense', null, 'exp:events'],
  ['5170', 'Administration', 'expense', null, 'exp:administration'],
  ['5180', 'Bank charges', 'expense', null, 'exp:bank charges'],
  ['5190', 'Other expenses', 'expense', null, 'exp:other'],
];

/** Kept by sub-ledgers (fees, credits, petty cash funds): no manual posting. */
export const CONTROL_KEYS = new Set(['ar', 'credit', 'petty']);

const cents = (n: any) => Math.round((Number(n) || 0) * 100);
const ymd = (v: any): string => {
  if (!v) return '';
  if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  return String(v).slice(0, 10);
};
const addDays = (d: string, n: number) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

/** Which cash account a payment method lands in. */
export function cashKeyFor(method: unknown): 'cash' | 'bank' | 'mobile' {
  const s = String(method || '').toLowerCase();
  if (!s || s.includes('cash')) return 'cash';
  if (/(mobile|momo|monime|orange|afri|online|wallet|qmoney|ussd)/.test(s)) return 'mobile';
  if (/(bank|cheque|check|card|pos|transfer|deposit)/.test(s)) return 'bank';
  return 'cash';
}

const chartReady = new Set<string>();
const lastSync = new Map<string, number>();

/** Academic year for a date, from the school's session starts (same rule as expenses). */
async function yearResolver(tenantId: string): Promise<(d: string) => string | null> {
  const sessions = await db('academic_sessions').where({ tenant_id: tenantId }).whereNotNull('start_date').select('name', 'start_date');
  const sorted = sessions
    .map((s: any) => ({ y: normalizeAcademicYear(s.name), start: ymd(s.start_date) }))
    .filter((s) => s.y && /^\d{4}\/\d{4}$/.test(s.y))
    .sort((a, b) => a.start.localeCompare(b.start) || a.y!.localeCompare(b.y!)); // same start: the later year wins
  const fallback = (await resolveActiveYear(tenantId)).yearString || null;
  return (d: string) => {
    let hit: string | null = null;
    for (const s of sorted) if (s.start <= d) hit = s.y!;
    return hit || sorted[0]?.y || fallback;
  };
}

/** Reserve n consecutive journal numbers. */
async function reserveNumbers(trx: Knex.Transaction, tenantId: string, n: number): Promise<number> {
  const r = await trx.raw(
    `INSERT INTO finance_sequences (tenant_id, key, value) VALUES (?, 'gl', ?)
     ON CONFLICT (tenant_id, key) DO UPDATE SET value = finance_sequences.value + EXCLUDED.value RETURNING value`,
    [tenantId, n],
  );
  return Number(r.rows[0].value) - n + 1;
}
const entryNo = (n: number) => `JE-${String(n).padStart(6, '0')}`;

type Doc = {
  type: string; id: string; date: string; change: string | null; memo: string; student?: string | null;
  /** Academic year the record belongs to (its own year, not its date): drives year reports. */
  year?: string | null;
  lines: Map<string, number>; // account id → cents (debit +, credit −)
};

export const glService = {
  /** Create any missing standard accounts (once per school per process). */
  async ensureChart(tenantId: string) {
    if (chartReady.has(tenantId)) return;
    const existing = await db('gl_accounts').where({ tenant_id: tenantId }).select('code', 'system_key');
    const keys = new Set(existing.map((a: any) => a.system_key).filter(Boolean));
    const codes = new Set(existing.map((a: any) => a.code));
    const rows: any[] = [];
    for (const [code, name, type, subtype, key] of DEFAULT_CHART) {
      if (keys.has(key)) continue;
      let c = Number(code);
      while (codes.has(String(c))) c += 1;
      codes.add(String(c));
      rows.push({ tenant_id: tenantId, code: String(c), name, type, subtype, system_key: key, is_system: true });
    }
    if (rows.length) await db('gl_accounts').insert(rows).onConflict().ignore();
    chartReady.add(tenantId);
  },

  async accountsByKey(q: Knex | Knex.Transaction, tenantId: string): Promise<Map<string, any>> {
    const rows = await q('gl_accounts').where({ tenant_id: tenantId }).whereNotNull('system_key');
    return new Map(rows.map((a: any) => [a.system_key, a]));
  },

  /** Expense account for a category; custom categories get one (5200–5899). */
  async expenseAccount(trx: Knex.Transaction, tenantId: string, byKey: Map<string, any>, category: string) {
    const key = `exp:${String(category || 'Other').trim().toLowerCase()}`;
    const hit = byKey.get(key);
    if (hit) return hit;
    const used = new Set((await trx('gl_accounts').where({ tenant_id: tenantId }).select('code')).map((a: any) => a.code));
    let c = 5200;
    while (used.has(String(c)) && c < 5899) c += 1;
    const [acc] = await trx('gl_accounts')
      .insert({ tenant_id: tenantId, code: String(c), name: String(category).trim().slice(0, 120), type: 'expense', system_key: key, is_system: false, description: 'Created for a custom expense category' })
      .returning('*');
    byKey.set(key, acc);
    return acc;
  },

  // ── Books lock ────────────────────────────────────────────────────────────
  async lockDate(tenantId: string): Promise<string | null> {
    const r = await db('school_config_settings').where({ tenant_id: tenantId, setting_key: 'fin_books_locked_until' }).first('setting_value').catch(() => null);
    const v = String(r?.setting_value || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  },

  async setLockDate(tenantId: string, userId: string, date: string | null) {
    const v = date ? String(date).slice(0, 10) : '';
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new AppError('Choose a valid date.', 400, 'VALIDATION_ERROR');
    if (v && v > await tenantToday(tenantId)) throw new AppError('You can only close the books up to today.', 400, 'VALIDATION_ERROR');
    const before = await this.lockDate(tenantId);
    const updated = await db('school_config_settings').where({ tenant_id: tenantId, setting_key: 'fin_books_locked_until' }).update({ setting_value: v, updated_by: userId, updated_at: new Date() });
    if (!updated) {
      const school = await db('school_config_settings').where({ tenant_id: tenantId }).whereNotNull('school_id').first('school_id');
      await db('school_config_settings').insert({ tenant_id: tenantId, school_id: school?.school_id || tenantId, setting_key: 'fin_books_locked_until', setting_value: v, data_type: 'string', created_by: userId, updated_by: userId });
    }
    await audit('books_lock', null, v ? 'close' : 'reopen', userId, { before, after: v || null });
    return { locked_until: v || null };
  },

  // ── Automatic posting ─────────────────────────────────────────────────────
  /** Sync unless this school was synced in the last few seconds. */
  async ensureSynced(tenantId: string) {
    const t = lastSync.get(tenantId) || 0;
    if (Date.now() - t < 15_000) return null;
    return this.sync(tenantId);
  },

  async sync(tenantId: string): Promise<{ posted: number; documents: number }> {
    await this.ensureChart(tenantId);
    const today = await tenantToday(tenantId);
    const lock = await this.lockDate(tenantId);
    const yearOf = await yearResolver(tenantId);
    const result = await db.transaction(async (trx) => {
      await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`gl:${tenantId}`]);
      const byKey = await this.accountsByKey(trx, tenantId);
      const A = (k: string) => byKey.get(k)?.id as string;
      const docs = new Map<string, Doc>();
      const add = (d: Omit<Doc, 'lines'>, lines: Array<[string, number]>) => {
        const m = new Map<string, number>();
        for (const [acc, amt] of lines) if (acc && amt) m.set(acc, (m.get(acc) || 0) + amt);
        docs.set(`${d.type}:${d.id}`, { ...d, lines: m });
      };

      // Names for memos.
      const names = new Map<string, string>(
        (await trx('students as s').leftJoin('users as u', 'u.id', 's.user_id').where('s.tenant_id', tenantId)
          .select('s.id', db.raw("TRIM(CONCAT_WS(' ', COALESCE(u.first_name, s.first_name), COALESCE(u.last_name, s.last_name))) as n")))
          .map((r: any) => [r.id, r.n || 'Student']),
      );
      const who = (id: string) => names.get(id) || 'Student';
      const Y = (v: any) => { const y = normalizeAcademicYear(v || null); return y && /^\d{4}\/\d{4}$/.test(y) ? y : null; };
      const feeYear = new Map<string, string | null>();

      // Fees billed.
      for (const f of await trx('fees').where({ tenant_id: tenantId }).select('id', 'student_id', 'amount', 'status', 'type', 'source', 'term', 'academic_year', 'created_at', 'updated_at')) {
        const amt = f.status === 'deleted' ? 0 : cents(f.amount);
        const inc = f.source === 'late_fee' ? 'inc:late' : String(f.type || '').toLowerCase() === 'tuition' ? 'inc:tuition' : 'inc:other';
        feeYear.set(f.id, Y(f.academic_year));
        add({ type: 'fee', id: f.id, year: Y(f.academic_year), date: ymd(f.created_at), change: ymd(f.updated_at), student: f.student_id, memo: `${f.type || 'Fee'}${f.term ? ` · ${f.term}` : ''}: ${who(f.student_id)}` },
          [[A('ar'), amt], [A(inc), -amt]]);
      }

      // Payments received (refunded ones were received too; the refund posts the outflow).
      const overpaid = new Set((await trx('student_credits').where({ tenant_id: tenantId, kind: 'overpayment' }).whereNotNull('payment_id').select('payment_id')).map((r: any) => r.payment_id));
      const payMethod = new Map<string, string>();
      for (const p of await trx('payments as p').where('p.tenant_id', tenantId)
        .select('p.id', 'p.student_id', 'p.amount', 'p.status', 'p.method', 'p.payment_method', 'p.payment_date', 'p.created_at', 'p.updated_at', 'p.receipt_number')) {
        const method = p.method || p.payment_method;
        payMethod.set(p.id, method);
        // Cash is in the year it arrived (a 2026/2027 arrear paid now lowers this year's receivable).
        const year = yearOf(ymd(p.payment_date || p.created_at));
        const amt = ['completed', 'refunded'].includes(String(p.status)) ? cents(p.amount) : 0;
        add({ type: 'payment', id: p.id, year, date: ymd(p.payment_date || p.created_at), change: ymd(p.updated_at), student: p.student_id, memo: `Payment${p.receipt_number ? ` ${p.receipt_number}` : ''}: ${who(p.student_id)}` },
          [[A(cashKeyFor(method)), amt], [A(overpaid.has(p.id) ? 'credit' : 'ar'), -amt]]);
      }

      // Refunds paid back.
      for (const r of await trx('refunds as r').join('payments as p', 'p.id', 'r.original_payment_id').where('p.tenant_id', tenantId)
        .select('r.id', 'r.amount', 'r.status', 'r.refund_date', 'r.created_at', 'p.id as pid', 'p.student_id', 'p.receipt_number')) {
        const amt = !r.status || r.status === 'completed' ? cents(r.amount) : 0;
        add({ type: 'refund', id: r.id, date: ymd(r.refund_date || r.created_at), change: null, student: r.student_id, memo: `Refund${r.receipt_number ? ` of ${r.receipt_number}` : ''}: ${who(r.student_id)}` },
          [[A('ar'), amt], [A(cashKeyFor(payMethod.get(r.pid))), -amt]]);
      }

      // Non-cash adjustments to fee balances.
      for (const a of await trx('fee_adjustments').where({ tenant_id: tenantId }).select('id', 'fee_id', 'student_id', 'kind', 'amount', 'created_at', 'reversed_at')) {
        const amt = a.reversed_at ? 0 : cents(a.amount);
        const dr = a.kind === 'credit_applied' ? 'credit' : a.kind === 'late_fee_waiver' ? 'inc:late' : 'inc:discount';
        const label = ({ discount: 'Discount', waiver: 'Waiver', credit_applied: 'Credit applied', late_fee_waiver: 'Late fee waived' } as any)[a.kind] || 'Adjustment';
        add({ type: 'adjustment', id: a.id, year: feeYear.get(a.fee_id) || null, date: ymd(a.created_at), change: ymd(a.reversed_at), student: a.student_id, memo: `${label}: ${who(a.student_id)}` },
          [[A(dr), amt], [A('ar'), -amt]]);
      }

      // Credit notes and credit refunded in cash.
      for (const c of await trx('student_credits').where({ tenant_id: tenantId }).whereIn('kind', ['credit_note', 'refunded']).select('id', 'student_id', 'kind', 'amount', 'created_at')) {
        const amt = Math.abs(cents(c.amount));
        if (c.kind === 'credit_note') {
          add({ type: 'credit', id: c.id, date: ymd(c.created_at), change: null, student: c.student_id, memo: `Credit note: ${who(c.student_id)}` }, [[A('inc:discount'), amt], [A('credit'), -amt]]);
        } else {
          add({ type: 'credit', id: c.id, date: ymd(c.created_at), change: null, student: c.student_id, memo: `Credit refunded: ${who(c.student_id)}` }, [[A('credit'), amt], [A('cash'), -amt]]);
        }
      }

      // Expenses (payroll expenses are posted from the pay run with its liabilities).
      for (const e of await trx('school_expenses').where({ tenant_id: tenantId }).whereNot('source', 'payroll')
        .select('id', 'academic_year', 'category', 'amount', 'expense_date', 'payment_method', 'source', 'vendor', 'description', 'voided_at', 'updated_at', 'created_at')) {
        const acc = await this.expenseAccount(trx, tenantId, byKey, e.category);
        const amt = e.voided_at ? 0 : cents(e.amount);
        const credit = e.source === 'petty_cash' ? 'petty' : cashKeyFor(e.payment_method);
        add({ type: 'expense', id: e.id, year: Y(e.academic_year), date: ymd(e.expense_date || e.created_at), change: ymd(e.voided_at || e.updated_at), memo: `${e.category}${e.vendor ? `: ${e.vendor}` : e.description ? `: ${String(e.description).slice(0, 80)}` : ''}${e.source === 'petty_cash' ? ' (petty cash)' : ''}` },
          [[acc.id, amt], [A(credit), -amt]]);
      }

      // Petty cash float movements (spends are expenses above).
      for (const p of await trx('petty_cash_entries as e').join('petty_cash_funds as f', 'f.id', 'e.fund_id').where('e.tenant_id', tenantId).whereIn('e.kind', ['top_up', 'return'])
        .select('e.id', 'e.kind', 'e.amount', 'e.entry_date', 'e.academic_year', 'e.voided_at', 'e.created_at', 'f.name')) {
        const amt = p.voided_at ? 0 : cents(p.amount);
        const lines: Array<[string, number]> = p.kind === 'top_up' ? [[A('petty'), amt], [A('bank'), -amt]] : [[A('bank'), amt], [A('petty'), -amt]];
        add({ type: 'petty_cash', id: p.id, year: Y(p.academic_year), date: ymd(p.entry_date || p.created_at), change: ymd(p.voided_at), memo: `${p.kind === 'top_up' ? 'Petty cash top-up' : 'Petty cash returned to bank'}: ${p.name}` }, lines);
      }

      // Paid payroll runs.
      for (const r of await trx('payroll_runs').where({ tenant_id: tenantId }).whereIn('status', ['paid', 'cancelled'])
        .select('id', 'period', 'academic_year', 'status', 'gross', 'paye', 'nassit_employee', 'nassit_employer', 'other_deductions', 'payment_date', 'paid_at', 'updated_at')) {
        if (r.status === 'cancelled' && !r.paid_at) continue;
        const live = r.status === 'paid';
        const gross = live ? cents(r.gross) : 0, paye = live ? cents(r.paye) : 0;
        const ee = live ? cents(r.nassit_employee) : 0, er = live ? cents(r.nassit_employer) : 0, other = live ? cents(r.other_deductions) : 0;
        add({ type: 'payroll', id: r.id, year: Y(r.academic_year), date: ymd(r.payment_date || r.paid_at), change: ymd(r.updated_at), memo: `Payroll ${r.period}` }, [
          [A('exp:salaries'), gross], [A('exp:statutory (paye/nassit)'), er],
          [A('bank'), -(gross - paye - ee - other)], [A('paye'), -paye], [A('nassit'), -(ee + er)], [A('payded'), -other],
        ]);
      }

      // What is already posted, per document and account.
      const posted = new Map<string, { lines: Map<string, number>; student: string | null }>();
      for (const r of await trx('gl_lines as l').join('gl_entries as e', 'e.id', 'l.entry_id').where({ 'e.tenant_id': tenantId, 'e.kind': 'auto' })
        .groupBy('e.source_type', 'e.source_id', 'l.account_id')
        .select('e.source_type', 'e.source_id', 'l.account_id', db.raw('SUM(l.debit - l.credit) as net'), db.raw('MAX(l.student_id::text) as student'))) {
        const k = `${r.source_type}:${r.source_id}`;
        if (!posted.has(k)) posted.set(k, { lines: new Map(), student: r.student || null });
        const c = cents(r.net);
        if (c) posted.get(k)!.lines.set(r.account_id, c);
      }

      // Differences → entries.
      const firstOpen = lock ? addDays(lock, 1) : null;
      const out: Array<{ doc: Doc; date: string; diff: Map<string, number>; correction: boolean }> = [];
      for (const k of new Set([...docs.keys(), ...posted.keys()])) {
        const doc = docs.get(k);
        const was = posted.get(k)?.lines || new Map<string, number>();
        const want = doc?.lines || new Map<string, number>();
        const diff = new Map<string, number>();
        for (const acc of new Set([...want.keys(), ...was.keys()])) {
          const d = (want.get(acc) || 0) - (was.get(acc) || 0);
          if (d) diff.set(acc, d);
        }
        if (!diff.size) continue;
        const correction = was.size > 0;
        let date = (correction ? doc?.change : doc?.date) || today;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = today;
        if (date > today) date = today;
        if (firstOpen && date < firstOpen) date = firstOpen;
        const [type, id] = k.split(':');
        out.push({
          doc: doc || { type, id, date, change: null, memo: 'Source record removed', student: posted.get(k)?.student, lines: new Map() },
          date, diff, correction,
        });
      }
      // Keep every automatic entry in its record's academic year (a fee moved to another year follows).
      const tags: string[][] = Array.from(docs.values()).filter((d) => d.year).map((d) => [d.type, d.id, d.year as string]);
      for (let i = 0; i < tags.length; i += 500) {
        const chunk = tags.slice(i, i + 500);
        await trx.raw(
          `UPDATE gl_entries e SET academic_year = v.y FROM (VALUES ${chunk.map(() => '(?, ?::uuid, ?)').join(', ')}) AS v(t, id, y)
           WHERE e.tenant_id = ? AND e.kind = 'auto' AND e.source_type = v.t AND e.source_id = v.id AND e.academic_year IS DISTINCT FROM v.y`,
          [...chunk.flat(), tenantId],
        );
      }
      if (!out.length) return { posted: 0, documents: docs.size };

      let n = await reserveNumbers(trx, tenantId, out.length);
      for (let i = 0; i < out.length; i += 400) {
        const chunk = out.slice(i, i + 400);
        const entries = chunk.map((o) => ({
          tenant_id: tenantId, entry_no: entryNo(n++), entry_date: o.date, academic_year: o.doc.year || yearOf(o.date),
          memo: o.correction ? `Correction: ${o.doc.memo}` : o.doc.memo, kind: 'auto', source_type: o.doc.type, source_id: o.doc.id,
        }));
        const ids: Array<{ id: string }> = await trx('gl_entries').insert(entries).returning('id');
        const lines: any[] = [];
        chunk.forEach((o, j) => {
          for (const [acc, c] of o.diff) {
            lines.push({ entry_id: ids[j].id, tenant_id: tenantId, account_id: acc, debit: c > 0 ? c / 100 : 0, credit: c < 0 ? -c / 100 : 0, student_id: o.doc.student || null });
          }
        });
        for (let x = 0; x < lines.length; x += 1000) await trx('gl_lines').insert(lines.slice(x, x + 1000));
      }
      return { posted: out.length, documents: docs.size };
    });
    lastSync.set(tenantId, Date.now());
    return result;
  },

  /** Daily: post for every active school that has opened its books. */
  async syncAll() {
    const tenants = await db('tenants as t').where('t.status', 'active')
      .whereExists(db('gl_accounts as a').whereRaw('a.tenant_id = t.id').select(db.raw('1'))).select('t.id');
    const out: any[] = [];
    for (const t of tenants) {
      try { out.push({ tenantId: t.id, ...(await this.sync(t.id)) }); } catch (e: any) { out.push({ tenantId: t.id, error: String(e?.message || e) }); }
    }
    return out;
  },

  // ── Manual journals ───────────────────────────────────────────────────────
  async postManual(tenantId: string, userId: string, body: any, opts: { trx?: Knex.Transaction; allowControl?: boolean } = {}) {
    await this.ensureChart(tenantId);
    const date = String(body?.entry_date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AppError('Set the date of the journal.', 400, 'VALIDATION_ERROR');
    if (date > await tenantToday(tenantId)) throw new AppError('A journal cannot be dated in the future.', 400, 'VALIDATION_ERROR');
    const lock = await this.lockDate(tenantId);
    if (lock && date <= lock) throw new AppError(`The books are closed up to ${lock}. Date the journal after that.`, 409, 'BOOKS_LOCKED');
    const memo = String(body?.memo || '').trim();
    if (memo.length < 3) throw new AppError('Describe the journal (at least 3 characters).', 400, 'VALIDATION_ERROR');
    const raw = Array.isArray(body?.lines) ? body.lines : [];
    const lines = raw
      .map((l: any) => ({ account_id: String(l?.account_id || ''), debit: cents(l?.debit), credit: cents(l?.credit), memo: l?.memo ? String(l.memo).trim().slice(0, 300) : null }))
      .filter((l: any) => l.account_id && (l.debit || l.credit));
    if (lines.length < 2) throw new AppError('A journal needs at least two lines.', 400, 'VALIDATION_ERROR');
    for (const l of lines) {
      if (l.debit < 0 || l.credit < 0 || (l.debit && l.credit)) throw new AppError('Each line is either a debit or a credit, above 0.', 400, 'VALIDATION_ERROR');
      if (l.debit > 1e13 || l.credit > 1e13) throw new AppError('An amount is too large.', 400, 'VALIDATION_ERROR');
    }
    const dr = lines.reduce((s: number, l: any) => s + l.debit, 0), cr = lines.reduce((s: number, l: any) => s + l.credit, 0);
    if (dr !== cr) throw new AppError(`Debits (Le ${(dr / 100).toFixed(2)}) must equal credits (Le ${(cr / 100).toFixed(2)}).`, 400, 'UNBALANCED');
    const q = opts.trx || db;
    const accs = await q('gl_accounts').where({ tenant_id: tenantId }).whereIn('id', Array.from(new Set(lines.map((l: any) => l.account_id))));
    const byId = new Map(accs.map((a: any) => [a.id, a]));
    for (const l of lines) {
      const a: any = byId.get(l.account_id);
      if (!a) throw new AppError('One of the accounts was not found.', 400, 'VALIDATION_ERROR');
      if (!a.is_active) throw new AppError(`${a.code} ${a.name} is inactive.`, 400, 'VALIDATION_ERROR');
      if (!opts.allowControl && CONTROL_KEYS.has(a.system_key)) {
        throw new AppError(`${a.name} is kept by the fees / petty cash records. Use those pages instead of a journal.`, 400, 'CONTROL_ACCOUNT');
      }
    }
    const run = async (trx: Knex.Transaction) => {
      const n = await reserveNumbers(trx, tenantId, 1);
      const [e] = await trx('gl_entries').insert({
        tenant_id: tenantId, entry_no: entryNo(n), entry_date: date, academic_year: (await yearResolver(tenantId))(date),
        memo: memo.slice(0, 500), kind: 'manual', source_type: 'manual', created_by: userId,
      }).returning('*');
      const rows = await trx('gl_lines').insert(lines.map((l: any) => ({ entry_id: e.id, tenant_id: tenantId, account_id: l.account_id, debit: l.debit / 100, credit: l.credit / 100, memo: l.memo }))).returning('*');
      return { ...e, lines: rows };
    };
    const entry = opts.trx ? await run(opts.trx) : await db.transaction(run);
    await audit('gl_entry', entry.id, 'manual', userId, { entry_no: entry.entry_no, date, memo, total: dr / 100 });
    return entry;
  },

  async reverse(tenantId: string, userId: string, id: string, reason: string) {
    if (String(reason || '').trim().length < 5) throw new AppError('Give a reason (at least 5 characters).', 400, 'VALIDATION_ERROR');
    const today = await tenantToday(tenantId);
    const lock = await this.lockDate(tenantId);
    if (lock && today <= lock) throw new AppError(`The books are closed up to ${lock}.`, 409, 'BOOKS_LOCKED');
    const out = await db.transaction(async (trx) => {
      const e = await trx('gl_entries').where({ id, tenant_id: tenantId }).forUpdate().first();
      if (!e) throw new AppError('Journal entry not found', 404, 'NOT_FOUND');
      if (e.kind !== 'manual') throw new AppError('Automatic entries follow their source record. Change the fee, payment or expense instead.', 409, 'AUTO_ENTRY');
      if (e.reversed_by_id) throw new AppError('This journal was already reversed.', 409, 'CONFLICT');
      if (e.reverses_id) throw new AppError('This entry is itself a reversal.', 409, 'CONFLICT');
      if (await trx('bank_matches as m').join('gl_lines as l', 'l.id', 'm.gl_line_id').where('l.entry_id', id).first()) {
        throw new AppError('A line of this journal is matched on a bank reconciliation. Unmatch it first.', 409, 'MATCHED');
      }
      const lines = await trx('gl_lines').where({ entry_id: id });
      const n = await reserveNumbers(trx, tenantId, 1);
      const [r] = await trx('gl_entries').insert({
        tenant_id: tenantId, entry_no: entryNo(n), entry_date: today, academic_year: (await yearResolver(tenantId))(today),
        memo: `Reversal of ${e.entry_no}: ${String(reason).trim().slice(0, 300)}`, kind: 'manual', source_type: 'manual', reverses_id: e.id, created_by: userId,
      }).returning('*');
      await trx('gl_lines').insert(lines.map((l: any) => ({ entry_id: r.id, tenant_id: tenantId, account_id: l.account_id, debit: l.credit, credit: l.debit, memo: l.memo })));
      await trx('gl_entries').where({ id }).update({ reversed_by_id: r.id, reverse_reason: String(reason).trim().slice(0, 500) });
      return r;
    });
    await audit('gl_entry', id, 'reverse', userId, { reversal: out.entry_no, reason });
    return out;
  },

  // ── Accounts ──────────────────────────────────────────────────────────────
  async saveAccount(tenantId: string, userId: string, body: any, id?: string) {
    await this.ensureChart(tenantId);
    const code = String(body?.code ?? '').trim();
    const name = String(body?.name ?? '').trim().replace(/\s+/g, ' ');
    if (!/^\d{3,6}$/.test(code)) throw new AppError('The account code is 3–6 digits, e.g. 1200.', 400, 'VALIDATION_ERROR');
    if (name.length < 2 || name.length > 120) throw new AppError('Give the account a name (2–120 characters).', 400, 'VALIDATION_ERROR');
    const clash = await db('gl_accounts').where({ tenant_id: tenantId, code }).modify((q) => { if (id) q.whereNot('id', id); }).first();
    if (clash) throw new AppError(`Code ${code} is already used by ${clash.name}.`, 409, 'DUPLICATE');
    const description = body?.description ? String(body.description).trim().slice(0, 500) : null;
    if (!id) {
      const type = String(body?.type || '') as AccType;
      if (!ACCOUNT_TYPES.includes(type)) throw new AppError('Choose the account type.', 400, 'VALIDATION_ERROR');
      const subtype = type === 'asset' && body?.subtype === 'cash' ? 'cash' : null;
      const [a] = await db('gl_accounts').insert({ tenant_id: tenantId, code, name, type, subtype, description, is_system: false }).returning('*');
      await audit('gl_account', a.id, 'create', userId, { code, name, type, subtype });
      return a;
    }
    const a = await db('gl_accounts').where({ id, tenant_id: tenantId }).first();
    if (!a) throw new AppError('Account not found', 404, 'NOT_FOUND');
    const patch: any = { code, name, description, updated_at: new Date() };
    if (body?.is_active !== undefined) {
      const active = body.is_active !== false;
      if (!active && a.is_system) throw new AppError('Standard accounts cannot be switched off.', 409, 'SYSTEM_ACCOUNT');
      patch.is_active = active;
    }
    const [row] = await db('gl_accounts').where({ id }).update(patch).returning('*');
    await audit('gl_account', id, 'update', userId, { before: { code: a.code, name: a.name, is_active: a.is_active }, after: patch });
    return row;
  },
};

export default glService;
