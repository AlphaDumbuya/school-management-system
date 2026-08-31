/**
 * OfflineIndicator — a small, unobtrusive status pill.
 *  - Offline: shows an amber "You're offline" bar. If there are queued writes,
 *    it shows how many are waiting to sync.
 *  - Back online with a pending queue: shows a "Syncing N changes" state, then
 *    a brief "All changes synced" confirmation.
 * Hidden entirely when online with nothing pending.
 */
import React, { useEffect, useState } from 'react';
import { CloudOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-toastify';
import useOfflineStatus from '@hooks/useOfflineStatus';

export const OfflineIndicator: React.FC = () => {
  const { online, pending, syncing, refreshCount } = useOfflineStatus();
  const [justSynced, setJustSynced] = useState(false);
  const [prevPending, setPrevPending] = useState(pending);

  // Toast when a write is captured offline, and refresh the pending count.
  useEffect(() => {
    const onQueued = (e: Event) => {
      const msg = (e as CustomEvent).detail?.message || 'Saved offline. It will sync when you reconnect.';
      toast.info(msg, { icon: '📴' as any });
      refreshCount();
    };
    window.addEventListener('wiskul:offline-queued', onQueued);
    return () => window.removeEventListener('wiskul:offline-queued', onQueued);
  }, [refreshCount]);

  // Detect the transition from "had pending items" -> "queue empty" to show
  // a short-lived confirmation.
  useEffect(() => {
    if (prevPending > 0 && pending === 0 && online) {
      setJustSynced(true);
      const t = setTimeout(() => setJustSynced(false), 3000);
      return () => clearTimeout(t);
    }
    setPrevPending(pending);
  }, [pending, online, prevPending]);

  if (online && pending === 0 && !justSynced) return null;

  let bg = 'bg-amber-500';
  let icon = <CloudOff size={15} />;
  let text = "You're offline";

  if (!online && pending > 0) {
    text = `Offline — ${pending} change${pending > 1 ? 's' : ''} will sync when you reconnect`;
  } else if (online && (syncing || pending > 0)) {
    bg = 'bg-blue-600';
    icon = <RefreshCw size={15} className="animate-spin" />;
    text = `Syncing ${pending} change${pending > 1 ? 's' : ''}…`;
  } else if (justSynced) {
    bg = 'bg-emerald-600';
    icon = <CheckCircle2 size={15} />;
    text = 'All changes synced';
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-0 left-0 right-0 z-[9998] ${bg} text-white text-xs sm:text-sm
        font-medium px-4 py-1.5 flex items-center justify-center gap-2 shadow-md
        animate-in slide-in-from-top duration-300`}
    >
      {icon}
      <span className="truncate">{text}</span>
    </div>
  );
};

export default OfflineIndicator;
