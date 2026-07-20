
/**
 * Phase 15.1: School Configuration Service
 * 
 * Manages school-level configuration including:
 * - School information (name, logo, contact details)
 * - Logo upload and storage
 * - School settings management
 * - Configuration endpoints
 */

import { Knex } from 'knex';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import * as fs from 'fs';
import * as path from 'path';

export interface SchoolInfo {
  school_id: string;
  tenant_id: string;
  name: string;
  short_name?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  logo_url?: string;
  founded_year?: number;
  principal_name?: string;
  principal_email?: string;
  school_registration_number?: string;
  accreditation_status?: string;
  timezone?: string;
  language_preference?: string;
}

export interface SchoolUpdateRequest extends Partial<SchoolInfo> {
  tenant_id: string;
}

export interface LogoUploadOptions {
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  };
  tenantId: string;
  userId: string;
}

export interface SchoolConfigSettings {
  school_id: string;
  tenant_id: string;
  setting_key: string;
  setting_value: any;
  data_type: 'string' | 'number' | 'boolean' | 'json';
  is_public: boolean;
  created_by: string;
  updated_by?: string;
}

/**
 * Phase 15.1: School Configuration Service
 */
export class Phase15SchoolConfigService {
  private db: Knex;
  private logoStoragePath: string;
  private maxLogoSize = 5 * 1024 * 1024; // 5MB
  private allowedLogoTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  constructor(db: Knex) {
    this.db = db;
    this.logoStoragePath = path.join(process.cwd(), 'uploads', 'logos');
    this.ensureStorageDirectories();
  }

  /**
   * Ensure storage directories exist
   */
  private ensureStorageDirectories(): void {
    try {
      if (!fs.existsSync(this.logoStoragePath)) {
        fs.mkdirSync(this.logoStoragePath, { recursive: true });
        logger.info(`Created logo storage directory: ${this.logoStoragePath}`);
      }
    } catch (error) {
      logger.error(`Failed to create storage directory: ${(error as Error).message}`);
    }
  }

