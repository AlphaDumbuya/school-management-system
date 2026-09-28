/**
 * academicYearService — safe "start a new academic year" rollover.
 *
 * Opening a new year is NON-DESTRUCTIVE: it archives the current session
 * (is_active=false) and activates/creates the new one, then optionally CLONES
 * the current session's active classes into brand-new rows bound to the new
 * session. It never deletes or mutates prior-year data — each year's classes,
 * enrollments, grades and results remain as immutable history.
 *
 * Why clone classes (instead of reusing rows): report-card results key by
 * class_id + academic_year string. Reusing one class row across years makes
 * year attribution fragile. Fresh class rows per session keep history clean and
 * let the previous year's `next_class_id` mapping drive promotions.
 */
import db from '../utils/database.js';
import { logger } from '../utils/logger.js';

const YEAR_RE = /^\d{4}\/\d{4}$/;

export interface StartNewYearInput {
  tenantId: string;
  userId: string;
  newYearName: string;              // "YYYY/YYYY"
  startDate?: string | null;
  endDate?: string | null;
  cloneClasses?: boolean;           // default true
}

export interface StartNewYearResult {
  sessionId: string;
  created: boolean;                 // true if a new session row was inserted
  classesCloned: number;
  classesSkipped: number;           // already existed in the new session
  previousSessionId: string | null;
  previousYearName: string | null;
}

class AcademicYearService {
  /**
   * Create/activate the new session and (optionally) carry classes forward.
   * Runs in a transaction so the year switch + class clone are atomic.
   */
  async startNewAcademicYear(input: StartNewYearInput): Promise<StartNewYearResult> {
    const { tenantId, userId } = input;
    const name = String(input.newYearName || '').trim();
    if (!YEAR_RE.test(name)) {
      throw new Error('New academic year must be in the format YYYY/YYYY');
    }
    const cloneClasses = input.cloneClasses !== false; // default true
    const startDate = input.startDate || new Date().toISOString().slice(0, 10);
    const endDate =
      input.endDate ||
      new Date(Date.now() + 300 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    return db.transaction(async (trx) => {
      // Identify the currently-active session (the "previous" year) BEFORE switching.
      const prev = await trx('academic_sessions')
        .where({ tenant_id: tenantId, is_active: true })
        .orderBy('updated_at', 'desc')
        .first();
      const previousSessionId: string | null = prev?.id ?? null;
      const previousYearName: string | null = prev?.name ?? null;

      // Archive all sessions for the tenant (single-active enforced by index too).
      await trx('academic_sessions').where({ tenant_id: tenantId }).update({ is_active: false });

      // Upsert the new session by (tenant_id, name).
      let session = await trx('academic_sessions')
        .where({ tenant_id: tenantId, name })
        .first();
      let created = false;
      if (session) {
        await trx('academic_sessions')
          .where({ id: session.id })
          .update({ start_date: startDate, end_date: endDate, is_active: true, updated_at: new Date() });
      } else {
        const [row] = await trx('academic_sessions')
          .insert({
            tenant_id: tenantId,
            name,
            start_date: startDate,
            end_date: endDate,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returning('*');
        session = row;
        created = true;
      }
      const sessionId: string = session.id;

      // Persist the academic_year setting string so the rest of the app agrees.
      const existingSetting = await trx('school_config_settings')
        .where({ tenant_id: tenantId, setting_key: 'academic_year' })
        .first()
        .catch(() => null);
      if (existingSetting) {
        await trx('school_config_settings')
          .where({ id: existingSetting.id })
          .update({ setting_value: name, updated_at: new Date() })
          .catch(() => undefined);
      }

      let classesCloned = 0;
      let classesSkipped = 0;

      if (cloneClasses && previousSessionId && previousSessionId !== sessionId) {
        const prevClasses = await trx('classes')
          .where({ academic_session_id: previousSessionId, status: 'active' })
          .select('*');

        // Map old class id → new class id so we can rebuild next_class_id links.
        const idMap = new Map<string, string>();

        // First pass: create the new class rows (without next_class_id).
        for (const c of prevClasses) {
          // Skip if a same-named class already exists in the new session.
          const dupe = await trx('classes')
            .where({ academic_session_id: sessionId })
            .whereRaw('LOWER(name) = ?', [String(c.name).toLowerCase()])
            .where('level', c.level)
            .modify((q: any) => {
              if (c.section) q.whereRaw('LOWER(section) = ?', [String(c.section).toLowerCase()]);
              else q.whereNull('section');
            })
            .first();
          if (dupe) {
            idMap.set(c.id, dupe.id);
            classesSkipped++;
            continue;
          }
          const [row] = await trx('classes')
            .insert({
              name: c.name,
              level: c.level,
              section: c.section ?? null,
              capacity: c.capacity,
              academic_session_id: sessionId,
              class_teacher_id: c.class_teacher_id ?? null,
              room_number: c.room_number ?? null,
              floor: c.floor ?? null,
              building: c.building ?? null,
              is_final_year: c.is_final_year ?? false,
              status: 'active',
              created_by: userId,
              created_at: new Date(),
              updated_at: new Date(),
            })
            .returning('id');
          const newId = typeof row === 'object' ? row.id : row;
          idMap.set(c.id, newId);
          classesCloned++;
        }

        // Second pass: rewrite next_class_id to point at the NEW cloned classes.
        for (const c of prevClasses) {
          if (!c.next_class_id) continue;
          const newId = idMap.get(c.id);
          const mappedNext = idMap.get(c.next_class_id);
          if (newId && mappedNext) {
            await trx('classes').where({ id: newId }).update({ next_class_id: mappedNext, updated_at: new Date() });
          }
        }
      }

      logger.info(
        `Started new academic year "${name}" for tenant ${tenantId}: ` +
        `session ${created ? 'created' : 'reactivated'}, ${classesCloned} classes cloned, ${classesSkipped} skipped`,
      );

      return {
        sessionId,
        created,
        classesCloned,
        classesSkipped,
        previousSessionId,
        previousYearName,
      };
    });
  }
}

export default new AcademicYearService();
