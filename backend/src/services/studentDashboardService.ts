/**
 * Student Dashboard Service
 * =========================
 * Real, tenant + student-scoped data for the student portal dashboard.
 * A student only ever sees THEIR OWN data:
 *   - Profile (name, class, admission no.)
 *   - KPI stats (attendance rate, average grade, today's classes, outstanding fees)
 *   - Published grades (SL subject results for that year's class)
 *   - Attendance summary + recent records (that year)
 *   - Today's schedule + weekly timetable (current year only)
 *   - Fees (invoices + outstanding balance — account-level, every year)
 *
 * Year-aware: `academicYear` picks the year (default = the school's ACTIVE
 * year). The class shown is the student's class OF THAT YEAR (historic
 * enrolment statuses for a past year), so a promoted student can look back at
 * last year as read-only history. Right after a rollover, before the
 * principal moves the student into this year's class, `pending_transition`
 * says so instead of passing last year's class off as current.
 */

import db from '../utils/database.js';
import { logger } from '../utils/logger.js';
import { normalizeAcademicYear, resolveActiveYear, resolveYearScope, applyYearScope } from '../utils/academicYear.js';
import { tenantTimezone } from '../utils/schoolDate.js';
import { studentYearScope } from '../utils/studentScope.js';

/** Lower-case weekday name ("monday") for "now" in the school's timezone. */
async function schoolWeekday(tenantId: string): Promise<string> {
  const tz = await tenantTimezone(tenantId);
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(new Date()).toLowerCase();
  } catch {
    return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()];
  }
}

