import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { authenticate, attachUserContext } from '../middleware/authMiddleware.js';
import { db } from '../utils/database.js';
import { logger } from '../utils/logger.js';

const STAFF_ROLES = ['principal', 'super_admin', 'accountant'];
const requireStaff = (req: Request, res: Response, next: NextFunction) => {
  // Read from req.user (populated by attachUserContext) OR fall back to the JWT
  // role on req.auth, so the guard works regardless of middleware order.
  const role = (req as any).user?.role || (req as any).auth?.role;
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

// Populate req.user (id/tenant_id/role) for every route before the staff guard.
router.use(authenticate, attachUserContext);

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

    // Billed status: which (class, year, term) combinations already have fees.
    const classIds = structures.map((s: any) => s.class_id);
    const billedRows = classIds.length
      ? await db('fees')
          .where('tenant_id', tenantId)
          .whereIn('class_id', classIds)
          .whereNot('status', 'deleted')
          .groupBy('class_id', 'academic_year', 'term')
          .select('class_id', 'academic_year', 'term', db.raw('COUNT(*) as n'))
      : [];
    // key = `${class_id}|${academic_year}` → Set of billed term labels
    const billedByKey: Record<string, Set<string>> = {};
    for (const r of billedRows as any[]) {
      const key = `${r.class_id}|${r.academic_year}`;
      (billedByKey[key] ??= new Set()).add(r.term || 'unassigned');
    }

    const data = structures.map((s: any) => {
      const exp = expByStruct[s.id] ?? [];
      const expenseTotal = exp.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
      const tuition = Number(s.term1_tuition) + Number(s.term2_tuition) + Number(s.term3_tuition);
      const billedTerms = Array.from(billedByKey[`${s.class_id}|${s.academic_year}`] ?? []);
      return {
        ...s,
        expenses: exp,
        expenseTotal,
        fullYearTotal: tuition + expenseTotal,
        billed: billedTerms.length > 0,
        billedTerms,
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
      chargesCompulsoryFirstTerm = false,
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
      charges_compulsory_first_term: chargesCompulsoryFirstTerm === true,
      late_fee_percent: lateFeePercent ?? null,
      policy_notes: policyNotes ?? null,
      updated_at: now,
    };

    const existing = await db('fee_structures').where({ tenant_id: tenantId, class_id: classId, academic_year: academicYear }).first();
    let structureId: string;
    if (existing) {
      // A structure already exists for this (class, year). Only allow an
      // explicit EDIT of that same structure; block an accidental duplicate
      // create unless the caller signals intent to update.
      // (financial-management spec Req 3.3)
      const isEdit = req.body?.structureId === existing.id || req.body?.mode === 'edit' || req.body?.allowOverwrite === true;
      if (!isEdit) {
        return res.status(409).json({
          success: false,
          error: 'A fee structure already exists for this class and academic year. Open it to edit, or remove it first.',
          code: 'FEE_STRUCTURE_EXISTS',
          data: { id: existing.id },
        });
      }
      await db('fee_structures').where({ id: existing.id }).update(payload);
      structureId = existing.id;
    } else {
      const [row] = await db('fee_structures').insert({ ...payload, created_by: userId, created_at: now }).returning('*');
      structureId = row.id;
    }

    // Replace expenses.
    await db('fee_structure_expenses').where({ structure_id: structureId }).del();
    for (const e of expenses as any[]) {
      if (!e?.label) continue;
      await db('fee_structure_expenses').insert({
        structure_id: structureId,
        label: String(e.label).slice(0, 150),
        amount: Number(e.amount) || 0,
        required: e.required !== false, // default required unless explicitly optional
        created_at: now,
      });
    }

    res.json({ success: true, data: { id: structureId } });
  } catch (error) { next(error); }
});

// ── Delete a structure (+ its expenses via cascade) ───────────────────────────
router.delete('/:id', authenticate, requireStaff, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    const s = await db('fee_structures').where({ id: req.params.id, tenant_id: tenantId }).first();
    if (!s) return res.status(404).json({ success: false, error: 'Fee structure not found' });
    await db('fee_structures').where({ id: s.id, tenant_id: tenantId }).del();
    res.json({ success: true });
  } catch (error) { next(error); }
});

/** Bill one term for a structure inside a transaction. Returns students touched. */
async function billOneTerm(
  trx: any,
  tenantId: string,
  s: any,
  term: 1 | 2 | 3,
  dueDate: Date,
  students: Array<{ id: string }>,
): Promise<number> {
  const tuition = Number(term === 1 ? s.term1_tuition : term === 2 ? s.term2_tuition : s.term3_tuition) || 0;
  // Itemised academic-year expenses are billed ONCE, with Term 1.
  const expenses = term === 1 ? await trx('fee_structure_expenses').where({ structure_id: s.id }) : [];
  const termLabel = TERM_LABELS[term];
  const now = new Date();
  let billed = 0;

  for (const stu of students) {
    let added = false;
    if (tuition > 0) {
      const dup = await trx('fees')
        .where({ student_id: stu.id, term: termLabel, academic_year: s.academic_year, type: 'Tuition' })
        .first();
      if (!dup) {
        await trx('fees').insert({
          id: crypto.randomUUID(),
          tenant_id: tenantId, student_id: stu.id, class_id: s.class_id,
          type: 'Tuition', amount: tuition, balance: tuition,
          term: termLabel, academic_year: s.academic_year,
          due_date: dueDate, status: 'pending', created_at: now, updated_at: now,
        });
        added = true;
      }
    }
    for (const e of expenses) {
      const amt = Number(e.amount) || 0;
      if (amt <= 0) continue;
      const dup = await trx('fees')
        .where({ student_id: stu.id, academic_year: s.academic_year, type: e.label })
        .first();
      if (dup) continue;
      await trx('fees').insert({
        id: crypto.randomUUID(),
        tenant_id: tenantId, student_id: stu.id, class_id: s.class_id,
        type: e.label, description: 'Academic year expense', amount: amt, balance: amt,
        term: termLabel, academic_year: s.academic_year,
        required: e.required !== false,
        due_date: dueDate, status: 'pending', created_at: now, updated_at: now,
      });
      added = true;
    }
    if (added) billed++;
  }
  return billed;
}

