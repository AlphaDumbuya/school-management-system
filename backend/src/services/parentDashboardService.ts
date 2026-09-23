/**
 * Parent Dashboard Service
 * =========================
 * Real, tenant + parent-scoped data for the parent portal.
 * A parent only ever sees THEIR OWN children:
 *   - Children resolved via guardians.user_id/email, with a narrow legacy
 *     registration-email fallback. Names alone are not proof of guardianship.
 *   - Per-child: class, attendance rate, average grade, outstanding fees.
 *   - Aggregate KPIs across all children.
 */

import db from '../utils/database.js';
import { logger } from '../utils/logger.js';
import slReportCardService from './slReportCardService.js';

interface ChildSummary {
  id: string;
  admission_no: string;
  name: string;
  photo_url: string | null;
  class_id: string | null;
  class_name: string | null;
  class_level: string | null;
  attendance_rate: number;
  average_grade: number;
  outstanding_fees: number;
  results_published: boolean;
}

class ParentDashboardService {
  /** Resolve the students linked to a parent user (tenant-scoped). */
  private async resolveChildren(userId: string, tenantId: string): Promise<any[]> {
    const parent = await db('users').where({ id: userId, tenant_id: tenantId }).first();
    const email = (parent?.email || '').toLowerCase().trim();

    // 1) Authoritative: guardians linked to this parent user.
    let studentIds: string[] = [];
    try {
      if (await db.schema.hasTable('guardians')) {
        const g = await db('guardians as g')
          .join('students as s', 'g.student_id', 's.id')
          .where('s.tenant_id', tenantId)
          .where(function (this: any) {
            this.where('g.user_id', userId);
            if (email) this.orWhereRaw('LOWER(g.email) = ?', [email]);
          })
          .distinct('g.student_id');
        studentIds = g.map((r: any) => r.student_id);
      }
    } catch (_) { /* ignore */ }

    // 2) Fallback for legacy/demo data with no guardians rows: derive the
    //    student from the auto-generated parent email `{reg}@parent.school.com`.
    if (studentIds.length === 0 && email.endsWith('@parent.school.com')) {
      const reg = email.replace('@parent.school.com', '');
      const derived = await db('students')
        .where('tenant_id', tenantId)
        .whereRaw('LOWER(student_id) = ?', [reg])
        .select('id');
      studentIds = derived.map((r: any) => r.id);
    }

    // 3) Legacy fallback: exact email only. A matching name is not sufficient
    // to grant access to a child's private attendance records.
    let query = db('students').where('tenant_id', tenantId);
    if (studentIds.length > 0) {
      query = query.whereIn('id', studentIds);
    } else {
      // Avoid leaking: only match when we have a real email or name signal, and
      // never match the synthetic parent-email domain against student emails.
      const realEmail = email && !email.endsWith('@parent.school.com') ? email : '';
      if (!realEmail) return [];
      query = query.whereRaw('LOWER(email) = ?', [realEmail]);
    }

    return query.select('*').orderBy('created_at', 'desc');
  }

