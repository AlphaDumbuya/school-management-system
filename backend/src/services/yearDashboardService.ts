/**
 * yearDashboardService — the principal overview, scoped to ONE academic year.
 *
 * Every figure follows the selected year (default: the active one):
 *   students / classes / teachers / enrollment chart → that year's classes
 *   fees billed / collected / outstanding            → fees for that year
 *   attendance rate + trend                          → that year's classes
 *   average grade + performance chart                → results for that year
 * Trends compare against the previous year. Also reports a pending carry-
 * forward (students still sitting in last year's classes) so the principal can
 * finish a year transition from the overview.
 */
import db from '@utils/database';
import dashboardService from '@services/dashboardService';

const startYear = (name?: string | null) => {
  const m = /^(\d{4})\//.exec(String(name || ''));
  return m ? Number(m[1]) : NaN;
};
const num = (v: any) => Number(v) || 0;
const round1 = (n: number) => Math.round(n * 10) / 10;
const ACTIVE = ['active', 'enrolled'];

interface YearScope {
  name: string | null;
  isActive: boolean;
  classIds: string[];
  enrollStatuses: string[] | null; // null = any status (past year)
}

class YearDashboardService {
  private async tenantSessions(tenantId: string) {
    const rows = await db('academic_sessions').where({ tenant_id: tenantId }).select('id', 'name', 'is_active');
    return rows.sort((a: any, b: any) => startYear(b.name) - startYear(a.name));
  }

  /** Classes of a session (plus legacy no-session classes for the active year). */
  private async classIdsFor(tenantId: string, sessionId: string | null, includeNullSession: boolean): Promise<string[]> {
    const rows = await db('classes')
      .leftJoin('users as cc', 'classes.created_by', 'cc.id')
      .where((q) => {
        if (sessionId) q.where('classes.academic_session_id', sessionId);
        if (includeNullSession) {
          q.orWhere((q2) => q2.whereNull('classes.academic_session_id').where('cc.tenant_id', tenantId));
        }
      })
      .select('classes.id');
    return rows.map((r: any) => r.id);
  }

  private async scope(tenantId: string, session: any | null, isActive: boolean): Promise<YearScope> {
    return {
      name: session?.name ?? null,
      isActive,
      classIds: await this.classIdsFor(tenantId, session?.id ?? null, isActive),
      enrollStatuses: isActive ? ACTIVE : null,
    };
  }

  private enrolledStudents(tenantId: string, s: YearScope) {
    const q = db('enrollments')
      .join('students', 'enrollments.student_id', 'students.id')
      .where('students.tenant_id', tenantId)
      .whereIn('enrollments.class_id', s.classIds.length ? s.classIds : ['00000000-0000-0000-0000-000000000000']);
    if (s.enrollStatuses) q.whereIn('enrollments.status', s.enrollStatuses).whereIn('students.status', ACTIVE);
    return q;
  }

  private async countStudents(tenantId: string, s: YearScope) {
    const r = await this.enrolledStudents(tenantId, s).countDistinct('students.id as n').first();
    return num(r?.n);
  }

  private async countTeachers(tenantId: string, s: YearScope) {
    if (s.isActive) {
      // Current year = everyone on staff now (reflects role/status changes live).
      const r = await db('teachers').join('users', 'teachers.user_id', 'users.id')
        .where({ 'teachers.status': 'active', 'users.status': 'active', 'users.tenant_id': tenantId })
        .count('* as n').first();
      return num(r?.n);
    }
    if (!s.classIds.length) return 0;
    const assigned = await db('teacher_assignments').whereIn('class_id', s.classIds).distinct('teacher_id');
    const led = await db('classes').whereIn('id', s.classIds).whereNotNull('class_teacher_id').distinct('class_teacher_id as teacher_id');
    return new Set([...assigned, ...led].map((r: any) => r.teacher_id)).size;
  }

  private feesFor(tenantId: string, s: YearScope) {
    return db('fees')
      .join('students', 'fees.student_id', 'students.id')
      .where('students.tenant_id', tenantId)
      .whereNot('fees.status', 'deleted')
      .where((q) => {
        if (s.name) q.where('fees.academic_year', s.name);
        if (s.classIds.length) q.orWhere((q2) => q2.whereNull('fees.academic_year').whereIn('fees.class_id', s.classIds));
      });
  }

