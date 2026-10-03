/**
 * Teacher scoping helpers shared by the student-facing routes.
 *
 * A teacher may see a student's records only if that student is (or was) in
 * a class the teacher teaches (teacher_assignments) or leads (class_teacher_id).
 * "Was" matters: after a year rollover last year's students are promoted /
 * completed, and their old teacher must still be able to open last year's
 * attendance, results and conduct.
 */
import { db } from './database.js';

/** teachers.id for a user in a tenant, or null if the user isn't a teacher there. */
export async function teacherIdFor(userId: string, tenantId: string): Promise<string | null> {
  const row = await db('teachers')
    .join('users', 'teachers.user_id', 'users.id')
    .where('teachers.user_id', userId)
    .where('users.tenant_id', tenantId)
    .first('teachers.id');
  return row?.id ?? null;
}

/** Every class (any year) the teacher teaches or leads. */
export async function teacherClassIdsFor(userId: string, tenantId: string): Promise<string[]> {
  const teacherId = await teacherIdFor(userId, tenantId);
  if (!teacherId) return [];
  const [assigned, led] = await Promise.all([
    db('teacher_assignments').where('teacher_id', teacherId).distinct('class_id'),
    db('classes').where('class_teacher_id', teacherId).select('id'),
  ]);
  return Array.from(new Set<string>([
    ...assigned.map((r: any) => String(r.class_id)),
    ...led.map((r: any) => String(r.id)),
  ]));
}

/** True when the student is or was enrolled in one of the teacher's classes. */
export async function teacherCanAccessStudent(userId: string, tenantId: string, studentId: string): Promise<boolean> {
  const classIds = await teacherClassIdsFor(userId, tenantId);
  if (classIds.length === 0) return false;
  // students.id is a uuid — only compare it when the value looks like one,
  // otherwise Postgres rejects the query (admission numbers aren't uuids).
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentId);
  const hit = await db('enrollments')
    .join('students', 'enrollments.student_id', 'students.id')
    .where('students.tenant_id', tenantId)
    .where(function (this: any) {
      this.where('students.student_id', studentId);
      if (isUuid) this.orWhere('students.id', studentId);
    })
    .whereIn('enrollments.class_id', classIds)
    .first('enrollments.id');
  return !!hit;
}
