import { Knex } from 'knex';
import { logger } from '../utils/logger.js';

/**
 * Template Service
 * Phase 2.1: Identity Management Module
 * 
 * Manages card templates with customization, validation, approval workflow,
 * and versioning. Supports school branding, color contrast validation,
 * logo management, and default template assignment per role.
 */

export interface TemplateCreateRequest {
  tenantId: string;
  name: string;
  description?: string;
  format: 'pvc' | 'badge';
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  fontSize: number;
  logoPosition: 'top-left' | 'top-center' | 'top-right';
  layoutConfig: TemplateLayout;
  createdBy: string;
}

export interface TemplateUpdateRequest {
  name?: string;
  description?: string;
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
  fontSize?: number;
  logoPosition?: 'top-left' | 'top-center' | 'top-right';
  layoutConfig?: TemplateLayout;
}

export interface TemplateLayout {
  photoPosition: { x: number; y: number; width: number; height: number };
  namePosition: { x: number; y: number };
  rolePosition: { x: number; y: number };
  idPosition: { x: number; y: number };
  qrCodePosition: { x: number; y: number; size: number };
  barcodePosition: { x: number; y: number };
}

export interface Template {
  templateId: string;
  tenantId: string;
  name: string;
  version: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'archived';
  format: 'pvc' | 'badge';
  config: any;
  logoUrl?: string;
  isDefault: boolean;
  defaultForRoles: string[];
  createdBy: string;
  approvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'student' | 'teacher' | 'staff' | 'principal';

export class TemplateService {
  constructor(private db: Knex) {}

