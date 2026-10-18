/**
 * useSyncEngine — mounts the teacher sync loop once (near the app root).
 *
 * Triggers a sync cycle on: mount (if online), the `online` event, a periodic
 * timer, and a custom `wiskul:sync` event (fired after a local write). Runs are
 * serialized + backed off inside syncEngine so this hook can fire liberally.
 */
import { isTeachingUser } from '@lib/staffJobs';
import { useEffect } from 'react';
import useAuthStore from '@store/authStore';
import { isUserIdle } from '@lib/activity';
import { runSync } from './syncEngine';

const SYNC_EVENT = 'wiskul:sync';
/**
 * Safety-net timer only. Writes sync straight away (requestSync), and the app
 * syncs on start, on reconnect and on return to the foreground. Every cycle
 * pulls the teacher's roster from the server and wakes the database, so the
 * timer runs every 5 minutes, and only while the app is on screen and in use.
 */
const INTERVAL_MS = 5 * 60_000;

/** Ask the engine to sync soon (call after any local write). */
export function requestSync() {
  window.dispatchEvent(new CustomEvent(SYNC_EVENT));
}

export function useSyncEngine() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id || null;
  // Only teachers use the offline sync path.
  const isTeacher = isTeachingUser(user as any);

  useEffect(() => {
    if (!userId || !isTeacher) return;

    let disposed = false;
    const tick = () => { if (!disposed) runSync(userId); };

    tick(); // on mount

    const onOnline = () => tick();
    const onRequest = () => tick();
    // Resume trigger: sync when the app returns to the foreground (e.g. the
    // teacher reopens it after being in a low-signal area) — closest reliable
    // proxy for "background sync" that also works on iOS webviews.
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };

    window.addEventListener('online', onOnline);
    window.addEventListener(SYNC_EVENT, onRequest);
    document.addEventListener('visibilitychange', onVisible);
    const interval = window.setInterval(() => {
      // Hidden (background tab, Android app paused) or nobody using it: skip.
      if (document.visibilityState !== 'visible' || isUserIdle()) return;
      tick();
    }, INTERVAL_MS);

    // Register a Background Sync tag so a supporting browser/OS can wake the SW
    // to flush the queue even if the tab is closed (progressive enhancement).
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready
        .then((reg) => (reg as any).sync?.register('sync-offline-queue'))
        .catch(() => undefined);
    }

    return () => {
      disposed = true;
      window.removeEventListener('online', onOnline);
      window.removeEventListener(SYNC_EVENT, onRequest);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(interval);
    };
  }, [userId, isTeacher]);
}

export default useSyncEngine;
