/**
 * Student Dashboard Service
 * =========================
 * Real, tenant + student-scoped data for the student portal dashboard.
 * A student only ever sees THEIR OWN data:
 *   - Profile (name, class, admission no.)
 *   - KPI stats (attendance rate, average grade, today's classes, outstanding fees)
 *   - Published grades (SL subject results for the current class/year)
 *   - Attendance summary + recent records
 *   - Today's schedule + weekly timetable
 *   - Fees (invoices + outstanding balance)
 */

import db from '../utils/database.js';
import { logger } from '../utils/logger.js';

const DOW = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

class StudentDashboardService {
  /** Resolve the students.id for a given user (tenant-scoped). */
  private async getStudent(userId: string, tenantId: string): Promise<any | null> {
    const row = await db('students')
      .where('students.user_id', userId)
      .where('students.tenant_id', tenantId)
      .select('*')
      .first();
    return row ?? null;
  }

  /** The active class the student is enrolled in (most recent active enrollment). */
  private async getActiveClass(studentId: string): Promise<any | null> {
    const row = await db('enrollments as e')
      .join('classes as c', 'e.class_id', 'c.id')
      .where('e.student_id', studentId)
      .whereIn('e.status', ['active', 'enrolled'])
      .orderBy('e.created_at', 'desc')
      .select('c.id', 'c.name', 'c.level', 'c.section', 'c.room_number', 'c.academic_session_id')
      .first();
    return row ?? null;
  }

