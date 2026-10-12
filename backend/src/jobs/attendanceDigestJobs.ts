/**
 * Weekly attendance digest → parents.
 *
 * Instead of an email on every mark, each family gets ONE email at the end of
 * the school week (Friday evening) listing, for every child, how each day
 * Monday to Friday went plus a short summary. Schools can switch to per-day
 * alerts or to nothing with the `attendance_notify_mode` setting.
 *
 * Safe to run more than once: each family's digest for a given week is claimed
 * in `finance_notices`, so repeats (the Friday cron plus the Saturday catch-up)
 * never double-send. A claim is released when the send fails so the catch-up
 * can retry.
 */
import crypto from 'crypto';
import cron from 'node-cron';
import { db } from '@utils/database';
import { logger } from '@utils/logger';
import { tenantToday } from '@utils/schoolDate';
import { isDemoTenant } from '@utils/demo';
import { summarizeAttendanceRows } from '@utils/termWindows';
import { claimNotice } from '@services/finance/core';
import { attendanceNotifyMode } from '@services/attendanceNotifications';

export type DigestDayStatus = 'present' | 'late' | 'excused' | 'absent' | 'none';

export interface DigestChild {
  name: string;
  className?: string;
  /** Monday to Friday, in order. */
  days: Array<{ date: string; label: string; status: DigestDayStatus }>;
  summary: { present: number; late: number; excused: number; absent: number; recorded: number; rate: number };
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const RANK_TO_STATUS: Record<number, DigestDayStatus> = { 4: 'present', 3: 'excused', 2: 'late', 1: 'absent' };
const RANK: Record<string, number> = { present: 4, excused: 3, late: 2, absent: 1 };

const dateKey = (v: any): string => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v || '').slice(0, 10);
};

