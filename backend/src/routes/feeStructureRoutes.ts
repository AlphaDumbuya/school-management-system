import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { authenticate, attachUserContext } from '../middleware/authMiddleware.js';
import { db } from '../utils/database.js';
import { logger } from '../utils/logger.js';
import { normalizeAcademicYear, resolveActiveYear } from '../utils/academicYear.js';

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

export const TERM_LABELS: Record<number, string> = { 1: 'First Term', 2: 'Second Term', 3: 'Third Term' };

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

/**
 * Past academic years are read-only history: no configuring, billing or
 * unbilling. Returns true (and sends a 409) when `year` is before the
 * school's active year. Same rule the Fee Structures page uses.
 */
async function rejectPastYear(res: Response, tenantId: string, year: unknown): Promise<boolean> {
  const y = normalizeAcademicYear(year ? String(year) : null);
  const active = (await resolveActiveYear(tenantId)).yearString;
  if (y && active && y < active) {
    res.status(409).json({
      success: false,
      error: `${y} is a past academic year and is read-only. Configure and bill fees in ${active}.`,
      code: 'PAST_YEAR_READ_ONLY',
    });
    return true;
  }
  return false;
}

/** A money amount: finite, 0…10bn, rounded to cents. null = invalid. */
function money(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1e10) return null;
  return Math.round(n * 100) / 100;
}
/** A whole percentage 0…100, or null when not set. undefined = invalid. */
function percent(v: unknown): number | null | undefined {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 100) return undefined;
  return n;
}

// ── List configured structures + summary ──────────────────────────────────────
router.get('/', authenticate, requireStaff, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).user.tenant_id;
    const rawYear = normalizeAcademicYear((req.query.academic_year as string) || null);
    const academicYear = rawYear && rawYear !== 'all' ? rawYear : undefined;

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
    const academicYear = normalizeAcademicYear((req.query.academic_year as string) || null);
    if (!academicYear || academicYear === 'all') return res.status(400).json({ success: false, error: 'academic_year is required' });

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
    // Store the canonical "YYYY/YYYY" so lookups and the past-year rule match.
    const year = normalizeAcademicYear(String(academicYear));
    if (!year || !/^\d{4}\/\d{4}$/.test(year)) return res.status(400).json({ success: false, error: 'academicYear must look like 2026/2027' });
    if (!(await assertClassInTenant(classId, tenantId))) return res.status(403).json({ success: false, error: 'Class not in your school' });
    if (await rejectPastYear(res, tenantId, year)) return;

    const t1 = money(term1Tuition), t2 = money(term2Tuition), t3 = money(term3Tuition);
    if (t1 === null || t2 === null || t3 === null) {
      return res.status(400).json({ success: false, error: 'Tuition amounts must be numbers between 0 and 10,000,000,000.' });
    }
    const pNew = percent(minPercentNew), pCont = percent(minPercentContinuing), pTerm = percent(minPercentTerm), pLate = percent(lateFeePercent);
    if ([pNew, pCont, pTerm, pLate].some((x) => x === undefined)) {
      return res.status(400).json({ success: false, error: 'Percentages must be whole numbers from 0 to 100.' });
    }
    const cleanExpenses: Array<{ label: string; amount: number; required: boolean }> = [];
    for (const e of (Array.isArray(expenses) ? expenses : []) as any[]) {
      const label = String(e?.label || '').trim().slice(0, 150);
      if (!label) continue;
      if (label.toLowerCase() === 'tuition') return res.status(400).json({ success: false, error: '"Tuition" is reserved. Name the expense something else.' });
      const amt = money(e?.amount);
      if (amt === null) return res.status(400).json({ success: false, error: `"${label}" must be an amount between 0 and 10,000,000,000.` });
      if (cleanExpenses.some((x) => x.label.toLowerCase() === label.toLowerCase())) {
        return res.status(400).json({ success: false, error: `"${label}" is listed twice.` });
      }
      cleanExpenses.push({ label, amount: amt, required: e?.required !== false });
    }

    const now = new Date();
    const payload: any = {
      tenant_id: tenantId, class_id: classId, academic_year: year,
      term1_tuition: t1,
      term2_tuition: t2,
      term3_tuition: t3,
      min_percent_new: pNew,
      min_percent_continuing: pCont,
      min_percent_term: pTerm,
      allow_installments: allowInstallments !== false,
      charges_compulsory_first_term: chargesCompulsoryFirstTerm === true,
      late_fee_percent: pLate,
      policy_notes: policyNotes ?? null,
      updated_at: now,
    };

    // Upsert + expense replacement in ONE transaction (a failure mid-way used
    // to leave half the expenses; a race on create hit the unique key → 500).
    let structureId = '';
    let conflict: any = null;
    try {
      await db.transaction(async (trx) => {
        const existing = await trx('fee_structures').where({ tenant_id: tenantId, class_id: classId, academic_year: year }).forUpdate().first();
        if (existing) {
          const isEdit = req.body?.structureId === existing.id || req.body?.mode === 'edit' || req.body?.allowOverwrite === true;
          if (!isEdit) { conflict = { id: existing.id }; return; }
          await trx('fee_structures').where({ id: existing.id }).update(payload);
          structureId = existing.id;
        } else {
          const [row] = await trx('fee_structures').insert({ ...payload, created_by: userId, created_at: now }).returning('*');
          structureId = row.id;
        }
        await trx('fee_structure_expenses').where({ structure_id: structureId }).del();
        if (cleanExpenses.length) {
          await trx('fee_structure_expenses').insert(cleanExpenses.map((e) => ({ structure_id: structureId, ...e, created_at: now })));
        }
      });
    } catch (e: any) {
      if (e?.code === '23505') conflict = { id: null };
      else throw e;
    }
    if (conflict) {
      return res.status(409).json({
        success: false,
        error: 'A fee structure already exists for this class and academic year. Open it to edit, or remove it first.',
        code: 'FEE_STRUCTURE_EXISTS',
        data: conflict,
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
    if (await rejectPastYear(res, tenantId, s.academic_year)) return;
    const billedFee = await db('fees').where({ tenant_id: tenantId, class_id: s.class_id, academic_year: s.academic_year }).whereNot('status', 'deleted').first();
    if (billedFee) return res.status(409).json({ success: false, error: 'Students have been billed from this structure. Unbill first.' });
    await db('fee_structures').where({ id: s.id, tenant_id: tenantId }).del();
    res.json({ success: true });
  } catch (error) { next(error); }
});

