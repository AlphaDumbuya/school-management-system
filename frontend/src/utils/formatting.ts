/**
 * Data Formatting Utilities
 * Helper functions for formatting data for display
 * Phase 11: Frontend Dashboard Implementation
 */

import { format, parseISO, formatDistanceToNow } from 'date-fns';

/**
 * Format currency values (Sierra Leonean Leone - SLE)
 */
export const formatCurrency = (value: number, currency = 'SLE'): string => {
  try {
    // Custom formatting for SLE as it may not be fully supported in all browsers
    if (currency === 'SLE') {
      const formatted = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value);
      return `Le ${formatted}`;
    }
    
    // Fallback for other currencies
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    return formatter.format(value);
  } catch (error) {
    // Ultimate fallback
    return `Le ${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }
};

/**
 * Format percentage
 */
export const formatPercentage = (value: number, decimals = 1): string => {
  return `${(value).toFixed(decimals)}%`;
};

/**
 * Format numbers with commas (Sierra Leone locale)
 */
export const formatNumber = (value: number, decimals = 0): string => {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * Format date to readable string
 */
export const formatDate = (date: string | Date, formatStr = 'MMM dd, yyyy'): string => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, formatStr);
  } catch {
    return 'Invalid date';
  }
};

/**
 * Format date and time
 */
export const formatDateTime = (date: string | Date): string => {
  return formatDate(date, 'MMM dd, yyyy HH:mm');
};

/**
 * Format time only
 */
export const formatTime = (date: string | Date): string => {
  return formatDate(date, 'HH:mm');
};

/**
 * Format as relative time (e.g., "2 hours ago")
 */
export const formatRelativeTime = (date: string | Date): string => {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return formatDistanceToNow(dateObj, { addSuffix: true });
  } catch {
    return 'Unknown time';
  }
};

/**
 * Format student roll number
 */
export const formatRollNumber = (rollNumber: string): string => {
  return rollNumber.toUpperCase();
};

/**
 * Format full name
 */
export const formatFullName = (firstName: string, lastName: string): string => {
  return `${firstName} ${lastName}`.trim();
};

/**
 * Get initials from name
 */
export const getInitials = (firstName: string, lastName: string): string => {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
};

/**
 * Format email
 */
export const formatEmail = (email: string): string => {
  return email.toLowerCase();
};

/**
 * Format phone number (Sierra Leone format)
 */
export const formatPhone = (phone: string): string => {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // Format as +232-XX-XXXXXX for Sierra Leone
  if (digits.length === 8) {
    return `+232-${digits.slice(0, 2)}-${digits.slice(2)}`;
  }
  
  if (digits.length === 11 && digits.startsWith('232')) {
    return `+${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  }
  
  // Generic format
  return phone;
};

/**
 * Truncate text
 */
export const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

/**
 * Capitalize first letter
 */
export const capitalize = (text: string): string => {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

/**
 * Title case
 */
export const titleCase = (text: string): string => {
  return text
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Get grade color
 */
export const getGradeColor = (grade: number): string => {
  if (grade >= 90) return 'text-green-600';
  if (grade >= 75) return 'text-blue-600';
  if (grade >= 60) return 'text-yellow-600';
  if (grade >= 40) return 'text-orange-600';
  return 'text-red-600';
};

/**
 * Get grade label
 */
export const getGradeLabel = (grade: number): string => {
  if (grade >= 90) return 'Excellent';
  if (grade >= 75) return 'Good';
  if (grade >= 60) return 'Satisfactory';
  if (grade >= 40) return 'Pass';
  return 'Fail';
};

export default {
  formatCurrency,
  formatPercentage,
  formatNumber,
  formatDate,
  formatDateTime,
  formatTime,
  formatRelativeTime,
  formatRollNumber,
  formatFullName,
  getInitials,
  formatEmail,
  formatPhone,
  truncate,
  capitalize,
  titleCase,
  getGradeColor,
  getGradeLabel,
};
