/**
 * useInactivityLock — auto-locks the app after a period of no user activity.
 *
 * Security: signed-in sessions should not stay open indefinitely. After
 * INACTIVITY_TIMEOUT_MS with no interaction (or if the app is reopened after the
 * timeout has already elapsed while backgrounded), we log the user out and send
 * them to /login, where they must re-authenticate (password + passkey/TOTP).
 *
 * Measuring activity correctly (an ACTIVE user must never be locked):
 *  - Listeners are on `window` in the CAPTURE phase. Bubble-phase listeners on
 *    `document` missed any event a component stopped (React's stopPropagation
 *    stops the native event at the React root, before `document`), `scroll`
 *    never bubbles (scrolling inside <main> didn't count), and typing with
 *    Android keyboards often only fires `input`, not a usable `keydown`.
 *  - The deadline is computed from the most recent activity in ANY tab (the
 *    shared localStorage timestamp) and re-checked when the timer fires, so an
 *    idle background tab can't sign out a tab that is in use. (Signing out
 *    clears the shared tokens, so it ends every tab's session.)
 *  - On return from the background (visibilitychange, Capacitor resume) we use
 *    wall-clock time against the last recorded activity, so a long background
 *    still locks, while a quick trip to the camera / file picker does not.
 *
 * Only runs while authenticated.
 */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '@store/authStore';

const LAST_ACTIVE_KEY = 'wiskul_last_active';

// Default 15 minutes; override with VITE_INACTIVITY_TIMEOUT_MIN.
const TIMEOUT_MIN = Number(import.meta.env.VITE_INACTIVITY_TIMEOUT_MIN) || 15;
const INACTIVITY_TIMEOUT_MS = Math.max(1, TIMEOUT_MIN) * 60 * 1000;
const WRITE_THROTTLE_MS = 5 * 1000; // persist last-active at most every 5s

/** Events that mean a person is using the app. */
const ACTIVITY_EVENTS = [
  'pointerdown',
  'pointermove',
  'touchstart',
  'touchmove',
  'mousedown',
  'mousemove',
  'keydown',
  'input',
  'wheel',
  // Not 'scroll' / 'focus': code can trigger those (auto-scrolling lists,
  // autofocus) and keep an unattended screen open forever. Real scrolling
  // already shows up as touch / wheel / pointer / key events.
] as const;

const readShared = (): number => {
  try {
    return Number(localStorage.getItem(LAST_ACTIVE_KEY)) || 0;
  } catch {
    return 0;
  }
};

const writeShared = (t: number) => {
  try {
    localStorage.setItem(LAST_ACTIVE_KEY, String(t));
  } catch {
    /* ignore */
  }
};

const isNativeShell = (): boolean => {
  const cap = typeof window !== 'undefined' ? (window as any).Capacitor : null;
  return !!(cap && (typeof cap.isNativePlatform === 'function' ? cap.isNativePlatform() : cap.isNative));
};

export function useInactivityLock(): void {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWriteRef = useRef<number>(0);
  /** Exact time of this tab's last activity (the shared value is throttled). */
  const lastLocalRef = useRef<number>(0);

  useEffect(() => {
    if (!isAuthenticated) return;

    let disposed = false;
    let locking = false;

    /** Most recent activity seen by this tab or any other tab. */
    const lastActivity = () => Math.max(lastLocalRef.current, readShared());

    const doLock = async () => {
      if (locking || disposed) return;
      locking = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      try {
        localStorage.removeItem(LAST_ACTIVE_KEY);
      } catch {
        /* ignore */
      }
      await logout();
      navigate('/login', { replace: true });
    };

    /** Lock if the idle limit has passed; otherwise wait for the rest of it. */
    const check = () => {
      if (disposed || locking) return;
      const idleFor = Date.now() - lastActivity();
      if (idleFor >= INACTIVITY_TIMEOUT_MS) {
        void doLock();
        return;
      }
      schedule(INACTIVITY_TIMEOUT_MS - idleFor);
    };

    const schedule = (ms: number) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      // Re-check at the deadline instead of locking blindly: another tab may
      // have been used in the meantime. Small floor so we never spin.
      timerRef.current = setTimeout(check, Math.max(1000, ms));
    };

    const markActive = () => {
      if (disposed || locking) return;
      const now = Date.now();
      lastLocalRef.current = now;
      // Persist (throttled) so other tabs and a resume can see it.
      if (now - lastWriteRef.current > WRITE_THROTTLE_MS) {
        lastWriteRef.current = now;
        writeShared(now);
        schedule(INACTIVITY_TIMEOUT_MS);
      }
    };

    /** Coming back to the app: lock only if the idle limit truly passed. */
    const onReturn = () => {
      if (document.visibilityState !== 'visible') return;
      const last = lastActivity();
      if (last && Date.now() - last >= INACTIVITY_TIMEOUT_MS) {
        void doLock();
      } else {
        // Returning to the app is itself an interaction.
        lastWriteRef.current = 0;
        markActive();
      }
    };

    /** Going to the background: record the exact last activity first. */
    const onHide = () => {
      if (document.visibilityState === 'hidden' && lastLocalRef.current) {
        writeShared(Math.max(lastLocalRef.current, readShared()));
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') onReturn();
      else onHide();
    };

    const opts: AddEventListenerOptions = { passive: true, capture: true };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, markActive, opts));
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onHide);

    // Android app shell: pause/resume don't always produce visibilitychange in
    // the WebView, so listen to the native lifecycle as well.
    const nativeHandles: Array<{ remove: () => Promise<void> | void }> = [];
    if (isNativeShell()) {
      import('@capacitor/app')
        .then(async ({ App }) => {
          const h1 = await App.addListener('resume', () => onReturn());
          const h2 = await App.addListener('pause', () => {
            if (lastLocalRef.current) writeShared(Math.max(lastLocalRef.current, readShared()));
          });
          if (disposed) {
            void h1.remove();
            void h2.remove();
          } else {
            nativeHandles.push(h1, h2);
          }
        })
        .catch(() => undefined);
    }

    // Start the countdown now (opening a screen counts as activity).
    lastWriteRef.current = 0;
    markActive();

    return () => {
      disposed = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, markActive, opts));
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onHide);
      nativeHandles.forEach((h) => void h.remove());
    };
  }, [isAuthenticated, logout, navigate]);
}

export default useInactivityLock;
