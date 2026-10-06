/**
 * Arrears & aging (bursar Phase A, R3) + cash position.
 * Each student's unpaid balance split by how long it has been past its due
 * date (school's today): not yet due / 1–30 / 31–60 / 61–90 / 90+ days.
 */
import { db } from '@utils/database';
import { normalizeAcademicYear, resolveYearScope, resolveActiveYear } from '@utils/academicYear';
import { tenantToday } from '@utils/schoolDate';
import { round2 } from './core';

export const BUCKETS = ['not_due', 'd1_30', 'd31_60', 'd61_90', 'd90_plus'] as const;
type Bucket = (typeof BUCKETS)[number];
const SECTION_LEVELS: Record<string, string[]> = {
  nursery: ['NURSERY1', 'NURSERY2', 'NURSERY3'],
  primary: ['CLASS1', 'CLASS2', 'CLASS3', 'CLASS4', 'CLASS5', 'CLASS6'],
  jss: ['JSS1', 'JSS2', 'JSS3'],
  sss: ['SSS1', 'SSS2', 'SSS3'],
};

function bucketFor(days: number): Bucket {
  if (days <= 0) return 'not_due';
  if (days <= 30) return 'd1_30';
  if (days <= 60) return 'd31_60';
  if (days <= 90) return 'd61_90';
  return 'd90_plus';
}

const emptyBuckets = (): Record<Bucket, number> => ({ not_due: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 });

