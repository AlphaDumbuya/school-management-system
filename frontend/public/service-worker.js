/**
 * Service Worker for Phase 20 Mobile Offline Support
 * Handles offline caching, push notifications, and background sync
 */

const CACHE_NAME = 'school-portal-v1';
const API_CACHE_NAME = 'school-portal-api-v1';
const RUNTIME_CACHE_NAME = 'school-portal-runtime-v1';

// Files to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/manifest.json',
];

// Install event - Cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && 
              cacheName !== API_CACHE_NAME && 
              cacheName !== RUNTIME_CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - Network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    return event.respondWith(networkFirstStrategy(request));
  }

  // Handle static assets
  if (request.method === 'GET' && isStaticAsset(url)) {
    return event.respondWith(cacheFirstStrategy(request));
  }

  // Default to network first
  event.respondWith(networkFirstStrategy(request));
});

/**
 * Network First Strategy
 * Try network first, fallback to cache if offline
 */
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Network failed, try cache
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    // Return offline page or error response
    if (request.headers.get('Accept').includes('application/json')) {
      return new Response(
        JSON.stringify({ error: 'Offline', offline: true }),
        { 
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response('Offline', { status: 503 });
  }
}

/**
 * Cache First Strategy
 * Use cache, update in background
 */
async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Update cache in background
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const cache = caches.open(RUNTIME_CACHE_NAME);
          cache.then((c) => c.put(request, response));
        }
      })
      .catch(() => {});

    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Not found', { status: 404 });
  }
}

/**
 * Check if URL is a static asset
 */
function isStaticAsset(url) {
  return /\.(js|css|woff|woff2|eot|ttf|otf|png|jpg|jpeg|gif|svg|webp)$/.test(
    url.pathname
  );
}

// Message event - Handle client messages
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((cacheNames) => {
      Promise.all(cacheNames.map((name) => caches.delete(name)));
    });
  }

  if (event.data && event.data.type === 'GET_CACHE_SIZE') {
    getCacheSize().then((size) => {
      event.ports[0].postMessage({ cacheSize: size });
    });
  }
});

/**
 * Get total cache size
 */
async function getCacheSize() {
  if ('estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return estimate.usage;
  }
  return 0;
}

// Push notification event
self.addEventListener('push', (event) => {
  const data = event.data?.json?.() || {};
  const options = {
    body: data.body || 'New notification',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: data.tag || 'notification',
    vibrate: [100, 50, 100],
    data: data.data || {},
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'School Portal', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then((clientList) => {
        // Focus existing window if available
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});

// Background sync event
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-attendance') {
    event.waitUntil(syncAttendance());
  }
  if (event.tag === 'sync-grades') {
    event.waitUntil(syncGrades());
  }
  if (event.tag === 'sync-schedule') {
    event.waitUntil(syncSchedule());
  }
});

/**
 * Sync attendance data
 */
async function syncAttendance() {
  try {
    const cache = await caches.open(API_CACHE_NAME);
    const response = await fetch('/api/v1/attendance');
    if (response.ok) {
      cache.put('/api/v1/attendance', response.clone());
    }
  } catch (error) {
    console.error('Sync attendance failed:', error);
  }
}

/**
 * Sync grades data
 */
async function syncGrades() {
  try {
    const cache = await caches.open(API_CACHE_NAME);
    const response = await fetch('/api/v1/grades');
    if (response.ok) {
      cache.put('/api/v1/grades', response.clone());
    }
  } catch (error) {
    console.error('Sync grades failed:', error);
  }
}

/**
 * Sync schedule data
 */
async function syncSchedule() {
  try {
    const cache = await caches.open(API_CACHE_NAME);
    const response = await fetch('/api/v1/schedules');
    if (response.ok) {
      cache.put('/api/v1/schedules', response.clone());
    }
  } catch (error) {
    console.error('Sync schedule failed:', error);
  }
}
