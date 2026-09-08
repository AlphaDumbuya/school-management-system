import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor config for the WiSkul Android app.
 *
 * The app bundles the production web build (`dist`) and talks to the hosted API
 * over HTTPS (VITE_API_URL baked in at build time via `npm run build:app`).
 * Build the web assets first, then `npx cap sync android`.
 */
const config: CapacitorConfig = {
  appId: 'sl.wiskul.app',
  appName: 'WiSkul',
  webDir: 'dist',
  // Android: use HTTPS scheme so the webview origin matches the PWA (IndexedDB,
  // service worker, and cookies behave consistently).
  server: {
    androidScheme: 'https',
  },
  android: {
    // Allow the webview to load the bundled assets and call the hosted API.
    allowMixedContent: false,
  },
};

export default config;
