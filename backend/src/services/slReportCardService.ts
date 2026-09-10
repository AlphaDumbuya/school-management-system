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
import { logger } from '../utils/logger.js';
import promotionService from './promotionService.js';

export const SL_TERMS = ['first_term', 'second_term', 'third_term'] as const;
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

export function getGrade(score: number): { letter: string; remark: string; isFail: boolean } {
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

  private async assertClassInTenant(classId: string, tenantId: string): Promise<void> {
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
    await this.assertClassInTenant(payload.class_id, tenantId);
    const updated = await db('sl_subject_results')
      .where({
        tenant_id: tenantId,
        class_id: payload.class_id,
        subject_id: payload.subject_id,
        term: payload.term,
        academic_year: payload.academic_year,
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
    payload: { class_id: string; academic_year: string; term?: string | null; published: boolean },
  ): Promise<{ auto_promotion?: { ran: boolean; reason?: string; promoted: number; repeated: number; graduated: number; skipped: number } }> {
    await this.assertClassInTenant(payload.class_id, tenantId);
    const term = payload.term ?? null;
    const existing = await db('sl_report_publications')
      .where({ tenant_id: tenantId, class_id: payload.class_id, academic_year: payload.academic_year, term })
      .first();

    const fields = {
      is_published: payload.published,
      published_at: payload.published ? db.fn.now() : null,
      published_by: payload.published ? userId : null,
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

    // Notify guardians by email that report cards are now available (only on
    // publish, best-effort, never blocks the publish action).
    if (payload.published) {
      this.notifyReportCardPublished(tenantId, payload.class_id, payload.academic_year, term).catch((err) =>
        logger.warn(`Report card published emails failed for class ${payload.class_id}: ${err?.message || err}`),
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

    const students = await db('enrollments')
      .join('students', 'enrollments.student_id', 'students.id')
      .where('enrollments.class_id', classId)
      .where('enrollments.status', 'active')
      .where('students.tenant_id', tenantId)
      .select(
        'students.id as student_id',
        'students.first_name',
        'students.last_name',
        'students.email as student_email',
      );

    const { default: emailService } = await import('./emailService');

    for (const s of students) {
      try {
        const studentName = [s.first_name, s.last_name].filter(Boolean).join(' ') || 'your child';

        // Prefer an active guardian's email; fall back to the student's.
        let recipientEmail: string | null = s.student_email || null;
        let recipientName = studentName;
        const link = await db('student_guardians')
          .where({ student_id: s.student_id, status: 'active' })
          .first()
          .catch(() => null);
        if (link?.guardian_id) {
          const guardian = await db('users').where({ id: link.guardian_id }).first().catch(() => null);
          if (guardian?.email) {
            recipientEmail = guardian.email;
            recipientName = [guardian.first_name, guardian.last_name].filter(Boolean).join(' ') || recipientName;
          }
        }
        if (!recipientEmail) continue;

        await emailService.sendReportCardPublishedEmail(tenantId, recipientEmail, {
          recipientName,
          studentName,
          className,
          term: term || 'Full Year',
          academicYear,
        });
      } catch (err) {
        logger.warn(`Report card email failed for student ${s.student_id}: ${(err as any)?.message || err}`);
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
    const { class_id, subject_id, academic_year, term, scores } = payload;
    const role = ctx?.role ?? 'principal';

    if (!class_id || !subject_id || !academic_year || !term || !Array.isArray(scores)) {
      throw new Error('class_id, subject_id, academic_year, term and scores[] are required');
    }
    if (!SL_TERMS.includes(term)) throw new Error('Invalid term');

    await this.assertClassInTenant(class_id, tenantId);
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
   * Subject rank = rank of each subject's mean among a student's OWN subjects
   * for that term (1 = highest mean). Recomputed per student.
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
      .select('id', 'student_id', 'mean');

    // Group by student
    const byStudent: Record<string, { id: string; mean: number }[]> = {};
    for (const r of rows) {
      (byStudent[r.student_id] ??= []).push({ id: r.id, mean: Number(r.mean) });
    }

    await db.transaction(async (trx) => {
      for (const studentId of Object.keys(byStudent)) {
        const subjects = byStudent[studentId].sort((a, b) => b.mean - a.mean);
        // Standard competition ranking (ties share the rank)
        let rank = 0;
        let prevMean: number | null = null;
        for (let i = 0; i < subjects.length; i++) {
          if (prevMean === null || subjects[i].mean !== prevMean) {
            rank = i + 1;
            prevMean = subjects[i].mean;
          }
          await trx('sl_subject_results').where({ id: subjects[i].id }).update({ subject_rank: rank });
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
    const { student_id, class_id, academic_year, term, affective, psychomotor } = payload;
    const role = ctx?.role ?? 'principal';

    await this.assertStudentInTenant(student_id, tenantId);
    await this.assertClassInTenant(class_id, tenantId);
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
    const { student_id, class_id, academic_year, term } = payload;
    const role = ctx?.role ?? 'principal';
    await this.assertStudentInTenant(student_id, tenantId);
    await this.assertClassInTenant(class_id, tenantId);
    await this.assertTeacherScope(userId, tenantId, role, class_id);

    const existing = await db('sl_term_summaries')
      .where({ tenant_id: tenantId, student_id, class_id, term, academic_year })
      .first();

    const fields = {
      conduct: payload.conduct ?? null,
      teacher_comment: payload.teacher_comment ?? null,
      teacher_signed_by: userId,
      updated_at: db.fn.now(),
    };

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
    const { student_id, class_id, academic_year } = payload;
    await this.assertStudentInTenant(student_id, tenantId);
    await this.assertClassInTenant(class_id, tenantId);

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
   * session that matches `academicYear`. The session is split into three equal
   * date ranges (Term 1/2/3). Falls back to null if no matching session — in
   * which case the whole year is used as a single window.
   */
  private async getTermDateWindows(
    tenantId: string,
    academicYear: string,
  ): Promise<Record<SLTerm, { start: Date; end: Date }> | null> {
    // Match session by name containing the academic year (e.g. "2025/2026")
    const session = await db('academic_sessions')
      .where('tenant_id', tenantId)
      .where(function () {
        this.where('name', 'ilike', `%${academicYear}%`);
      })
      .orderBy('start_date', 'desc')
      .first();

    if (!session?.start_date || !session?.end_date) return null;

    const start = new Date(session.start_date);
    const end = new Date(session.end_date);
    const totalMs = end.getTime() - start.getTime();
    if (totalMs <= 0) return null;

    const third = totalMs / 3;
    const t1End = new Date(start.getTime() + third);
    const t2End = new Date(start.getTime() + third * 2);

    return {
      first_term: { start, end: t1End },
      second_term: { start: t1End, end: t2End },
      third_term: { start: t2End, end },
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
    window: { start: Date; end: Date } | null,
  ): Promise<{ on_time: number; late: number; absent: number }> {
    let q = db('attendance')
      .join('students', 'attendance.student_id', 'students.id')
      .where('attendance.student_id', studentId)
      .where('attendance.class_id', classId)
      .where('students.tenant_id', tenantId);

    if (window) {
      q = q.whereBetween('attendance.attendance_date', [
        window.start.toISOString().slice(0, 10),
        window.end.toISOString().slice(0, 10),
      ]);
    }

    const row = await q
      .select(
        db.raw("COUNT(*) FILTER (WHERE attendance.status = 'present') as on_time"),
        db.raw("COUNT(*) FILTER (WHERE attendance.status = 'late') as late"),
        db.raw("COUNT(*) FILTER (WHERE attendance.status = 'absent') as absent"),
      )
      .first();

    return {
      on_time: parseInt(String((row as any)?.on_time ?? 0), 10) || 0,
      late: parseInt(String((row as any)?.late ?? 0), 10) || 0,
      absent: parseInt(String((row as any)?.absent ?? 0), 10) || 0,
    };
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
      result[term] = await this.countAttendance(tenantId, studentId, classId, win);
    }
    return result;
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

    // All students enrolled in the class (via enrollments)
    const students = await db('enrollments')
      .join('students', 'enrollments.student_id', 'students.id')
      .leftJoin('users', 'students.user_id', 'users.id')
      .where('enrollments.class_id', classId)
      .where('enrollments.status', 'active')
      .where('students.tenant_id', tenantId)
      .select(
        'students.id as student_id',
        'students.student_id as roll_number',
        db.raw("COALESCE(users.first_name || ' ' || users.last_name, students.student_id) as student_name"),
      )
      // Ordered by student ID (001, 002, 003 …) for a consistent results roster.
      .orderBy('students.student_id', 'asc');

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

    if (role === 'student') {
      const student = await db('students').where({ id: studentId, tenant_id: tenantId }).first();
      if (!student || student.user_id !== viewerUserId) {
        throw new Error('You can only view your own report card');
      }
      if (!(await this.isPublished(tenantId, classId, academicYear))) {
        throw new Error('Your results have not been published yet');
      }
      return;
    }

    if (role === 'parent') {
      const guardian = await db('guardians')
        .where({ student_id: studentId, user_id: viewerUserId })
        .first();
      if (!guardian) {
        throw new Error('You can only view your ward\'s report card');
      }
      if (!(await this.isPublished(tenantId, classId, academicYear))) {
        throw new Error('Results have not been published yet');
      }
      return;
    }

    throw new Error('Not authorized to view report cards');
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
        .where('enrollments.status', 'active')
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

    // Yearly subject rank (rank of yearly means among the student's subjects)
    const ranked = subjects
      .filter((s: any) => s.yearly_mean != null)
      .sort((a: any, b: any) => b.yearly_mean - a.yearly_mean);
    let yrRank = 0;
    let prevYr: number | null = null;
    ranked.forEach((s: any, i: number) => {
      if (prevYr === null || s.yearly_mean !== prevYr) {
        yrRank = i + 1;
        prevYr = s.yearly_mean;
      }
      s.yearly_rank = yrRank;
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

    return {
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
      .where('enrollments.status', 'active')
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

    // Promotion recommendation from the yearly percentage
    let outcome: 'fail' | 'promoted_effort' | 'promoted';
    let recommendation: string;
    if (me.percentage < 50) {
      outcome = 'fail';
      recommendation = 'TO REPEAT (Below 50%)';
    } else if (me.percentage <= 55) {
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

    const rows = await db('sl_subject_results as sr')
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
      .orderBy('sr.academic_year', 'desc')
      .orderBy('sr.term', 'asc')
      .orderBy('s.name', 'asc');

    const results = rows.map((r: any) => {
      const mean = r.mean != null ? Number(r.mean) : null;
      const g = mean != null ? getGrade(mean) : { letter: '—', remark: '—' };
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
