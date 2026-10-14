/**
 * Sierra Leone Report Card Service
 * ================================
 * Implements the real SL booklet flow:
 *   - Test 1 + Test 2 → Mean (auto)
 *   - Subject Rank: rank of subject means among a student's own subjects (per term)
 *   - Combined Score = Σ subject means; Percentage = combined / subjects
 *   - Class Position: student's rank within the class for the term (auto)
 *   - Yearly: mean of the three term means per subject + yearly subject rank
 *
 * Grading method:
 *   Excellent 85-100 (A) · Very Good 75-84 (B) · Good 60-74 (C)
 *   Satisfactory 50-59 (D) · Unsatisfactory below 50 (F)
 *
 * All queries are tenant-scoped.
 */

import db from '../utils/database.js';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import { publicAppUrl } from '../utils/publicUrl.js';
import promotionService from './promotionService.js';
import { normalizeAcademicYear, resolveYearScope } from '../utils/academicYear.js';
import { resolveTermWindows } from '../utils/termWindows.js';
import { getTenantGradingScale, computeGradeWithScale } from '../utils/gradingScaleHelper.js';

export const SL_TERMS = ['first_term', 'second_term', 'third_term'] as const;
type TermWindows = Record<SLTerm, { start: string | null; end: string | null }> & { year: { start: string | null; end: string | null } };
/** Roles that only ever see RELEASED results. */
export const PUBLISH_GATED_ROLES = ['student', 'parent', 'guardian', 'accountant', 'admissions_officer'];
export type SLTerm = (typeof SL_TERMS)[number];

// Fixed legend (matches the booklet back cover). Index is 1-based.
export const AFFECTIVE_TRAITS = [
  'Class Participation', 'Sociability', 'Helpfulness', 'Honesty',
  'Effort', 'Initiative', 'Self-Discipline', 'Demeanor',
  'Sporting Prowess', 'Dependability', 'Punctuality / Regularity',
  'School and Community Involvement',
];

export const PSYCHOMOTOR_SKILLS = [
  'Physical Dexterity', 'Stamina', 'Physical Agility', 'Sporting in Ball Game',
  'Ability to Function as Team Player', 'Sporting Prowess in Athletics',
  'Drawing / Painting', 'Handwriting', 'Voice Control',
  'Physical Co-ordination (in dance)', 'Musical Instrument Playing',
  'Bodily Control / Sense of Balance',
];

export const CONDUCT_LEGEND: Record<string, string> = {
  'V.G': 'Very Good',
  'G': 'Good',
  'S': 'Satisfactory',
  'PT': 'Play Truant (Must See Principal)',
  'N': 'Neglected Work',
  'Abs': 'Absent',
};

// ── Grading ─────────────────────────────────────────────────────────────────

