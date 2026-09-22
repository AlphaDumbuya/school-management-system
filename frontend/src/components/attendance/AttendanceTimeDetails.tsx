import React from 'react';

export interface TimedAttendanceRecord {
  session_type?: string | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  marked_at?: string | null;
}

function formatClock(value?: string | null): string {
  if (!value) return 'Not recorded';
  const match = value.match(/^(\d{2}:\d{2})(:\d{2})?/);
  return match ? `${match[1]}${match[2] ?? ''}` : value;
}

function formatRecordedAt(value?: string | null): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

/** School-local clock times are stored as SQL TIME values, not UTC instants. */
export const AttendanceTimeDetails: React.FC<{ record: TimedAttendanceRecord; className?: string }> = ({ record, className = '' }) => (
  <div className={`flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400 ${className}`}>
    <span>Session: {record.session_type?.replace('_', ' ') || 'Full day'}</span>
    <span>Arrived: {formatClock(record.check_in_time)}</span>
    <span>Left: {formatClock(record.check_out_time)}</span>
    <span>Recorded: {formatRecordedAt(record.marked_at)}</span>
  </div>
);
