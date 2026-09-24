import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, attachUserContext } from '../middleware/authMiddleware.js';
import { requireFinanceStaff, resolveTenant } from '../middleware/financeGuard.js';
import { schoolExpenseService } from '../services/schoolExpenseService.js';
import { financeLedgerService } from '../services/financeLedgerService.js';

/**
 * School operating-expense routes (financial-management spec §3, Task 4.3/4.4).
 * All endpoints are finance-staff only and tenant-scoped.
 *
 *  GET    /api/v1/finance/expenses?academic_year=&term=&category=
 *  POST   /api/v1/finance/expenses
 *  PUT    /api/v1/finance/expenses/:id
 *  DELETE /api/v1/finance/expenses/:id
 *  GET    /api/v1/finance/expenses/summary?academic_year=   (expenses only)
 *  GET    /api/v1/finance/summary/fees-vs-expenses?academic_year=  (collection vs spend)
 */
const router = Router();

router.use(authenticate, attachUserContext, requireFinanceStaff);

router.get('/expenses', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = resolveTenant(req);
    const data = await schoolExpenseService.list(tenantId, {
      academic_year: req.query.academic_year as string | undefined,
      term: req.query.term as string | undefined,
      category: req.query.category as string | undefined,
    });
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

router.post('/expenses', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = resolveTenant(req);
    const row = await schoolExpenseService.create(tenantId, req.user!.id, req.body);
    res.status(201).json({ success: true, data: row });
  } catch (error) { next(error); }
});

router.put('/expenses/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = resolveTenant(req);
    const row = await schoolExpenseService.update(tenantId, req.params.id, req.body);
    res.json({ success: true, data: row });
  } catch (error) { next(error); }
});

router.delete('/expenses/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = resolveTenant(req);
    await schoolExpenseService.delete(tenantId, req.params.id);
    res.json({ success: true });
  } catch (error) { next(error); }
});

router.get('/expenses/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = resolveTenant(req);
    const academicYear = String(req.query.academic_year || '');
    if (!academicYear) return res.status(400).json({ success: false, error: 'academic_year is required' });
    const [byYear, byTerm] = await Promise.all([
      schoolExpenseService.summaryByYear(tenantId, academicYear),
      schoolExpenseService.summaryByTerm(tenantId, academicYear),
    ]);
    res.json({ success: true, data: { ...byYear, terms: byTerm } });
  } catch (error) { next(error); }
});

// Combined fees-vs-expenses summary for the year (Req 7.4).
router.get('/summary/fees-vs-expenses', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = resolveTenant(req);
    const academicYear = String(req.query.academic_year || '');
    if (!academicYear) return res.status(400).json({ success: false, error: 'academic_year is required' });
    const [fees, expenses] = await Promise.all([
      financeLedgerService.getTenantSummary(tenantId, academicYear),
      schoolExpenseService.summaryByYear(tenantId, academicYear),
    ]);
    res.json({
      success: true,
      data: {
        academic_year: academicYear,
        billed: fees.billed,
        collected: fees.collected,
        outstanding: fees.outstanding,
        expenses: expenses.total,
        net: fees.collected - expenses.total,
      },
    });
  } catch (error) { next(error); }
});

export default router;
