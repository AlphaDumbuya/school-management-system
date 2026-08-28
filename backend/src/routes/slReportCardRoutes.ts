/**
 * Sierra Leone Report Card Routes
 * Mounted at /api/v1/report-cards
 *
 * Implements the real SL booklet grade-entry and report-generation flow.
 * All routes are tenant-scoped (service enforces tenant on every query).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '../middleware/authMiddleware.js';
import { UserRole } from '../types/auth.js';
import { logger } from '../utils/logger.js';
import slReportCardService, {
  AFFECTIVE_TRAITS,
  PSYCHOMOTOR_SKILLS,
  CONDUCT_LEGEND,
  SL_TERMS,
} from '../services/slReportCardService.js';
import { renderReportCardHtml } from '../services/slReportCardHtml.js';
import { htmlToPdf } from '../utils/pdfBrowser.js';
import db from '../utils/database.js';

const router = Router();

router.use(authenticate);
router.use(attachUserContext);

function tenant(req: Request): string {
  const t = req.user?.tenant_id;
  if (!t) throw Object.assign(new Error('Tenant context is required'), { status: 400 });
  return t;
}

// ── Reference data (legend/traits/terms) ────────────────────────────────────

router.get('/config', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      terms: SL_TERMS,
      affective_traits: AFFECTIVE_TRAITS,
      psychomotor_skills: PSYCHOMOTOR_SKILLS,
      conduct_legend: CONDUCT_LEGEND,
      grading_method: [
        { letter: 'A', remark: 'Excellent', min: 85, max: 100 },
        { letter: 'B', remark: 'Very Good', min: 75, max: 84 },
        { letter: 'C', remark: 'Good', min: 60, max: 74 },
        { letter: 'D', remark: 'Satisfactory', min: 50, max: 59 },
        { letter: 'F', remark: 'Unsatisfactory', min: 0, max: 49 },
      ],
    },
  });
});

// ── Score grid (entry screen) ───────────────────────────────────────────────

/**
 * GET /grid?class_id&subject_id&term&academic_year
 * Returns each student in the class with their existing Test1/Test2/mean.
 */
router.get('/grid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { class_id, subject_id, term, academic_year } = req.query;
    if (!class_id || !subject_id || !term || !academic_year) {
      return res.status(400).json({ success: false, error: 'class_id, subject_id, term, academic_year are required' });
    }
    const grid = await slReportCardService.getClassSubjectGrid(
      tenant(req),
      class_id as string,
      subject_id as string,
      term as string,
      academic_year as string,
    );
    res.json({ success: true, data: grid });
  } catch (error) {
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
        error.message?.includes('authorized')
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
      if (error.message?.includes('assigned') || error.message?.includes('authorized')) {
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
    } catch (error) {
      logger.error('Error saving SL report meta:', error);
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
    } catch (error) {
      logger.error('Error locking SL scores:', error);
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
    } catch (error) {
      logger.error('Error publishing SL results:', error);
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

// ── Server-side PDF (clean, no browser header/footer) ───────────────────────

/**
 * GET /:studentId/pdf?class_id&academic_year
 * Renders the booklet to a real PDF via headless Chromium — guaranteed 2-page
 * A4 landscape output with NO browser header/footer, in every browser.
 */
router.get('/:studentId/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { class_id, academic_year } = req.query;
    if (!class_id || !academic_year) {
      return res.status(400).json({ success: false, error: 'class_id and academic_year are required' });
    }

    const tenantId = tenant(req);

    // Access control (staff / teacher-scope / student-own / parent-ward + published)
    await slReportCardService.assertCanViewReport(
      tenantId, req.user!.id, req.user!.role,
      req.params.studentId, class_id as string, academic_year as string,
    );

    const card = await slReportCardService.getReportCard(
      tenantId,
      req.params.studentId,
      class_id as string,
      academic_year as string,
    );

    // School branding for the front cover
    const school = await db('schools').where({ tenant_id: tenantId }).first().catch(() => null);

    const html = renderReportCardHtml(card, school || {});
    const pdf = await htmlToPdf(html, { landscape: true });

    const safeName = String(card.student?.name || 'student').replace(/[^a-z0-9]+/gi, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Report_${safeName}_${String(academic_year).replace('/', '-')}.pdf"`);
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
    const { class_id, academic_year } = req.query;
    if (!class_id || !academic_year) {
      return res.status(400).json({ success: false, error: 'class_id and academic_year are required' });
    }
    const tenantId = tenant(req);

    // Access control (staff / teacher-scope / student-own / parent-ward + published)
    await slReportCardService.assertCanViewReport(
      tenantId, req.user!.id, req.user!.role,
      req.params.studentId, class_id as string, academic_year as string,
    );

    const card = await slReportCardService.getReportCard(
      tenantId,
      req.params.studentId,
      class_id as string,
      academic_year as string,
    );
    res.json({ success: true, data: card });
  } catch (error: any) {
    logger.error('Error getting SL report card:', error);
    if (
      error.message?.includes('only view') || error.message?.includes('not permitted') ||
      error.message?.includes('published') || error.message?.includes('authorized') ||
      error.message?.includes('assigned')
    ) {
      return res.status(403).json({ success: false, error: error.message });
    }
    next(error);
  }
});

export default router;