function addDays(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Day of week of a YYYY-MM-DD date: 0 = Sunday ... 6 = Saturday. */
function weekday(key: string): number {
  return new Date(`${key}T00:00:00Z`).getUTCDay();
}

/**
 * The Monday of the school week a date belongs to. Saturday and Sunday count
 * as the week that just ended.
 */
export function weekStartFor(key: string): string {
  const dow = weekday(key);
  const back = dow === 0 ? 6 : dow - 1;
  return addDays(key, -back);
}

/** Build one child's digest from the week's raw attendance rows. */
export function buildChildDigest(name: string, className: string | undefined, weekStart: string, rows: Array<{ attendance_date: any; status: string }>): DigestChild {
  const byDay = new Map<string, number>();
  for (const r of rows) {
    const k = dateKey(r.attendance_date);
    byDay.set(k, Math.max(byDay.get(k) ?? 0, RANK[String(r.status || '').toLowerCase()] ?? 0));
  }
  const days = DAY_LABELS.map((label, i) => {
    const date = addDays(weekStart, i);
    const rank = byDay.get(date) ?? 0;
    return { date, label, status: (RANK_TO_STATUS[rank] || 'none') as DigestDayStatus };
  });
  const s = summarizeAttendanceRows(rows.map((r) => ({ attendance_date: dateKey(r.attendance_date), status: r.status })));
  return {
    name,
    className,
    days,
    summary: { present: s.present, late: s.late, excused: s.excused, absent: s.absent, recorded: s.days, rate: s.rate },
  };
}

export interface DigestOptions {
  /** Which local weekdays (0 = Sun ... 6 = Sat) a school may be processed on. */
  weekdays: number[];
  /** Only these schools (testing). */
  tenantId?: string;
  /** Compute and report, send nothing. */
  dryRun?: boolean;
}

export interface DigestResult {
  tenants: number;
  families: number;
  sent: number;
  skipped: number;
  failed: number;
}

export async function digestForTenant(tenantId: string, weekStart: string, dryRun: boolean): Promise<Omit<DigestResult, 'tenants'>> {
  const out = { families: 0, sent: 0, skipped: 0, failed: 0 };
  const weekEnd = addDays(weekStart, 4);

  // Everyone with attendance this week, and who their parents are.
  const rows = await db('attendance as a')
    .join('students as s', 's.id', 'a.student_id')
    .leftJoin('users as u', 'u.id', 's.user_id')
    .where('s.tenant_id', tenantId)
    .whereRaw("COALESCE(s.status, 'active') NOT IN ('withdrawn', 'graduated', 'deleted', 'transferred', 'inactive')")
    .whereBetween('a.attendance_date', [weekStart, weekEnd])
    .select(
      'a.student_id', 'a.attendance_date', 'a.status', 'a.class_id',
      db.raw("COALESCE(NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), ''), TRIM(COALESCE(s.first_name,'') || ' ' || COALESCE(s.last_name,'')), s.student_id) as student_name"),
    ) as any[];
  if (!rows.length) return out;

  const byStudent = new Map<string, { name: string; classId: string | null; rows: any[] }>();
  for (const r of rows) {
    const e: { name: string; classId: string | null; rows: any[] } =
      byStudent.get(r.student_id) || { name: r.student_name, classId: r.class_id || null, rows: [] };
    e.rows.push(r);
    if (!e.classId && r.class_id) e.classId = r.class_id;
    byStudent.set(r.student_id, e);
  }

  const studentIds = Array.from(byStudent.keys());
  const guardians = await db('guardians')
    .whereIn('student_id', studentIds)
    .whereNotNull('email')
    .select('student_id', 'email', 'first_name', 'last_name') as any[];

  const classIds = Array.from(new Set(Array.from(byStudent.values()).map((s) => s.classId).filter(Boolean))) as string[];
  const classes = classIds.length ? await db('classes').whereIn('id', classIds).select('id', 'name') : [];
  const className = new Map<string, string>(classes.map((c: any) => [c.id, c.name]));

  // One email per family: group by the parent's (lowercased) address.
  const families = new Map<string, { email: string; name: string; studentIds: Set<string> }>();
  for (const g of guardians) {
    const email = String(g.email || '').trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) continue;
    const f = families.get(email) || { email: g.email.trim(), name: [g.first_name, g.last_name].filter(Boolean).join(' ') || 'Parent/Guardian', studentIds: new Set<string>() };
    f.studentIds.add(g.student_id);
    families.set(email, f);
  }

  const { default: emailService } = await import('@services/emailService');
  for (const [lower, fam] of families) {
    out.families++;
    const claimKey = `attn-week:${weekStart}:${crypto.createHash('sha1').update(lower).digest('hex').slice(0, 20)}`;
    if (dryRun) { out.skipped++; continue; }
    if (!(await claimNotice(tenantId, claimKey))) { out.skipped++; continue; }
    try {
      const children = Array.from(fam.studentIds).map((id) => {
        const s = byStudent.get(id)!;
        return buildChildDigest(s.name, s.classId ? className.get(s.classId) : undefined, weekStart, s.rows);
      });
      const res: any = await emailService.sendWeeklyAttendanceEmail(tenantId, fam.email, {
        recipientName: fam.name, weekStart, weekEnd, children,
      });
      if (res?.status === 'sent') out.sent++;
      else {
        // 'disabled' = nothing left the building (no key / demo address). Free the claim.
        out.skipped++;
        await db('finance_notices').where({ tenant_id: tenantId, key: claimKey }).del().catch(() => {});
      }
    } catch (e: any) {
      out.failed++;
      await db('finance_notices').where({ tenant_id: tenantId, key: claimKey }).del().catch(() => {});
      logger.warn(`Weekly attendance email to ${lower} failed: ${e?.message || e}`);
    }
  }

  // The same summary in the parent's app (one per child per week).
  if (!dryRun) await weeklyInAppNotices(tenantId, weekStart, byStudent).catch((e) => logger.warn(`Weekly attendance in-app notices failed: ${e?.message || e}`));
  return out;
}

