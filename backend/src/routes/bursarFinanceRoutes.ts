/**
 * Bursar finance Phase A routes (.kiro/specs/bursar-finance-phase-a).
 * Mounted at /api/v1/finance BEFORE schoolExpenseRoutes (whose router.use
 * guard is finance-staff only), so the family-facing reads below (receipts,
 * payment history, plans, statements) are reachable by linked parents and
 * the student themself. Everything else is finance staff (bursar/principal).
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, attachUserContext } from '@middleware/authMiddleware';
import { AppError } from '@middleware/errorHandler';
import { db } from '@utils/database';
import { normalizeAcademicYear, resolveActiveYear } from '@utils/academicYear';
import { discountService } from '@services/finance/discountService';
import { lateFeeService } from '@services/finance/lateFeeService';
import { agingService } from '@services/finance/agingService';
import { receiptService } from '@services/finance/receiptService';
import { creditService } from '@services/finance/creditService';
import { planService } from '@services/finance/planService';
import { statementService } from '@services/finance/statementService';
import { assertCanViewStudent, isFinanceStaff, round2 } from '@services/finance/core';
import { sendExport } from '@utils/exportResponse';

const router = Router();
router.use(authenticate, attachUserContext);

const staff = (req: Request, _res: Response, next: NextFunction) => {
  if (!isFinanceStaff(req)) return next(new AppError('Finance management is restricted to the bursar and principal.', 403, 'FORBIDDEN'));
  next();
};
const principal = (req: Request, _res: Response, next: NextFunction) => {
  const r = String(req.user?.role || '');
  if (r !== 'principal' && r !== 'super_admin') return next(new AppError('Only the principal can approve or reject discounts.', 403, 'FORBIDDEN'));
  next();
};
const T = (req: Request) => String(req.user!.tenant_id);
const U = (req: Request) => String(req.user!.id);
const wrap = (fn: (req: Request, res: Response) => Promise<any>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const reasonOf = (req: Request) => String(req.body?.reason || '').trim();

// ── Discounts & scholarships ────────────────────────────────────────────────
router.get('/discounts/rules', staff, wrap(async (req, res) => res.json({ success: true, data: await discountService.listRules(T(req)) })));
router.post('/discounts/rules', staff, wrap(async (req, res) => res.status(201).json({ success: true, data: await discountService.createRule(T(req), U(req), req.body) })));
router.put('/discounts/rules/:id', staff, wrap(async (req, res) => res.json({ success: true, data: await discountService.updateRule(T(req), U(req), req.params.id, req.body) })));
router.get('/discounts/rules/:id/candidates', staff, wrap(async (req, res) => {
  const year = normalizeAcademicYear(String(req.query.academic_year || '')) || (await resolveActiveYear(T(req))).yearString;
  res.json({ success: true, data: await discountService.siblingCandidates(T(req), req.params.id, year) });
}));
router.get('/discounts/grants', staff, wrap(async (req, res) => res.json({
  success: true,
  data: await discountService.listGrants(T(req), { year: req.query.academic_year as string, status: req.query.status as string, studentId: req.query.student_id as string }),
})));
router.post('/discounts/grants', staff, wrap(async (req, res) => res.status(201).json({ success: true, data: await discountService.grant(T(req), { id: U(req), role: String(req.user!.role) }, req.body) })));
router.post('/discounts/grants/:id/approve', principal, wrap(async (req, res) => res.json({ success: true, data: await discountService.decide(T(req), U(req), req.params.id, 'approve', reasonOf(req)) })));
router.post('/discounts/grants/:id/reject', principal, wrap(async (req, res) => res.json({ success: true, data: await discountService.decide(T(req), U(req), req.params.id, 'reject', reasonOf(req)) })));
router.post('/discounts/grants/:id/revoke', staff, wrap(async (req, res) => res.json({ success: true, data: await discountService.revoke(T(req), U(req), req.params.id, reasonOf(req)) })));

// ── Overdue + late fees ─────────────────────────────────────────────────────
router.post('/late-fees/run', staff, wrap(async (req, res) => {
  const [r] = await lateFeeService.runDaily(T(req));
  res.json({ success: true, data: r });
}));
router.post('/fees/:id/waive-late-fee', staff, wrap(async (req, res) => res.json({ success: true, data: await lateFeeService.waive(T(req), U(req), req.params.id, reasonOf(req)) })));
router.post('/fees/:id/late-fee', staff, wrap(async (req, res) => res.status(201).json({ success: true, data: await lateFeeService.addManual(T(req), U(req), req.params.id, Number(req.body?.amount), reasonOf(req)) })));

// ── Arrears & aging + cash position ────────────────────────────────────────
const agingFilters = (req: Request) => ({
  year: req.query.academic_year as string | undefined,
  classId: (req.query.class_id as string) || undefined,
  section: (req.query.section as string) || undefined,
  min: Number(req.query.min) || 0,
  bucket: (req.query.bucket as string) || undefined,
});
router.get('/aging', staff, wrap(async (req, res) => res.json({ success: true, data: await agingService.report(T(req), agingFilters(req)) })));
router.get('/aging/export', staff, wrap(async (req, res) => {
  const r = await agingService.report(T(req), agingFilters(req));
  const le = (n: number) => `Le ${round2(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const rows = r.students.map((s: any) => ({
    student: s.student_name, admission_no: s.admission_no, class: s.class_name || '—',
    not_due: le(s.buckets.not_due), d1_30: le(s.buckets.d1_30), d31_60: le(s.buckets.d31_60), d61_90: le(s.buckets.d61_90), d90_plus: le(s.buckets.d90_plus),
    total: le(s.total), oldest_days: s.oldest_days > 0 ? `${s.oldest_days} days` : 'Not yet due', on_plan: s.on_plan ? 'Yes' : '',
  }));
  if (rows.length) rows.push({ student: 'TOTAL', admission_no: `${r.totals.students} students`, class: '', not_due: le(r.totals.not_due), d1_30: le(r.totals.d1_30), d31_60: le(r.totals.d31_60), d61_90: le(r.totals.d61_90), d90_plus: le(r.totals.d90_plus), total: le(r.totals.total), oldest_days: '', on_plan: '' });
  await sendExport(res, {
    format: req.query.format as string, tenantId: T(req), rows,
    columns: { Student: 'student', 'Admission No': 'admission_no', Class: 'class', 'Not yet due': 'not_due', '1–30 days': 'd1_30', '31–60 days': 'd31_60', '61–90 days': 'd61_90', '90+ days': 'd90_plus', Total: 'total', Oldest: 'oldest_days', 'On plan': 'on_plan' },
    filename: 'arrears_aging', title: `Arrears & Aging${r.academic_year ? ` — ${r.academic_year}` : ' — all years'} (as of ${r.as_of})`, sheetName: 'Aging', highlightLastRow: true,
  } as any);
}));
router.get('/cash-position', staff, wrap(async (req, res) => res.json({ success: true, data: await agingService.cashPosition(T(req), req.query.academic_year as string) })));

// ── Receipts & payment history ──────────────────────────────────────────────
router.get('/receipts', staff, wrap(async (req, res) => res.json({
  success: true,
  data: await receiptService.list(T(req), { from: req.query.from as string, to: req.query.to as string, classId: req.query.class_id as string, studentId: req.query.student_id as string }),
})));
router.post('/receipts/bulk-email', staff, wrap(async (req, res) => res.json({ success: true, data: await receiptService.bulkEmail(T(req), U(req), { from: req.body?.from, to: req.body?.to, classId: req.body?.class_id }) })));
router.post('/receipts/:no/email', staff, wrap(async (req, res) => {
  const out = await receiptService.email(T(req), req.params.no, U(req));
  res.status(out.sent ? 200 : 422).json(out.sent ? { success: true, data: out } : { success: false, error: out.reason });
}));
router.get('/receipts/:no', wrap(async (req, res) => {
  const r = await receiptService.get(T(req), req.params.no);
  await assertCanViewStudent(req, r.student_id);
  res.json({ success: true, data: r });
}));
router.get('/receipts/:no/pdf', wrap(async (req, res) => {
  const r = await receiptService.get(T(req), req.params.no);
  await assertCanViewStudent(req, r.student_id);
  const pdf = await receiptService.pdf(T(req), req.params.no);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Receipt-${req.params.no}.pdf"`);
  res.send(pdf);
}));
/** A student's receipts (staff, the student, or a linked parent). */
router.get('/students/:id/receipts', wrap(async (req, res) => {
  const { tenantId } = await assertCanViewStudent(req, req.params.id);
  res.json({ success: true, data: await receiptService.list(tenantId, { studentId: req.params.id }) });
}));

