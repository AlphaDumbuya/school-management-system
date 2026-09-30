/**
 * YearFilter — the ONE academic-year dropdown used on every page that shows
 * year-specific data (Academic Year Architecture, Module 0).
 *
 * Options are DYNAMIC — the tenant's real academic sessions (via
 * useAcademicYears) — never fabricated from new Date(). Defaults to the active
 * year. Consistent look/behaviour across all portals.
 *
 * Usage:
 *   const [year, setYear] = useState('');
 *   <YearFilter value={year} onChange={setYear} />   // auto-selects active year
 */
import React, { useEffect } from 'react';
import { ChevronDown, Calendar } from 'lucide-react';
import { useAcademicYears } from '@hooks/useAcademicYears';

export interface YearFilterProps {
  value: string;
  onChange: (year: string) => void;
  /** Add an "All years" option (value = '') for list/history pages. */
  includeAllOption?: boolean;
  /** Show a small "Academic Year" label above the control. */
  label?: boolean;
  /** Extra classes for the wrapper. */
  className?: string;
  /** Disable auto-selecting the active year on first load. */
  noAutoSelect?: boolean;
}

export const YearFilter: React.FC<YearFilterProps> = ({
  value,
  onChange,
  includeAllOption = false,
  label = false,
  className = '',
  noAutoSelect = false,
}) => {
  const { years, activeYear, isLoading } = useAcademicYears();

  // Default to the active year once options load (unless "All years" is chosen
  // or auto-select is disabled or a value is already set).
  useEffect(() => {
    if (noAutoSelect) return;
    if (value) return;
    if (includeAllOption) return; // leave on "All years" by default
    if (activeYear) onChange(activeYear);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeYear, isLoading]);

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Academic Year</label>
      )}
      <div className="relative">
        <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={isLoading}
          className="appearance-none pl-8 pr-8 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[9rem]"
          aria-label="Academic year filter"
        >
          {includeAllOption && <option value="">All years</option>}
          {years.map((y) => (
            <option key={y} value={y}>{y}{y === activeYear ? ' (current)' : ''}</option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
      </div>
    </div>
  );
};

export default YearFilter;
