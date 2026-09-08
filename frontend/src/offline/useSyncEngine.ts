/**
 * useSyncEngine — mounts the teacher sync loop once (near the app root).
 *
 * Triggers a sync cycle on: mount (if online), the `online` event, a periodic
 * timer, and a custom `wiskul:sync` event (fired after a local write). Runs are
 * serialized + backed off inside syncEngine so this hook can fire liberally.
 */
import { useEffect } from 'react';
import useAuthStore from '@store/authStore';
import { runSync } from './syncEngine';

const SYNC_EVENT = 'wiskul:sync';
const INTERVAL_MS = 30_000;

/** Ask the engine to sync soon (call after any local write). */
export function requestSync() {
  window.dispatchEvent(new CustomEvent(SYNC_EVENT));
}

export function useSyncEngine() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id || null;
  // Only teachers use the offline sync path.
  const isTeacher = user?.role === 'teacher';

  useEffect(() => {
    if (!userId || !isTeacher) return;

    let disposed = false;
    const tick = () => { if (!disposed) runSync(userId); };

    tick(); // on mount

    const onOnline = () => tick();
    const onRequest = () => tick();
    window.addEventListener('online', onOnline);
    window.addEventListener(SYNC_EVENT, onRequest);
    const interval = window.setInterval(tick, INTERVAL_MS);

    return () => {
      disposed = true;
      window.removeEventListener('online', onOnline);
      window.removeEventListener(SYNC_EVENT, onRequest);
      window.clearInterval(interval);
    };
  }, [userId, isTeacher]);
}

export default useSyncEngine;