// ── Credit balance ──────────────────────────────────────────────────────────
router.get('/credits/:studentId', wrap(async (req, res) => {
  const { tenantId } = await assertCanViewStudent(req, req.params.studentId);
  res.json({ success: true, data: await creditService.history(tenantId, req.params.studentId) });
}));
router.post('/credits/:studentId/note', staff, wrap(async (req, res) => res.status(201).json({ success: true, data: await creditService.creditNote(T(req), U(req), req.params.studentId, Number(req.body?.amount), reasonOf(req)) })));
router.post('/credits/:studentId/apply', staff, wrap(async (req, res) => res.json({ success: true, data: await creditService.apply(T(req), U(req), req.params.studentId, Number(req.body?.amount) || undefined) })));
router.post('/credits/:studentId/refund', staff, wrap(async (req, res) => res.json({ success: true, data: await creditService.refund(T(req), U(req), req.params.studentId, Number(req.body?.amount), reasonOf(req)) })));

// ── Instalment plans ────────────────────────────────────────────────────────
router.get('/plans', staff, wrap(async (req, res) => res.json({ success: true, data: await planService.list(T(req), req.query.academic_year as string) })));
router.post('/plans', staff, wrap(async (req, res) => res.status(201).json({ success: true, data: await planService.create(T(req), U(req), req.body) })));
router.post('/plans/:id/cancel', staff, wrap(async (req, res) => res.json({ success: true, data: await planService.cancel(T(req), U(req), req.params.id, reasonOf(req)) })));
router.get('/plans/student/:studentId', wrap(async (req, res) => {
  const { tenantId } = await assertCanViewStudent(req, req.params.studentId);
  res.json({ success: true, data: await planService.forStudent(tenantId, req.params.studentId) });
}));

