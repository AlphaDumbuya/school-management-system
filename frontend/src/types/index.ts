/**
 * Global TypeScript Types for Frontend Application
 * Phase 11: Frontend Dashboard Implementation
 */

// ============================================================================
// Authentication Types
// ============================================================================

export type UserRole = 'super_admin' | 'principal' | 'teacher' | 'student' | 'parent' | 'accountant' | 'admissions_officer';

export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  profileImage?: string;
  profilePhotoUrl?: string | null;
  verificationStatus?: 'unverified' | 'verified' | string | null;
  hasOnboarded?: boolean;
  tenantId?: string;
  schoolLogoUrl?: string;
  schoolName?: string;
  lastLogin?: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginCredentials {
  firstName: string;
  lastName: string;
  role: UserRole;
}

// ============================================================================
// Dashboard Types
// ============================================================================

export interface DashboardMetrics {
  totalStudents: number;
  activeStudents: number;
  totalTeachers: number;
  totalClasses: number;
  outstandingFees: number;
  totalCollected: number;
  attendanceRate: number;
  averageGrade: number;
  classroomsInUse: number;
  totalStaff: number;
  totalEnrollments: number;
}

export interface PendingApprovals {
  enrollmentRequests: number;
  paymentPlanRequests: number;
  leaveRequests: number;
  otherRequests: number;
  totalPending: number;
}

export interface FinancialSummary {
  totalRevenue: number;
  thisMonthCollected: number;
  thisMonthTarget: number;
  outstandingBalance: number;
  overdueAmount: number;
  collectionRate: number;
  trend: number;
  pendingFees: number;
  partiallyPaid: number;
}

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
export type AlertType = 'system' | 'financial' | 'academic' | 'operational';

export interface DashboardAlert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  severity: AlertSeverity;
  timestamp: string;
  actionUrl?: string;
  dismissible: boolean;
  actionLabel?: string;
}

export interface RecentActivity {
  id: string;
  type: string;
  description: string;
  user: string;
  timestamp: string;
  relatedEntity: string;
  severity: 'info' | 'success' | 'warning' | 'error';
}

export type RiskSeverity = 'high' | 'medium' | 'low';

export interface StudentAtRisk {
  id: string;
  name: string;
  rollNumber: string;
  className: string;
  riskFactors: string[];
  attendanceRate: number;
  averageGrade: number;
  lastActivity: string;
  severity: RiskSeverity;
}

export interface SystemHealth {
  databaseStatus: 'healthy' | 'warning' | 'error';
  lastBackup: string;
  apiResponseTime: number;
  storageUsage: number;
  activeUsers: number;
}

export interface ChartDataset {
  label: string;
  data: number[];
  borderColor?: string;
  backgroundColor?: string | string[];
  fill?: boolean;
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface CompleteDashboard {
  metrics: DashboardMetrics;
  alerts: DashboardAlert[];
  financialSummary: FinancialSummary;
  atRiskStudents: StudentAtRisk[];
  systemHealth: SystemHealth;
  charts: {
    academicPerformance: ChartData;
    attendanceTrend: ChartData;
    feeCollection: ChartData;
    studentDistribution: ChartData;
  };
  timestamp: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
  statusCode?: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================================
// Form Types
// ============================================================================

export interface FormError {
  field: string;
  message: string;
}

export interface LoginFormData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterFormData extends RegisterPayload {
  confirmPassword: string;
}

// ============================================================================
// Notification Types
// ============================================================================

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// ============================================================================
// User Preferences Types
// ============================================================================

export type Theme = 'light' | 'dark' | 'system';
export type Language = 'en' | 'ar' | 'fr' | 'ur';

export interface UserPreferences {
  theme: Theme;
  language: Language;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  inAppNotifications: boolean;
}

// ============================================================================
// Pagination Types
// ============================================================================

export interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SortState {
  field: string;
  direction: 'asc' | 'desc';
}

export interface FilterState {
  [key: string]: string | number | boolean | undefined;
}

// ============================================================================
// Query Parameters
// ============================================================================

export interface DashboardQueryParams {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
