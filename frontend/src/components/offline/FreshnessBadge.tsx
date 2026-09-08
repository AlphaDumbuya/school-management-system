/**
 * FreshnessBadge — a small "Data as of …" indicator for screens showing cached
 * (offline) data, so teachers know they're not looking at live data.
 */
import React from 'react';
import { Clock } from 'lucide-react';
import { timeAgo } from '../../offline/useSyncStatus';

export const FreshnessBadge: React.FC<{ lastSyncedAt?: string; fromCache?: boolean }> = ({ lastSyncedAt, fromCache }) => {
  if (!fromCache) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
      <Clock size={11} /> Data as of {timeAgo(lastSyncedAt)}
    </span>
  );
};

export default FreshnessBadge;
