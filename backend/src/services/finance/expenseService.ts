/**
 * School expenses (bursar Phase B, R1). Void, never delete. Expenses created
 * by petty cash or payroll are linked to their source and voided from there.
 */
import type { Knex } from 'knex';
import { db } from '@utils/database';
import { AppError } from '@middleware/errorHandler';
import { normalizeAcademicYear, resolveActiveYear } from '@utils/academicYear';
import { tenantToday } from '@utils/schoolDate';
import { round2, audit } from './core';

export const EXPENSE_CATEGORIES = [
  'Salaries', 'Statutory (PAYE/NASSIT)', 'Utilities', 'Supplies', 'Maintenance', 'Transport',
  'Food & Catering', 'Rent', 'Events', 'Administration', 'Other',
] as const;
/**
 * A category is one of the standard ones, or (via "Other") the school's own
 * name for it, e.g. "Security uniforms". Custom names are 2–60 characters.
 */
export function cleanCategory(raw: unknown): string {
  const c = String(raw ?? '').trim().replace(/\s+/g, ' ');
  const known = EXPENSE_CATEGORIES.find((k) => k.toLowerCase() === c.toLowerCase());
  if (known) return known;
  if (c.length < 2 || c.length > 60) {
    throw new AppError('Choose a category, or pick "Other" and type a name (2–60 characters).', 400, 'VALIDATION_ERROR');
  }
  return c;
}

export const PAY_METHODS = ['cash', 'bank_transfer', 'cheque', 'mobile_money'];
const TERMS = ['first_term', 'second_term', 'third_term'];

/** The academic year a date falls in (session start ≤ date < next session start). */
export async function yearForDate(tenantId: string, ymd: string): Promise<string> {
  const sessions = await db('academic_sessions').where({ tenant_id: tenantId }).whereNotNull('start_date').select('name', 'start_date');
  const sorted = sessions
    .map((s: any) => ({ y: normalizeAcademicYear(s.name), start: String(s.start_date instanceof Date ? s.start_date.toISOString() : s.start_date).slice(0, 10) }))
    .filter((s) => s.y && /^\d{4}\/\d{4}$/.test(s.y))
    .sort((a, b) => a.start.localeCompare(b.start));
  let hit: string | null = null;
  for (const s of sorted) if (s.start <= ymd) hit = s.y!;
  return hit || sorted[0]?.y || (await resolveActiveYear(tenantId)).yearString;
}

/** Past academic years are read-only for new spending records. */
export async function assertOpenYear(tenantId: string, year: string, what = 'expenses') {
  const active = (await resolveActiveYear(tenantId)).yearString;
  if (active && year && year < active) {
    throw new AppError(`${year} is a past academic year and is closed. Record ${what} in ${active}.`, 409, 'PAST_YEAR_READ_ONLY');
  }
}

