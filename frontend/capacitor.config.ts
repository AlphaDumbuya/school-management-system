import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor config for the WiSkul Android app.
 *
 * AUTO-UPDATING CONTENT (task 20a): the app loads its web UI from the live origin
 * (`server.url`) instead of the bundled assets. This means UI/logic changes ship
 * automatically on the next Vercel deploy — no new APK, no reinstall. Only native
 * changes (icon, permissions, plugins) require rebuilding the APK.
 *
 * The bundled `dist` is kept as a fallback (used if `server.url` is unreachable /
 * removed). Build web assets first, then `npx cap sync android`.
 *
 * Trade-off: the app needs connectivity on FIRST launch to load the shell. After
 * that, the service worker cache covers offline use. To revert to fully-bundled
 * (stronger cold-start offline), remove the `server.url` line below.
 */
const APP_ORIGIN = process.env.CAP_SERVER_URL || 'https://www.wiskulsl.com';

const config: CapacitorConfig = {
  appId: 'sl.wiskul.app',
  appName: 'WiSkul',
  webDir: 'dist',
  server: {
    // Load the live web app so content auto-updates via Vercel deploys.
    url: APP_ORIGIN,
    // Use HTTPS scheme so the webview origin matches the PWA (IndexedDB, service
    // worker, and cookies behave consistently with the hosted site).
    androidScheme: 'https',
    // Only navigate within our own origin inside the app webview.
    allowNavigation: ['www.wiskulsl.com', 'wiskulsl.com'],
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
