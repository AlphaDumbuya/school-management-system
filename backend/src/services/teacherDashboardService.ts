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

  /** The class ids a teacher can act on: assigned subjects + classes they lead. */
  private async getClassIds(teacherId: string): Promise<string[]> {
    const assigned = await db('teacher_assignments').where('teacher_id', teacherId).distinct('class_id');
    const led = await db('classes').where('class_teacher_id', teacherId).select('id');
    return Array.from(new Set<string>([
      ...assigned.map((r: any) => r.class_id),
      ...led.map((r: any) => r.id),
    ]));
  }

  async getDashboard(userId: string, tenantId: string): Promise<any> {
    try {
      const teacherId = await this.getTeacherId(userId, tenantId);
      if (!teacherId) {
        return {
          teacher_profile_missing: true,
          stats: { total_classes: 0, total_students: 0, total_subjects: 0, classes_today: 0 },
          classes: [],
          today_schedule: [],
          recent_activity: [],
        };
      }

      const classIds = await this.getClassIds(teacherId);

      // Distinct subjects the teacher is assigned to
      const subjectRows = await db('teacher_assignments')
        .where('teacher_id', teacherId)
        .distinct('subject_id');
      const totalSubjects = subjectRows.length;

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

        // Active enrollment counts per class
        const counts = await db('enrollments')
          .whereIn('class_id', classIds)
          .where('status', 'active')
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
          .where('status', 'active')
          .countDistinct('student_id as cnt')
          .first();
        distinctStudents = Number(distinct?.cnt ?? totalStudents);
      }

      // ── Today's schedule ─────────────────────────────────────────────────────
      const todayName = DOW[new Date().getDay()];
      const scheduleRows = await db('schedules as sc')
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

      return {
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
