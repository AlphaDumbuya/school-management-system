import React, { useState } from 'react';
import { useTheme } from '@context/ThemeContext';
import { logger } from '@lib/logger';

/**
 * Theme Toggle Component
 * Button to toggle between light, dark, and system theme modes
 */
export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { mode, isDark, toggleTheme } = useTheme();
  const [showMenu, setShowMenu] = useState(false);

  const themeOptions = [
    { value: 'light', label: 'Light', icon: '☀️' },
    { value: 'dark', label: 'Dark', icon: '🌙' },
    { value: 'system', label: 'System', icon: '🖥️' },
  ] as const;

  const handleSelect = (newMode: typeof mode) => {
    toggleTheme(newMode);
    setShowMenu(false);
    logger.debug(`Theme changed to: ${newMode}`);
  };

  const currentTheme = themeOptions.find((t) => t.value === mode);

  return (
    <div className={`relative ${className}`}>
      {/* Toggle Button */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        aria-label="Toggle theme"
        title={`Current theme: ${mode}`}
      >
        {isDark ? (
          <svg
            className="w-5 h-5 text-yellow-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          </svg>
        ) : (
          <svg
            className="w-5 h-5 text-yellow-500"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 2a1 1 0 011 1v2a1 1 0 11-2 0V3a1 1 0 011-1zm4.293 1.293a1 1 0 011.414 0l1.414 1.414a1 1 0 11-1.414 1.414L14.586 3.707a1 1 0 010-1.414zm2.828 2.828a1 1 0 011.414 0l1.414 1.414a1 1 0 11-1.414 1.414l-1.414-1.414a1 1 0 010-1.414zm.364 5.657a1 1 0 10-1.414-1.414L12.05 9.364a1 1 0 101.414 1.414l1.414-1.414zm2.828 2.828a1 1 0 011.414 0l1.414 1.414a1 1 0 11-1.414 1.414l-1.414-1.414a1 1 0 010-1.414zm.364 5.657a1 1 0 10-1.414-1.414L12.05 15.364a1 1 0 101.414 1.414l1.414-1.414zM5.657 7.172a1 1 0 10-1.414 1.414L5.05 9.364a1 1 0 101.414-1.414L5.657 7.172zm0 5.656a1 1 0 10-1.414 1.414L5.05 15.364a1 1 0 101.414-1.414L5.657 12.828zM3.707 3.707a1 1 0 011.414 0L6.536 5.95a1 1 0 11-1.414 1.414L3.707 5.121a1 1 0 010-1.414zm0 9.172a1 1 0 011.414 0l1.414 1.414a1 1 0 11-1.414 1.414l-1.414-1.414a1 1 0 010-1.414zM10 15a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1zM4.172 12.172a1 1 0 010 1.414l-1.414 1.414a1 1 0 11-1.414-1.414l1.414-1.414a1 1 0 011.414 0zm12.656-12.656a1 1 0 010 1.414l-1.414 1.414a1 1 0 11-1.414-1.414l1.414-1.414a1 1 0 011.414 0zM5 10a1 1 0 011-1h2a1 1 0 110 2H6a1 1 0 01-1-1zm9-1a1 1 0 110 2h2a1 1 0 110-2h-2z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>

      {/* Dropdown Menu */}
      {showMenu && (
        <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          <div className="p-2 space-y-1">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mode === option.value
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <span>{option.icon}</span>
                <span>{option.label}</span>
                {mode === option.value && (
                  <svg
                    className="w-4 h-4 ml-auto"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeToggle;
