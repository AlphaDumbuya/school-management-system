/**
 * academicArchiveService — a single, read-only "snapshot" of ONE academic year
 * for the school administrator's Academic Archive page. Lets an admin retrieve
 * a full picture of any past year (e.g. 5 years ago) in one call.
 *
 * Everything is tenant-scoped and read-only. Data is resolved by BOTH keying
 * schemes: the academic_sessions row (id, for classes/enrollments) and the
 * academic_year string (for finance/results/exams/promotions), bridged by the
 * session name == the year string convention.
 */
import db from '../utils/database.js';
import { logger } from '../utils/logger.js';
import financeLedgerService from './financeLedgerService.js';
import slReportCardService from './slReportCardService.js';
import promotionService from './promotionService.js';

// Every status a student can hold in a year's class, including the statuses
// enrollments get once the year is over (rollover marks them 'completed').
const HISTORIC_ENROLLMENT = ['enrolled', 'active', 'completed', 'promoted', 'repeated', 'graduated'];

export interface YearSnapshot {
  academic_year: string;
  session_id: string | null;
  is_active: boolean;
  counts: {
    classes: number;
    students_enrolled: number;
    subjects: number;
  };
  finance: { billed: number; collected: number; outstanding: number } | null;
  attendance: { present: number; late: number; absent: number; excused: number; rate: number } | null;
  classes: Array<{ id: string; name: string; level: string | null; section: string | null; enrolled: number }>;
  publications: any[];
  promotions: any[];
  examinations: any[];
}

export interface StudentYearHistory {
  student: { id: string; name: string; admission_no: string | null } | null;
  enrollments: Array<{ class_name: string | null; level: string | null; academic_year: string | null; status: string | null; enrollment_date: string | null }>;
  results: Array<{ academic_year: string; term: string; subject_name: string | null; mean: number | null }>;
}

class AcademicArchiveService {
  /** Resolve the session row for a tenant by its year-string name. */
  private async sessionFor(tenantId: string, academicYear: string) {
    return db('academic_sessions')
      .where({ tenant_id: tenantId, name: academicYear })
      .first()
      .catch(() => null);
  }

  /**
   * Build a complete snapshot for one year. Each sub-query is defensive so one
   * missing table/domain never breaks the whole snapshot.
   */
  async getYearSnapshot(tenantId: string, academicYear: string): Promise<YearSnapshot> {
    const session = await this.sessionFor(tenantId, academicYear);
    const sessionId: string | null = session?.id ?? null;

    // Classes for the year (by session), with per-class enrolled counts.
    let classes: YearSnapshot['classes'] = [];
    if (sessionId) {
      const rows = await db('classes as c')
        .where('c.academic_session_id', sessionId)
        .leftJoin(
          db('enrollments')
            .select('class_id')
            .count('* as enrolled')
            .whereIn('status', HISTORIC_ENROLLMENT)
            .groupBy('class_id')
            .as('ec'),
          'c.id',
          'ec.class_id',
        )
        .select('c.id', 'c.name', 'c.level', 'c.section', db.raw('COALESCE(ec.enrolled, 0) as enrolled'))
        .orderBy('c.level', 'asc')
        .orderBy('c.name', 'asc')
        .catch(() => []);
      classes = rows.map((r: any) => ({
        id: r.id, name: r.name, level: r.level ?? null, section: r.section ?? null, enrolled: Number(r.enrolled || 0),
      }));
    }

    // Enrolled-students count for the year (distinct students across the year's classes).
    let studentsEnrolled = 0;
    if (sessionId) {
      const row: any = await db('enrollments')
        .whereIn('status', HISTORIC_ENROLLMENT)
        .where((w) => {
          // Enrollments carry the session id when created in-year; rolled-over
          // ones may only be linked through the year's classes.
          w.where('academic_session_id', sessionId);
          if (classes.length) w.orWhereIn('class_id', classes.map((c) => c.id));
        })
        .countDistinct('student_id as c')
        .first()
        .catch(() => ({ c: 0 }));
      studentsEnrolled = Number(row?.c ?? 0);
    }

    // Subjects taught that year (distinct via class_subjects for the year's classes).
    let subjectsCount = 0;
    if (classes.length) {
      const row: any = await db('class_subjects')
        .whereIn('class_id', classes.map((c) => c.id))
        .countDistinct('subject_id as c')
        .first()
        .catch(() => ({ c: 0 }));
      subjectsCount = Number(row?.c ?? 0);
    }

    // Finance summary for the year (string-keyed).
    let finance: YearSnapshot['finance'] = null;
    try {
      finance = await financeLedgerService.getTenantSummary(tenantId, academicYear);
    } catch (e) {
      logger.warn(`Archive finance summary failed for ${academicYear}: ${(e as any)?.message || e}`);
    }

    // Attendance summary for the year — aggregate attendance rows for the
    // year's classes within the session's date window (attendance is date-keyed).
    let attendance: YearSnapshot['attendance'] = null;
    if (classes.length && session?.start_date && session?.end_date) {
      try {
        const rows = await db('attendance')
          .whereIn('class_id', classes.map((c) => c.id))
          .whereBetween('attendance_date', [session.start_date, session.end_date])
          .select('status')
          .catch(() => []);
        let present = 0, late = 0, absent = 0, excused = 0;
        for (const r of rows as any[]) {
          const s = String(r.status || '').toLowerCase();
          if (s === 'present') present++;
          else if (s === 'late') late++;
          else if (s === 'excused') excused++;
          else if (s === 'absent') absent++;
        }
        const total = present + late + absent + excused;
        // Rate = present-or-excused-or-late over total marked.
        const rate = total > 0 ? Math.round(((present + excused + late) / total) * 100) : 0;
        attendance = { present, late, absent, excused, rate };
      } catch (e) {
        logger.warn(`Archive attendance failed for ${academicYear}: ${(e as any)?.message || e}`);
      }
    }

    // Report-card publications for the year.
    let publications: any[] = [];
    try {
      publications = await slReportCardService.getPublications(tenantId, academicYear);
    } catch (e) {
      logger.warn(`Archive publications failed for ${academicYear}: ${(e as any)?.message || e}`);
    }

    // Promotion audit for the year.
    let promotions: any[] = [];
    try {
      promotions = await promotionService.getPromotionHistory(tenantId, { academic_year: academicYear });
    } catch (e) {
      logger.warn(`Archive promotions failed for ${academicYear}: ${(e as any)?.message || e}`);
    }

    // Examinations for the year (if the table exists).
    let examinations: any[] = [];
    try {
      if (await db.schema.hasTable('examinations')) {
        examinations = await db('examinations')
          .where({ tenant_id: tenantId, academic_year: academicYear })
          .orderBy('created_at', 'desc')
          .catch(() => []);
      }
    } catch (e) {
      logger.warn(`Archive examinations failed for ${academicYear}: ${(e as any)?.message || e}`);
    }

    return {
      academic_year: academicYear,
      session_id: sessionId,
      is_active: !!session?.is_active,
      counts: { classes: classes.length, students_enrolled: studentsEnrolled, subjects: subjectsCount },
      finance,
      attendance,
      classes,
      publications,
      promotions,
      examinations,
    };
  }