// ── Statement of account ────────────────────────────────────────────────────
router.get('/statements/:studentId', wrap(async (req, res) => {
  const { tenantId, student } = await assertCanViewStudent(req, req.params.studentId);
  if (req.query.format === 'pdf') {
    const pdf = await statementService.pdf(tenantId, req.params.studentId, req.query.academic_year as string);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Statement-${student.student_id || 'student'}.pdf"`);
    return res.send(pdf);
  }
  res.json({ success: true, data: await statementService.build(tenantId, req.params.studentId, req.query.academic_year as string) });
}));

// ── Unpaid balances for a class (promotion warning) ─────────────────────────
router.get('/unpaid-students', staff, wrap(async (req, res) => {
  const classId = String(req.query.class_id || '');
  if (!classId) throw new AppError('class_id is required', 400, 'VALIDATION_ERROR');
  const rows = await db('enrollments as e')
    .join('students as s', 's.id', 'e.student_id')
    .leftJoin('users as u', 'u.id', 's.user_id')
    .join('fees as f', 'f.student_id', 's.id')
    .where('e.class_id', classId).whereIn('e.status', ['active', 'enrolled'])
    .where('s.tenant_id', T(req)).whereNot('f.status', 'deleted').where('f.balance', '>', 0)
    .groupBy('s.id', 's.student_id', 'u.first_name', 'u.last_name', 's.first_name', 's.last_name')
    .select('s.id as student_id', 's.student_id as admission_no',
      db.raw("COALESCE(u.first_name || ' ' || u.last_name, s.first_name || ' ' || s.last_name) as student_name"),
      db.raw('SUM(f.balance) as outstanding'))
    .orderByRaw('SUM(f.balance) DESC');
  res.json({ success: true, data: rows.map((r: any) => ({ ...r, outstanding: round2(r.outstanding) })) });
}));

export default router;

/**
 * Daily finance job for every school (Vercel Cron → GET with
 * `Authorization: Bearer ${CRON_SECRET}`). Public path, secret-guarded.
 */
export const financeCronRouter = Router();
financeCronRouter.all('/finance-daily', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const secret = process.env.CRON_SECRET;
    const auth = String(req.headers.authorization || '');
    if (!secret || auth !== `Bearer ${secret}`) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const results = await lateFeeService.runDaily();
    res.json({ success: true, data: results });
  } catch (e) { next(e); }
});
