/**
 * Class-register absence alerts → the student's guardians (in-app + email)
 * and the student's own login (in-app).
 *
 * Distinct from the check-in / check-out alerts in attendanceRoutes. Fired when
 * a teacher marks a student ABSENT (single mark, bulk register, edit, offline
 * sync). Deduplicated to ONE alert per student per day via a claimed notice key,
 * so morning + afternoon sessions, re-saves and retries never repeat it.
 *
 * Best-effort: never throws, never blocks the attendance write. Callers invoke
 * it AFTER the write has committed and do not await it.
 */
import { db } from '@utils/database';
import { logger } from '@utils/logger';

/** Back-filled registers (older than this) don't alert families. */
const MAX_AGE_DAYS = 2;

function toDateKey(date: string | Date): string {
  if (date instanceof Date) return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  return String(date || '').slice(0, 10);
}

function isRecent(dateKey: string): boolean {
  const d = new Date(`${dateKey}T00:00:00Z`).getTime();
  if (Number.isNaN(d)) return false;
  const now = Date.now();
  return d >= now - MAX_AGE_DAYS * 86_400_000 && d <= now + 86_400_000;
}

async function sendAbsenceAlert(tenantId: string, studentId: string, dateKey: string, classId?: string | null): Promise<void> {
  const student = await db('students').where({ id: studentId, tenant_id: tenantId }).first();
  if (!student) return;

  // Once per student per day (the first absent mark claims the key).
  const { claimNotice } = await import('@services/finance/core');
  if (!(await claimNotice(tenantId, `absence:${studentId}:${dateKey}`))) return;

  const studentName = [student.first_name, student.last_name].filter(Boolean).join(' ') || 'Your child';
  const cls = classId ? await db('classes').where({ id: classId }).first('name').catch(() => null) : null;
  const subject = `${studentName} was marked absent`;
  const message = `${studentName} was marked absent from school on ${dateKey}. Please contact the school if this is unexpected.`;
  const data = { kind: 'attendance_absent', student_id: studentId, student_name: studentName, date: dateKey, url: '/students/attendance' };

  const { default: notificationService } = await import('@services/notificationService');
  let emailService: any = null;
  try { emailService = (await import('@services/emailService')).default; } catch { /* optional */ }

  if (student.user_id) {
    await notificationService.createNotification({
      notificationType: 'attendance', recipientId: student.user_id,
      subject, message, data, channels: ['in_app'], sourceType: 'attendance', sourceId: studentId,
    }).catch(() => {});
  }

  // Same guardian lookup as the check-in / check-out alerts: join through
  // students and re-assert the tenant (guardians has no tenant_id column).
  const guardians = await db('guardians')
    .join('students', 'guardians.student_id', 'students.id')
    .where('guardians.student_id', studentId)
    .where('students.tenant_id', tenantId)
    .select('guardians.user_id', 'guardians.email', 'guardians.first_name', 'guardians.last_name')
    .catch(() => [] as any[]);

  const emailed = new Set<string>();
  for (const g of guardians) {
    if (g.user_id) {
      await notificationService.createNotification({
        notificationType: 'attendance', recipientId: g.user_id,
        subject, message, data, channels: ['in_app'], sourceType: 'attendance', sourceId: studentId,
      }).catch(() => {});
    }
    const email = String(g.email || '').trim().toLowerCase();
    if (email && !emailed.has(email) && emailService?.sendAbsenceAlertEmail) {
      emailed.add(email);
      await emailService.sendAbsenceAlertEmail(tenantId, g.email, {
        recipientName: [g.first_name, g.last_name].filter(Boolean).join(' ') || 'Parent/Guardian',
        studentName, date: dateKey, className: cls?.name || undefined,
      }).catch((e: any) => logger.warn(`Absence email to guardian failed for student ${studentId}: ${e?.message || e}`));
    }
  }
}

/**
 * Fire-and-forget absence alert for one student on one date. Safe to call for
 * every 'absent' mark — the per-day claim makes repeats a no-op.
 */
export function notifyGuardiansOfAbsence(tenantId: string, studentId: string, date: string | Date, classId?: string | null): void {
  const dateKey = toDateKey(date);
  if (!tenantId || !studentId || !dateKey || !isRecent(dateKey)) return;
  void sendAbsenceAlert(tenantId, studentId, dateKey, classId)
    .catch((err) => logger.warn(`Absence alert failed for student ${studentId}: ${err?.message || err}`));
}
