/**
 * Application Entry Point
 * Phase 11: Frontend Dashboard Implementation
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { initNativeChrome } from './lib/nativeChrome';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

// Configure the native status bar so app content doesn't hide under it (no-op on web).
void initNativeChrome();

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Dismiss the branded animated splash (defined in index.html). We hold it for a
// proper minimum so it reads as a real splash screen (not a quick flash), then
// wait until the app has actually painted its first real screen (login /
// dashboard) before fading out — so the handoff feels like one continuous
// splash → screen, with no intermediate blank/white flash.
//
// The app dispatches `wiskul:app-ready` once the first authenticated/route view
// has rendered. We also keep a safety timeout so the splash can never get stuck.
(() => {
  const splash = document.getElementById('wiskul-splash');
  if (!splash) return;

  // Native app holds the splash for a full branded load (~5.5s) so it reads as
  // a proper splash screen; plain web stays reasonably snappy.
  const isNativeShell =
    document.documentElement.classList.contains('wiskul-native') ||
    !!(window as any).Capacitor?.isNativePlatform?.();
  const MIN_MS = isNativeShell ? 5500 : 1800;
  const startedAt = performance.now();
  let done = false;

  const hide = () => {
    if (done) return;
    done = true;
    const wait = Math.max(0, MIN_MS - (performance.now() - startedAt));
    window.setTimeout(() => {
      splash.classList.add('wiskul-splash--hide');
      window.setTimeout(() => splash.remove(), 500);
    }, wait);
  };

  // Primary trigger: the app tells us its first real screen is on-screen.
  window.addEventListener('wiskul:app-ready', hide, { once: true });
  // Fallback trigger: two frames after mount (covers routes that don't emit).
  requestAnimationFrame(() => requestAnimationFrame(() => window.setTimeout(hide, 300)));
  // Safety net: never let the splash linger indefinitely.
  window.setTimeout(hide, 9000);
})();

// Register the Workbox service worker (PWA — full offline app shell, API/image
// runtime caching, offline write-queue replay, push notifications).
// Runs after the app mounts so it never blocks the initial render.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js', { scope: '/' })
      .then((reg) => {
        console.log('[WiSkul SW] registered, scope:', reg.scope);

        // Ask the SW to flush any queued offline writes once it's active
        // (covers the case where the app reopens already back online).
        const triggerFlush = () => {
          navigator.serviceWorker.controller?.postMessage({ type: 'FLUSH_OFFLINE_QUEUE' });
        };
        if (navigator.serviceWorker.controller) triggerFlush();
        navigator.serviceWorker.addEventListener('controllerchange', triggerFlush);

        // A new version waits until it is activated. Signed-in users get an
        // "Update available" prompt (so nobody is reloaded mid-task). Visitors who
        // are NOT signed in (the public site, login, the demo) have nothing to
        // lose, so they move to the new version straight away. Without this, anyone
        // who had visited before kept seeing the old site (and missed new pages
        // such as the Live Demo button) until they closed every tab.
        const signedIn = () => !!(localStorage.getItem('accessToken') || localStorage.getItem('token'));
        const takeNewVersionIfSafe = (worker?: ServiceWorker | null) => {
          if (!worker || signedIn()) return;
          // Never loop: reload at most once per half minute.
          const last = Number(sessionStorage.getItem('wiskul.sw.autoreload') || 0);
          if (Date.now() - last < 30_000) return;
          let reloaded = false;
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (reloaded) return;
            reloaded = true;
            sessionStorage.setItem('wiskul.sw.autoreload', String(Date.now()));
            window.location.reload();
          });
          worker.postMessage({ type: 'SKIP_WAITING' });
        };
        if (navigator.serviceWorker.controller && reg.waiting) takeNewVersionIfSafe(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[WiSkul SW] new version available');
              takeNewVersionIfSafe(reg.waiting || newWorker);
            }
          });
        });
        // Look for a new version right away rather than waiting for the browser's own schedule.
        reg.update().catch(() => undefined);
      })
      .catch((err) => console.warn('[WiSkul SW] registration failed:', err));
  });
}
