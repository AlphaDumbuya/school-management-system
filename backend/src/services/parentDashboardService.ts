/**
 * Parent Dashboard Service
 * =========================
 * Real, tenant + parent-scoped data for the parent portal.
 * A parent only ever sees THEIR OWN children:
 *   - Children resolved via guardians.user_id/email, with a narrow legacy
 *     registration-email fallback. Names alone are not proof of guardianship.
 *   - Every child is resolved INDEPENDENTLY for the selected academic year
 *     with the student portal's own logic (studentDashboardService): their
 *     class(es) that year, released results only, that year's attendance and
 *     fees (plus earlier years still owed). So siblings in different classes,
 *     a child promoted mid-year, a graduated child and a child not yet moved
 *     into the new year are each shown correctly, and a promotion shows up on
 *     the next load.
 *   - Aggregate KPIs across the children who were at school that year.
 */

import db from '../utils/database.js';
import { logger } from '../utils/logger.js';

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

  /**
   * A child's view for ONE academic year (default = the active year), built by
   * the same code as the student portal, so it's per-class, published-only,
   * promotion-aware (every class that year, last year as history) and
   * graduation-aware. Each child is resolved independently: siblings can be in
   * different classes, one promoted mid-year, one graduated, one not yet moved
   * into the new year.
   */
  private async childYear(student: any, tenantId: string, year?: string | null, fullAttendance = false): Promise<any> {
    const { default: studentDashboardService } = await import('./studentDashboardService.js');
    return studentDashboardService.getDashboard('', tenantId, year ?? null, { studentId: student.id, fullAttendance });
  }

  /** Summary card for one child in one year. */
  private async childYearSummary(student: any, tenantId: string, year?: string | null) {
    const d = await this.childYear(student, tenantId, year);
    const yearClasses: { id: string; name: string }[] = d?.year_classes ?? [];
    const thisYear = Number(d?.fees?.outstanding || 0);
    const otherYears = Number(d?.fees?.other_years_outstanding || 0);
    return {
      id: student.id,
      admission_no: student.student_id,
      name: `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.student_id,
      photo_url: student.photo_url || null,
      // The latest class that year (a promoted child's new class).
      class_id: d?.profile?.class_id ?? null,
      class_name: d?.profile?.class_name ?? null,
      class_level: d?.profile?.class_level ?? null,
      /** Every class the child had that year, newest first. */
      year_classes: yearClasses.map((c) => ({ id: c.id, name: c.name })),
      academic_year: d?.academic_year ?? null,
      enrolled_in_year: !!d?.enrolled_in_year,
      pending_transition: d?.pending_transition ?? null,
      graduated: d?.graduated ?? null,
      attendance_rate: Number(d?.stats?.attendance_rate || 0),
      average_grade: Number(d?.stats?.average_grade || 0),
      results_published: !!d?.results_published,
      /** That year's unpaid fees. */
      outstanding_fees: Math.round(thisYear * 100) / 100,
      /** Unpaid fees from OTHER years (still owed), per year. */
      other_years_outstanding: Math.round(otherYears * 100) / 100,
      other_years: d?.fees?.other_years ?? [],
      /** Everything this child still owes, all years. */
      total_owed: Math.round((thisYear + otherYears) * 100) / 100,
    };
  }

  async getDashboard(userId: string, tenantId: string, requestedYear?: string | null): Promise<any> {
    try {
      const { resolveActiveYear, normalizeAcademicYear } = await import('../utils/academicYear.js');
      const { yearString: activeYear } = await resolveActiveYear(tenantId);
      const year = normalizeAcademicYear(requestedYear || '') || activeYear;
      const students = await this.resolveChildren(userId, tenantId);
      if (students.length === 0) {
        return {
          academic_year: year, active_year: activeYear, viewing_past: year !== activeYear,
          no_children: true,
          children: [],
          stats: { total_children: 0, total_outstanding: 0, total_owed: 0, average_attendance: 0, average_grade: 0 },
        };
      }

      // Every linked child, each resolved on their own for this year.
      const children: any[] = [];
      for (const s of students) {
        children.push(await this.childYearSummary(s, tenantId, year));
      }

      // Averages only over children who were actually at school that year.
      const inYear = children.filter((c) => c.enrolled_in_year);
      const attRates = inYear.map((c) => c.attendance_rate).filter((n) => n > 0);
      const gradeRates = inYear.map((c) => c.average_grade).filter((n) => n > 0);
      const avgAtt = attRates.length ? Math.round(attRates.reduce((a, b) => a + b, 0) / attRates.length) : 0;
      const avgGrade = gradeRates.length ? Math.round((gradeRates.reduce((a, b) => a + b, 0) / gradeRates.length) * 10) / 10 : 0;
      const sum = (k: string) => Math.round(children.reduce((t, c) => t + Number(c[k] || 0), 0) * 100) / 100;

      return {
        academic_year: year,
        active_year: activeYear,
        viewing_past: !!activeYear && year !== activeYear,
        children,
        stats: {
          total_children: children.length,
          /** Children with a class in this year (excludes graduated / not enrolled). */
          children_in_year: inYear.length,
          /** This year's unpaid fees across children. */
          total_outstanding: sum('outstanding_fees'),
          /** Earlier years' unpaid fees across children (still owed). */
          other_years_outstanding: sum('other_years_outstanding'),
          /** Everything owed across all children and years. */
          total_owed: sum('total_owed'),
          average_attendance: avgAtt,
          average_grade: avgGrade,
        },
      };
    } catch (error) {
      logger.error('Error building parent dashboard:', error);
      throw error;
    }
  }

  /**
   * Detailed per-child view for ONE academic year: grades (released only,
   * every class that year), attendance (that year), timetable and fees. Same
   * data as the child's own student portal, plus `schedule` / `profile.name`
   * for the parent page.
   */
  async getChildDetail(userId: string, tenantId: string, studentId: string, requestedYear?: string | null): Promise<any> {
    // Verify the child belongs to this parent (tenant + linkage).
    const students = await this.resolveChildren(userId, tenantId);
    const student = students.find((s) => String(s.id) === String(studentId));
    if (!student) {
      throw new Error('You can only view your own child\'s records');
    }
    const d = await this.childYear(student, tenantId, requestedYear, true);
    return {
      ...d,
      profile: { ...(d?.profile ?? {}), name: d?.profile?.full_name ?? `${student.first_name || ''} ${student.last_name || ''}`.trim() },
      schedule: d?.weekly_schedule ?? [],
    };
  }
}

export default new ParentDashboardService();
