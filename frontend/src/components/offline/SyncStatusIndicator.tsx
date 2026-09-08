/**
 * SyncStatusIndicator — a compact, always-visible connectivity + sync status
 * chip for the app header. Shows online/offline, pending offline writes, a
 * syncing spinner, and a manual "Sync now" action.
 *
 * Backed by useOfflineStatus (navigator.onLine + the IndexedDB write queue).
 */
import React from 'react';
import { Wifi, WifiOff, RefreshCw, Loader2, Check } from 'lucide-react';
import useOfflineStatus from '@hooks/useOfflineStatus';

export const SyncStatusIndicator: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { online, pending, syncing, flush } = useOfflineStatus();

  // Offline — amber, clearly communicates the state.
  if (!online) {
    return (
      <span
        title={pending ? `${pending} change(s) will sync when you're back online` : 'You are offline'}
        className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 text-xs font-semibold"
      >
        <WifiOff size={13} />
        {compact ? '' : 'Offline'}
        {pending > 0 && (
          <span className="ml-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5">{pending}</span>
        )}
      </span>
    );
  }

  // Online + syncing.
  if (syncing) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 text-xs font-semibold">
        <Loader2 size={13} className="animate-spin" />
        {compact ? '' : 'Syncing…'}
      </span>
    );
  }

  // Online + pending changes — offer a manual sync.
  if (pending > 0) {
    return (
      <button
        onClick={() => flush()}
        title="Sync pending changes now"
        className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-1 text-xs font-semibold transition-colors"
      >
        <RefreshCw size={13} />
        {compact ? '' : 'Sync'} <span className="rounded-full bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5">{pending}</span>
      </button>
    );
  }

  // Online + all synced.
  return (
    <span
      title="Online — all changes synced"
      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 text-xs font-semibold"
    >
      {compact ? <Wifi size={13} /> : <><Check size={13} /> Synced</>}
    </span>
  );
};

export default SyncStatusIndicator;
