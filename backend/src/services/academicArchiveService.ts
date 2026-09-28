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
  classes: Array<{ id: string; name: string; level: string | null; section: string | null; enrolled: number }>;
  publications: any[];
  promotions: any[];
  examinations: any[];
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
            .whereIn('status', ['enrolled', 'active', 'promoted'])
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
        .where('academic_session_id', sessionId)
        .whereIn('status', ['enrolled', 'active', 'promoted'])
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
      classes,
      publications,
      promotions,
      examinations,
    };
  }
}

export default new AcademicArchiveService();
