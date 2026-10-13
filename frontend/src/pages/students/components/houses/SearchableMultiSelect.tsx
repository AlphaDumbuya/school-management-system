/**
 * A filter dropdown with its own search box and tick-boxes, so one or several
 * (or all) options can be chosen. Nothing ticked means "all".
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

export interface MultiOption { value: string; label: string; hint?: string; muted?: boolean }

export const SearchableMultiSelect: React.FC<{
  id: string;
  /** Accessible name, e.g. "Classes". */
  label: string;
  /** Text when nothing is ticked, e.g. "All classes". */
  allLabel: string;
  /** Plural noun for the count, e.g. "classes". */
  noun: string;
  options: MultiOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  className?: string;
}> = ({ id, label, allLabel, noun, options, selected, onChange, className = '' }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); buttonRef.current?.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey, true); };
  }, [open]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const chosen = options.filter((o) => selected.includes(o.value));
  const summary = chosen.length === 0 ? allLabel : chosen.length === 1 ? chosen[0].label : `${chosen.length} ${noun}`;
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button ref={buttonRef} id={id} type="button" aria-haspopup="true" aria-expanded={open} aria-label={`${label}: ${summary}`}
        onClick={() => { setOpen((v) => !v); setQuery(''); }}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
        <span className="truncate">{summary}</span>
        <ChevronDown size={15} aria-hidden="true" className={`flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[260px] rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="relative mb-2">
            <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input ref={searchRef} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${noun}…`} aria-label={`Search ${noun}`}
              className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-8 pr-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100" />
          </div>
          <div className="mb-1 flex items-center justify-between px-1 text-xs">
            <button type="button" className="font-semibold text-blue-600 hover:underline" onClick={() => onChange(Array.from(new Set([...selected, ...shown.map((o) => o.value)])))}>
              Tick {query.trim() ? 'all shown' : `all ${noun}`}
            </button>
            <button type="button" className="font-semibold text-gray-600 hover:underline dark:text-gray-300" onClick={() => onChange([])} disabled={selected.length === 0}>
              Clear (show all)
            </button>
          </div>
          <ul className="max-h-64 overflow-y-auto" role="group" aria-label={label}>
            {shown.length === 0 ? (
              <li className="px-2 py-3 text-center text-sm text-gray-500">Nothing matches “{query}”</li>
            ) : shown.map((o) => {
              const on = selected.includes(o.value);
              return (
                <li key={o.value}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <input type="checkbox" checked={on} onChange={() => toggle(o.value)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className={`flex-1 truncate ${o.muted ? 'text-gray-400' : 'text-gray-800 dark:text-gray-100'}`}>{o.label}</span>
                    {o.hint && <span className="text-xs text-gray-500">{o.hint}</span>}
                    {on && <Check size={13} aria-hidden="true" className="text-blue-600" />}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