  private async fees(tenantId: string, s: YearScope) {
    if (!s.name && !s.classIds.length) return { billed: 0, collected: 0, outstanding: 0, adjusted: 0, overdue: 0 };
    const r: any = await this.feesFor(tenantId, s)
      .select(
        db.raw('COALESCE(SUM(fees.amount),0) as billed'),
        db.raw('COALESCE(SUM(fees.balance),0) as outstanding'),
        db.raw("COALESCE(SUM(CASE WHEN fees.due_date < NOW() AND fees.status IN ('pending','partial','overdue') THEN fees.balance ELSE 0 END),0) as overdue"),
      ).first();
    const billed = num(r?.billed);
    const outstanding = num(r?.outstanding);
    // Discounts, waivers and applied credit reduce what's owed but aren't cash collected.
    const a: any = await db('fee_adjustments as fa').whereNull('fa.reversed_at')
      .whereIn('fa.fee_id', this.feesFor(tenantId, s).select('fees.id'))
      .first(db.raw('COALESCE(SUM(fa.amount),0) as adjusted')).catch(() => null);
    const adjusted = num(a?.adjusted);
    return { billed, outstanding, adjusted, collected: Math.max(0, billed - outstanding - adjusted), overdue: num(r?.overdue) };
  }

  private async attendance(tenantId: string, s: YearScope) {
    if (!s.classIds.length) return { rate: 0, trend: { labels: [] as string[], datasets: [] as any[] } };
    const base = () => db('attendance')
      .join('students', 'attendance.student_id', 'students.id')
      .where('students.tenant_id', tenantId)
      .whereIn('attendance.class_id', s.classIds);
    const tot: any = await base()
      .select(db.raw('COUNT(*) as total'), db.raw("SUM(CASE WHEN attendance.status IN ('present','late') THEN 1 ELSE 0 END) as present"))
      .first();
    // Latest 30 recorded days of THAT year (works for past years too).
    const days = await base()
      .select(
        db.raw('attendance.attendance_date::date as d'),
        db.raw('COUNT(*) as total'),
        db.raw("SUM(CASE WHEN attendance.status IN ('present','late') THEN 1 ELSE 0 END) as present"),
      )
      .groupByRaw('attendance.attendance_date::date')
      .orderBy('d', 'desc')
      .limit(30);
    days.reverse();
    const total = num(tot?.total);
    return {
      rate: total ? round1((num(tot?.present) / total) * 100) : 0,
      trend: days.length ? {
        labels: days.map((r: any) => new Date(r.d).toISOString().slice(5, 10)),
        datasets: [{
          label: 'Attendance Rate %',
          data: days.map((r: any) => (num(r.total) ? Math.round((num(r.present) / num(r.total)) * 100) : 0)),
          borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true,
        }],
      } : { labels: [], datasets: [] },
    };
  }

  private async grades(tenantId: string, s: YearScope) {
    if (!s.name) return { average: 0, chart: { labels: [] as string[], datasets: [] as any[] } };
    const avg: any = await db('sl_subject_results').where({ tenant_id: tenantId, academic_year: s.name })
      .whereNotNull('mean').avg('mean as a').first();
    const rows = await db('sl_subject_results')
      .join('classes', 'sl_subject_results.class_id', 'classes.id')
      .where({ 'sl_subject_results.tenant_id': tenantId, 'sl_subject_results.academic_year': s.name })
      .whereNotNull('sl_subject_results.mean')
      .select('classes.name').avg('sl_subject_results.mean as a')
      .groupBy('classes.id', 'classes.name').orderBy('classes.name').limit(20);
    return {
      average: round1(num(avg?.a)),
      chart: rows.length ? {
        labels: rows.map((r: any) => r.name),
        datasets: [{ label: 'Average Grade', data: rows.map((r: any) => round1(num(r.a))), borderColor: '#2563EB', backgroundColor: 'rgba(37, 99, 235, 0.1)' }],
      } : { labels: [], datasets: [] },
    };
  }

