/**
 * academicYearService — "start a new academic year" rollover.
 *
 * Starting a new year moves the WHOLE school into it, not just the label:
 *   1. archive the current session, activate/create the new one
 *   2. carry forward last year's setup into the new year:
 *        classes (new rows, linked via carried_from_id, next-class map rebuilt)
 *        class subjects, teacher assignments, timetable, fee structures
 *   3. move every active student into their class for the new year:
 *        - their CURRENT class carried forward (a student already promoted
 *          last year sits in their new class, so they land in its clone)
 *        - graduated / inactive students are not carried
 *
 * Non-destructive: last year's rows are never deleted or edited apart from
 * closing the old enrollment (status 'completed') and ending last year's
 * teacher assignments, so history (results, attendance, fees) stays intact.
 * Idempotent: re-running for the same pair of years only fills what's missing.
 * Rolling BACK to an older year only re-activates it — nothing is carried.
 */
import type { Knex } from 'knex';
import db from '../utils/database.js';
import { logger } from '../utils/logger.js';

const YEAR_RE = /^\d{4}\/\d{4}$/;

export interface StartNewYearInput {
  tenantId: string;
  userId: string;
  newYearName: string;              // "YYYY/YYYY"
  startDate?: string | null;
  endDate?: string | null;
  cloneClasses?: boolean;           // default true — carry setup + students forward
}

export interface CarryForwardResult {
  classesCloned: number;
  classesSkipped: number;           // already existed in the new year
  subjectsCopied: number;
  assignmentsCopied: number;
  timetableCopied: number;
  feeStructuresCopied: number;
  studentsMoved: number;
}

export interface StartNewYearResult extends CarryForwardResult {
  sessionId: string;
  created: boolean;
  previousSessionId: string | null;
  previousYearName: string | null;
  carriedForward: boolean;
}

const EMPTY: CarryForwardResult = {
  classesCloned: 0, classesSkipped: 0, subjectsCopied: 0, assignmentsCopied: 0,
  timetableCopied: 0, feeStructuresCopied: 0, studentsMoved: 0,
};

const today = () => new Date().toISOString().slice(0, 10);
const startYear = (name: string | null | undefined) => {
  const m = /^(\d{4})\//.exec(String(name || ''));
  return m ? Number(m[1]) : NaN;
};

