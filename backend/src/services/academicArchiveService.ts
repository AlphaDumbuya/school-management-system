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
import { resolveYearScope, applyYearScope } from '../utils/academicYear.js';

const TERM_ORDER = ['first_term', 'second_term', 'third_term'];
const round1 = (n: number) => Math.round(n * 10) / 10;

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
  classes: Array<{
    id: string; name: string; level: string | null; section: string | null; enrolled: number;
    class_teacher: string | null;
    /** Students with term results, their average %, and the best student. */
    results: { students: number; average: number | null; top_student: string | null; top_average: number | null };
  }>;
  /** School-wide results for the year (from report-card term summaries). */
  results: { students: number; average: number | null; classes_with_results: number; terms: string[] } | null;
  publications: any[];
  promotions: any[];
  examinations: any[];
}

export interface StudentYearHistory {
  student: {
    id: string; name: string; admission_no: string | null;
    photo_url?: string | null; status?: string | null; gender?: string | null;
    date_of_birth?: string | null; enrollment_date?: string | null; current_class?: string | null;
  } | null;
  /** Per academic year: attendance and fees for this student. */
  years?: Array<{
    academic_year: string;
    attendance: { present: number; late: number; absent: number; excused: number; rate: number | null };
    fees: { billed: number; paid: number; outstanding: number };
  }>;
  /** Several students matched a name search — the caller should pick one. */
  matches?: Array<{ id: string; name: string; admission_no: string | null; class_name: string | null }>;
  enrollments: Array<{ class_id: string | null; class_name: string | null; level: string | null; academic_year: string | null; status: string | null; enrollment_date: string | null }>;
  /** Report-card term summaries: overall % and position per term. */
  terms: Array<{ academic_year: string; term: string; class_name: string | null; percentage: number | null; position: number | null; class_size: number | null }>;
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
          // Distinct students (a student can have more than one row in a class).
          db('enrollments')
            .select('class_id')
            .countDistinct('student_id as enrolled')
            .whereIn('status', HISTORIC_ENROLLMENT)
            .groupBy('class_id')
            .as('ec'),
          'c.id',
          'ec.class_id',
        )
        .leftJoin('teachers as t', 'c.class_teacher_id', 't.id')
        .leftJoin('users as tu', 't.user_id', 'tu.id')
        .select(
          'c.id', 'c.name', 'c.level', 'c.section', db.raw('COALESCE(ec.enrolled, 0) as enrolled'),
          db.raw("NULLIF(TRIM(COALESCE(tu.first_name, '') || ' ' || COALESCE(tu.last_name, '')), '') as class_teacher"),
        )
        .orderBy('c.level', 'asc')
        .orderBy('c.name', 'asc')
        .catch(() => []);
      classes = rows.map((r: any) => ({
        id: r.id, name: r.name, level: r.level ?? null, section: r.section ?? null, enrolled: Number(r.enrolled || 0),
        class_teacher: r.class_teacher ?? null,
        results: { students: 0, average: null, top_student: null, top_average: null },
      }));
    }

    // Results: each student's average % across the year's term summaries,
    // rolled up per class (average + best student) and school-wide.
    let results: YearSnapshot['results'] = null;
    try {
      const summaryRows = await db('sl_term_summaries as ts')
        .leftJoin('students as st', 'ts.student_id', 'st.id')
        .leftJoin('users as su', 'st.user_id', 'su.id')
        .where({ 'ts.tenant_id': tenantId, 'ts.academic_year': academicYear })
        .whereNotNull('ts.percentage')
        .select(
          'ts.class_id', 'ts.student_id', 'ts.term', 'ts.percentage',
          db.raw("COALESCE(NULLIF(TRIM(COALESCE(su.first_name, '') || ' ' || COALESCE(su.last_name, '')), ''), NULLIF(TRIM(COALESCE(st.first_name, '') || ' ' || COALESCE(st.last_name, '')), ''), st.student_id) as student_name"),
        );
      if (summaryRows.length) {
        // student+class → list of term percentages
        const byStudent = new Map<string, { classId: string; name: string; pcts: number[] }>();
        const terms = new Set<string>();
        for (const r of summaryRows as any[]) {
          terms.add(r.term);
          const k = `${r.class_id}|${r.student_id}`;
          if (!byStudent.has(k)) byStudent.set(k, { classId: r.class_id, name: r.student_name, pcts: [] });
          byStudent.get(k)!.pcts.push(Number(r.percentage));
        }
        const perClass = new Map<string, Array<{ name: string; avg: number }>>();
        for (const s of byStudent.values()) {
          const avg = s.pcts.reduce((a, b) => a + b, 0) / s.pcts.length;
          if (!perClass.has(s.classId)) perClass.set(s.classId, []);
          perClass.get(s.classId)!.push({ name: s.name, avg });
        }
        for (const c of classes) {
          const list = perClass.get(c.id);
          if (!list?.length) continue;
          const top = [...list].sort((a, b) => b.avg - a.avg)[0];
          c.results = {
            students: list.length,
            average: round1(list.reduce((a, b) => a + b.avg, 0) / list.length),
            top_student: top.name,
            top_average: round1(top.avg),
          };
        }
        const all = [...byStudent.values()].map((s) => s.pcts.reduce((a, b) => a + b, 0) / s.pcts.length);
        results = {
          students: all.length,
          average: round1(all.reduce((a, b) => a + b, 0) / all.length),
          classes_with_results: perClass.size,
          terms: TERM_ORDER.filter((t) => terms.has(t)),
        };
      }
    } catch (e) {
      logger.warn(`Archive results failed for ${academicYear}: ${(e as any)?.message || e}`);
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

    // Attendance summary for the year: rows marked against the year's classes,
    // plus class-less rows dated inside the year's window (the same rule every
    // other page uses). Doesn't depend on the session's start/end dates, which
    // may be mis-entered.
    let attendance: YearSnapshot['attendance'] = null;
    if (sessionId) {
      try {
        const scope = await resolveYearScope(tenantId, academicYear);
        const q = db('attendance')
          .join('students', 'attendance.student_id', 'students.id')
          .where('students.tenant_id', tenantId);
        applyYearScope(q, scope, 'attendance.class_id', 'attendance.attendance_date');
        const rows = await q.select('attendance.status').catch(() => []);
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
        attendance = total > 0 ? { present, late, absent, excused, rate } : null;
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
      results,
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
  async getStudentHistory(tenantId: string, query: string): Promise<StudentYearHistory> {
    const empty: StudentYearHistory = { student: null, enrollments: [], terms: [], results: [] };
    const q = String(query || '').trim();
    if (!q) return empty;
    const NAME_SQL = "COALESCE(NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''), NULLIF(TRIM(COALESCE(s.first_name, '') || ' ' || COALESCE(s.last_name, '')), ''), s.student_id)";
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);

    // Exact id / admission number first.
    let student = await db('students as s')
      .leftJoin('users as u', 's.user_id', 'u.id')
      .where('s.tenant_id', tenantId)
      .andWhere((w: any) => {
        if (isUuid) w.where('s.id', q);
        w.orWhereRaw('LOWER(s.student_id) = ?', [q.toLowerCase()]);
      })
      .first('s.id', 's.student_id', db.raw(`${NAME_SQL} as name`))
      .catch(() => null);

    // Otherwise a name search: one match opens directly, several are listed.
    if (!student) {
      const term = `%${q.replace(/[%_]/g, '')}%`;
      const matches = await db('students as s')
        .leftJoin('users as u', 's.user_id', 'u.id')
        .where('s.tenant_id', tenantId)
        .andWhere((w: any) => {
          w.whereRaw(`${NAME_SQL} ILIKE ?`, [term]).orWhere('s.student_id', 'ilike', term);
        })
        .orderByRaw(`${NAME_SQL} ASC`)
        .limit(20)
        .select('s.id', 's.student_id', db.raw(`${NAME_SQL} as name`))
        .catch(() => []);
      if (matches.length === 0) return empty;
      if (matches.length > 1) {
        // Each match's latest class, to tell same-named students apart.
        const latest = await db('enrollments as e')
          .join('classes as c', 'e.class_id', 'c.id')
          .whereIn('e.student_id', matches.map((m: any) => m.id))
          .distinctOn('e.student_id')
          .orderBy('e.student_id').orderBy('e.created_at', 'desc')
          .select('e.student_id', 'c.name as class_name')
          .catch(() => []);
        const cls = new Map(latest.map((r: any) => [r.student_id, r.class_name]));
        return {
          ...empty,
          matches: matches.map((m: any) => ({ id: m.id, name: m.name, admission_no: m.student_id ?? null, class_name: cls.get(m.id) ?? null })),
        };
      }
      student = matches[0];
    }

    // Enrollment history (all years), newest first. The year comes from the
    // enrollment's session, else its class's session (rolled-over rows).
    const enrollments = await db('enrollments as e')
      .where('e.student_id', student.id)
      .leftJoin('classes as c', 'e.class_id', 'c.id')
      .leftJoin('academic_sessions as s', 'e.academic_session_id', 's.id')
      .leftJoin('academic_sessions as cs', 'c.academic_session_id', 'cs.id')
      .orderByRaw('COALESCE(s.name, cs.name) DESC NULLS LAST')
      .orderBy('e.enrollment_date', 'desc')
      .select(
        'c.id as class_id',
        'c.name as class_name',
        'c.level as level',
        db.raw('COALESCE(s.name, cs.name) as academic_year'),
        'e.status as status',
        'e.enrollment_date as enrollment_date',
      )
      .catch(() => []);

    // Term summaries: overall % and class position per term.
    const terms = await db('sl_term_summaries as ts')
      .leftJoin('classes as c', 'ts.class_id', 'c.id')
      .where({ 'ts.tenant_id': tenantId, 'ts.student_id': student.id })
      .orderBy('ts.academic_year', 'desc')
      .select('ts.academic_year', 'ts.term', 'c.name as class_name', 'ts.percentage', 'ts.position', 'ts.class_size')
      .catch(() => []);
    terms.sort((a: any, b: any) => (a.academic_year === b.academic_year
      ? TERM_ORDER.indexOf(a.term) - TERM_ORDER.indexOf(b.term)
      : String(b.academic_year).localeCompare(String(a.academic_year))));

    // Subject results across years (mean per subject/term/year).
    const results = await db('sl_subject_results as r')
      .where({ 'r.tenant_id': tenantId, 'r.student_id': student.id })
      .leftJoin('subjects as sub', 'r.subject_id', 'sub.id')
      .orderBy('r.academic_year', 'desc')
      .orderBy('sub.name', 'asc')
      .select('r.academic_year', 'r.term', 'sub.name as subject_name', 'r.mean')
      .catch(() => []);

    // Profile details + current class.
    const profile: any = await db('students as s')
      .leftJoin('users as u', 's.user_id', 'u.id')
      .where('s.id', student.id)
      .first(
        db.raw('COALESCE(s.photo_url, u.photo_url) as photo_url'),
        's.status', 's.gender', 's.date_of_birth', 's.enrollment_date',
      )
      .catch(() => null);
    const current: any = await db('enrollments as e')
      .join('classes as c', 'e.class_id', 'c.id')
      .where('e.student_id', student.id)
      .whereIn('e.status', ['active', 'enrolled'])
      .orderBy('e.created_at', 'desc')
      .first('c.name')
      .catch(() => null);

    // Attendance per academic year: a row belongs to its class's year, else
    // (no class) to the session whose start date it falls on/after.
    const sessions = await db('academic_sessions').where({ tenant_id: tenantId })
      .select('name', 'start_date').orderBy('start_date', 'asc').catch(() => []);
    const yearForDate = (d: Date) => {
      let y: string | null = null;
      for (const s of sessions as any[]) if (s.start_date && new Date(s.start_date) <= d) y = s.name;
      return y ?? (sessions as any[])[0]?.name ?? null;
    };
    const attRows = await db('attendance as a')
      .leftJoin('classes as c', 'a.class_id', 'c.id')
      .leftJoin('academic_sessions as cs', 'c.academic_session_id', 'cs.id')
      .where('a.student_id', student.id)
      .select('a.status', 'a.attendance_date', 'cs.name as year')
      .catch(() => []);
    const byYear = new Map<string, NonNullable<StudentYearHistory['years']>[number]>();
    const yearRow = (y: string) => {
      if (!byYear.has(y)) byYear.set(y, { academic_year: y, attendance: { present: 0, late: 0, absent: 0, excused: 0, rate: null }, fees: { billed: 0, paid: 0, outstanding: 0 } });
      return byYear.get(y)!;
    };
    for (const r of attRows as any[]) {
      const y = r.year || yearForDate(new Date(r.attendance_date));
      if (!y) continue;
      const a = yearRow(y).attendance;
      const st = String(r.status || '').toLowerCase();
      if (st === 'present') a.present++; else if (st === 'late') a.late++;
      else if (st === 'excused') a.excused++; else if (st === 'absent') a.absent++;
    }
    for (const y of byYear.values()) {
      const a = y.attendance;
      const total = a.present + a.late + a.absent + a.excused;
      a.rate = total > 0 ? Math.round(((a.present + a.late + a.excused) / total) * 100) : null;
    }

    // Fees per academic year.
    const feeRows = await db('fees')
      .where({ tenant_id: tenantId, student_id: student.id })
      .whereNot('status', 'deleted')
      .whereNotNull('academic_year')
      .groupBy('academic_year')
      .select('academic_year', db.raw('COALESCE(SUM(amount),0) as billed'), db.raw('COALESCE(SUM(COALESCE(balance, amount)),0) as outstanding'))
      .catch(() => []);
    for (const f of feeRows as any[]) {
      const billed = Number(f.billed) || 0;
      const outstanding = Number(f.outstanding) || 0;
      yearRow(f.academic_year).fees = { billed, outstanding, paid: Math.max(0, billed - outstanding) };
    }
    // Make sure every year the student has any record for is listed.
    for (const e of enrollments as any[]) if (e.academic_year) yearRow(e.academic_year);
    for (const t of terms as any[]) if (t.academic_year) yearRow(t.academic_year);
    for (const r of results as any[]) if (r.academic_year) yearRow(r.academic_year);
    const years = [...byYear.values()].sort((a, b) => b.academic_year.localeCompare(a.academic_year));

    const isoDate = (d: any) => (d ? new Date(d).toISOString().slice(0, 10) : null);
    return {
      student: {
        id: student.id,
        name: student.name || student.student_id,
        admission_no: student.student_id ?? null,
        photo_url: profile?.photo_url ?? null,
        status: profile?.status ?? null,
        gender: profile?.gender ?? null,
        date_of_birth: isoDate(profile?.date_of_birth),
        enrollment_date: isoDate(profile?.enrollment_date),
        current_class: current?.name ?? null,
      },
      years,
      terms: terms.map((t: any) => ({
        academic_year: t.academic_year,
        term: t.term,
        class_name: t.class_name ?? null,
        percentage: t.percentage != null ? Number(t.percentage) : null,
        position: t.position != null ? Number(t.position) : null,
        class_size: t.class_size != null ? Number(t.class_size) : null,
      })),
      enrollments: enrollments.map((e: any) => ({
        class_id: e.class_id ?? null,
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
