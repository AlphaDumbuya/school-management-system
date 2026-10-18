/**
 * useLiveSync — near-real-time portal refresh.
 *
 * The API is serverless, so instead of a WebSocket we poll a tiny per-school
 * change counter (GET /api/v1/live/version) while the app is visible. The
 * backend bumps it on structural changes (promotions, new academic year, role/
 * status changes, enrollments, classes, results published). When it moves we:
 *   1. re-check the signed-in user (role change → new portal), and
 *   2. invalidate cached queries so every open screen refetches.
 *
 * Polling pauses while the tab/app is hidden, offline, or nobody has used it
 * for a few minutes (so an unattended screen lets the database sleep), and
 * fires right away when it is used again, so a resumed Android app catches up
 * at once.
 */
import { useEffect, useRef } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import apiClient from '@lib/apiClient';
import useAuthStore from '@store/authStore';
import { isUserIdle } from '@lib/activity';

/** Once a minute: role and structure changes are rare, and every poll wakes the database. */
const POLL_MS = 60_000;

export function useLiveSync(queryClient: QueryClient, enabled: boolean) {
  const lastVersion = useRef<string | null>(null);
  const inFlight = useRef(false);
  /** Was the last tick skipped because nobody was using the app? */
  const wasIdle = useRef(false);

  useEffect(() => {
    if (!enabled) {
      lastVersion.current = null; // new login starts a fresh baseline
      return;
    }

    let cancelled = false;

    const check = async () => {
      if (cancelled || inFlight.current) return;
      if (document.visibilityState !== 'visible') return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      if (isUserIdle()) { wasIdle.current = true; return; }
      inFlight.current = true;
      try {
        // Back from idle: idle-aware polls (notification bell etc.) stopped, so
        // refresh what is on screen now that it has gone stale.
        if (wasIdle.current) {
          wasIdle.current = false;
          void queryClient.refetchQueries({ type: 'active', stale: true });
        }
        const res: any = await apiClient.get('/api/v1/live/version');
        const version = res?.data?.version;
        if (res?.success === false || version == null) return;
        const v = String(version);
        if (lastVersion.current === null) {
          lastVersion.current = v; // first read is the baseline, not a change
          return;
        }
        if (v !== lastVersion.current) {
          lastVersion.current = v;
          await useAuthStore.getState().refreshUser();
          // Marks everything stale and refetches only queries on screen now.
          await queryClient.invalidateQueries();
        }
      } catch {
        // Transient network error — try again on the next tick.
      } finally {
        inFlight.current = false;
      }
    };

    check();
    const id = window.setInterval(check, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    const onOnline = () => check();
    // Coming back after an idle spell: check at once instead of waiting a minute.
    const onActivity = () => { if (wasIdle.current) check(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
    };
  }, [enabled, queryClient]);
}

export default useLiveSync;
