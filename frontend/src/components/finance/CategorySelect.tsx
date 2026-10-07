/**
 * CategorySelect: the standard expense categories plus "Other…", which shows
 * a text box so the school can type its own category (e.g. "Security
 * uniforms"). The value is the standard name or the typed one.
 */
import React, { useState } from 'react';
import { EXPENSE_CATEGORIES } from '@services/bursarService';

const OTHER = '__other__';

export const CategorySelect: React.FC<{
  id: string;
  value: string;
  onChange: (v: string) => void;
  /** Hide categories that don't apply here (e.g. Salaries for petty cash). */
  exclude?: string[];
  className?: string;
  compact?: boolean;
}> = ({ id, value, onChange, exclude = [], className = '', compact }) => {
  const options = EXPENSE_CATEGORIES.filter((c) => c !== 'Other' && !exclude.includes(c));
  const isStandard = !value || options.includes(value);
  const [custom, setCustom] = useState(!isStandard || value === 'Other');
  const pick = custom ? OTHER : value;
  const box = className || 'w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm';
  return (
    <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
      <select id={id} className={box} value={pick} onChange={(e) => {
        if (e.target.value === OTHER) { setCustom(true); onChange(''); }
        else { setCustom(false); onChange(e.target.value); }
      }}>
        <option value="" disabled>Choose a category…</option>
        {options.map((c) => <option key={c} value={c}>{c}</option>)}
        <option value={OTHER}>Other</option>
      </select>
      {custom && (
        <input
          aria-label="Your own category"
          autoFocus
          value={value === 'Other' ? '' : value}
          maxLength={60}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type the category, e.g. Security uniforms"
          className={box}
        />
      )}
    </div>
  );
};

export default CategorySelect;
