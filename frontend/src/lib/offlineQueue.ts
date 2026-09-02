/**
 * offlineQueue — durable IndexedDB-backed queue for write requests made while offline.
 *
 * When a mutating API call (POST/PUT/PATCH/DELETE) fails because the device is
 * offline, we stash it here. When connectivity returns (either via the browser
 * `online` event or a Background Sync trigger from the service worker) we replay
 * the queued requests in order.
 *
 * This is intentionally generic: it stores method, url, headers and a JSON body,
 * so any feature (attendance, grades, payments, etc.) gets offline write support
 * for free without bespoke code.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface QueuedRequest {
  id?: number;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  createdAt: number;
  /** Human label for the offline indicator, e.g. "Mark attendance". */
  label?: string;
  /** How many replay attempts have been made. */
  attempts: number;
}

interface OfflineDB extends DBSchema {
  requests: {
    key: number;
    value: QueuedRequest;
    indexes: { 'by-createdAt': number };
  };
}

const DB_NAME = 'wiskul-offline';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null;

function getDb(): Promise<IDBPDatabase<OfflineDB>> {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('requests', {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('by-createdAt', 'createdAt');
      },
    });
  }
  return dbPromise;
}

/** Add a request to the offline queue. Returns the generated id. */
export async function enqueueRequest(
  req: Omit<QueuedRequest, 'id' | 'createdAt' | 'attempts'>
): Promise<number> {
  const db = await getDb();
  const id = await db.add('requests', {
    ...req,
    createdAt: Date.now(),
    attempts: 0,
  });
  return id as number;
}

/** Return all queued requests, oldest first. */
export async function getQueuedRequests(): Promise<QueuedRequest[]> {
  const db = await getDb();
  return db.getAllFromIndex('requests', 'by-createdAt');
}

/** Number of pending queued requests. */
export async function getQueueCount(): Promise<number> {
  const db = await getDb();
  return db.count('requests');
}

/** Remove a single request from the queue. */
export async function removeRequest(id: number): Promise<void> {
  const db = await getDb();
  await db.delete('requests', id);
}

/** Increment the attempt counter for a request. */
export async function bumpAttempts(req: QueuedRequest): Promise<void> {
  if (req.id == null) return;
  const db = await getDb();
  await db.put('requests', { ...req, attempts: req.attempts + 1 });
}

const MAX_ATTEMPTS = 5;

/**
 * Replay every queued request in order. Successful (or permanently-failed)
 * requests are removed. Returns the number of requests successfully flushed.
 * Safe to call repeatedly.
 */
export async function replayQueue(): Promise<{ flushed: number; remaining: number }> {
  const requests = await getQueuedRequests();
  let flushed = 0;

  for (const req of requests) {
    try {
      const res = await fetch(req.url, {
        method: req.method,
        headers: req.headers,
        body: req.body,
        // Auth for our API uses a bearer token in headers, so no cookies needed,
        // but include credentials in case of same-origin cookie sessions.
        credentials: 'include',
      });

      if (res.ok || (res.status >= 400 && res.status < 500)) {
        // 2xx = success. 4xx = client error that won't be fixed by retrying
        // (e.g. validation/duplicate) — drop it so the queue doesn't wedge.
        await removeRequest(req.id!);
        if (res.ok) flushed += 1;
      } else {
        // 5xx / transient — keep for a later attempt unless we've exhausted tries.
        await bumpAttempts(req);
        if (req.attempts + 1 >= MAX_ATTEMPTS) {
          await removeRequest(req.id!);
        }
      }
    } catch {
      // Still offline / network error — stop; we'll retry on the next trigger.
      break;
    }
  }

  const remaining = await getQueueCount();
  return { flushed, remaining };
}

/** Clear the entire queue (used on logout to avoid cross-tenant replay). */
export async function clearQueue(): Promise<void> {
  const db = await getDb();
  await db.clear('requests');
}