  /**
   * Create a new card template
   * Requirements: 4.1, 4.2
   */
  async createTemplate(request: TemplateCreateRequest): Promise<Template> {
    try {
      // Validate color contrast
      const contrastRatio = this.calculateContrastRatio(
        request.backgroundColor,
        request.textColor
      );

      if (contrastRatio < 4.5) {
        throw new Error(
          `Insufficient color contrast ratio: ${contrastRatio.toFixed(2)}:1. Minimum required: 4.5:1`
        );
      }

      // Validate layout configuration
      this.validateLayoutConfig(request.layoutConfig, request.format);

      // Create template configuration
      const config = {
        backgroundColor: request.backgroundColor,
        textColor: request.textColor,
        fontFamily: request.fontFamily,
        fontSize: request.fontSize,
        logoPosition: request.logoPosition,
        layoutConfig: request.layoutConfig,
      };

      // Insert template
      const [template] = await this.db('card_templates')
        .insert({
          tenant_id: request.tenantId,
          name: request.name,
          version: 1,
          status: 'draft',
          format: request.format,
          config: JSON.stringify(config),
          is_default: false,
          default_for_roles: [],
          created_by: request.createdBy,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*');

      logger.info(`Created template ${template.id} for tenant ${request.tenantId}`, {
        templateName: request.name,
      });

      return this.mapTemplateFromDb(template);
    } catch (error) {
      logger.error('Failed to create template', { request, error });
      throw error;
    }
  }

  /**
   * Update an existing template
   * Requirements: 4.1, 4.9
   */
  async updateTemplate(
    templateId: string,
    updates: TemplateUpdateRequest
  ): Promise<Template> {
    try {
      // Get existing template
      const existing = await this.db('card_templates')
        .where({ id: templateId })
        .first();

      if (!existing) {
        throw new Error(`Template ${templateId} not found`);
      }

      // Parse existing config
      const existingConfig = JSON.parse(existing.config);
      const newConfig = { ...existingConfig };

      // Update config fields
      if (updates.backgroundColor) {
        newConfig.backgroundColor = updates.backgroundColor;
      }
      if (updates.textColor) {
        newConfig.textColor = updates.textColor;
      }
      if (updates.fontFamily) {
        newConfig.fontFamily = updates.fontFamily;
      }
      if (updates.fontSize) {
        newConfig.fontSize = updates.fontSize;
      }
      if (updates.logoPosition) {
        newConfig.logoPosition = updates.logoPosition;
      }
      if (updates.layoutConfig) {
        newConfig.layoutConfig = updates.layoutConfig;
      }

      // Validate new color contrast if colors changed
      if (updates.backgroundColor || updates.textColor) {
        const contrastRatio = this.calculateContrastRatio(
          newConfig.backgroundColor,
          newConfig.textColor
        );

        if (contrastRatio < 4.5) {
          throw new Error(
            `Insufficient color contrast ratio: ${contrastRatio.toFixed(2)}:1. Minimum required: 4.5:1`
          );
        }
      }

      // Validate layout if changed
      if (updates.layoutConfig) {
        this.validateLayoutConfig(updates.layoutConfig, existing.format);
      }

      // Prepare update data
      const updateData: any = {
        config: JSON.stringify(newConfig),
        version: existing.version + 1,
        updated_at: new Date(),
      };

      if (updates.name) {
        updateData.name = updates.name;
      }

      // Update template
      const [updated] = await this.db('card_templates')
        .where({ id: templateId })
        .update(updateData)
        .returning('*');

      logger.info(`Updated template ${templateId} to version ${updated.version}`);

      return this.mapTemplateFromDb(updated);
    } catch (error) {
      logger.error('Failed to update template', { templateId, updates, error });
      throw error;
    }
  }

  /**
   * Get template by ID
   * Requirements: 4.1
   */
  async getTemplateById(templateId: string): Promise<Template> {
    try {
      const template = await this.db('card_templates')
        .where({ id: templateId })
        .first();

      if (!template) {
        throw new Error(`Template ${templateId} not found`);
      }

      return this.mapTemplateFromDb(template);
    } catch (error) {
      logger.error('Failed to get template', { templateId, error });
      throw error;
    }
  }

  /**
   * Get all templates for a tenant
   * Requirements: 4.1
   */
  async getTemplatesByTenant(tenantId: string): Promise<Template[]> {
    try {
      const templates = await this.db('card_templates')
        .where({ tenant_id: tenantId })
        .whereNot({ status: 'archived' })
        .orderBy('created_at', 'desc');

      return templates.map((t: any) => this.mapTemplateFromDb(t));
    } catch (error) {
      logger.error('Failed to get templates', { tenantId, error });
      throw error;
    }
  }

  /**
   * Get default template for a role
   * Requirements: 4.6
   */
  async getDefaultTemplate(tenantId: string, role: UserRole): Promise<Template> {
    try {
      const template = await this.db('card_templates')
        .where({ tenant_id: tenantId })
        .where({ is_default: true })
        .whereRaw('? = ANY(default_for_roles)', [role])
        .where({ status: 'approved' })
        .first();

      if (!template) {
        throw new Error(`No default template found for role ${role} in tenant ${tenantId}`);
      }

      return this.mapTemplateFromDb(template);
    } catch (error) {
      logger.error('Failed to get default template', { tenantId, role, error });
      throw error;
    }
  }

  /**
   * Set template as default for specific roles
   * Requirements: 4.6
   */
  async setDefaultTemplate(templateId: string, roles: UserRole[]): Promise<void> {
    try {
      const template = await this.db('card_templates')
        .where({ id: templateId })
        .first();

      if (!template) {
        throw new Error(`Template ${templateId} not found`);
      }

      if (template.status !== 'approved') {
        throw new Error('Only approved templates can be set as default');
      }

      // Remove default flag from other templates for these roles
      await this.db('card_templates')
        .where({ tenant_id: template.tenant_id })
        .whereNot({ id: templateId })
        .where(function() {
          roles.forEach(role => {
            this.orWhereRaw('? = ANY(default_for_roles)', [role]);
          });
        })
        .update({
          is_default: false,
          default_for_roles: this.db.raw(
            `array_remove(default_for_roles, ?)`,
            roles
          ),
          updated_at: new Date(),
        });

      // Set this template as default
      await this.db('card_templates')
        .where({ id: templateId })
        .update({
          is_default: true,
          default_for_roles: roles,
          updated_at: new Date(),
        });

      logger.info(`Set template ${templateId} as default for roles: ${roles.join(', ')}`);
    } catch (error) {
      logger.error('Failed to set default template', { templateId, roles, error });
      throw error;
    }
  }

  /**
   * Submit template for approval
   * Requirements: 4.7
   */
  async submitForApproval(templateId: string): Promise<void> {
    try {
      const template = await this.db('card_templates')
        .where({ id: templateId })
        .first();

      if (!template) {
        throw new Error(`Template ${templateId} not found`);
      }

      if (template.status !== 'draft') {
        throw new Error(`Template is not in draft status`);
      }

      await this.db('card_templates')
        .where({ id: templateId })
        .update({
          status: 'pending_approval',
          updated_at: new Date(),
        });

      logger.info(`Template ${templateId} submitted for approval`);
    } catch (error) {
      logger.error('Failed to submit template for approval', { templateId, error });
      throw error;
    }
  }

  /**
   * Approve a template
   * Requirements: 4.7
   */
  async approveTemplate(templateId: string, approverId: string): Promise<void> {
    try {
      const template = await this.db('card_templates')
        .where({ id: templateId })
        .first();

      if (!template) {
        throw new Error(`Template ${templateId} not found`);
      }

      if (template.status !== 'pending_approval') {
        throw new Error(`Template is not pending approval`);
      }

      if (template.created_by === approverId) {
        throw new Error('Template creator cannot approve their own template');
      }

      await this.db('card_templates')
        .where({ id: templateId })
        .update({
          status: 'approved',
          approved_by: approverId,
          updated_at: new Date(),
        });

      logger.info(`Template ${templateId} approved by ${approverId}`);
    } catch (error) {
      logger.error('Failed to approve template', { templateId, approverId, error });
      throw error;
    }
  }

  /**
   * Delete a template
   * Requirements: 4.8
   */
  async deleteTemplate(templateId: string): Promise<void> {
    try {
      // Check if template is used by active cards
      const activeCardsCount = await this.db('id_cards')
        .where({ template_id: templateId })
        .where({ status: 'active' })
        .count('* as count')
        .first();

      if (Number(activeCardsCount?.count || 0) > 0) {
        throw new Error(
          `Cannot delete template ${templateId}: it is used by ${activeCardsCount?.count} active cards. Archive it instead.`
        );
      }

      // Archive template instead of deleting
      await this.db('card_templates')
        .where({ id: templateId })
        .update({
          status: 'archived',
          is_default: false,
          default_for_roles: [],
          updated_at: new Date(),
        });

      logger.info(`Archived template ${templateId}`);
    } catch (error) {
      logger.error('Failed to delete template', { templateId, error });
      throw error;
    }
  }

  /**
   * Upload and resize logo
   * Requirements: 4.4, 4.5
   */
  async uploadLogo(
    tenantId: string,
    logoFile: Buffer,
    filename: string,
    mimeType: string
  ): Promise<string> {
    try {
      // Validate file type
      if (!['image/png', 'image/jpeg', 'image/jpg'].includes(mimeType)) {
        throw new Error('Logo must be PNG or JPEG format');
      }

      // Validate file size (5MB max)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (logoFile.length > maxSize) {
        throw new Error(`Logo file size exceeds maximum of 5MB`);
      }

      // In a real implementation, you would:
      // 1. Resize the image while maintaining aspect ratio
      // 2. Upload to file storage (S3, local filesystem, etc.)
      // 3. Return the URL
      
      // For now, we'll return a placeholder URL
      const logoUrl = `/uploads/logos/${tenantId}/${filename}`;

      logger.info(`Uploaded logo for tenant ${tenantId}`, { logoUrl });

      return logoUrl;
    } catch (error) {
      logger.error('Failed to upload logo', { tenantId, error });
      throw error;
    }
  }

  /**
   * Calculate WCAG color contrast ratio
   * Requirements: 4.3
   */
  private calculateContrastRatio(color1: string, color2: string): number {
    const getLuminance = (hexColor: string): number => {
      // Remove # if present
      const hex = hexColor.replace('#', '');
      
      // Convert to RGB
      const r = parseInt(hex.substr(0, 2), 16) / 255;
      const g = parseInt(hex.substr(2, 2), 16) / 255;
      const b = parseInt(hex.substr(4, 2), 16) / 255;

      // Calculate relative luminance
      const toLinear = (c: number) => {
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      };

      return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    };

    const lum1 = getLuminance(color1);
    const lum2 = getLuminance(color2);

    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);

    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Validate layout configuration
   */
  private validateLayoutConfig(layout: TemplateLayout, format: 'pvc' | 'badge'): void {
    // PVC card dimensions: 85.6mm x 53.98mm
    // Badge dimensions: 101.6mm x 152.4mm (4" x 6")

    const maxWidth = format === 'pvc' ? 85.6 : 101.6;
    const maxHeight = format === 'pvc' ? 53.98 : 152.4;

    // Validate photo position
    if (
      layout.photoPosition.x < 0 ||
      layout.photoPosition.y < 0 ||
      layout.photoPosition.x + layout.photoPosition.width > maxWidth ||
      layout.photoPosition.y + layout.photoPosition.height > maxHeight
    ) {
      throw new Error('Photo position exceeds card dimensions');
    }

    // Validate QR code position
    if (
      layout.qrCodePosition.x < 0 ||
      layout.qrCodePosition.y < 0 ||
      layout.qrCodePosition.x + layout.qrCodePosition.size > maxWidth ||
      layout.qrCodePosition.y + layout.qrCodePosition.size > maxHeight
    ) {
      throw new Error('QR code position exceeds card dimensions');
    }

    // Additional validations can be added here
  }

  /**
   * Map database row to Template object
   */
  private mapTemplateFromDb(row: any): Template {
    return {
      templateId: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      version: row.version,
      status: row.status,
      format: row.format,
      config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
      logoUrl: row.logo_url,
      isDefault: row.is_default,
      defaultForRoles: row.default_for_roles || [],
      createdBy: row.created_by,
      approvedBy: row.approved_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
