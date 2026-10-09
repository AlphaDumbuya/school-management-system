/**
 * Assignment notifications.
 *
 *  - Posted (created / published from draft) → in-app to every enrolled
 *    student's login + linked parent/guardian logins, and ONE email per family
 *    (parents only; families of siblings in the same class get a single email).
 *
 * Best-effort: callers invoke these AFTER the DB write and never await them.
 */
import { db } from '@utils/database';
import { logger } from '@utils/logger';

function fmtDue(d: any): string {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(String(d).length <= 10 ? `${d}T00:00:00` : d);
  return Number.isNaN(date.getTime()) ? String(d) : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function sendAssignmentPosted(tenantId: string, assignmentId: string): Promise<void> {
  const a = await db('assignments as a')
    .leftJoin('classes as c', 'c.id', 'a.class_id')
    .leftJoin('subjects as s', 's.id', 'a.subject_id')
    .where('a.id', assignmentId)
    .first('a.id', 'a.title', 'a.class_id', 'a.due_date', 'a.type', 'a.status', 'c.name as class_name', 's.name as subject_name');
  if (!a || a.status === 'draft') return;

  // Active pupils of the class, in THIS tenant.
  const students = await db('enrollments as e')
    .join('students as st', 'st.id', 'e.student_id')
    .leftJoin('users as u', 'u.id', 'st.user_id')
    .where('e.class_id', a.class_id)
    .where('st.tenant_id', tenantId)
    .where(function () { this.whereIn('e.status', ['active', 'enrolled']).orWhereNull('e.status'); })
    .distinct('st.id', 'st.first_name', 'st.last_name', 'st.email', 'u.email as user_email', 'u.first_name as uf', 'u.last_name as ul');
  if (!students.length) return;

  const due = fmtDue(a.due_date);
  const subject = `New assignment: ${a.title}`;
  const message = `${a.subject_name ? `${a.subject_name}: ` : ''}"${a.title}" has been posted for ${a.class_name || 'your class'}${due ? `, due ${due}` : ''}.`;

  const { familyContact } = await import('@services/finance/core');
  const { default: notificationService } = await import('@services/notificationService');

  const inAppIds = new Set<string>();
  // email (lowercased) → recipient + the children it covers.
  const families = new Map<string, { email: string; name: string; students: string[] }>();

  for (const st of students) {
    try {
      const contact = await familyContact(st.id);
      contact.userIds.forEach((id) => id && inAppIds.add(id));
      const studentName = [st.uf || st.first_name, st.ul || st.last_name].filter(Boolean).join(' ') || 'Student';
      const email = String(contact.email || '').trim();
      const own = [st.email, st.user_email].filter(Boolean).map((e: string) => String(e).trim().toLowerCase());
      // familyContact falls back to the student's own address — only email parents.
      if (!email || own.includes(email.toLowerCase())) continue;
      const key = email.toLowerCase();
      const fam = families.get(key) || { email, name: contact.name || 'Parent/Guardian', students: [] };
      fam.students.push(studentName);
      families.set(key, fam);
    } catch (err) {
      logger.warn(`Assignment notice: contact lookup failed for student ${st.id}: ${(err as any)?.message || err}`);
    }
  }

  for (const id of inAppIds) {
    await notificationService.createNotification({
      recipientId: id, notificationType: 'assignment', subject, message,
      data: { url: '/academic/assignments', assignment_id: a.id }, channels: ['in_app'],
      sourceType: 'assignment', sourceId: a.id,
    }).catch(() => null);
  }

  if (!families.size) return;
  const { default: emailService } = await import('@services/emailService');
  for (const fam of families.values()) {
    await emailService.sendAssignmentPostedEmail(tenantId, fam.email, {
      recipientName: fam.name,
      studentNames: fam.students,
      title: a.title,
      subjectName: a.subject_name || undefined,
      className: a.class_name || undefined,
      type: a.type || undefined,
      dueDate: a.due_date || undefined,
    }).catch((e: any) => logger.warn(`Assignment email failed for assignment ${a.id}: ${e?.message || e}`));
  }
}

/** Fire-and-forget "new assignment" notices for a posted (non-draft) assignment. */
export function notifyAssignmentPosted(tenantId: string, assignmentId: string): void {
  if (!tenantId || !assignmentId) return;
  void sendAssignmentPosted(tenantId, assignmentId)
    .catch((err) => logger.warn(`Assignment posted notices failed for ${assignmentId}: ${err?.message || err}`));
}
