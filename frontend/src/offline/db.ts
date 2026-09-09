/**
 * Offline local store (Dexie / IndexedDB) for the teacher offline-first workflow.
 *
 * This is SEPARATE from `src/lib/offlineQueue.ts` (the generic request-replay
 * queue used by apiClient). This store holds STRUCTURED local-first data:
 *   - read caches: classes, students, subjects, timetable
 *   - local writes: attendance, grades, assignments (with a client id + sync status)
 *   - outbox: ordered mutations to push to the server
 *   - sync_meta: per-entity last pull/push bookmarks
 *
 * The database name is namespaced per user so switching accounts never exposes a
 * previous user's data, and logout can drop the whole DB (Req 8).
 */
import Dexie, { type Table } from 'dexie';

export type SyncStatus = 'pending' | 'synced' | 'error';

/** Common fields on every locally-written record. */
export interface LocalMeta {
  /** Client-generated UUID — the idempotency key for sync. */
  clientId: string;
  /** Server id once the record has been synced (absent until then). */
  serverId?: string;
  syncStatus: SyncStatus;
  /** Last local modification (ms epoch). */
  updatedAt: number;
  /** Error reason when syncStatus === 'error'. */
  error?: string;
}

// ── Read-cache rows (server-authoritative; pulled, not edited) ──────────────
export interface CachedRow {
  id: string;            // server id
  data: any;             // the record payload as returned by the API
  cachedAt: number;      // for TTL eviction
}

// ── Writable rows ───────────────────────────────────────────────────────────
export interface AttendanceRow extends LocalMeta {
  studentId: string;
  classId?: string;
  date: string;          // YYYY-MM-DD
  sessionType: string;   // e.g. 'full_day' | 'morning' | 'afternoon'
  status: string;        // present | absent | late | excused
  remarks?: string;
}

export interface GradeRow extends LocalMeta {
  studentId: string;
  classId?: string;
  subjectId?: string;
  assessment?: string;
  score?: number;
  extra?: Record<string, any>;
}

export interface AssignmentRow extends LocalMeta {
  classId?: string;
  subjectId?: string;
  title: string;
  description?: string;
  dueDate?: string;
  extra?: Record<string, any>;
}

// ── Outbox (ordered mutation queue for the structured sync engine) ──────────
export type OutboxEntity = 'attendance' | 'grade' | 'assignment';
export type OutboxOp = 'create' | 'update';

export interface OutboxItem {
  id?: number;           // auto-increment
  entity: OutboxEntity;
  op: OutboxOp;
  clientId: string;      // links back to the local row
  payload: any;          // what to send to the server
  attempts: number;
  createdAt: number;
}

// ── Sync bookmarks ──────────────────────────────────────────────────────────
export interface SyncMeta {
  key: string;           // entity name
  lastPulledAt?: string; // ISO timestamp of last successful pull
  lastPushedAt?: number; // ms epoch of last push
}

export class TeacherOfflineDB extends Dexie {
  classes!: Table<CachedRow, string>;
  students!: Table<CachedRow, string>;
  subjects!: Table<CachedRow, string>;
  timetable!: Table<CachedRow, string>;
  /** Student ↔ class linkage so the register can filter students offline. */
  enrollments!: Table<CachedRow, string>;
  attendance!: Table<AttendanceRow, string>;
  grades!: Table<GradeRow, string>;
  assignments!: Table<AssignmentRow, string>;
  outbox!: Table<OutboxItem, number>;
  sync_meta!: Table<SyncMeta, string>;

  constructor(userId: string) {
    super(`wiskul-teacher-${userId}`);
    this.version(1).stores({
      classes: 'id, cachedAt',
      students: 'id, cachedAt',
      subjects: 'id, cachedAt',
      timetable: 'id, cachedAt',
      attendance: 'clientId, serverId, syncStatus, [classId+date], updatedAt',
      grades: 'clientId, serverId, syncStatus, [classId+subjectId], updatedAt',
      assignments: 'clientId, serverId, syncStatus, classId, updatedAt',
      outbox: '++id, entity, clientId, createdAt',
      sync_meta: 'key',
    });
    // v2 adds the enrollments read-cache (student↔class) for offline register.
    this.version(2).stores({
      enrollments: 'id, cachedAt',
    });
  }
}

let _db: TeacherOfflineDB | null = null;
let _dbUserId: string | null = null;

/**
 * Get the Dexie store bound to a user. If the active user changes, the previous
 * instance is closed (its data stays on disk under its own DB name until wiped).
 */
export function getOfflineDb(userId: string): TeacherOfflineDB {
  if (_db && _dbUserId === userId) return _db;
  if (_db) _db.close();
  _db = new TeacherOfflineDB(userId);
  _dbUserId = userId;
  return _db;
}

/** Permanently delete a user's offline database (logout / account switch — Req 8). */
export async function wipeOfflineDb(userId: string): Promise<void> {
  if (_db && _dbUserId === userId) {
    _db.close();
    _db = null;
    _dbUserId = null;
  }
  await Dexie.delete(`wiskul-teacher-${userId}`);
}

/**
 * On login, drop any OTHER users' offline databases left on this device, so a
 * shared phone never retains a previous teacher's student data (Req 8.3).
 */
export async function wipeOtherUsers(currentUserId: string): Promise<void> {
  try {
    const names: string[] = (await (Dexie as any).getDatabaseNames?.()) || [];
    await Promise.all(
      names
        .filter((n) => n.startsWith('wiskul-teacher-') && n !== `wiskul-teacher-${currentUserId}`)
        .map((n) => Dexie.delete(n).catch(() => undefined))
    );
  } catch {
    /* getDatabaseNames not supported everywhere — safe to ignore */
  }
}

/** New idempotency key for a local write. */
export function newClientId(): string {
  // crypto.randomUUID is available in modern browsers + Android/iOS webviews.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
