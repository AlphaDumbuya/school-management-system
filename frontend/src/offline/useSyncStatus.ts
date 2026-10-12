/**
 * useSyncStatus — richer offline sync state for the teacher UI.
 *
 * Reads live counts from the Dexie store (outbox length = pending, write rows in
 * 'error' state = failed) plus the last successful pull time from sync_meta.
 * Exposes a `syncNow` action that runs the engine on demand. Polls lightly so
 * badges stay fresh as offline edits accrue.
 */
import { isTeachingUser } from '@lib/staffJobs';
import { useCallback, useEffect, useState } from 'react';
import useAuthStore from '@store/authStore';
import { getOfflineDb } from './db';
import { runSync } from './syncEngine';
import { requestSync } from './useSyncEngine';

export interface SyncState {
  online: boolean;
  pending: number;      // queued writes waiting to sync
  failed: number;       // writes rejected by the server
  lastPulledAt?: string;
  syncing: boolean;
}

export function useSyncStatus() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id || null;
  const isTeacher = isTeachingUser(user as any);

  const [state, setState] = useState<SyncState>({
    online: navigator.onLine, pending: 0, failed: 0, lastPulledAt: undefined, syncing: false,
  });

  const refresh = useCallback(async () => {
    if (!userId || !isTeacher) {
      setState((s) => ({ ...s, online: navigator.onLine }));
      return;
    }
    const db = getOfflineDb(userId);
    const [pending, meta, aErr, gErr, asErr] = await Promise.all([
      db.outbox.count(),
      db.sync_meta.get('roster'),
      db.attendance.where('syncStatus').equals('error').count(),
      db.grades.where('syncStatus').equals('error').count(),
      db.assignments.where('syncStatus').equals('error').count(),
    ]);
    setState((s) => ({
      ...s,
      online: navigator.onLine,
      pending,
      failed: aErr + gErr + asErr,
      lastPulledAt: meta?.lastPulledAt,
    }));
  }, [userId, isTeacher]);

  const syncNow = useCallback(async () => {
    if (!userId) return;
    setState((s) => ({ ...s, syncing: true }));
    try {
      await runSync(userId);
    } finally {
      await refresh();
      setState((s) => ({ ...s, syncing: false }));
    }
    requestSync();
  }, [userId, refresh]);

  useEffect(() => {
    refresh();
    const onOnline = () => setState((s) => ({ ...s, online: true }));
    const onOffline = () => setState((s) => ({ ...s, online: false }));
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const interval = window.setInterval(refresh, 5000);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.clearInterval(interval);
    };
  }, [refresh]);

  return { ...state, syncNow, refresh, isTeacher };
}

/** Human "x ago" for the last-synced label. */
export function timeAgo(iso?: string): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return 'never';
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default useSyncStatus;
