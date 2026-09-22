/// <reference lib="webworker" />
/**
 * WiSkul Service Worker (Workbox injectManifest build).
 *
 * Responsibilities:
 *  - Precache the full app shell (all built JS/CSS/HTML/assets) so the app
 *    boots and navigates offline after the first visit.
 *  - Runtime-cache API GET responses (network-first) and images (stale-while-
 *    revalidate) so previously seen data is available offline.
 *  - SPA navigation fallback to index.html when offline.
 *  - Replay the IndexedDB offline write queue on Background Sync.
 *  - Push notifications + notification click handling.
 */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// ---------------------------------------------------------------------------
// Precache — Workbox replaces self.__WB_MANIFEST with the built asset manifest.
// ---------------------------------------------------------------------------
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

// ---------------------------------------------------------------------------
// SPA navigation fallback — serve cached index.html for app routes when offline
// so deep links keep working. Skip API/asset paths.
// ---------------------------------------------------------------------------
const navigationRoute = new NavigationRoute(
  new NetworkFirst({
    cacheName: 'wiskul-navigation',
    networkTimeoutSeconds: 3,
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  }),
  {
    denylist: [/^\/api\//, /\/[^/?]+\.[^/]+$/],
  }
);
registerRoute(navigationRoute);

// ---------------------------------------------------------------------------
// API GET requests — network-first, fall back to cache when offline.
// Dashboard endpoints are excluded from caching — they must always be fresh.
// ---------------------------------------------------------------------------
registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith('/api/') &&
    !url.pathname.startsWith('/api/v1/dashboards/') &&
    request.method === 'GET',
  new NetworkFirst({
    cacheName: 'wiskul-api',
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 }),
    ],
  })
);

// ---------------------------------------------------------------------------
// Images — stale-while-revalidate for snappy loads + background refresh.
// ---------------------------------------------------------------------------
registerRoute(
  ({ request }) => request.destination === 'image',
  new StaleWhileRevalidate({
    cacheName: 'wiskul-images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 }),
    ],
  })
);

// ---------------------------------------------------------------------------
// Fonts / static from same origin — cache-first.
// ---------------------------------------------------------------------------
registerRoute(
  ({ request }) => ['font', 'style', 'script'].includes(request.destination),
  new StaleWhileRevalidate({ cacheName: 'wiskul-static' })
);

// ===========================================================================
// Offline write queue replay (IndexedDB — mirrors src/lib/offlineQueue.ts)
// ===========================================================================
const DB_NAME = 'wiskul-offline';
const STORE = 'requests';

function openQueueDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('by-createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGetAll(db: IDBDatabase): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function idbDelete(db: IDBDatabase, id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function idbPut(db: IDBDatabase, value: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const MAX_ATTEMPTS = 5;

async function flushOfflineQueue(): Promise<number> {
  const db = await openQueueDb();
  const requests = (await idbGetAll(db)).sort((a, b) => a.createdAt - b.createdAt);
  let flushed = 0;

  for (const req of requests) {
    try {
      const res = await fetch(req.url, {
        method: req.method,
        headers: req.headers,
        body: req.body,
        credentials: 'include',
      });
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        await idbDelete(db, req.id);
        if (res.ok) flushed += 1;
      } else {
        req.attempts = (req.attempts || 0) + 1;
        if (req.attempts >= MAX_ATTEMPTS) await idbDelete(db, req.id);
        else await idbPut(db, req);
      }
    } catch {
      break; // still offline
    }
  }

  // Tell open clients how many items remain so they can update the UI.
  const remaining = (await idbGetAll(db)).length;
  const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
  clientsList.forEach((c) => c.postMessage({ type: 'OFFLINE_QUEUE_FLUSHED', flushed, remaining }));
  return flushed;
}

// ===========================================================================
// Lifecycle
// ===========================================================================
self.addEventListener('install', () => {
  // NOTE: we intentionally do NOT skipWaiting here. A freshly built SW stays in
  // "waiting" so the app can show an "Update available" prompt (OfflineBanner)
  // and only activate on the user's click (which posts SKIP_WAITING). This gives
  // teachers control and avoids reloading mid-task.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const data = (event as ExtendableMessageEvent).data;
  if (data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (data?.type === 'FLUSH_OFFLINE_QUEUE') {
    (event as ExtendableMessageEvent).waitUntil?.(flushOfflineQueue());
  }
});

// Background sync — fires when connectivity is restored.
self.addEventListener('sync', (event) => {
  const e = event as any;
  if (e.tag === 'sync-offline-queue') {
    e.waitUntil(flushOfflineQueue());
  }
});

// ===========================================================================
// Push notifications
// ===========================================================================
self.addEventListener('push', (event) => {
  let data: any = {};
  try {
    data = (event as PushEvent).data?.json() || {};
  } catch {
    data = { body: (event as PushEvent).data?.text() };
  }
  const options: NotificationOptions = {
    body: data.body || 'New notification',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: data.tag || 'wiskul',
    data: data.data || {},
  };
  (event as ExtendableEvent).waitUntil(
    self.registration.showNotification(data.title || 'WiSkul', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  const e = event as NotificationEvent;
  e.notification.close();
  const targetUrl = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

export {};