export const agingService = {
  async report(tenantId: string, f: { year?: string; classId?: string; section?: string; min?: number; bucket?: string }) {
    const y = normalizeAcademicYear(f.year || null);
    const year = y && y !== 'all' ? y : '';
    const today = await tenantToday(tenantId);
    const scope = year ? await resolveYearScope(tenantId, year) : null;

    // The class each student was in that year (or their current class).
    const classSub = scope
      ? db('enrollments').distinctOn('student_id').select('student_id', 'class_id')
        .whereIn('class_id', scope.classIds.length ? scope.classIds : ['00000000-0000-0000-0000-000000000000'])
        .whereIn('status', ['enrolled', 'active', 'completed', 'promoted', 'repeated', 'graduated'])
        .orderBy('student_id').orderBy('created_at', 'desc')
      : db('enrollments').distinctOn('student_id').select('student_id', 'class_id').where('status', 'active')
        .orderBy('student_id').orderBy('created_at', 'desc');

    const q = db('fees as f')
      .join('students as s', 's.id', 'f.student_id')
      .leftJoin('users as u', 'u.id', 's.user_id')
      .leftJoin(classSub.as('ye'), 'ye.student_id', 's.id')
      .leftJoin('classes as c', 'c.id', 'ye.class_id')
      .where('f.tenant_id', tenantId)
      .whereNot('f.status', 'deleted')
      .where('f.balance', '>', 0)
      .select(
        'f.id', 'f.balance', 'f.due_date', 'f.student_id', 'f.academic_year',
        's.student_id as admission_no', 'c.id as class_id', 'c.name as class_name', 'c.level as class_level',
        db.raw("COALESCE(u.first_name || ' ' || u.last_name, s.first_name || ' ' || s.last_name) as student_name"),
        db.raw('(?::date - f.due_date) as days', [today]),
      );
    if (year) q.where('f.academic_year', year);
    if (f.classId) q.where('c.id', f.classId);
    if (f.section && SECTION_LEVELS[f.section]) q.whereIn('c.level', SECTION_LEVELS[f.section]);
    const fees = await q;

    const onPlan = new Set((await db('payment_plans').where({ tenant_id: tenantId, status: 'active' }).select('student_id')).map((r: any) => String(r.student_id)));
    const lastPay = new Map<string, string>();
    (await db('payments').where({ tenant_id: tenantId, status: 'completed' }).groupBy('student_id').select('student_id', db.raw('MAX(payment_date) as d')))
      .forEach((r: any) => lastPay.set(String(r.student_id), r.d));

    const students = new Map<string, any>();
    for (const r of fees) {
      const key = String(r.student_id);
      const row = students.get(key) || students.set(key, {
        student_id: r.student_id, student_name: r.student_name, admission_no: r.admission_no,
        class_id: r.class_id, class_name: r.class_name, class_level: r.class_level,
        buckets: emptyBuckets(), total: 0, oldest_days: 0, years: new Set<string>(),
        on_plan: onPlan.has(key), last_payment: lastPay.get(key) || null,
      }).get(key);
      const b = bucketFor(Number(r.days));
      row.buckets[b] = round2(row.buckets[b] + Number(r.balance));
      row.total = round2(row.total + Number(r.balance));
      row.oldest_days = Math.max(row.oldest_days, Number(r.days));
      if (r.academic_year) row.years.add(r.academic_year);
    }
    let list = Array.from(students.values()).map((r) => ({ ...r, years: Array.from(r.years).sort() }));
    if (f.min && f.min > 0) list = list.filter((r) => r.total >= f.min!);
    if (f.bucket && (BUCKETS as readonly string[]).includes(f.bucket)) list = list.filter((r) => r.buckets[f.bucket as Bucket] > 0);
    list.sort((a, b) => b.oldest_days - a.oldest_days || b.total - a.total);

    const totals = emptyBuckets();
    const byClass = new Map<string, any>();
    for (const r of list) {
      for (const b of BUCKETS) totals[b] = round2(totals[b] + r.buckets[b]);
      const ck = r.class_name || 'No class';
      const c = byClass.get(ck) || byClass.set(ck, { class_name: ck, students: 0, total: 0, buckets: emptyBuckets() }).get(ck);
      c.students++;
      c.total = round2(c.total + r.total);
      for (const b of BUCKETS) c.buckets[b] = round2(c.buckets[b] + r.buckets[b]);
    }
    return {
      as_of: today,
      academic_year: year || null,
      totals: { ...totals, total: round2(BUCKETS.reduce((s, b) => s + totals[b], 0)), overdue: round2(totals.d1_30 + totals.d31_60 + totals.d61_90 + totals.d90_plus), students: list.length },
      by_class: Array.from(byClass.values()).sort((a, b) => b.total - a.total),
      students: list,
    };
  },

  /**
   * Cash position: money actually received (completed payments) minus refunds
   * and credit handed back, for the year, this month and today.
   */
  async cashPosition(tenantId: string, year?: string) {
    const y = normalizeAcademicYear(year || null) || (await resolveActiveYear(tenantId)).yearString;
    const scope = y ? await resolveYearScope(tenantId, y) : null;
    const today = await tenantToday(tenantId);
    const monthStart = `${today.slice(0, 7)}-01`;
    const sumPaid = async (from?: string | Date | null, to?: string | Date | null) => {
      const q = db('payments').where({ tenant_id: tenantId, status: 'completed' });
      if (from) q.where('payment_date', '>=', from);
      if (to) q.where('payment_date', '<', to);
      return round2(Number((await q.sum({ s: 'amount' }).first() as any)?.s) || 0);
    };
    // Refunded payments are already excluded (status 'refunded'), so only
    // credit handed back is subtracted (no double counting).
    const tomorrow = new Date(`${today}T00:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const yearIn = await sumPaid(scope?.from, scope?.to);
    const monthIn = await sumPaid(monthStart, null);
    const todayIn = await sumPaid(today, tomorrow);
    const creditOut = async (from?: any, to?: any) => {
      const q = db('student_credits').where({ tenant_id: tenantId, kind: 'refunded' });
      if (from) q.where('created_at', '>=', from);
      if (to) q.where('created_at', '<', to);
      return round2(-(Number((await q.sum({ s: 'amount' }).first() as any)?.s) || 0));
    };
    return {
      academic_year: y,
      year: round2(yearIn - (await creditOut(scope?.from, scope?.to))),
      month: round2(monthIn - (await creditOut(monthStart, null))),
      today: round2(todayIn - (await creditOut(today, tomorrow))),
    };
  },
};

export default agingService;
