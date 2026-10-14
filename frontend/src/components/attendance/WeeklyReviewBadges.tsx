/**
 * Small shared pieces of the weekly review: a rating badge (always shows the
 * word, never colour alone) and a Mon-Fri attendance day chip.
 */
import React from 'react';
import { DAY_STATUS, getRatingStyle, type WeekDayStatus } from '@lib/weeklyReview';

export const RatingBadge: React.FC<{ kind: 'Performance' | 'Behaviour'; value: number | null | undefined; className?: string }> = ({ kind, value, className = '' }) => {
  const style = getRatingStyle(value);
  if (!style) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500 dark:bg-gray-700/50 dark:text-gray-400 ${className}`}>
        <span className="font-semibold">{kind}:</span> Not rated
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${style.badge} ${className}`}>
      <span className="font-medium opacity-80">{kind}:</span>
      <span className="font-bold">{style.label}</span>
    </span>
  );
};

/**
 * One day of the week. `compact` shows a single letter (P/L/E/A) with the full
 * word kept for screen readers and the tooltip; otherwise the word is shown.
 */
export const DayChip: React.FC<{ day: string; fullDay?: string; status: WeekDayStatus; compact?: boolean }> = ({ day, fullDay, status, compact = false }) => {
  const s = DAY_STATUS[status];
  return (
    <div
      title={`${fullDay || day}: ${s.word}`}
      className={`flex min-w-0 flex-1 flex-col items-center rounded-lg border px-1 py-1 text-center leading-tight ${s.chip}`}
    >
      <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">{day}</span>
      {compact ? (
        <>
          <span aria-hidden="true" className="text-sm font-bold">{s.letter}</span>
          <span className="sr-only">{s.word}</span>
        </>
      ) : (
        <span className="max-w-full truncate text-[11px] font-semibold">{status === 'none' ? '–' : s.word}</span>
      )}
      {!compact && status === 'none' && <span className="sr-only">No register</span>}
    </div>
  );
};