const EMPTY_STATS = { attendance_rate: 0, average_grade: 0, classes_today: 0, outstanding_fees: 0 };
const EMPTY_ATTENDANCE = { present: 0, absent: 0, late: 0, excused: 0, total: 0, percentage: 0, records: [] as any[] };

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

  /**
   * One year of a student's portal data. Normally resolved from the student's
   * own login (`userId`). The parent portal passes `opts.studentId` (already
   * verified as their child) to get exactly the same year-, multi-class-,
   * promotion- and graduation-aware view for each child.
   */
  async getDashboard(
    userId: string,
    tenantId: string,
    requestedYear?: string | null,
    opts: { studentId?: string; fullAttendance?: boolean; term?: string | null } = {},
  ): Promise<any> {
    try {
      const { yearString: activeYear } = await resolveActiveYear(tenantId);
      const wanted = normalizeAcademicYear(requestedYear || '') || activeYear;
      const sessions = await db('academic_sessions').where({ tenant_id: tenantId }).select('id', 'name', 'is_active');
      const session = (sessions.find((s: any) => normalizeAcademicYear(s.name) === wanted) as any) ?? null;
      const viewingPast = !!session && !session.is_active;
      const yearMeta = { academic_year: wanted, active_year: activeYear, viewing_past: viewingPast, year_exists: !!session };

      const student = opts.studentId
        ? await db('students').where({ id: opts.studentId, tenant_id: tenantId }).first()
        : await this.getStudent(userId, tenantId);
      if (!student) {
        return {
          ...yearMeta,
          student_profile_missing: true,
          profile: null,
          stats: EMPTY_STATS,
          grades: [],
          attendance: EMPTY_ATTENDANCE,
          today_schedule: [],
          weekly_schedule: [],
          fees: { total: 0, paid: 0, outstanding: 0, invoices: [] },
          pending_transition: null,
          enrolled_in_year: false,
        };
      }

      // Every class that year (shared helper), newest first, and any
      // unfinished rollover (still active in last year's class).
      const scope = await studentYearScope(tenantId, student.id, wanted);
      const yearClasses = scope.classes;
      // The class shown in the header = the latest one that year.
      const yearClass = yearClasses[0] ?? null;
      const classId: string | null = yearClass?.id ?? null;
      const pendingTransition = scope.pendingTransition
        ? { fromYear: scope.pendingTransition.fromYear, className: scope.pendingTransition.className }
        : null;

      // ── Grades: RELEASED results from every class the student had that year.
      //    Each class has its own publish state, so gate per class: a student
      //    must never see unpublished scores. ─────────────────────────────────
      let academicYear: string | null = wanted;
      let grades: any[] = [];
      let averageGrade = 0;
      let resultsPublished = false;
      if (yearClasses.length) {
        const { default: slReportCardService } = await import('./slReportCardService.js');
        for (const cls of yearClasses) {
          const clsYear = await slReportCardService
            .resolveClassAcademicYear(tenantId, cls.id, wanted)
            .catch(() => wanted);
          if (cls.id === classId) academicYear = clsYear;
          const { terms: releasedTerms, wholeYear } = await slReportCardService
            .getPublishedTerms(tenantId, cls.id, clsYear || wanted)
            .catch(() => ({ terms: [] as string[], wholeYear: false }));
          if (!wholeYear && releasedTerms.length === 0) continue;
          resultsPublished = true;

          let gq = db('sl_subject_results as sr')
            .join('subjects as s', 'sr.subject_id', 's.id')
            .where('sr.tenant_id', tenantId)
            .where('sr.student_id', student.id)
            .where('sr.class_id', cls.id)
            .where('sr.academic_year', clsYear);
          if (!wholeYear) gq = gq.whereIn('sr.term', releasedTerms);

          const rows = await gq
            .select('sr.id', 's.name as subject_name', 's.code as subject_code', 'sr.term', 'sr.test1', 'sr.test2', 'sr.mean', 'sr.subject_rank')
            .orderBy('s.name', 'asc')
            .catch(() => []);
          // class_id + class_year let the Results page rank within the class
          // the result was actually recorded in (a year can hold several).
          grades.push(...(rows as any[]).map((r) => ({ ...r, class_id: cls.id, class_name: cls.name, class_year: clsYear || wanted, year_released: wholeYear })));
        }
        // Term order, then subject.
        const TERM_ORDER: Record<string, number> = { first_term: 1, second_term: 2, third_term: 3 };
        grades.sort((a, b) => (TERM_ORDER[a.term] ?? 9) - (TERM_ORDER[b.term] ?? 9) || String(a.subject_name).localeCompare(String(b.subject_name)));
        const means = grades.map((g) => Number(g.mean)).filter((n) => !isNaN(n) && n > 0);
        if (means.length) averageGrade = Math.round((means.reduce((a, b) => a + b, 0) / means.length) * 10) / 10;
      }

      // ── Attendance for the selected year ─────────────────────────────────
      // That year's classes (else class-less rows dated inside the year).
      const yearScope = session ? await resolveYearScope(tenantId, wanted) : null;
      // Optional single term (same dates as the report card).
      const { normalizeTerm, resolveTermWindows, applyDateWindow } = await import('../utils/termWindows.js');
      const termKey = normalizeTerm(opts.term);
      const termWindow = termKey ? (await resolveTermWindows(tenantId, wanted))?.[termKey] ?? null : null;
      const attendanceRows = session
        ? await applyDateWindow(applyYearScope(
            db('attendance').where('student_id', student.id),
            yearScope, 'class_id', 'attendance_date',
          ), 'attendance_date', termWindow)
            .orderBy('attendance_date', 'desc')
            .select('id', 'attendance_date', 'status', 'class_id', 'session_type', 'check_in_time', 'check_out_time', 'marked_at', 'remarks')
            .catch(() => [])
        : [];

      // Count by DISTINCT DAY (several sessions = one day), classified by the
      // best status that day: present > excused > late > absent. Present,
      // excused and late all count as attended (matches the report card).
      const dayRank = new Map<string, number>();
      const RANK: Record<string, number> = { present: 4, excused: 3, late: 2, absent: 1 };
      for (const a of attendanceRows as any[]) {
        // DATE columns come back as local-midnight Dates: key by local parts
        // (toISOString could shift the day).
        const d = a.attendance_date;
        const key = d instanceof Date
          ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          : String(d).slice(0, 10);
        const rank = RANK[(a.status || '').toLowerCase()] ?? 0;
        dayRank.set(key, Math.max(dayRank.get(key) ?? 0, rank));
      }
      let present = 0, absent = 0, late = 0, excused = 0;
      for (const rank of dayRank.values()) {
        if (rank === 4) present++;
        else if (rank === 3) excused++;
        else if (rank === 2) late++;
        else if (rank === 1) absent++;
      }
      const totalAtt = present + excused + late + absent;
      const attendanceRate = totalAtt > 0 ? Math.round(((present + excused + late) / totalAtt) * 100) : 0;

      // The dashboard shows the latest 10; the parent's attendance page wants the year's full list.
      const recentAttendance = (opts.fullAttendance ? (attendanceRows as any[]) : (attendanceRows as any[]).slice(0, 10)).map((a) => ({
        id: a.id,
        date: a.attendance_date,
        status: (a.status || '').toLowerCase(),
        session_type: a.session_type,
        check_in_time: a.check_in_time,
        check_out_time: a.check_out_time,
        marked_at: a.marked_at,
        remarks: a.remarks || null,
      }));

      // ── Timetable for that year's class; "today" only in the current year ─
      let todaySchedule: any[] = [];
      let weeklySchedule: any[] = [];
      // The timetable of the latest class that year that HAS one (e.g. a
      // promoted student's new class may have no timetable yet).
      let timetableClass: any = null;
      for (const cls of yearClasses) {
        const has = await db('schedules').where('class_id', cls.id).first('id').catch(() => null);
        if (has) { timetableClass = cls; break; }
      }
      if (timetableClass) {
        const allSchedule = await db('schedules as sc')
          .leftJoin('subjects as s', 'sc.subject_id', 's.id')
          .leftJoin('teachers as t', 'sc.teacher_id', 't.id')
          .leftJoin('users as tu', 't.user_id', 'tu.id')
          .where('sc.class_id', timetableClass.id)
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

        if (!viewingPast) {
          const todayName = await schoolWeekday(tenantId);
          todaySchedule = weeklySchedule.filter((r) => (r.day_of_week || '').toLowerCase() === todayName);
        }
      }

      // ── Fees for the selected year ───────────────────────────────────────
      // An invoice belongs to its academic_year; older invoices without one
      // are placed by their issue date inside the year's window. Unpaid
      // balances from OTHER years are reported separately as arrears (still
      // payable), never mixed into this year's figures.
      const allInvoices = await db('invoices')
        .where('student_id', student.id)
        .where('tenant_id', tenantId)
        .orderBy('due_date', 'desc')
        .select('id', 'invoice_number', 'total_amount', 'total_paid', 'balance', 'due_date', 'status', 'academic_year', 'generated_at', 'created_at')
        .catch(() => []);
      const inSelectedYear = (inv: any): boolean => {
        const y = normalizeAcademicYear(inv.academic_year || '');
        if (y) return y === wanted;
        if (!yearScope) return false;
        const issued = new Date(inv.generated_at || inv.created_at);
        if (Number.isNaN(issued.getTime())) return false;
        return (!yearScope.from || issued >= yearScope.from) && (!yearScope.to || issued < yearScope.to);
      };
      const invoices = (allInvoices as any[]).filter(inSelectedYear);
      const otherYearsOutstanding = (allInvoices as any[])
        .filter((inv) => !inSelectedYear(inv))
        .reduce((s, inv) => s + Math.max(0, Number(inv.balance || 0)), 0);

      // Billed / paid / outstanding come from the finance LEDGER (the `fees`
      // projection staff reports use), so the KPI, the fees chart and the Fees
      // tab ledger always agree. Invoices above are just the payable documents.
      let feeTotal = 0, feePaid = 0, feeOutstanding = 0, feeDiscounted = 0, ledgerOtherYears = 0;
      // Per-year unpaid balances from OTHER years, so the UI can name them.
      const otherYears: { academic_year: string; outstanding: number }[] = [];
      let ledgerOk = false;
      try {
        const { default: financeLedgerService } = await import('./financeLedgerService.js');
        const ledger: any = await financeLedgerService.getStudentLedger(tenantId, student.id);
        for (const y of ledger?.years ?? []) {
          if (normalizeAcademicYear(y.academic_year) === wanted) {
            feeTotal += Number(y.billed || 0);
            feePaid += Number(y.paid || 0);
            feeOutstanding += Number(y.outstanding || 0);
            // Discounts / scholarships and applied credit: off the fees, not cash paid.
            feeDiscounted += Number(y.discounted || 0) + Number(y.credit_applied || 0);
          } else {
            const owed = Math.max(0, Number(y.outstanding || 0));
            ledgerOtherYears += owed;
            if (owed > 0) otherYears.push({ academic_year: normalizeAcademicYear(y.academic_year) || String(y.academic_year), outstanding: Math.round(owed * 100) / 100 });
          }
        }
        ledgerOk = true;
      } catch (e) {
        logger.warn(`Student dashboard: ledger unavailable, falling back to invoices: ${(e as any)?.message || e}`);
      }
      if (!ledgerOk) {
        for (const inv of invoices) {
          feeTotal += Number(inv.total_amount || 0);
          feePaid += Number(inv.total_paid || 0);
          feeOutstanding += Number(inv.balance || 0);
        }
      }
      const arrears = ledgerOk ? ledgerOtherYears : otherYearsOutstanding;

      return {
        ...yearMeta,
        enrolled_in_year: !!classId,
        pending_transition: pendingTransition,
        // Finished SSS 3 and left the school (no class from then on).
        graduated: scope.graduated,
        // Every class that year (newest first) and the one the timetable is for.
        year_classes: yearClasses.map((c: any) => ({ id: c.id, name: c.name, status: c.enrollment_status })),
        timetable_class: timetableClass ? { id: timetableClass.id, name: timetableClass.name } : null,
        profile: {
          id: student.id,
          admission_no: student.student_id,
          first_name: student.first_name,
          last_name: student.last_name,
          full_name: `${student.first_name || ''} ${student.last_name || ''}`.trim(),
          photo_url: student.photo_url || null,
          class_id: classId,
          class_name: yearClass?.name || null,
          class_level: yearClass?.level || null,
          class_section: yearClass?.section || null,
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
          discounted: Math.round(feeDiscounted * 100) / 100,
          outstanding: Math.round(feeOutstanding * 100) / 100,
          // Unpaid balance from other academic years (still payable).
          other_years_outstanding: Math.round(arrears * 100) / 100,
          other_years: otherYears.sort((a, b) => a.academic_year.localeCompare(b.academic_year)),
          invoices: invoices.map(({ generated_at, created_at, ...rest }: any) => rest),
        },
      };
    } catch (error) {
      logger.error('Error building student dashboard:', error);
      throw error;
    }
  }
}

export default new StudentDashboardService();
