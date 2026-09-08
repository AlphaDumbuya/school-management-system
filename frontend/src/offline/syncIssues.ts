/**
 * syncIssues — surfaces local writes the server rejected (e.g. a locked grade,
 * a class the teacher isn't assigned to) so the teacher can Retry or Discard.
 * Nothing is ever dropped silently (Req 10).
 */
import { getOfflineDb } from './db';
import { requestSync } from './useSyncEngine';

export interface SyncIssue {
  entity: 'attendance' | 'grade' | 'assignment';
  clientId: string;
  label: string;      // human summary of the write
  error?: string;     // rejection reason from the server
  updatedAt: number;
}

function attendanceLabel(r: any): string {
  return `Attendance · ${r.status} · ${r.date}`;
}
function gradeLabel(r: any): string {
  const total = r.extra?.total_marks;
  return `Grade · ${r.score}${total ? '/' + total : ''}`;
}
function assignmentLabel(r: any): string {
  return `Assignment · ${r.title || 'Untitled'}`;
}

/** List all rejected local writes across entities. */
export async function listSyncIssues(userId: string): Promise<SyncIssue[]> {
  const db = getOfflineDb(userId);
  const [att, gr, asg] = await Promise.all([
    db.attendance.where('syncStatus').equals('error').toArray(),
    db.grades.where('syncStatus').equals('error').toArray(),
    db.assignments.where('syncStatus').equals('error').toArray(),
  ]);
  return [
    ...att.map((r) => ({ entity: 'attendance' as const, clientId: r.clientId, label: attendanceLabel(r), error: r.error, updatedAt: r.updatedAt })),
    ...gr.map((r) => ({ entity: 'grade' as const, clientId: r.clientId, label: gradeLabel(r), error: r.error, updatedAt: r.updatedAt })),
    ...asg.map((r) => ({ entity: 'assignment' as const, clientId: r.clientId, label: assignmentLabel(r), error: r.error, updatedAt: r.updatedAt })),
  ].sort((a, b) => b.updatedAt - a.updatedAt);
}

function tableFor(db: ReturnType<typeof getOfflineDb>, entity: SyncIssue['entity']) {
  if (entity === 'attendance') return db.attendance;
  if (entity === 'grade') return db.grades;
  return db.assignments;
}

/** Re-queue a rejected write for another attempt. */
export async function retryIssue(userId: string, issue: SyncIssue): Promise<void> {
  const db = getOfflineDb(userId);
  const table = tableFor(db, issue.entity) as any;
  const row = await table.get(issue.clientId);
  if (!row) return;

  // Rebuild the outbox payload from the stored row.
  const payload =
    issue.entity === 'attendance'
      ? { student_id: row.studentId, class_id: row.classId, date: row.date, session_type: row.sessionType, status: row.status, remarks: row.remarks }
      : issue.entity === 'grade'
      ? { student_id: row.studentId, class_id: row.classId, subject_id: row.subjectId, marks_obtained: row.score, total_marks: row.extra?.total_marks, grade: row.extra?.grade, remarks: row.extra?.remarks, grade_id: row.extra?.grade_id }
      : { title: row.title, description: row.description, class_id: row.classId, subject_id: row.subjectId, type: row.extra?.type, assigned_date: row.extra?.assigned_date, due_date: row.dueDate, max_marks: row.extra?.max_marks, instructions: row.extra?.instructions, status: row.extra?.status };

  await db.transaction('rw', table, db.outbox, async () => {
    await table.update(issue.clientId, { syncStatus: 'pending', error: undefined, updatedAt: Date.now() });
    const prior = await db.outbox.where('clientId').equals(issue.clientId).toArray();
    for (const p of prior) if (p.id != null) await db.outbox.delete(p.id);
    await db.outbox.add({
      entity: issue.entity, op: 'create', clientId: issue.clientId, payload, attempts: 0, createdAt: Date.now(),
    });
  });
  requestSync();
}

/** Permanently discard a rejected write (removes the local row + any queue item). */
export async function discardIssue(userId: string, issue: SyncIssue): Promise<void> {
  const db = getOfflineDb(userId);
  const table = tableFor(db, issue.entity) as any;
  await db.transaction('rw', table, db.outbox, async () => {
    await table.delete(issue.clientId);
    const prior = await db.outbox.where('clientId').equals(issue.clientId).toArray();
    for (const p of prior) if (p.id != null) await db.outbox.delete(p.id);
  });
}
