/**
 * Student credit balance (bursar Phase A, R5).
 *   + overpayment (cash received above what was owed)
 *   + credit_note (no cash: withdrawal, billing error…)
 *   − applied     (settles open fees as credit_applied adjustments)
 *   − refunded    (cash handed back)
 * Applied credit is NOT new cash, so it never counts as "collected".
 */
import { db } from '@utils/database';
import { AppError } from '@middleware/errorHandler';
import { round2, applyAdjustment, audit } from './core';

async function lockStudent(trx: any, studentId: string) {
  await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`credit:${studentId}`]);
}

export const creditService = {
  async balance(tenantId: string, studentId: string, q: any = db): Promise<number> {
    const r = await q('student_credits').where({ tenant_id: tenantId, student_id: studentId }).sum({ s: 'amount' }).first();
    return round2(Number(r?.s) || 0);
  },

  async history(tenantId: string, studentId: string) {
    const rows = await db('student_credits as c').leftJoin('users as u', 'u.id', 'c.created_by')
      .where({ 'c.tenant_id': tenantId, 'c.student_id': studentId })
      .select('c.*', db.raw("TRIM(CONCAT_WS(' ', u.first_name, u.last_name)) as by_name")).orderBy('c.created_at', 'desc');
    return { balance: await this.balance(tenantId, studentId), entries: rows.map((r: any) => ({ ...r, amount: round2(r.amount) })) };
  },

  async creditNote(tenantId: string, userId: string, studentId: string, amount: number, reason: string) {
    const amt = round2(Number(amount));
    if (!(amt > 0) || amt > 1e9) throw new AppError('Enter a credit amount above 0.', 400, 'VALIDATION_ERROR');
    if (String(reason || '').trim().length < 5) throw new AppError('Give a reason (at least 5 characters).', 400, 'VALIDATION_ERROR');
    const s = await db('students').where({ id: studentId, tenant_id: tenantId }).first();
    if (!s) throw new AppError('Student not found', 404, 'NOT_FOUND');
    const [row] = await db('student_credits').insert({ tenant_id: tenantId, student_id: studentId, kind: 'credit_note', amount: amt, reason: reason.trim().slice(0, 500), created_by: userId }).returning('*');
    await audit('student_credit', row.id, 'credit_note', userId, { studentId, amount: amt, reason });
    return { ...row, balance: await this.balance(tenantId, studentId) };
  },

  /** Use available credit to settle the student's open fees, oldest first. */
  async apply(tenantId: string, userId: string, studentId: string, maxAmount?: number) {
    let applied = 0;
    await db.transaction(async (trx) => {
      await lockStudent(trx, studentId);
      const available = await this.balance(tenantId, studentId, trx);
      let remaining = round2(Math.min(available, maxAmount && maxAmount > 0 ? maxAmount : available));
      if (remaining <= 0) throw new AppError('No credit available.', 409, 'CONFLICT');
      const [entry] = await trx('student_credits').insert({ tenant_id: tenantId, student_id: studentId, kind: 'applied', amount: 0, reason: 'Applied to fees', created_by: userId }).returning('*');
      const fees = await trx('fees').where({ tenant_id: tenantId, student_id: studentId }).whereNot('status', 'deleted').where('balance', '>', 0)
        .orderBy('due_date', 'asc').orderBy('created_at', 'asc').forUpdate();
      for (const f of fees) {
        if (remaining <= 0) break;
        const a = await applyAdjustment(trx, f, remaining, 'credit_applied', { reason: 'Account credit applied', userId, creditId: entry.id });
        remaining = round2(remaining - a);
        applied = round2(applied + a);
      }
      if (applied <= 0) throw new AppError('Nothing is owed, so there is nothing to apply the credit to.', 409, 'CONFLICT');
      await trx('student_credits').where({ id: entry.id }).update({ amount: -applied });
    });
    await audit('student_credit', studentId, 'apply', userId, { applied });
    return { applied, balance: await this.balance(tenantId, studentId) };
  },

  /** Hand credit back in cash (with a reason). */
  async refund(tenantId: string, userId: string, studentId: string, amount: number, reason: string) {
    const amt = round2(Number(amount));
    if (!(amt > 0)) throw new AppError('Enter an amount above 0.', 400, 'VALIDATION_ERROR');
    if (String(reason || '').trim().length < 5) throw new AppError('Give a reason (at least 5 characters).', 400, 'VALIDATION_ERROR');
    await db.transaction(async (trx) => {
      await lockStudent(trx, studentId);
      const available = await this.balance(tenantId, studentId, trx);
      if (amt > available + 0.005) throw new AppError(`Only Le ${available.toFixed(2)} credit is available.`, 409, 'CONFLICT');
      await trx('student_credits').insert({ tenant_id: tenantId, student_id: studentId, kind: 'refunded', amount: -amt, reason: reason.trim().slice(0, 500), created_by: userId });
    });
    await audit('student_credit', studentId, 'refund', userId, { amount: amt, reason });
    return { refunded: amt, balance: await this.balance(tenantId, studentId) };
  },
};

export default creditService;
