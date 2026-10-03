/**
 * Teacher Dashboard Service
 * =========================
 * Real, tenant + teacher-scoped data for the teacher dashboard:
 *   - KPI stats (assigned classes, students taught, subjects, today's classes)
 *   - Assigned classes (with student count + subjects + schedule)
 *   - Today's schedule
 *   - Recent activity (attendance marked / scores entered by this teacher)
 * A teacher only ever sees their own assigned classes/subjects.
 */

import db from '../utils/database.js';
import { logger } from '../utils/logger.js';
import { normalizeAcademicYear, resolveActiveYear } from '../utils/academicYear.js';

const DOW = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

class TeacherDashboardService {
  /** Resolve the teachers.id for a given user (tenant-scoped). */
  private async getTeacherId(userId: string, tenantId: string): Promise<string | null> {
    const row = await db('teachers')
      .join('users', 'teachers.user_id', 'users.id')
      .where('teachers.user_id', userId)
      .where('users.tenant_id', tenantId)
      .select('teachers.id')
      .first();
    return row?.id ?? null;
  }

  /**
   * The class ids a teacher can act on for a given academic year: assigned
   * subjects + classes they lead, scoped to the requested year.
   *   - No year (or the active year): classes in the active session (plus
   *     legacy null-session classes), falling back to all if nothing is current.
   *   - A specific (past) year: only that session's classes.
   */
  private async getClassIds(teacherId: string, tenantId: string, academicYear?: string): Promise<string[]> {
    const assigned = await db('teacher_assignments').where('teacher_id', teacherId).distinct('class_id');
    const led = await db('classes').where('class_teacher_id', teacherId).select('id');
    const all = Array.from(new Set<string>([
      ...assigned.map((r: any) => r.class_id),
      ...led.map((r: any) => r.id),
    ]));
    if (all.length === 0) return all;

    // Match the requested year against the tenant's REAL sessions (names are
    // normalised the same way as everywhere else), default = the active one.
    const sessions = await db('academic_sessions')
      .where({ tenant_id: tenantId })
      .select('id', 'name', 'is_active');
    const y = normalizeAcademicYear(academicYear ?? null);
    const session = y
      ? sessions.find((s: any) => normalizeAcademicYear(s.name) === y)
      : sessions.find((s: any) => s.is_active);

    // A brand-new school with no sessions at all: nothing is year-bound yet.
    if (sessions.length === 0) return all;
    // A year that doesn't exist for this school shows nothing (never another year).
    if (!session) return [];

    // Only that session's classes. The active year also keeps legacy classes
    // with no session. No "fall back to every class" — right after a rollover a
    // teacher who isn't assigned in the new year yet must see an empty year,
    // not last year's classes posing as current.
    const rows = await db('classes')
      .whereIn('id', all)
      .where((q) => {
        q.where('academic_session_id', session.id);
        if (session.is_active) q.orWhereNull('academic_session_id');
      })
      .select('id');
    return rows.map((r: any) => r.id);
  }

