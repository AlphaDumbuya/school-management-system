/**
 * Promotion Service
 * =================
 * End-of-year student promotion. Computes each student's yearly outcome from
 * the SL report-card subject results (same math as the report booklet), then
 * lets a principal bulk-promote a class to a target (next) class. Promoting a
 * student closes their current active enrollment and creates a new active
 * enrollment in the target class. All queries are tenant-scoped.
 *
 * Promotion rule (school policy):
 *   - Below 50%   → repeated  (To Repeat)
 *   - 50% to 55%  → promoted_effort (Promoted, Needs More Effort)
 *   - Above 55%   → promoted
 */

import db from '../utils/database.js';
import { logger } from '../utils/logger.js';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export type PromotionOutcome = 'promoted' | 'promoted_effort' | 'repeated' | 'graduated';

/** "JSS 3", "jss3", "JSS-3" → "JSS3". */
export const normLevel = (level?: string | null) => String(level || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Stage-end classes and the first class of the next stage (Sierra Leone). */
const STAGE_NEXT: Record<string, string> = { NURSERY3: 'CLASS1', CLASS6: 'JSS1', JSS3: 'SSS1' };
const KNOWN_LEVELS = new Set([
  'NURSERY1', 'NURSERY2', 'NURSERY3',
  'CLASS1', 'CLASS2', 'CLASS3', 'CLASS4', 'CLASS5', 'CLASS6',
  'JSS1', 'JSS2', 'JSS3', 'SSS1', 'SSS2', 'SSS3',
]);

/**
 * What "graduating" from a class means. SSS 3 (or an unrecognised custom
 * level) leaves the school. Nursery 3, Class 6 and JSS 3 move up a stage, and
 * any other known level just promotes.
 */
export function graduationKind(level?: string | null): { leavesSchool: boolean; nextLevel: string | null } {
  const l = normLevel(level);
  // No level set: trust the school's own "final year" choice.
  if (l === 'SSS3' || !KNOWN_LEVELS.has(l)) return { leavesSchool: true, nextLevel: null };
  return { leavesSchool: false, nextLevel: STAGE_NEXT[l] ?? null };
}

export interface PromotionCandidate {
  student_id: string;
  student_name: string;
  student_reg_id: string | null;
  combined_score: number | null;
  percentage: number | null;
  position: number | null;
  class_size: number;
  outcome: PromotionOutcome | null;
  recommendation: string | null;
  already_promoted: boolean;
}

class PromotionService {
  private async assertClassInTenant(classId: string, tenantId: string): Promise<void> {
    // A class belongs to this tenant if its session belongs to the tenant OR it
    // has no session but was created by a user of this tenant (matches the
    // canonical resolution used by the class list, which is why such classes
    // appear in the dropdown).
    const c = await db('classes')
      .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
      .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
      .where('classes.id', classId)
      .where(function (this: any) {
        this.where('academic_sessions.tenant_id', tenantId)
          .orWhere(function (this: any) {
            this.whereNull('classes.academic_session_id')
              .where('class_creator.tenant_id', tenantId);
          });
      })
      .first('classes.id');
    if (!c) throw new Error('Class not found for this tenant');
  }

  /**
   * Compute promotion candidates for a class + academic year.
   * Uses sl_subject_results (per-term subject means) to derive each student's
   * yearly percentage, class position, and a promotion outcome.
   */
  async getClassPromotionCandidates(
    tenantId: string,
    classId: string,
    academicYear: string,
  ): Promise<{ class_size: number; candidates: PromotionCandidate[] }> {
    await this.assertClassInTenant(classId, tenantId);

    // Roster: all actively enrolled students in the class (with names).
    const roster = await db('enrollments')
      .join('students', 'enrollments.student_id', 'students.id')
      .leftJoin('users', 'students.user_id', 'users.id')
      .where('enrollments.class_id', classId)
      // 'completed' = carried into the new year's copy of this class; they can
      // still be promoted on last year's results.
      .whereIn('enrollments.status', ['active', 'completed'])
      .where('students.tenant_id', tenantId)
      .distinct()
      .select(
        'students.id as student_id',
        'students.student_id as student_reg_id',
        db.raw("COALESCE(users.first_name, students.first_name, '') as first_name"),
        db.raw("COALESCE(users.last_name, students.last_name, '') as last_name"),
      );

    // Already-promoted students for this year (idempotency / re-run safety).
    const promoted = await db('student_promotions')
      .where({ tenant_id: tenantId, from_class_id: classId, academic_year: academicYear })
      .select('student_id', 'outcome');
    const promotedMap = new Map<string, string>(promoted.map((p: any) => [p.student_id, p.outcome]));

    // All subject means for the class/year across every term.
    const rows = await db('sl_subject_results')
      .where({ tenant_id: tenantId, class_id: classId, academic_year: academicYear })
      .whereNotNull('mean')
      .select('student_id', 'subject_id', 'mean');

    // student → subject → [term means]
    const perStudent: Record<string, Record<string, number[]>> = {};
    for (const r of rows) {
      const subj = (perStudent[r.student_id] ??= {});
      (subj[r.subject_id] ??= []).push(Number(r.mean));
    }

    // Yearly combined + percentage per student that has results.
    const scored = Object.keys(perStudent).map((sid) => {
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

    // Competition ranking by combined score.
    scored.sort((a, b) => b.combined_score - a.combined_score);
    let position = 0;
    let prev: number | null = null;
    scored.forEach((s, i) => {
      if (prev === null || s.combined_score !== prev) {
        position = i + 1;
        prev = s.combined_score;
      }
      (s as any).position = position;
    });
    const scoreMap = new Map(scored.map((s) => [s.student_id, s]));
    const classSize = roster.length;

    const candidates: PromotionCandidate[] = roster.map((r: any) => {
      const s = scoreMap.get(r.student_id);
      let outcome: PromotionOutcome | null = null;
      let recommendation: string | null = null;

      if (s) {
        if (s.percentage < 50) {
          outcome = 'repeated';
          recommendation = 'TO REPEAT (Below 50%)';
        } else if (s.percentage <= 55) {
          outcome = 'promoted_effort';
          recommendation = 'PROMOTED — Needs More Effort';
        } else {
          outcome = 'promoted';
          recommendation = 'PROMOTED';
        }
      } else {
        recommendation = 'No results entered';
      }

      return {
        student_id: r.student_id,
        student_name: `${r.first_name} ${r.last_name}`.trim() || r.student_reg_id || 'Student',
        student_reg_id: r.student_reg_id ?? null,
        combined_score: s?.combined_score ?? null,
        percentage: s?.percentage ?? null,
        position: (s as any)?.position ?? null,
        class_size: classSize,
        outcome,
        recommendation,
        already_promoted: promotedMap.has(r.student_id),
      };
    });

    // Order by position (unranked/no-results last), then name.
    candidates.sort((a, b) => {
      if (a.position == null && b.position == null) return a.student_name.localeCompare(b.student_name);
      if (a.position == null) return 1;
      if (b.position == null) return -1;
      return a.position - b.position;
    });

    return { class_size: classSize, candidates };
  }

  /**
   * Execute promotions for a set of students. Each decision specifies the
   * outcome and (for promotions) the target class. Runs in a transaction.
   */
  async executePromotions(
    tenantId: string,
    userId: string,
    payload: {
      from_class_id: string;
      academic_year: string;
      to_class_id?: string | null; // default target for promoted students
      graduate?: boolean;          // if true, promoted students graduate instead of moving
      source?: 'manual' | 'auto';
      decisions: Array<{
        student_id: string;
        outcome: PromotionOutcome;
        to_class_id?: string | null; // per-student override
        percentage?: number | null;
        position?: number | null;
        notes?: string;
      }>;
    },
  ): Promise<{ promoted: number; repeated: number; graduated: number; skipped: number }> {
    await this.assertClassInTenant(payload.from_class_id, tenantId);

    // Sierra Leone stages: Nursery 3 → Class 1, Class 6 → JSS 1 and JSS 3 →
    // SSS 1 are STAGE graduations. The child stays in the school and moves up
    // into the next stage, so they're promotions with a target class. Only
    // SSS 3 (or a custom school's final class with an unrecognised level)
    // takes the child out of the school.
    const fromClass = await db('classes').where({ id: payload.from_class_id }).first('level', 'next_class_id', 'academic_session_id');
    const stage = graduationKind(fromClass?.level);
    const leavesSchool = stage.leavesSchool;
    if (!leavesSchool && payload.graduate) {
      // Treat "graduate the class" as "move them into the next stage".
      payload = {
        ...payload,
        graduate: false,
        to_class_id: payload.to_class_id
          ?? fromClass?.next_class_id
          ?? (stage.nextLevel ? await this.findStageClass(tenantId, stage.nextLevel) : null),
      };
    }
    // A per-student "graduated" below SSS 3 also becomes a stage move.
    const stageMove = !leavesSchool;

    const defaultTarget = payload.graduate ? null : payload.to_class_id ?? null;
    if (!payload.graduate) {
      if (stageMove && payload.decisions.some((d) => d.outcome === 'graduated' && !d.to_class_id) && !defaultTarget) {
        throw new Error(`Choose the ${stage.nextLevel ? stage.nextLevel.replace(/(\D+)(\d)/, '$1 $2') : 'next'} class these students move into. Graduating from ${String(fromClass?.level || 'this class')} moves them up a stage; only SSS 3 leaves the school.`);
      }
      // Validate default target class belongs to tenant (if any promotions need it).
      const needsTarget = payload.decisions.some(
        (d) => (d.outcome === 'promoted' || d.outcome === 'promoted_effort') && !d.to_class_id,
      );
      if (needsTarget) {
        if (!defaultTarget) {
          throw new Error('A target class is required to promote students');
        }
        await this.assertClassInTenant(defaultTarget, tenantId);
      }
    }

    // Validate any per-student target classes too.
    const perStudentTargets = Array.from(
      new Set(payload.decisions.map((d) => d.to_class_id).filter(Boolean) as string[]),
    );
    for (const t of perStudentTargets) {
      await this.assertClassInTenant(t, tenantId);
    }

    // Target session (for the new enrollment) — derive from the target class.
    const counters = { promoted: 0, repeated: 0, graduated: 0, skipped: 0 };

    const trx = await db.transaction();
    try {
      for (const d of payload.decisions) {
        // Skip if already recorded for this year (idempotent re-runs).
        const existing = await trx('student_promotions')
          .where({ tenant_id: tenantId, student_id: d.student_id, academic_year: payload.academic_year })
          .first();
        if (existing) { counters.skipped++; continue; }

        // The student's current place: active in the source class, or — after
        // a new year was started — active in that class's new-year copy.
        const enrollment = await trx('enrollments')
          .join('students', 'enrollments.student_id', 'students.id')
          .join('classes as ec', 'enrollments.class_id', 'ec.id')
          .where('enrollments.student_id', d.student_id)
          .where((q) => q.where('enrollments.class_id', payload.from_class_id).orWhere('ec.carried_from_id', payload.from_class_id))
          .where('enrollments.status', 'active')
          .where('students.tenant_id', tenantId)
          .orderByRaw('CASE WHEN enrollments.class_id = ? THEN 1 ELSE 0 END', [payload.from_class_id])
          .select('enrollments.id as enrollment_id', 'enrollments.class_id as current_class_id', 'ec.academic_session_id as current_session_id')
          .first();

        if (!enrollment) { counters.skipped++; continue; }

        // Below SSS 3, "graduated" means moving up into the next stage.
        const isPromotion = d.outcome === 'promoted' || d.outcome === 'promoted_effort' || (d.outcome === 'graduated' && stageMove);
        let target = d.to_class_id ?? defaultTarget;
        // Target picked from last year (e.g. the old next-class link) but the
        // student is already in the new year → use the target's new-year copy.
        if (target) {
          const tc = await trx('classes').where({ id: target }).first('academic_session_id');
          if (tc && tc.academic_session_id !== enrollment.current_session_id) {
            const copy = await trx('classes')
              .where({ carried_from_id: target, academic_session_id: enrollment.current_session_id })
              .first('id');
            if (copy) target = copy.id;
          }
        }

        if ((d.outcome === 'graduated' && leavesSchool) || (isPromotion && payload.graduate)) {
          // Graduating: close enrollment, mark student graduated, no new class.
          await trx('enrollments')
            .where({ id: enrollment.enrollment_id })
            .update({ status: 'promoted', updated_at: trx.fn.now() });
          await trx('students')
            .where({ id: d.student_id, tenant_id: tenantId })
            .update({ status: 'graduated', updated_at: trx.fn.now() });
          counters.graduated++;
        } else if (isPromotion) {
          if (!target) { counters.skipped++; continue; }

          // Close current enrollment.
          await trx('enrollments')
            .where({ id: enrollment.enrollment_id })
            .update({ status: 'promoted', updated_at: trx.fn.now() });

          // Determine the target class's academic session for the new enrollment.
          const targetClass = await trx('classes').where({ id: target }).first('academic_session_id');

          // Create the new active enrollment (guard against duplicates).
          const dupe = await trx('enrollments')
            .where({ student_id: d.student_id, class_id: target })
            .first();
          if (!dupe) {
            await trx('enrollments').insert({
              student_id: d.student_id,
              class_id: target,
              academic_session_id: targetClass?.academic_session_id,
              enrollment_date: trx.fn.now(),
              status: 'active',
            });
          } else {
            await trx('enrollments')
              .where({ id: dupe.id })
              .update({ status: 'active', updated_at: trx.fn.now() });
          }
          counters.promoted++;
        } else {
          // Repeated: the student stays in the same class. If a newer year
          // already has that class's copy, place them there so they follow
          // the school into the current year; otherwise nothing moves.
          const copy = enrollment.current_class_id === payload.from_class_id
            ? await trx('classes as c')
                .join('academic_sessions as s', 'c.academic_session_id', 's.id')
                .where({ 'c.carried_from_id': payload.from_class_id, 's.is_active': true })
                .first('c.id', 'c.academic_session_id')
            : null;
          if (copy) {
            await trx('enrollments').where({ id: enrollment.enrollment_id })
              .update({ status: 'completed', updated_at: trx.fn.now() });
            await trx('enrollments')
              .insert({
                student_id: d.student_id, class_id: copy.id, academic_session_id: copy.academic_session_id,
                enrollment_date: trx.fn.now(), status: 'active',
              })
              .onConflict(['student_id', 'class_id', 'academic_session_id'])
              .merge({ status: 'active', updated_at: trx.fn.now() });
          }
          counters.repeated++;
        }

        // Audit record.
        await trx('student_promotions').insert({
          tenant_id: tenantId,
          student_id: d.student_id,
          from_class_id: payload.from_class_id,
          to_class_id: isPromotion && !payload.graduate ? target : null,
          academic_year: payload.academic_year,
          outcome: d.outcome,
          yearly_percentage: d.percentage ?? null,
          yearly_position: d.position ?? null,
          source: payload.source ?? 'manual',
          decided_by: userId,
          notes: d.notes ?? null,
        });
      }

      await trx.commit();
      logger.info(
        `Promotions executed for class ${payload.from_class_id} (${payload.academic_year}): ` +
        `${counters.promoted} promoted, ${counters.repeated} repeated, ${counters.graduated} graduated, ${counters.skipped} skipped`,
      );
      return counters;
    } catch (error) {
      await trx.rollback();
      logger.error('Error executing promotions:', error);
      throw error;
    }
  }

  /**
   * The single current-year class at a level (e.g. "JSS1") for a stage move,
   * or null when there is none or several (e.g. SSS 1 streams), in which case
   * the principal must choose.
   */
  async findStageClass(tenantId: string, level: string): Promise<string | null> {
    const rows = await db('classes as c')
      .join('academic_sessions as s', 'c.academic_session_id', 's.id')
      .where('s.tenant_id', tenantId)
      .where('s.is_active', true)
      .whereNot('c.status', 'inactive')
      .select('c.id', 'c.level');
    const matches = rows.filter((r: any) => normLevel(r.level) === level);
    return matches.length === 1 ? String(matches[0].id) : null;
  }

  /**
   * AUTOMATIC promotion for a class based on yearly average.
   * Uses the class's `next_class_id` / `is_final_year` mapping so no manual
   * target selection is needed. Passing students (>=50%) are promoted (or
   * graduated for final-year classes); failing students stay. Students with no
   * results are skipped. Safe to re-run (already-promoted students are skipped).
   *
   * Returns a summary plus a `skippedNoTarget` flag when promotion can't run
   * because the class has no next class configured and isn't a final year.
   */
  async autoPromoteClass(
    tenantId: string,
    classId: string,
    academicYear: string,
    userId: string,
  ): Promise<{
    ran: boolean;
    reason?: string;
    promoted: number;
    repeated: number;
    graduated: number;
    skipped: number;
  }> {
    await this.assertClassInTenant(classId, tenantId);

    const cls = await db('classes').where({ id: classId }).first('next_class_id', 'is_final_year');
    // "Final year" only leaves the school at SSS 3. A stage end (Nursery 3,
    // Class 6, JSS 3) flagged final is treated as moving up a stage.
    const clsLevel = await db('classes').where({ id: classId }).first('level');
    const kind = graduationKind(clsLevel?.level);
    const isFinal = !!cls?.is_final_year && kind.leavesSchool;
    if (cls && !cls.next_class_id && !kind.leavesSchool && kind.nextLevel) {
      cls.next_class_id = await this.findStageClass(tenantId, kind.nextLevel);
    }
    const nextClassId: string | null = cls?.next_class_id ?? null;

    // If not final year and no next class configured, we can't auto-move.
    if (!isFinal && !nextClassId) {
      return { ran: false, reason: 'no_next_class', promoted: 0, repeated: 0, graduated: 0, skipped: 0 };
    }

    const { candidates } = await this.getClassPromotionCandidates(tenantId, classId, academicYear);

    // Build decisions from the computed yearly outcomes. Only students with a
    // computed outcome (i.e. have results) are acted upon.
    const decisions = candidates
      .filter((c) => !c.already_promoted && c.outcome)
      .map((c) => ({
        student_id: c.student_id,
        outcome: c.outcome as PromotionOutcome,
        percentage: c.percentage,
        position: c.position,
      }));

    if (decisions.length === 0) {
      return { ran: true, promoted: 0, repeated: 0, graduated: 0, skipped: 0 };
    }

    const result = await this.executePromotions(tenantId, userId, {
      from_class_id: classId,
      academic_year: academicYear,
      to_class_id: nextClassId,
      graduate: isFinal,
      source: 'auto',
      decisions,
    });

    return { ran: true, ...result };
  }

  /** Promotion history for a class + year (audit list). */
  async getPromotionHistory(
    tenantId: string,
    filters: { class_id?: string; academic_year?: string },
  ): Promise<any[]> {
    let q = db('student_promotions as sp')
      .leftJoin('students as st', 'sp.student_id', 'st.id')
      .leftJoin('users as u', 'st.user_id', 'u.id')
      .leftJoin('classes as fc', 'sp.from_class_id', 'fc.id')
      .leftJoin('classes as tc', 'sp.to_class_id', 'tc.id')
      .where('sp.tenant_id', tenantId)
      .select(
        'sp.*',
        db.raw("CONCAT(COALESCE(u.first_name, st.first_name, ''), ' ', COALESCE(u.last_name, st.last_name, '')) as student_name"),
        'st.student_id as student_reg_id',
        'fc.name as from_class_name',
        'tc.name as to_class_name',
      )
      .orderBy('sp.created_at', 'desc');

    if (filters.class_id) q = q.where('sp.from_class_id', filters.class_id);
    if (filters.academic_year) q = q.where('sp.academic_year', filters.academic_year);

    return q;
  }
}

export default new PromotionService();
