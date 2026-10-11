/**
 * Sierra Leone Report Card Routes
 * Mounted at /api/v1/report-cards
 *
 * Implements the real SL booklet grade-entry and report-generation flow.
 * All routes are tenant-scoped (service enforces tenant on every query).
 */

import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { authenticate, authorize, attachUserContext } from '../middleware/authMiddleware.js';
import { UserRole } from '../types/auth.js';
import { logger } from '../utils/logger.js';
import slReportCardService, {
  AFFECTIVE_TRAITS,
  PSYCHOMOTOR_SKILLS,
  CONDUCT_LEGEND,
  SL_TERMS,
  PUBLISH_GATED_ROLES,
} from '../services/slReportCardService.js';
import { renderReportCardHtml, renderTermResultSheetHtml, imposeBooklet, type BorderStyleConfig } from '../services/slReportCardHtml.js';
import { htmlToPdf } from '../utils/pdfBrowser.js';
import { getTenantGradingScale } from '../utils/gradingScaleHelper.js';
import db from '../utils/database.js';
import { normalizeAcademicYear, resolveActiveYear } from '../utils/academicYear.js';

const router = Router();

router.use(authenticate);
router.use(attachUserContext);
// One spelling of the year everywhere ("2026/2027"), however the page sent it
// ("2026/2027 Academic Year", "2026-2027"…). Otherwise one year's scores could
// be saved under two keys and split rankings, positions and publication.
router.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.body && typeof req.body.academic_year === 'string') req.body.academic_year = normalizeAcademicYear(req.body.academic_year);
  if (typeof req.query.academic_year === 'string') (req.query as any).academic_year = normalizeAcademicYear(req.query.academic_year as string);
  if (typeof req.query.y === 'string') (req.query as any).y = normalizeAcademicYear(req.query.y as string);
  next();
});

function tenant(req: Request): string {
  const t = req.user?.tenant_id;
  if (!t) throw Object.assign(new Error('Tenant context is required'), { status: 400 });
  return t;
}

// ── Reference data (legend/traits/terms) ────────────────────────────────────

router.get('/config', authenticate, async (req: Request, res: Response) => {
  const tenantId = tenant(req);
  const gradingScale = await getTenantGradingScale(tenantId);

  res.json({
    success: true,
    data: {
      terms: SL_TERMS,
      affective_traits: AFFECTIVE_TRAITS,
      psychomotor_skills: PSYCHOMOTOR_SKILLS,
      conduct_legend: CONDUCT_LEGEND,
      grading_method: gradingScale.grades.map((g) => ({
        letter: g.grade,
        remark: g.description || '',
        min: g.min_score,
        max: g.max_score,
      })),
    },
  });
});

// ── Score grid (entry screen) ───────────────────────────────────────────────

/**
 * GET /grid?class_id&subject_id&term&academic_year
 * Returns each student in the class with their existing Test1/Test2/mean.
 */
router.get('/grid', authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.TEACHER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { class_id, subject_id, term, academic_year } = req.query;
    if (!class_id || !subject_id || !term || !academic_year) {
      return res.status(400).json({ success: false, error: 'class_id, subject_id, term, academic_year are required' });
    }
    // Unpublished scores: staff only, and a teacher only for the subjects they
    // teach in that class (a class teacher may see every subject of the class).
    await slReportCardService.assertTeacherScope(req.user!.id, tenant(req), req.user!.role, class_id as string, subject_id as string);
    const grid = await slReportCardService.getClassSubjectGrid(
      tenant(req),
      class_id as string,
      subject_id as string,
      term as string,
      academic_year as string,
    );
    res.json({ success: true, data: grid });
  } catch (error: any) {
    if (error?.message?.includes('assigned') || error?.message?.includes('authorized') || error?.message?.includes('Teacher profile')) {
      return res.status(403).json({ success: false, error: error.message });
    }
    logger.error('Error getting SL score grid:', error);
    next(error);
  }
});

/**
 * POST /scores
 * Bulk save Test1/Test2 for a class+subject+term. Recomputes ranks & summaries.
 */
