/**
 * appMode — decides whether we're running as "the app" (no public marketing
 * pages) vs. the full web experience.
 *
 * True when EITHER:
 *   - built for native (Capacitor) via VITE_APP_TARGET=native, OR
 *   - running as an installed PWA in standalone/fullscreen display mode.
 *
 * In app mode the router drops the marketing site and opens at the auth pages.
 */
function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  const mm = window.matchMedia;
  const standalone =
    (mm && (mm('(display-mode: standalone)').matches || mm('(display-mode: fullscreen)').matches || mm('(display-mode: minimal-ui)').matches)) ||
    // iOS Safari legacy flag
    (window.navigator as any).standalone === true;
  return !!standalone;
}

export const IS_NATIVE_BUILD = import.meta.env.VITE_APP_TARGET === 'native';

/** True for the native app build OR an installed/standalone PWA. */
export const isAppMode = (): boolean => IS_NATIVE_BUILD || isStandalonePWA();