async function cleanInput(tenantId: string, body: any, partialOf?: any) {
  const b = { ...(partialOf || {}), ...(body || {}) };
  const category = cleanCategory(b.category);
  const amount = round2(Number(b.amount));
  if (!(amount > 0) || amount > 1e10) throw new AppError('Enter an amount above 0.', 400, 'VALIDATION_ERROR');
  const date = String(b.expense_date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AppError('Set the date of the expense.', 400, 'VALIDATION_ERROR');
  const today = await tenantToday(tenantId);
  if (date > today) throw new AppError('An expense date cannot be in the future.', 400, 'VALIDATION_ERROR');
  const year = await yearForDate(tenantId, date);
  await assertOpenYear(tenantId, year);
  const method = b.payment_method ? String(b.payment_method) : null;
  if (method && !PAY_METHODS.includes(method)) throw new AppError(`Payment method must be one of: ${PAY_METHODS.join(', ')}`, 400, 'VALIDATION_ERROR');
  const term = b.term ? String(b.term) : null;
  if (term && !TERMS.includes(term)) throw new AppError('Choose a valid term.', 400, 'VALIDATION_ERROR');
  const str = (v: any, n: number) => (v == null || String(v).trim() === '' ? null : String(v).trim().slice(0, n));
  return {
    category, amount, expense_date: date, academic_year: year, term,
    description: str(b.description, 1000), vendor: str(b.vendor, 150), payment_method: method,
    reference: str(b.reference, 100), receipt_url: b.receipt_url ? String(b.receipt_url) : null, department: str(b.department, 100),
  };
}

export const expenseService = {
  async list(tenantId: string, f: { year?: string; category?: string; term?: string; source?: string; includeVoided?: boolean }) {
    const year = normalizeAcademicYear(f.year || null) || (await resolveActiveYear(tenantId)).yearString;
    const q = db('school_expenses as e').leftJoin('users as u', 'u.id', 'e.recorded_by')
      .where('e.tenant_id', tenantId).where('e.academic_year', year)
      .select('e.*', db.raw("TRIM(CONCAT_WS(' ', u.first_name, u.last_name)) as recorded_by_name"))
      .orderBy('e.expense_date', 'desc').orderBy('e.created_at', 'desc');
    if (f.category) q.where('e.category', f.category);
    if (f.term) q.where('e.term', f.term);
    if (f.source) q.where('e.source', f.source);
    if (!f.includeVoided) q.whereNull('e.voided_at');
    const rows = (await q.limit(2000)).map((r: any) => ({ ...r, amount: round2(r.amount) }));
    const byCat = await db('school_expenses').where({ tenant_id: tenantId, academic_year: year }).whereNull('voided_at')
      .groupBy('category').select('category', db.raw('SUM(amount) as total'));
    return {
      academic_year: year,
      rows,
      total: round2(rows.filter((r: any) => !r.voided_at).reduce((s: number, r: any) => s + r.amount, 0)),
      by_category: byCat.map((r: any) => ({ category: r.category, total: round2(r.total) })).sort((a: any, b: any) => b.total - a.total),
    };
  },

  /** Budget left for a category this year (null = no approved line). */
  async budgetHeadroom(tenantId: string, year: string, category: string, department?: string | null): Promise<{ budget: number; spent: number } | null> {
    const lines = await db('budget_lines as l').join('budgets as b', 'b.id', 'l.budget_id')
      .where({ 'b.tenant_id': tenantId, 'b.academic_year': year, 'l.category': category }).select('l.amount', 'l.department');
    const match = lines.filter((l: any) => !department || !l.department || l.department === department);
    if (!match.length) return null;
    const budget = round2(match.reduce((s: number, l: any) => s + Number(l.amount), 0));
    const sq = db('school_expenses').where({ tenant_id: tenantId, academic_year: year, category }).whereNull('voided_at');
    const spent = round2(Number((await sq.sum({ s: 'amount' }).first() as any)?.s) || 0);
    return { budget, spent };
  },

  async create(tenantId: string, userId: string, body: any) {
    const v = await cleanInput(tenantId, body);
    const [row] = await db('school_expenses').insert({ ...v, tenant_id: tenantId, recorded_by: userId, source: 'manual' }).returning('*');
    await audit('expense', row.id, 'create', userId, v);
    const h = await this.budgetHeadroom(tenantId, v.academic_year, v.category, v.department);
    const warning = h && h.spent > h.budget ? `${v.category} is now over budget for ${v.academic_year}: Le ${h.spent.toFixed(2)} spent of Le ${h.budget.toFixed(2)}.` : null;
    return { ...row, budget_warning: warning };
  },

  async update(tenantId: string, userId: string, id: string, body: any) {
    const existing = await db('school_expenses').where({ id, tenant_id: tenantId }).first();
    if (!existing) throw new AppError('Expense not found', 404, 'NOT_FOUND');
    if (existing.voided_at) throw new AppError('This expense is void.', 409, 'CONFLICT');
    if (existing.source !== 'manual') throw new AppError('This expense comes from petty cash or payroll. Change it there.', 409, 'LINKED_EXPENSE');
    await assertOpenYear(tenantId, existing.academic_year);
    const v = await cleanInput(tenantId, body, {
      ...existing, expense_date: String(existing.expense_date instanceof Date ? existing.expense_date.toISOString() : existing.expense_date).slice(0, 10),
    });
    const [row] = await db('school_expenses').where({ id }).update({ ...v, updated_at: new Date() }).returning('*');
    await audit('expense', id, 'update', userId, { before: existing, after: v });
    return row;
  },

  async void(tenantId: string, userId: string, id: string, reason: string) {
    if (String(reason || '').trim().length < 5) throw new AppError('Give a reason (at least 5 characters).', 400, 'VALIDATION_ERROR');
    const e = await db('school_expenses').where({ id, tenant_id: tenantId }).first();
    if (!e) throw new AppError('Expense not found', 404, 'NOT_FOUND');
    if (e.voided_at) throw new AppError('This expense is already void.', 409, 'CONFLICT');
    if (e.source !== 'manual') throw new AppError('This expense comes from petty cash or payroll. Void it there.', 409, 'LINKED_EXPENSE');
    await assertOpenYear(tenantId, e.academic_year);
    await db('school_expenses').where({ id }).update({ voided_at: new Date(), voided_by: userId, void_reason: reason.trim().slice(0, 500), updated_at: new Date() });
    await audit('expense', id, 'void', userId, { reason });
    return { id, voided: true };
  },

  /** An expense owned by another record (petty cash spend, payroll run). */
  async createLinked(trx: Knex.Transaction, row: { tenant_id: string; category: string; amount: number; expense_date: string; academic_year: string; description: string; source: 'petty_cash' | 'payroll'; source_id: string; recorded_by: string; payment_method?: string | null; vendor?: string | null; receipt_url?: string | null }) {
    const [e] = await trx('school_expenses').insert({ ...row, amount: round2(row.amount) }).returning('*');
    return e;
  },

  async voidLinked(trx: Knex.Transaction, tenantId: string, source: string, sourceId: string, userId: string, reason: string) {
    return trx('school_expenses').where({ tenant_id: tenantId, source, source_id: sourceId }).whereNull('voided_at')
      .update({ voided_at: new Date(), voided_by: userId, void_reason: reason.slice(0, 500), updated_at: new Date() });
  },
};

export default expenseService;