router.post(
  '/scores',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.TEACHER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await slReportCardService.saveSubjectScores(
        tenant(req), req.user!.id, req.body, { role: req.user!.role },
      );
      res.json({ success: true, message: `${result.saved} scores saved`, data: result });
    } catch (error: any) {
      logger.error('Error saving SL scores:', error);
      if (
        error.message?.includes('required') || error.message?.includes('between') ||
        error.message?.includes('Invalid') || error.message?.includes('assigned') ||
        error.message?.includes('locked') || error.message?.includes('authorized')
      ) {
        return res.status(403).json({ success: false, error: error.message });
      }
      next(error);
    }
  },
);

// ── Domain ratings (affective / psychomotor) ────────────────────────────────

router.post(
  '/ratings',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.TEACHER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await slReportCardService.saveDomainRatings(
        tenant(req), req.user!.id, req.body, { role: req.user!.role },
      );
      res.json({ success: true, message: `${result.saved} ratings saved`, data: result });
    } catch (error: any) {
      logger.error('Error saving SL ratings:', error);
      if (
        error.message?.includes('between') || error.message?.includes('Invalid') ||
        error.message?.includes('not found') || error.message?.includes('assigned') ||
        error.message?.includes('authorized') || error.message?.includes('locked')
      ) {
        return res.status(403).json({ success: false, error: error.message });
      }
      next(error);
    }
  },
);

// ── Term record (attendance / conduct / comment) ────────────────────────────

router.post(
  '/term-record',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.TEACHER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await slReportCardService.saveTermRecord(
        tenant(req), req.user!.id, req.body, { role: req.user!.role },
      );
      res.json({ success: true, message: 'Term record saved' });
    } catch (error: any) {
      logger.error('Error saving SL term record:', error);
      if (error.message?.includes('assigned') || error.message?.includes('authorized') || error.message?.includes('Invalid') || error.message?.includes('locked')) {
        return res.status(403).json({ success: false, error: error.message });
      }
      next(error);
    }
  },
);

// ── Report meta (principal comment / promotion) ─────────────────────────────

router.post(
  '/meta',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await slReportCardService.saveReportMeta(tenant(req), req.user!.id, req.body);
      res.json({ success: true, message: 'Report meta saved' });
    } catch (error: any) {
      logger.error('Error saving SL report meta:', error);
      if (error.message?.includes('Invalid')) return res.status(400).json({ success: false, error: error.message });
      next(error);
    }
  },
);

// ── Report settings (principal-managed) ─────────────────────────────────────

router.get('/settings/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await slReportCardService.getSettings(tenant(req));
    res.json({ success: true, data: settings });
  } catch (error) {
    logger.error('Error getting SL report settings:', error);
    next(error);
  }
});

/**
 * GET /publications?academic_year=
 * Publish history for the tenant (principal/super_admin) — which classes/terms
 * have been released, when, and by whom.
 */
router.get(
  '/publications',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const academicYear = (req.query.academic_year as string) || undefined;
      const data = await slReportCardService.getPublications(tenant(req), academicYear);
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error getting SL report publications:', error);
      next(error);
    }
  },
);

router.post(
  '/settings/config',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await slReportCardService.saveSettings(tenant(req), req.user!.id, req.body);
      res.json({ success: true, message: 'Settings saved' });
    } catch (error) {
      logger.error('Error saving SL report settings:', error);
      next(error);
    }
  },
);

// ── Locking (principal authority) ───────────────────────────────────────────

router.post(
  '/lock',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await slReportCardService.setScoreLock(tenant(req), req.user!.id, req.body);
      res.json({ success: true, message: req.body.locked ? 'Scores locked' : 'Scores unlocked', data: result });
    } catch (error: any) {
      logger.error('Error locking SL scores:', error);
      if (error.message?.includes('Invalid')) return res.status(400).json({ success: false, error: error.message });
      next(error);
    }
  },
);

// ── Publishing (principal authority — gate for parents/students) ────────────

