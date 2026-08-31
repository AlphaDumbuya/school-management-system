/**
 * Application Entry Point
 * Phase 11: Frontend Dashboard Implementation
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register the service worker (PWA — offline support, caching, push notifications).
// Runs after the app mounts so it never blocks the initial render.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js', { scope: '/' })
      .then((reg) => {
        console.log('[WiSkul SW] registered, scope:', reg.scope);

        // Notify user when a new version is available so they can refresh.
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // A new service worker is waiting. In production you'd show a
              // "New version available — click to refresh" toast here.
              console.log('[WiSkul SW] new version available');
            }
          });
        });
      })
      .catch((err) => console.warn('[WiSkul SW] registration failed:', err));
  });
}