class AcademicYearService {
  async startNewAcademicYear(input: StartNewYearInput): Promise<StartNewYearResult> {
    const { tenantId, userId } = input;
    const name = String(input.newYearName || '').trim();
    if (!YEAR_RE.test(name)) {
      throw new Error('New academic year must be in the format YYYY/YYYY');
    }
    const carry = input.cloneClasses !== false;
    const startDate = input.startDate || today();
    const endDate =
      input.endDate || new Date(Date.now() + 300 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const result = await db.transaction(async (trx) => {
      const prev = await trx('academic_sessions')
        .where({ tenant_id: tenantId, is_active: true })
        .orderBy('updated_at', 'desc')
        .first();

      await trx('academic_sessions').where({ tenant_id: tenantId }).update({ is_active: false });

      let session = await trx('academic_sessions').where({ tenant_id: tenantId, name }).first();
      let created = false;
      if (session) {
        await trx('academic_sessions')
          .where({ id: session.id })
          .update({ start_date: startDate, end_date: endDate, is_active: true, updated_at: new Date() });
      } else {
        [session] = await trx('academic_sessions')
          .insert({
            tenant_id: tenantId, name, start_date: startDate, end_date: endDate,
            is_active: true, created_at: new Date(), updated_at: new Date(),
          })
          .returning('*');
        created = true;
      }

      await this.saveYearSetting(trx, tenantId, name);

      // Only carry FORWARD (to a later year). Switching back just re-activates.
      const isForward = !!prev && prev.id !== session.id && startYear(name) > startYear(prev.name);
      const counts = carry && isForward
        ? await this.carryForward(trx, tenantId, userId, prev, session)
        : { ...EMPTY };

      return {
        sessionId: session.id as string,
        created,
        previousSessionId: prev?.id ?? null,
        previousYearName: prev?.name ?? null,
        carriedForward: carry && isForward,
        ...counts,
      };
    });

    logger.info(`Academic year "${name}" started for tenant ${tenantId}: ${JSON.stringify(result)}`);
    return result;
  }

  /**
   * Re-run the carry-forward from the previous year into the ACTIVE year
   * (e.g. a year was started before this feature existed). Idempotent.
   */
  async carryForwardIntoActive(tenantId: string, userId: string): Promise<CarryForwardResult & { fromYear: string | null; toYear: string | null }> {
    return db.transaction(async (trx) => {
      const active = await trx('academic_sessions').where({ tenant_id: tenantId, is_active: true }).first();
      if (!active) throw new Error('No active academic year');
      const older = (await trx('academic_sessions').where({ tenant_id: tenantId }).whereNot({ id: active.id }))
        .filter((s: any) => startYear(s.name) < startYear(active.name))
        .sort((a: any, b: any) => startYear(b.name) - startYear(a.name));
      const prev = older[0];
      if (!prev) return { ...EMPTY, fromYear: null, toYear: active.name };
      const counts = await this.carryForward(trx, tenantId, userId, prev, active);
      return { ...counts, fromYear: prev.name, toYear: active.name };
    });
  }

  private async saveYearSetting(trx: Knex.Transaction, tenantId: string, name: string) {
    const existing = await trx('school_config_settings')
      .where({ tenant_id: tenantId, setting_key: 'academic_year' })
      .first();
    if (existing) {
      await trx('school_config_settings')
        .where({ tenant_id: tenantId, setting_key: 'academic_year' })
        .update({ setting_value: name, updated_at: new Date() });
    }
  }

  /** Copy last year's setup + students into the new year. Idempotent. */
  private async carryForward(
    trx: Knex.Transaction,
    tenantId: string,
    userId: string,
    from: { id: string; name: string },
    to: { id: string; name: string },
  ): Promise<CarryForwardResult> {
    const out: CarryForwardResult = { ...EMPTY };
    const prevClasses = await trx('classes')
      .where({ academic_session_id: from.id, status: 'active' })
      .select('*');
    if (prevClasses.length === 0) return out;

    // ── Classes ────────────────────────────────────────────────────────────
    const idMap = new Map<string, string>(); // old class id → new class id
    for (const c of prevClasses) {
      let target = await trx('classes')
        .where({ academic_session_id: to.id, carried_from_id: c.id })
        .first('id');
      if (!target) {
        // A same-named class may already exist in the new year (created by
        // hand or by an earlier rollover) — adopt it instead of duplicating.
        target = await trx('classes')
          .where({ academic_session_id: to.id })
          .whereNull('carried_from_id')
          .whereRaw('LOWER(name) = ?', [String(c.name).toLowerCase()])
          .modify((q: any) => {
            if (c.level) q.where('level', c.level); else q.whereNull('level');
            if (c.section) q.whereRaw('LOWER(section) = ?', [String(c.section).toLowerCase()]);
            else q.whereNull('section');
          })
          .first('id');
        if (target) {
          await trx('classes').where({ id: target.id }).update({ carried_from_id: c.id, updated_at: new Date() });
        }
      }
      if (target) {
        idMap.set(c.id, target.id);
        out.classesSkipped++;
        continue;
      }
      const [row] = await trx('classes')
        .insert({
          name: c.name, level: c.level, section: c.section ?? null, capacity: c.capacity,
          academic_session_id: to.id, carried_from_id: c.id,
          class_teacher_id: c.class_teacher_id ?? null, room_number: c.room_number ?? null,
          floor: c.floor ?? null, building: c.building ?? null,
          is_final_year: c.is_final_year ?? false, status: 'active',
          created_by: userId, created_at: new Date(), updated_at: new Date(),
        })
        .returning('id');
      idMap.set(c.id, typeof row === 'object' ? row.id : row);
      out.classesCloned++;
    }

    // Next-class map in the new year mirrors last year's (only where unset).
    for (const c of prevClasses) {
      const newId = idMap.get(c.id);
      const mappedNext = c.next_class_id ? idMap.get(c.next_class_id) : undefined;
      if (newId && mappedNext) {
        await trx('classes').where({ id: newId }).whereNull('next_class_id')
          .update({ next_class_id: mappedNext, updated_at: new Date() });
      }
    }

    const oldIds = [...idMap.keys()];

    // ── Class subjects ─────────────────────────────────────────────────────
    const subjects = await trx('class_subjects').whereIn('class_id', oldIds).select('class_id', 'subject_id');
    for (const s of subjects) {
      const inserted = await trx('class_subjects')
        .insert({ class_id: idMap.get(s.class_id), subject_id: s.subject_id, created_at: new Date() })
        .onConflict(['class_id', 'subject_id']).ignore()
        .returning('id');
      out.subjectsCopied += inserted.length;
    }

    // ── Teacher assignments (current ones only) ─────────────────────────────
    const assignments = await trx('teacher_assignments')
      .whereIn('class_id', oldIds)
      .where((q) => q.whereNull('end_date').orWhere('end_date', '>=', today()))
      .select('id', 'teacher_id', 'subject_id', 'class_id');
    for (const a of assignments) {
      const newClass = idMap.get(a.class_id)!;
      const exists = await trx('teacher_assignments')
        .where({ teacher_id: a.teacher_id, subject_id: a.subject_id, class_id: newClass })
        .first('id');
      if (!exists) {
        await trx('teacher_assignments').insert({
          teacher_id: a.teacher_id, subject_id: a.subject_id, class_id: newClass,
          start_date: today(), created_at: new Date(), updated_at: new Date(),
        });
        out.assignmentsCopied++;
      }
    }
    if (assignments.length) {
      // Last year's assignments end today — history kept, no longer "current".
      await trx('teacher_assignments').whereIn('id', assignments.map((a: any) => a.id))
        .update({ end_date: today(), updated_at: new Date() });
    }

    // ── Timetable (only for new classes that have none yet) ─────────────────
    for (const [oldId, newId] of idMap) {
      const has = await trx('schedules').where({ class_id: newId }).first('id');
      if (has) continue;
      const rows = await trx('schedules').where({ class_id: oldId })
        .select('subject_id', 'teacher_id', 'day_of_week', 'start_time', 'end_time', 'room_number', 'is_published');
      if (rows.length) {
        await trx('schedules').insert(rows.map((r: any) => ({
          ...r, class_id: newId, academic_session_id: to.id, created_by: userId,
          published_by: r.is_published ? userId : null, published_at: r.is_published ? new Date() : null,
          created_at: new Date(), updated_at: new Date(),
        })));
        out.timetableCopied += rows.length;
      }
    }

    // ── Fee structures (templates only — nobody is billed automatically) ────
    const structures = await trx('fee_structures')
      .where({ tenant_id: tenantId, academic_year: from.name })
      .whereIn('class_id', oldIds);
    for (const s of structures) {
      const newClass = idMap.get(s.class_id)!;
      const exists = await trx('fee_structures')
        .where({ tenant_id: tenantId, class_id: newClass, academic_year: to.name }).first('id');
      if (exists) continue;
      const { id: oldStructureId, created_at: _c, updated_at: _u, ...rest } = s;
      const [ns] = await trx('fee_structures')
        .insert({ ...rest, class_id: newClass, academic_year: to.name, created_by: userId, created_at: new Date(), updated_at: new Date() })
        .returning('id');
      const newStructureId = typeof ns === 'object' ? ns.id : ns;
      // Keep each expense's optional/required flag (column defaults to required).
      const expenses = await trx('fee_structure_expenses').where({ structure_id: oldStructureId }).select('label', 'amount', 'required');
      if (expenses.length) {
        await trx('fee_structure_expenses').insert(expenses.map((e: any) => ({ ...e, structure_id: newStructureId })));
      }
      out.feeStructuresCopied++;
    }

    // ── Students: move each active enrollment into its class's new-year copy ─
    const enrollments = await trx('enrollments')
      .join('students', 'enrollments.student_id', 'students.id')
      .whereIn('enrollments.class_id', oldIds)
      .whereIn('enrollments.status', ['active', 'enrolled'])
      .where('students.tenant_id', tenantId)
      .whereIn('students.status', ['active', 'enrolled'])
      .select('enrollments.id', 'enrollments.student_id', 'enrollments.class_id', 'enrollments.roll_number');
    for (const e of enrollments) {
      const newClass = idMap.get(e.class_id)!;
      // Already placed in the new year (e.g. promoted straight into it)? Just close the old one.
      const placed = await trx('enrollments')
        .where({ student_id: e.student_id, academic_session_id: to.id })
        .whereIn('status', ['active', 'enrolled'])
        .first('id');
      if (!placed) {
        await trx('enrollments')
          .insert({
            student_id: e.student_id, class_id: newClass, academic_session_id: to.id,
            enrollment_date: today(), status: 'active', roll_number: e.roll_number ?? null,
            created_at: new Date(), updated_at: new Date(),
          })
          .onConflict(['student_id', 'class_id', 'academic_session_id'])
          .merge({ status: 'active', updated_at: new Date() });
        out.studentsMoved++;
      }
      await trx('enrollments').where({ id: e.id }).update({ status: 'completed', updated_at: new Date() });
    }

    return out;
  }
}

export default new AcademicYearService();
