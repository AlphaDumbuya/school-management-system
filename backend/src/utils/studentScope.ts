/**
 * Student (and parent → child) year scoping, shared by the student-facing
 * pages: dashboard, subjects, timetable, assignments, exams, results…
 *
 * A student's year is defined by the CLASSES they were in that year. A year
 * can hold more than one class (promoted or moved mid-year), and records
 * (results, timetable, attendance) live on whichever class they were made in,
 * so callers get every class that year, newest first.
 */
import { db } from './database.js';
import { normalizeAcademicYear, resolveActiveYear } from './academicYear.js';

const ACTIVE = ['active', 'enrolled'];
const HISTORIC = ['enrolled', 'active', 'completed', 'promoted', 'repeated', 'graduated'];

export interface StudentYearClass {
  id: string;
  name: string;
  level: string | null;
  section: string | null;
  room_number: string | null;
  academic_session_id: string | null;
  enrollment_status: string;
}

export interface StudentYearScope {
  /** The year resolved (canonical "YYYY/YYYY"). */
  academicYear: string;
  activeYear: string;
  viewingPast: boolean;
  /** False when the requested year isn't one of the school's sessions. */
  yearExists: boolean;
  session: { id: string; name: string; is_active: boolean } | null;
  /** Every class the student was in that year, newest first, de-duplicated. */
  classes: StudentYearClass[];
  /**
   * Rollover not finished: the school is in a new year but the student is
   * still actively enrolled in last year's class.
   */
  pendingTransition: { fromYear: string; className: string; classId: string } | null;
  /**
   * The student finished SSS 3 and left the school (students.status =
   * 'graduated'): their last class and year. Set for any year after that.
   */
  graduated: { year: string; className: string } | null;
}

/** students.id for a student login (tenant-scoped), or null. */
export async function studentIdForUser(userId: string, tenantId: string): Promise<string | null> {
  const row = await db('students').where({ user_id: userId, tenant_id: tenantId }).first('id');
  return row?.id ? String(row.id) : null;
}

/** The linked child's students.id for a parent/guardian (verified), or null. */
export async function childIdForParent(userId: string, tenantId: string, childId?: string | null): Promise<string | null> {
  let q = db('guardians as g')
    .join('students as s', 'g.student_id', 's.id')
    .where('g.user_id', userId)
    .where('s.tenant_id', tenantId);
  if (childId) q = q.where('s.id', childId);
  const row = await q.orderBy('g.is_primary_guardian', 'desc').first('s.id');
  return row?.id ? String(row.id) : null;
}

/** Resolve one academic year for a student (default = the school's active year). */
export async function studentYearScope(tenantId: string, studentId: string, requestedYear?: string | null): Promise<StudentYearScope> {
  const { yearString: activeYear } = await resolveActiveYear(tenantId);
  const wanted = normalizeAcademicYear(requestedYear || '') || activeYear;
  const sessions = await db('academic_sessions').where({ tenant_id: tenantId }).select('id', 'name', 'is_active');
  const session = (sessions.find((s: any) => normalizeAcademicYear(s.name) === wanted) as any) ?? null;
  const viewingPast = !!session && !session.is_active;

  let classes: StudentYearClass[] = [];
  if (session) {
    const rows = await db('enrollments as e')
      .join('classes as c', 'e.class_id', 'c.id')
      .where('e.student_id', studentId)
      .whereIn('e.status', session.is_active ? ACTIVE : HISTORIC)
      .where((q) => {
        q.where('c.academic_session_id', session.id);
        if (session.is_active) q.orWhereNull('c.academic_session_id');
      })
      .orderBy('e.created_at', 'desc')
      .select('c.id', 'c.name', 'c.level', 'c.section', 'c.room_number', 'c.academic_session_id', 'e.status as enrollment_status');
    const seen = new Set<string>();
    classes = rows.filter((r: any) => (seen.has(String(r.id)) ? false : (seen.add(String(r.id)), true)));
  }

  let pendingTransition: StudentYearScope['pendingTransition'] = null;
  if (!viewingPast && classes.length === 0) {
    const stale = await db('enrollments as e')
      .join('classes as c', 'e.class_id', 'c.id')
      .join('academic_sessions as s', 'c.academic_session_id', 's.id')
      .where('e.student_id', studentId)
      .whereIn('e.status', ACTIVE)
      .where('s.is_active', false)
      .orderBy('e.created_at', 'desc')
      .first('c.id', 'c.name', 's.name as session_name');
    if (stale) {
      pendingTransition = {
        fromYear: normalizeAcademicYear(stale.session_name) || 'last year',
        className: stale.name,
        classId: String(stale.id),
      };
    }
  }

  // Left the school after SSS 3: say so instead of "not in a class this year".
  let graduated: StudentYearScope['graduated'] = null;
  if (classes.length === 0 && !pendingTransition) {
    const stu = await db('students').where({ id: studentId }).first('status');
    if (String(stu?.status || '').toLowerCase() === 'graduated') {
      const last = await db('enrollments as e')
        .join('classes as c', 'e.class_id', 'c.id')
        .leftJoin('academic_sessions as s', 'c.academic_session_id', 's.id')
        .where('e.student_id', studentId)
        .orderBy('e.created_at', 'desc')
        .first('c.name', 's.name as session_name');
      if (last) graduated = { year: normalizeAcademicYear(last.session_name || '') || '', className: last.name };
    }
  }

  return { academicYear: wanted, activeYear, viewingPast, yearExists: !!session, session, classes, pendingTransition, graduated };
}

