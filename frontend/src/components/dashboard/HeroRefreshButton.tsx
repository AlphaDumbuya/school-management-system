/**
 * HeroRefreshButton — a translucent refresh control designed to sit on the
 * coloured WelcomeHero gradient. Spins while the refresh is in flight (with a
 * short minimum so instant/cached refetches still give visible feedback).
 */
import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';

export interface HeroRefreshButtonProps {
  onRefresh: () => void | Promise<unknown>;
  label?: string;
}

export const HeroRefreshButton: React.FC<HeroRefreshButtonProps> = ({ onRefresh, label = 'Refresh' }) => {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    try {
      setBusy(true);
      await Promise.all([
        Promise.resolve()
          .then(() => onRefresh())
          .catch((err) => console.warn('[Refresh] a query failed to refetch:', err)),
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
      disabled={busy}
      aria-label={label}
      title={label}
      className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/20 hover:bg-white/25 transition-colors disabled:opacity-70"
    >
      <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
      {label}
    </button>
  );
};

export default HeroRefreshButton;
