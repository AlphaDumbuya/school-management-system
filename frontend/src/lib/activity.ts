/**
 * activity: is a person actually using the app right now?
 *
 * Background polling (live sync, the notification bell, the teacher sync loop)
 * used to run whenever a screen was open, so a phone or office PC left on a
 * dashboard queried the database every few seconds until the inactivity lock
 * signed it out. The hosted database sleeps after a few idle minutes and its
 * monthly allowance is counted while it is awake, so those polls kept it awake
 * and used the allowance up.
 *
 * Polls now stop once nobody has touched the app for IDLE_POLL_MS, and resume
 * as soon as they do. The time of the last activity is the one
 * useInactivityLock already records (shared across tabs).
 */

const LAST_ACTIVE_KEY = 'wiskul_last_active';

/** No polling after this long without a tap, click, key press or scroll gesture. */
export const IDLE_POLL_MS = 3 * 60 * 1000;

/** Time of the most recent activity in any tab (0 when unknown). */
export function lastActivityAt(): number {
  try {
    return Number(localStorage.getItem(LAST_ACTIVE_KEY)) || 0;
  } catch {
    return 0;
  }
}

/** True when nobody has used the app for `ms` (unknown activity counts as active). */
export function isUserIdle(ms: number = IDLE_POLL_MS): boolean {
  const last = lastActivityAt();
  return last > 0 && Date.now() - last > ms;
}

/**
 * For react-query `refetchInterval`: poll every `ms` while someone is using the
 * app, stop while idle. Polling picks up again on the next refetch (window
 * focus, or the catch-up that useLiveSync triggers when activity resumes).
 */
export const pollWhileActive = (ms: number) => () => (isUserIdle() ? false : ms);
