/**
 * Student lookup for finance staff:
 *  - search(): a "type anything" search for the bursar's pickers (Record
 *    Payment, Give a discount). Every word must match one of: the student's
 *    names, admission number, email, class, or a guardian's name / phone /
 *    email. Results carry the class, status and what the student owes, so the
 *    right child is easy to pick.
 *  - profile(): what the bursar needs about one student, and nothing more:
 *    identity, class, status, guardian contacts and money totals. Never
 *    credentials, medical details, results, attendance or discipline.
 */
import { db } from '@utils/database';
import { AppError } from '@middleware/errorHandler';
import { resolveActiveYear } from '@utils/academicYear';
import { round2, studentOutstanding } from './core';

const esc = (t: string) => t.replace(/[%_\\]/g, (c) => `\\${c}`);
const LEFT = ['inactive', 'withdrawn', 'transferred', 'graduated', 'expelled', 'deleted'];

/** Each student's class this (active) year, else their latest class. */
function classJoin(q: any) {
  return q.leftJoin(
    db('enrollments as e').join('classes as c', 'c.id', 'e.class_id')
      .distinctOn('e.student_id')
      .select('e.student_id', 'c.name as class_name', 'c.level as class_level', 'e.status as enrolment_status')
      .orderBy('e.student_id')
      .orderByRaw("CASE WHEN e.status IN ('enrolled','active') THEN 0 ELSE 1 END")
      .orderBy('e.created_at', 'desc')
      .as('cls'),
    'cls.student_id', 's.id',
  );
}