router.post(
  '/publish',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await slReportCardService.setPublication(tenant(req), req.user!.id, req.body);
      let message = req.body.published ? 'Results published' : 'Results unpublished';
      const ap = result?.auto_promotion;
      if (ap?.ran) {
        message += ` — auto-promotion: ${ap.promoted} promoted, ${ap.repeated} repeating, ${ap.graduated} graduated`;
      } else if (ap && ap.reason === 'no_next_class') {
        message += ' — auto-promotion skipped: set a "next class" on this class first';
      }
      res.json({ success: true, message, auto_promotion: ap ?? null });
    } catch (error: any) {
      logger.error('Error publishing SL results:', error);
      if (error.message?.includes('Invalid')) return res.status(400).json({ success: false, error: error.message });
      next(error);
    }
  },
);

// ── Teacher's assigned classes (for scoped dropdowns) ───────────────────────

router.get('/my/classes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Staff-admin see all; teachers see only assigned
    if (req.user!.role === 'principal' || req.user!.role === 'super_admin') {
      return res.json({ success: true, data: null, scoped: false }); // null = no restriction
    }
    const ids = await slReportCardService.getTeacherClassIds(req.user!.id, tenant(req));
    res.json({ success: true, data: ids, scoped: true });
  } catch (error) {
    logger.error('Error getting teacher classes:', error);
    next(error);
  }
});

// ── Teacher's assigned subjects for a class (scoped score-entry dropdown) ────

router.get('/my/subjects', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const classId = req.query.class_id as string;
    if (!classId) {
      return res.status(400).json({ success: false, error: 'class_id is required' });
    }
    // Staff-admin: no restriction (null = all subjects allowed).
    if (req.user!.role === 'principal' || req.user!.role === 'super_admin') {
      return res.json({ success: true, data: null, scoped: false });
    }
    const ids = await slReportCardService.getTeacherSubjectIdsForClass(req.user!.id, tenant(req), classId);
    res.json({ success: true, data: ids, scoped: true });
  } catch (error) {
    logger.error('Error getting teacher subjects for class:', error);
    next(error);
  }
});

/**
 * GET /student/:studentId/summary
 * All SL subject results for a student (Test1/Test2/Mean + grade), for the
 * student-profile "Academics" tab. Declared BEFORE /:studentId so "student"
 * isn't captured as a studentId param.
 */
// Staff-only: this summary is not publish-gated (students/parents use the
// publish-gated report card / dashboard views instead).
router.get('/student/:studentId/summary', authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.TEACHER, UserRole.ADMISSIONS_OFFICER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Teachers: only students who are (or were) in one of their classes.
    if (req.user!.role === 'teacher') {
      const { teacherCanAccessStudent } = await import('../utils/teacherScope.js');
      if (!(await teacherCanAccessStudent(req.user!.id, tenant(req), req.params.studentId))) {
        return res.status(403).json({ success: false, error: 'You can only view students in your classes' });
      }
    }
    const yr = typeof req.query.academic_year === 'string' && req.query.academic_year.trim() ? req.query.academic_year.trim() : null;
    const data = await slReportCardService.getStudentResultsSummary(tenant(req), req.params.studentId, yr);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error getting student results summary:', error);
    next(error);
  }
});

/**
 * GET /released?class_id&academic_year
 * Which terms (and whether the whole year) are released for a class. Lets
 * read-only staff (admissions, bursar) open on a released term instead of an
 * empty "not released" view.
 */
router.get('/released', authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.TEACHER, UserRole.ADMISSIONS_OFFICER, UserRole.ACCOUNTANT), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { class_id, academic_year } = req.query;
    if (!class_id || !academic_year) return res.status(400).json({ success: false, error: 'class_id and academic_year are required' });
    await slReportCardService.assertClassInTenant(class_id as string, tenant(req));
    const terms: string[] = [];
    for (const t of ['first_term', 'second_term', 'third_term']) {
      if (await slReportCardService.isPublished(tenant(req), class_id as string, academic_year as string, t)) terms.push(t);
    }
    const year = await slReportCardService.isPublished(tenant(req), class_id as string, academic_year as string);
    res.json({ success: true, data: { terms, year_released: year } });
  } catch (error) { next(error); }
});

