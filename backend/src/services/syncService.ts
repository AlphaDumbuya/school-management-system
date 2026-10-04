/**
 * Sync Service — teacher offline-first sync (pull + push).
 *
 * PULL: returns the teacher-scoped rows (their classes, enrolled students,
 * subjects, timetable, attendance, grades, assignments) changed since a
 * timestamp, so a device can refresh its local cache incrementally.
 *
 * PUSH: applies a batch of queued local writes idempotently (by client_id),
 * returning a per-item result. Attendance = last-write-wins per key; grades
 * respect the server lock (locked → rejected); assignments keyed by client_id.
 *
 * Everything is scoped to the authenticated teacher's classes so a device only
 * ever receives data the teacher is authorized to see.
 */
import { db } from '../utils/database';
import { logger } from '../utils/logger';

interface Scope {
  tenantId: string;
  teacherId: string | null;
  classIds: string[];
  studentIds: string[];
}

export class SyncService {
  /** Resolve the teacher's class + student scope. */
  static async resolveTeacherScope(userId: string, tenantId: string): Promise<Scope> {
    const teacher = await db('teachers')
      .join('users', 'teachers.user_id', 'users.id')
      .where('teachers.user_id', userId)
      .where('users.tenant_id', tenantId)
      .select('teachers.id')
      .first();

    if (!teacher) return { tenantId, teacherId: null, classIds: [], studentIds: [] };

    // CURRENT classes only: an assignment that has ended (teacher moved off the
    // class, or last year's after a rollover) and past-session classes are
    // history, not offline work. Re-resolved on every pull/push, so a
    // reassignment takes effect on the next sync.
    const today = new Date().toISOString().slice(0, 10);
    const currentClass = (q: any) => q.where((w: any) => w.whereNull('s.id').orWhere('s.is_active', true));
    const [assigned, led] = await Promise.all([
      currentClass(
        db('teacher_assignments as ta')
          .join('classes as c', 'ta.class_id', 'c.id')
          .leftJoin('academic_sessions as s', 'c.academic_session_id', 's.id')
          .where('ta.teacher_id', teacher.id)
          .where((w: any) => w.whereNull('ta.end_date').orWhere('ta.end_date', '>=', today)),
      ).distinct('ta.class_id as class_id'),
      currentClass(
        db('classes as c')
          .leftJoin('academic_sessions as s', 'c.academic_session_id', 's.id')
          .where('c.class_teacher_id', teacher.id),
      ).select('c.id'),
    ]);
    const classIds = Array.from(
      new Set([...assigned.map((r: any) => r.class_id), ...led.map((r: any) => r.id)].filter(Boolean))
    ) as string[];

    let studentIds: string[] = [];
    if (classIds.length) {
      const enrolled = await db('enrollments')
        .whereIn('class_id', classIds)
        .whereIn('status', ['enrolled', 'active'])
        .distinct('student_id');
      studentIds = enrolled.map((r: any) => r.student_id).filter(Boolean);
    }

    return { tenantId, teacherId: teacher.id, classIds, studentIds };
  }

