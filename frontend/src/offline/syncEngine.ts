/**
 * syncEngine — drives the teacher offline sync loop.
 *
 *  PUSH: drains the Dexie `outbox` (ordered queued writes) to /sync/push,
 *  updating each local write row's syncStatus from the per-item result
 *  (applied/duplicate → synced, rejected → error with reason).
 *
 *  PULL: refreshes the roster read-cache from /sync/pull (delegated to
 *  rosterRepo) so the device sees server-side changes.
 *
 *  Triggers (wired in useSyncEngine): app start, `online` event, a periodic
 *  timer, and after each local write (debounced). Runs are serialized and
 *  backed off on failure so a flaky network never spins or drops pending writes.
 */
import { getOfflineDb, type OutboxItem } from './db';
import { syncClient, type PushItem, type PushResult } from './syncClient';
import { rosterRepo } from './repositories/rosterRepo';

const MAX_ATTEMPTS = 6;

let running = false;
let backoffUntil = 0;

/** entity → the Dexie write table that mirrors it. */
function tableFor(db: ReturnType<typeof getOfflineDb>, entity: OutboxItem['entity']) {
  if (entity === 'attendance') return db.attendance;
  if (entity === 'grade') return db.grades;
  return db.assignments;
}

async function markLocal(
  db: ReturnType<typeof getOfflineDb>,
  entity: OutboxItem['entity'],
  clientId: string,
  patch: Record<string, any>
) {
  const table = tableFor(db, entity) as any;
  await table.update(clientId, patch);
}

/** Push all queued writes. Returns how many were accepted by the server. */
async function pushOutbox(userId: string): Promise<number> {
  const db = getOfflineDb(userId);
  const queued = await db.outbox.orderBy('createdAt').toArray();
  if (!queued.length) return 0;

  const items: PushItem[] = queued.map((q) => ({
    entity: q.entity, op: q.op, clientId: q.clientId, payload: q.payload,
  }));

  const res = await syncClient.push(items);
  if (!res.success || !res.data) throw new Error('push failed');

  const byClient = new Map<string, PushResult>(res.data.map((r) => [r.clientId, r]));
  let accepted = 0;

  for (const q of queued) {
    const r = byClient.get(q.clientId);
    if (!r) continue; // server didn't address this item — leave queued for retry
    if (r.result === 'applied' || r.result === 'duplicate') {
      await markLocal(db, q.entity, q.clientId, { syncStatus: 'synced', serverId: r.serverId, error: undefined });
      await db.outbox.delete(q.id!);
      accepted += 1;
    } else {
      // Rejected (e.g. locked grade / not assigned). Surface on the local row,
      // and after enough attempts stop retrying so the queue never wedges.
      const attempts = (q.attempts || 0) + 1;
      await markLocal(db, q.entity, q.clientId, { syncStatus: 'error', error: r.reason || 'Rejected' });
      if (attempts >= MAX_ATTEMPTS) {
        await db.outbox.delete(q.id!);
      } else {
        await db.outbox.update(q.id!, { attempts });
      }
    }
  }
  return accepted;
}

/** Full sync cycle: push local writes, then pull server changes. */
export async function runSync(userId: string): Promise<{ pushed: number; pulled: number } | null> {
  if (!userId || !navigator.onLine) return null;
  if (running) return null;
  if (Date.now() < backoffUntil) return null;

  running = true;
  try {
    const pushed = await pushOutbox(userId);
    const pulled = await rosterRepo.refresh(userId).catch(() => 0);
    backoffUntil = 0; // success resets backoff
    return { pushed, pulled };
  } catch {
    // Exponential-ish backoff; capped. Pending writes stay in the outbox.
    backoffUntil = Date.now() + 15_000;
    return null;
  } finally {
    running = false;
  }
}

/** Count of not-yet-synced local writes across all entities. */
export async function pendingWriteCount(userId: string): Promise<number> {
  const db = getOfflineDb(userId);
  return db.outbox.count();
}