  /**
   * Get school information
   */
  async getSchoolInfo(tenantId: string): Promise<SchoolInfo> {
    try {
      let school = await this.db('schools')
        .where('tenant_id', tenantId)
        .first();

      if (!school) {
        logger.info(`No school record found for tenant ${tenantId}. Initializing default school info.`);
        const tenant = await this.db('tenants').where('id', tenantId).first();
        if (!tenant) {
          throw new AppError('Tenant not found', 404, 'NOT_FOUND');
        }

        const [inserted] = await this.db('schools')
          .insert({
            tenant_id: tenantId,
            name: tenant.name,
            timezone: tenant.timezone || 'UTC',
            language_preference: tenant.language || 'en',
          })
          .returning('*');
        school = inserted;
      }

      return {
        school_id: school.school_id,
        tenant_id: school.tenant_id,
        name: school.name,
        short_name: school.short_name,
        email: school.email,
        phone: school.phone,
        website: school.website,
        address: school.address,
        city: school.city,
        state: school.state,
        postal_code: school.postal_code,
        country: school.country,
        logo_url: school.logo_url,
        founded_year: school.founded_year,
        principal_name: school.principal_name,
        principal_email: school.principal_email,
        school_registration_number: school.school_registration_number,
        accreditation_status: school.accreditation_status,
        timezone: school.timezone,
        language_preference: school.language_preference,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        `Failed to retrieve school information: ${(error as Error).message}`,
        500,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Update school information
   */
  async updateSchoolInfo(
    tenantId: string,
    data: SchoolUpdateRequest,
    updatedBy: string
  ): Promise<SchoolInfo> {
    try {
      // Validate required fields
      if (data.name && data.name.trim() === '') {
        throw new AppError('School name cannot be empty', 400, 'VALIDATION_ERROR');
      }

      if (data.email && !this.isValidEmail(data.email)) {
        throw new AppError('Invalid email format', 400, 'VALIDATION_ERROR');
      }

      if (data.phone && !this.isValidPhone(data.phone)) {
        throw new AppError('Invalid phone format', 400, 'VALIDATION_ERROR');
      }

      if (data.website && !this.isValidUrl(data.website)) {
        throw new AppError('Invalid website URL', 400, 'VALIDATION_ERROR');
      }

      // Build update data
      const updateData: any = {
        updated_at: new Date(),
        updated_by: updatedBy,
      };

      // Add provided fields
      const allowedFields = [
        'name',
        'short_name',
        'email',
        'phone',
        'website',
        'address',
        'city',
        'state',
        'postal_code',
        'country',
        'founded_year',
        'principal_name',
        'principal_email',
        'school_registration_number',
        'accreditation_status',
        'timezone',
        'language_preference',
      ];

      allowedFields.forEach((field) => {
        if (field in data && data[field as keyof SchoolUpdateRequest] !== undefined) {
          updateData[field] = data[field as keyof SchoolUpdateRequest];
        }
      });

      // Update school
      await this.db('schools')
        .where('tenant_id', tenantId)
        .update(updateData);

      logger.info(`School information updated for tenant: ${tenantId}`);

      // Return updated information
      return this.getSchoolInfo(tenantId);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        `Failed to update school information: ${(error as Error).message}`,
        500,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Upload school logo
   */
  async uploadLogo(options: LogoUploadOptions): Promise<{ logoUrl: string; filename: string }> {
    try {
      // Validate file
      if (options.file.size > this.maxLogoSize) {
        throw new AppError(
          `Logo file size exceeds maximum of ${this.maxLogoSize / (1024 * 1024)}MB`,
          400,
          'FILE_TOO_LARGE'
        );
      }

      if (!this.allowedLogoTypes.includes(options.file.mimetype)) {
        throw new AppError(
          `Invalid file type. Allowed types: ${this.allowedLogoTypes.join(', ')}`,
          400,
          'INVALID_FILE_TYPE'
        );
      }

      // Generate unique filename
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 8);
      const ext = path.extname(options.file.originalname);
      const filename = `logo-${options.tenantId}-${timestamp}-${randomString}${ext}`;
      const filepath = path.join(this.logoStoragePath, filename);

      // Write file
      fs.writeFileSync(filepath, options.file.buffer);

      // Get old logo and delete if exists
      const existingSchool = await this.db('schools')
        .where('tenant_id', options.tenantId)
        .first();

      if (existingSchool?.logo_url) {
        const oldFilename = path.basename(existingSchool.logo_url);
        const oldPath = path.join(this.logoStoragePath, oldFilename);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
          logger.info(`Deleted old logo: ${oldFilename}`);
        }
      }

      // Update school logo URL
      const logoUrl = `/uploads/logos/${filename}`;
      await this.db('schools')
        .where('tenant_id', options.tenantId)
        .update({
          logo_url: logoUrl,
          updated_at: new Date(),
          updated_by: options.userId,
        });

      logger.info(`Logo uploaded for tenant: ${options.tenantId}`);

      return { logoUrl, filename };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        `Failed to upload logo: ${(error as Error).message}`,
        500,
        'UPLOAD_ERROR'
      );
    }
  }

  /**
   * Delete logo
   */
  async deleteLogo(tenantId: string, userId: string): Promise<void> {
    try {
      const school = await this.db('schools')
        .where('tenant_id', tenantId)
        .first();

      if (!school || !school.logo_url) {
        throw new AppError('No logo found', 404, 'NOT_FOUND');
      }

      // Delete file
      const filename = path.basename(school.logo_url);
      const filepath = path.join(this.logoStoragePath, filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }

      // Clear logo URL
      await this.db('schools')
        .where('tenant_id', tenantId)
        .update({
          logo_url: null,
          updated_at: new Date(),
          updated_by: userId,
        });

      logger.info(`Logo deleted for tenant: ${tenantId}`);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to delete logo: ${(error as Error).message}`, 500, 'DELETE_ERROR');
    }
  }

  /**
   * Set configuration setting
   */
  async setSetting(
    tenantId: string,
    settingKey: string,
    settingValue: any,
    dataType: 'string' | 'number' | 'boolean' | 'json' = 'string',
    isPublic: boolean = false,
    userId: string = 'system'
  ): Promise<SchoolConfigSettings> {
    try {
      // Validate setting key
      if (!settingKey || settingKey.trim() === '') {
        throw new AppError('Setting key cannot be empty', 400, 'VALIDATION_ERROR');
      }

      // Get school ID
      const school = await this.db('schools')
        .where('tenant_id', tenantId)
        .select('school_id')
        .first();

      if (!school) {
        throw new AppError('School not found', 404, 'NOT_FOUND');
      }

      // Convert value based on type
      let value = settingValue;
      switch (dataType) {
        case 'number':
          if (isNaN(Number(value))) {
            throw new AppError(`Invalid number value: ${value}`, 400, 'VALIDATION_ERROR');
          }
          value = Number(value);
          break;
        case 'boolean':
          value = Boolean(value);
          break;
        case 'json':
          if (typeof value === 'string') {
            value = JSON.parse(value);
          }
          value = JSON.stringify(value);
          break;
      }

      // Check if setting exists
      const existing = await this.db('school_config_settings')
        .where('school_id', school.school_id)
        .where('setting_key', settingKey)
        .first();

      if (existing) {
        // Update
        await this.db('school_config_settings')
          .where('school_id', school.school_id)
          .where('setting_key', settingKey)
          .update({
            setting_value: value,
            data_type: dataType,
            is_public: isPublic,
            updated_by: userId,
            updated_at: new Date(),
          });

        logger.info(`Setting updated: ${settingKey} = ${value}`);
      } else {
        // Create
        await this.db('school_config_settings').insert({
          school_id: school.school_id,
          tenant_id: tenantId,
          setting_key: settingKey,
          setting_value: value,
          data_type: dataType,
          is_public: isPublic,
          created_by: userId,
          created_at: new Date(),
          updated_at: new Date(),
        });

        logger.info(`Setting created: ${settingKey} = ${value}`);
      }

      return {
        school_id: school.school_id,
        tenant_id: tenantId,
        setting_key: settingKey,
        setting_value: value,
        data_type: dataType,
        is_public: isPublic,
        created_by: userId,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        `Failed to set setting: ${(error as Error).message}`,
        500,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Get configuration setting
   */
  async getSetting(
    tenantId: string,
    settingKey: string
  ): Promise<SchoolConfigSettings | null> {
    try {
      const setting = await this.db('school_config_settings')
        .where('tenant_id', tenantId)
        .where('setting_key', settingKey)
        .first();

      if (!setting) {
        return null;
      }

      // Parse value based on data type
      let value = setting.setting_value;
      if (setting.data_type === 'json' && typeof value === 'string') {
        value = JSON.parse(value);
      }

      return {
        ...setting,
        setting_value: value,
      };
    } catch (error) {
      logger.error(`Failed to get setting ${settingKey}:`, error);
      return null;
    }
  }

  /**
   * Get all public settings
   */
  async getPublicSettings(tenantId: string): Promise<Record<string, any>> {
    try {
      const settings = await this.db('school_config_settings')
        .where('tenant_id', tenantId)
        .where('is_public', true)
        .select('setting_key', 'setting_value', 'data_type');

      const result: Record<string, any> = {};

      settings.forEach((setting: any) => {
        let value = setting.setting_value;
        if (setting.data_type === 'json' && typeof value === 'string') {
          value = JSON.parse(value);
        } else if (setting.data_type === 'number') {
          value = Number(value);
        } else if (setting.data_type === 'boolean') {
          value = Boolean(value);
        }
        result[setting.setting_key] = value;
      });

      return result;
    } catch (error) {
      logger.error('Failed to get public settings:', error);
      return {};
    }
  }

  /**
   * Delete configuration setting
   */
  async deleteSetting(tenantId: string, settingKey: string): Promise<void> {
    try {
      await this.db('school_config_settings')
        .where('tenant_id', tenantId)
        .where('setting_key', settingKey)
        .delete();

      logger.info(`Setting deleted: ${settingKey}`);
    } catch (error) {
      logger.error(`Failed to delete setting ${settingKey}:`, error);
      throw new AppError(
        `Failed to delete setting: ${(error as Error).message}`,
        500,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Get all school settings
   */
  async getAllSettings(tenantId: string): Promise<Record<string, any>> {
    try {
      const settings = await this.db('school_config_settings')
        .where('tenant_id', tenantId)
        .select('setting_key', 'setting_value', 'data_type', 'is_public');

      const result: Record<string, any> = {};

      settings.forEach((setting: any) => {
        let value = setting.setting_value;
        if (setting.data_type === 'json' && typeof value === 'string') {
          value = JSON.parse(value);
        } else if (setting.data_type === 'number') {
          value = Number(value);
        } else if (setting.data_type === 'boolean') {
          value = Boolean(value);
        }
        result[setting.setting_key] = {
          value,
          type: setting.data_type,
          isPublic: setting.is_public,
        };
      });

      return result;
    } catch (error) {
      logger.error('Failed to get all settings:', error);
      return {};
    }
  }

  /**
   * Utility: Validate email
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Utility: Validate phone
   */
  private isValidPhone(phone: string): boolean {
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  }

  /**
   * Utility: Validate URL
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Initialize default school configuration
   */
  async initializeDefaultConfig(tenantId: string, userId: string): Promise<void> {
    try {
      // Default settings
      const defaults = [
        { key: 'timezone', value: 'UTC', type: 'string' },
        { key: 'language', value: 'en', type: 'string' },
        { key: 'date_format', value: 'YYYY-MM-DD', type: 'string' },
        { key: 'time_format', value: 'HH:MM:SS', type: 'string' },
        { key: 'currency', value: 'USD', type: 'string' },
        { key: 'academic_year_start', value: '09-01', type: 'string' },
      ];

      for (const defaultSetting of defaults) {
        await this.setSetting(
          tenantId,
          defaultSetting.key,
          defaultSetting.value,
          defaultSetting.type as any,
          true,
          userId
        );
      }

      logger.info(`Default configuration initialized for tenant: ${tenantId}`);
    } catch (error) {
      logger.error('Failed to initialize default configuration:', error);
    }
  }
}
