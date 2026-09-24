import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, attachUserContext } from '../middleware/authMiddleware.js';
import {
  requireFinanceStaff,
  resolveTenant,
  assertStudentInTenant,
  assertParentLinkedToStudent,
  FINANCE_STAFF_ROLES,
} from '../middleware/financeGuard.js';
import { financeLedgerService } from '../services/financeLedgerService.js';
import { db } from '../utils/database.js';

/**
 * Finance ledger read routes (financial-management spec §2, Task 3.4).
 *
 *  GET /api/v1/finance/ledger/student/:studentId  — one student's ledger.
 *      Staff: any student in tenant. Student: own only. Parent: verified child.
 *  GET /api/v1/finance/ledger/me                   — the caller's own ledger
 *      (student) — convenience for the portal.
 *  GET /api/v1/finance/ledger/summary?academic_year=  — tenant roll-up (staff).
 *  GET /api/v1/finance/ledger/breakdown?academic_year=&by=term|class|level (staff).
 */
const router = Router();

// Populate req.user for every ledger route before the role checks/handlers.
router.use(authenticate, attachUserContext);

function isStaff(role?: string) {
  return !!role && (FINANCE_STAFF_ROLES as readonly string[]).includes(role);
}

/** Resolve the students.id owned by the authenticated student user, or null. */
async function ownStudentId(userId: string, tenantId: string): Promise<string | null> {
  const s = await db('students').where({ user_id: userId, tenant_id: tenantId }).first().catch(() => null);
  return s?.id ?? null;
}

// ── One student's ledger (role-scoped) ────────────────────────────────────────
router.get('/student/:studentId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = resolveTenant(req);
    const role = req.user?.role;
    const userId = req.user?.id as string;
    const studentId = req.params.studentId;

    if (isStaff(role)) {
      await assertStudentInTenant(studentId, tenantId);
    } else if (role === 'student') {
      const own = await ownStudentId(userId, tenantId);
      if (own !== studentId) return res.status(403).json({ success: false, error: 'You can only view your own records.' });
    } else if (role === 'parent' || role === 'guardian') {
      await assertParentLinkedToStudent(userId, studentId, tenantId);
    } else {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    const ledger = await financeLedgerService.getStudentLedger(tenantId, studentId);
    res.json({ success: true, data: ledger });
  } catch (error) { next(error); }
});

// ── The calling student's own ledger ──────────────────────────────────────────
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = resolveTenant(req);
    const userId = req.user?.id as string;
    const own = await ownStudentId(userId, tenantId);
    if (!own) return res.status(404).json({ success: false, error: 'No student record linked to your account.' });
    const ledger = await financeLedgerService.getStudentLedger(tenantId, own);
    res.json({ success: true, data: ledger });
  } catch (error) { next(error); }
});

// ── Tenant summary (staff) ────────────────────────────────────────────────────
router.get('/summary', authenticate, requireFinanceStaff, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = resolveTenant(req);
    const academicYear = String(req.query.academic_year || '');
    if (!academicYear) return res.status(400).json({ success: false, error: 'academic_year is required' });
    const summary = await financeLedgerService.getTenantSummary(tenantId, academicYear);
    res.json({ success: true, data: summary });
  } catch (error) { next(error); }
});

// ── Breakdown by term/class/level (staff) ─────────────────────────────────────
router.get('/breakdown', authenticate, requireFinanceStaff, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = resolveTenant(req);
    const academicYear = String(req.query.academic_year || '');
    const by = String(req.query.by || 'term') as 'term' | 'class' | 'level';
    if (!academicYear) return res.status(400).json({ success: false, error: 'academic_year is required' });
    if (!['term', 'class', 'level'].includes(by)) return res.status(400).json({ success: false, error: "by must be term|class|level" });
    const data = await financeLedgerService.getBreakdown(tenantId, academicYear, by);
    res.json({ success: true, data });
  } catch (error) { next(error); }
});

export default router;