export function getGrade(score: number, scale?: { grades: { grade: string; min_score: number; max_score: number; description?: string; grade_points?: number }[] } | null): { letter: string; remark: string; isFail: boolean } {
  if (scale?.grades?.length) {
    for (const entry of scale.grades) {
      if (score >= entry.min_score && score <= entry.max_score) {
        return {
          letter: entry.grade,
          remark: entry.description || '',
          isFail: entry.grade === 'F' || entry.grade_points === 0,
        };
      }
    }
    const failEntry = scale.grades.find((g) => g.grade === 'F');
    return {
      letter: failEntry?.grade || 'F',
      remark: failEntry?.description || 'Unsatisfactory',
      isFail: true,
    };
  }
  // Fallback to default SL scale
  if (score >= 85) return { letter: 'A', remark: 'Excellent', isFail: false };
  if (score >= 75) return { letter: 'B', remark: 'Very Good', isFail: false };
  if (score >= 60) return { letter: 'C', remark: 'Good', isFail: false };
  if (score >= 50) return { letter: 'D', remark: 'Satisfactory', isFail: false };
  return { letter: 'F', remark: 'Unsatisfactory', isFail: true };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function computeMean(test1: number | null, test2: number | null): number | null {
  const t1 = test1 == null ? null : Number(test1);
  const t2 = test2 == null ? null : Number(test2);
  if (t1 == null && t2 == null) return null;
  if (t1 != null && t2 != null) return round1((t1 + t2) / 2);
  return round1((t1 ?? t2)!); // only one test present
}

export interface SubjectScoreInput {
  student_id: string;
  subject_id: string;
  test1: number | null;
  test2: number | null;
}

export interface BulkSubjectScoresPayload {
  class_id: string;
  subject_id: string;   // used when entering one subject for many students...
  academic_year: string;
  term: SLTerm;
  scores: SubjectScoreInput[];
}

export class SLReportCardService {
  // ──────────────────────────────────────────────────────────────────────────
  // Tenant helpers
  // ──────────────────────────────────────────────────────────────────────────

  private async assertStudentInTenant(studentId: string, tenantId: string): Promise<void> {
    const s = await db('students').where({ id: studentId, tenant_id: tenantId }).first();
    if (!s) throw new Error('Student not found or access denied');
  }

  /**
   * Enrollment statuses that make up a class's results roster. A current-year
   * class lists who is enrolled now. A PAST-year class lists everyone who was
   * in it that year (since closed as completed / promoted / repeated /
   * graduated); otherwise past-year results, rankings and corrections would
   * show an empty class.
   */
  private async rosterStatuses(classId: string): Promise<string[]> {
    const row = await db('classes')
      .leftJoin('academic_sessions as s', 'classes.academic_session_id', 's.id')
      .where('classes.id', classId)
      .first('s.id as session_id', 's.is_active');
    const past = !!row?.session_id && row.is_active === false;
    return past
      ? ['enrolled', 'active', 'completed', 'promoted', 'repeated', 'graduated']
      : ['enrolled', 'active'];
  }

  /**
   * Results are written for the year the CLASS belongs to. A 2025/2026 class
   * can't receive 2026/2027 scores (they'd mix into that year's rankings).
   * A past year's results are read-only for teachers; the principal can still
   * make corrections. Returns the canonical year string.
   */
  private async assertClassYear(classId: string, academicYear: string, role: string): Promise<string> {
    const year = normalizeAcademicYear(academicYear);
    if (!year || !/^\d{4}\/\d{4}$/.test(year)) throw new Error('Invalid academic year');
    const r = await db('classes')
      .leftJoin('academic_sessions as s', 'classes.academic_session_id', 's.id')
      .where('classes.id', classId)
      .first('s.name', 's.is_active');
    if (r?.name) {
      const classYear = normalizeAcademicYear(r.name);
      if (classYear && classYear !== year) {
        throw new Error(`Invalid academic year: this class belongs to ${classYear}, not ${year}`);
      }
      if (r.is_active === false && !['principal', 'super_admin'].includes(role)) {
        throw new Error(`${year} is a past academic year, so its results are locked. Ask the principal to make corrections.`);
      }
    }
    return year;
  }

  async assertClassInTenant(classId: string, tenantId: string): Promise<void> {
    const c = await db('classes')
      .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
      .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
      .where('classes.id', classId)
      .where(function () {
        this.where('academic_sessions.tenant_id', tenantId).orWhere(function () {
          this.whereNull('classes.academic_session_id').where('class_creator.tenant_id', tenantId);
        });
      })
      .first();
    if (!c) throw new Error('Class not found or access denied');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Teacher scoping — a teacher may only act on classes/subjects assigned to them
  // ──────────────────────────────────────────────────────────────────────────

  /** Resolve the teachers.id for a given user (or null if not a teacher). */
  private async getTeacherId(userId: string, tenantId: string): Promise<string | null> {
    const row = await db('teachers')
      .join('users', 'teachers.user_id', 'users.id')
      .where('teachers.user_id', userId)
      .where('users.tenant_id', tenantId)
      .select('teachers.id')
      .first();
    return row?.id ?? null;
  }

  /**
   * Assert the given user is allowed to enter/view a class+subject.
   * - Principal / Super Admin: always allowed (role passed in).
   * - Teacher: must have a teacher_assignment for the class + subject,
   *   OR be the class_teacher of the class.
   */
  async assertTeacherScope(
    userId: string,
    tenantId: string,
    role: string,
    classId: string,
    subjectId?: string,
  ): Promise<void> {
    if (role === 'principal' || role === 'super_admin') return;
    if (role !== 'teacher') throw new Error('Not authorized to enter results');

    const teacherId = await this.getTeacherId(userId, tenantId);
    if (!teacherId) throw new Error('Teacher profile not found');

    // Class teacher of this class? (allowed for ratings/conduct across the class)
    const isClassTeacher = await db('classes')
      .where({ id: classId, class_teacher_id: teacherId })
      .first();
    if (isClassTeacher) return;

    // Assigned to teach this class (+ subject if provided)?
    let q = db('teacher_assignments')
      .where('teacher_id', teacherId)
      .where('class_id', classId);
    if (subjectId) q = q.where('subject_id', subjectId);

    const assignment = await q.first();
    if (!assignment) {
      throw new Error(
        subjectId
          ? 'You are not assigned to teach this subject for this class'
          : 'You are not assigned to this class',
      );
    }
  }

  /** Classes a teacher is assigned to (for filtering their dropdowns). */
  async getTeacherClassIds(userId: string, tenantId: string): Promise<string[]> {
    const teacherId = await this.getTeacherId(userId, tenantId);
    if (!teacherId) return [];
    const rows = await db('teacher_assignments').where('teacher_id', teacherId).distinct('class_id');
    const classTeacherRows = await db('classes').where('class_teacher_id', teacherId).select('id');
    const ids = new Set<string>([
      ...rows.map((r: any) => r.class_id),
      ...classTeacherRows.map((r: any) => r.id),
    ]);
    return Array.from(ids);
  }

  /**
   * Subject ids a teacher may enter scores for in a given class:
   *  - subjects they're assigned to teach in that class, OR
   *  - ALL of the class's subjects if they are the class teacher.
   */
  async getTeacherSubjectIdsForClass(userId: string, tenantId: string, classId: string): Promise<string[]> {
    const teacherId = await this.getTeacherId(userId, tenantId);
    if (!teacherId) return [];

    // Class teacher → all subjects mapped to the class.
    const isClassTeacher = await db('classes').where({ id: classId, class_teacher_id: teacherId }).first();
    if (isClassTeacher) {
      const rows = await db('class_subjects').where('class_id', classId).distinct('subject_id');
      return rows.map((r: any) => r.subject_id);
    }

    // Otherwise, only the subjects they're assigned to teach in this class.
    const rows = await db('teacher_assignments')
      .where({ teacher_id: teacherId, class_id: classId })
      .distinct('subject_id');
    return rows.map((r: any) => r.subject_id);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Report settings (per tenant — principal-managed)
  // ──────────────────────────────────────────────────────────────────────────

  async getSettings(tenantId: string): Promise<{
    auto_lock_on_entry: boolean;
    allow_teacher_edit_after_lock: boolean;
    allow_teacher_view_results: boolean;
    auto_promote_on_publish: boolean;
  }> {
    const row = await db('sl_report_settings').where({ tenant_id: tenantId }).first();
    return {
      auto_lock_on_entry: row?.auto_lock_on_entry ?? false,
      allow_teacher_edit_after_lock: row?.allow_teacher_edit_after_lock ?? false,
      allow_teacher_view_results: row?.allow_teacher_view_results ?? true,
      auto_promote_on_publish: row?.auto_promote_on_publish ?? false,
    };
  }

  async saveSettings(
    tenantId: string,
    userId: string,
    data: Partial<{
      auto_lock_on_entry: boolean;
      allow_teacher_edit_after_lock: boolean;
      allow_teacher_view_results: boolean;
      auto_promote_on_publish: boolean;
    }>,
  ): Promise<void> {
    const existing = await db('sl_report_settings').where({ tenant_id: tenantId }).first();
    const fields = {
      auto_lock_on_entry: data.auto_lock_on_entry,
      allow_teacher_edit_after_lock: data.allow_teacher_edit_after_lock,
      allow_teacher_view_results: data.allow_teacher_view_results,
      auto_promote_on_publish: data.auto_promote_on_publish,
      updated_by: userId,
      updated_at: db.fn.now(),
    };
    // Strip undefined so we only update provided keys
    Object.keys(fields).forEach((k) => (fields as any)[k] === undefined && delete (fields as any)[k]);

    if (existing) {
      await db('sl_report_settings').where({ tenant_id: tenantId }).update(fields);
    } else {
      await db('sl_report_settings').insert({ tenant_id: tenantId, ...fields });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Locking (prevent grade manipulation)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Lock or unlock scores for a class+subject+term. Principal authority.
   */
  async setScoreLock(
    tenantId: string,
    userId: string,
    payload: { class_id: string; subject_id: string; term: string; academic_year: string; locked: boolean },
  ): Promise<{ updated: number }> {
    if (!SL_TERMS.includes(payload.term as SLTerm)) throw new Error('Invalid term');
    await this.assertClassInTenant(payload.class_id, tenantId);
    const academicYear = await this.assertClassYear(payload.class_id, payload.academic_year, 'principal');
    const updated = await db('sl_subject_results')
      .where({
        tenant_id: tenantId,
        class_id: payload.class_id,
        subject_id: payload.subject_id,
        term: payload.term,
        academic_year: academicYear,
      })
      .update({
        is_locked: payload.locked,
        locked_at: payload.locked ? db.fn.now() : null,
        locked_by: payload.locked ? userId : null,
        updated_at: db.fn.now(),
      });
    return { updated };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Publishing (gate for parent/student visibility)
  // ──────────────────────────────────────────────────────────────────────────

  async setPublication(
    tenantId: string,
    userId: string,
    payload: { class_id: string; academic_year: string; term?: string | null; published: boolean; reason?: string | null },
  ): Promise<{ auto_promotion?: { ran: boolean; reason?: string; promoted: number; repeated: number; graduated: number; skipped: number } }> {
    await this.assertClassInTenant(payload.class_id, tenantId);
    payload = { ...payload, academic_year: await this.assertClassYear(payload.class_id, payload.academic_year, 'principal') };
    // No term / 'full' = the whole year. Anything else must be a real term: a
    // stray value would create a release that never matches anything.
    const rawTerm = payload.term == null || payload.term === '' || payload.term === 'full' ? null : String(payload.term);
    if (rawTerm && !SL_TERMS.includes(rawTerm as SLTerm)) throw new Error('Invalid term');
    const term = rawTerm;
    // Only meaningful when unreleasing; trimmed and capped for safety.
    const reason = !payload.published && payload.reason
      ? String(payload.reason).trim().slice(0, 500) || null
      : null;
    const existing = await db('sl_report_publications')
      .where({ tenant_id: tenantId, class_id: payload.class_id, academic_year: payload.academic_year, term })
      .first();

    const fields = {
      is_published: payload.published,
      published_at: payload.published ? db.fn.now() : null,
      published_by: payload.published ? userId : null,
      // Store the reason on unrelease; clear it on a fresh release.
      unpublish_reason: payload.published ? null : reason,
      updated_at: db.fn.now(),
    };

    if (existing) {
      await db('sl_report_publications').where({ id: existing.id }).update(fields);
    } else {
      await db('sl_report_publications').insert({
        tenant_id: tenantId,
        class_id: payload.class_id,
        academic_year: payload.academic_year,
        term,
        ...fields,
      });
    }

    // Notify guardians/students, best-effort, never blocks the action:
    //  - on publish → "results are available"
    //  - on unpublish → "results withdrawn" + the reason (if provided)
    if (payload.published) {
      this.notifyReportCardPublished(tenantId, payload.class_id, payload.academic_year, term).catch((err) =>
        logger.warn(`Report card published emails failed for class ${payload.class_id}: ${err?.message || err}`),
      );
    } else {
      this.notifyReportCardUnpublished(tenantId, payload.class_id, payload.academic_year, term, reason).catch((err) =>
        logger.warn(`Report card unpublish notices failed for class ${payload.class_id}: ${err?.message || err}`),
      );
    }

    // AUTO-PROMOTION: when a WHOLE-YEAR result set is published (term = null)
    // and the tenant has enabled auto-promote, upgrade passing students to
    // their class's configured next class (or graduate final-year students).
    if (payload.published && term === null) {
      const settings = await this.getSettings(tenantId);
      if (settings.auto_promote_on_publish) {
        try {
          const result = await promotionService.autoPromoteClass(
            tenantId, payload.class_id, payload.academic_year, userId,
          );
          logger.info(`Auto-promotion on publish for class ${payload.class_id}:`, result);
          return { auto_promotion: result };
        } catch (err) {
          // Never block publishing because promotion failed.
          logger.error('Auto-promotion on publish failed:', err);
        }
      }
    }

    return {};
  }

  /**
   * Email guardians (falling back to the student) that report cards for a class
   * have been published. Best-effort per recipient.
   */
  private async notifyReportCardPublished(
    tenantId: string,
    classId: string,
    academicYear: string,
    term: string | null,
  ): Promise<void> {
    const cls = await db('classes').where({ id: classId }).first().catch(() => null);
    const className = cls?.name || cls?.class_name || undefined;
    const isYear = !term; // whole-year release → promotional / booklet
    const termLabel = term
      ? ({ first_term: 'First Term', second_term: 'Second Term', third_term: 'Third Term' } as any)[term] || term
      : 'Full Year';

    // Next class name (for promotional "welcome to your new class" message).
    let nextClassName: string | undefined;
    if (isYear && cls?.next_class_id) {
      const nc = await db('classes').where({ id: cls.next_class_id }).first().catch(() => null);
      nextClassName = nc?.name || nc?.class_name || undefined;
    }

    const students = await db('enrollments')
      .join('students', 'enrollments.student_id', 'students.id')
      .where('enrollments.class_id', classId)
      // A past year's class: everyone who was in it that year, not just active.
      .whereIn('enrollments.status', await this.rosterStatuses(classId))
      .where('students.tenant_id', tenantId)
      .select(
        'students.id as student_id',
        'students.user_id as student_user_id',
        'students.first_name',
        'students.last_name',
        'students.email as student_email',
      );

    const { default: emailService } = await import('./emailService');
    const { default: notificationService } = await import('./notificationService');

    for (const s of students) {
      try {
        const studentName = [s.first_name, s.last_name].filter(Boolean).join(' ') || 'your child';

        // Promotion outcome for the year release (drives the "welcome to new
        // class" popup vs a plain results-ready popup).
        let promoted = false;
        let promotionText: string | undefined;
        if (isYear) {
          try {
            const ys = await this.computeYearlySummary(tenantId, classId, academicYear, s.student_id);
            promoted = ys.outcome === 'promoted' || ys.outcome === 'promoted_effort';
            promotionText = ys.promotion_recommendation || undefined;
          } catch { /* ignore — fall back to generic */ }
        }

        // In-app notification payload — the frontend uses `data.kind` to show a
        // one-time popup, and `data.term`/`promoted`/`nextClass` to word it.
        const notifData = {
          kind: 'result_released',
          student_id: s.student_id,
          class_id: classId,
          class_name: className,
          academic_year: academicYear,
          term: term || null,
          term_label: termLabel,
          is_year: isYear,
          promoted,
          promotion_text: promotionText,
          next_class: nextClassName,
          url: '/academic/report-cards',
        };
        const subject = isYear
          ? (promoted ? `Congratulations — ${studentName}'s results are out!` : `${studentName}'s end-of-year results are ready`)
          : `${studentName}'s ${termLabel} result is ready`;
        const message = isYear
          ? (promoted
            ? `${studentName}'s full-year report is published.${nextClassName ? ` Welcome to ${nextClassName}!` : ''}`
            : `${studentName}'s full-year report card is now available to view.`)
          : `${studentName}'s ${termLabel} result sheet has been released. Tap to view.`;

        // Notify the STUDENT's own account (if they have one).
        if (s.student_user_id) {
          await notificationService.createNotification({
            notificationType: 'result_released', recipientId: s.student_user_id,
            subject, message, data: notifData, channels: ['in_app'], sourceType: 'report_card', sourceId: s.student_id,
          }).catch(() => {});
        }

        // Resolve linked guardian accounts (user_id) for in-app + email.
        const guardians = await db('guardians')
          .where({ student_id: s.student_id })
          .whereNotNull('user_id')
          .select('user_id', 'email', 'first_name', 'last_name')
          .catch(() => [] as any[]);

        // Email + in-app to each guardian; fall back to the student's own email.
        let anyGuardianEmail = false;
        for (const g of guardians) {
          if (g.user_id) {
            await notificationService.createNotification({
              notificationType: 'result_released', recipientId: g.user_id,
              subject, message, data: notifData, channels: ['in_app'], sourceType: 'report_card', sourceId: s.student_id,
            }).catch(() => {});
          }
          if (g.email) {
            anyGuardianEmail = true;
            await emailService.sendReportCardPublishedEmail(tenantId, g.email, {
              recipientName: [g.first_name, g.last_name].filter(Boolean).join(' ') || 'Parent/Guardian',
              studentName, className, term: termLabel, academicYear,
            }).catch((e) => logger.warn(`RC email (guardian) failed for ${s.student_id}: ${e?.message || e}`));
          }
        }
        if (!anyGuardianEmail && s.student_email) {
          await emailService.sendReportCardPublishedEmail(tenantId, s.student_email, {
            recipientName: studentName, studentName, className, term: termLabel, academicYear,
          }).catch((e) => logger.warn(`RC email (student) failed for ${s.student_id}: ${e?.message || e}`));
        }
      } catch (err) {
        logger.warn(`Report card notify failed for student ${s.student_id}: ${(err as any)?.message || err}`);
      }
    }

    // ── Notify STAFF (teachers of this class + principals/admins) ────────────
    // So teachers and school administrators know results have gone live for
    // parents/students. Best-effort; never blocks the publish action.
    try {
      const staffMap = new Map<string, { user_id: string; email: string | null; name: string }>();

      // Teachers assigned to this class (via teacher_assignments) + the class
      // teacher (classes.class_teacher_id).
      const teacherRows = await db('teachers as t')
        .join('users as u', 't.user_id', 'u.id')
        .leftJoin('teacher_assignments as ta', 'ta.teacher_id', 't.id')
        .where('t.tenant_id', tenantId)
        .where((qb) => {
          qb.where('ta.class_id', classId).orWhereIn('t.id', db('classes').where({ id: classId }).select('class_teacher_id'));
        })
        .whereNotNull('t.user_id')
        .distinct('u.id as user_id', 'u.email', 'u.first_name', 'u.last_name')
        .catch(() => [] as any[]);
      for (const r of teacherRows) {
        staffMap.set(r.user_id, { user_id: r.user_id, email: r.email || null, name: [r.first_name, r.last_name].filter(Boolean).join(' ') || 'Teacher' });
      }

      // Principals / Head Teachers (and owners) for this tenant.
      const adminRows = await db('users')
        .where('tenant_id', tenantId)
        .where('role', 'principal')
        .whereNotNull('email')
        .select('id as user_id', 'email', 'first_name', 'last_name')
        .catch(() => [] as any[]);
      const { leadTitleFor } = await import('../utils/schoolLeaders.js');
      const leadName = adminRows.length ? await leadTitleFor(tenantId).catch(() => 'Principal') : 'Principal';
      for (const r of adminRows) {
        if (!staffMap.has(r.user_id)) {
          staffMap.set(r.user_id, { user_id: r.user_id, email: r.email || null, name: [r.first_name, r.last_name].filter(Boolean).join(' ') || leadName });
        }
      }

      const staffSubject = `Results released — ${className || 'a class'}${term ? ` (${termLabel})` : ''}`;
      const staffMessage = `Results for ${className || 'a class'}${term ? ` (${termLabel})` : ''} have been released to parents and students.`;
      const staffData = {
        kind: 'result_released_staff',
        class_id: classId, class_name: className, academic_year: academicYear,
        term: term || null, term_label: termLabel, is_year: isYear,
        url: '/academic/report-cards',
      };

      for (const staff of staffMap.values()) {
        await notificationService.createNotification({
          notificationType: 'result_released', recipientId: staff.user_id,
          subject: staffSubject, message: staffMessage, data: staffData,
          channels: ['in_app'], sourceType: 'report_card', sourceId: classId,
        }).catch(() => {});
        if (staff.email) {
          await emailService.sendResultsReleasedStaffEmail(tenantId, staff.email, {
            recipientName: staff.name, className, term: termLabel, academicYear, studentCount: students.length,
          }).catch((e) => logger.warn(`Results staff email failed for ${staff.user_id}: ${e?.message || e}`));
        }
      }
    } catch (err) {
      logger.warn(`Staff results notification failed for class ${classId}: ${(err as any)?.message || err}`);
    }
  }

  /**
   * Notify students + guardians that previously released report cards for a
   * class have been WITHDRAWN, including the principal's reason when supplied so
   * families understand why the results are no longer visible. Best-effort per
   * recipient; never blocks the unpublish action.
   */
  private async notifyReportCardUnpublished(
    tenantId: string,
    classId: string,
    academicYear: string,
    term: string | null,
    reason: string | null,
  ): Promise<void> {
    const cls = await db('classes').where({ id: classId }).first().catch(() => null);
    const className = cls?.name || cls?.class_name || undefined;
    const termLabel = term
      ? ({ first_term: 'First Term', second_term: 'Second Term', third_term: 'Third Term' } as any)[term] || term
      : 'Full Year';

    const students = await db('enrollments')
      .join('students', 'enrollments.student_id', 'students.id')
      .where('enrollments.class_id', classId)
      // A past year's class: everyone who was in it that year, not just active.
      .whereIn('enrollments.status', await this.rosterStatuses(classId))
      .where('students.tenant_id', tenantId)
      .select(
        'students.id as student_id',
        'students.user_id as student_user_id',
        'students.first_name',
        'students.last_name',
        'students.email as student_email',
      );

    const { default: emailService } = await import('./emailService');
    const { default: notificationService } = await import('./notificationService');

    const reasonSuffix = reason ? ` Reason: ${reason}` : '';

    for (const s of students) {
      try {
        const studentName = [s.first_name, s.last_name].filter(Boolean).join(' ') || 'your child';
        const subject = `${studentName}'s ${termLabel} result has been withdrawn`;
        const message = `${studentName}'s ${termLabel} result is temporarily unavailable while the school reviews it.${reasonSuffix}`;
        const notifData = {
          kind: 'result_withdrawn',
          student_id: s.student_id,
          class_id: classId,
          class_name: className,
          academic_year: academicYear,
          term: term || null,
          term_label: termLabel,
          reason: reason || null,
        };

        // Student's own account.
        if (s.student_user_id) {
          await notificationService.createNotification({
            notificationType: 'result_released', recipientId: s.student_user_id,
            subject, message, data: notifData, channels: ['in_app'], sourceType: 'report_card', sourceId: s.student_id,
          }).catch(() => {});
        }

        // Linked guardians — in-app + email.
        const guardians = await db('guardians')
          .where({ student_id: s.student_id })
          .whereNotNull('user_id')
          .select('user_id', 'email', 'first_name', 'last_name')
          .catch(() => [] as any[]);

        let anyGuardianEmail = false;
        for (const g of guardians) {
          if (g.user_id) {
            await notificationService.createNotification({
              notificationType: 'result_released', recipientId: g.user_id,
              subject, message, data: notifData, channels: ['in_app'], sourceType: 'report_card', sourceId: s.student_id,
            }).catch(() => {});
          }
          if (g.email) {
            anyGuardianEmail = true;
            await emailService.sendReportCardUnpublishedEmail(tenantId, g.email, {
              recipientName: [g.first_name, g.last_name].filter(Boolean).join(' ') || 'Parent/Guardian',
              studentName, className, term: termLabel, academicYear, reason: reason || undefined,
            }).catch((e) => logger.warn(`RC unpublish email (guardian) failed for ${s.student_id}: ${e?.message || e}`));
          }
        }
        if (!anyGuardianEmail && s.student_email) {
          await emailService.sendReportCardUnpublishedEmail(tenantId, s.student_email, {
            recipientName: studentName, studentName, className, term: termLabel, academicYear, reason: reason || undefined,
          }).catch((e) => logger.warn(`RC unpublish email (student) failed for ${s.student_id}: ${e?.message || e}`));
        }
      } catch (err) {
        logger.warn(`Report card unpublish notify failed for student ${s.student_id}: ${(err as any)?.message || err}`);
      }
    }
  }

  /** Whether results for a class+year (optionally term) are published. */
  async isPublished(
    tenantId: string,
    classId: string,
    academicYear: string,
    term?: string | null,
  ): Promise<boolean> {
    // A whole-year publication (term = null) covers all terms.
    const yearPub = await db('sl_report_publications')
      .where({ tenant_id: tenantId, class_id: classId, academic_year: academicYear, term: null })
      .first();
    if (yearPub?.is_published) return true;

    if (term) {
      const termPub = await db('sl_report_publications')
        .where({ tenant_id: tenantId, class_id: classId, academic_year: academicYear, term })
        .first();
      return !!termPub?.is_published;
    }
    return false;
  }

  /**
   * Whether ANY result (whole-year OR any single term) is published for this
   * class+year. Used to gate a student/parent from the results area at all.
   */
  async isAnythingPublished(tenantId: string, classId: string, academicYear: string): Promise<boolean> {
    const row = await db('sl_report_publications')
      .where({ tenant_id: tenantId, class_id: classId, academic_year: academicYear, is_published: true })
      .first();
    return !!row;
  }

  /**
   * Returns which terms are released for a class+year, plus whether the full
   * year (all terms + promotion) is released. A whole-year publication implies
   * all three terms are viewable.
   */
  async getPublishedTerms(
    tenantId: string,
    classId: string,
    academicYear: string,
  ): Promise<{ terms: string[]; wholeYear: boolean }> {
    const rows = await db('sl_report_publications')
      .where({ tenant_id: tenantId, class_id: classId, academic_year: academicYear, is_published: true })
      .select('term');
    const wholeYear = rows.some((r: any) => r.term == null);
    if (wholeYear) return { terms: [...SL_TERMS], wholeYear: true };
    const terms = rows.map((r: any) => r.term).filter((t: any): t is string => !!t);
    return { terms, wholeYear: false };
  }

  /**
   * Resolve the academic-year STRING that the report-card data for a class is
   * actually keyed on. Score entry + publishing both use the "YYYY/YYYY+1"
   * format (from the Results page), while academic_sessions may store the year
   * differently (e.g. "2025"). To make the parent/student publish-gate reliable
   * we derive the year from the real data: latest publication for the class,
   * else the latest sl_subject_results row, else the caller's hint/current year.
   */
  async resolveClassAcademicYear(
    tenantId: string,
    classId: string,
    hint?: string | null,
  ): Promise<string | null> {
    // 0. The year asked for, when this class has results or releases under it
    //    (otherwise a legacy class with no session showed the newest year).
    const wanted = normalizeAcademicYear(hint || null);
    if (wanted && /^\d{4}\/\d{4}$/.test(wanted)) {
      const hit = await db('sl_report_publications').where({ tenant_id: tenantId, class_id: classId, academic_year: wanted }).first('id').catch(() => null)
        || await db('sl_subject_results').where({ tenant_id: tenantId, class_id: classId, academic_year: wanted }).first('id').catch(() => null);
      if (hit) return wanted;
      // A class that belongs to a session is always that session's year.
      const cls = await db('classes').leftJoin('academic_sessions as s', 'classes.academic_session_id', 's.id')
        .where('classes.id', classId).first('s.name').catch(() => null);
      const own = normalizeAcademicYear(cls?.name || null);
      if (own && /^\d{4}\/\d{4}$/.test(own)) return own;
    }
    // 1. Most recent publication for this class.
    const pub = await db('sl_report_publications')
      .where({ tenant_id: tenantId, class_id: classId })
      .orderBy('updated_at', 'desc')
      .select('academic_year')
      .first()
      .catch(() => null);
    if (pub?.academic_year) return pub.academic_year;

    // 2. Most recent results row for this class.
    const res = await db('sl_subject_results')
      .where({ tenant_id: tenantId, class_id: classId })
      .orderBy('updated_at', 'desc')
      .select('academic_year')
      .first()
      .catch(() => null);
    if (res?.academic_year) return res.academic_year;

    // 3. Caller hint (e.g. session year) or the current YYYY/YYYY+1.
    if (hint) return hint;
    const y = new Date().getFullYear();
    return `${y}/${y + 1}`;
  }

  /**
   * Publication history for the tenant (optionally filtered by academic year).
   * Returns each publish record with class name + publisher name so the
   * principal can SEE exactly what has been released and when.
   */
  async getPublications(
    tenantId: string,
    academicYear?: string,
  ): Promise<Array<{
    id: string;
    class_id: string;
    class_name: string | null;
    academic_year: string;
    term: string | null;
    term_label: string;
    is_published: boolean;
    published_at: string | null;
    published_by_name: string | null;
    unpublish_reason: string | null;
  }>> {
    let q = db('sl_report_publications as p')
      .leftJoin('classes as c', 'p.class_id', 'c.id')
      .leftJoin('users as u', 'p.published_by', 'u.id')
      .where('p.tenant_id', tenantId);
    if (academicYear) q = q.where('p.academic_year', academicYear);

    const rows = await q
      .select(
        'p.id', 'p.class_id', 'p.academic_year', 'p.term', 'p.is_published', 'p.published_at',
        'p.unpublish_reason',
        'c.name as class_name',
        db.raw("NULLIF(TRIM(CONCAT(COALESCE(u.first_name,''),' ',COALESCE(u.last_name,''))), '') as published_by_name"),
      )
      .orderBy('p.published_at', 'desc')
      .orderBy('p.updated_at', 'desc');

    const TERM_LABEL: Record<string, string> = {
      first_term: 'First Term', second_term: 'Second Term', third_term: 'Third Term',
    };
    return rows.map((r: any) => ({
      id: r.id,
      class_id: r.class_id,
      class_name: r.class_name || null,
      academic_year: r.academic_year,
      term: r.term || null,
      term_label: r.term ? (TERM_LABEL[r.term] || r.term) : 'Full Year',
      is_published: !!r.is_published,
      published_at: r.published_at ? new Date(r.published_at).toISOString() : null,
      published_by_name: r.published_by_name || null,
      unpublish_reason: r.unpublish_reason || null,
    }));
  }

  /**
   * Class ranking (results directory): students ordered by position (1st, 2nd,
   * 3rd …) for a term, or by yearly position when `term` is null/'full'.
   *
   * Access is publish-gated for non-staff (students/parents/accountant/
   * admissions_officer): they only get a ranking for released terms. Staff see
   * the live ranking any time. Returns the top position(s) flagged so the UI
   * can celebrate the class leader(s).
   */
  async getClassRanking(
    tenantId: string,
    viewerUserId: string,
    role: string,
    classId: string,
    academicYear: string,
    term?: string | null,
  ): Promise<{
    class_id: string;
    class_name: string | null;
    academic_year: string;
    term: string | null;
    is_year: boolean;
    published: boolean;
    students: Array<{
      student_id: string;
      name: string;
      admission_no: string | null;
      photo_url: string | null;
      combined_score: number | null;
      percentage: number | null;
      position: number | null;
      class_size: number | null;
      is_top: boolean;
    }>;
  }> {
    await this.assertClassInTenant(classId, tenantId);
    // A teacher may only rank the classes they teach or lead.
    if (role === 'teacher') await this.assertTeacherScope(viewerUserId, tenantId, role, classId);
    const isStaff = ['principal', 'super_admin', 'teacher'].includes(role);
    const isYear = !term || term === 'full';
    const normTerm = isYear ? null : term!;

    // Publish gate for non-staff.
    let published = true;
    if (!isStaff) {
      published = normTerm
        ? await this.isPublished(tenantId, classId, academicYear, normTerm)
        : await this.isPublished(tenantId, classId, academicYear);
      // Teacher class-scope is enforced elsewhere; students/parents may only see
      // their own class — restrict by checking their linkage.
      if (role === 'student') {
        const stu = await db('students').where({ tenant_id: tenantId, user_id: viewerUserId }).first();
        const enrolled = stu && await db('enrollments').where({ student_id: stu.id, class_id: classId }).first();
        if (!enrolled) throw new Error('You can only view your own class ranking');
      } else if (role === 'parent' || role === 'guardian') {
        // 'guardian' is the legacy alias for parent: it must get the same link
        // check (it used to skip it and could rank any class once published).
        const linked = await db('guardians as g')
          .join('enrollments as e', 'g.student_id', 'e.student_id')
          .where('g.user_id', viewerUserId)
          .where('e.class_id', classId)
          .first();
        if (!linked) throw new Error('You can only view your ward\'s class ranking');
      }
      if (!published) {
        const cls = await db('classes').where({ id: classId }).first().catch(() => null);
        return { class_id: classId, class_name: cls?.name || cls?.class_name || null, academic_year: academicYear, term: normTerm, is_year: isYear, published: false, students: [] };
      }
    }

    const cls = await db('classes').where({ id: classId }).first().catch(() => null);
    const className = cls?.name || cls?.class_name || null;

    // Roster joined to students for names/photos (historic for a past year).
    const roster = await db('enrollments as e')
      .join('students as s', 'e.student_id', 's.id')
      .where('e.class_id', classId)
      .whereIn('e.status', await this.rosterStatuses(classId))
      .distinctOn('s.id')
      .where('s.tenant_id', tenantId)
      .select('s.id as student_id', 's.first_name', 's.last_name', 's.student_id as admission_no', 's.photo_url');

    // Build the ranked list.
    let ranked: Array<{ student_id: string; name: string; admission_no: string | null; photo_url: string | null; combined_score: number | null; percentage: number | null; position: number | null; class_size: number | null; is_top: boolean }> = [];

    if (isYear) {
      // Yearly: compute each student's yearly summary (position across the class).
      const results = await Promise.all(roster.map(async (r: any) => {
        const ys = await this.computeYearlySummary(tenantId, classId, academicYear, r.student_id).catch(() => null);
        return {
          student_id: r.student_id,
          name: [r.first_name, r.last_name].filter(Boolean).join(' ') || 'Student',
          admission_no: r.admission_no || null,
          photo_url: r.photo_url || null,
          combined_score: ys?.combined_score ?? null,
          percentage: ys?.percentage ?? null,
          position: ys?.position ?? null,
          class_size: ys?.class_size ?? roster.length,
          is_top: false,
        };
      }));
      ranked = results;
    } else {
      // Single term: use the stored term summaries.
      const summaries = await db('sl_term_summaries')
        .where({ tenant_id: tenantId, class_id: classId, academic_year: academicYear, term: normTerm })
        .select('student_id', 'combined_score', 'percentage', 'position', 'class_size');
      const byStudent = new Map<string, any>();
      summaries.forEach((s: any) => byStudent.set(s.student_id, s));
      ranked = roster.map((r: any) => {
        const sm = byStudent.get(r.student_id);
        return {
          student_id: r.student_id,
          name: [r.first_name, r.last_name].filter(Boolean).join(' ') || 'Student',
          admission_no: r.admission_no || null,
          photo_url: r.photo_url || null,
          combined_score: sm?.combined_score != null ? Number(sm.combined_score) : null,
          percentage: sm?.percentage != null ? Number(sm.percentage) : null,
          position: sm?.position ?? null,
          class_size: sm?.class_size ?? roster.length,
          is_top: false,
        };
      });
    }

    // Sort: ranked students first (by position asc), unranked (no results) last.
    ranked.sort((a, b) => {
      if (a.position == null && b.position == null) return a.name.localeCompare(b.name);
      if (a.position == null) return 1;
      if (b.position == null) return -1;
      return a.position - b.position;
    });

    // Flag the top position(s) (handles ties for 1st).
    const topPos = ranked.find((s) => s.position != null)?.position ?? null;
    if (topPos != null) ranked.forEach((s) => { s.is_top = s.position === topPos; });

    return { class_id: classId, class_name: className, academic_year: academicYear, term: normTerm, is_year: isYear, published: true, students: ranked };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Score entry (bulk, per subject for a class)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Upsert Test 1 / Test 2 for many students in one subject+class+term.
   * After writing, recomputes subject ranks and term summaries for the class.
   */
  async saveSubjectScores(
    tenantId: string,
    userId: string,
    payload: BulkSubjectScoresPayload,
    ctx?: { role?: string },
  ): Promise<{ saved: number }> {
    const { class_id, subject_id, term, scores } = payload;
    const role = ctx?.role ?? 'principal';

    if (!class_id || !subject_id || !payload.academic_year || !term || !Array.isArray(scores)) {
      throw new Error('class_id, subject_id, academic_year, term and scores[] are required');
    }
    if (!SL_TERMS.includes(term)) throw new Error('Invalid term');

    await this.assertClassInTenant(class_id, tenantId);
    const academic_year = await this.assertClassYear(class_id, payload.academic_year, role);
    // Teacher scoping — must be assigned to this class + subject
    await this.assertTeacherScope(userId, tenantId, role, class_id, subject_id);

    const settings = await this.getSettings(tenantId);
    const isStaffAdmin = role === 'principal' || role === 'super_admin';

    let saved = 0;

    await db.transaction(async (trx) => {
      for (const row of scores) {
        // Tenant-scope each student
        const student = await trx('students').where({ id: row.student_id, tenant_id: tenantId }).first();
        if (!student) continue;

        // Validate score ranges (0-100 each)
        for (const v of [row.test1, row.test2]) {
          if (v != null && (Number(v) < 0 || Number(v) > 100)) {
            throw new Error('Test scores must be between 0 and 100');
          }
        }

        const mean = computeMean(row.test1, row.test2);

        const existing = await trx('sl_subject_results')
          .where({
            tenant_id: tenantId,
            student_id: row.student_id,
            subject_id,
            class_id,
            term,
            academic_year,
          })
          .first();

        if (existing) {
          // Locking: a locked score can only be edited by staff-admin, or by a
          // teacher if the principal has allowed post-lock edits.
          if (existing.is_locked && !isStaffAdmin && !settings.allow_teacher_edit_after_lock) {
            throw new Error('These scores are locked and can no longer be edited. Contact the principal.');
          }

          await trx('sl_subject_results').where({ id: existing.id }).update({
            test1: row.test1,
            test2: row.test2,
            mean,
            entered_by: userId,
            // Auto-lock on entry (if enabled) — teachers lock their own entries.
            ...(settings.auto_lock_on_entry && !isStaffAdmin
              ? { is_locked: true, locked_at: db.fn.now(), locked_by: userId }
              : {}),
            updated_at: db.fn.now(),
          });
        } else {
          await trx('sl_subject_results').insert({
            tenant_id: tenantId,
            student_id: row.student_id,
            subject_id,
            class_id,
            academic_year,
            term,
            test1: row.test1,
            test2: row.test2,
            mean,
            entered_by: userId,
            // Auto-lock on entry (if enabled) for teacher submissions
            ...(settings.auto_lock_on_entry && !isStaffAdmin
              ? { is_locked: true, locked_at: db.fn.now(), locked_by: userId }
              : {}),
          });
        }
        saved++;
      }
    });

    // Recompute derived values for the whole class/term
    await this.recomputeSubjectRanks(tenantId, class_id, term, academic_year);
    await this.recomputeTermSummaries(tenantId, class_id, term, academic_year);

    logger.info(`SL scores saved: ${saved} students, subject ${subject_id}, ${term} ${academic_year}`);
    return { saved };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Derived computations
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Subject rank = rank of each student's mean among ALL classmates for that
   * subject+term (1 = highest mean in the class for that subject).
   * Standard competition ranking (ties share the rank).
   */
  private async recomputeSubjectRanks(
    tenantId: string,
    classId: string,
    term: string,
    academicYear: string,
  ): Promise<void> {
    const rows = await db('sl_subject_results')
      .where({ tenant_id: tenantId, class_id: classId, term, academic_year: academicYear })
      .whereNotNull('mean')
      .select('id', 'subject_id', 'student_id', 'mean');

    // Group by subject → rank students within each subject
    const bySubject: Record<string, { id: string; mean: number }[]> = {};
    for (const r of rows) {
      (bySubject[r.subject_id] ??= []).push({ id: r.id, mean: Number(r.mean) });
    }

    await db.transaction(async (trx) => {
      for (const subjectId of Object.keys(bySubject)) {
        const students = bySubject[subjectId].sort((a, b) => b.mean - a.mean);
        // Standard competition ranking (ties share the rank)
        let rank = 0;
        let prevMean: number | null = null;
        for (let i = 0; i < students.length; i++) {
          if (prevMean === null || students[i].mean !== prevMean) {
            rank = i + 1;
            prevMean = students[i].mean;
          }
          await trx('sl_subject_results').where({ id: students[i].id }).update({ subject_rank: rank });
        }
      }
    });
  }

  /**
   * Term summary per student: combined score (Σ means), percentage, and
   * class position (rank within class by combined score). Preserves any
   * manually-entered attendance/conduct/comment.
   */
  private async recomputeTermSummaries(
    tenantId: string,
    classId: string,
    term: string,
    academicYear: string,
  ): Promise<void> {
    const rows = await db('sl_subject_results')
      .where({ tenant_id: tenantId, class_id: classId, term, academic_year: academicYear })
      .whereNotNull('mean')
      .select('student_id', 'mean');

    // Aggregate per student
    const agg: Record<string, { total: number; count: number }> = {};
    for (const r of rows) {
      const a = (agg[r.student_id] ??= { total: 0, count: 0 });
      a.total += Number(r.mean);
      a.count += 1;
    }

    const students = Object.keys(agg).map((sid) => {
      const { total, count } = agg[sid];
      const percentage = count > 0 ? round1(total / count) : 0;
      return { student_id: sid, combined_score: round1(total), percentage };
    });

    // Class position by combined score (desc), competition ranking
    students.sort((a, b) => b.combined_score - a.combined_score);
    let position = 0;
    let prev: number | null = null;
    const classSize = students.length;
    students.forEach((s, i) => {
      if (prev === null || s.combined_score !== prev) {
        position = i + 1;
        prev = s.combined_score;
      }
      (s as any).position = position;
    });

    await db.transaction(async (trx) => {
      for (const s of students as any[]) {
        const existing = await trx('sl_term_summaries')
          .where({ tenant_id: tenantId, student_id: s.student_id, class_id: classId, term, academic_year: academicYear })
          .first();

        if (existing) {
          await trx('sl_term_summaries').where({ id: existing.id }).update({
            combined_score: s.combined_score,
            percentage: s.percentage,
            position: s.position,
            class_size: classSize,
            updated_at: db.fn.now(),
          });
        } else {
          await trx('sl_term_summaries').insert({
            tenant_id: tenantId,
            student_id: s.student_id,
            class_id: classId,
            academic_year: academicYear,
            term,
            combined_score: s.combined_score,
            percentage: s.percentage,
            position: s.position,
            class_size: classSize,
          });
        }
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Domain ratings (affective / psychomotor)
  // ──────────────────────────────────────────────────────────────────────────

  async saveDomainRatings(
    tenantId: string,
    userId: string,
    payload: {
      student_id: string;
      class_id: string;
      academic_year: string;
      term: SLTerm;
      // { traitIndex: { r1: 1-5, r2: 1-5 } } — two ratings per test, like the booklet
      affective: Record<number, { r1: number | null; r2: number | null }>;
      psychomotor: Record<number, { r1: number | null; r2: number | null }>;
    },
    ctx?: { role?: string },
  ): Promise<{ saved: number }> {
    const { student_id, class_id, term, affective, psychomotor } = payload;
    const role = ctx?.role ?? 'principal';

    await this.assertStudentInTenant(student_id, tenantId);
    await this.assertClassInTenant(class_id, tenantId);
    const academic_year = await this.assertClassYear(class_id, payload.academic_year, role);
    // Ratings are a class-level responsibility (class teacher / assigned teacher)
    await this.assertTeacherScope(userId, tenantId, role, class_id);
    if (!SL_TERMS.includes(term)) throw new Error('Invalid term');

    let saved = 0;
    const entries: { domain: string; trait_index: number; r1: number | null; r2: number | null }[] = [];

    for (const [idx, val] of Object.entries(affective || {})) {
      entries.push({ domain: 'affective', trait_index: Number(idx), r1: val?.r1 ?? null, r2: val?.r2 ?? null });
    }
    for (const [idx, val] of Object.entries(psychomotor || {})) {
      entries.push({ domain: 'psychomotor', trait_index: Number(idx), r1: val?.r1 ?? null, r2: val?.r2 ?? null });
    }

    const validRating = (v: number | null) => v == null || (v >= 1 && v <= 5);

    await db.transaction(async (trx) => {
      for (const e of entries) {
        if (!validRating(e.r1) || !validRating(e.r2)) throw new Error('Ratings must be between 1 and 5');
        if (e.trait_index < 1 || e.trait_index > 12) continue;
        // A trait left blank is "not rated in this save" — never wipe a saved
        // rating with nulls (the form may not have loaded the existing values).
        if (e.r1 == null && e.r2 == null) continue;

        const existing = await trx('sl_domain_ratings')
          .where({ tenant_id: tenantId, student_id, class_id, term, academic_year, domain: e.domain, trait_index: e.trait_index })
          .first();

        if (existing) {
          await trx('sl_domain_ratings').where({ id: existing.id }).update({
            rating1: e.r1,
            rating2: e.r2,
            entered_by: userId,
            updated_at: db.fn.now(),
          });
        } else {
          await trx('sl_domain_ratings').insert({
            tenant_id: tenantId,
            student_id,
            class_id,
            academic_year,
            term,
            domain: e.domain,
            trait_index: e.trait_index,
            rating1: e.r1,
            rating2: e.r2,
            entered_by: userId,
          });
        }
        saved++;
      }
    });

    return { saved };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Term summary (attendance / conduct / comment) — manual fields
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Save the manual term fields: conduct + guidance comment.
   * NOTE: Attendance (on time / late / absent) is NOT saved here — it is
   * computed live from the attendance table when the report card is generated.
   */
  async saveTermRecord(
    tenantId: string,
    userId: string,
    payload: {
      student_id: string;
      class_id: string;
      academic_year: string;
      term: SLTerm;
      conduct?: string;
      teacher_comment?: string;
    },
    ctx?: { role?: string },
  ): Promise<void> {
    const { student_id, class_id, term } = payload;
    const role = ctx?.role ?? 'principal';
    if (!SL_TERMS.includes(term)) throw new Error('Invalid term');
    await this.assertStudentInTenant(student_id, tenantId);
    await this.assertClassInTenant(class_id, tenantId);
    const academic_year = await this.assertClassYear(class_id, payload.academic_year, role);
    await this.assertTeacherScope(userId, tenantId, role, class_id);

    const existing = await db('sl_term_summaries')
      .where({ tenant_id: tenantId, student_id, class_id, term, academic_year })
      .first();

    // Only fields actually sent are written; an omitted conduct/comment keeps
    // what's already saved instead of being cleared.
    const fields: Record<string, any> = { teacher_signed_by: userId, updated_at: db.fn.now() };
    if (payload.conduct !== undefined) fields.conduct = payload.conduct || null;
    if (payload.teacher_comment !== undefined) fields.teacher_comment = payload.teacher_comment || null;

    if (existing) {
      await db('sl_term_summaries').where({ id: existing.id }).update(fields);
    } else {
      await db('sl_term_summaries').insert({
        tenant_id: tenantId,
        student_id,
        class_id,
        academic_year,
        term,
        ...fields,
      });
    }
  }

  async saveReportMeta(
    tenantId: string,
    userId: string,
    payload: {
      student_id: string;
      class_id: string;
      academic_year: string;
      principal_comment?: string;
      promotion_status?: string;
      average_age?: string;
    },
  ): Promise<void> {
    const { student_id, class_id } = payload;
    await this.assertStudentInTenant(student_id, tenantId);
    await this.assertClassInTenant(class_id, tenantId);
    const academic_year = await this.assertClassYear(class_id, payload.academic_year, 'principal');

    const existing = await db('sl_report_card_meta')
      .where({ tenant_id: tenantId, student_id, class_id, academic_year })
      .first();

    const fields = {
      principal_comment: payload.principal_comment ?? null,
      promotion_status: payload.promotion_status ?? null,
      average_age: payload.average_age ?? null,
      principal_signed_by: userId,
      updated_at: db.fn.now(),
    };

    if (existing) {
      await db('sl_report_card_meta').where({ id: existing.id }).update(fields);
    } else {
      await db('sl_report_card_meta').insert({
        tenant_id: tenantId, student_id, class_id, academic_year, ...fields,
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Attendance (fetched from the real attendance table, per term)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Resolve the [start, end] date window for each term from the academic
   * session(s) that match `academicYear`. The overall year span is split into
   * three equal date ranges (Term 1/2/3). Falls back to a standard SL calendar
   * derived from the year string when no session exists.
   *
   * IMPORTANT: the outer edges are open-ended — Term 1 has no lower bound and
   * Term 3 no upper bound. This guarantees that attendance recorded slightly
   * before the configured session start (e.g. an early orientation week) or
   * after its end is still attributed to a term instead of being silently
   * dropped, which previously made every term read 0 when the session dates
   * didn't tightly wrap the real attendance dates.
   */
  private async getTermDateWindows(
    tenantId: string,
    academicYear: string,
  ): Promise<TermWindows | null> {
    // Shared with the attendance pages (utils/termWindows) so the numbers agree.
    const w = await resolveTermWindows(tenantId, academicYear);
    if (!w) return null;
    // Attendance saved without a class counts for the year it falls in, using
    // the same window every attendance page uses (resolveYearScope).
    const scope = await resolveYearScope(tenantId, academicYear);
    const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
    return {
      first_term: w.first_term, second_term: w.second_term, third_term: w.third_term,
      year: { start: ymd(scope?.from ?? null), end: ymd(scope?.to ?? null) },
    };
  }

  /**
   * Count attendance for a student within a class over a date window.
   * Maps: On Time = 'present', Late = 'late', Absent = 'absent'.
   * Tenant isolation is enforced via the students join.
   */
  private async countAttendance(
    tenantId: string,
    studentId: string,
    classId: string,
    window: { start: string | null; end: string | null } | null,
    yearWindow: { start: string | null; end: string | null } | null,
  ): Promise<{ on_time: number; late: number; absent: number }> {
    let q = db('attendance')
      .join('students', 'attendance.student_id', 'students.id')
      .where('attendance.student_id', studentId)
      .where('students.tenant_id', tenantId)
      // Attendance may be recorded with the class_id or with a null class_id
      // (class_id is nullable). Match this class, or unscoped rows dated
      // inside THIS academic year (never another year's class-less rows).
      .where(function (this: any) {
        this.where('attendance.class_id', classId).orWhere(function (this: any) {
          this.whereNull('attendance.class_id');
          // Same rule as applyYearScope: [this year's start, next year's start).
          if (yearWindow?.start) this.where('attendance.attendance_date', '>=', yearWindow.start);
          if (yearWindow?.end) this.where('attendance.attendance_date', '<', yearWindow.end);
        });
      });

    // Apply each bound independently so an open-ended edge (null) does not
    // constrain the query — Term 1 has no lower bound, Term 3 no upper bound.
    // The end is exclusive (it is the next term's start).
    if (window?.start) q = q.where('attendance.attendance_date', '>=', window.start);
    if (window?.end) q = q.where('attendance.attendance_date', '<', window.end);

    // Count DISTINCT DAYS (not sessions) so multiple daily sessions
    // (morning/afternoon) count as ONE day. Each day is classified by its BEST
    // status — if the pupil attended ANY session that day they are counted
    // present; late only if they were late and never marked present; absent
    // only when every session that day was an absence.
    //   present/excused → 3 (best) · late → 2 · absent → 1 (worst)
    const rows = await q
      .select('attendance.attendance_date as d')
      .select(db.raw("MAX(CASE attendance.status WHEN 'present' THEN 3 WHEN 'excused' THEN 3 WHEN 'late' THEN 2 WHEN 'absent' THEN 1 ELSE 0 END) as rank"))
      .groupBy('attendance.attendance_date');

    let on_time = 0, late = 0, absent = 0;
    for (const r of rows as any[]) {
      const rank = Number(r.rank);
      if (rank === 3) on_time++;       // present/excused in at least one session
      else if (rank === 2) late++;     // late, never present
      else if (rank === 1) absent++;   // absent all day
    }
    return { on_time, late, absent };
  }

  /**
   * Public: attendance summary per term for a student in a class+year,
   * computed live from the attendance table.
   */
  async getAttendanceByTerm(
    tenantId: string,
    studentId: string,
    classId: string,
    academicYear: string,
  ): Promise<Record<SLTerm, { on_time: number; late: number; absent: number }>> {
    const windows = await this.getTermDateWindows(tenantId, academicYear);

    const result = {} as Record<SLTerm, { on_time: number; late: number; absent: number }>;
    for (const term of SL_TERMS) {
      const win = windows ? windows[term] : null;
      result[term] = await this.countAttendance(tenantId, studentId, classId, win, windows?.year ?? null);
    }
    return result;
  }

  /**
   * Public: whole-year attendance for a student in a class+year, computed live
   * from the attendance table with no per-term windowing. Used as the annual
   * total on the booklet so it always equals the sum of what actually happened,
   * independent of how the term boundaries fall.
   */
  async getAttendanceForYear(
    tenantId: string,
    studentId: string,
    classId: string,
    academicYear?: string,
  ): Promise<{ on_time: number; late: number; absent: number }> {
    const windows = academicYear ? await this.getTermDateWindows(tenantId, academicYear) : null;
    return this.countAttendance(tenantId, studentId, classId, null, windows?.year ?? null);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Read: class score grid (for entry screen)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Returns the score grid for a class+subject+term so the entry screen can
   * pre-fill existing values for every student in the class.
   */
  async getClassSubjectGrid(
    tenantId: string,
    classId: string,
    subjectId: string,
    term: string,
    academicYear: string,
  ): Promise<any[]> {
    await this.assertClassInTenant(classId, tenantId);

    // All students in the class (historic roster for a past year, so late
    // corrections to last year's scores are possible).
    const studentRows = await db('enrollments')
      .join('students', 'enrollments.student_id', 'students.id')
      .leftJoin('users', 'students.user_id', 'users.id')
      .where('enrollments.class_id', classId)
      .whereIn('enrollments.status', await this.rosterStatuses(classId))
      .where('students.tenant_id', tenantId)
      .distinctOn('students.id')
      .select(
        'students.id as student_id',
        'students.student_id as roll_number',
        db.raw("COALESCE(users.first_name || ' ' || users.last_name, students.student_id) as student_name"),
      )
      .orderBy('students.id');
    // Ordered by student ID (001, 002, 003 …) for a consistent results roster.
    const students = studentRows.sort((a: any, b: any) =>
      String(a.roll_number ?? '').localeCompare(String(b.roll_number ?? ''), undefined, { numeric: true }));

    const existing = await db('sl_subject_results')
      .where({ tenant_id: tenantId, class_id: classId, subject_id: subjectId, term, academic_year: academicYear })
      .select('student_id', 'test1', 'test2', 'mean', 'subject_rank');

    const byStudent: Record<string, any> = {};
    existing.forEach((e) => { byStudent[e.student_id] = e; });

    return students.map((s) => ({
      student_id: s.student_id,
      roll_number: s.roll_number,
      student_name: s.student_name,
      test1: byStudent[s.student_id]?.test1 ?? null,
      test2: byStudent[s.student_id]?.test2 ?? null,
      mean: byStudent[s.student_id]?.mean ?? null,
      subject_rank: byStudent[s.student_id]?.subject_rank ?? null,
    }));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // View authorization — who may read a student's report card
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Enforce who can VIEW a report card:
   *  - super_admin / principal: any student in the tenant.
   *  - teacher: only students in classes assigned to them, AND only if the
   *    principal allows teachers to view results.
   *  - student: only their OWN report, and only if PUBLISHED.
   *  - parent: only their ward's report, and only if PUBLISHED.
   */
  async assertCanViewReport(
    tenantId: string,
    viewerUserId: string,
    role: string,
    studentId: string,
    classId: string,
    academicYear: string,
    term?: string | null,
  ): Promise<void> {
    await this.assertStudentInTenant(studentId, tenantId);

    if (role === 'super_admin' || role === 'principal') return;

    if (role === 'teacher') {
      const settings = await this.getSettings(tenantId);
      if (!settings.allow_teacher_view_results) {
        throw new Error('Teachers are not permitted to view report cards');
      }
      const classIds = await this.getTeacherClassIds(viewerUserId, tenantId);
      if (!classIds.includes(classId)) {
        throw new Error('You can only view results for your assigned classes');
      }
      return;
    }

    // Accountant / admissions_officer may view published results for their
    // tenant (read-only) — same publish gate as students/parents.
    const publishGated = ['student', 'parent', 'accountant', 'admissions_officer'];

    if (role === 'student') {
      const student = await db('students').where({ id: studentId, tenant_id: tenantId }).first();
      if (!student || student.user_id !== viewerUserId) {
        throw new Error('You can only view your own report card');
      }
    } else if (role === 'parent') {
      const guardian = await db('guardians')
        .where({ student_id: studentId, user_id: viewerUserId })
        .first();
      if (!guardian) {
        throw new Error('You can only view your ward\'s report card');
      }
    } else if (!publishGated.includes(role)) {
      throw new Error('Not authorized to view report cards');
    }

    // Publish gate — term-aware.
    //  - A specific term requested → that term (or the whole year) must be released.
    //  - NO term requested (base JSON payload / report-cards page load) → ANY
    //    release (a single term OR the whole year) is enough to load the data.
    //    The payload's `published_terms` / `year_released` then tells the UI
    //    which terms to surface and whether the full booklet is available. This
    //    lets a single-term release (Term 1/2) render in the student/parent
    //    portal without requiring the whole year to be published.
    const ok = term
      ? await this.isPublished(tenantId, classId, academicYear, term)
      : await this.isAnythingPublished(tenantId, classId, academicYear);
    if (!ok) {
      throw new Error(term
        ? 'This term\'s results have not been released yet'
        : 'Results have not been released yet');
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Verification codes — a fresh code is generated on every report card
  // generation, so each printed copy has a unique QR.
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Generate and persist a NEW verification code for a student/class/year.
   * Called every time a report card is generated (viewed or PDF-exported)
   * so each copy gets a unique QR.
   */
  async generateVerificationCode(
    tenantId: string,
    studentId: string,
    classId: string,
    academicYear: string,
    generatedBy?: string,
  ): Promise<string> {
    // 32-char hex token — unique per generation
    const code = crypto.randomBytes(16).toString('hex');

    await db('sl_report_card_verification_codes').insert({
      tenant_id: tenantId,
      student_id: studentId,
      class_id: classId,
      academic_year: academicYear,
      verification_code: code,
      generated_by: generatedBy ?? null,
    });

    return code;
  }

  /**
   * Look up the latest active verification code for a student/class/year.
   * Returns null if none exists yet (caller should generate one).
   */
  async getLatestVerificationCode(
    tenantId: string,
    studentId: string,
    classId: string,
    academicYear: string,
  ): Promise<string | null> {
    const row = await db('sl_report_card_verification_codes')
      .where({
        tenant_id: tenantId,
        student_id: studentId,
        class_id: classId,
        academic_year: academicYear,
      })
      .orderBy('created_at', 'desc')
      .first();
    return row?.verification_code ?? null;
  }

  /**
   * Validate a verification code from a scanned QR.
   * Looks up the code in the DB; if found, returns the report card params.
   * Also supports the OLD deterministic-hash format as a fallback so
   * already-printed report cards continue to verify.
   */
  async resolveVerificationCode(
    code: string,
    studentId: string,
    academicYear: string,
  ): Promise<{ tenant_id: string; class_id: string; student_id: string; academic_year: string } | null> {
    // ── New format: look up the code in the DB ──
    const row = await db('sl_report_card_verification_codes')
      .where({ verification_code: code })
      .where({ student_id: studentId })
      .where({ academic_year: academicYear })
      .first();

    if (row) {
      return {
        tenant_id: row.tenant_id,
        class_id: row.class_id,
        student_id: row.student_id,
        academic_year: row.academic_year,
      };
    }

    // ── Old deterministic-hash fallback ──
    // The old hash was sha256(tenant:student:class:year)[:24].
    // We don't have the tenant_id here yet — try to find it from the student.
    const student = await db('students')
      .where({ id: studentId })
      .select('tenant_id')
      .first();

    if (!student) return null;

    // Try old 24-char hash format
    const oldHash = crypto.createHash('sha256')
      .update(`${student.tenant_id}:${studentId}:${code}:${academicYear}`)
      .digest('hex').slice(0, 24);
    // The code in the URL path IS the old hash, so compare directly:
    // (handled by the verify route, which calls this with code = hash)
    if (code.length === 24 && code === oldHash) {
      // Look up the class the student was in that year for the old format
      const classId = await this.classForStudentYear(studentId, academicYear);
      if (!classId) return null;
      return {
        tenant_id: student.tenant_id,
        class_id: classId,
        student_id: studentId,
        academic_year: academicYear,
      };
    }

    // Try old 16-char hash format (no class_id)
    const oldHash16 = crypto.createHash('sha256')
      .update(`${student.tenant_id}:${studentId}:${academicYear}`)
      .digest('hex').slice(0, 16);
    if (code.length === 16 && code === oldHash16) {
      const classId = await this.classForStudentYear(studentId, academicYear);
      if (!classId) return null;
      return {
        tenant_id: student.tenant_id,
        class_id: classId,
        student_id: studentId,
        academic_year: academicYear,
      };
    }

    return null;
  }

  /**
   * The class a student was in during an academic year: their enrollment in a
   * class of that year's session (enrollments have no academic_year column),
   * else the class their results that year were recorded under.
   */
  async classForStudentYear(studentId: string, academicYear: string): Promise<string | null> {
    const year = normalizeAcademicYear(academicYear);
    const rows = await db('enrollments as e')
      .join('classes as c', 'e.class_id', 'c.id')
      .leftJoin('academic_sessions as s', 'c.academic_session_id', 's.id')
      .where('e.student_id', studentId)
      .orderBy('e.updated_at', 'desc')
      .select('e.class_id', 's.name');
    const hit = rows.find((r: any) => r.name && normalizeAcademicYear(r.name) === year);
    if (hit) return hit.class_id;
    const res = await db('sl_subject_results').where({ student_id: studentId, academic_year: year }).orderBy('updated_at', 'desc').first('class_id');
    return res?.class_id ?? null;
  }

  /**
   * Build the full verification URL for a given code + params.
   */
  buildVerifyUrl(
    code: string,
    studentId: string,
    classId: string,
    academicYear: string,
  ): string {
    const verifyBase = (process.env.REPORT_CARD_VERIFY_URL || publicAppUrl()).replace(/\/+$/, '');
    const path = `/verify-report-card/${code}`;
    const qs = `?s=${studentId}&c=${classId}&y=${encodeURIComponent(academicYear)}`;
    return verifyBase ? `${verifyBase}${path}${qs}` : `${path}${qs}`;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Read: full report card booklet for one student for the whole year
  // ──────────────────────────────────────────────────────────────────────────

  async getReportCard(
    tenantId: string,
    studentId: string,
    classId: string,
    academicYear: string,
  ): Promise<any> {
    // Tenant guards: both the student AND the class must belong to this tenant
    await this.assertStudentInTenant(studentId, tenantId);
    await this.assertClassInTenant(classId, tenantId);

    // Student + class info (tenant-scoped)
    const student = await db('students')
      .leftJoin('users', 'students.user_id', 'users.id')
      .where('students.id', studentId)
      .where('students.tenant_id', tenantId)
      .select(
        'students.id',
        'students.student_id as admission_no',
        'students.date_of_birth',
        'students.gender',
        // Empty strings count as "no photo" so the account photo can be used.
        db.raw("COALESCE(NULLIF(students.photo_url, ''), NULLIF(users.photo_url, ''), NULLIF(users.profile_photo_url, '')) as photo_url"),
        db.raw("COALESCE(users.first_name || ' ' || users.last_name, students.student_id) as name"),
      )
      .first();

    // Pupil's age (whole years) from date_of_birth
    let pupilAge: number | null = null;
    if (student?.date_of_birth) {
      const dob = new Date(student.date_of_birth);
      const now = new Date();
      let age = now.getFullYear() - dob.getFullYear();
      const m = now.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
      pupilAge = age >= 0 ? age : null;
    }

    // Class + its form/class teacher (classes.class_teacher_id → teachers → users).
    // Class ownership already validated by assertClassInTenant above; the form-teacher
    // join is additionally scoped to the same tenant so a cross-tenant teacher can
    // never leak onto the report.
    const cls = await db('classes')
      .leftJoin('teachers', 'classes.class_teacher_id', 'teachers.id')
      .leftJoin('users as teacher_user', function () {
        this.on('teachers.user_id', '=', 'teacher_user.id')
          .andOn('teacher_user.tenant_id', '=', db.raw('?', [tenantId]));
      })
      .where('classes.id', classId)
      .select(
        'classes.id',
        'classes.name',
        'classes.level',
        db.raw("NULLIF(TRIM(COALESCE(teacher_user.first_name, '') || ' ' || COALESCE(teacher_user.last_name, '')), '') as form_teacher_name"),
      )
      .first();

    // Average age of the class (mean age of enrolled students, whole years)
    let averageAge: number | null = null;
    try {
      const dobRows = await db('enrollments')
        .join('students', 'enrollments.student_id', 'students.id')
        .where('enrollments.class_id', classId)
        .whereIn('enrollments.status', await this.rosterStatuses(classId))
        .where('students.tenant_id', tenantId)
        .whereNotNull('students.date_of_birth')
        .select('students.date_of_birth');

      if (dobRows.length > 0) {
        const now = new Date();
        const ages = dobRows.map((r: any) => {
          const dob = new Date(r.date_of_birth);
          let age = now.getFullYear() - dob.getFullYear();
          const m = now.getMonth() - dob.getMonth();
          if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
          return age;
        }).filter((a) => a >= 0 && a < 120);
        if (ages.length > 0) {
          averageAge = Math.round((ages.reduce((a, b) => a + b, 0) / ages.length) * 10) / 10;
        }
      }
    } catch {
      averageAge = null;
    }

    // All subject results for the year (all 3 terms)
    const results = await db('sl_subject_results')
      .join('subjects', 'sl_subject_results.subject_id', 'subjects.id')
      .where('sl_subject_results.tenant_id', tenantId)
      .where('sl_subject_results.student_id', studentId)
      .where('sl_subject_results.class_id', classId)
      .where('sl_subject_results.academic_year', academicYear)
      .select(
        'sl_subject_results.subject_id',
        'subjects.name as subject_name',
        'subjects.code as subject_code',
        'sl_subject_results.term',
        'sl_subject_results.test1',
        'sl_subject_results.test2',
        'sl_subject_results.mean',
        'sl_subject_results.subject_rank',
      );

    // Pivot subjects → per-term test1/test2/mean/rank + yearly aggregate
    const subjMap: Record<string, any> = {};
    for (const r of results) {
      const s = (subjMap[r.subject_id] ??= {
        subject_id: r.subject_id,
        subject_name: r.subject_name,
        subject_code: r.subject_code,
        terms: {},
      });
      s.terms[r.term] = {
        test1: r.test1 == null ? null : Number(r.test1),
        test2: r.test2 == null ? null : Number(r.test2),
        mean: r.mean == null ? null : Number(r.mean),
        rank: r.subject_rank,
      };
    }

    const subjects = Object.values(subjMap).map((s: any) => {
      const termMeans = SL_TERMS.map((t) => s.terms[t]?.mean).filter((m: any) => m != null) as number[];
      const yearlyMean = termMeans.length > 0 ? round1(termMeans.reduce((a, b) => a + b, 0) / termMeans.length) : null;
      return { ...s, yearly_mean: yearlyMean };
    });

    // Yearly subject rank — rank of this student's yearly mean for each subject
    // among ALL classmates' yearly means for that same subject (class ranking).
    const classYearlyRows = await db('sl_subject_results')
      .where({ tenant_id: tenantId, class_id: classId, academic_year: academicYear })
      .whereNotNull('mean')
      .select('student_id', 'subject_id', 'term', 'mean');

    // Per subject → list of per-student yearly means (avg of 3 terms)
    const bySubject: Record<string, { studentId: string; yearlyMean: number }[]> = {};
    const perStudentSubject: Record<string, Record<string, number[]>> = {};
    for (const r of classYearlyRows) {
      const subj = (perStudentSubject[r.student_id] ??= {});
      (subj[r.subject_id] ??= []).push(Number(r.mean));
    }
    for (const [sid, subjMeans] of Object.entries(perStudentSubject)) {
      for (const [subjectId, means] of Object.entries(subjMeans)) {
        const ym = means.reduce((a, b) => a + b, 0) / means.length;
        (bySubject[subjectId] ??= []).push({ studentId: sid, yearlyMean: round1(ym) });
      }
    }

    // Rank within each subject (competition ranking by yearly mean desc)
    const subjectYearlyRank: Record<string, number> = {}; // key = subjectId → this student's rank
    for (const [subjectId, entries] of Object.entries(bySubject)) {
      entries.sort((a, b) => b.yearlyMean - a.yearlyMean);
      let rank = 0;
      let prev: number | null = null;
      for (let i = 0; i < entries.length; i++) {
        if (prev === null || entries[i].yearlyMean !== prev) {
          rank = i + 1;
          prev = entries[i].yearlyMean;
        }
        if (entries[i].studentId === studentId) {
          subjectYearlyRank[subjectId] = rank;
        }
      }
    }
    subjects.forEach((s: any) => {
      s.yearly_rank = subjectYearlyRank[s.subject_id] ?? null;
    });

    // Term summaries (combined, %, position, conduct, comment)
    const summaries = await db('sl_term_summaries')
      .where({ tenant_id: tenantId, student_id: studentId, class_id: classId, academic_year: academicYear })
      .select('*');
    const summaryByTerm: Record<string, any> = {};
    summaries.forEach((s) => { summaryByTerm[s.term] = s; });

    // Attendance is ALWAYS sourced live from the attendance table (not manual),
    // computed per term. Overrides any stored values.
    const attendanceByTerm = await this.getAttendanceByTerm(tenantId, studentId, classId, academicYear);
    for (const term of SL_TERMS) {
      const att = attendanceByTerm[term];
      const existing = summaryByTerm[term] ?? {};
      summaryByTerm[term] = {
        ...existing,
        on_time: att.on_time,
        late: att.late,
        absent: att.absent,
      };
    }

    // Domain ratings — two ratings per test/term → per-term mean → yearly mean/rank
    const ratings = await db('sl_domain_ratings')
      .where({ tenant_id: tenantId, student_id: studentId, class_id: classId, academic_year: academicYear })
      .select('domain', 'trait_index', 'term', 'rating1', 'rating2');

    // domainRatings[domain][traitIndex] = { terms: { term: {r1,r2,mean} }, yearly_mean, yearly_rank }
    const domainRatings: Record<string, Record<number, any>> = { affective: {}, psychomotor: {} };
    for (const r of ratings) {
      const dm = (domainRatings[r.domain] ??= {});
      const trait = (dm[r.trait_index] ??= { terms: {} });
      const r1 = r.rating1 == null ? null : Number(r.rating1);
      const r2 = r.rating2 == null ? null : Number(r.rating2);
      let mean: number | null = null;
      if (r1 != null && r2 != null) mean = round1((r1 + r2) / 2);
      else if (r1 != null || r2 != null) mean = round1((r1 ?? r2)!);
      trait.terms[r.term] = { r1, r2, mean };
    }

    // Yearly mean + rank for each domain (rank of yearly means among that domain's traits)
    for (const domain of ['affective', 'psychomotor'] as const) {
      const dm = domainRatings[domain];
      const traitList = Object.keys(dm).map((k) => Number(k));
      // yearly mean per trait = mean of the term means
      for (const idx of traitList) {
        const termMeans = SL_TERMS.map((t) => dm[idx].terms[t]?.mean).filter((m: any) => m != null) as number[];
        dm[idx].yearly_mean = termMeans.length ? round1(termMeans.reduce((a, b) => a + b, 0) / termMeans.length) : null;
      }
      // yearly rank
      const ranked = traitList
        .filter((idx) => dm[idx].yearly_mean != null)
        .sort((a, b) => dm[b].yearly_mean - dm[a].yearly_mean);
      let rk = 0;
      let prev: number | null = null;
      ranked.forEach((idx, i) => {
        if (prev === null || dm[idx].yearly_mean !== prev) {
          rk = i + 1;
          prev = dm[idx].yearly_mean;
        }
        dm[idx].yearly_rank = rk;
      });
    }

    // ── Yearly summary + class position + promotion recommendation ──────────
    const yearlySummary = await this.computeYearlySummary(tenantId, classId, academicYear, studentId);

    // Total number of pupils in the form (class) — active enrollments.
    const numberInForm = await this.countStudentsInClass(tenantId, classId);

    // Meta
    const meta = await db('sl_report_card_meta')
      .where({ tenant_id: tenantId, student_id: studentId, class_id: classId, academic_year: academicYear })
      .first();

    // Build the verification QR URL. Uses the latest stored verification code,
    // or generates a new one if none exists yet. Each report card generation
    // (via the route layer) triggers a fresh code, so every printed copy
    // has a unique QR.
    let verifyCode = await this.getLatestVerificationCode(tenantId, studentId, classId, academicYear);
    if (!verifyCode) {
      // Fallback: generate one now if the route didn't already
      verifyCode = await this.generateVerificationCode(tenantId, studentId, classId, academicYear);
    }
    const verifyUrl = this.buildVerifyUrl(verifyCode, studentId, classId, academicYear);

    // Publication status — lets staff see a "DRAFT / not released" badge and
    // lets the viewer know which terms are released (Term 1/2 single sheets vs
    // the full Term 3 booklet).
    const { terms: publishedTerms, wholeYear: yearReleased } = await this.getPublishedTerms(tenantId, classId, academicYear);
    const published = yearReleased || publishedTerms.length > 0;

    return {
      id: `${studentId}:${classId}:${academicYear}`,
      student_id: studentId,
      class_id: classId,
      tenant_id: tenantId,
      verify_url: verifyUrl,
      is_published: published,
      published_terms: publishedTerms,
      year_released: yearReleased,
      student: {
        ...student,
        class_name: cls?.name,
        class_level: cls?.level,
        form_teacher_name: cls?.form_teacher_name ?? null,
        pupil_age: pupilAge,
        class_average_age: averageAge,
        number_in_form: numberInForm,
      },
      academic_year: academicYear,
      subjects,
      term_summaries: {
        first_term: summaryByTerm['first_term'] ?? null,
        second_term: summaryByTerm['second_term'] ?? null,
        third_term: summaryByTerm['third_term'] ?? null,
      },
      yearly_summary: yearlySummary,
      domain_ratings: domainRatings,
      affective_traits: AFFECTIVE_TRAITS,
      psychomotor_skills: PSYCHOMOTOR_SKILLS,
      conduct_legend: CONDUCT_LEGEND,
      meta: meta ?? null,
    };
  }


  /**
   * Remove everything not yet released from a report card for a publish-gated
   * viewer: unreleased terms' scores, summaries, ratings and attendance, and
   * (until the whole year is released) the yearly figures and promotion. The
   * UI used to hide these; now they never leave the server.
   */
  redactUnreleased(card: any, role: string): any {
    if (!PUBLISH_GATED_ROLES.includes(role) || !card) return card;
    if (card.year_released) return card;
    const released = new Set<string>(card.published_terms || []);
    const hidden = SL_TERMS.filter((t) => !released.has(t));
    const out = { ...card };
    out.subjects = (card.subjects || []).map((s: any) => {
      const terms = { ...(s.terms || {}) };
      for (const t of hidden) delete terms[t];
      const means = SL_TERMS.map((t) => terms[t]?.mean).filter((m: any) => m != null) as number[];
      return { ...s, terms, yearly_mean: null, yearly_rank: null, released_mean: means.length ? round1(means.reduce((a, b) => a + b, 0) / means.length) : null };
    });
    out.term_summaries = { ...(card.term_summaries || {}) };
    for (const t of hidden) out.term_summaries[t] = null;
    out.domain_ratings = Object.fromEntries(Object.entries(card.domain_ratings || {}).map(([domain, traits]: [string, any]) => [
      domain,
      Object.fromEntries(Object.entries(traits || {}).map(([idx, tr]: [string, any]) => {
        const terms = { ...(tr?.terms || {}) };
        for (const t of hidden) delete terms[t];
        return [idx, { ...tr, terms, yearly_mean: null, yearly_rank: null }];
      })),
    ]));
    out.yearly_summary = null;
    out.meta = card.meta ? { ...card.meta, promotion_status: null } : card.meta;
    return out;
  }

  /**
   * Compute the YEARLY combined score, percentage, class position and a
   * promotion recommendation for a student — evaluated across the whole class
   * so the yearly position is the student's final rank for the year.
   *
   * Promotion rule (from the school's grading policy):
   *   - Below 50%      → Fail (To Repeat)
   *   - 50% to 55%     → Promoted (Needs More Effort)
   *   - Above 55%      → Promoted
   */
  /**
   * Count the total number of pupils in a class ("No. in Form") — based on
   * active enrollments, so it reflects the real class roster size regardless of
   * whether results have been entered.
   */
  private async countStudentsInClass(tenantId: string, classId: string): Promise<number> {
    const row = await db('enrollments')
      .join('students', 'enrollments.student_id', 'students.id')
      .where('enrollments.class_id', classId)
      .whereIn('enrollments.status', await this.rosterStatuses(classId))
      .where('students.tenant_id', tenantId)
      .countDistinct('students.id as count')
      .first();
    return Number(row?.count ?? 0);
  }

  private async computeYearlySummary(
    tenantId: string,
    classId: string,
    academicYear: string,
    targetStudentId: string,
  ): Promise<{
    combined_score: number | null;
    percentage: number | null;
    position: number | null;
    class_size: number | null;
    promotion_recommendation: string | null;
    outcome: 'fail' | 'promoted_effort' | 'promoted' | null;
  }> {
    // Pull every subject mean for the class across all terms
    const rows = await db('sl_subject_results')
      .where({ tenant_id: tenantId, class_id: classId, academic_year: academicYear })
      .whereNotNull('mean')
      .select('student_id', 'subject_id', 'term', 'mean');

    if (rows.length === 0) {
      return { combined_score: null, percentage: null, position: null, class_size: null, promotion_recommendation: null, outcome: null };
    }

    // Per student → per subject → collect the 3 term means, average to a yearly subject mean.
    const perStudent: Record<string, Record<string, number[]>> = {};
    for (const r of rows) {
      const subj = (perStudent[r.student_id] ??= {});
      (subj[r.subject_id] ??= []).push(Number(r.mean));
    }

    // Yearly combined = sum of yearly subject means; percentage = combined / subjectCount
    const students = Object.keys(perStudent).map((sid) => {
      const subjects = perStudent[sid];
      const subjectYearlyMeans = Object.values(subjects).map(
        (means) => means.reduce((a, b) => a + b, 0) / means.length,
      );
      const combined = round1(subjectYearlyMeans.reduce((a, b) => a + b, 0));
      const percentage = subjectYearlyMeans.length > 0
        ? round1(combined / subjectYearlyMeans.length)
        : 0;
      return { student_id: sid, combined_score: combined, percentage };
    });

    // Yearly class position by combined score (competition ranking)
    students.sort((a, b) => b.combined_score - a.combined_score);
    let position = 0;
    let prev: number | null = null;
    const classSize = students.length;
    students.forEach((s, i) => {
      if (prev === null || s.combined_score !== prev) {
        position = i + 1;
        prev = s.combined_score;
      }
      (s as any).position = position;
    });

    const me = students.find((s) => s.student_id === targetStudentId);
    if (!me) {
      return { combined_score: null, percentage: null, position: null, class_size: classSize, promotion_recommendation: null, outcome: null };
    }

    // Promotion thresholds — configurable via school_config_settings
    // (keys: promotion_fail_threshold, promotion_effort_threshold)
    const schoolRow = await db('schools').where({ tenant_id: tenantId }).first().catch(() => null);
    let failThreshold = 50;
    let effortThreshold = 55;
    if (schoolRow?.school_id) {
      const settings = await db('school_config_settings')
        .where({ school_id: schoolRow.school_id })
        .whereIn('setting_key', ['promotion_fail_threshold', 'promotion_effort_threshold'])
        .catch(() => []);
      for (const s of settings) {
        const v = Number(s.setting_value);
        if (isNaN(v)) continue;
        if (s.setting_key === 'promotion_fail_threshold') failThreshold = v;
        if (s.setting_key === 'promotion_effort_threshold') effortThreshold = v;
      }
    }

    // Promotion recommendation from the yearly percentage
    let outcome: 'fail' | 'promoted_effort' | 'promoted';
    let recommendation: string;
    if (me.percentage < failThreshold) {
      outcome = 'fail';
      recommendation = `TO REPEAT (Below ${failThreshold}%)`;
    } else if (me.percentage <= effortThreshold) {
      outcome = 'promoted_effort';
      recommendation = 'PROMOTED — Needs More Effort';
    } else {
      outcome = 'promoted';
      recommendation = 'PROMOTED';
    }

    return {
      combined_score: me.combined_score,
      percentage: me.percentage,
      position: (me as any).position,
      class_size: classSize,
      promotion_recommendation: recommendation,
      outcome,
    };
  }

  /**
   * Student results summary for the profile "Academics" tab.
   * Returns every SL subject result for the student (all classes/terms/years),
   * using the CORRECT SL semantics: Test 1, Test 2, Mean (0–100) + grade.
   * This is the single source of truth (same data as the report booklet) —
   * NOT the legacy `results` table (CA/Exam) which is no longer used.
   */
  async getStudentResultsSummary(
    tenantId: string,
    studentId: string,
    academicYear?: string | null,
  ): Promise<{
    stats: { subjects: number; avg_test1: number; avg_test2: number; avg_mean: number };
    results: Array<{
      id: string;
      subject_name: string;
      subject_code: string | null;
      academic_year: string;
      term: string;
      test1: number | null;
      test2: number | null;
      mean: number | null;
      subject_rank: number | null;
      grade_letter: string;
      remark: string;
    }>;
  }> {
    await this.assertStudentInTenant(studentId, tenantId);

    // Load tenant's configured grading scale
    const gradingScale = await getTenantGradingScale(tenantId);

    const rows: any[] = await db('sl_subject_results as sr')
      .join('subjects as s', 'sr.subject_id', 's.id')
      .where('sr.tenant_id', tenantId)
      .where('sr.student_id', studentId)
      .select(
        'sr.id',
        's.name as subject_name',
        's.code as subject_code',
        'sr.academic_year',
        'sr.term',
        'sr.test1',
        'sr.test2',
        'sr.mean',
        'sr.subject_rank',
      )
      // Optional academic-year scope (results carry their own year string).
      .modify((q: any) => { if (academicYear) q.where('sr.academic_year', academicYear); })
      .orderBy('sr.academic_year', 'desc')
      .orderBy('sr.term', 'asc')
      .orderBy('s.name', 'asc');

    const results = rows.map((r: any) => {
      const mean = r.mean != null ? Number(r.mean) : null;
      const g = mean != null ? computeGradeWithScale(mean, gradingScale) : { letter: '—', remark: '—' };
      return {
        id: r.id,
        subject_name: r.subject_name,
        subject_code: r.subject_code ?? null,
        academic_year: r.academic_year,
        term: r.term,
        test1: r.test1 != null ? Number(r.test1) : null,
        test2: r.test2 != null ? Number(r.test2) : null,
        mean,
        subject_rank: r.subject_rank ?? null,
        grade_letter: g.letter,
        remark: g.remark,
      };
    });

    const t1s = results.map((r) => r.test1).filter((n): n is number => n != null);
    const t2s = results.map((r) => r.test2).filter((n): n is number => n != null);
    const means = results.map((r) => r.mean).filter((n): n is number => n != null);
    const avg = (arr: number[]) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0);

    return {
      stats: {
        subjects: results.length,
        avg_test1: avg(t1s),
        avg_test2: avg(t2s),
        avg_mean: avg(means),
      },
      results,
    };
  }
}

export default new SLReportCardService();