export const studentLookupService = {
  async search(tenantId: string, raw: string, limit = 12) {
    const words = String(raw || '').trim().split(/\s+/).filter((w) => w.length > 0).slice(0, 5);
    if (!words.length) return [];
    const q = classJoin(db('students as s').leftJoin('users as u', 'u.id', 's.user_id'))
      .where('s.tenant_id', tenantId);
    for (const w of words) {
      const like = `%${esc(w)}%`;
      const digits = w.replace(/\D/g, '');
      q.where((x: any) => {
        x.whereILike('s.first_name', like).orWhereILike('s.last_name', like)
          .orWhereILike('u.first_name', like).orWhereILike('u.last_name', like)
          .orWhereILike('s.student_id', like).orWhereILike('s.email', like).orWhereILike('u.email', like)
          .orWhereILike('cls.class_name', like).orWhereILike('s.guardian_name', like)
          .orWhereExists(db('guardians as g').whereRaw('g.student_id = s.id').where((gq: any) => {
            gq.whereILike('g.first_name', like).orWhereILike('g.last_name', like).orWhereILike('g.email', like);
            if (digits.length >= 4) gq.orWhereRaw("regexp_replace(COALESCE(g.phone_number, ''), '\\D', '', 'g') LIKE ?", [`%${digits}%`]);
          }));
        if (digits.length >= 4) x.orWhereRaw("regexp_replace(COALESCE(s.guardian_phone, ''), '\\D', '', 'g') LIKE ?", [`%${digits}%`]);
      });
    }
    const first = esc(words[0]);
    const rows = await q
      .select('s.id', 's.student_id as admission_no', 's.status', 's.photo_url',
        db.raw("TRIM(CONCAT_WS(' ', COALESCE(u.first_name, s.first_name), COALESCE(u.last_name, s.last_name))) as name"),
        'cls.class_name', 'cls.class_level',
        db.raw("(SELECT COALESCE(SUM(COALESCE(f.balance, f.amount)), 0) FROM fees f WHERE f.student_id = s.id AND f.tenant_id = s.tenant_id AND f.status <> 'deleted') as outstanding"),
        db.raw(`(SELECT TRIM(CONCAT_WS(' ', g.first_name, g.last_name)) FROM guardians g WHERE g.student_id = s.id ORDER BY g.is_primary_guardian DESC NULLS LAST, g.created_at LIMIT 1) as guardian_name`),
        db.raw(`(SELECT g.phone_number FROM guardians g WHERE g.student_id = s.id ORDER BY g.is_primary_guardian DESC NULLS LAST, g.created_at LIMIT 1) as guardian_phone`))
      // Exact admission number first, then names starting with the first word,
      // current students before those who left, then who owes the most.
      .orderByRaw('CASE WHEN LOWER(s.student_id) = LOWER(?) THEN 0 ELSE 1 END', [words.join(' ')])
      .orderByRaw(`CASE WHEN COALESCE(u.first_name, s.first_name) ILIKE ? OR COALESCE(u.last_name, s.last_name) ILIKE ? THEN 0 ELSE 1 END`, [`${first}%`, `${first}%`])
      .orderByRaw(`CASE WHEN LOWER(COALESCE(s.status, '')) IN (${LEFT.map(() => '?').join(',')}) THEN 1 ELSE 0 END`, LEFT)
      .orderByRaw('outstanding DESC')
      .limit(Math.min(Math.max(limit, 1), 25));
    return rows.map((r: any) => ({ ...r, outstanding: round2(r.outstanding), left_school: LEFT.includes(String(r.status || '').toLowerCase()) }));
  },

  async profile(tenantId: string, studentId: string) {
    const row = await classJoin(db('students as s').leftJoin('users as u', 'u.id', 's.user_id'))
      .where({ 's.id': studentId, 's.tenant_id': tenantId })
      .first('s.id', 's.student_id as admission_no', 's.status', 's.photo_url', 's.gender', 's.enrollment_date',
        db.raw("TRIM(CONCAT_WS(' ', COALESCE(u.first_name, s.first_name), COALESCE(u.last_name, s.last_name))) as name"),
        db.raw('COALESCE(u.email, s.email) as email'), 's.phone',
        's.guardian_name', 's.guardian_phone', 's.guardian_relationship',
        'cls.class_name', 'cls.class_level', 'cls.enrolment_status');
    if (!row) throw new AppError('Student not found', 404, 'NOT_FOUND');
    const guardians = await db('guardians as g').leftJoin('users as pu', 'pu.id', 'g.user_id').where('g.student_id', studentId)
      .orderBy('g.is_primary_guardian', 'desc').orderBy('g.created_at')
      .select(db.raw("TRIM(CONCAT_WS(' ', g.first_name, g.last_name)) as name"), 'g.relationship', 'g.phone_number as phone',
        db.raw('COALESCE(g.email, pu.email) as email'), 'g.is_primary_guardian as is_primary', db.raw('(g.user_id IS NOT NULL) as has_account'));
    // Older records keep the guardian on the student row only.
    if (!guardians.length && (row.guardian_name || row.guardian_phone)) {
      guardians.push({ name: row.guardian_name, relationship: row.guardian_relationship, phone: row.guardian_phone, email: null, is_primary: true, has_account: false });
    }
    const year = (await resolveActiveYear(tenantId)).yearString;
    const yr = year
      ? await db('fees').where({ tenant_id: tenantId, student_id: studentId, academic_year: year }).whereNot('status', 'deleted')
        .first(db.raw('COALESCE(SUM(amount), 0) as billed'), db.raw('COALESCE(SUM(COALESCE(balance, amount)), 0) as owed'))
      : null;
    const credit = await db('student_credits').where({ tenant_id: tenantId, student_id: studentId }).sum({ s: 'amount' }).first();
    const lastPay = await db('payments').where({ tenant_id: tenantId, student_id: studentId }).whereIn('status', ['completed', 'refunded'])
      .orderBy('payment_date', 'desc').first('payment_date', 'amount', 'receipt_number');
    const { guardian_name, guardian_phone, guardian_relationship, ...student } = row;
    return {
      ...student,
      left_school: LEFT.includes(String(row.status || '').toLowerCase()),
      guardians,
      money: {
        academic_year: year,
        billed_this_year: round2((yr as any)?.billed),
        owed_this_year: round2((yr as any)?.owed),
        owed_total: await studentOutstanding(db, tenantId, studentId),
        credit: round2((credit as any)?.s),
        last_payment: lastPay ? { date: String(lastPay.payment_date instanceof Date ? lastPay.payment_date.toISOString() : lastPay.payment_date).slice(0, 10), amount: round2(lastPay.amount), receipt_number: lastPay.receipt_number } : null,
      },
    };
  },
};

export default studentLookupService;
