/**
 * nativeChrome — configure the native status bar so the WebView content does NOT
 * draw underneath the phone's status bar (clock/battery area).
 *
 * By default Capacitor's Android WebView can render edge-to-edge (overlaying the
 * status bar), which hides the app header. Setting overlaysWebView(false) makes
 * Android reserve space for the status bar and paints it with our brand color.
 *
 * No-op on the web (the dynamic import only loads inside the native shell).
 */
import { isAppMode } from './appMode';

// Brand navy — matches the app header / manifest theme.
const STATUS_BAR_BG = '#1a2b6b';

export async function initNativeChrome(): Promise<void> {
  // Only run inside the Capacitor native shell.
  const cap = (window as any).Capacitor;
  const isNative = !!(cap && (typeof cap.isNativePlatform === 'function' ? cap.isNativePlatform() : cap.isNative));
  if (!isNative && !isAppMode()) return;

  // Tag the document so app-only CSS (viewport lock, safe areas) can target the
  // native shell without relying on display-mode media queries, which the
  // Android WebView doesn't reliably report as standalone.
  try {
    document.documentElement.classList.add('wiskul-native');
    document.body.classList.add('wiskul-native');
  } catch {
    /* ignore — DOM not ready is not expected here (called after mount) */
  }

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    // Reserve space for the status bar instead of drawing under it.
    await StatusBar.setOverlaysWebView({ overlay: false });
    // Light icons/text on our dark navy bar.
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: STATUS_BAR_BG });
  } catch (err) {
    // Plugin unavailable (e.g. running as plain PWA) — safe-area CSS still covers it.
    console.warn('[nativeChrome] status bar setup skipped:', err);
  }
}
