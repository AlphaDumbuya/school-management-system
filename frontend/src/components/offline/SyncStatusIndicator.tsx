/**
 * SyncStatusIndicator — compact, always-visible connectivity + sync chip for the
 * header. Shows online/offline, pending writes, a syncing spinner, failed-sync
 * count, last-synced time (tooltip), and a manual "Sync now" action.
 *
 * Backed by useSyncStatus (Dexie outbox + error rows + sync_meta). For non-
 * teacher roles it falls back to a simple online/offline pill.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Wifi, WifiOff, RefreshCw, Loader2, Check, AlertTriangle } from 'lucide-react';
import { useSyncStatus, timeAgo } from '../../offline/useSyncStatus';

export const SyncStatusIndicator: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const navigate = useNavigate();
  const { online, pending, failed, syncing, lastPulledAt, syncNow, isTeacher } = useSyncStatus();

  // Non-teacher roles: just a plain online/offline dot (no offline sync path).
  if (!isTeacher) {
    return online ? null : (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 text-xs font-semibold">
        <WifiOff size={13} /> {compact ? '' : 'Offline'}
      </span>
    );
  }

  const syncedTitle = `Last synced ${timeAgo(lastPulledAt)}`;

  // Offline.
  if (!online) {
    return (
      <span
        title={pending ? `${pending} change(s) will sync when you're back online` : 'You are offline'}
        className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 text-xs font-semibold"
      >
        <WifiOff size={13} />
        {compact ? '' : 'Offline'}
        {pending > 0 && <span className="ml-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5">{pending}</span>}
      </span>
    );
  }

  // Online + syncing.
  if (syncing) {
    return (
      <span title={syncedTitle} className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 text-xs font-semibold">
        <Loader2 size={13} className="animate-spin" /> {compact ? '' : 'Syncing…'}
      </span>
    );
  }

  // Online + failed items — nudge the user to open the Sync issues view.
  if (failed > 0) {
    return (
      <button
        onClick={() => navigate('/sync-issues')}
        title={`${failed} change(s) could not sync — tap to review`}
        className="inline-flex items-center gap-1.5 rounded-full bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-2.5 py-1 text-xs font-semibold transition-colors"
      >
        <AlertTriangle size={13} /> {compact ? '' : 'Sync issues'} <span className="rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5">{failed}</span>
      </button>
    );
  }

  // Online + pending — offer manual sync.
  if (pending > 0) {
    return (
      <button
        onClick={() => syncNow()}
        title={`${pending} pending · ${syncedTitle}`}
        className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-1 text-xs font-semibold transition-colors"
      >
        <RefreshCw size={13} /> {compact ? '' : 'Sync'} <span className="rounded-full bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5">{pending}</span>
      </button>
    );
  }

  // Online + all synced.
  return (
    <span title={syncedTitle} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 text-xs font-semibold">
      {compact ? <Wifi size={13} /> : <><Check size={13} /> Synced</>}
    </span>
  );
};

export default SyncStatusIndicator;