// ── Bill a term OR the full year from a structure ─────────────────────────────
// body.term: 1 | 2 | 3  → that single term (Term 1 also bills the year expenses)
// body.term: 'year'     → all three terms at once (expenses billed once, in T1)
router.post('/:id/bill', authenticate, requireStaff, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    const rawTerm = req.body?.term;
    const isYear = rawTerm === 'year' || rawTerm === 'all' || rawTerm === 0;
    const term = Number(rawTerm);
    if (!isYear && ![1, 2, 3].includes(term)) {
      return res.status(400).json({ success: false, error: "term must be 1, 2, 3 or 'year'" });
    }
    const dueDate = req.body?.dueDate ? new Date(req.body.dueDate) : new Date();

    const s = await db('fee_structures').where({ id: req.params.id, tenant_id: tenantId }).first();
    if (!s) return res.status(404).json({ success: false, error: 'Fee structure not found' });

    const students = await db('enrollments')
      .join('students', 'enrollments.student_id', 'students.id')
      .where('enrollments.class_id', s.class_id)
      .where('enrollments.status', 'active')
      .where('students.tenant_id', tenantId)
      .distinct('students.id as id')
      .select('students.id');

    if (students.length === 0) return res.status(400).json({ success: false, error: 'No active students in this class' });

    let billed = 0;
    await db.transaction(async (trx) => {
      if (isYear) {
        // Bill all three terms; billed counts DISTINCT students touched.
        const touched = new Set<string>();
        for (const t of [1, 2, 3] as const) {
          const before = await trx('fees').where({ class_id: s.class_id, academic_year: s.academic_year, term: TERM_LABELS[t] }).count('* as n').first();
          await billOneTerm(trx, tenantId, s, t, dueDate, students);
          const after = await trx('fees').where({ class_id: s.class_id, academic_year: s.academic_year, term: TERM_LABELS[t] }).count('* as n').first();
          if (Number(after?.n) > Number(before?.n)) students.forEach((st: any) => touched.add(st.id));
        }
        billed = touched.size;
      } else {
        billed = await billOneTerm(trx, tenantId, s, term as 1 | 2 | 3, dueDate, students);
      }
    });

    res.json({ success: true, data: { billed, term: isYear ? 'Full Year' : TERM_LABELS[term] } });
  } catch (error) { next(error); }
});

// ── Unbill: remove UNPAID charges created for a structure's class+year ────────
// Only removes charges with no payment applied (balance == amount) so we never
// erase a student's payment history. Optionally scoped to a single term.
router.post('/:id/unbill', authenticate, requireStaff, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    const s = await db('fee_structures').where({ id: req.params.id, tenant_id: tenantId }).first();
    if (!s) return res.status(404).json({ success: false, error: 'Fee structure not found' });

    const rawTerm = req.body?.term;
    const term = Number(rawTerm);
    const scopeTerm = [1, 2, 3].includes(term) ? TERM_LABELS[term] : null; // null = all terms

    let q = db('fees')
      .where({ tenant_id: tenantId, class_id: s.class_id, academic_year: s.academic_year })
      // Only untouched charges (no payment applied) so history is preserved.
      .whereRaw('COALESCE(balance, amount) = amount')
      .whereIn('status', ['pending', 'overdue']);
    if (scopeTerm) q = q.where({ term: scopeTerm });

    const removed = await q.del();
    res.json({ success: true, data: { removed, term: scopeTerm || 'Full Year' } });
  } catch (error) { next(error); }
});

// ── Billing status: how many charges exist per term for this structure ────────
router.get('/:id/billing-status', authenticate, requireStaff, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    const s = await db('fee_structures').where({ id: req.params.id, tenant_id: tenantId }).first();
    if (!s) return res.status(404).json({ success: false, error: 'Fee structure not found' });

    const rows = await db('fees')
      .where({ tenant_id: tenantId, class_id: s.class_id, academic_year: s.academic_year })
      .whereNot('status', 'deleted')
      .groupBy('term')
      .select('term', db.raw('COUNT(*) as charge_count'));

    const byTerm: Record<string, number> = {};
    for (const r of rows) byTerm[r.term || 'unassigned'] = Number(r.charge_count);
    const total = Object.values(byTerm).reduce((a, b) => a + b, 0);
    res.json({ success: true, data: { billed: total > 0, total, byTerm } });
  } catch (error) { next(error); }
});

export default router;
