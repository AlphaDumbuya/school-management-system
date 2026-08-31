/**
 * useOfflineStatus — tracks online/offline state and the number of pending
 * offline writes waiting to sync. Also triggers a queue replay when the
 * connection is restored.
 */
import { useEffect, useState, useCallback } from 'react';
import { replayQueue, getQueueCount } from '@lib/offlineQueue';

export function useOfflineStatus() {
  const [online, setOnline] = useState<boolean>(navigator.onLine);
  const [pending, setPending] = useState<number>(0);
  const [syncing, setSyncing] = useState<boolean>(false);

  const refreshCount = useCallback(async () => {
    try {
      setPending(await getQueueCount());
    } catch {
      /* ignore */
    }
  }, []);

  const flush = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    try {
      await replayQueue();
    } finally {
      setSyncing(false);
      await refreshCount();
    }
  }, [refreshCount]);

  useEffect(() => {
    refreshCount();

    const handleOnline = () => {
      setOnline(true);
      flush();
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // The SW posts this after it flushes the queue via Background Sync.
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OFFLINE_QUEUE_FLUSHED') {
        setPending(event.data.remaining ?? 0);
      }
    };
    navigator.serviceWorker?.addEventListener('message', onMessage);

    // Poll occasionally so the badge stays fresh while offline edits accrue.
    const interval = window.setInterval(refreshCount, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      navigator.serviceWorker?.removeEventListener('message', onMessage);
      window.clearInterval(interval);
    };
  }, [flush, refreshCount]);

  return { online, pending, syncing, flush, refreshCount };
}

export default useOfflineStatus;