  /**
   * Per-student history across ALL years: their enrollments (class placements
   * per year) and their subject results (mean per subject/term/year). Lets an
   * admin trace one student's whole journey from the archive.
   */
  async getStudentHistory(tenantId: string, studentId: string): Promise<StudentYearHistory> {
    const student = await db('students')
      .where({ tenant_id: tenantId })
      .andWhere(function (this: any) {
        this.where('id', studentId).orWhere('student_id', studentId);
      })
      .first()
      .catch(() => null);
    if (!student) return { student: null, enrollments: [], results: [] };

    // Enrollment history (all years), newest first, with class + session name.
    const enrollments = await db('enrollments as e')
      .where('e.student_id', student.id)
      .leftJoin('classes as c', 'e.class_id', 'c.id')
      .leftJoin('academic_sessions as s', 'e.academic_session_id', 's.id')
      .orderBy('e.enrollment_date', 'desc')
      .select(
        'c.name as class_name',
        'c.level as level',
        's.name as academic_year',
        'e.status as status',
        'e.enrollment_date as enrollment_date',
      )
      .catch(() => []);

    // Subject results across years (mean per subject/term/year).
    const results = await db('sl_subject_results as r')
      .where({ 'r.tenant_id': tenantId, 'r.student_id': student.id })
      .leftJoin('subjects as sub', 'r.subject_id', 'sub.id')
      .orderBy('r.academic_year', 'desc')
      .orderBy('r.term', 'asc')
      .select('r.academic_year', 'r.term', 'sub.name as subject_name', 'r.mean')
      .catch(() => []);

    return {
      student: {
        id: student.id,
        name: [student.first_name, student.last_name].filter(Boolean).join(' ') || student.student_id,
        admission_no: student.student_id ?? null,
      },
      enrollments: enrollments.map((e: any) => ({
        class_name: e.class_name ?? null,
        level: e.level ?? null,
        academic_year: e.academic_year ?? null,
        status: e.status ?? null,
        enrollment_date: e.enrollment_date ? new Date(e.enrollment_date).toISOString().slice(0, 10) : null,
      })),
      results: results.map((r: any) => ({
        academic_year: r.academic_year,
        term: r.term,
        subject_name: r.subject_name ?? null,
        mean: r.mean != null ? Number(r.mean) : null,
      })),
    };
  }
}

export default new AcademicArchiveService();
