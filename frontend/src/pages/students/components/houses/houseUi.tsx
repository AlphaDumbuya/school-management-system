/**
 * Small shared pieces for the Houses pages: colour chip, readable text colour,
 * swatches and a helper that turns an API response into data (or an Error).
 */
import React from 'react';
import type { ApiResponse } from '@appTypes/index';

export const SWATCHES = [
  { name: 'Red', hex: '#dc2626' },
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Green', hex: '#16a34a' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Purple', hex: '#7c3aed' },
  { name: 'Orange', hex: '#ea580c' },
  { name: 'Teal', hex: '#0d9488' },
  { name: 'Pink', hex: '#db2777' },
];

/** Black or white, whichever reads better on this background colour. */
export function textOn(hex?: string | null): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#111827' : '#ffffff';
}

/** The house name on its colour (the name is always written out, never colour alone). */
export const HouseChip: React.FC<{ name?: string | null; color?: string | null; large?: boolean }> = ({ name, color, large }) => {
  if (!name) return <span className="text-xs text-gray-400">No house yet</span>;
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full font-bold break-words ${large ? 'px-4 py-1.5 text-base' : 'px-2.5 py-0.5 text-xs'}`}
      style={{ backgroundColor: color || '#6b7280', color: textOn(color) }}
    >
      {name}
    </span>
  );
};

/** Data of a successful response, or throw its error message (for react-query). */
export function unwrap<T>(r: ApiResponse<T>, fallback = 'Something went wrong. Try again.'): T {
  if (!r || r.success === false) throw new Error((r && r.error) || fallback);
  return r.data as T;
}

export const METHOD_LABEL: Record<string, string> = {
  ballot: 'Ballot',
  auto: 'Automatic on enrolment',
  sibling: 'Joined sibling',
  manual: 'Moved by staff',
  removed: 'House removed',
};

export const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

export const selectClass =
  'w-full appearance-none pl-3 pr-8 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500';
export const inputClass =
  'w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500';
