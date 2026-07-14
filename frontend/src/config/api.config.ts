/**
 * API Configuration
 * Phase 11: Frontend Dashboard Implementation
 *
 * On Vercel, the frontend and backend share the same domain — API calls use
 * relative URLs (no base URL needed). Locally, VITE_API_URL points to the
 * Express dev server.
 */

// In production (Vercel), leave baseURL empty so requests go to the same origin.
// Locally, proxy is configured in vite.config.ts so this also works as empty.
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const API_CONFIG = {
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
};

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    LOGIN: '/api/v1/auth/login',
    REGISTER: '/api/v1/auth/register',
    LOGOUT: '/api/v1/auth/logout',
    REFRESH_TOKEN: '/api/v1/auth/refresh',
    ME: '/api/v1/auth/me',
    CHANGE_PASSWORD: '/api/v1/auth/change-password',
    FORGOT_PASSWORD: '/api/v1/auth/forgot-password',
    RESET_PASSWORD: '/api/v1/auth/reset-password',
  },

  // Dashboard
  DASHBOARDS: {
    ADMIN_METRICS: '/api/v1/dashboards/admin/metrics',
    ADMIN_COMPLETE: '/api/v1/dashboards/admin/complete',
    ADMIN_PENDING_APPROVALS: '/api/v1/dashboards/admin/pending-approvals',
    ADMIN_FINANCIAL_SUMMARY: '/api/v1/dashboards/admin/financial-summary',
    ADMIN_ALERTS: '/api/v1/dashboards/admin/alerts',
    ADMIN_RECENT_ACTIVITIES: '/api/v1/dashboards/admin/recent-activities',
    ADMIN_STUDENTS_AT_RISK: '/api/v1/dashboards/admin/students-at-risk',
    ADMIN_SYSTEM_HEALTH: '/api/v1/dashboards/admin/system-health',

    // Charts
    CHART_ACADEMIC_PERFORMANCE: '/api/v1/dashboards/admin/chart/academic-performance',
    CHART_ATTENDANCE_TREND: '/api/v1/dashboards/admin/chart/attendance-trend',
    CHART_FEE_COLLECTION: '/api/v1/dashboards/admin/chart/fee-collection',
    CHART_STUDENT_DISTRIBUTION: '/api/v1/dashboards/admin/chart/student-distribution',

    // Role-specific
    TEACHER_DASHBOARD: '/api/v1/dashboards/teacher',
    STUDENT_DASHBOARD: '/api/v1/dashboards/student',
    PARENT_DASHBOARD: '/api/v1/dashboards/parent',
    ACCOUNTANT_DASHBOARD: '/api/v1/dashboards/accountant/overview',
    ADMISSIONS_DASHBOARD: '/api/v1/dashboards/admissions/overview',
  },

  // Users
  USERS: {
    LIST: '/api/v1/users',
    GET: (id: string) => `/api/v1/users/${id}`,
    CREATE: '/api/v1/users',
    UPDATE: (id: string) => `/api/v1/users/${id}`,
    DELETE: (id: string) => `/api/v1/users/${id}`,
    PROFILE: '/api/v1/users/profile',
    PREFERENCES: '/api/v1/users/preferences',
  },

  // Students
  STUDENTS: {
    LIST: '/api/v1/students',
    GET: (id: string) => `/api/v1/students/${id}`,
    CREATE: '/api/v1/students',
    UPDATE: (id: string) => `/api/v1/students/${id}`,
    DELETE: (id: string) => `/api/v1/students/${id}`,
  },

  // Classes
  CLASSES: {
    LIST: '/api/v1/classes',
    GET: (id: string) => `/api/v1/classes/${id}`,
    CREATE: '/api/v1/classes',
    UPDATE: (id: string) => `/api/v1/classes/${id}`,
    DELETE: (id: string) => `/api/v1/classes/${id}`,
  },

  // Enrollments
  ENROLLMENTS: {
    LIST: '/api/v1/enrollments',
    GET: (id: string) => `/api/v1/enrollments/${id}`,
    CREATE: '/api/v1/enrollments',
    UPDATE: (id: string) => `/api/v1/enrollments/${id}`,
    DELETE: (id: string) => `/api/v1/enrollments/${id}`,
  },

  // Grades
  GRADES: {
    LIST: '/api/v1/grades',
    GET: (id: string) => `/api/v1/grades/${id}`,
    CREATE: '/api/v1/grades',
    UPDATE: (id: string) => `/api/v1/grades/${id}`,
    DELETE: (id: string) => `/api/v1/grades/${id}`,
  },

  // Attendance
  ATTENDANCE: {
    LIST: '/api/v1/attendance',
    GET: (id: string) => `/api/v1/attendance/${id}`,
    CREATE: '/api/v1/attendance',
    UPDATE: (id: string) => `/api/v1/attendance/${id}`,
    DELETE: (id: string) => `/api/v1/attendance/${id}`,
  },

  // Fees & Payments
  FEES: {
    LIST: '/api/v1/fees',
    GET: (id: string) => `/api/v1/fees/${id}`,
    CREATE: '/api/v1/fees',
    UPDATE: (id: string) => `/api/v1/fees/${id}`,
  },

  PAYMENTS: {
    LIST: '/api/v1/payments',
    GET: (id: string) => `/api/v1/payments/${id}`,
    CREATE: '/api/v1/payments',
    UPDATE: (id: string) => `/api/v1/payments/${id}`,
  },
};

// Headers helper
export const getAuthHeaders = (token?: string) => {
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
  };
};
