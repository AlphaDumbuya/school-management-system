/**
 * Budgets (bursar Phase B, R3): one per academic year, lines per category
 * (optionally per department). Budget vs actual reads non-voided expenses.
 * Editing an approved budget returns it to draft (audited).
 */
import { db } from '@utils/database';
import { AppError } from '@middleware/errorHandler';
import { normalizeAcademicYear, resolveActiveYear } from '@utils/academicYear';
import { round2, audit, notifyFinanceStaff } from './core';
import { cleanCategory, assertOpenYear } from './expenseService';

export const budgetService = {
  async get(tenantId: string, rawYear?: string) {
    const year = normalizeAcademicYear(rawYear || null) || (await resolveActiveYear(tenantId)).yearString;
    const budget = await db('budgets as b').leftJoin('users as u', 'u.id', 'b.approved_by')
      .where({ 'b.tenant_id': tenantId, 'b.academic_year': year })
      .select('b.*', db.raw("TRIM(CONCAT_WS(' ', u.first_name, u.last_name)) as approved_by_name")).first();
    const lines = budget ? await db('budget_lines').where({ budget_id: budget.id }).orderBy('category') : [];
    const spentRows = await db('school_expenses').where({ tenant_id: tenantId, academic_year: year }).whereNull('voided_at')
      .groupBy('category', 'department').select('category', 'department', db.raw('SUM(amount) as total'));
    const spentFor = (category: string, department: string | null) => round2(spentRows
      .filter((r: any) => r.category === category && (!department || r.department === department))
      .reduce((s: number, r: any) => s + Number(r.total), 0));
    const out = lines.map((l: any) => {
      const amount = round2(l.amount);
      const spent = spentFor(l.category, l.department);
      const pct = amount > 0 ? Math.round((spent / amount) * 1000) / 10 : spent > 0 ? 999 : 0;
      return { ...l, amount, spent, remaining: round2(amount - spent), pct, status: pct > 100 ? 'over' : pct >= 90 ? 'near' : 'ok' };
    });
    // Spending in categories with no budget line.
    const budgeted = new Set(lines.map((l: any) => l.category));
    const unbudgeted = Array.from(new Set(spentRows.map((r: any) => r.category)))
      .filter((c) => !budgeted.has(c)).map((c) => ({ category: c, spent: spentFor(c, null) }));
    const totalBudget = round2(out.reduce((s, l) => s + l.amount, 0));
    const totalSpent = round2(spentRows.reduce((s: number, r: any) => s + Number(r.total), 0));
    return { academic_year: year, budget: budget || null, lines: out, unbudgeted, total_budget: totalBudget, total_spent: totalSpent };
  },

  async save(tenantId: string, userId: string, rawYear: string, body: any) {
    const year = normalizeAcademicYear(rawYear || null);
    if (!year || !/^\d{4}\/\d{4}$/.test(year)) throw new AppError('Choose an academic year.', 400, 'VALIDATION_ERROR');
    await assertOpenYear(tenantId, year, 'budgets');
    const raw = Array.isArray(body?.lines) ? body.lines : [];
    const lines = raw.map((l: any) => ({
      category: cleanCategory(l?.category), department: l?.department ? String(l.department).trim().slice(0, 100) : null,
      amount: round2(Number(l?.amount)), notes: l?.notes ? String(l.notes).slice(0, 300) : null,
    }));
    for (const l of lines) {
      if (!(l.amount >= 0) || l.amount > 1e11) throw new AppError(`Enter a valid amount for ${l.category}.`, 400, 'VALIDATION_ERROR');
    }
    const keys = lines.map((l: any) => `${l.category.toLowerCase()}|${(l.department || '').toLowerCase()}`);
    if (new Set(keys).size !== keys.length) throw new AppError('Each category (and department) can only appear once.', 400, 'VALIDATION_ERROR');
    let wasApproved = false;
    await db.transaction(async (trx) => {
      let b = await trx('budgets').where({ tenant_id: tenantId, academic_year: year }).forUpdate().first();
      if (!b) [b] = await trx('budgets').insert({ tenant_id: tenantId, academic_year: year, status: 'draft', created_by: userId, notes: body?.notes || null }).returning('*');
      wasApproved = b.status === 'approved';
      await trx('budgets').where({ id: b.id }).update({ status: 'draft', approved_by: null, approved_at: null, notes: body?.notes ?? b.notes, updated_at: new Date() });
      await trx('budget_lines').where({ budget_id: b.id }).del();
      if (lines.length) await trx('budget_lines').insert(lines.map((l: any) => ({ ...l, budget_id: b.id })));
    });
    await audit('budget', null, wasApproved ? 'edit_approved' : 'save', userId, { year, lines });
    const total = round2(lines.reduce((s: number, l: any) => s + l.amount, 0));
    await notifyFinanceStaff(tenantId, ['principal'], {
      subject: wasApproved ? `Budget ${year} changed: needs approval again` : `Budget ${year} waiting for approval`,
      message: `The ${year} budget (${lines.length} line${lines.length === 1 ? '' : 's'}, Le ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}) was saved. Check it and approve it.`,
      url: '/finance/budgets', sourceType: 'budget', exceptUserId: userId,
    });
    return { ...(await this.get(tenantId, year)), reopened: wasApproved };
  },

  async approve(tenantId: string, userId: string, rawYear: string) {
    const year = normalizeAcademicYear(rawYear || null);
    const b = await db('budgets').where({ tenant_id: tenantId, academic_year: year }).first();
    if (!b) throw new AppError('There is no budget for that year yet.', 404, 'NOT_FOUND');
    if (b.status === 'approved') throw new AppError('This budget is already approved.', 409, 'CONFLICT');
    const n = await db('budget_lines').where({ budget_id: b.id }).count('* as n').first();
    if (!Number(n?.n)) throw new AppError('Add at least one budget line first.', 400, 'VALIDATION_ERROR');
    await db('budgets').where({ id: b.id }).update({ status: 'approved', approved_by: userId, approved_at: new Date(), updated_at: new Date() });
    await audit('budget', b.id, 'approve', userId, { year });
    return this.get(tenantId, year!);
  },
};

export default budgetService;