  async getDashboard(userId: string, tenantId: string): Promise<any> {
    try {
      const student = await this.getStudent(userId, tenantId);
      if (!student) {
        return {
          student_profile_missing: true,
          profile: null,
          stats: { attendance_rate: 0, average_grade: 0, classes_today: 0, outstanding_fees: 0 },
          grades: [],
          attendance: { present: 0, absent: 0, late: 0, excused: 0, total: 0, percentage: 0, records: [] },
          today_schedule: [],
          weekly_schedule: [],
          fees: { total: 0, paid: 0, outstanding: 0, invoices: [] },
        };
      }

      const activeClass = await this.getActiveClass(student.id);
      const classId = activeClass?.id ?? null;

      // ── Academic year ──────────────────────────────────────────────────
      // Resolve from the ACTUAL report-card data (publications / results use
      // the "YYYY/YYYY+1" format) so the publish-gate matches reliably —
      // academic_sessions may store the year in a different format.
      let sessionYear: string | null = null;
      if (activeClass?.academic_session_id) {
        const sess = await db('academic_sessions').where('id', activeClass.academic_session_id).select('name', 'year').first().catch(() => null);
        sessionYear = sess?.year || sess?.name || null;
      }
      let academicYear: string | null = sessionYear;
      if (classId) {
        const { default: slReportCardService } = await import('./slReportCardService.js');
        academicYear = await slReportCardService.resolveClassAcademicYear(tenantId, classId, sessionYear).catch(() => sessionYear);
      }

      // ── Grades: only RELEASED SL subject results for the active class.
      //    A student must never see unpublished scores — gate strictly by the
      //    terms the principal has released (or the whole year). ─────────────
      let grades: any[] = [];
      let averageGrade = 0;
      let resultsPublished = false;
      if (classId && academicYear) {
        const { default: slReportCardService } = await import('./slReportCardService.js');
        const { terms: releasedTerms, wholeYear } = await slReportCardService
          .getPublishedTerms(tenantId, classId, academicYear)
          .catch(() => ({ terms: [] as string[], wholeYear: false }));
        resultsPublished = wholeYear || releasedTerms.length > 0;

        if (resultsPublished) {
          let gq = db('sl_subject_results as sr')
            .join('subjects as s', 'sr.subject_id', 's.id')
            .where('sr.tenant_id', tenantId)
            .where('sr.student_id', student.id)
            .where('sr.class_id', classId)
            .where('sr.academic_year', academicYear);
          // If only specific terms are released, restrict to those.
          if (!wholeYear) gq = gq.whereIn('sr.term', releasedTerms);

          const rows = await gq
            .select('sr.id', 's.name as subject_name', 's.code as subject_code', 'sr.term', 'sr.test1', 'sr.test2', 'sr.mean', 'sr.subject_rank')
            .orderBy('s.name', 'asc')
            .catch(() => []);
          grades = rows as any[];

          const means = grades.map((g) => Number(g.mean)).filter((n) => !isNaN(n) && n > 0);
          if (means.length) averageGrade = Math.round((means.reduce((a, b) => a + b, 0) / means.length) * 10) / 10;
        }
      }

      // ── Attendance summary + recent records ──────────────────────────────────
      const attendanceRows = await db('attendance')
        .where('student_id', student.id)
        .orderBy('attendance_date', 'desc')
        .select('id', 'attendance_date', 'status', 'class_id', 'session_type', 'check_in_time', 'check_out_time', 'marked_at', 'remarks')
        .catch(() => []);

      let present = 0, absent = 0, late = 0, excused = 0;
      for (const a of attendanceRows as any[]) {
        const s = (a.status || '').toLowerCase();
        if (s === 'present') present++;
        else if (s === 'absent') absent++;
        else if (s === 'late') late++;
        else if (s === 'excused') excused++;
      }
      const totalAtt = attendanceRows.length;
      // Present + late (and excused) count toward "attended"
      const attendedish = present + late + excused;
      const attendanceRate = totalAtt > 0 ? Math.round((attendedish / totalAtt) * 100) : 0;

      const recentAttendance = (attendanceRows as any[]).slice(0, 10).map((a) => ({
        id: a.id,
        date: a.attendance_date,
        status: (a.status || '').toLowerCase(),
        session_type: a.session_type,
        check_in_time: a.check_in_time,
        check_out_time: a.check_out_time,
        marked_at: a.marked_at,
        remarks: a.remarks || null,
      }));

      // ── Schedule (today + weekly) for the student's active class ─────────────
      let todaySchedule: any[] = [];
      let weeklySchedule: any[] = [];
      if (classId) {
        const allSchedule = await db('schedules as sc')
          .leftJoin('subjects as s', 'sc.subject_id', 's.id')
          .leftJoin('teachers as t', 'sc.teacher_id', 't.id')
          .leftJoin('users as tu', 't.user_id', 'tu.id')
          .where('sc.class_id', classId)
          .orderBy('sc.start_time', 'asc')
          .select(
            'sc.id',
            'sc.day_of_week',
            'sc.start_time',
            'sc.end_time',
            'sc.room_number',
            's.name as subject_name',
            db.raw("CONCAT(COALESCE(tu.first_name,''),' ',COALESCE(tu.last_name,'')) as teacher_name"),
          )
          .catch(() => []);

        weeklySchedule = (allSchedule as any[]).map((r) => ({
          id: r.id,
          day_of_week: r.day_of_week,
          subject_name: r.subject_name,
          teacher_name: (r.teacher_name || '').trim() || null,
          start_time: r.start_time,
          end_time: r.end_time,
          room: r.room_number,
        }));

        const todayName = DOW[new Date().getDay()];
        todaySchedule = weeklySchedule.filter(
          (r) => (r.day_of_week || '').toLowerCase() === todayName,
        );
      }

      // ── Fees: invoices + outstanding ─────────────────────────────────────────
      const invoices = await db('invoices')
        .where('student_id', student.id)
        .orderBy('due_date', 'desc')
        .select('id', 'invoice_number', 'total_amount', 'total_paid', 'balance', 'due_date', 'status')
        .catch(() => []);

      let feeTotal = 0, feePaid = 0, feeOutstanding = 0;
      for (const inv of invoices as any[]) {
        feeTotal += Number(inv.total_amount || 0);
        feePaid += Number(inv.total_paid || 0);
        feeOutstanding += Number(inv.balance || 0);
      }

      return {
        profile: {
          id: student.id,
          admission_no: student.student_id,
          first_name: student.first_name,
          last_name: student.last_name,
          full_name: `${student.first_name || ''} ${student.last_name || ''}`.trim(),
          photo_url: student.photo_url || null,
          class_id: classId,
          class_name: activeClass?.name || null,
          class_level: activeClass?.level || null,
          class_section: activeClass?.section || null,
          academic_year: academicYear,
        },
        stats: {
          attendance_rate: attendanceRate,
          average_grade: averageGrade,
          classes_today: todaySchedule.length,
          outstanding_fees: Math.round(feeOutstanding * 100) / 100,
        },
        grades,
        results_published: resultsPublished,
        attendance: {
          present,
          absent,
          late,
          excused,
          total: totalAtt,
          percentage: attendanceRate,
          records: recentAttendance,
        },
        today_schedule: todaySchedule,
        weekly_schedule: weeklySchedule,
        fees: {
          total: Math.round(feeTotal * 100) / 100,
          paid: Math.round(feePaid * 100) / 100,
          outstanding: Math.round(feeOutstanding * 100) / 100,
          invoices,
        },
      };
    } catch (error) {
      logger.error('Error building student dashboard:', error);
      throw error;
    }
  }
}

export default new StudentDashboardService();
