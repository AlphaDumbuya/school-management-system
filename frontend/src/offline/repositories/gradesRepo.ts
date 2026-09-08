/**
 * gradesRepo — offline write-behind for grade/score entry.
 *
 * Mirrors attendanceRepo: writes to the Dexie `grades` table as `pending` and
 * enqueues to the `outbox` with a client id. The sync engine pushes to
 * /sync/push; the server REJECTS a push that targets a locked grade, and the
 * engine surfaces that reason on the local row (Req 4.2 / 10).
 */
import { getOfflineDb, newClientId, type GradeRow } from '../db';
import { requestSync } from '../useSyncEngine';

export interface EnterGradeInput {
  studentId: string;
  classId?: string;
  subjectId?: string;
  marksObtained: number;
  totalMarks: number;
  grade?: string;
  remarks?: string;
  /** Existing server grade id, when editing (server enforces lock). */
  gradeId?: string;
}

export const gradesRepo = {
  async enter(userId: string, input: EnterGradeInput): Promise<GradeRow> {
    const db = getOfflineDb(userId);
    const clientId = newClientId();

    const row: GradeRow = {
      clientId,
      studentId: input.studentId,
      classId: input.classId,
      subjectId: input.subjectId,
      score: input.marksObtained,
      extra: { total_marks: input.totalMarks, grade: input.grade, remarks: input.remarks, grade_id: input.gradeId },
      syncStatus: 'pending',
      updatedAt: Date.now(),
    };

    const payload = {
      student_id: input.studentId,
      class_id: input.classId,
      subject_id: input.subjectId,
      marks_obtained: input.marksObtained,
      total_marks: input.totalMarks,
      grade: input.grade,
      remarks: input.remarks,
      grade_id: input.gradeId,
    };

    await db.transaction('rw', db.grades, db.outbox, async () => {
      await db.grades.put(row);
      await db.outbox.add({ entity: 'grade', op: input.gradeId ? 'update' : 'create', clientId, payload, attempts: 0, createdAt: Date.now() });
    });

    requestSync();
    return row;
  },

  async listLocal(userId: string, classId: string, subjectId: string): Promise<GradeRow[]> {
    const db = getOfflineDb(userId);
    return db.grades.where('[classId+subjectId]').equals([classId || '', subjectId || '']).toArray();
  },
};

export default gradesRepo;
