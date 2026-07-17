import React, { useState } from 'react';
import { Filter, Plus, Download, Upload, X, ChevronDown } from 'lucide-react';
import { SearchBar } from './SearchBar';
import { MultiSelectFilter, MultiSelectOption } from './MultiSelectFilter';
import { DateRangePicker } from './DateRangePicker';
import { Button } from '../../ui/button';

export interface ActionBarFilter {
  key: string;
  label: string;
  type: 'multiselect' | 'daterange' | 'select';
  options?: MultiSelectOption[];
}

export interface ActionBarProps {
  onSearch?: (value: string) => void;
  /** Forward to SearchBar: shows spinner icon while loading */
  searchLoading?: boolean;
  /** Forward to SearchBar: shows "N results found" hint */
  searchResultCount?: number;
  filters?: ActionBarFilter[];
  filterValues?: Record<string, any>;
  onFilterChange?: (key: string, value: any) => void;
  onAdd?: () => void;
  onExport?: (format: 'csv' | 'pdf') => void;
  onImport?: () => void;
  addLabel?: string;
  isLoading?: boolean;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  onSearch,
  searchLoading,
  searchResultCount,
  filters = [],
  filterValues = {},
  onFilterChange,
  onAdd,
  onExport,
  onImport,
  addLabel = 'Add',
  isLoading,
}) => {
  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const activeFilterCount = Object.values(filterValues).filter(
    (v) => v !== undefined && v !== null && v !== '' && (!Array.isArray(v) || v.length > 0)
  ).length;

  const isMobileFilters = filters.length > 3;

  const renderFilters = () =>
    filters.map((f) => {
      if (f.type === 'multiselect') {
        return (
          <MultiSelectFilter
            key={f.key}
            label={f.label}
            options={f.options ?? []}
            selected={filterValues[f.key] ?? []}
            onChange={(val) => onFilterChange?.(f.key, val)}
          />
        );
      }
      if (f.type === 'daterange') {
        return (
          <DateRangePicker
            key={f.key}
            startDate={filterValues[`${f.key}_start`] ?? null}
            endDate={filterValues[`${f.key}_end`] ?? null}
            onChange={(range) => {
              onFilterChange?.(`${f.key}_start`, range.startDate);
              onFilterChange?.(`${f.key}_end`, range.endDate);
            }}
          />
        );
      }
      return null;
    });

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        {/* Left: search + inline filters (desktop only when ≤3 filters) */}
        <div className="flex flex-wrap items-center gap-2">
          {onSearch && (
            <SearchBar
              onSearch={onSearch}
              isLoading={searchLoading}
              resultCount={searchResultCount}
            />
          )}
          {/* Inline filters on desktop when ≤3 */}
          {!isMobileFilters && (
            <div className="hidden sm:flex items-center gap-2">
              {renderFilters()}
            </div>
          )}
          {/* Filters button (always on mobile, only for >3 filters on desktop) */}
          {(filters.length > 0) && (
            <button
              type="button"
              onClick={() => setSlideOverOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:bg-gray-50 ${isMobileFilters ? '' : 'sm:hidden'}`}
            >
              <Filter size={14} />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1 rounded-full bg-blue-600 text-white text-xs px-1.5 py-0.5 leading-none">
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {onImport && (
            <Button variant="outline" size="sm" onClick={onImport}>
              <Upload size={14} />
              <span className="hidden sm:inline">Import</span>
            </Button>
          )}
          {onExport && (
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExportOpen((v) => !v)}
              >
                <Download size={14} />
                <span className="hidden sm:inline">Export</span>
                <ChevronDown size={12} />
              </Button>
              {exportOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[150px]">
                  <button
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                    onClick={() => { onExport('csv'); setExportOpen(false); }}
                  >
                    Export to CSV
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                    onClick={() => { onExport('pdf'); setExportOpen(false); }}
                  >
                    Export to PDF
                  </button>
                </div>
              )}
            </div>
          )}
          {onAdd && (
            <Button variant="default" size="sm" onClick={onAdd}>
              <Plus size={14} />
              <span className="hidden sm:inline">{addLabel}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Slide-over panel for filters on mobile */}
      {slideOverOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setSlideOverOpen(false)}
            aria-hidden="true"
          />
          <div
            className="fixed right-0 top-0 h-full w-80 max-w-full bg-white z-50 shadow-xl flex flex-col"
            style={{ transform: slideOverOpen ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.2s ease-in-out' }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="font-semibold text-gray-900">Filters</span>
              <button
                onClick={() => setSlideOverOpen(false)}
                aria-label="Close filters"
                className="p-1 rounded hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {renderFilters()}
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default ActionBar;