export const isStudentOrParent = (role?: string | null) => role === 'student' || role === 'parent' || role === 'guardian';

/**
 * students.id values a student / parent may see: the student's own record, or
 * the parent's linked children (just `childId` when given, verified).
 */
export async function viewerStudentIds(role: string | undefined, userId: string, tenantId: string, childId?: string | null): Promise<string[]> {
  if (role === 'student') {
    const id = await studentIdForUser(userId, tenantId);
    return id ? [id] : [];
  }
  if (role !== 'parent' && role !== 'guardian') return [];
  if (childId) {
    const id = await childIdForParent(userId, tenantId, childId);
    return id ? [id] : [];
  }
  const rows = await db('guardians as g')
    .join('students as s', 'g.student_id', 's.id')
    .where('g.user_id', userId)
    .where('s.tenant_id', tenantId)
    .distinct('s.id');
  return rows.map((r: any) => String(r.id)).filter(Boolean);
}

export interface ViewerYearClasses {
  studentIds: string[];
  classIds: string[];
  /** Sent to the client as `meta`. */
  meta: {
    academic_year: string | null;
    active_year: string | null;
    viewing_past: boolean;
    year_exists: boolean;
    pending_transition: { fromYear: string; className: string } | null;
    classes: { id: string; name: string }[];
    /** Left the school after SSS 3 (no class this year because of that). */
    graduated: { year: string; className: string } | null;
  };
}

/**
 * Student / parent: the classes for one year (default = the active year), over
 * every student the viewer may see. A year means EVERY class the student was
 * in that year (promoted mid-year → both). With `useTransitionClass`, an
 * unfinished rollover falls back to the class they're still in from last year
 * (flagged in `meta.pending_transition` either way).
 */
export async function viewerYearClasses(
  role: string | undefined, userId: string, tenantId: string,
  opts: { academicYear?: string | null; childId?: string | null; useTransitionClass?: boolean } = {},
): Promise<ViewerYearClasses> {
  const studentIds = await viewerStudentIds(role, userId, tenantId, opts.childId);
  const classIds = new Set<string>();
  const classes: { id: string; name: string }[] = [];
  let meta: ViewerYearClasses['meta'] | null = null;
  for (const sid of studentIds) {
    const scope = await studentYearScope(tenantId, sid, opts.academicYear || null);
    const list = scope.classes.length > 0
      ? scope.classes.map((c) => ({ id: String(c.id), name: c.name }))
      : opts.useTransitionClass !== false && scope.pendingTransition
        ? [{ id: scope.pendingTransition.classId, name: scope.pendingTransition.className }]
        : [];
    for (const c of list) if (!classIds.has(c.id)) { classIds.add(c.id); classes.push(c); }
    if (!meta) {
      meta = {
        academic_year: scope.academicYear,
        active_year: scope.activeYear,
        viewing_past: scope.viewingPast,
        year_exists: scope.yearExists,
        pending_transition: null,
        classes: [],
        graduated: null,
      };
    }
    if (!meta.graduated && scope.graduated) meta.graduated = scope.graduated;
    if (!meta.pending_transition && scope.classes.length === 0 && scope.pendingTransition) {
      meta.pending_transition = { fromYear: scope.pendingTransition.fromYear, className: scope.pendingTransition.className };
    }
  }
  if (!meta) {
    meta = {
      academic_year: opts.academicYear ? normalizeAcademicYear(opts.academicYear) : null,
      active_year: null, viewing_past: false, year_exists: false, pending_transition: null, classes: [], graduated: null,
    };
  }
  meta.classes = classes;
  return { studentIds, classIds: Array.from(classIds), meta };
}

/** True when any of the viewer's students is or was enrolled in the class (any status, any year). */
export async function viewerInClass(studentIds: string[], classId: string | null | undefined): Promise<boolean> {
  if (!classId || studentIds.length === 0) return false;
  const row = await db('enrollments').whereIn('student_id', studentIds).where('class_id', classId).first('id');
  return !!row;
}
