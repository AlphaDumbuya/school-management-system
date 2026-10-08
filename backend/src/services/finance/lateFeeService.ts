/**
 * Overdue marking + late fees (bursar Phase A, R2).
 *
 * runDaily(): mark fees overdue (school's today), then (only if the school
 * turned late fees on) add ONE "Late fee" charge per overdue fee past the grace
 * period. Idempotent: a partial unique index on fees(parent_fee_id) for late
 * fees means a second run (or two runs at once) never charges twice. Students
 * keeping to an instalment plan are left alone.
 */
import crypto from 'crypto';
import { db } from '@utils/database';
import { AppError } from '@middleware/errorHandler';
import { tenantToday } from '@utils/schoolDate';
import { resolveActiveYear } from '@utils/academicYear';
import { logger } from '@utils/logger';
import { round2, applyAdjustment, financeSettings, audit, notifyFamily, leFmt } from './core';
import { planService } from './planService';

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const lateFeeService = {
  async markOverdue(tenantId: string, protectedIds: Set<string>): Promise<number> {
    const today = await tenantToday(tenantId);
    const candidates = await db('fees')
      .where({ tenant_id: tenantId })
      .whereIn('status', ['pending', 'partial'])
      .where('balance', '>', 0)
      .where('due_date', '<', today)
      .select('id');
    const ids = candidates.map((f: any) => String(f.id)).filter((id) => !protectedIds.has(id));
    if (!ids.length) return 0;
    return db('fees').whereIn('id', ids).update({ status: 'overdue', overdue_marked_at: new Date(), updated_at: new Date() });
  },

  /** Late fee charge for one overdue fee (fixed amount, else % of the balance; capped). */
  lateFeeAmount(settings: Awaited<ReturnType<typeof financeSettings>>, balance: number): number {
    let amt = settings.lateFeeFixed > 0 ? settings.lateFeeFixed : (settings.lateFeePercent / 100) * balance;
    if (settings.lateFeeCap > 0) amt = Math.min(amt, settings.lateFeeCap);
    return round2(amt);
  },

  async insertLateFee(parent: any, amount: number, dueDate: string, userId: string | null, note: string): Promise<boolean> {
    try {
      await db('fees').insert({
        id: crypto.randomUUID(),
        tenant_id: parent.tenant_id, student_id: parent.student_id, class_id: parent.class_id,
        type: 'Late Fee', description: note, amount, balance: amount,
        term: parent.term, academic_year: parent.academic_year, due_date: dueDate,
        status: 'pending', required: true, source: 'late_fee', parent_fee_id: parent.id,
        created_at: new Date(), updated_at: new Date(),
      });
      await audit('fee', parent.id, 'late_fee_added', userId, { amount, note });
      return true;
    } catch (e: any) {
      if (e?.code === '23505') return false; // already charged
      throw e;
    }
  },

  async applyLateFees(tenantId: string, protectedIds: Set<string>): Promise<{ charged: number; amount: number }> {
    const s = await financeSettings(tenantId);
    if (!s.lateFeeEnabled || (s.lateFeePercent <= 0 && s.lateFeeFixed <= 0)) return { charged: 0, amount: 0 };
    const today = await tenantToday(tenantId);
    const cutoff = addDays(today, -s.lateFeeGraceDays);
    // Only this year's fees: a penalty dated today must not land in a closed year.
    const year = (await resolveActiveYear(tenantId)).yearString;
    const fees = await db('fees as f')
      .where('f.tenant_id', tenantId)
      .where('f.status', 'overdue')
      .where('f.balance', '>', 0)
      .where('f.due_date', '<', cutoff)
      .where('f.academic_year', year)
      .where((w) => w.whereNull('f.source').orWhereNot('f.source', 'late_fee'))
      .whereNotExists(db('fees as lf').whereRaw('lf.parent_fee_id = f.id').where('lf.source', 'late_fee').whereNot('lf.status', 'deleted'))
      .select('f.*');
    let charged = 0;
    let amount = 0;
    const perStudent = new Map<string, number>();
    for (const f of fees) {
      if (protectedIds.has(String(f.id))) continue;
      const amt = this.lateFeeAmount(s, Number(f.balance));
      if (amt <= 0) continue;
      const label = s.lateFeeFixed > 0 ? `Late fee on ${f.type} (${f.term || f.academic_year})` : `Late fee ${s.lateFeePercent}% on ${f.type} (${f.term || f.academic_year})`;
      if (await this.insertLateFee(f, amt, today, null, label)) {
        charged++; amount += amt;
        perStudent.set(String(f.student_id), (perStudent.get(String(f.student_id)) || 0) + amt);
      }
    }
    // One notice per family, not one per charge.
    for (const [studentId, total] of perStudent) {
      await notifyFamily(studentId, {
        subject: 'Late fee added',
        message: `A late fee of ${leFmt(total)} was added because fees for {student} are past due. Pay the balance to avoid more.`,
        sourceType: 'fee',
      }, { emailTenantId: tenantId });
    }
    return { charged, amount: round2(amount) };
  },

  async runForTenant(tenantId: string) {
    const protectedIds = await planService.protectedFeeIds(tenantId);
    const markedOverdue = await this.markOverdue(tenantId, protectedIds);
    const late = await this.applyLateFees(tenantId, protectedIds);
    const reminders = await planService.remindDue(tenantId).catch(() => ({ due_soon: 0, overdue: 0 }));
    return { markedOverdue, lateFeesCharged: late.charged, lateFeeAmount: late.amount, instalmentReminders: reminders };
  },

  /** Every active school (cron) or one school (Run now). */
  async runDaily(tenantId?: string) {
    const tenants = tenantId ? [{ id: tenantId }] : await db('tenants').where({ status: 'active' }).select('id');
    const results: any[] = [];
    for (const t of tenants) {
      try {
        results.push({ tenantId: t.id, ...(await this.runForTenant(t.id)) });
      } catch (e: any) {
        logger.error(`finance daily job failed for tenant ${t.id}: ${e?.message || e}`);
        results.push({ tenantId: t.id, error: e?.message || String(e) });
      }
    }
    return results;
  },

  /** Waive a late fee (all of what's still owed on it), with a reason. */
  async waive(tenantId: string, userId: string, feeId: string, reason: string) {
    if (String(reason || '').trim().length < 5) throw new AppError('Give a reason (at least 5 characters).', 400, 'VALIDATION_ERROR');
    let waived = 0;
    await db.transaction(async (trx) => {
      const fee = await trx('fees').where({ id: feeId, tenant_id: tenantId }).forUpdate().first();
      if (!fee) throw new AppError('Fee not found', 404, 'NOT_FOUND');
      if (fee.source !== 'late_fee') throw new AppError('Only late fees can be waived here. Use a discount or waiver for other charges.', 409, 'CONFLICT');
      waived = await applyAdjustment(trx, fee, Number(fee.balance), 'late_fee_waiver', { reason: reason.trim(), userId });
      if (waived <= 0) throw new AppError('Nothing is owed on this late fee.', 409, 'CONFLICT');
    });
    await audit('fee', feeId, 'late_fee_waived', userId, { reason, waived });
    return { feeId, waived };
  },

  /** Add a late fee by hand (once per fee), e.g. when automatic late fees are off. */
  async addManual(tenantId: string, userId: string, feeId: string, amount: number, reason: string) {
    const fee = await db('fees').where({ id: feeId, tenant_id: tenantId }).whereNot('status', 'deleted').first();
    if (!fee) throw new AppError('Fee not found', 404, 'NOT_FOUND');
    if (fee.source === 'late_fee') throw new AppError('That is already a late fee.', 409, 'CONFLICT');
    const amt = round2(Number(amount));
    if (!(amt > 0) || amt > 1e9) throw new AppError('Enter a late fee amount above 0.', 400, 'VALIDATION_ERROR');
    const active = (await resolveActiveYear(tenantId)).yearString;
    if (active && fee.academic_year && fee.academic_year < active) throw new AppError(`Late fees can't be added to ${fee.academic_year} (a past year).`, 409, 'PAST_YEAR_READ_ONLY');
    const today = await tenantToday(tenantId);
    const ok = await this.insertLateFee(fee, amt, today, userId, `Late fee on ${fee.type}${reason ? `: ${String(reason).slice(0, 200)}` : ''}`);
    if (!ok) throw new AppError('A late fee was already added to this charge.', 409, 'DUPLICATE');
    return { feeId, amount: amt };
  },
};

export default lateFeeService;
