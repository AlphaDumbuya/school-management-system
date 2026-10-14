/**
 * RefreshButton — a small, reusable control for reloading a page's data.
 *
 * Pass an `onRefresh` that refetches the page's react-query queries (or calls
 * `queryClient.invalidateQueries`). Shows idle → loading → done/error states
 * with clear visual feedback so the user always knows something happened.
 */
import React, { useState, useCallback } from 'react';
import { RefreshCw, Check, X } from 'lucide-react';
import clsx from 'clsx';

export interface RefreshButtonProps {
  onRefresh: () => void | Promise<unknown>;
  /** Drive the spinner externally (optional — internal state takes precedence). */
  isRefreshing?: boolean;
  label?: string;
  className?: string;
  /** Keep the text label visible on phones too (default: icon only below `sm`). */
  labelOnMobile?: boolean;
}

type State = 'idle' | 'loading' | 'done' | 'error';

export const RefreshButton: React.FC<RefreshButtonProps> = ({
  onRefresh,
  isRefreshing,
  label = 'Refresh',
  className = '',
  labelOnMobile = false,
}) => {
  const [state, setState] = useState<State>('idle');
  const spinning = state === 'loading' || !!isRefreshing;

  const handleClick = useCallback(async () => {
    if (spinning) return;
    setState('loading');
    try {
      await Promise.resolve(onRefresh());
      setState('done');
      setTimeout(() => setState('idle'), 1500);
    } catch (err) {
      console.warn('[RefreshButton] refresh failed:', err);
      setState('error');
      setTimeout(() => setState('idle'), 2000);
    }
  }, [spinning, onRefresh]);

  const icon =
    state === 'done'  ? <Check size={15} /> :
    state === 'error' ? <X size={15} /> :
                        <RefreshCw size={15} className={spinning ? 'animate-spin' : ''} />;

  const display =
    state === 'loading' ? 'Refreshing…' :
    state === 'done'    ? 'Updated'     :
    state === 'error'   ? 'Failed'      : label;

  const style =
    state === 'done'  ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500' :
    state === 'error' ? 'bg-red-500 hover:bg-red-600 text-white border-red-500' :
                        'bg-[#315B8C] hover:bg-[#1d4ed8] text-white border-[#315B8C]';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={spinning}
      aria-label={display}
      title={display}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2',
        'text-xs font-bold shadow-sm transition-all duration-200',
        'active:scale-95 select-none disabled:opacity-70 disabled:cursor-not-allowed',
        style,
        className,
      )}
    >
      {icon}
      <span className={labelOnMobile ? 'inline' : 'hidden sm:inline'}>{display}</span>
    </button>
  );
};

export default RefreshButton;