/**
 * GET /ranking?class_id&academic_year&term
 * Class results directory ordered by position (1st, 2nd, 3rd …). Publish-gated
 * for non-staff. Flags the class leader(s) so the UI can celebrate them.
 * Declared BEFORE /:studentId so "ranking" isn't captured as a studentId.
 */
router.get('/ranking', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { class_id, academic_year, term } = req.query;
    if (!class_id || !academic_year) {
      return res.status(400).json({ success: false, error: 'class_id and academic_year are required' });
    }
    const termParam = (term && ['first_term', 'second_term', 'third_term'].includes(term as string)) ? (term as string) : null;
    const data = await slReportCardService.getClassRanking(
      tenant(req), req.user!.id, req.user!.role,
      class_id as string, academic_year as string, termParam,
    );
    res.json({ success: true, data });
  } catch (error: any) {
    logger.error('Error getting class ranking:', error);
    if (error.message?.includes('only view') || error.message?.includes('authorized') || error.message?.includes('assigned') || error.message?.includes('Teacher profile')) {
      return res.status(403).json({ success: false, error: error.message });
    }
    next(error);
  }
});

// ── Server-side PDF (clean, no browser header/footer) ───────────────────────

/**
 * GET /:studentId/pdf?class_id&academic_year
 * Renders the booklet to a real PDF via headless Chromium — guaranteed 4-page
 * A3 landscape output (2× A4 per sheet) with NO browser header/footer.
 */
router.get('/:studentId/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { class_id, academic_year, term } = req.query;
    if (!class_id || !academic_year) {
      return res.status(400).json({ success: false, error: 'class_id and academic_year are required' });
    }
    // A single-term sheet is requested for Term 1/2; Term 3 or no term = full booklet.
    const termParam = (term && ['first_term', 'second_term', 'third_term'].includes(term as string)) ? (term as string) : null;

    const tenantId = tenant(req);

    // Access control (staff / teacher-scope / student-own / parent-ward + published, term-aware)
    await slReportCardService.assertCanViewReport(
      tenantId, req.user!.id, req.user!.role,
      req.params.studentId, class_id as string, academic_year as string, termParam,
    );
    // The full-year booklet (no term) needs the WHOLE year released for
    // students, parents and finance/admissions staff, not just one term.
    if (!termParam && PUBLISH_GATED_ROLES.includes(req.user!.role)
      && !(await slReportCardService.isPublished(tenantId, class_id as string, academic_year as string, null))) {
      return res.status(403).json({ success: false, error: "The full year's report card has not been released yet" });
    }

    // Trigger a NEW verification code on every report card generation
    await slReportCardService.generateVerificationCode(
      tenantId, req.params.studentId, class_id as string, academic_year as string, req.user!.id,
    );

    const card = slReportCardService.redactUnreleased(await slReportCardService.getReportCard(
      tenantId,
      req.params.studentId,
      class_id as string,
      academic_year as string,
    ), req.user!.role);

    // School branding for the front cover (motto is now a column on schools)
    const schoolInfo = await db('schools').where({ tenant_id: tenantId }).first().catch(() => null) || {};

    // Fetch tenant's configured grading scale
    const gradingScale = await getTenantGradingScale(tenantId);
    const gradingMethod = gradingScale.grades.map((g) => ({
      remark: g.description || g.grade,
      min: g.min_score,
      max: g.max_score,
      isFail: g.grade === 'F' || g.grade_points === 0,
    }));

    // Fetch saved report-card settings (border style + display options) from
    // school config. Both keys are stored as JSON in school_config_settings.
    const readSetting = async (key: string): Promise<any> => {
      try {
        const row = await db('school_config_settings')
          .where({ tenant_id: tenantId, setting_key: key })
          .select('setting_value', 'data_type')
          .first();
        if (!row) return undefined;
        let val = row.setting_value;
        if (row.data_type === 'json' && typeof val === 'string') val = JSON.parse(val);
        return val && typeof val === 'object' ? val : undefined;
      } catch {
        return undefined;
      }
    };

    const borderStyle = (await readSetting('report_card_border_style')) as BorderStyleConfig | undefined;
    const displayOpts = await readSetting('report_card_display_opts');

    const safeName = String(card.student?.name || 'student').replace(/[^a-z0-9]+/gi, '_');
    const yr = String(academic_year).replace('/', '-');
    let pdf: Buffer;
    let fileName: string;

    if (termParam) {
      // Single-term terminal result sheet — one portrait A4, WAEC-styled.
      const html = await renderTermResultSheetHtml(card, schoolInfo, gradingMethod, termParam, borderStyle, displayOpts);
      pdf = await htmlToPdf(html, { landscape: false });
      fileName = `Result_${safeName}_${termParam.replace('_term', 'T')}_${yr}.pdf`;
    } else {
      // Full-year booklet (Term 3 / promotional): 6 pages → 3 imposed A3 sheets.
      const html = await renderReportCardHtml(card, schoolInfo, gradingMethod, borderStyle, displayOpts);
      const rawPdf = await htmlToPdf(html, { landscape: true });
      pdf = await imposeBooklet(rawPdf);
      fileName = `Report_${safeName}_${yr}.pdf`;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdf);
  } catch (error: any) {
    logger.error('Error generating report card PDF:', error);
    // Signal to the client that it should fall back to browser print
    res.status(501).json({ success: false, error: error?.message || 'PDF generation unavailable', fallback: true });
  }
});

