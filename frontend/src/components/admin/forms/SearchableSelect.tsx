/**
 * SearchableSelect — Dropdown with built-in search for large datasets.
 * Reusable across all admin pages where schools deal with many options
 * (classes, subjects, teachers, students).
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, X, Check } from 'lucide-react';
import { SearchBar } from '@components/admin/table/SearchBar';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  error?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  label,
  required,
  error,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Filter options
  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const term = search.toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(term) || (o.sublabel?.toLowerCase().includes(term))
    );
  }, [options, search]);

  // Get display label
  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption?.label || placeholder;

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      <div ref={containerRef} className="relative">
        {/* Trigger */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 sm:py-2 border rounded-lg text-sm text-left transition-all ${
            isOpen
              ? 'border-blue-500 ring-2 ring-blue-500/20 bg-white dark:bg-gray-800'
              : error
                ? 'border-red-500 bg-white dark:bg-gray-800'
                : value
                  ? 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500'
          }`}
        >
          <span className="truncate flex-1">{displayLabel}</span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={12} />
              </button>
            )}
            <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {/* Dropdown — uses fixed positioning to escape overflow clipping */}
        {isOpen && (
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => { setIsOpen(false); setSearch(''); }} aria-hidden />
            <div
              className="fixed z-[70] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
              style={{
                top: containerRef.current ? containerRef.current.getBoundingClientRect().bottom + 4 : 0,
                left: containerRef.current ? containerRef.current.getBoundingClientRect().left : 0,
                width: containerRef.current ? containerRef.current.getBoundingClientRect().width : 'auto',
              }}
            >
            {/* Shared SearchBar inside Dropdown Popover */}
            <div className="p-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/30">
              <SearchBar
                placeholder={searchPlaceholder}
                onSearch={(val) => setSearch(val)}
                defaultValue={search}
                debounceMs={0}
                className="w-full"
              />
            </div>

            {/* Options list */}
            <div className="max-h-[240px] overflow-y-auto overscroll-contain">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-gray-400 dark:text-gray-500">
                  {emptyMessage}
                </div>
              ) : (
                filtered.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                      value === option.value ? 'bg-blue-50 dark:bg-blue-950/20' : ''
                    }`}
                  >
                    {value === option.value && (
                      <Check size={14} className="text-blue-500 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className={`block truncate ${value === option.value ? 'text-blue-700 dark:text-blue-400 font-semibold' : 'text-gray-900 dark:text-white'}`}>
                        {option.label}
                      </span>
                      {option.sublabel && (
                        <span className="block text-[11px] text-gray-400 dark:text-gray-500 truncate">
                          {option.sublabel}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
          </>
        )}
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
};

export default SearchableSelect;