  private async distribution(tenantId: string, s: YearScope) {
    if (!s.classIds.length) return { labels: [], datasets: [] };
    const rows = await this.enrolledStudents(tenantId, s)
      .join('classes', 'enrollments.class_id', 'classes.id')
      .select('classes.name').countDistinct('students.id as n')
      .groupBy('classes.name').orderBy('n', 'desc');
    return {
      labels: rows.map((r: any) => r.name),
      datasets: [{
        label: 'Students per Class',
        data: rows.map((r: any) => num(r.n)),
        backgroundColor: ['rgba(37, 99, 235, 0.8)', 'rgba(16, 185, 129, 0.8)', 'rgba(245, 158, 11, 0.8)', 'rgba(239, 68, 68, 0.8)', 'rgba(139, 92, 246, 0.8)', 'rgba(14, 165, 233, 0.8)'],
      }],
    };
  }

  private async atRisk(tenantId: string, s: YearScope) {
    if (!s.classIds.length || !s.isActive) return [];
    const warnRow = await db('school_config_settings').where({ tenant_id: tenantId, setting_key: 'min_attendance_warning' }).first();
    const warn = num(warnRow?.setting_value) > 0 ? num(warnRow?.setting_value) : 75;
    const students = await this.enrolledStudents(tenantId, s)
      .join('classes', 'enrollments.class_id', 'classes.id')
      .leftJoin('users', 'students.user_id', 'users.id')
      .distinct('students.id', 'students.student_id', 'classes.name as class_name',
        db.raw("TRIM(COALESCE(students.first_name, users.first_name, '') || ' ' || COALESCE(students.last_name, users.last_name, '')) as name"));
    if (!students.length) return [];
    const ids = students.map((r: any) => r.id);
    const att = await db('attendance').whereIn('student_id', ids).whereIn('class_id', s.classIds)
      .select('student_id', db.raw('COUNT(*) as t'), db.raw("SUM(CASE WHEN status IN ('present','late') THEN 1 ELSE 0 END) as p"))
      .groupBy('student_id');
    const gr = s.name
      ? await db('sl_subject_results').where({ tenant_id: tenantId, academic_year: s.name }).whereIn('student_id', ids)
          .whereNotNull('mean').select('student_id').avg('mean as a').groupBy('student_id')
      : [];
    const attMap = new Map(att.map((r: any) => [r.student_id, num(r.t) ? (num(r.p) / num(r.t)) * 100 : 100]));
    const grMap = new Map(gr.map((r: any) => [r.student_id, num(r.a)]));
    return students
      .map((st: any) => {
        const attendanceRate = round1(attMap.get(st.id) ?? 100);
        const averageGrade = round1(grMap.get(st.id) ?? 100);
        const riskFactors = [
          ...(grMap.has(st.id) && averageGrade < 40 ? ['Low Grades'] : []),
          ...(attMap.has(st.id) && attendanceRate < warn ? ['Low Attendance'] : []),
        ];
        return {
          id: st.id, name: st.name, rollNumber: st.student_id || '', className: st.class_name || '',
          riskFactors, attendanceRate, averageGrade, lastActivity: new Date().toISOString(),
          severity: (riskFactors.length === 2 ? 'high' : 'medium') as 'high' | 'medium',
        };
      })
      .filter((r) => r.riskFactors.length)
      .sort((a, b) => b.riskFactors.length - a.riskFactors.length || a.attendanceRate - b.attendanceRate)
      .slice(0, 10);
  }

