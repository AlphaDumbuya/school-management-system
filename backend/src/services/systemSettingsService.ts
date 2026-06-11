import {
  SystemSettings,
  PasswordPolicy,
  EmailSettings,
  FileUploadSettings,
  SystemLimits,
  ConfigurationResponse,
} from '../types/configuration';

/**
 * System Settings Service
 * Manages global system configuration and settings
 */
export class SystemSettingsService {
  private systemSettings: SystemSettings | null = null;

  /**
   * Initialize default system settings
   */
  initializeDefaults(): SystemSettings {
    this.systemSettings = {
      id: 'system-settings',
      attendanceThreshold: 75, // 75% attendance required
      sessionTimeout: 30, // 30 minutes session timeout
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        expiryDays: 90,
        historyCount: 5,
      },
      emailSettings: {
        smtpServer: 'smtp.example.com',
        smtpPort: 587,
        useSSL: true,
        username: 'noreply@school.com',
        password: '***encrypted***',
        fromEmail: 'noreply@school.com',
        fromName: 'School Management System',
      },
      fileUploadSettings: {
        maxFileSize: 10, // 10 MB
        allowedExtensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.gif'],
        uploadDirectory: '/uploads',
        enableScan: true,
      },
      systemLimits: {
        maxStudentsPerClass: 50,
        maxClassesPerTeacher: 6,
        maxSubjectsPerClass: 8,
        maxAttendanceRecordsPerRequest: 5000,
        maxGradeRecordsPerRequest: 5000,
        maxFeeRecordsPerRequest: 5000,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return this.systemSettings;
  }

  /**
   * Get system settings
   */
  async getSettings(): Promise<SystemSettings> {
    if (!this.systemSettings) {
      this.initializeDefaults();
    }
    return this.systemSettings!;
  }

  /**
   * Update attendance threshold
   */
  async updateAttendanceThreshold(threshold: number): Promise<ConfigurationResponse<number>> {
    try {
      if (threshold < 0 || threshold > 100) {
        return {
          success: false,
          error: 'Attendance threshold must be between 0 and 100',
          timestamp: new Date().toISOString(),
        };
      }

      const settings = await this.getSettings();
      settings.attendanceThreshold = threshold;
      settings.updatedAt = new Date().toISOString();

      return {
        success: true,
        data: threshold,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Update session timeout
   */
  async updateSessionTimeout(minutes: number): Promise<ConfigurationResponse<number>> {
    try {
      if (minutes <= 0) {
        return {
          success: false,
          error: 'Session timeout must be greater than 0',
          timestamp: new Date().toISOString(),
        };
      }

      const settings = await this.getSettings();
      settings.sessionTimeout = minutes;
      settings.updatedAt = new Date().toISOString();

      return {
        success: true,
        data: minutes,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Update password policy
   */
  async updatePasswordPolicy(policy: Partial<PasswordPolicy>): Promise<ConfigurationResponse<PasswordPolicy>> {
    try {
      const settings = await this.getSettings();

      if (policy.minLength && policy.minLength < 1) {
        return {
          success: false,
          error: 'Minimum password length must be at least 1',
          timestamp: new Date().toISOString(),
        };
      }

      settings.passwordPolicy = {
        ...settings.passwordPolicy,
        ...policy,
      };
      settings.updatedAt = new Date().toISOString();

      return {
        success: true,
        data: settings.passwordPolicy,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Validate password against policy
   */
  async validatePassword(password: string): Promise<{ valid: boolean; errors: string[] }> {
    const settings = await this.getSettings();
    const policy = settings.passwordPolicy;
    const errors: string[] = [];

    if (password.length < policy.minLength) {
      errors.push(`Password must be at least ${policy.minLength} characters long`);
    }

    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (policy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Update email settings
   */
  async updateEmailSettings(settings: Partial<EmailSettings>): Promise<ConfigurationResponse<EmailSettings>> {
    try {
      const systemSettings = await this.getSettings();

      // Validate SMTP settings
      if (settings.smtpPort && (settings.smtpPort < 1 || settings.smtpPort > 65535)) {
        return {
          success: false,
          error: 'Invalid SMTP port',
          timestamp: new Date().toISOString(),
        };
      }

      if (settings.fromEmail && !this.isValidEmail(settings.fromEmail)) {
        return {
          success: false,
          error: 'Invalid from email address',
          timestamp: new Date().toISOString(),
        };
      }

      systemSettings.emailSettings = {
        ...systemSettings.emailSettings,
        ...settings,
      };
      systemSettings.updatedAt = new Date().toISOString();

      return {
        success: true,
        data: systemSettings.emailSettings,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Update file upload settings
   */
  async updateFileUploadSettings(settings: Partial<FileUploadSettings>): Promise<ConfigurationResponse<FileUploadSettings>> {
    try {
      const systemSettings = await this.getSettings();

      if (settings.maxFileSize && settings.maxFileSize <= 0) {
        return {
          success: false,
          error: 'Max file size must be greater than 0',
          timestamp: new Date().toISOString(),
        };
      }

      systemSettings.fileUploadSettings = {
        ...systemSettings.fileUploadSettings,
        ...settings,
      };
      systemSettings.updatedAt = new Date().toISOString();

      return {
        success: true,
        data: systemSettings.fileUploadSettings,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Update system limits
   */
  async updateSystemLimits(limits: Partial<SystemLimits>): Promise<ConfigurationResponse<SystemLimits>> {
    try {
      const systemSettings = await this.getSettings();

      // Validate limits
      Object.entries(limits).forEach(([key, value]) => {
        if (value && value <= 0) {
          throw new Error(`${key} must be greater than 0`);
        }
      });

      systemSettings.systemLimits = {
        ...systemSettings.systemLimits,
        ...limits,
      };
      systemSettings.updatedAt = new Date().toISOString();

      return {
        success: true,
        data: systemSettings.systemLimits,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Check system health
   */
  async getSystemHealth(): Promise<{
    status: string;
    checks: Record<string, boolean>;
  }> {
    const checks = {
      passwordPolicyConfigured: true,
      emailConfigured: true,
      fileUploadConfigured: true,
      limitsConfigured: true,
      attendanceThresholdValid: true,
      sessionTimeoutValid: true,
    };

    const settings = await this.getSettings();

    // Validate password policy
    checks.passwordPolicyConfigured = settings.passwordPolicy.minLength > 0;

    // Validate email settings
    checks.emailConfigured = !!settings.emailSettings?.smtpServer;

    // Validate file upload
    checks.fileUploadConfigured = settings.fileUploadSettings?.maxFileSize! > 0;

    // Validate limits
    checks.limitsConfigured = Object.values(settings.systemLimits || {}).every(v => v > 0);

    // Validate thresholds
    checks.attendanceThresholdValid = settings.attendanceThreshold >= 0 && settings.attendanceThreshold <= 100;
    checks.sessionTimeoutValid = settings.sessionTimeout > 0;

    const allHealthy = Object.values(checks).every(v => v);

    return {
      status: allHealthy ? 'healthy' : 'warning',
      checks,
    };
  }

  /**
   * Reset to default settings
   */
  async resetToDefaults(): Promise<ConfigurationResponse<SystemSettings>> {
    try {
      this.systemSettings = null;
      const defaults = this.initializeDefaults();

      return {
        success: true,
        data: defaults,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get audit trail
   */
  async getSettingsAuditTrail(): Promise<Array<{ timestamp: string; setting: string; oldValue: any; newValue: any }>> {
    // Mock audit trail - in production, this would be stored in database
    return [
      {
        timestamp: new Date().toISOString(),
        setting: 'attendanceThreshold',
        oldValue: 70,
        newValue: 75,
      },
      {
        timestamp: new Date().toISOString(),
        setting: 'sessionTimeout',
        oldValue: 20,
        newValue: 30,
      },
    ];
  }

  /**
   * Export settings as JSON
   */
  async exportSettings(): Promise<string> {
    const settings = await this.getSettings();
    return JSON.stringify(settings, null, 2);
  }

  /**
   * Import settings from JSON
   */
  async importSettings(jsonString: string): Promise<ConfigurationResponse<SystemSettings>> {
    try {
      const imported = JSON.parse(jsonString);

      // Validate structure
      if (!imported.passwordPolicy || !imported.emailSettings) {
        return {
          success: false,
          error: 'Invalid settings format',
          timestamp: new Date().toISOString(),
        };
      }

      this.systemSettings = imported;

      return {
        success: true,
        data: this.systemSettings,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Private helper methods
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

export default new SystemSettingsService();
