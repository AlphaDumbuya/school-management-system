/**
 * Public Report Card Verification Routes
 * Mounted at /api/v1/public/verify-report-card
 *
 * No authentication required — reached by scanning the QR code on a printed
 * report card. The QR encodes a verification hash + student/class/year params.
 * The endpoint recomputes the hash from the params, confirms it matches, then
 * returns the full report card data for display on the verification page.
 */

import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import slReportCardService from '../services/slReportCardService.js';
import db from '../utils/database.js';

const router = Router();

/**
 * GET /api/v1/public/verify-report-card/:hash?s=&c=&y=
 * Public endpoint (no auth) to verify and retrieve a report card by QR hash.
 */
router.get('/verify-report-card/:hash', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { hash } = req.params;
    const studentId = req.query.s as string;
    const classId = req.query.c as string;
    const academicYear = req.query.y as string;

    if (!hash || !studentId || !classId || !academicYear) {
      return res.status(400).json({
        success: false,
        error: 'Missing verification parameters. Please scan the QR code on the report card.',
      });
    }

    // Look up the student's tenant_id
    const student = await db('students')
      .where({ id: studentId })
      .select('tenant_id', 'student_id as admission_no')
      .first();

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found. The report card may be invalid.',
      });
    }

    const tenantId = student.tenant_id;

    // Recompute the verification hash and compare
    const expectedHash = crypto
      .createHash('sha256')
      .update(`${tenantId}:${studentId}:${classId}:${academicYear}`)
      .digest('hex')
      .slice(0, 24);

    if (hash !== expectedHash) {
      return res.status(403).json({
        success: false,
        error: 'Verification failed: the QR code does not match this report card.',
      });
    }

    // Fetch the full report card data
    const card = await slReportCardService.getReportCard(tenantId, studentId, classId, academicYear);

    // Fetch school branding for display
    const school = await db('schools')
      .where({ tenant_id: tenantId })
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