/** Bill one term for a structure inside a transaction. Returns students touched. */
export async function billOneTerm(
  trx: any,
  tenantId: string,
  s: any,
  term: 1 | 2 | 3,
  dueDate: Date,
  students: Array<{ id: string }>,
): Promise<Set<string>> {
  const tuition = Number(term === 1 ? s.term1_tuition : term === 2 ? s.term2_tuition : s.term3_tuition) || 0;
  // Itemised academic-year expenses are billed ONCE, with Term 1.
  const expenses = term === 1 ? await trx('fee_structure_expenses').where({ structure_id: s.id }) : [];
  const termLabel = TERM_LABELS[term];
  const now = new Date();
  const billedIds = new Set<string>();

  for (const stu of students) {
    let added = false;
    if (tuition > 0) {
      const dup = await trx('fees')
        .where({ tenant_id: tenantId, student_id: stu.id, term: termLabel, academic_year: s.academic_year, type: 'Tuition' })
        .whereNot('status', 'deleted')
        .first();
      if (!dup) {
        await trx('fees').insert({
          id: crypto.randomUUID(),
          tenant_id: tenantId, student_id: stu.id, class_id: s.class_id,
          type: 'Tuition', amount: tuition, balance: tuition, source: 'structure',
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
        .where({ tenant_id: tenantId, student_id: stu.id, academic_year: s.academic_year, type: e.label })
        .whereNot('status', 'deleted')
        .first();
      if (dup) continue;
      await trx('fees').insert({
        id: crypto.randomUUID(),
        tenant_id: tenantId, student_id: stu.id, class_id: s.class_id,
        type: e.label, description: 'Academic year expense', amount: amt, balance: amt, source: 'structure',
        term: termLabel, academic_year: s.academic_year,
        required: e.required !== false,
        due_date: dueDate, status: 'pending', created_at: now, updated_at: now,
      });
      added = true;
    }
    if (added) billedIds.add(stu.id);
  }
  return billedIds;
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
    const dueDate = req.body?.dueDate ? new Date(req.body.dueDate) : null;
    if (!dueDate || Number.isNaN(dueDate.getTime())) {
      return res.status(400).json({ success: false, error: 'Set a valid due date.' });
    }

    const s = await db('fee_structures').where({ id: req.params.id, tenant_id: tenantId }).first();
    if (!s) return res.status(404).json({ success: false, error: 'Fee structure not found' });
    if (await rejectPastYear(res, tenantId, s.academic_year)) return;

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
      // Serialise billing per structure: two clicks / two tabs used to both
      // pass the duplicate check and charge students twice.
      await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`fee-bill:${s.id}`]);
      const touched = new Set<string>();
      for (const t of (isYear ? [1, 2, 3] : [term]) as Array<1 | 2 | 3>) {
        const ids = await billOneTerm(trx, tenantId, s, t, dueDate, students);
        ids.forEach((id) => touched.add(id));
      }
      billed = touched.size;
      // Approved discounts / scholarships cover newly billed fees too.
      const { discountService } = await import('../services/finance/discountService.js');
      for (const st of students) await discountService.applyApprovedGrantsForStudent(trx, tenantId, st.id, s.academic_year);
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
    if (await rejectPastYear(res, tenantId, s.academic_year)) return;

    const rawTerm = req.body?.term;
    const term = Number(rawTerm);
    const scopeTerm = [1, 2, 3].includes(term) ? TERM_LABELS[term] : null; // null = all terms

    // Only charges THIS structure creates (tuition + its expense items), with
    // no payment and not on a live invoice. They are soft-deleted, so the
    // audit trail stays; manual / ad-hoc fees are never touched.
    const expenseLabels = (await db('fee_structure_expenses').where({ structure_id: s.id }).select('label')).map((e: any) => e.label);
    let q = db('fees')
      .where({ tenant_id: tenantId, class_id: s.class_id, academic_year: s.academic_year })
      .whereIn('type', ['Tuition', ...expenseLabels])
      // Unpaid: no payment (checked below) and no non-cash change other than a
      // discount / scholarship, which is taken back here and re-applied on rebill.
      .whereNotExists(function (this: any) {
        this.select(db.raw('1')).from('fee_adjustments as fa').whereRaw('fa.fee_id = fees.id')
          .whereNull('fa.reversed_at').whereNull('fa.discount_grant_id');
      })
      .whereIn('status', ['pending', 'overdue', 'partial'])
      .whereNotExists(function (this: any) {
        this.select(db.raw('1')).from('payments as p').whereRaw('p.fee_id::text = fees.id::text').whereNot('p.status', 'failed');
      })
      .whereNotExists(function (this: any) {
        this.select(db.raw('1')).from('invoice_items as ii').join('invoices as iv', 'iv.id', 'ii.invoice_id')
          .whereRaw('ii.fee_id::text = fees.id::text').whereNot('iv.status', 'cancelled');
      });
    if (scopeTerm) q = q.where({ term: scopeTerm });
    let removed = 0;
    await db.transaction(async (trx) => {
      const ids = (await q.clone().transacting(trx).forUpdate().select('fees.id')).map((r: any) => r.id);
      if (!ids.length) return;
      await trx('fee_adjustments').whereIn('fee_id', ids).whereNull('reversed_at').whereNotNull('discount_grant_id')
        .update({ reversed_at: new Date(), reversed_by: (req as any).user.id });
      removed = await trx('fees').whereIn('id', ids).update({ status: 'deleted', balance: 0, updated_at: new Date() });
    });
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
