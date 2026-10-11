/**
 * Whole year / Term 1 / Term 2 / Term 3. The terms use the same dates as the
 * report card on the server, so a term's attendance here matches the card.
 */
import React from 'react';

export type TermValue = '' | 'first_term' | 'second_term' | 'third_term';

const OPTIONS: Array<{ value: TermValue; label: string }> = [
  { value: '', label: 'Whole year' },
  { value: 'first_term', label: 'Term 1' },
  { value: 'second_term', label: 'Term 2' },
  { value: 'third_term', label: 'Term 3' },
];

export const TermFilter: React.FC<{ value: TermValue; onChange: (t: TermValue) => void; className?: string }> = ({ value, onChange, className = '' }) => (
  <select
    aria-label="Term"
    value={value}
    onChange={(e) => onChange(e.target.value as TermValue)}
    className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-sm text-gray-700 dark:text-gray-200 ${className}`}
  >
    {OPTIONS.map((o) => <option key={o.value || 'year'} value={o.value}>{o.label}</option>)}
  </select>
);

export default TermFilter;