  /** Compute a single child's summary metrics. */
  private async childSummary(student: any, tenantId: string): Promise<ChildSummary> {
    // Active class
    const activeClass = await db('enrollments as e')
      .join('classes as c', 'e.class_id', 'c.id')
      .where('e.student_id', student.id)
      .whereIn('e.status', ['active', 'enrolled'])
      .orderBy('e.created_at', 'desc')
      .select('c.id', 'c.name', 'c.level', 'c.academic_session_id')
      .first()
      .catch(() => null);
    const classId = activeClass?.id ?? null;

    // Academic year — resolve from the actual report-card data (publications /
    // results use "YYYY/YYYY+1") so the publish-gate matches reliably.
    let sessionYear: string | null = null;
    if (activeClass?.academic_session_id) {
      const sess = await db('academic_sessions').where('id', activeClass.academic_session_id).select('name', 'year').first().catch(() => null);
      sessionYear = sess?.year || sess?.name || null;
    }
    const academicYear: string | null = classId
      ? await slReportCardService.resolveClassAcademicYear(tenantId, classId, sessionYear).catch(() => sessionYear)
      : sessionYear;

    // Attendance rate
    const att = await db('attendance').where('student_id', student.id).select('status').catch(() => []);
    const total = att.length;
    const good = (att as any[]).filter((a) => ['present', 'late', 'excused'].includes((a.status || '').toLowerCase())).length;
    const attendanceRate = total > 0 ? Math.round((good / total) * 100) : 0;

    // Average grade (published results only)
    let averageGrade = 0;
    let resultsPublished = false;
    if (classId && academicYear) {
      // Published gate — reuse the canonical publication check.
      try {
        resultsPublished = await slReportCardService.isAnythingPublished(tenantId, classId, academicYear);
      } catch (_) { resultsPublished = false; }

      if (resultsPublished) {
        let gq = db('sl_subject_results')
          .where({ tenant_id: tenantId, student_id: student.id, class_id: classId })
          .whereNotNull('mean');
        if (academicYear) gq = gq.where('academic_year', academicYear);
        const rows = await gq.select('mean').catch(() => []);
        const means = (rows as any[]).map((r) => Number(r.mean)).filter((n) => !isNaN(n) && n > 0);
        if (means.length) averageGrade = Math.round((means.reduce((a, b) => a + b, 0) / means.length) * 10) / 10;
      }
    }

    // Outstanding fees
    const inv = await db('invoices').where('student_id', student.id).select('balance').catch(() => []);
    const outstanding = (inv as any[]).reduce((s, i) => s + Number(i.balance || 0), 0);

    return {
      id: student.id,
      admission_no: student.student_id,
      name: `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.student_id,
      photo_url: student.photo_url || null,
      class_id: classId,
      class_name: activeClass?.name || null,
      class_level: activeClass?.level || null,
      attendance_rate: attendanceRate,
      average_grade: averageGrade,
      outstanding_fees: Math.round(outstanding * 100) / 100,
      results_published: resultsPublished,
    };
  }

  async getDashboard(userId: string, tenantId: string): Promise<any> {
    try {
      const students = await this.resolveChildren(userId, tenantId);
      if (students.length === 0) {
        return {
          no_children: true,
          children: [],
          stats: { total_children: 0, total_outstanding: 0, average_attendance: 0, average_grade: 0 },
        };
      }

      const children: ChildSummary[] = [];
      for (const s of students) {
        children.push(await this.childSummary(s, tenantId));
      }

      const totalOutstanding = children.reduce((s, c) => s + c.outstanding_fees, 0);
      const attRates = children.map((c) => c.attendance_rate).filter((n) => n > 0);
      const gradeRates = children.map((c) => c.average_grade).filter((n) => n > 0);
      const avgAtt = attRates.length ? Math.round(attRates.reduce((a, b) => a + b, 0) / attRates.length) : 0;
      const avgGrade = gradeRates.length ? Math.round((gradeRates.reduce((a, b) => a + b, 0) / gradeRates.length) * 10) / 10 : 0;

      return {
        children,
        stats: {
          total_children: children.length,
          total_outstanding: Math.round(totalOutstanding * 100) / 100,
          average_attendance: avgAtt,
          average_grade: avgGrade,
        },
      };
    } catch (error) {
      logger.error('Error building parent dashboard:', error);
      throw error;
    }
  }

  /** Detailed per-child view: grades, attendance records, schedule, fees. */
  async getChildDetail(userId: string, tenantId: string, studentId: string): Promise<any> {
    // Verify the child belongs to this parent (tenant + linkage).
    const students = await this.resolveChildren(userId, tenantId);
    const student = students.find((s) => String(s.id) === String(studentId));
    if (!student) {
      throw new Error('You can only view your own child\'s records');
    }

    const activeClass = await db('enrollments as e')
      .join('classes as c', 'e.class_id', 'c.id')
      .where('e.student_id', student.id)
      .whereIn('e.status', ['active', 'enrolled'])
      .orderBy('e.created_at', 'desc')
      .select('c.id', 'c.name', 'c.level', 'c.academic_session_id')
      .first()
      .catch(() => null);
    const classId = activeClass?.id ?? null;

    let sessionYear: string | null = null;
    if (activeClass?.academic_session_id) {
      const sess = await db('academic_sessions').where('id', activeClass.academic_session_id).select('name', 'year').first().catch(() => null);
      sessionYear = sess?.year || sess?.name || null;
    }
    // Resolve the year the report-card data is actually keyed on (publications /
    // results use "YYYY/YYYY+1"), so the publish-gate matches reliably.
    let academicYear: string | null = null;
    if (classId) {
      academicYear = await slReportCardService.resolveClassAcademicYear(tenantId, classId, sessionYear).catch(() => sessionYear);
    } else {
      academicYear = sessionYear;
    }

    // Published gate — term-aware, mirrors the student view so parents only
    // ever see grades for terms the school has actually released.
    let resultsPublished = false;
    let releasedTerms: string[] = [];
    let wholeYearReleased = false;
    if (classId && academicYear) {
      try {
        const pub = await slReportCardService.getPublishedTerms(tenantId, classId, academicYear);
        releasedTerms = pub.terms;
        wholeYearReleased = pub.wholeYear;
        resultsPublished = wholeYearReleased || releasedTerms.length > 0;
      } catch (_) { resultsPublished = false; }
    }

    // Grades (only released terms; whole-year release shows all terms)
    let grades: any[] = [];
    if (classId && resultsPublished) {
      let gq = db('sl_subject_results as sr')
        .join('subjects as s', 'sr.subject_id', 's.id')
        .where('sr.tenant_id', tenantId)
        .where('sr.student_id', student.id)
        .where('sr.class_id', classId);
      if (academicYear) gq = gq.where('sr.academic_year', academicYear);
      if (!wholeYearReleased) gq = gq.whereIn('sr.term', releasedTerms);
      grades = await gq
        .select('sr.id', 's.name as subject_name', 's.code as subject_code', 'sr.term', 'sr.test1', 'sr.test2', 'sr.mean', 'sr.subject_rank')
        .orderBy('s.name', 'asc')
        .catch(() => []);
    }

    // Attendance
    const attendanceRows = await db('attendance')
      .where('student_id', student.id)
      .orderBy('attendance_date', 'desc')
      .orderBy('session_type', 'asc')
      .select('id', 'attendance_date', 'status', 'session_type', 'check_in_time', 'check_out_time', 'marked_at', 'remarks')
      .catch(() => []);
    let present = 0, absent = 0, late = 0, excused = 0;
    for (const a of attendanceRows as any[]) {
      const s = (a.status || '').toLowerCase();
      if (s === 'present') present++; else if (s === 'absent') absent++; else if (s === 'late') late++; else if (s === 'excused') excused++;
    }
    const totalAtt = attendanceRows.length;
    const attendanceRate = totalAtt > 0 ? Math.round(((present + late + excused) / totalAtt) * 100) : 0;

    // Schedule
    let schedule: any[] = [];
    if (classId) {
      schedule = await db('schedules as sc')
        .leftJoin('subjects as s', 'sc.subject_id', 's.id')
        .leftJoin('teachers as t', 'sc.teacher_id', 't.id')
        .leftJoin('users as tu', 't.user_id', 'tu.id')
        .where('sc.class_id', classId)
        .orderBy('sc.start_time', 'asc')
        .select(
          'sc.id', 'sc.day_of_week', 'sc.start_time', 'sc.end_time', 'sc.room_number',
          's.name as subject_name',
          db.raw("CONCAT(COALESCE(tu.first_name,''),' ',COALESCE(tu.last_name,'')) as teacher_name"),
        )
        .catch(() => []);
      schedule = (schedule as any[]).map((r) => ({
        id: r.id, day_of_week: r.day_of_week, subject_name: r.subject_name,
        teacher_name: (r.teacher_name || '').trim() || null,
        start_time: r.start_time, end_time: r.end_time, room: r.room_number,
      }));
    }

    // Fees
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
        name: `${student.first_name || ''} ${student.last_name || ''}`.trim(),
        photo_url: student.photo_url || null,
        class_id: classId,
        class_name: activeClass?.name || null,
        class_level: activeClass?.level || null,
        academic_year: academicYear,
      },
      results_published: resultsPublished,
      grades,
      attendance: {
        present, absent, late, excused, total: totalAtt, percentage: attendanceRate,
        records: (attendanceRows as any[]).map((a) => ({
          id: a.id, date: a.attendance_date, status: (a.status || '').toLowerCase(),
          session_type: a.session_type, check_in_time: a.check_in_time,
          check_out_time: a.check_out_time, marked_at: a.marked_at, remarks: a.remarks || null,
        })),
      },
      schedule,
      fees: {
        total: Math.round(feeTotal * 100) / 100,
        paid: Math.round(feePaid * 100) / 100,
        outstanding: Math.round(feeOutstanding * 100) / 100,
        invoices,
      },
    };
  }
}

export default new ParentDashboardService();
