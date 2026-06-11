import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { logger } from '@lib/logger';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  backgroundSecondary: string;
  text: string;
  textSecondary: string;
  border: string;
  borderLight: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

export interface Theme {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: (mode?: ThemeMode) => void;
  setTheme: (mode: ThemeMode) => void;
}

interface ThemeContextValue {
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// Light theme colors
const LIGHT_COLORS: ThemeColors = {
  primary: '#2563EB',
  secondary: '#7C3AED',
  background: '#FFFFFF',
  backgroundSecondary: '#F9FAFB',
  text: '#111827',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
};

// Dark theme colors
const DARK_COLORS: ThemeColors = {
  primary: '#60A5FA',
  secondary: '#A78BFA',
  background: '#111827',
  backgroundSecondary: '#1F2937',
  text: '#F3F4F6',
  textSecondary: '#9CA3AF',
  border: '#374151',
  borderLight: '#4B5563',
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
  info: '#60A5FA',
};

const CSS_VARIABLES: Record<keyof ThemeColors, string> = {
  primary: '--color-primary',
  secondary: '--color-secondary',
  background: '--color-background',
  backgroundSecondary: '--color-background-secondary',
  text: '--color-text',
  textSecondary: '--color-text-secondary',
  border: '--color-border',
  borderLight: '--color-border-light',
  success: '--color-success',
  warning: '--color-warning',
  error: '--color-error',
  info: '--color-info',
};

/**
 * Theme Context Provider
 * Manages application theme (light/dark/system)
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>('system');
  const [isDark, setIsDark] = useState(false);
  const [isSystemPreference, setIsSystemPreference] = useState(false);

  // Initialize theme from localStorage and system preference
  useEffect(() => {
    const initializeTheme = () => {
      // Load saved preference
      const savedMode = localStorage.getItem('theme-mode') as ThemeMode | null;

      if (savedMode) {
        setMode(savedMode);
        applyTheme(savedMode);
      } else {
        // Use system preference
        setMode('system');
        detectSystemPreference();
      }
    };

    initializeTheme();

    // Listen for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (mode === 'system') {
        setIsDark(e.matches);
        applyTheme('system', e.matches);
      }
    };

    try {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } catch (error) {
      // Fallback for older browsers
      logger.warn('System theme preference not supported:', error);
    }
  }, []);

  // Detect system preference
  const detectSystemPreference = useCallback(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(prefersDark);
    setIsSystemPreference(true);
    applyTheme('system', prefersDark);
  }, []);

  // Apply theme to DOM
  const applyTheme = useCallback((newMode: ThemeMode, forceDark?: boolean) => {
    try {
      const shouldBeDark =
        forceDark !== undefined
          ? forceDark
          : newMode === 'dark'
          ? true
          : newMode === 'light'
          ? false
          : window.matchMedia('(prefers-color-scheme: dark)').matches;

      const colors = shouldBeDark ? DARK_COLORS : LIGHT_COLORS;

      // Apply CSS variables
      const root = document.documentElement;
      (Object.entries(CSS_VARIABLES) as [keyof ThemeColors, string][]).forEach(
        ([colorKey, cssVar]) => {
          root.style.setProperty(cssVar, colors[colorKey]);
        }
      );

      // Update data-theme attribute
      if (shouldBeDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
        document.documentElement.classList.remove('dark');
      }

      setIsDark(shouldBeDark);

      logger.debug(`Theme applied: ${newMode} (${shouldBeDark ? 'dark' : 'light'})`);
    } catch (error) {
      logger.error('Error applying theme:', error);
    }
  }, []);

  // Toggle theme
  const toggleTheme = useCallback((nextMode?: ThemeMode) => {
    let newMode: ThemeMode;

    if (nextMode) {
      newMode = nextMode;
    } else {
      // Cycle through modes
      const modes: ThemeMode[] = ['light', 'dark', 'system'];
      const currentIndex = modes.indexOf(mode);
      newMode = modes[(currentIndex + 1) % modes.length];
    }

    setMode(newMode);
    localStorage.setItem('theme-mode', newMode);
    applyTheme(newMode);

    logger.info(`Theme toggled to: ${newMode}`);
  }, [mode, applyTheme]);

  // Set specific theme
  const setTheme = useCallback((newMode: ThemeMode) => {
    setMode(newMode);
    localStorage.setItem('theme-mode', newMode);
    applyTheme(newMode);
    logger.info(`Theme set to: ${newMode}`);
  }, [applyTheme]);

  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  const theme: Theme = {
    mode,
    isDark,
    colors,
    toggleTheme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={{ theme }}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Hook to use theme context
 */
export const useTheme = (): Theme => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context.theme;
};

export default ThemeContext;
