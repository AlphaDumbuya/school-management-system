import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { authenticate } from '../middleware/authMiddleware.js';
import { db } from '../utils/database.js';
import { logger } from '../utils/logger.js';

const STAFF_ROLES = ['principal', 'super_admin', 'accountant'];
const requireStaff = (req: Request, res: Response, next: NextFunction) => {
  const role = (req as any).user?.role;
  if (!role || !STAFF_ROLES.includes(role)) {
    return res.status(403).json({ success: false, error: 'Access denied. Fee structure management is restricted to staff.' });
  }
  next();
};

/**
 * Fee-structure configurator routes (Sierra Leone model).
 *  GET  /api/v1/fee-structures?academic_year=            → list configured classes + summary
 *  GET  /api/v1/fee-structures/:classId?academic_year=   → one structure (+ expenses)
 *  POST /api/v1/fee-structures                           → upsert a structure (+ expenses)
 *  POST /api/v1/fee-structures/:id/bill                  → materialise fees for a term
 * All tenant-scoped.
 */
const router = Router();

const TERM_LABELS: Record<number, string> = { 1: 'First Term', 2: 'Second Term', 3: 'Third Term' };

async function assertClassInTenant(classId: string, tenantId: string) {
  // A class belongs to the tenant if its session is the tenant's OR it was created by a tenant user.
  const row = await db('classes')
    .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
    .leftJoin('users as creator', 'classes.created_by', 'creator.id')
    .where('classes.id', classId)
    .where(function () {
      this.where('academic_sessions.tenant_id', tenantId).orWhere('creator.tenant_id', tenantId);
    })
    .first();
  return !!row;
}

// ── List configured structures + summary ──────────────────────────────────────
router.get('/', authenticate, requireStaff, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    const academicYear = (req.query.academic_year as string) || undefined;

    let q = db('fee_structures')
      .join('classes', 'fee_structures.class_id', 'classes.id')
      .where('fee_structures.tenant_id', tenantId)
      .select(
        'fee_structures.*',
        'classes.name as class_name',
        'classes.level as class_level',
      );
    if (academicYear) q = q.where('fee_structures.academic_year', academicYear);
    const structures = await q.orderBy('classes.level').orderBy('classes.name');

    // Attach expense totals.
    const ids = structures.map((s: any) => s.id);
    const expenses = ids.length
      ? await db('fee_structure_expenses').whereIn('structure_id', ids)
      : [];
    const expByStruct: Record<string, any[]> = {};
    for (const e of expenses) (expByStruct[e.structure_id] ??= []).push(e);

    const data = structures.map((s: any) => {
      const exp = expByStruct[s.id] ?? [];
      const expenseTotal = exp.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
      const tuition = Number(s.term1_tuition) + Number(s.term2_tuition) + Number(s.term3_tuition);
      return {
        ...s,
        expenses: exp,
        expenseTotal,
        fullYearTotal: tuition + expenseTotal,
      };
    });

    res.json({ success: true, data });
  } catch (error) { next(error); }
});

// ── Get one structure for a class + year ──────────────────────────────────────
router.get('/:classId', authenticate, requireStaff, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    const academicYear = (req.query.academic_year as string);
    if (!academicYear) return res.status(400).json({ success: false, error: 'academic_year is required' });

    const s = await db('fee_structures')
      .where({ tenant_id: tenantId, class_id: req.params.classId, academic_year: academicYear })
      .first();
    if (!s) return res.json({ success: true, data: null });
    const expenses = await db('fee_structure_expenses').where({ structure_id: s.id });
    res.json({ success: true, data: { ...s, expenses } });
  } catch (error) { next(error); }
});

