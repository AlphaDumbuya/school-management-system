import { db } from '../utils/database.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * School operating-expense service (financial-management spec §3, Req 7).
 * All operations are tenant-scoped. Expenses are the school's own costs, not
 * charges billed to students.
 */

export interface ExpenseInput {
  category: string;
  description?: string | null;
  amount: number;
  expense_date: string;      // ISO date
  academic_year: string;
  term?: string | null;      // first_term | second_term | third_term | null
}

const VALID_TERMS = new Set(['first_term', 'second_term', 'third_term']);

function validate(input: ExpenseInput) {
  if (!input.category || !String(input.category).trim()) {
    throw new AppError('Expense category is required', 400, 'VALIDATION_ERROR');
  }
  if (!(Number(input.amount) > 0)) {
    throw new AppError('Expense amount must be greater than zero', 400, 'VALIDATION_ERROR');
  }
  if (!input.expense_date) {
    throw new AppError('Expense date is required', 400, 'VALIDATION_ERROR');
  }
  if (!input.academic_year) {
    throw new AppError('Academic year is required', 400, 'VALIDATION_ERROR');
  }
  if (input.term && !VALID_TERMS.has(input.term)) {
    throw new AppError('Invalid term', 400, 'VALIDATION_ERROR');
  }
}

function num(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

class SchoolExpenseService {
  async create(tenantId: string, userId: string, input: ExpenseInput): Promise<any> {
    validate(input);
    const [row] = await db('school_expenses')
      .insert({
        tenant_id: tenantId,
        category: String(input.category).trim().slice(0, 100),
        description: input.description ?? null,
        amount: Number(input.amount),
        expense_date: input.expense_date,
        academic_year: input.academic_year,
        term: input.term ?? null,
        recorded_by: userId || null,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');
    return row;
  }

  async list(
    tenantId: string,
    filters: { academic_year?: string; term?: string; category?: string } = {},
  ): Promise<any[]> {
    let q = db('school_expenses').where({ tenant_id: tenantId }).whereNull('voided_at');
    if (filters.academic_year) q = q.where({ academic_year: filters.academic_year });
    if (filters.term) q = q.where({ term: filters.term });
    if (filters.category) q = q.where({ category: filters.category });
    return q.orderBy('expense_date', 'desc');
  }

  async update(tenantId: string, id: string, input: Partial<ExpenseInput>): Promise<any> {
    const existing = await db('school_expenses').where({ id, tenant_id: tenantId }).first();
    if (!existing) throw new AppError('Expense not found or access denied', 404, 'NOT_FOUND');
    const merged: ExpenseInput = {
      category: input.category ?? existing.category,
      description: input.description ?? existing.description,
      amount: input.amount ?? existing.amount,
      expense_date: input.expense_date ?? existing.expense_date,
      academic_year: input.academic_year ?? existing.academic_year,
      term: input.term ?? existing.term,
    };
    validate(merged);
    const [row] = await db('school_expenses')
      .where({ id, tenant_id: tenantId })
      .update({
        category: String(merged.category).trim().slice(0, 100),
        description: merged.description ?? null,
        amount: Number(merged.amount),
        expense_date: merged.expense_date,
        academic_year: merged.academic_year,
        term: merged.term ?? null,
        updated_at: new Date(),
      })
      .returning('*');
    return row;
  }

  /** Legacy delete: expenses are now VOIDED (kept for the audit trail). */
  async delete(tenantId: string, id: string): Promise<void> {
    const row = await db('school_expenses').where({ id, tenant_id: tenantId }).whereNull('voided_at').first();
    if (!row) throw new AppError('Expense not found or access denied', 404, 'NOT_FOUND');
    if (row.source && row.source !== 'manual') throw new AppError('This expense comes from petty cash or payroll. Void it there.', 409, 'LINKED_EXPENSE');
    await db('school_expenses').where({ id }).update({ voided_at: new Date(), void_reason: 'Deleted', updated_at: new Date() });
  }

  /** Total expenses for a year. */
  async summaryByYear(tenantId: string, academicYear: string): Promise<{ academic_year: string; total: number }> {
    const row = await db('school_expenses')
      .where({ tenant_id: tenantId, academic_year: academicYear })
      .whereNull('voided_at')
      .sum('amount as total')
      .first();
    return { academic_year: academicYear, total: num(row?.total) };
  }

  /** Totals per term for a year (year-level expenses reported under 'year'). */
  async summaryByTerm(
    tenantId: string,
    academicYear: string,
  ): Promise<Array<{ term: string; total: number }>> {
    const rows = await db('school_expenses')
      .where({ tenant_id: tenantId, academic_year: academicYear })
      .whereNull('voided_at')
      .groupBy('term')
      .select('term', db.raw('COALESCE(SUM(amount),0) as total'));
    return rows.map((r: any) => ({ term: r.term || 'year', total: num(r.total) }));
  }
}

export const schoolExpenseService = new SchoolExpenseService();
export default schoolExpenseService;