async function weeklyInAppNotices(tenantId: string, weekStart: string, byStudent: Map<string, { name: string; classId: string | null; rows: any[] }>) {
  const { default: notificationService } = await import('@services/notificationService');
  for (const [studentId, s] of byStudent) {
    if (!(await claimNotice(tenantId, `attn-week-app:${weekStart}:${studentId}`))) continue;
    const c = buildChildDigest(s.name, undefined, weekStart, s.rows);
    const { present, late, excused, absent, recorded, rate } = c.summary;
    const message = `${s.name} this week: ${present} present${late ? `, ${late} late` : ''}${excused ? `, ${excused} excused` : ''}, ${absent} absent (${recorded} day${recorded === 1 ? '' : 's'} recorded, ${rate}% attendance).`;
    const links = await db('guardians').where({ student_id: studentId }).whereNotNull('user_id').pluck('user_id') as string[];
    const stu = await db('students').where({ id: studentId }).first('user_id');
    const recipients = new Set<string>([...links, ...(stu?.user_id ? [stu.user_id] : [])]);
    for (const recipientId of recipients) {
      await notificationService.createNotification({
        notificationType: 'attendance', recipientId,
        subject: `Weekly attendance: ${s.name}`, message,
        data: { kind: 'attendance_weekly', student_id: studentId, week_start: weekStart, url: '/students/attendance' },
        channels: ['in_app'], sourceType: 'attendance', sourceId: studentId,
      }).catch(() => {});
    }
  }
}

/**
 * Send the weekly digest for every school whose local weekday is in
 * `opts.weekdays`. The week is the one containing the school's "today"
 * (Saturday/Sunday = the week just ended).
 */
export async function runWeeklyAttendanceDigest(opts: DigestOptions): Promise<DigestResult> {
  const total: DigestResult = { tenants: 0, families: 0, sent: 0, skipped: 0, failed: 0 };
  const q = db('tenants').where({ status: 'active' });
  if (opts.tenantId) q.where({ id: opts.tenantId });
  const tenants = await q.select('id') as any[];
  for (const t of tenants) {
    try {
      if (await isDemoTenant(t.id)) continue;
      if ((await attendanceNotifyMode(t.id)) !== 'weekly') continue;
      const today = await tenantToday(t.id);
      if (!opts.weekdays.includes(weekday(today))) continue;
      const r = await digestForTenant(t.id, weekStartFor(today), !!opts.dryRun);
      total.tenants++;
      total.families += r.families; total.sent += r.sent; total.skipped += r.skipped; total.failed += r.failed;
    } catch (e: any) {
      total.failed++;
      logger.warn(`Weekly attendance digest failed for tenant ${t.id}: ${e?.message || e}`);
    }
  }
  logger.info(`Weekly attendance digest: ${JSON.stringify(total)}`);
  return total;
}

/** Friday evening run: schools where it is Friday (or, east of UTC, already Saturday). */
export const runFridayDigest = () => runWeeklyAttendanceDigest({ weekdays: [5, 6] });
/** Daily-job catch-up: if Friday's run missed a school, Saturday picks it up. */
export const runSaturdayCatchUp = () => runWeeklyAttendanceDigest({ weekdays: [6] });

let job: ReturnType<typeof cron.schedule> | null = null;

/**
 * Long-running servers: Friday 18:00 (server time), and again Saturday 18:00
 * as a catch-up (claims make the repeat a no-op). On Vercel the
 * cron routes do this instead (node-cron never fires on serverless).
 */
export function startAttendanceDigestJobs(): void {
  if (job || process.env.VERCEL) return;
  job = cron.schedule('0 18 * * 5,6', () => {
    runWeeklyAttendanceDigest({ weekdays: [5, 6] }).catch((e) => logger.warn(`[attendanceDigest] run failed: ${e?.message || e}`));
  });
  logger.info('[attendanceDigest] weekly attendance digest scheduled (Fri/Sat 18:00)');
}
