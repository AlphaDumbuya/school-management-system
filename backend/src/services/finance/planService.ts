/**
 * Instalment plans (bursar Phase A, R6). A plan splits what a student owes for
 * a year (or one term) into dated instalments. Instalment status is DERIVED:
 * whatever has been paid off the plan's fees since it was created is applied to
 * the instalments oldest first, so there's nothing to keep in sync.
 */
import { db } from '@utils/database';
import { AppError } from '@middleware/errorHandler';
import { normalizeAcademicYear, resolveActiveYear } from '@utils/academicYear';
import { tenantToday } from '@utils/schoolDate';
import { round2, audit, claimNotice, notifyFamily, leFmt } from './core';

const TERMS = ['First Term', 'Second Term', 'Third Term'];

function planFees(tenantId: string, plan: { student_id: string; academic_year: string; term?: string | null }) {
  const q = db('fees').where({ tenant_id: tenantId, student_id: plan.student_id, academic_year: plan.academic_year }).whereNot('status', 'deleted');
  if (plan.term) q.where('term', plan.term);
  return q;
}

const ymd = (d: any) => (d instanceof Date ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : String(d).slice(0, 10));

export const planService = {
  async create(tenantId: string, userId: string, body: any) {
    const student = await db('students').where({ id: body?.student_id, tenant_id: tenantId }).first();
    if (!student) throw new AppError('Student not found', 404, 'NOT_FOUND');
    const year = normalizeAcademicYear(body?.academic_year || null) || (await resolveActiveYear(tenantId)).yearString;
    const active = (await resolveActiveYear(tenantId)).yearString;
    if (!year || !/^\d{4}\/\d{4}$/.test(year)) throw new AppError('Choose an academic year.', 400, 'VALIDATION_ERROR');
    if (active && year < active) throw new AppError(`${year} is a past academic year. Plans are made in ${active}.`, 409, 'PAST_YEAR_READ_ONLY');
    const term = body?.term ? String(body.term) : null;
    if (term && !TERMS.includes(term)) throw new AppError(`Term must be one of: ${TERMS.join(', ')}`, 400, 'VALIDATION_ERROR');

    const owed = round2(Number((await planFees(tenantId, { student_id: student.id, academic_year: year, term })
      .sum({ s: db.raw('COALESCE(balance, amount)') }).first() as any)?.s) || 0);
    if (owed <= 0) throw new AppError('Nothing is owed for that period, so there is nothing to split.', 400, 'VALIDATION_ERROR');

    // Instalments: explicit rows, or an even split (count + first date + months apart).
    let rows: Array<{ due_date: string; amount: number }> = [];
    if (Array.isArray(body?.installments) && body.installments.length) {
      rows = body.installments.map((r: any) => ({ due_date: String(r.due_date || '').slice(0, 10), amount: round2(Number(r.amount)) }));
    } else {
      const count = Math.floor(Number(body?.count));
      const first = String(body?.first_due_date || '').slice(0, 10);
      const gap = Math.max(1, Math.floor(Number(body?.months_apart) || 1));
      if (!(count >= 2 && count <= 24)) throw new AppError('Choose 2 to 24 instalments.', 400, 'VALIDATION_ERROR');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(first)) throw new AppError('Set the first due date.', 400, 'VALIDATION_ERROR');
      const each = Math.floor((owed / count) * 100) / 100;
      for (let i = 0; i < count; i++) {
        const d = new Date(`${first}T00:00:00`);
        d.setMonth(d.getMonth() + i * gap);
        rows.push({ due_date: ymd(d), amount: i === count - 1 ? round2(owed - each * (count - 1)) : each });
      }
    }
    if (rows.length < 2 || rows.length > 24) throw new AppError('A plan needs 2 to 24 instalments.', 400, 'VALIDATION_ERROR');
    for (const r of rows) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.due_date) || Number.isNaN(new Date(r.due_date).getTime())) throw new AppError('Every instalment needs a valid due date.', 400, 'VALIDATION_ERROR');
      if (!(r.amount > 0)) throw new AppError('Every instalment needs an amount above 0.', 400, 'VALIDATION_ERROR');
    }
    rows.sort((a, b) => a.due_date.localeCompare(b.due_date));
    const sum = round2(rows.reduce((s, r) => s + r.amount, 0));
    if (Math.abs(sum - owed) > 0.01) throw new AppError(`Instalments add up to Le ${sum.toFixed(2)}, but Le ${owed.toFixed(2)} is owed. They must match.`, 400, 'VALIDATION_ERROR');

    const dup = await db('payment_plans').where({ tenant_id: tenantId, student_id: student.id, academic_year: year, status: 'active' })
      .modify((q) => { if (term) q.where('term', term); else q.whereNull('term'); }).first();
    if (dup) throw new AppError('This student already has an active plan for that period. Cancel it first.', 409, 'DUPLICATE');

    let plan: any;
    await db.transaction(async (trx) => {
      [plan] = await trx('payment_plans').insert({
        tenant_id: tenantId, student_id: student.id, academic_year: year, term,
        total_amount: owed, number_of_installments: rows.length, installment_amount: round2(owed / rows.length),
        start_date: rows[0].due_date, end_date: rows[rows.length - 1].due_date, status: 'active',
        notes: body?.notes ? String(body.notes).slice(0, 500) : null, created_by: userId,
      }).returning('*');
      await trx('payment_plan_installments').insert(rows.map((r, i) => ({
        payment_plan_id: plan.id, installment_number: i + 1, amount: r.amount, due_date: r.due_date, status: 'pending',
      })));
    });
    await audit('payment_plan', plan.id, 'create', userId, { student: student.id, year, term, owed, instalments: rows });
    return this.schedule(tenantId, plan.id);
  },

  /** A plan with each instalment's derived status and the next amount due. */
  async schedule(tenantId: string, planId: string) {
    const plan = await db('payment_plans').where({ id: planId, tenant_id: tenantId }).first();
    if (!plan) throw new AppError('Plan not found', 404, 'NOT_FOUND');
    const inst = await db('payment_plan_installments').where({ payment_plan_id: plan.id }).orderBy('installment_number');
    const owedNow = round2(Number((await planFees(tenantId, plan).sum({ s: db.raw('COALESCE(balance, amount)') }).first() as any)?.s) || 0);
    let paidTowards = round2(Math.max(0, Number(plan.total_amount) - owedNow));
    const today = await tenantToday(tenantId);
    const rows = inst.map((i: any) => {
      const amt = round2(Number(i.amount));
      const covered = round2(Math.min(amt, paidTowards));
      paidTowards = round2(paidTowards - covered);
      const due = ymd(i.due_date);
      const remaining = round2(amt - covered);
      const status = remaining <= 0.005 ? 'paid' : due < today ? 'overdue' : covered > 0 ? 'part_paid' : 'due';
      return { number: i.installment_number, due_date: due, amount: amt, paid: covered, remaining, status };
    });
    const next = rows.find((r) => r.remaining > 0.005) || null;
    const overdue = rows.filter((r) => r.status === 'overdue');
    return {
      ...plan,
      total_amount: round2(plan.total_amount),
      owed_now: owedNow,
      installments: rows,
      next_due: next,
      overdue_amount: round2(overdue.reduce((s, r) => s + r.remaining, 0)),
      has_overdue: overdue.length > 0,
    };
  },

  async forStudent(tenantId: string, studentId: string) {
    const plans = await db('payment_plans').where({ tenant_id: tenantId, student_id: studentId }).orderBy('created_at', 'desc').select('id');
    return Promise.all(plans.map((p: any) => this.schedule(tenantId, p.id)));
  },

  async list(tenantId: string, year?: string) {
    const q = db('payment_plans as p').join('students as s', 's.id', 'p.student_id').leftJoin('users as u', 'u.id', 's.user_id')
      .where('p.tenant_id', tenantId).where('p.status', 'active')
      .select('p.id', db.raw("COALESCE(u.first_name || ' ' || u.last_name, s.first_name || ' ' || s.last_name) as student_name"), 's.student_id as admission_no');
    const y = normalizeAcademicYear(year || null);
    if (y && y !== 'all') q.where('p.academic_year', y);
    const rows = await q;
    return Promise.all(rows.map(async (r: any) => ({ ...(await this.schedule(tenantId, r.id)), student_name: r.student_name, admission_no: r.admission_no })));
  },

  async cancel(tenantId: string, userId: string, planId: string, reason: string) {
    if (String(reason || '').trim().length < 5) throw new AppError('Give a reason (at least 5 characters).', 400, 'VALIDATION_ERROR');
    const plan = await db('payment_plans').where({ id: planId, tenant_id: tenantId }).first();
    if (!plan) throw new AppError('Plan not found', 404, 'NOT_FOUND');
    if (plan.status !== 'active') throw new AppError(`This plan is already ${plan.status}.`, 409, 'CONFLICT');
    await db('payment_plans').where({ id: planId }).update({ status: 'cancelled', cancelled_reason: reason.trim().slice(0, 500), updated_at: new Date() });
    await audit('payment_plan', planId, 'cancel', userId, { reason });
    return { id: planId, status: 'cancelled' };
  },

  /**
   * Fees on an active plan that is NOT behind schedule. The overdue / late-fee
   * job leaves these alone (the family is keeping to the agreed dates).
   */
  async protectedFeeIds(tenantId: string): Promise<Set<string>> {
    const plans = await db('payment_plans').where({ tenant_id: tenantId, status: 'active' }).select('id');
    const ids = new Set<string>();
    for (const p of plans) {
      const s = await this.schedule(tenantId, p.id);
      if (s.has_overdue) continue;
      (await planFees(tenantId, s).select('id')).forEach((f: any) => ids.add(String(f.id)));
    }
    return ids;
  },

  /**
   * Daily: remind families about instalments due within `daysAhead` days, and
   * once more when one becomes overdue. Each reminder is sent once (in the app
   * and by email). Returns how many families were reminded.
   */
  async remindDue(tenantId: string, daysAhead = 3): Promise<{ due_soon: number; overdue: number }> {
    const today = await tenantToday(tenantId);
    const soon = new Date(`${today}T00:00:00Z`); soon.setUTCDate(soon.getUTCDate() + daysAhead);
    const soonYmd = soon.toISOString().slice(0, 10);
    const plans = await db('payment_plans').where({ tenant_id: tenantId, status: 'active' }).select('id', 'student_id');
    let dueSoon = 0, overdue = 0;
    for (const p of plans) {
      const s = await this.schedule(tenantId, p.id);
      for (const i of s.installments) {
        if (i.remaining <= 0.005) continue;
        if (i.status === 'overdue') {
          if (!(await claimNotice(tenantId, `plan:${p.id}:${i.number}:overdue`))) continue;
          overdue++;
          await notifyFamily(p.student_id, {
            subject: 'Instalment overdue',
            message: `Instalment ${i.number} for {student} (${leFmt(i.remaining)}) was due on ${i.due_date} and is not paid yet. Please pay it to keep to the payment plan.`,
            sourceType: 'payment_plan', sourceId: p.id,
          }, { emailTenantId: tenantId });
        } else if (i.due_date >= today && i.due_date <= soonYmd) {
          if (!(await claimNotice(tenantId, `plan:${p.id}:${i.number}:due`))) continue;
          dueSoon++;
          await notifyFamily(p.student_id, {
            subject: 'Instalment due soon',
            message: `Instalment ${i.number} for {student} (${leFmt(i.remaining)}) is due on ${i.due_date}.`,
            sourceType: 'payment_plan', sourceId: p.id,
          }, { emailTenantId: tenantId });
        }
      }
    }
    return { due_soon: dueSoon, overdue };
  },

  /** For the minimum-payment policy: the next instalment still owed, if on a plan. */
  async nextInstalmentAmount(tenantId: string, studentId: string): Promise<number | null> {
    const plans = await db('payment_plans').where({ tenant_id: tenantId, student_id: studentId, status: 'active' }).select('id');
    let min: number | null = null;
    for (const p of plans) {
      const s = await this.schedule(tenantId, p.id);
      // Everything overdue plus the next instalment counts as "the next amount due".
      const due = round2(s.overdue_amount + (s.next_due && s.next_due.status !== 'overdue' ? s.next_due.remaining : 0)) || (s.next_due?.remaining ?? 0);
      if (due > 0 && (min === null || due < min)) min = due;
    }
    return min;
  },
};

export default planService;
