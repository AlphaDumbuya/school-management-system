/**
 * Who a discipline record is about, and who may touch it.
 *
 * Discipline tables (student_infractions, behavioral_notes, discipline_actions)
 * key the student by their LOGIN account (users.id), while the rest of the app
 * passes the student RECORD id (students.id) or an admission number. Resolve
 * every incoming id to both, so records are always stored against users.id.
 */
import { db } from './database.js';
import { AppError } from '../middleware/errorHandler.js';
import { teacherClassIdsFor } from './teacherScope.js';
import { tenantToday, isPastYearDate } from './schoolDate.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIVE = ['enrolled', 'active'];
const HISTORIC = ['enrolled', 'active', 'completed', 'promoted', 'repeated', 'graduated'];

export interface DisciplineStudent {
  /** students.id */
  studentId: string;
  /** users.id — what discipline tables store. */
  userId: string;
  name: string;
}

/** Resolve students.id / users.id / admission number to a tenant student. */
export async function resolveDisciplineStudent(tenantId: string, id: string): Promise<DisciplineStudent | null> {
  if (!id) return null;
  const isUuid = UUID.test(id);
  const row = await db('students')
    .where('students.tenant_id', tenantId)
    .where((q) => {
      q.where('students.student_id', id);
      if (isUuid) q.orWhere('students.id', id).orWhere('students.user_id', id);
    })
    .first('students.id', 'students.user_id', 'students.first_name', 'students.last_name');
  if (!row || !row.user_id) return null;
  return {
    studentId: String(row.id),
    userId: String(row.user_id),
    name: [row.first_name, row.last_name].filter(Boolean).join(' '),
  };
}

/** The student's current class (active enrolment in an ACTIVE-year class), if any. */
export async function currentClassOf(studentId: string, onlyClassIds?: string[]): Promise<string | null> {
  const q = db('enrollments as e')
    .join('classes as c', 'e.class_id', 'c.id')
    .leftJoin('academic_sessions as s', 'c.academic_session_id', 's.id')
    .where('e.student_id', studentId)
    .whereIn('e.status', ACTIVE)
    .where((w) => w.whereNull('c.academic_session_id').orWhere('s.is_active', true))
    .orderBy('e.created_at', 'desc')
    .first('e.class_id');
  if (onlyClassIds) q.whereIn('e.class_id', onlyClassIds);
  const row = await q;
  return row?.class_id ? String(row.class_id) : null;
}

/** True when the student is or was in one of the teacher's classes (read access). */
export async function teacherTeachesOrTaught(userId: string, tenantId: string, studentId: string): Promise<boolean> {
  const classIds = await teacherClassIdsFor(userId, tenantId);
  if (!classIds.length) return false;
  const hit = await db('enrollments').where('student_id', studentId).whereIn('class_id', classIds).whereIn('status', HISTORIC).first('id');
  return !!hit;
}

/**
 * Resolve the subject of a NEW record and the class to file it under.
 * Teachers may only write about students currently in one of their classes.
 */
export async function resolveForWrite(
  req: { user?: any },
  rawStudentId: string,
): Promise<{ student: DisciplineStudent; classId: string | null }> {
  const tenantId = req.user!.tenant_id as string;
  const student = await resolveDisciplineStudent(tenantId, rawStudentId);
  if (!student) throw new AppError('Student not found, or they have no student account yet', 404, 'NOT_FOUND');
  if (req.user!.role === 'teacher') {
    const classIds = await teacherClassIdsFor(req.user!.id, tenantId);
    const classId = classIds.length ? await currentClassOf(student.studentId, classIds) : null;
    if (!classId) throw new AppError('You can only record conduct for students currently in your classes', 403, 'FORBIDDEN');
    return { student, classId };
  }
  return { student, classId: await currentClassOf(student.studentId) };
}

/** A new record's date must be today or earlier, and inside the current academic year. */
export async function assertWritableDate(tenantId: string, date: string | Date | undefined | null, label = 'date') {
  if (!date) return;
  const iso = typeof date === 'string' ? date.slice(0, 10) : date.toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new AppError(`Invalid ${label}`, 400, 'VALIDATION_ERROR');
  if (iso > (await tenantToday(tenantId))) throw new AppError(`The ${label} can't be in the future`, 400, 'VALIDATION_ERROR');
  if (await isPastYearDate(tenantId, iso)) {
    throw new AppError(`That ${label} is in a past academic year, which is read-only`, 409, 'PAST_YEAR_READ_ONLY');
  }
}