  /** Pull teacher-scoped changes since `since` (ISO string or undefined = all). */
  static async pull(userId: string, tenantId: string, since?: string) {
    const scope = await this.resolveTeacherScope(userId, tenantId);
    const sinceDate = since ? new Date(since) : null;
    const changedSince = <T extends import('knex').Knex.QueryBuilder>(q: T, col = 'updated_at'): T =>
      (sinceDate ? q.where(col, '>', sinceDate) : q) as T;

    // No classes → nothing to sync (teacher not yet assigned).
    // `scope` is the teacher's FULL current class/student set (not a delta), so
    // the device can drop classes they were moved off and students who were
    // promoted out, and re-pull in full when a new class appears.
    const scopeOut = { class_ids: scope.classIds, student_ids: scope.studentIds };
    if (scope.classIds.length === 0) {
      return { serverTime: new Date().toISOString(), scope: scopeOut, classes: [], students: [], subjects: [], timetable: [], attendance: [], grades: [], assignments: [], enrollments: [] };
    }

    const [classes, students, subjects, timetable, attendance, grades, assignments, enrollments] = await Promise.all([
      changedSince(db('classes').whereIn('id', scope.classIds).select('*')),
      scope.studentIds.length
        ? changedSince(db('students').whereIn('id', scope.studentIds).select('*'))
        : Promise.resolve([]),
      // Subjects taught in the teacher's classes.
      changedSince(
        db('subjects')
          .whereIn('id', db('class_subjects').whereIn('class_id', scope.classIds).select('subject_id'))
          .select('*')
      ).catch(() => []),
      changedSince(db('schedules').whereIn('class_id', scope.classIds).select('*')).catch(() => []),
      changedSince(db('attendance').whereIn('class_id', scope.classIds).select('*')),
      changedSince(db('grades').whereIn('class_id', scope.classIds).select('*')),
      changedSince(db('assignments').whereIn('class_id', scope.classIds).select('*')),
      // Enrollment linkage (student ↔ class) so the device can filter students
      // by class OFFLINE — the attendance register needs this. Enrollment rows
      // rarely change, so we always send the full teacher-scoped set (no
      // incremental filter) to keep the offline mapping complete.
      db('enrollments')
        .whereIn('class_id', scope.classIds)
        .whereIn('status', ['enrolled', 'active'])
        .select('id', 'student_id', 'class_id', 'status')
        .catch(() => []),
    ]);

    return {
      serverTime: new Date().toISOString(),
      scope: scopeOut,
      classes, students, subjects, timetable, attendance, grades, assignments, enrollments,
    };
  }

  /**
   * Push a batch of local writes. Each item: { entity, op, clientId, payload }.
   * Returns per-item { clientId, result: 'applied'|'duplicate'|'rejected', reason?, serverId? }.
   */
  static async push(
    userId: string,
    tenantId: string,
    items: Array<{ entity: string; op: string; clientId: string; payload: any }>
  ) {
    const scope = await this.resolveTeacherScope(userId, tenantId);
    const results: Array<{ clientId: string; result: string; reason?: string; serverId?: string }> = [];

    for (const item of items) {
      try {
        const r = await this.applyOne(userId, scope, item);
        results.push({ clientId: item.clientId, ...r });
      } catch (err: any) {
        logger.warn(`[sync push] ${item.entity}/${item.clientId} failed: ${err?.message || err}`);
        results.push({ clientId: item.clientId, result: 'rejected', reason: err?.message || 'error' });
      }
    }
    return results;
  }

  private static classAllowed(scope: Scope, classId?: string): boolean {
    return !!classId && scope.classIds.includes(classId);
  }

