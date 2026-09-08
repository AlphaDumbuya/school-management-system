/**
 * useInactivityLock — auto-locks the app after a period of no user activity.
 *
 * Security: signed-in sessions should not stay open indefinitely. After
 * INACTIVITY_TIMEOUT_MS with no interaction (or if the app is reopened after the
 * timeout has already elapsed while backgrounded), we log the user out and send
 * them to /login, where they must re-authenticate (password + passkey/TOTP).
 *
 * Notes:
 *  - Only runs while authenticated.
 *  - Uses a persisted "last active" timestamp so backgrounding the app (common on
 *    mobile) and returning later still locks correctly.
 *  - Activity events are throttled so we don't thrash storage on every mousemove.
 */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '@store/authStore';

const LAST_ACTIVE_KEY = 'wiskul_last_active';

// Default 15 minutes; override with VITE_INACTIVITY_TIMEOUT_MIN.
const TIMEOUT_MIN = Number(import.meta.env.VITE_INACTIVITY_TIMEOUT_MIN) || 15;
const INACTIVITY_TIMEOUT_MS = Math.max(1, TIMEOUT_MIN) * 60 * 1000;
const WRITE_THROTTLE_MS = 15 * 1000; // persist last-active at most every 15s

export function useInactivityLock(): void {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWriteRef = useRef<number>(0);

  useEffect(() => {
    if (!isAuthenticated) return;

    const doLock = async () => {
      try {
        localStorage.removeItem(LAST_ACTIVE_KEY);
      } catch {
        /* ignore */
      }
      await logout();
      navigate('/login', { replace: true });
    };

    const markActive = () => {
      const now = Date.now();
      // Reset the countdown.
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(doLock, INACTIVITY_TIMEOUT_MS);
      // Persist (throttled) so a resume after backgrounding can detect timeout.
      if (now - lastWriteRef.current > WRITE_THROTTLE_MS) {
        lastWriteRef.current = now;
        try {
          localStorage.setItem(LAST_ACTIVE_KEY, String(now));
        } catch {
          /* ignore */
        }
      }
    };

    // If the app was backgrounded past the timeout, lock immediately on return.
    const checkExpiredOnResume = () => {
      if (document.visibilityState !== 'visible') return;
      let last = 0;
      try {
        last = Number(localStorage.getItem(LAST_ACTIVE_KEY)) || 0;
      } catch {
        last = 0;
      }
      if (last && Date.now() - last >= INACTIVITY_TIMEOUT_MS) {
        void doLock();
      } else {
        markActive();
      }
    };

    const events: Array<keyof DocumentEventMap> = [
      'pointerdown',
      'keydown',
      'touchstart',
      'scroll',
      'mousemove',
    ];
    events.forEach((e) => document.addEventListener(e, markActive, { passive: true }));
    document.addEventListener('visibilitychange', checkExpiredOnResume);

    // Start the countdown now.
    markActive();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((e) => document.removeEventListener(e, markActive));
      document.removeEventListener('visibilitychange', checkExpiredOnResume);
    };
  }, [isAuthenticated, logout, navigate]);
}

export default useInactivityLock;