  /**
   * Year transition still in progress: after Start New Academic Year, students
   * can still be sitting in LAST year's copies of this teacher's classes until
   * the principal finishes moving them. Returns how many, or null.
   */
  private async getPendingTransition(classIds: string[], tenantId: string): Promise<{ fromYear: string; students: number } | null> {
    if (classIds.length === 0) return null;
    const prevIds = (await db('classes').whereIn('id', classIds).whereNotNull('carried_from_id').select('carried_from_id'))
      .map((r: any) => r.carried_from_id);
    if (prevIds.length === 0) return null;
    const left = await db('enrollments')
      .whereIn('class_id', prevIds)
      .whereIn('status', ['enrolled', 'active'])
      .countDistinct('student_id as cnt')
      .first();
    const students = Number(left?.cnt ?? 0);
    if (students === 0) return null;
    const from = await db('classes')
      .join('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
      .whereIn('classes.id', prevIds)
      .where('academic_sessions.tenant_id', tenantId)
      .first('academic_sessions.name');
    return { fromYear: normalizeAcademicYear(from?.name ?? null) || 'last year', students };
  }

  async getDashboard(userId: string, tenantId: string, academicYear?: string): Promise<any> {
    try {
      // Is the requested year a PAST year? (schedule + "today" only make sense
      // for the current year; a past year is a static record.)
      const activeYear = (await resolveActiveYear(tenantId)).yearString;
      const requestedYear = normalizeAcademicYear(academicYear ?? null);
      const viewingPast = !!requestedYear && requestedYear !== activeYear;

      const teacherId = await this.getTeacherId(userId, tenantId);
      if (!teacherId) {
        return {
          teacher_profile_missing: true,
          academic_year: requestedYear || activeYear,
          active_year: activeYear,
          viewing_past: viewingPast,
          pending_transition: null,
          stats: { total_classes: 0, total_students: 0, total_subjects: 0, classes_today: 0 },
          classes: [],
          today_schedule: [],
          recent_activity: [],
        };
      }

      const classIds = await this.getClassIds(teacherId, tenantId, academicYear);

      // Distinct subjects the teacher is assigned to in these (year-scoped) classes.
      const subjectRows = classIds.length
        ? await db('teacher_assignments')
            .where('teacher_id', teacherId)
            .whereIn('class_id', classIds)
            .distinct('subject_id')
        : [];
      const totalSubjects = subjectRows.length;

      // Enrollment statuses that count as "in the class". For the current year
      // that's the live set; for a PAST year students have since been promoted/
      // graduated, so we count every historic status — otherwise a past year
      // would show 0 students in every class.
      const ENROLL_STATUSES = viewingPast
        ? ['enrolled', 'active', 'completed', 'promoted', 'repeated', 'graduated']
        : ['enrolled', 'active'];

      // ── Assigned classes with student counts + subjects ──────────────────────
      let classes: any[] = [];
      let totalStudents = 0;
      if (classIds.length > 0) {
        const classRows = await db('classes')
          .leftJoin('teachers as ct', 'classes.class_teacher_id', 'ct.id')
          .leftJoin('users as ctu', 'ct.user_id', 'ctu.id')
          .whereIn('classes.id', classIds)
          .select(
            'classes.id',
            'classes.name',
            'classes.level',
            'classes.section',
            'classes.room_number',
            'classes.class_teacher_id',
            db.raw("CONCAT(COALESCE(ctu.first_name, ''), ' ', COALESCE(ctu.last_name, '')) as class_teacher_name"),
          );

        // Enrollment counts per class (live set, or historic for a past year)
        const counts = await db('enrollments')
          .whereIn('class_id', classIds)
          .whereIn('status', ENROLL_STATUSES)
          .groupBy('class_id')
          .select('class_id')
          .count('* as cnt');
        const countMap = new Map(counts.map((c: any) => [c.class_id, Number(c.cnt)]));

        // Subjects this teacher teaches per class
        const subjPerClass = await db('teacher_assignments as ta')
          .leftJoin('subjects as s', 'ta.subject_id', 's.id')
          .where('ta.teacher_id', teacherId)
          .whereIn('ta.class_id', classIds)
          .select('ta.class_id', 's.name as subject_name');
        const subjMap = new Map<string, string[]>();
        for (const r of subjPerClass) {
          const arr = subjMap.get(r.class_id) ?? [];
          if (r.subject_name) arr.push(r.subject_name);
          subjMap.set(r.class_id, arr);
        }

        classes = classRows.map((c: any) => {
          const studentCount = countMap.get(c.id) ?? 0;
          totalStudents += studentCount;
          return {
            id: c.id,
            name: c.name,
            level: c.level,
            section: c.section,
            room: c.room_number,
            student_count: studentCount,
            subjects: subjMap.get(c.id) ?? [],
            is_class_teacher: c.class_teacher_id === teacherId,
            class_teacher_name: (c.class_teacher_name || '').trim() || null,
            status: 'active',
          };
        });
      }

      // Total distinct students taught (avoid double-counting across classes)
      let distinctStudents = totalStudents;
      if (classIds.length > 1) {
        const distinct = await db('enrollments')
          .whereIn('class_id', classIds)
          .whereIn('status', ENROLL_STATUSES)
          .countDistinct('student_id as cnt')
          .first();
        distinctStudents = Number(distinct?.cnt ?? totalStudents);
      }

      // ── Today's schedule ─────────────────────────────────────────────────────
      // Only meaningful for the current year — a past year is a static record,
      // so "today's classes" is empty when viewing history.
      const todayName = DOW[new Date().getDay()];
      const scheduleRows = viewingPast ? [] : await db('schedules as sc')
        .leftJoin('classes as c', 'sc.class_id', 'c.id')
        .leftJoin('subjects as s', 'sc.subject_id', 's.id')
        .where('sc.teacher_id', teacherId)
        .whereRaw('LOWER(sc.day_of_week) = ?', [todayName])
        .orderBy('sc.start_time', 'asc')
        .select(
          'sc.id',
          'sc.start_time',
          'sc.end_time',
          'sc.room_number',
          'c.id as class_id',
          'c.name as class_name',
          's.name as subject_name',
        );

      const todaySchedule = scheduleRows.map((r: any) => ({
        id: r.id,
        class_id: r.class_id,
        class_name: r.class_name,
        subject_name: r.subject_name,
        start_time: r.start_time,
        end_time: r.end_time,
        room: r.room_number,
      }));

      // ── Recent activity: attendance marked + SL scores entered ───────────────
      const recentActivity: Array<{ type: string; message: string; timestamp: string }> = [];

      if (classIds.length > 0) {
        const recentAttendance = await db('attendance')
          .leftJoin('classes as c', 'attendance.class_id', 'c.id')
          .whereIn('attendance.class_id', classIds)
          .where('attendance.marked_by', userId)
          .orderBy('attendance.created_at', 'desc')
          .limit(5)
          .select('c.name as class_name', 'attendance.attendance_date', 'attendance.created_at')
          .catch(() => []);

        // Group attendance by date+class into one activity line each
        const seen = new Set<string>();
        for (const a of recentAttendance as any[]) {
          const key = `${a.class_name}-${a.attendance_date}`;
          if (seen.has(key)) continue;
          seen.add(key);
          recentActivity.push({
            type: 'attendance',
            message: `Attendance marked for ${a.class_name || 'a class'}`,
            timestamp: a.created_at,
          });
        }
      }

      // Recent SL score entries by this teacher
      const recentScores = await db('sl_subject_results as sr')
        .leftJoin('classes as c', 'sr.class_id', 'c.id')
        .leftJoin('subjects as s', 'sr.subject_id', 's.id')
        .where('sr.tenant_id', tenantId)
        .whereIn('sr.class_id', classIds.length ? classIds : ['00000000-0000-0000-0000-000000000000'])
        .orderBy('sr.updated_at', 'desc')
        .limit(5)
        .select('c.name as class_name', 's.name as subject_name', 'sr.term', 'sr.updated_at')
        .catch(() => []);

      const scoreSeen = new Set<string>();
      for (const r of recentScores as any[]) {
        const key = `${r.class_name}-${r.subject_name}-${r.term}`;
        if (scoreSeen.has(key)) continue;
        scoreSeen.add(key);
        recentActivity.push({
          type: 'grade',
          message: `Scores entered — ${r.subject_name || 'subject'} (${r.class_name || 'class'})`,
          timestamp: r.updated_at,
        });
      }

      // Sort combined activity by time desc, keep the latest 6
      recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Transition awareness (current year only).
      const pendingTransition = viewingPast ? null : await this.getPendingTransition(classIds, tenantId);

      return {
        academic_year: requestedYear || activeYear,
        active_year: activeYear,
        viewing_past: viewingPast,
        pending_transition: pendingTransition,
        stats: {
          total_classes: classIds.length,
          total_students: distinctStudents,
          total_subjects: totalSubjects,
          classes_today: todaySchedule.length,
        },
        classes,
        today_schedule: todaySchedule,
        recent_activity: recentActivity.slice(0, 6),
      };
    } catch (error) {
      logger.error('Error building teacher dashboard:', error);
      throw error;
    }
  }
}

export default new TeacherDashboardService();