  /** Real recent events for the school (newest first). */
  private async recentActivity(tenantId: string) {
    const [students, payments, announcements] = await Promise.all([
      db('students').where({ tenant_id: tenantId }).orderBy('created_at', 'desc').limit(4)
        .select('id', 'first_name', 'last_name', 'created_at'),
      db('payments').join('students', 'payments.student_id', 'students.id').where('students.tenant_id', tenantId)
        .orderBy('payments.created_at', 'desc').limit(4)
        .select('payments.id', 'payments.amount', 'payments.created_at', 'students.first_name', 'students.last_name'),
      db('announcements').where({ tenant_id: tenantId }).orderBy('created_at', 'desc').limit(3)
        .select('id', 'title', 'created_at').catch(() => []),
    ]);
    const items = [
      ...students.map((r: any) => ({ id: `s-${r.id}`, kind: 'student', title: 'New student added', sub: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim(), at: r.created_at })),
      ...payments.map((r: any) => ({ id: `p-${r.id}`, kind: 'payment', title: 'Fee payment received', sub: `SLE ${num(r.amount).toLocaleString()} – ${`${r.first_name ?? ''} ${r.last_name ?? ''}`.trim()}`, at: r.created_at })),
      ...(announcements as any[]).map((r: any) => ({ id: `a-${r.id}`, kind: 'announcement', title: 'Announcement posted', sub: r.title, at: r.created_at })),
    ];
    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 6);
  }

  async getDashboard(tenantId: string, requestedYear?: string) {
    const sessions = await this.tenantSessions(tenantId);
    const active = sessions.find((s: any) => s.is_active) || null;
    const chosen = (requestedYear && sessions.find((s: any) => s.name === requestedYear)) || active || sessions[0] || null;
    const isActive = !chosen || chosen.id === active?.id;
    const cur = await this.scope(tenantId, chosen, isActive);

    const prevSession = chosen ? sessions.find((s: any) => startYear(s.name) < startYear(chosen.name)) : null;
    const prev = prevSession ? await this.scope(tenantId, prevSession, false) : null;

    const [students, teachers, fees, att, grades, distribution, atRisk, prevStudents, prevTeachers, alerts, systemHealth, activity] = await Promise.all([
      this.countStudents(tenantId, cur),
      this.countTeachers(tenantId, cur),
      this.fees(tenantId, cur),
      this.attendance(tenantId, cur),
      this.grades(tenantId, cur),
      this.distribution(tenantId, cur),
      this.atRisk(tenantId, cur),
      prev ? this.countStudents(tenantId, prev) : Promise.resolve(null),
      prev ? this.countTeachers(tenantId, prev) : Promise.resolve(null),
      dashboardService.getDashboardAlerts(tenantId).catch(() => []),
      dashboardService.getSystemHealth(tenantId).catch(() => null),
      this.recentActivity(tenantId).catch(() => []),
    ]);
    const prevClasses = prev ? prev.classIds.length : null;

    // Year transition not finished: active students still in an older year's classes.
    let pendingCarryForward: { fromYear: string; students: number } | null = null;
    if (isActive && prevSession) {
      const left = await this.countStudents(tenantId, { ...prev!, enrollStatuses: ACTIVE });
      if (left > 0) pendingCarryForward = { fromYear: prevSession.name, students: left };
    }

    const pct = (a: number, b: number | null) => (b && b > 0 ? round1(((a - b) / b) * 100) : null);
    const thisMonth: any = isActive
      ? await db('payments').join('students', 'payments.student_id', 'students.id')
          .where('students.tenant_id', tenantId).where('payments.status', 'completed')
          .whereRaw("DATE_TRUNC('month', payments.payment_date) = DATE_TRUNC('month', CURRENT_DATE)")
          .sum('payments.amount as t').first()
      : null;

    return {
      academicYear: {
        name: cur.name,
        isActive,
        activeYear: active?.name ?? null,
        previousYear: prevSession?.name ?? null,
        years: sessions.map((s: any) => s.name),
        pendingCarryForward,
      },
      metrics: {
        totalStudents: students,
        activeStudents: students,
        totalTeachers: teachers,
        totalClasses: cur.classIds.length,
        totalStaff: teachers,
        totalEnrollments: students,
        outstandingFees: fees.outstanding,
        totalCollected: fees.collected,
        attendanceRate: att.rate,
        averageGrade: grades.average,
        classroomsInUse: cur.classIds.length,
      },
      trends: {
        students: pct(students, prevStudents),
        teachers: pct(teachers, prevTeachers),
        classes: pct(cur.classIds.length, prevClasses),
      },
      financialSummary: {
        totalRevenue: fees.collected,
        totalBilled: fees.billed,
        thisMonthCollected: num(thisMonth?.t),
        thisMonthTarget: 0,
        outstandingBalance: fees.outstanding,
        overdueAmount: fees.overdue,
        collectionRate: fees.billed ? round1((fees.collected / fees.billed) * 100) : 0,
        trend: 0,
        pendingFees: 0,
        partiallyPaid: 0,
      },
      atRiskStudents: atRisk,
      alerts,
      systemHealth,
      recentActivity: activity,
      charts: {
        academicPerformance: grades.chart,
        attendanceTrend: att.trend,
        feeCollection: { labels: [], datasets: [] },
        studentDistribution: distribution,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

export default new YearDashboardService();
