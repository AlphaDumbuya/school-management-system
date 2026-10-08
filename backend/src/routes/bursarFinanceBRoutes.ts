/**
 * Bursar finance Phase B routes (.kiro/specs/bursar-finance-phase-b):
 * expenses, petty cash, budgets, payroll. Mounted at /api/v1/finance before
 * schoolExpenseRoutes. Finance staff only, except My Payslips (any staff
 * member, own payslips only). Budget and pay-run approval: principal only.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, attachUserContext } from '@middleware/authMiddleware';
import { AppError } from '@middleware/errorHandler';
import { db } from '@utils/database';
import { sendExport } from '@utils/exportResponse';
import { isFinanceStaff, round2 } from '@services/finance/core';
import { expenseService, EXPENSE_CATEGORIES } from '@services/finance/expenseService';
import { pettyCashService } from '@services/finance/pettyCashService';
import { budgetService } from '@services/finance/budgetService';
import { payrollService, validateBands, DEFAULT_PAYE_BANDS } from '@services/finance/payrollService';

const router = Router();
router.use(authenticate, attachUserContext);

const staff = (req: Request, _res: Response, next: NextFunction) =>
  isFinanceStaff(req) ? next() : next(new AppError('Finance management is restricted to the bursar and principal.', 403, 'FORBIDDEN'));
const principal = (req: Request, _res: Response, next: NextFunction) =>
  ['principal', 'super_admin'].includes(String(req.user?.role || '')) ? next() : next(new AppError('Only the principal can approve this.', 403, 'FORBIDDEN'));
const T = (req: Request) => String(req.user!.tenant_id);
const U = (req: Request) => String(req.user!.id);
const wrap = (fn: (req: Request, res: Response) => Promise<any>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const reason = (req: Request) => String(req.body?.reason || '').trim();

// ── Expenses ────────────────────────────────────────────────────────────────
router.get('/expense-categories', staff, (_req, res) => res.json({ success: true, data: EXPENSE_CATEGORIES }));
router.get('/expenses-v2', staff, wrap(async (req, res) => res.json({
  success: true,
  data: await expenseService.list(T(req), {
    year: req.query.academic_year as string, category: req.query.category as string, term: req.query.term as string,
    source: req.query.source as string, includeVoided: req.query.include_voided === 'true',
  }),
})));
router.get('/expenses-v2/export', staff, wrap(async (req, res) => {
  const d = await expenseService.list(T(req), { year: req.query.academic_year as string, category: req.query.category as string, term: req.query.term as string, source: req.query.source as string });
  const le = (n: number) => `Le ${round2(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const rows = d.rows.map((e: any) => ({
    date: String(e.expense_date instanceof Date ? e.expense_date.toISOString() : e.expense_date).slice(0, 10), category: e.category,
    description: e.description || '', vendor: e.vendor || '', method: String(e.payment_method || '').replace(/_/g, ' '), reference: e.reference || '',
    source: e.source, amount: le(e.amount),
  }));
  if (rows.length) rows.push({ date: 'TOTAL', category: '', description: '', vendor: '', method: '', reference: '', source: '', amount: le(d.total) });
  await sendExport(res, {
    format: req.query.format as string, tenantId: T(req), rows,
    columns: { Date: 'date', Category: 'category', Description: 'description', 'Vendor / payee': 'vendor', Method: 'method', Reference: 'reference', Source: 'source', Amount: 'amount' },
    filename: 'school_expenses', title: `School Expenses — ${d.academic_year}`, sheetName: 'Expenses', highlightLastRow: true,
  } as any);
}));
router.post('/expenses-v2', staff, wrap(async (req, res) => res.status(201).json({ success: true, data: await expenseService.create(T(req), U(req), req.body) })));
router.put('/expenses-v2/:id', staff, wrap(async (req, res) => res.json({ success: true, data: await expenseService.update(T(req), U(req), req.params.id, req.body) })));
router.post('/expenses-v2/:id/void', staff, wrap(async (req, res) => res.json({ success: true, data: await expenseService.void(T(req), U(req), req.params.id, reason(req)) })));

// ── Petty cash ──────────────────────────────────────────────────────────────
router.get('/petty-cash', staff, wrap(async (req, res) => res.json({ success: true, data: await pettyCashService.funds(T(req)) })));
router.post('/petty-cash', staff, wrap(async (req, res) => res.status(201).json({ success: true, data: await pettyCashService.saveFund(T(req), U(req), req.body) })));
router.put('/petty-cash/:id', staff, wrap(async (req, res) => res.json({ success: true, data: await pettyCashService.saveFund(T(req), U(req), req.body, req.params.id) })));
router.get('/petty-cash/:id/entries', staff, wrap(async (req, res) => res.json({ success: true, data: await pettyCashService.entries(T(req), req.params.id, req.query.academic_year as string) })));
router.post('/petty-cash/:id/entries', staff, wrap(async (req, res) => res.status(201).json({ success: true, data: await pettyCashService.addEntry(T(req), U(req), req.params.id, req.body) })));
router.post('/petty-cash/entries/:entryId/void', staff, wrap(async (req, res) => res.json({ success: true, data: await pettyCashService.voidEntry(T(req), U(req), req.params.entryId, reason(req)) })));

// ── Budgets ─────────────────────────────────────────────────────────────────
router.get('/budgets', staff, wrap(async (req, res) => res.json({ success: true, data: await budgetService.get(T(req), req.query.academic_year as string) })));
router.put('/budgets', staff, wrap(async (req, res) => res.json({ success: true, data: await budgetService.save(T(req), U(req), String(req.body?.academic_year || ''), req.body) })));
router.post('/budgets/approve', principal, wrap(async (req, res) => res.json({ success: true, data: await budgetService.approve(T(req), U(req), String(req.body?.academic_year || '')) })));

// ── Payroll: my payslips (any staff member) ─────────────────────────────────
router.get('/payroll/my-payslips', wrap(async (req, res) => res.json({ success: true, data: await payrollService.mySlips(T(req), U(req)) })));
router.get('/payroll/payslips/:id/pdf', wrap(async (req, res) => {
  const { pdf, slip, run } = await payrollService.slipPdf(T(req), req.params.id);
  const own = slip.user_id && String(slip.user_id) === U(req) && ['approved', 'paid'].includes(run.status);
  if (!own && !isFinanceStaff(req)) throw new AppError('You can only download your own payslips.', 403, 'FORBIDDEN');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Payslip-${run.period}-${slip.staff_number || 'staff'}.pdf"`);
  res.send(pdf);
}));

// ── Payroll (finance staff) ─────────────────────────────────────────────────
router.get('/payroll/settings', staff, wrap(async (req, res) => res.json({ success: true, data: { ...(await payrollService.settings(T(req))), defaults: DEFAULT_PAYE_BANDS } })));
router.put('/payroll/settings', principal, wrap(async (req, res) => {
  const bands = validateBands(req.body?.bands);
  const ne = Number(req.body?.nassit_employee_pct), nr = Number(req.body?.nassit_employer_pct);
  if (!(ne >= 0 && ne <= 100) || !(nr >= 0 && nr <= 100)) throw new AppError('NASSIT rates must be between 0 and 100%.', 400, 'VALIDATION_ERROR');
  const school = await db('school_config_settings').where({ tenant_id: T(req) }).whereNotNull('school_id').first('school_id');
  const values: Record<string, string> = {
    fin_paye_bands: JSON.stringify(bands), fin_nassit_employee_pct: String(ne), fin_nassit_employer_pct: String(nr),
    fin_paye_after_nassit: String(req.body?.paye_after_nassit !== false),
  };
  for (const [k, v] of Object.entries(values)) {
    const updated = await db('school_config_settings').where({ tenant_id: T(req), setting_key: k }).update({ setting_value: v, updated_by: U(req), updated_at: new Date() });
    if (!updated) {
      await db('school_config_settings').insert({ tenant_id: T(req), school_id: school?.school_id || T(req), setting_key: k, setting_value: v, data_type: k === 'fin_paye_bands' ? 'json' : 'string', created_by: U(req), updated_by: U(req) });
    }
  }
  res.json({ success: true, data: await payrollService.settings(T(req)) });
}));
router.get('/payroll/staff', staff, wrap(async (req, res) => res.json({ success: true, data: await payrollService.staff(T(req)) })));
router.put('/payroll/staff', staff, wrap(async (req, res) => res.json({ success: true, data: await payrollService.saveProfile(T(req), U(req), req.body, String(req.user!.role)) })));
router.get('/payroll/runs', staff, wrap(async (req, res) => res.json({ success: true, data: await payrollService.runs(T(req)) })));
router.post('/payroll/runs', staff, wrap(async (req, res) => res.status(201).json({ success: true, data: await payrollService.generate(T(req), U(req), String(req.body?.period || '')) })));
router.get('/payroll/runs/:id', staff, wrap(async (req, res) => res.json({ success: true, data: await payrollService.run(T(req), req.params.id) })));
router.post('/payroll/runs/:id/regenerate', staff, wrap(async (req, res) => res.json({ success: true, data: await payrollService.regenerate(T(req), U(req), req.params.id) })));
router.post('/payroll/runs/:id/approve', principal, wrap(async (req, res) => res.json({ success: true, data: await payrollService.approve(T(req), U(req), req.params.id) })));
router.post('/payroll/runs/:id/pay', staff, wrap(async (req, res) => res.json({ success: true, data: await payrollService.markPaid(T(req), U(req), req.params.id, req.body?.payment_date, req.body?.paid_from) })));
router.post('/payroll/runs/:id/cancel', staff, wrap(async (req, res) => res.json({ success: true, data: await payrollService.cancel(T(req), U(req), req.params.id, reason(req)) })));
router.post('/payroll/runs/:id/email', staff, wrap(async (req, res) => res.json({ success: true, data: await payrollService.emailSlips(T(req), U(req), req.params.id) })));
router.get('/payroll/runs/:id/export', staff, wrap(async (req, res) => {
  const r = await payrollService.run(T(req), req.params.id);
  const le = (n: any) => `Le ${round2(Number(n)).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const rows: any[] = r.payslips.map((s: any) => ({
    name: s.staff_name, no: s.staff_number || '', basic: le(s.basic), gross: le(s.gross), paye: le(s.paye), nassit_e: le(s.nassit_employee),
    nassit_r: le(s.nassit_employer), other: le(Number(s.total_deductions) - Number(s.paye) - Number(s.nassit_employee)), net: le(s.net),
    bank: [s.bank_name, s.account_number].filter(Boolean).join(' '),
  }));
  rows.push({ name: 'TOTAL', no: `${r.staff_count} staff`, basic: '', gross: le(r.gross), paye: le(r.paye), nassit_e: le(r.nassit_employee), nassit_r: le(r.nassit_employer), other: le(r.other_deductions), net: le(r.net), bank: '' });
  await sendExport(res, {
    format: req.query.format as string, tenantId: T(req), rows,
    columns: { Staff: 'name', 'Staff No': 'no', Basic: 'basic', Gross: 'gross', PAYE: 'paye', 'NASSIT (employee)': 'nassit_e', 'NASSIT (employer)': 'nassit_r', 'Other deductions': 'other', Net: 'net', Bank: 'bank' },
    filename: `payroll_${r.period}`, title: `Payroll ${r.period} (${r.status})`, sheetName: 'Payroll', highlightLastRow: true,
  } as any);
}));
router.put('/payroll/payslips/:id', staff, wrap(async (req, res) => res.json({ success: true, data: await payrollService.editSlip(T(req), U(req), req.params.id, req.body, String(req.user!.role)) })));
router.delete('/payroll/payslips/:id', staff, wrap(async (req, res) => res.json({ success: true, data: await payrollService.removeSlip(T(req), U(req), req.params.id, String(req.user!.role)) })));

export default router;
