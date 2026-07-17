import React, { useState, useEffect, useRef, useId } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

export interface SearchBarProps {
  onSearch: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
  /** Show a spinner while results are loading */
  isLoading?: boolean;
  /** Display "N results" hint below the bar after a search */
  resultCount?: number;
  /** Initial value (uncontrolled default) */
  defaultValue?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  placeholder = 'Search…',
  debounceMs = 300,
  className,
  isLoading = false,
  resultCount,
  defaultValue = '',
}) => {
  const [value, setValue] = useState(defaultValue);
  const [isFocused, setIsFocused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  /* Debounced search */
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onSearch(value), debounceMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [value, debounceMs, onSearch]);

  const handleClear = () => {
    setValue('');
    onSearch('');
    inputRef.current?.focus();
  };

  /* Ctrl/Cmd + K shortcut to focus */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const showResultCount = !isLoading && value.length > 0 && resultCount !== undefined;

  return (
    <div className={`search-bar-wrapper ${className ?? ''}`}>
      {/* Input row */}
      <div
        className={[
          'search-bar-inner',
          isFocused ? 'search-bar-inner--focused' : '',
          value ? 'search-bar-inner--has-value' : '',
        ].join(' ')}
      >
        {/* Left icon — spinner when loading, magnifier otherwise */}
        <span className="search-bar-icon" aria-hidden="true">
          {isLoading ? (
            <Loader2 size={15} className="search-bar-spinner" />
          ) : (
            <Search size={15} />
          )}
        </span>

        <input
          ref={inputRef}
          id={id}
          type="search"
          role="searchbox"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="search-bar-input"
        />

        {/* Clear button */}
        {value && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            tabIndex={0}
            className="search-bar-clear"
          >
            <X size={13} />
          </button>
        )}

        {/* Keyboard shortcut badge — only when empty & not focused */}
        {!value && !isFocused && (
          <span className="search-bar-kbd" aria-hidden="true">
            <kbd>⌘K</kbd>
          </span>
        )}
      </div>

      {/* Result count hint */}
      {showResultCount && (
        <p className="search-bar-hint" aria-live="polite">
          {resultCount === 0
            ? 'No results found'
            : `${resultCount} result${resultCount !== 1 ? 's' : ''} found`}
        </p>
      )}

      <style>{`
        .search-bar-wrapper {
          display: flex;
          flex-direction: column;
          gap: 4px;
          width: 220px;
          transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .search-bar-inner--focused,
        .search-bar-inner--has-value {
          /* parent wrapper also expands */
        }
        .search-bar-wrapper:focus-within {
          width: 280px;
        }
        @media (max-width: 640px) {
          .search-bar-wrapper,
          .search-bar-wrapper:focus-within {
            width: 100%;
          }
        }

        .search-bar-inner {
          position: relative;
          display: flex;
          align-items: center;
          height: 36px;
          border-radius: 10px;
          border: 1.5px solid #e2e8f0;
          background: #ffffff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          transition:
            border-color 0.2s ease,
            box-shadow 0.2s ease,
            background 0.2s ease;
          overflow: hidden;
        }
        .search-bar-inner--focused {
          border-color: #6366f1;
          box-shadow:
            0 0 0 3px rgba(99, 102, 241, 0.12),
            0 1px 3px rgba(0,0,0,0.06);
          background: #fafaff;
        }

        /* Dark mode */
        @media (prefers-color-scheme: dark) {
          .search-bar-inner {
            border-color: #334155;
            background: #1e293b;
          }
          .search-bar-inner--focused {
            border-color: #818cf8;
            box-shadow:
              0 0 0 3px rgba(129, 140, 248, 0.15),
              0 1px 3px rgba(0,0,0,0.2);
            background: #1e2540;
          }
        }
        .dark .search-bar-inner {
          border-color: #334155;
          background: #1e293b;
        }
        .dark .search-bar-inner--focused {
          border-color: #818cf8;
          box-shadow:
            0 0 0 3px rgba(129, 140, 248, 0.15),
            0 1px 3px rgba(0,0,0,0.2);
          background: #1e2540;
        }

        .search-bar-icon {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding-left: 11px;
          color: #94a3b8;
          pointer-events: none;
          transition: color 0.2s;
        }
        .search-bar-inner--focused .search-bar-icon {
          color: #6366f1;
        }
        .dark .search-bar-inner--focused .search-bar-icon {
          color: #818cf8;
        }

        .search-bar-spinner {
          animation: sb-spin 0.9s linear infinite;
        }
        @keyframes sb-spin {
          to { transform: rotate(360deg); }
        }

        .search-bar-input {
          flex: 1;
          height: 100%;
          padding: 0 8px;
          font-size: 13.5px;
          font-weight: 400;
          color: #0f172a;
          background: transparent;
          border: none;
          outline: none;
          min-width: 0;
          /* kill browser search chrome */
          -webkit-appearance: none;
        }
        .search-bar-input::placeholder {
          color: #94a3b8;
          font-weight: 400;
        }
        .search-bar-input::-webkit-search-cancel-button,
        .search-bar-input::-webkit-search-decoration {
          display: none;
        }
        .dark .search-bar-input {
          color: #e2e8f0;
        }
        .dark .search-bar-input::placeholder {
          color: #64748b;
        }

        .search-bar-clear {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          margin-right: 7px;
          border-radius: 50%;
          border: none;
          background: #e2e8f0;
          color: #64748b;
          cursor: pointer;
          transition: background 0.15s, color 0.15s, transform 0.15s;
          padding: 0;
        }
        .search-bar-clear:hover {
          background: #cbd5e1;
          color: #0f172a;
          transform: scale(1.1);
        }
        .dark .search-bar-clear {
          background: #334155;
          color: #94a3b8;
        }
        .dark .search-bar-clear:hover {
          background: #475569;
          color: #e2e8f0;
        }

        .search-bar-kbd {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          padding-right: 8px;
        }
        .search-bar-kbd kbd {
          display: inline-flex;
          align-items: center;
          padding: 2px 5px;
          font-size: 10px;
          font-family: inherit;
          font-weight: 500;
          color: #94a3b8;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-bottom-width: 2px;
          border-radius: 4px;
          letter-spacing: 0.02em;
          line-height: 1.4;
          white-space: nowrap;
        }
        .dark .search-bar-kbd kbd {
          color: #64748b;
          background: #1e293b;
          border-color: #334155;
        }

        .search-bar-hint {
          font-size: 11.5px;
          color: #64748b;
          padding-left: 12px;
          animation: sb-fadein 0.2s ease;
        }
        @keyframes sb-fadein {
          from { opacity: 0; transform: translateY(-2px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .dark .search-bar-hint {
          color: #475569;
        }
      `}</style>
    </div>
  );
};

export default SearchBar;
