/**
 * rosterRepo — read-through cache for the teacher's supporting data:
 * classes, students, subjects, and timetable (schedules).
 *
 * Reads come from the local Dexie cache (works offline). When online, a
 * `refresh()` pulls teacher-scoped changes from the server and upserts them
 * into the cache, advancing the incremental sync bookmark.
 *
 * The cached read tables are server-authoritative (pull only) — teachers don't
 * edit these; they edit attendance/grades/assignments (separate repos).
 */
import { getOfflineDb, type CachedRow } from '../db';
import { syncClient } from '../syncClient';
import { evictStale } from '../storage';

export type RosterEntity = 'classes' | 'students' | 'subjects' | 'timetable' | 'enrollments';

const SYNC_KEY = 'roster';

function toCached(rows: any[]): CachedRow[] {
  const now = Date.now();
  return (rows || [])
    .filter((r) => r && r.id)
    .map((r) => ({ id: r.id, data: r, cachedAt: now }));
}

export const rosterRepo = {
  /** Read all cached rows for an entity (offline-safe). */
  async list(userId: string, entity: RosterEntity): Promise<any[]> {
    const db = getOfflineDb(userId);
    const rows = await db[entity].toArray();
    return rows.map((r) => r.data);
  },

  /** Read a single cached record by id. */
  async get(userId: string, entity: RosterEntity, id: string): Promise<any | undefined> {
    const db = getOfflineDb(userId);
    const row = await db[entity].get(id);
    return row?.data;
  },

  /**
   * Offline-safe list of students enrolled in a class, resolved from the cached
   * `enrollments` + `students` tables. Used as the attendance register's
   * fallback when the network student query returns nothing (offline).
   */
  async studentsForClass(userId: string, classId: string): Promise<any[]> {
    const db = getOfflineDb(userId);
    const [enrollRows, studentRows] = await Promise.all([
      db.enrollments.toArray(),
      db.students.toArray(),
    ]);
    const studentIds = new Set(
      enrollRows
        .map((e) => e.data)
        .filter((e) => e && String(e.class_id) === String(classId))
        .map((e) => String(e.student_id))
    );
    return studentRows
      .map((r) => r.data)
      .filter((s) => s && studentIds.has(String(s.id)));
  },

  /** When was the roster last refreshed from the server? */
  async lastSyncedAt(userId: string): Promise<string | undefined> {
    const db = getOfflineDb(userId);
    const meta = await db.sync_meta.get(SYNC_KEY);
    return meta?.lastPulledAt;
  },

  /**
   * Pull teacher-scoped changes and upsert into the cache. Uses the stored
   * bookmark for an incremental refresh; pass `full` to re-pull everything.
   * Returns the number of rows written. No-op semantics when offline (throws,
   * caller should catch and keep serving cache).
   */
  async refresh(userId: string, opts?: { full?: boolean }): Promise<number> {
    const db = getOfflineDb(userId);
    const meta = await db.sync_meta.get(SYNC_KEY);
    const since = opts?.full ? undefined : meta?.lastPulledAt;

    const res = await syncClient.pull(since);
    if (!res.success || !res.data) return 0;
    const d = res.data;

    // A class the teacher was just given isn't in an incremental delta (its row
    // didn't change), so re-pull everything once when the scope gains a class.
    if (since && d.scope) {
      const cached = new Set((await db.classes.toCollection().primaryKeys()).map(String));
      if (d.scope.class_ids.some((id) => !cached.has(String(id)))) {
        return this.refresh(userId, { full: true });
      }
    }

    let written = 0;
    await db.transaction('rw', [db.classes, db.students, db.subjects, db.timetable, db.enrollments, db.sync_meta], async () => {
      if (d.classes?.length) { await db.classes.bulkPut(toCached(d.classes)); written += d.classes.length; }
      if (d.students?.length) { await db.students.bulkPut(toCached(d.students)); written += d.students.length; }
      if (d.subjects?.length) { await db.subjects.bulkPut(toCached(d.subjects)); written += d.subjects.length; }
      if (d.timetable?.length) { await db.timetable.bulkPut(toCached(d.timetable)); written += d.timetable.length; }
      // Enrollments come as the FULL current set: replace, so a promoted or
      // moved student leaves the old class register offline too.
      if (d.scope || (d as any).enrollments?.length) {
        await db.enrollments.clear();
        if ((d as any).enrollments?.length) { await db.enrollments.bulkPut(toCached((d as any).enrollments)); written += (d as any).enrollments.length; }
      }
      // Promotions/reassignments: drop classes (and their timetable) the
      // teacher no longer has, and students no longer in any of their classes.
      if (d.scope) {
        const keepClasses = new Set(d.scope.class_ids.map(String));
        const keepStudents = new Set(d.scope.student_ids.map(String));
        const goneClasses = (await db.classes.toCollection().primaryKeys()).filter((id) => !keepClasses.has(String(id)));
        if (goneClasses.length) await db.classes.bulkDelete(goneClasses);
        const goneSlots = (await db.timetable.toArray()).filter((r) => !keepClasses.has(String(r.data?.class_id))).map((r) => r.id);
        if (goneSlots.length) await db.timetable.bulkDelete(goneSlots);
        const goneStudents = (await db.students.toCollection().primaryKeys()).filter((id) => !keepStudents.has(String(id)));
        if (goneStudents.length) await db.students.bulkDelete(goneStudents);
      }
      await db.sync_meta.put({ key: SYNC_KEY, lastPulledAt: d.serverTime, lastPushedAt: meta?.lastPushedAt });
    });

    // TTL-evict stale cached rows after a successful refresh (best-effort).
    await evictStale(userId).catch(() => 0);

    return written;
  },
};

export default rosterRepo;