/** An existing record is history when its class is a past session's (else by date). */
export async function assertRecordWritable(tenantId: string, classId: string | null | undefined, date: string | Date | null | undefined) {
  if (classId) {
    const row = await db('classes as c').leftJoin('academic_sessions as s', 'c.academic_session_id', 's.id')
      .where('c.id', classId).first('s.id as session_id', 's.is_active');
    if (row?.session_id && row.is_active === false) {
      throw new AppError('This record belongs to a past academic year and is read-only', 409, 'PAST_YEAR_READ_ONLY');
    }
    return;
  }
  if (date && (await isPastYearDate(tenantId, date))) {
    throw new AppError('This record belongs to a past academic year and is read-only', 409, 'PAST_YEAR_READ_ONLY');
  }
}

/**
 * Default infraction catalogue. The record form offers these codes; each is
 * provisioned per school on first use (one conduct rule + one type), so a
 * school never hits "Infraction type not found" just because nobody set up
 * the catalogue. Points drive severity (>=10 moderate, >=25 serious, >=50 critical).
 */
const DEFAULT_TYPES: Record<string, { name: string; category: string; points: number; notifyParent: boolean }> = {
  tardiness: { name: 'Tardiness / Late Arrival', category: 'attendance', points: 2, notifyParent: false },
  absence: { name: 'Unexcused Absence', category: 'attendance', points: 5, notifyParent: true },
  disruptive_behavior: { name: 'Disruptive Behavior', category: 'behavior', points: 10, notifyParent: true },
  disrespect: { name: 'Disrespect to Staff', category: 'behavior', points: 15, notifyParent: true },
  academic_dishonesty: { name: 'Academic Dishonesty / Cheating', category: 'academic', points: 25, notifyParent: true },
  bullying: { name: 'Bullying / Harassment', category: 'safety', points: 30, notifyParent: true },
  vandalism: { name: 'Vandalism / Property Damage', category: 'safety', points: 30, notifyParent: true },
  fighting: { name: 'Fighting / Physical Altercation', category: 'safety', points: 50, notifyParent: true },
  dress_code: { name: 'Dress Code Violation', category: 'uniform', points: 2, notifyParent: false },
  mobile_phone: { name: 'Unauthorized Mobile Phone Use', category: 'behavior', points: 5, notifyParent: false },
  other: { name: 'Other', category: 'other', points: 5, notifyParent: false },
};

const severityFor = (points: number) => (points >= 50 ? 'critical' : points >= 25 ? 'serious' : points >= 10 ? 'moderate' : 'minor');

/** A tenant infraction_type_id for a uuid or a catalogue code (provisioned if needed). */
export async function resolveInfractionType(tenantId: string, value: string, createdBy: string): Promise<string> {
  if (UUID.test(value)) {
    const t = await db('infraction_types').where({ tenant_id: tenantId, infraction_type_id: value }).first('infraction_type_id');
    if (t) return t.infraction_type_id;
    throw new AppError('Infraction type not found', 404, 'NOT_FOUND');
  }
  const code = value.trim().toLowerCase();
  const def = DEFAULT_TYPES[code];
  if (!def) throw new AppError('Unknown infraction type', 400, 'VALIDATION_ERROR');
  const existing = await db('infraction_types').where({ tenant_id: tenantId, code }).first('infraction_type_id');
  if (existing) return existing.infraction_type_id;
  return db.transaction(async (trx) => {
    // Re-check inside the transaction (two first-uses at once).
    const again = await trx('infraction_types').where({ tenant_id: tenantId, code }).first('infraction_type_id');
    if (again) return again.infraction_type_id;
    const [rule] = await trx('conduct_rules').insert({
      tenant_id: tenantId, name: def.name, category: def.category, severity_level: severityFor(def.points),
      points_value: def.points, requires_parent_notification: def.notifyParent, requires_documentation: true,
      active: true, created_by: createdBy,
    }).returning('rule_id');
    const [type] = await trx('infraction_types').insert({
      tenant_id: tenantId, rule_id: rule.rule_id ?? rule, name: def.name, code, default_points: def.points, active: true,
    }).returning('infraction_type_id');
    return type.infraction_type_id ?? type;
  });
}

/** Guardian login accounts for a student (by users.id), tenant-checked. */
export async function guardianUserIds(tenantId: string, studentUserId: string): Promise<string[]> {
  const rows = await db('guardians')
    .join('students', 'guardians.student_id', 'students.id')
    .where('students.user_id', studentUserId)
    .where('students.tenant_id', tenantId)
    .whereNotNull('guardians.user_id')
    .select('guardians.user_id')
    .catch(() => [] as any[]);
  return Array.from(new Set(rows.map((r: any) => String(r.user_id))));
}
