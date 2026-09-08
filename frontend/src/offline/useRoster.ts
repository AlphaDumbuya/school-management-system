/**
 * useRoster — offline-first access to the teacher's cached roster data.
 *
 * Reads immediately from the local cache (so screens work offline), and when
 * online triggers a background refresh from the sync API. Exposes a `fromCache`
 * flag + `lastSyncedAt` so the UI can show a "data as of…" freshness badge.
 */
import { useCallback, useEffect, useState } from 'react';
import useAuthStore from '@store/authStore';
import { rosterRepo, type RosterEntity } from './repositories/rosterRepo';

export function useRoster(entity: RosterEntity) {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id || null;

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | undefined>();

  const readCache = useCallback(async () => {
    if (!userId) return;
    const [rows, syncedAt] = await Promise.all([
      rosterRepo.list(userId, entity),
      rosterRepo.lastSyncedAt(userId),
    ]);
    setItems(rows);
    setLastSyncedAt(syncedAt);
  }, [userId, entity]);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    // Serve cache first for instant, offline-safe render.
    await readCache();
    // Then refresh from the server when we have connectivity.
    if (navigator.onLine) {
      try {
        await rosterRepo.refresh(userId);
        await readCache();
        setFromCache(false);
      } catch {
        setFromCache(true); // stayed on cache (offline / server error)
      }
    } else {
      setFromCache(true);
    }
    setLoading(false);
  }, [userId, readCache]);

  useEffect(() => { load(); }, [load]);

  return { items, loading, fromCache, lastSyncedAt, reload: load };
}

export default useRoster;
