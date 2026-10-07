/**
 * Financial statements from the journal (bursar Phase C, R5): trial balance,
 * income statement, balance sheet, cash flow (direct method), general ledger,
 * integrity checks. Every read syncs the automatic postings first.
 *
 * No year-end closing entries are posted: the trial balance carries prior
 * periods' net result as "Accumulated surplus b/f", and the balance sheet adds
 * the accumulated surplus to equity, so both always balance.
 */
import { db } from '@utils/database';
import { AppError } from '@middleware/errorHandler';
import { tenantToday } from '@utils/schoolDate';
import { normalizeAcademicYear, resolveActiveYear } from '@utils/academicYear';
import { round2 } from './core';
import { glService } from './glService';

const cents = (n: any) => Math.round((Number(n) || 0) * 100);
const le = (c: number) => round2(c / 100);
const isDate = (v: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const debitNormal = (t: string) => t === 'asset' || t === 'expense';

/**
 * academic_year set → "year mode": entries are picked by the year they belong
 * to (a fee's own year, an expense's year, a payment's year of arrival), not by
 * session dates, so a past year's records never land in the current year.
 * Otherwise "date mode": from / to on the entry date.
 */
export type Range = { from: string | null; to: string; academic_year: string | null; label: string; as_at: string };

/** A date range from ?from&to, else an academic year (default: the active one). */
export async function rangeFor(tenantId: string, q: any): Promise<Range> {
  const today = await tenantToday(tenantId);
  if (isDate(q?.from) || isDate(q?.to)) {
    const from = isDate(q.from) ? String(q.from) : null;
    const to = isDate(q.to) ? String(q.to) : today;
    if (from && from > to) throw new AppError('The start date is after the end date.', 400, 'VALIDATION_ERROR');
    return { from, to, academic_year: null, label: `${from || 'Start'} to ${to}`, as_at: to };
  }
  const active = (await resolveActiveYear(tenantId)).yearString;
  const year = normalizeAcademicYear(q?.academic_year || null) || active;
  if (!year || !/^\d{4}\/\d{4}$/.test(year)) return { from: null, to: today, academic_year: null, label: `To ${today}`, as_at: today };
  return { from: null, to: today, academic_year: year, label: `Academic year ${year}`, as_at: active && year < active ? `end of ${year}` : today };
}

/** SQL pieces for a range: rows in scope, before the period, in the period. */
function scopeSql(r: Range) {
  if (r.academic_year) {
    const y = r.academic_year;
    return {
      base: [`COALESCE(e.academic_year, '') <= ?`, [y]] as [string, any[]],
      before: [`COALESCE(e.academic_year, '') < ?`, [y]] as [string, any[]],
      inPeriod: [`e.academic_year = ?`, [y]] as [string, any[]],
    };
  }
  return {
    base: [`e.entry_date <= ?::date`, [r.to]] as [string, any[]],
    before: [`(?::date IS NOT NULL AND e.entry_date < ?::date)`, [r.from, r.from]] as [string, any[]],
    inPeriod: [`(?::date IS NULL OR e.entry_date >= ?::date)`, [r.from, r.from]] as [string, any[]],
  };
}

type Bal = { id: string; code: string; name: string; type: string; subtype: string | null; system_key: string | null; is_active: boolean; is_system: boolean; opening: number; dr: number; cr: number; closing: number };

/** Per account: opening (before the period), period debits/credits, closing. Cents, debit-positive. */
async function balances(tenantId: string, range: Range): Promise<Bal[]> {
  const sq = scopeSql(range);
  const rows = await db('gl_accounts as a')
    .leftJoin(
      db('gl_lines as l').join('gl_entries as e', 'e.id', 'l.entry_id').where('l.tenant_id', tenantId).whereRaw(sq.base[0], sq.base[1])
        .groupBy('l.account_id')
        .select('l.account_id',
          db.raw(`SUM(CASE WHEN ${sq.before[0]} THEN l.debit - l.credit ELSE 0 END) as opening`, sq.before[1]),
          db.raw(`SUM(CASE WHEN ${sq.inPeriod[0]} THEN l.debit ELSE 0 END) as dr`, sq.inPeriod[1]),
          db.raw(`SUM(CASE WHEN ${sq.inPeriod[0]} THEN l.credit ELSE 0 END) as cr`, sq.inPeriod[1]),
          db.raw('SUM(l.debit - l.credit) as closing'))
        .as('b'),
      'b.account_id', 'a.id')
    .where('a.tenant_id', tenantId)
    .orderBy('a.code')
    .select('a.id', 'a.code', 'a.name', 'a.type', 'a.subtype', 'a.system_key', 'a.is_active', 'a.is_system', 'b.opening', 'b.dr', 'b.cr', 'b.closing');
  return rows.map((r: any) => ({ ...r, opening: cents(r.opening), dr: cents(r.dr), cr: cents(r.cr), closing: cents(r.closing) }));
}

const isCash = (a: { subtype: string | null }) => a.subtype === 'cash';

export const glReportService = {
  async prepare(tenantId: string, q: any) {
    await glService.ensureSynced(tenantId);
    return rangeFor(tenantId, q);
  },

  /** Balance-sheet accounts: balance now. Income / expense accounts: this academic year. */
  async accounts(tenantId: string) {
    await glService.ensureSynced(tenantId);
    const range = await rangeFor(tenantId, {});
    const rows = await balances(tenantId, range);
    const used = new Set((await db('gl_lines').where({ tenant_id: tenantId }).distinct('account_id')).map((r: any) => r.account_id));
    return rows.map((a) => ({
      id: a.id, code: a.code, name: a.name, type: a.type, subtype: a.subtype, system_key: a.system_key, is_active: a.is_active,
      is_system: !!a.is_system,
      control: ['ar', 'credit', 'petty'].includes(String(a.system_key)),
      balance: (() => { const pl = a.type === 'income' || a.type === 'expense'; const v = pl ? a.dr - a.cr : a.closing; return le(debitNormal(a.type) ? v : -v); })(),
      period: a.type === 'income' || a.type === 'expense' ? range.academic_year : null,
      has_activity: used.has(a.id),
    }));
  },

  async trialBalance(tenantId: string, q: any) {
    const range = await this.prepare(tenantId, q);
    const rows = await balances(tenantId, range);
    let prior = 0;
    const lines: any[] = [];
    for (const a of rows) {
      const pl = a.type === 'income' || a.type === 'expense';
      if (pl) prior += a.opening;
      const bal = pl ? a.dr - a.cr : a.closing;
      if (!bal && !a.dr && !a.cr) continue;
      lines.push({ account_id: a.id, code: a.code, name: a.name, type: a.type, debit: bal > 0 ? le(bal) : 0, credit: bal < 0 ? le(-bal) : 0 });
    }
    if (prior) lines.push({ account_id: null, code: '—', name: range.academic_year ? 'Accumulated surplus from earlier years' : 'Accumulated surplus brought forward', type: 'equity', debit: prior > 0 ? le(prior) : 0, credit: prior < 0 ? le(-prior) : 0 });
    const td = lines.reduce((s, l) => s + cents(l.debit), 0), tc = lines.reduce((s, l) => s + cents(l.credit), 0);
    return { range, lines, total_debit: le(td), total_credit: le(tc), balanced: td === tc };
  },

  async incomeStatement(tenantId: string, q: any) {
    const range = await this.prepare(tenantId, q);
    const rows = await balances(tenantId, range);
    const income = rows.filter((a) => a.type === 'income' && (a.dr || a.cr)).map((a) => ({ account_id: a.id, code: a.code, name: a.name, contra: a.subtype === 'contra', amount: le(a.cr - a.dr) }));
    const expenses = rows.filter((a) => a.type === 'expense' && (a.dr || a.cr)).map((a) => ({ account_id: a.id, code: a.code, name: a.name, amount: le(a.dr - a.cr) }));
    const ti = income.reduce((s, l) => s + cents(l.amount), 0), te = expenses.reduce((s, l) => s + cents(l.amount), 0);
    const gross = income.filter((l) => !l.contra).reduce((s, l) => s + cents(l.amount), 0);
    return { range, income, expenses, gross_income: le(gross), discounts: le(gross - ti), total_income: le(ti), total_expenses: le(te), surplus: le(ti - te) };
  },

  async balanceSheet(tenantId: string, q: any) {
    const range = await this.prepare(tenantId, q);
    const rows = await balances(tenantId, range);
    const pick = (t: string) => rows.filter((a) => a.type === t && a.closing).map((a) => ({ account_id: a.id, code: a.code, name: a.name, amount: le(debitNormal(t) ? a.closing : -a.closing) }));
    const assets = pick('asset'), liabilities = pick('liability'), equity = pick('equity');
    const surplus = -rows.filter((a) => a.type === 'income' || a.type === 'expense').reduce((s, a) => s + a.closing, 0);
    if (surplus) equity.push({ account_id: null as any, code: '—', name: 'Accumulated surplus (deficit)', amount: le(surplus) });
    const sum = (l: any[]) => l.reduce((s, x) => s + cents(x.amount), 0);
    const ta = sum(assets), tl = sum(liabilities), teq = sum(equity);
    return { range, as_at: range.as_at, assets, liabilities, equity, total_assets: le(ta), total_liabilities: le(tl), total_equity: le(teq), balanced: ta === tl + teq };
  },

  async cashFlow(tenantId: string, q: any) {
    const range = await this.prepare(tenantId, q);
    const accs = await db('gl_accounts').where({ tenant_id: tenantId }).select('id', 'type', 'subtype', 'system_key', 'name');
    const byId = new Map(accs.map((a: any) => [a.id, a]));
    const cashIds = accs.filter(isCash).map((a: any) => a.id);
    const bal = await balances(tenantId, range);
    const sq = scopeSql(range);
    const opening = bal.filter(isCash).reduce((s, a) => s + a.opening, 0);
    const closing = bal.filter(isCash).reduce((s, a) => s + a.closing, 0);

    const lines = await db('gl_lines as l').join('gl_entries as e', 'e.id', 'l.entry_id')
      .where('e.tenant_id', tenantId).whereRaw(sq.base[0], sq.base[1]).whereRaw(sq.inPeriod[0], sq.inPeriod[1])
      .whereIn('e.id', db('gl_lines').whereIn('account_id', cashIds.length ? cashIds : ['00000000-0000-0000-0000-000000000000']).select('entry_id'))
      .select('e.id as entry_id', 'e.source_type', 'l.account_id', 'l.debit', 'l.credit');
    const byEntry = new Map<string, { source: string; lines: any[] }>();
    for (const l of lines) {
      if (!byEntry.has(l.entry_id)) byEntry.set(l.entry_id, { source: l.source_type, lines: [] });
      byEntry.get(l.entry_id)!.lines.push(l);
    }
    const SECTIONS: Record<string, 'operating' | 'investing' | 'financing'> = {
      'Fees received from families': 'operating', 'Refunds paid to families': 'operating', 'Net salaries paid': 'operating',
      'PAYE, NASSIT and payroll deductions paid': 'operating', 'Operating expenses paid': 'operating', 'Other income received': 'operating',
      'Assets bought or sold': 'investing', 'Loans and other liabilities': 'financing', 'Capital and opening funds': 'financing',
    };
    const totals = new Map<string, number>();
    for (const { source, lines: ls } of byEntry.values()) {
      const net = ls.filter((l) => cashIds.includes(l.account_id)).reduce((s, l) => s + cents(l.debit) - cents(l.credit), 0);
      if (!net) continue; // transfers between cash accounts
      let label: string;
      if (source === 'payment') label = 'Fees received from families';
      else if (source === 'refund' || source === 'credit') label = 'Refunds paid to families';
      else if (source === 'payroll') label = 'Net salaries paid';
      else if (source === 'expense') label = 'Operating expenses paid';
      else {
        const others = ls.filter((l) => !cashIds.includes(l.account_id)).map((l) => byId.get(l.account_id)).filter(Boolean) as any[];
        const keys = others.map((a) => a.system_key);
        if (keys.some((k) => ['paye', 'nassit', 'payded'].includes(k))) label = 'PAYE, NASSIT and payroll deductions paid';
        else if (others.some((a) => a.type === 'expense')) label = 'Operating expenses paid';
        else if (others.some((a) => a.type === 'income')) label = 'Other income received';
        else if (others.some((a) => a.type === 'asset')) label = 'Assets bought or sold';
        else if (others.some((a) => a.type === 'equity')) label = 'Capital and opening funds';
        else label = 'Loans and other liabilities';
      }
      totals.set(label, (totals.get(label) || 0) + net);
    }
    const section = (s: string) => Object.entries(SECTIONS).filter(([, v]) => v === s).map(([k]) => ({ label: k, amount: le(totals.get(k) || 0) })).filter((x) => x.amount !== 0);
    const sum = (l: any[]) => l.reduce((x, y) => x + cents(y.amount), 0);
    const operating = section('operating'), investing = section('investing'), financing = section('financing');
    const net = sum(operating) + sum(investing) + sum(financing);
    return {
      range, opening_cash: le(opening), operating, investing, financing,
      net_operating: le(sum(operating)), net_investing: le(sum(investing)), net_financing: le(sum(financing)),
      net_change: le(net), closing_cash: le(closing), balanced: opening + net === closing,
    };
  },

  async ledger(tenantId: string, accountId: string, q: any) {
    const range = await this.prepare(tenantId, q);
    const a = await db('gl_accounts').where({ id: accountId, tenant_id: tenantId }).first();
    if (!a) throw new AppError('Account not found', 404, 'NOT_FOUND');
    const sign = debitNormal(a.type) ? 1 : -1;
    const sq = scopeSql(range);
    const op = await db('gl_lines as l').join('gl_entries as e', 'e.id', 'l.entry_id').where({ 'l.account_id': accountId, 'l.tenant_id': tenantId })
      .whereRaw(sq.before[0], sq.before[1]).sum({ s: db.raw('l.debit - l.credit') }).first();
    let run = cents((op as any)?.s) * sign;
    const opening = run;
    const rows = await db('gl_lines as l').join('gl_entries as e', 'e.id', 'l.entry_id')
      .where({ 'l.account_id': accountId, 'l.tenant_id': tenantId }).whereRaw(sq.base[0], sq.base[1]).whereRaw(sq.inPeriod[0], sq.inPeriod[1])
      .orderBy('e.entry_date').orderBy('e.entry_no')
      .limit(5000)
      .select('l.id', 'e.id as entry_id', 'e.entry_no', 'e.entry_date', 'e.memo', 'e.kind', 'e.source_type', 'l.memo as line_memo', 'l.debit', 'l.credit');
    const lines = rows.map((r: any) => {
      run += (cents(r.debit) - cents(r.credit)) * sign;
      return { ...r, entry_date: String(r.entry_date instanceof Date ? r.entry_date.toISOString() : r.entry_date).slice(0, 10), debit: round2(r.debit), credit: round2(r.credit), balance: le(run) };
    });
    return { range, account: { id: a.id, code: a.code, name: a.name, type: a.type }, opening: le(opening), closing: le(run), lines, truncated: rows.length >= 5000 };
  },

  /** Sub-ledgers agree with their control accounts; the books balance. */
  async integrity(tenantId: string) {
    await glService.ensureSynced(tenantId);
    const today = await tenantToday(tenantId);
    const rows = await balances(tenantId, { from: null, to: today, academic_year: null, label: '', as_at: today });
    const k = (key: string) => rows.find((a) => a.system_key === key);
    const fees = await db('fees').where({ tenant_id: tenantId }).whereNot('status', 'deleted').sum({ s: db.raw('COALESCE(balance, amount)') }).first();
    const credits = await db('student_credits').where({ tenant_id: tenantId }).sum({ s: 'amount' }).first();
    const petty = await db('petty_cash_entries').where({ tenant_id: tenantId }).whereNull('voided_at')
      .sum({ s: db.raw("CASE WHEN kind = 'top_up' THEN amount ELSE -amount END") }).first();
    const all = rows.reduce((s, a) => s + a.closing, 0);
    const check = (label: string, book: number, sub: number, hint: string) => ({ label, books: le(book), records: le(sub), difference: le(book - sub), ok: book === sub, hint });
    return {
      as_at: today,
      balanced: all === 0,
      checks: [
        check('Fees receivable vs students\' balances', k('ar')?.closing || 0, cents((fees as any)?.s), 'Total owed on the fee records.'),
        check('Student credit vs credit balances', -(k('credit')?.closing || 0), cents((credits as any)?.s), 'Credit held for families (overpayments, credit notes).'),
        check('Petty cash vs fund balances', k('petty')?.closing || 0, cents((petty as any)?.s), 'Cash in the petty cash funds.'),
      ],
    };
  },
};

export default glReportService;
