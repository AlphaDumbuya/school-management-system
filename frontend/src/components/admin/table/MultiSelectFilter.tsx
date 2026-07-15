import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';

export interface MultiSelectOption {
  label: string;
  value: string;
}

export interface MultiSelectFilterProps {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({
  label,
  options,
  selected,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const selectAll = () => onChange(options.map((o) => o.value));
  const clearAll = () => onChange([]);
  const removeChip = (value: string) => onChange(selected.filter((v) => v !== value));

  const triggerLabel =
    selected.length === 0
      ? label
      : selected.length === 1
      ? options.find((o) => o.value === selected[0])?.label ?? label
      : `${options.find((o) => o.value === selected[0])?.label} +${selected.length - 1} more`;

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px] max-w-[260px]"
      >
        {/* Chips for selected items */}
        {selected.length > 0 ? (
          <span className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
            {selected.slice(0, 2).map((val) => {
              const opt = options.find((o) => o.value === val);
              return (
                <span
                  key={val}
                  className="bg-blue-100 text-blue-700 text-xs rounded px-1.5 py-0.5 flex items-center gap-0.5 flex-shrink-0"
                >
                  {opt?.label ?? val}
                  <button
                    type="button"
                    aria-label={`Remove ${opt?.label ?? val}`}
                    onClick={(e) => { e.stopPropagation(); removeChip(val); }}
                    className="hover:text-blue-900"
                  >
                    <X size={10} />
                  </button>
                </span>
              );
            })}
            {selected.length > 2 && (
              <span className="text-xs text-gray-500">+{selected.length - 2} more</span>
            )}
          </span>
        ) : (
          <span className="text-gray-500 flex-1 text-left truncate">{label}</span>
        )}
        <ChevronDown size={14} className="text-gray-400 flex-shrink-0 ml-auto" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[200px] max-h-60 overflow-y-auto">
          {/* Select all / Clear all */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 text-xs">
            <button
              type="button"
              onClick={selectAll}
              className="text-blue-600 hover:underline"
            >
              Select all
            </button>
            <span className="text-gray-300">|</span>
            <button
              type="button"
              onClick={clearAll}
              className="text-gray-500 hover:underline"
            >
              Clear all
            </button>
          </div>
          {/* Options */}
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              {opt.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

export default MultiSelectFilter;
