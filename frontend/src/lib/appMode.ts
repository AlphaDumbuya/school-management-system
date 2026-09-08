/**
 * appMode — decides whether we're running as "the app" (no public marketing
 * pages) vs. the full web experience.
 *
 * True when ANY of:
 *   - running inside the native Capacitor shell (detected at RUNTIME), OR
 *   - built for native (Capacitor) via VITE_APP_TARGET=native, OR
 *   - running as an installed PWA in standalone/fullscreen display mode.
 *
 * Why runtime detection matters (task 20a): the app now loads the LIVE web
 * bundle from the server (auto-updating content), and that bundle is built with
 * the normal web config — so the build-time flag `VITE_APP_TARGET=native` is
 * NOT present. We must detect the native shell at runtime via the Capacitor
 * bridge so app mode still applies when served from the live origin.
 *
 * In app mode the router drops the marketing site and opens at the auth pages.
 */
function isNativeRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as any).Capacitor;
  // Capacitor injects a global bridge inside the native webview.
  return !!(cap && (typeof cap.isNativePlatform === 'function' ? cap.isNativePlatform() : cap.isNative));
}

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

/** True for the native app shell, the native build, OR an installed/standalone PWA. */
export const isAppMode = (): boolean => isNativeRuntime() || IS_NATIVE_BUILD || isStandalonePWA();
