/**
 * RefreshButton — a small, reusable control for reloading a page's data.
 *
 * Pass an `onRefresh` that refetches the page's react-query queries (or calls
 * `queryClient.invalidateQueries`). The icon spins while the returned promise
 * is in flight. If the parent already tracks a refreshing state it can pass
 * `isRefreshing` to drive the spinner instead.
 */
import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';

export interface RefreshButtonProps {
  onRefresh: () => void | Promise<unknown>;
  isRefreshing?: boolean;
  label?: string;
  className?: string;
}

export const RefreshButton: React.FC<RefreshButtonProps> = ({
  onRefresh,
  isRefreshing,
  label = 'Refresh',
  className = '',
}) => {
  const [busy, setBusy] = useState(false);
  // Spin when EITHER the parent reports refreshing OR our own click is in
  // flight. (Using `??` broke this: a parent passing isRefreshing={false} at
  // click time suppressed the internal busy spinner, so the button looked dead.)
  const spinning = !!isRefreshing || busy;

  const handleClick = async () => {
    if (busy) return;
    try {
      setBusy(true);
      // Keep the spinner visible briefly so a cached/instant refetch still
      // gives the user clear feedback that something happened.
      await Promise.all([
        Promise.resolve(onRefresh()),
        new Promise((r) => setTimeout(r, 500)),
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={spinning}
      aria-label={label}
      title={label}
      className={`inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    >
      <RefreshCw size={16} className={spinning ? 'animate-spin' : ''} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
};

export default RefreshButton;
