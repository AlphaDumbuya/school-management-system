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

// Dismiss the branded animated splash (defined in index.html) once React has
// painted. A short minimum keeps the animation from flashing on fast loads; the
// safety timeout guarantees it never gets stuck if something stalls.
(() => {
  const splash = document.getElementById('wiskul-splash');
  if (!splash) return;
  const MIN_MS = 600;
  const startedAt = performance.now();
  const hide = () => {
    const wait = Math.max(0, MIN_MS - (performance.now() - startedAt));
    window.setTimeout(() => {
      splash.classList.add('wiskul-splash--hide');
      window.setTimeout(() => splash.remove(), 500);
    }, wait);
  };
  // Wait one frame after mount so the first React paint is on screen first.
  requestAnimationFrame(() => requestAnimationFrame(hide));
  // Safety net: never let the splash linger.
  window.setTimeout(hide, 8000);
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

        // Notify when a new version is ready. autoUpdate skips waiting, so we
        // just log; the useServiceWorker hook drives any in-app "refresh" UI.
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[WiSkul SW] new version available');
            }
          });
        });
      })
      .catch((err) => console.warn('[WiSkul SW] registration failed:', err));
  });
}