// ── Full report card for one student ────────────────────────────────────────

/**
 * GET /:studentId?class_id&academic_year
 * Full booklet payload: subjects × terms, domain ratings, summaries, meta.
 */
router.get('/:studentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { class_id, academic_year, term } = req.query;
    if (!class_id || !academic_year) {
      return res.status(400).json({ success: false, error: 'class_id and academic_year are required' });
    }
    const tenantId = tenant(req);
    const termParam = (term && ['first_term', 'second_term', 'third_term'].includes(term as string)) ? (term as string) : null;

    // Access control. For the JSON view we pass the requested term so a
    // student/parent can load a page when at least that term (or the year) is
    // released. The payload's `published_terms` then tells the UI exactly which
    // terms to surface.
    await slReportCardService.assertCanViewReport(
      tenantId, req.user!.id, req.user!.role,
      req.params.studentId, class_id as string, academic_year as string, termParam,
    );

    // NOTE: a fresh verification code is generated on PDF/print EXPORT only
    // (the /pdf route), not on every JSON view. This on-screen preview reuses
    // the latest existing code — otherwise React Query background refetches
    // would insert a new verification-code row on every poll, growing the
    // table unbounded. getReportCard() itself falls back to generating one the
    // first time if none exists yet.
    const card = await slReportCardService.getReportCard(
      tenantId,
      req.params.studentId,
      class_id as string,
      academic_year as string,
    );
    // Students, parents and finance/admissions staff get released terms only.
    res.json({ success: true, data: slReportCardService.redactUnreleased(card, req.user!.role) });
  } catch (error: any) {
    logger.error('Error getting SL report card:', error);
    if (
      error.message?.includes('only view') || error.message?.includes('not permitted') ||
      error.message?.includes('published') || error.message?.includes('authorized') ||
      error.message?.includes('assigned') || error.message?.includes('released')
    ) {
      return res.status(403).json({ success: false, error: error.message });
    }
    next(error);
  }
});

// ── QR Verification ──────────────────────────────────────────────────────────

/**
 * GET /:studentId/qr?class_id&academic_year
 * Returns a verification payload + QR data URL for this student's report card.
 * The QR encodes a URL to the PUBLIC verification page with the latest
 * verification code stored in the DB. Each report card generation triggers a
 * new code, so every printed copy gets a unique QR.
 */
