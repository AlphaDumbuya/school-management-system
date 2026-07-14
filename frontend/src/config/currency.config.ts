/**
 * Currency Configuration
 * Centralized currency settings for the application
 */

export const CURRENCY_CONFIG = {
  code: 'SLE',
  symbol: 'Le',
  name: 'Sierra Leonean Leone',
  locale: 'en-SL',
  decimals: 2,
  format: {
    style: 'currency',
    currency: 'SLE',
    currencyDisplay: 'symbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  },
} as const;

/**
 * Format currency value with SLE
 */
export const formatSLE = (value: number): string => {
  try {
    // Use custom formatting since Intl.NumberFormat might not support SLE
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
    return `Le ${formatted}`;
  } catch (error) {
    // Fallback formatting
    return `Le ${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }
};

/**
 * Parse currency string to number
 */
export const parseSLE = (value: string): number => {
  const cleaned = value.replace(/[^0-9.-]/g, '');
  return parseFloat(cleaned) || 0;
};

export default CURRENCY_CONFIG;
