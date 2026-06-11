import { SchoolConfiguration, ConfigurationResponse } from '../types/configuration';

/**
 * School Configuration Service
 * Manages school information and settings
 */
export class SchoolConfigurationService {
  private schoolConfig: SchoolConfiguration | null = null;

  /**
   * Initialize default school configuration
   */
  initializeDefault(): SchoolConfiguration {
    this.schoolConfig = {
      id: 'default-school',
      name: 'Example School',
      shortName: 'ES',
      email: 'info@exampleschool.com',
      phone: '+1 (555) 123-4567',
      address: '123 Education Street',
      city: 'Education City',
      state: 'State',
      zipCode: '12345',
      country: 'Country',
      website: 'www.exampleschool.com',
      principalName: 'Dr. John Smith',
      principalEmail: 'principal@exampleschool.com',
      registrationNumber: 'REG-2020-001',
      establishedYear: 2020,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return this.schoolConfig;
  }

  /**
   * Get school configuration
   */
  async getConfiguration(): Promise<SchoolConfiguration> {
    if (!this.schoolConfig) {
      this.initializeDefault();
    }
    return this.schoolConfig!;
  }

  /**
   * Update school configuration
   */
  async updateConfiguration(updates: Partial<SchoolConfiguration>): Promise<ConfigurationResponse<SchoolConfiguration>> {
    try {
      if (!this.schoolConfig) {
        this.initializeDefault();
      }

      // Validate required fields
      const requiredFields = ['name', 'email', 'phone', 'address', 'city', 'state', 'zipCode', 'country', 'principalName', 'principalEmail'];
      for (const field of requiredFields) {
        if (updates[field as keyof SchoolConfiguration] === '') {
          return {
            success: false,
            error: `${field} is required`,
            timestamp: new Date().toISOString(),
          };
        }
      }

      // Validate email format
      if (updates.email && !this.isValidEmail(updates.email)) {
        return {
          success: false,
          error: 'Invalid email format',
          timestamp: new Date().toISOString(),
        };
      }

      if (updates.principalEmail && !this.isValidEmail(updates.principalEmail)) {
        return {
          success: false,
          error: 'Invalid principal email format',
          timestamp: new Date().toISOString(),
        };
      }

      // Validate phone format
      if (updates.phone && !this.isValidPhone(updates.phone)) {
        return {
          success: false,
          error: 'Invalid phone format',
          timestamp: new Date().toISOString(),
        };
      }

      // Update configuration
      this.schoolConfig = {
        ...this.schoolConfig,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      return {
        success: true,
        data: this.schoolConfig,
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
   * Handle logo upload
   */
  async uploadLogo(filePath: string, fileName: string): Promise<ConfigurationResponse<{ logoPath: string }>> {
    try {
      if (!this.schoolConfig) {
        this.initializeDefault();
      }

      // Validate file type
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
      const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();

      if (!allowedExtensions.includes(ext)) {
        return {
          success: false,
          error: 'Invalid file type. Only JPG, PNG, and GIF allowed.',
          timestamp: new Date().toISOString(),
        };
      }

      // Store logo path
      const logoPath = `/uploads/school-logo/${fileName}`;
      this.schoolConfig.logoPath = logoPath;
      this.schoolConfig.updatedAt = new Date().toISOString();

      return {
        success: true,
        data: { logoPath },
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
   * Get school summary (for public view)
   */
  async getSchoolSummary(): Promise<{
    name: string;
    city: string;
    phone: string;
    email: string;
    website?: string;
    logoPath?: string;
  }> {
    const config = await this.getConfiguration();
    return {
      name: config.name,
      city: config.city,
      phone: config.phone,
      email: config.email,
      website: config.website,
      logoPath: config.logoPath,
    };
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone format
   */
  private isValidPhone(phone: string): boolean {
    // Allow various phone formats
    const phoneRegex = /^[+]?[\d\s\-()]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  }

  /**
   * Validate all required configuration fields
   */
  async validateConfiguration(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const config = await this.getConfiguration();

    if (!config.name || config.name.trim() === '') {
      errors.push('School name is required');
    }
    if (!config.email || !this.isValidEmail(config.email)) {
      errors.push('Valid school email is required');
    }
    if (!config.phone || !this.isValidPhone(config.phone)) {
      errors.push('Valid school phone is required');
    }
    if (!config.principalName || config.principalName.trim() === '') {
      errors.push('Principal name is required');
    }
    if (!config.principalEmail || !this.isValidEmail(config.principalEmail)) {
      errors.push('Valid principal email is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export default new SchoolConfigurationService();
