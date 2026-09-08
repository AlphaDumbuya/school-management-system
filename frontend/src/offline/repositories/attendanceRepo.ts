/**
 * attendanceRepo — offline write-behind for attendance.
 *
 * Each mark is written to the Dexie `attendance` table as `pending` and enqueued
 * in the `outbox`, keyed by a client-generated UUID (idempotency). The sync
 * engine drains the outbox to /sync/push when connectivity returns. Re-marking
 * the same (student, date, session) offline updates the same local row so we
 * never queue conflicting duplicates for one cell.
 */
import { getOfflineDb, newClientId, type AttendanceRow } from '../db';
import { requestSync } from '../useSyncEngine';

export interface MarkAttendanceInput {
  studentId: string;
  classId?: string;
  date: string;              // YYYY-MM-DD
  sessionType?: string;      // default 'full_day'
  status: string;            // present | absent | late | excused
  remarks?: string;
}

export const attendanceRepo = {
  /** Queue an attendance mark locally and ask the engine to sync. */
  async mark(userId: string, input: MarkAttendanceInput): Promise<AttendanceRow> {
    const db = getOfflineDb(userId);
    const sessionType = input.sessionType || 'full_day';

    // If there's already a pending local mark for this exact cell, update it in
    // place (and its outbox item) instead of creating a second queued write.
    const existing = await db.attendance
      .where('[classId+date]')
      .equals([input.classId || '', input.date])
      .filter((r) => r.studentId === input.studentId && r.sessionType === sessionType && r.syncStatus !== 'synced')
      .first();

    const clientId = existing?.clientId || newClientId();
    const row: AttendanceRow = {
      clientId,
      serverId: existing?.serverId,
      studentId: input.studentId,
      classId: input.classId,
      date: input.date,
      sessionType,
      status: input.status,
      remarks: input.remarks,
      syncStatus: 'pending',
      updatedAt: Date.now(),
      error: undefined,
    };

    const payload = {
      student_id: input.studentId,
      class_id: input.classId,
      date: input.date,
      session_type: sessionType,
      status: input.status,
      remarks: input.remarks,
    };

    await db.transaction('rw', db.attendance, db.outbox, async () => {
      await db.attendance.put(row);
      // Replace any existing queued item for this clientId, then enqueue fresh.
      const prior = await db.outbox.where('clientId').equals(clientId).toArray();
      for (const p of prior) if (p.id != null) await db.outbox.delete(p.id);
      await db.outbox.add({
        entity: 'attendance', op: 'create', clientId, payload, attempts: 0, createdAt: Date.now(),
      });
    });

    requestSync();
    return row;
  },

  /** Local attendance rows for a class/date (merged with pending offline marks). */
  async listLocal(userId: string, classId: string, date: string): Promise<AttendanceRow[]> {
    const db = getOfflineDb(userId);
    return db.attendance.where('[classId+date]').equals([classId || '', date]).toArray();
  },
};

export default attendanceRepo;