// ── Upsert a structure ────────────────────────────────────────────────────────
router.post('/', authenticate, requireStaff, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    const userId = (req as any).user.id;
    const {
      classId, academicYear,
      term1Tuition = 0, term2Tuition = 0, term3Tuition = 0,
      minPercentNew, minPercentContinuing, minPercentTerm,
      allowInstallments = true, lateFeePercent, policyNotes,
      expenses = [],
    } = req.body || {};

    if (!classId || !academicYear) return res.status(400).json({ success: false, error: 'classId and academicYear are required' });
    if (!(await assertClassInTenant(classId, tenantId))) return res.status(403).json({ success: false, error: 'Class not in your school' });

    const now = new Date();
    const payload: any = {
      tenant_id: tenantId, class_id: classId, academic_year: academicYear,
      term1_tuition: Number(term1Tuition) || 0,
      term2_tuition: Number(term2Tuition) || 0,
      term3_tuition: Number(term3Tuition) || 0,
      min_percent_new: minPercentNew ?? null,
      min_percent_continuing: minPercentContinuing ?? null,
      min_percent_term: minPercentTerm ?? null,
      allow_installments: allowInstallments !== false,
      late_fee_percent: lateFeePercent ?? null,
      policy_notes: policyNotes ?? null,
      updated_at: now,
    };

    const existing = await db('fee_structures').where({ tenant_id: tenantId, class_id: classId, academic_year: academicYear }).first();
    let structureId: string;
    if (existing) {
      await db('fee_structures').where({ id: existing.id }).update(payload);
      structureId = existing.id;
    } else {
      const [row] = await db('fee_structures').insert({ ...payload, created_by: userId, created_at: now }).returning('*');
      structureId = row.id;
    }

    // Replace expenses.
    await db('fee_structure_expenses').where({ structure_id: structureId }).del();
    for (const e of expenses) {
      if (!e?.label) continue;
      await db('fee_structure_expenses').insert({ structure_id: structureId, label: String(e.label).slice(0, 150), amount: Number(e.amount) || 0, created_at: now });
    }

    res.json({ success: true, data: { id: structureId } });
  } catch (error) { next(error); }
});

// ── Bill a term from a structure ──────────────────────────────────────────────
// Creates fees for every active student in the class for the chosen term:
//   tuition for that term + (Term 1 only) the itemised year expenses.
router.post('/:id/bill', authenticate, requireStaff, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    const term = Number(req.body?.term); // 1 | 2 | 3
    const dueDate = req.body?.dueDate ? new Date(req.body.dueDate) : new Date();
    if (![1, 2, 3].includes(term)) return res.status(400).json({ success: false, error: 'term must be 1, 2 or 3' });

    const s = await db('fee_structures').where({ id: req.params.id, tenant_id: tenantId }).first();
    if (!s) return res.status(404).json({ success: false, error: 'Fee structure not found' });

    const tuition = Number(term === 1 ? s.term1_tuition : term === 2 ? s.term2_tuition : s.term3_tuition) || 0;
    const expenses = term === 1 ? await db('fee_structure_expenses').where({ structure_id: s.id }) : [];

    // Active students in the class.
    const students = await db('enrollments')
      .join('students', 'enrollments.student_id', 'students.id')
      .where('enrollments.class_id', s.class_id)
      .where('enrollments.status', 'active')
      .where('students.tenant_id', tenantId)
      .distinct('students.id as id')
      .select('students.id');

    if (students.length === 0) return res.status(400).json({ success: false, error: 'No active students in this class' });

    const termLabel = TERM_LABELS[term];
    const now = new Date();
    let billed = 0;

    for (const stu of students) {
      // Avoid double-billing: skip if a tuition fee for this student/term/year already exists.
      const dup = await db('fees').where({ student_id: stu.id, term: termLabel, academic_year: s.academic_year, type: 'Tuition' }).first();
      if (dup) continue;

      if (tuition > 0) {
        await db('fees').insert({
          id: `FEE-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          tenant_id: tenantId, student_id: stu.id, class_id: s.class_id,
          type: 'Tuition', amount: tuition, balance: tuition,
          term: termLabel, academic_year: s.academic_year,
          due_date: dueDate, status: 'pending', created_at: now, updated_at: now,
        }).catch(() => {});
      }
      // Year expenses billed once, in Term 1.
      for (const e of expenses) {
        const amt = Number(e.amount) || 0;
        if (amt <= 0) continue;
        await db('fees').insert({
          id: `FEE-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          tenant_id: tenantId, student_id: stu.id, class_id: s.class_id,
          type: e.label, description: 'Academic year expense', amount: amt, balance: amt,
          term: termLabel, academic_year: s.academic_year,
          due_date: dueDate, status: 'pending', created_at: now, updated_at: now,
        }).catch(() => {});
      }
      billed++;
    }

    res.json({ success: true, data: { billed, term: termLabel } });
  } catch (error) { next(error); }
});

export default router;
