/**
 * storage — offline cache & storage management (Req 11).
 *
 *  - estimateUsage(): how much origin storage the app uses (best-effort).
 *  - counts(): rows in the read cache + pending writes.
 *  - clearReadCache(): drop cached roster tables but PRESERVE un-synced writes
 *    (outbox + pending rows). Cheap way to reclaim space on low-end phones.
 *  - evictStale(): TTL eviction of old cached read rows (called on refresh).
 */
import { getOfflineDb } from './db';

const READ_TABLES = ['classes', 'students', 'subjects', 'timetable'] as const;
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface StorageEstimate {
  usageBytes: number;
  quotaBytes: number;
  percent: number;
}

export async function estimateUsage(): Promise<StorageEstimate | null> {
  try {
    if (!navigator.storage?.estimate) return null;
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usageBytes: usage, quotaBytes: quota, percent: quota ? Math.round((usage / quota) * 100) : 0 };
  } catch {
    return null;
  }
}

export async function counts(userId: string): Promise<{ cached: number; pending: number }> {
  const db = getOfflineDb(userId);
  const [c, s, su, t, pending] = await Promise.all([
    db.classes.count(), db.students.count(), db.subjects.count(), db.timetable.count(), db.outbox.count(),
  ]);
  return { cached: c + s + su + t, pending };
}

/**
 * Clear the read cache (classes/students/subjects/timetable) to reclaim space.
 * Does NOT touch the outbox or pending/error write rows — those are the user's
 * un-synced work and must survive (Req 11.1).
 */
export async function clearReadCache(userId: string): Promise<void> {
  const db = getOfflineDb(userId);
  await db.transaction('rw', db.classes, db.students, db.subjects, db.timetable, db.sync_meta, async () => {
    await Promise.all(READ_TABLES.map((t) => (db[t] as any).clear()));
    // Reset the roster bookmark so the next refresh re-pulls everything.
    await db.sync_meta.delete('roster');
  });
}

/** TTL-evict cached read rows older than the retention window. */
export async function evictStale(userId: string): Promise<number> {
  const db = getOfflineDb(userId);
  const cutoff = Date.now() - CACHE_TTL_MS;
  let removed = 0;
  await db.transaction('rw', db.classes, db.students, db.subjects, db.timetable, async () => {
    for (const t of READ_TABLES) {
      const n = await (db[t] as any).where('cachedAt').below(cutoff).delete();
      removed += n || 0;
    }
  });
  return removed;
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
