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

export type RosterEntity = 'classes' | 'students' | 'subjects' | 'timetable';

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

    let written = 0;
    await db.transaction('rw', db.classes, db.students, db.subjects, db.timetable, db.sync_meta, async () => {
      if (d.classes?.length) { await db.classes.bulkPut(toCached(d.classes)); written += d.classes.length; }
      if (d.students?.length) { await db.students.bulkPut(toCached(d.students)); written += d.students.length; }
      if (d.subjects?.length) { await db.subjects.bulkPut(toCached(d.subjects)); written += d.subjects.length; }
      if (d.timetable?.length) { await db.timetable.bulkPut(toCached(d.timetable)); written += d.timetable.length; }
      await db.sync_meta.put({ key: SYNC_KEY, lastPulledAt: d.serverTime, lastPushedAt: meta?.lastPushedAt });
    });

    return written;
  },
};

export default rosterRepo;