  private static async applyOne(
    userId: string,
    scope: Scope,
    item: { entity: string; op: string; clientId: string; payload: any }
  ): Promise<{ result: string; reason?: string; serverId?: string }> {
    const { entity, clientId, payload } = item;

    if (entity === 'attendance') {
      if (!this.classAllowed(scope, payload.class_id)) return { result: 'rejected', reason: 'Not assigned to this class' };
      if (!scope.studentIds.includes(payload.student_id)) return { result: 'rejected', reason: 'Student is not enrolled in your classes' };
      const student = await db('students').where({ id: payload.student_id, tenant_id: scope.tenantId }).first();
      if (!student) return { result: 'rejected', reason: 'Student is not in this school' };
      const enrollment = await db('enrollments')
        .where({ student_id: payload.student_id, class_id: payload.class_id })
        .whereIn('status', ['enrolled', 'active'])
        .first();
      if (!enrollment) return { result: 'rejected', reason: 'Student is not enrolled in this class' };
      const existing = await db('attendance').where({ client_id: clientId, student_id: payload.student_id, class_id: payload.class_id }).first();
      if (existing) return { result: 'duplicate', serverId: existing.id };

      // Last-write-wins per (student, date, session): update if a row exists, else insert.
      const key = await db('attendance')
        .where({ student_id: payload.student_id, attendance_date: payload.date, session_type: payload.session_type || 'full_day' })
        .modify((q) => { if (payload.class_id) q.where('class_id', payload.class_id); })
        .first();

      if (key) {
        await db('attendance').where('id', key.id).update({
          status: payload.status, remarks: payload.remarks ?? key.remarks,
          check_in_time: ['absent', 'excused'].includes(payload.status) ? null : (payload.check_in_time ?? key.check_in_time ?? null),
          check_out_time: ['absent', 'excused'].includes(payload.status) ? null : (payload.check_out_time ?? key.check_out_time ?? null),
          client_id: clientId, marked_by: userId, marked_at: new Date(), updated_at: new Date(),
        });
        return { result: 'applied', serverId: key.id };
      }
      const [row] = await db('attendance').insert({
        student_id: payload.student_id, class_id: payload.class_id || null,
        attendance_date: payload.date, session_type: payload.session_type || 'full_day',
        status: payload.status, remarks: payload.remarks || null,
        check_in_time: ['absent', 'excused'].includes(payload.status) ? null : (payload.check_in_time || null),
        check_out_time: ['absent', 'excused'].includes(payload.status) ? null : (payload.check_out_time || null),
        marked_by: userId, marked_at: new Date(), client_id: clientId,
        created_at: new Date(), updated_at: new Date(),
      }).returning('id');
      return { result: 'applied', serverId: typeof row === 'object' ? row.id : row };
    }

    if (entity === 'grade') {
      const existing = await db('grades').where('client_id', clientId).first();
      if (existing) return { result: 'duplicate', serverId: existing.id };
      if (!this.classAllowed(scope, payload.class_id)) return { result: 'rejected', reason: 'Not assigned to this class' };
      // Respect server locking: a locked grade cannot be created/edited offline.
      if (payload.grade_id) {
        const target = await db('grades').where('id', payload.grade_id).first();
        if (target && (target.is_locked || target.status === 'locked' || target.status === 'published')) {
          return { result: 'rejected', reason: 'Grade is locked on the server' };
        }
      }
      const [row] = await db('grades').insert({
        student_id: payload.student_id, subject_id: payload.subject_id, class_id: payload.class_id || null,
        marks_obtained: payload.marks_obtained, total_marks: payload.total_marks,
        percentage: payload.total_marks ? (payload.marks_obtained / payload.total_marks) * 100 : null,
        grade: payload.grade || null, remarks: payload.remarks || null, status: 'draft',
        recorded_by: userId, recorded_date: new Date(), client_id: clientId,
        created_at: new Date(), updated_at: new Date(),
      }).returning('id');
      return { result: 'applied', serverId: typeof row === 'object' ? row.id : row };
    }

    if (entity === 'assignment') {
      const existing = await db('assignments').where('client_id', clientId).first();
      if (existing) return { result: 'duplicate', serverId: existing.id };
      if (!this.classAllowed(scope, payload.class_id)) return { result: 'rejected', reason: 'Not assigned to this class' };
      const [row] = await db('assignments').insert({
        title: (payload.title || '').trim(), description: payload.description || null,
        class_id: payload.class_id, subject_id: payload.subject_id, teacher_id: scope.teacherId,
        type: payload.type || 'homework', assigned_date: payload.assigned_date || new Date(),
        due_date: payload.due_date, max_marks: payload.max_marks || 100,
        instructions: payload.instructions || null, status: payload.status || 'active',
        created_by: userId, client_id: clientId, created_at: new Date(), updated_at: new Date(),
      }).returning('id');
      return { result: 'applied', serverId: typeof row === 'object' ? row.id : row };
    }

    return { result: 'rejected', reason: `Unknown entity: ${entity}` };
  }
}

export default SyncService;
