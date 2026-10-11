/**
 * Public Report Card Verification Routes
 * Mounted at /api/v1/public/verify-report-card
 *
 * No authentication required — reached by scanning the QR code on a printed
 * report card. The QR encodes a unique verification code + student/class/year
 * params. The endpoint looks up the code in the database, and if found,
 * returns the full report card data for display on the verification page.
 *
 * Also supports legacy deterministic-hash QR codes for backwards compatibility.
 */

import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import slReportCardService from '../services/slReportCardService.js';
import { normalizeAcademicYear } from '../utils/academicYear.js';
import db from '../utils/database.js';

const router = Router();

/**
 * GET /api/v1/public/verify-report-card/:code?s=&c=&y=
 * Public endpoint (no auth) to verify and retrieve a report card by QR code.
 *
 * Supports THREE verification code formats:
 * 1. NEW (DB-stored unique code): 32-char hex token stored in sl_report_card_verification_codes
 * 2. Old 24-char hash: sha256(tenant:student:class:year)[:24] — requires c= param
 * 3. Old 16-char hash: sha256(tenant:student:year)[:16] — no class_id; looked up from enrollments
 */
router.get('/verify-report-card/:hash', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { hash: code } = req.params;
    const studentId = req.query.s as string;
    const classId = (req.query.c as string) || '';
    const academicYear = normalizeAcademicYear(req.query.y as string) as string;

    if (!code || !studentId || !academicYear) {
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

    // ── Helper: build the full verification response ──
    const buildResponse = async (cId: string) => {
      // A public link: released terms only, exactly what a parent can see.
      const card = slReportCardService.redactUnreleased(
        await slReportCardService.getReportCard(tenantId, studentId, cId, academicYear), 'parent',
      );
      const school = await db('schools')
        .where({ tenant_id: tenantId })
        .select('name', 'short_name', 'logo_url', 'address', 'motto', 'phone', 'email', 'website')
        .first();
      return {
        verified: true,
        verified_at: new Date().toISOString(),
        school: school || {},
        report_card: card,
      };
    };

    // ── 1. Try NEW format: DB-stored unique verification code (32-char hex) ──
    const dbMatch = await db('sl_report_card_verification_codes')
      .where({ verification_code: code })
      .where({ student_id: studentId })
      .where({ academic_year: academicYear })
      // A code only verifies a card issued by the student's OWN school.
      .where({ tenant_id: tenantId })
      .first();

    if (dbMatch) {
      return res.json({ success: true, data: await buildResponse(dbMatch.class_id) });
    }

    // ── 2. Try old 24-char deterministic hash (requires class_id) ──
    if (classId && classId !== 'old' && classId !== 'missing') {
      const expectedHash = crypto
        .createHash('sha256')
        .update(`${tenantId}:${studentId}:${classId}:${academicYear}`)
        .digest('hex')
        .slice(0, 24);

      // Legacy hashes are unkeyed (computable from ids), so they only ever
      // reveal RELEASED results — never drafts.
      if (code === expectedHash && (await slReportCardService.isAnythingPublished(tenantId, classId, academicYear))) {
        return res.json({ success: true, data: await buildResponse(classId) });
      }
    }

    // ── 3. Try old 16-char deterministic hash (no class_id) ──
    const oldExpectedHash = crypto
      .createHash('sha256')
      .update(`${tenantId}:${studentId}:${academicYear}`)
      .digest('hex')
      .slice(0, 16);

    // The bare-string 'old-format'/'missing' fallback is ONLY honored for
    // genuinely pre-code report cards — i.e. when the student has NO stored
    // verification code for this year. Otherwise it could be used to bypass a
    // card's real secret code entirely (student ids are random UUIDs, so this
    // is defense-in-depth, but we don't leave the hole open).
    let allowStringFallback = code === oldExpectedHash;
    if (!allowStringFallback && (code === 'old-format' || code === 'missing')) {
      const anyCode = await db('sl_report_card_verification_codes')
        .where({ student_id: studentId, academic_year: academicYear })
        .first()
        .catch(() => null);
      allowStringFallback = !anyCode; // only if no real code was ever issued
    }

    if (allowStringFallback) {
      // The student's class that academic year (enrollments are keyed by the
      // class's session; they have no academic_year column).
      const legacyClassId = await slReportCardService.classForStudentYear(studentId, academicYear);
      const enrollment = legacyClassId ? { class_id: legacyClassId } : null;

      if (!enrollment) {
        return res.status(404).json({
          success: false,
          error: 'Could not find the student\'s class for this academic year.',
        });
      }

      // Legacy fallbacks are unkeyed: released results only.
      if (!(await slReportCardService.isAnythingPublished(tenantId, enrollment.class_id, academicYear))) {
        return res.status(403).json({
          success: false,
          error: 'Verification failed: the QR code does not match this report card.',
        });
      }

      return res.json({ success: true, data: await buildResponse(enrollment.class_id) });
    }

    // ── Code doesn't match any format ──
    return res.status(403).json({
      success: false,
      error: 'Verification failed: the QR code does not match this report card.',
    });
  } catch (error: any) {
    logger.error('Error verifying report card:', error);
    next(error);
  }
});

export default router;
