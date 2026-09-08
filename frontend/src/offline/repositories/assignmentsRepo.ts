/**
 * assignmentsRepo — offline write-behind for creating assignments.
 *
 * Writes to the Dexie `assignments` table as `pending` + enqueues to the
 * `outbox` with a client id; the sync engine pushes to /sync/push (keyed by
 * client id, last-write-wins).
 */
import { getOfflineDb, newClientId, type AssignmentRow } from '../db';
import { requestSync } from '../useSyncEngine';

export interface CreateAssignmentInput {
  classId: string;
  subjectId: string;
  title: string;
  description?: string;
  type?: string;
  assignedDate?: string;
  dueDate?: string;
  maxMarks?: number;
  instructions?: string;
  status?: string;
}

export const assignmentsRepo = {
  async create(userId: string, input: CreateAssignmentInput): Promise<AssignmentRow> {
    const db = getOfflineDb(userId);
    const clientId = newClientId();

    const row: AssignmentRow = {
      clientId,
      classId: input.classId,
      subjectId: input.subjectId,
      title: input.title,
      description: input.description,
      dueDate: input.dueDate,
      extra: {
        type: input.type, assigned_date: input.assignedDate, max_marks: input.maxMarks,
        instructions: input.instructions, status: input.status,
      },
      syncStatus: 'pending',
      updatedAt: Date.now(),
    };

    const payload = {
      title: input.title,
      description: input.description,
      class_id: input.classId,
      subject_id: input.subjectId,
      type: input.type,
      assigned_date: input.assignedDate,
      due_date: input.dueDate,
      max_marks: input.maxMarks,
      instructions: input.instructions,
      status: input.status,
    };

    await db.transaction('rw', db.assignments, db.outbox, async () => {
      await db.assignments.put(row);
      await db.outbox.add({ entity: 'assignment', op: 'create', clientId, payload, attempts: 0, createdAt: Date.now() });
    });

    requestSync();
    return row;
  },

  async listLocal(userId: string, classId: string): Promise<AssignmentRow[]> {
    const db = getOfflineDb(userId);
    return db.assignments.where('classId').equals(classId).toArray();
  },
};

export default assignmentsRepo;