router.get('/:studentId/qr', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenant(req);
    const { studentId } = req.params;
    const classId = req.query.class_id as string;
    const academicYear = (req.query.academic_year as string) || (await resolveActiveYear(tenantId)).yearString;

    if (!classId) {
      return res.status(400).json({ success: false, error: 'class_id is required' });
    }

    // Same access rule as viewing the card. Without it any signed-in user could
    // mint a verification code for any student id (and then redeem it to read
    // that student's report card via the verify endpoints).
    try {
      await slReportCardService.assertCanViewReport(
        tenantId, req.user!.id, req.user!.role, studentId, classId, academicYear, null,
      );
    } catch (e: any) {
      return res.status(403).json({ success: false, error: e?.message || 'Not authorized' });
    }

    // Use the latest stored verification code, or generate one if none exists yet
    let verifyCode = await slReportCardService.getLatestVerificationCode(tenantId, studentId, classId, academicYear);
    if (!verifyCode) {
      verifyCode = await slReportCardService.generateVerificationCode(tenantId, studentId, classId, academicYear, req.user!.id);
    }
    const verifyUrl = slReportCardService.buildVerifyUrl(verifyCode, studentId, classId, academicYear);

    res.json({
      success: true,
      data: {
        verify_hash: verifyCode,
        verify_url: verifyUrl,
        student_id: studentId,
        class_id: classId,
        academic_year: academicYear,
      },
    });
  } catch (error: any) {
    logger.error('Error generating QR code:', error);
    next(error);
  }
});

/**
 * GET /verify/:hash?s=&c=&y=
 * DEPRECATED — use the public endpoint at /api/v1/public/verify-report-card/:hash instead.
 * This is kept for backwards compatibility but now uses the same DB-based lookup.
 */
router.get('/verify/:hash', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { hash: code } = req.params;
    const studentId = req.query.s as string;
    const classId = req.query.c as string;
    const academicYear = req.query.y as string;

    if (!code || !studentId || !classId || !academicYear) {
      return res.status(400).json({ success: false, error: 'Missing verification parameters (s, c, y)' });
    }

    // Look up the student — only within the caller's own school.
    const student = await db('students')
      .where({ id: studentId, tenant_id: tenant(req) })
      .select('tenant_id')
      .first();

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    // 1. Try DB-stored verification code (issued by the student's own school)
    const dbMatch = await db('sl_report_card_verification_codes')
      .where({ verification_code: code })
      .where({ student_id: studentId })
      .where({ academic_year: academicYear })
      .where({ tenant_id: student.tenant_id })
      .first();

    let resolvedClassId: string | null = dbMatch?.class_id ?? null;

    // 2. Fallback to old deterministic hash
    if (!resolvedClassId) {
      const expectedHash = crypto.createHash('sha256').update(`${student.tenant_id}:${studentId}:${classId}:${academicYear}`).digest('hex').slice(0, 24);
      if (code === expectedHash) {
        resolvedClassId = classId;
      }
    }

    if (!resolvedClassId) {
      return res.status(403).json({ success: false, error: 'Verification failed: code mismatch' });
    }

    // A signed-in caller gets no more than GET /:studentId would give them
    // (own / ward / staff scope + publish gate).
    try {
      await slReportCardService.assertCanViewReport(
        student.tenant_id, req.user!.id, req.user!.role, studentId, resolvedClassId, academicYear, null,
      );
    } catch (e: any) {
      return res.status(403).json({ success: false, error: e?.message || 'Not authorized' });
    }

    // Fetch the full report card data
    const card = slReportCardService.redactUnreleased(
      await slReportCardService.getReportCard(student.tenant_id, studentId, resolvedClassId, academicYear), req.user!.role,
    );

    const school = await db('schools')
      .where({ tenant_id: student.tenant_id })
      .select('name', 'short_name', 'logo_url', 'address', 'motto', 'phone', 'email', 'website')
      .first();

    res.json({
      success: true,
      data: {
        verified: true,
        verified_at: new Date().toISOString(),
        school: school || {},
        report_card: card,
      },
    });
  } catch (error: any) {
    logger.error('Error verifying report card:', error);
    next(error);
  }
});

export default router;
