/**
 * Configuration types for system settings and customization
 */

// School Configuration
export interface SchoolConfiguration {
  id: string;
  name: string;
  shortName?: string;
  logo?: string;
  logoPath?: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  website?: string;
  principalName: string;
  principalEmail: string;
  registrationNumber?: string;
  establishedYear?: number;
  createdAt: string;
  updatedAt: string;
}

// Grading Configuration
export interface GradingScale {
  id: string;
  name: string; // "A-F", "0-100", "Grade Points", etc.
  grades: GradeDefinition[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GradeDefinition {
  grade: string; // "A", "90-100", etc.
  minMarks: number;
  maxMarks: number;
  gradePoints?: number;
  description?: string;
}

export interface GradeConversionRule {
  id: string;
  fromScale: string; // Scale ID
  toScale: string; // Scale ID
  conversions: GradeConversion[];
  createdAt: string;
  updatedAt: string;
}

export interface GradeConversion {
  fromGrade: string;
  toGrade: string;
}

// Academic Session Configuration
export interface AcademicSession {
  id: string;
  name: string; // "2024-2025", "Academic Year 2024-25"
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  isActive: boolean;
  terms: AcademicTerm[];
  createdAt: string;
  updatedAt: string;
}

export interface AcademicTerm {
  id: string;
  name: string; // "Term 1", "Semester 1", etc.
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  examStartDate?: string;
  examEndDate?: string;
  description?: string;
}

// Fee Configuration
export interface FeeConfiguration {
  id: string;
  name: string;
  amount: number;
  currency: string; // "USD", "INR", etc.
  description?: string;
  applicableClasses?: string[]; // Class IDs
  dueDate?: string; // YYYY-MM-DD
  frequency: 'one-time' | 'monthly' | 'quarterly' | 'semi-annual' | 'annual';
  createdAt: string;
  updatedAt: string;
}

export interface FeeStructure {
  id: string;
  sessionId: string;
  feeTypes: FeeConfiguration[];
  totalAnnualFee: number;
  createdAt: string;
  updatedAt: string;
}

// Notification Configuration
export interface NotificationConfiguration {
  id: string;
  type: string; // "attendance", "grades", "fees", "events", "system"
  enabled: boolean;
  channels: NotificationChannel[];
  recipientTypes: string[]; // "student", "parent", "teacher", "admin"
  createdAt: string;
  updatedAt: string;
}

export interface NotificationChannel {
  name: 'email' | 'sms' | 'push' | 'in-app';
  enabled: boolean;
  template?: string;
}

export interface NotificationPreferenceTemplate {
  id: string;
  name: string;
  description?: string;
  preferences: NotificationConfiguration[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// Custom Field Configuration
export interface CustomField {
  id: string;
  entityType: string; // "student", "class", "teacher", "parent"
  fieldName: string;
  fieldLabel: string;
  fieldType: 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'textarea' | 'email' | 'phone';
  required: boolean;
  defaultValue?: any;
  options?: CustomFieldOption[]; // For select fields
  validation?: CustomFieldValidation;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomFieldOption {
  value: string;
  label: string;
  color?: string;
}

export interface CustomFieldValidation {
  minLength?: number;
  maxLength?: number;
  pattern?: string; // Regex pattern
  min?: number;
  max?: number;
  customValidator?: string; // Function name or reference
}

// System Settings
export interface SystemSettings {
  id: string;
  attendanceThreshold: number; // Minimum attendance percentage required
  sessionTimeout: number; // Session timeout in minutes
  passwordPolicy: PasswordPolicy;
  emailSettings?: EmailSettings;
  fileUploadSettings?: FileUploadSettings;
  systemLimits?: SystemLimits;
  createdAt: string;
  updatedAt: string;
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  expiryDays?: number; // 0 = no expiry
  historyCount?: number; // How many previous passwords to remember
}

export interface EmailSettings {
  smtpServer: string;
  smtpPort: number;
  useSSL: boolean;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

export interface FileUploadSettings {
  maxFileSize: number; // In MB
  allowedExtensions: string[];
  uploadDirectory: string;
  enableScan: boolean;
}

export interface SystemLimits {
  maxStudentsPerClass: number;
  maxClassesPerTeacher: number;
  maxSubjectsPerClass: number;
  maxAttendanceRecordsPerRequest: number;
  maxGradeRecordsPerRequest: number;
  maxFeeRecordsPerRequest: number;
}

// Configuration Response
export interface ConfigurationResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// Bulk Configuration Update
export interface ConfigurationUpdate {
  id: string;
  section: string; // 'school', 'grading', 'session', 'fee', 'notification', 'custom-field', 'system'
  data: any;
  updatedBy?: string;
  updatedAt: string;
}
