/**
 * Service Worker Hook - Phase 20
 * Manages service worker registration and offline support
 */

import { useEffect, useState } from 'react';

interface ServiceWorkerStatus {
  isRegistered: boolean;
  isActive: boolean;
  isUpdateAvailable: boolean;
  cacheSize?: number;
}

export const useServiceWorker = () => {
  const [status, setStatus] = useState<ServiceWorkerStatus>({
    isRegistered: false,
    isActive: false,
    isUpdateAvailable: false,
  });

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    let serviceWorker: ServiceWorkerContainer;

    const registerServiceWorker = async () => {
      try {
        serviceWorker = navigator.serviceWorker;

        // Register service worker
        const registration = await serviceWorker.register('/service-worker.js', {
          scope: '/',
        });

        setStatus((prev) => ({
          ...prev,
          isRegistered: true,
          isActive: registration.active != null,
        }));

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;

          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New update available
              setStatus((prev) => ({
                ...prev,
                isUpdateAvailable: true,
              }));
            }
          });
        });

        // Handle controller change
        serviceWorker.addEventListener('controllerchange', () => {
          setStatus((prev) => ({
            ...prev,
            isActive: true,
          }));
        });

        // Get cache size
        getCacheSize();

      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    };

    registerServiceWorker();
  }, []);

  const getCacheSize = async () => {
    if ('estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        setStatus((prev) => ({
          ...prev,
          cacheSize: estimate.usage,
        }));
      } catch (error) {
        console.error('Failed to get cache size:', error);
      }
    }
  };

  const skipWaiting = () => {
    if (!('serviceWorker' in navigator)) return;

    const clients = navigator.serviceWorker.controller;
    if (clients) {
      clients.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  const clearCache = async () => {
    if (!('caches' in window)) return;

    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      setStatus((prev) => ({
        ...prev,
        cacheSize: 0,
      }));
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  };

  const requestSync = async (tag: 'sync-attendance' | 'sync-grades' | 'sync-schedule') => {
    if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      if ('sync' in registration) {
        await (registration as any).sync.register(tag);
      }
    } catch (error) {
      console.error('Background sync failed:', error);
    }
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  };

  const subscribeToNotifications = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Get push subscription
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        // Create new subscription
        const vapidPublicKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
          console.error('VAPID public key not configured');
          return null;
        }

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to notifications:', error);
      return null;
    }
  };

  const unsubscribeFromNotifications = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }
    } catch (error) {
      console.error('Failed to unsubscribe from notifications:', error);
    }
  };

  return {
    status,
    skipWaiting,
    clearCache,
    requestSync,
    requestNotificationPermission,
    subscribeToNotifications,
    unsubscribeFromNotifications,
    getCacheSize,
  };
};

/**
 * Convert VAPID public key to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export default useServiceWorker;
