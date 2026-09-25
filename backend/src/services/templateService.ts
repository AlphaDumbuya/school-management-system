import { Knex } from 'knex';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';

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
  logoUrl?: string;
  config?: any;
  /** Optional initial status. Defaults to 'approved' (instant activation) for a
   *  fresh design; a duplicate passes 'draft' so it re-enters the approval flow. */
  status?: 'draft' | 'approved';
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
  logoUrl?: string;
  config?: any;
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
  private schemaChecked = false;

  constructor(private db: Knex) {}

  private async ensureColumnType() {
    if (this.schemaChecked) return;
    try {
      await this.db.raw('ALTER TABLE card_templates ALTER COLUMN logo_url TYPE text').catch(() => {});
      this.schemaChecked = true;
    } catch {
      this.schemaChecked = true;
    }
  }

  /**
   * Create a new card template
   * Requirements: 4.1, 4.2
   */
  async createTemplate(request: TemplateCreateRequest): Promise<Template> {
    try {
      await this.ensureColumnType();

      // Validate color contrast
      const contrastRatio = this.calculateContrastRatio(
        request.backgroundColor,
        request.textColor
      );

      if (contrastRatio < 4.5) {
        throw new AppError(
          `Insufficient color contrast ratio: ${contrastRatio.toFixed(2)}:1. Minimum required: 4.5:1`,
          400
        );
      }

      // Validate layout configuration
      this.validateLayoutConfig(request.layoutConfig, request.format);

      // Create template configuration preserving all custom frontend fields
      const config = {
        ...(request.config || {}),
        backgroundColor: request.backgroundColor,
        textColor: request.textColor,
        fontFamily: request.fontFamily,
        fontSize: request.fontSize,
        logoPosition: request.logoPosition,
        layoutConfig: request.layoutConfig,
      };

      // Status: honour an explicit 'draft' (e.g. a duplicated template that must
      // go through approval again); otherwise default to 'approved' for instant
      // activation of a freshly designed template.
      const initialStatus = request.status === 'draft' ? 'draft' : 'approved';

      const [template] = await this.db('card_templates')
        .insert({
          tenant_id: request.tenantId,
          name: request.name,
          version: 1,
          status: initialStatus,
          format: request.format,
          config: JSON.stringify(config),
          logo_url: request.logoUrl || config.logoUrl || null,
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
      await this.ensureColumnType();

      // Get existing template
      const existing = await this.db('card_templates')
        .where({ id: templateId })
        .first();

      if (!existing) {
        throw new AppError(`Template ${templateId} not found`, 404);
      }

      // Parse existing config and merge with updates.
      // NOTE: `config` is a jsonb column — the pg driver returns it ALREADY
      // parsed as an object. Guard against double-parsing (which throws
      // "[object Object]" is not valid JSON) by only parsing actual strings.
      const existingConfig =
        typeof existing.config === 'string'
          ? (() => { try { return JSON.parse(existing.config); } catch { return {}; } })()
          : (existing.config || {});
      const newConfig = {
        ...existingConfig,
        ...(updates.config || {}),
      };

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
          throw new AppError(
            `Insufficient color contrast ratio: ${contrastRatio.toFixed(2)}:1. Minimum required: 4.5:1`,
            400
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

      if (updates.logoUrl !== undefined) {
        updateData.logo_url = updates.logoUrl;
      } else if (newConfig.logoUrl) {
        updateData.logo_url = newConfig.logoUrl;
      }

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
        throw new AppError(`Template ${templateId} not found`, 404);
      }

      return this.mapTemplateFromDb(template);
    } catch (error) {
      logger.error('Failed to get template', { templateId, error });
      throw error;
    }
  }

  /**
   * Get all templates for a tenant (auto-seeds default templates if empty)
   * Requirements: 4.1
   */
  async getTemplatesByTenant(tenantId: string, format?: string): Promise<Template[]> {
    try {
      let query = this.db('card_templates')
        .where({ tenant_id: tenantId })
        .whereNot({ status: 'archived' });

      if (format) {
        query = query.where({ format });
      }

      let templates = await query.orderBy('created_at', 'desc');

      // If no templates exist for this tenant, seed default templates automatically
      if (templates.length === 0 && (!format || format === 'pvc' || format === 'badge')) {
        await this.ensureDefaultTemplates(tenantId);
        let reQuery = this.db('card_templates')
          .where({ tenant_id: tenantId })
          .whereNot({ status: 'archived' });
        if (format) {
          reQuery = reQuery.where({ format });
        }
        templates = await reQuery.orderBy('created_at', 'desc');
      }

      return templates.map((t: any) => this.mapTemplateFromDb(t));
    } catch (error) {
      logger.error('Failed to get templates', { tenantId, error });
      throw error;
    }
  }

  private seedingPromiseMap = new Map<string, Promise<void>>();

  /**
   * Auto-seed standard default templates for a tenant
   */
  async ensureDefaultTemplates(tenantId: string, createdByUserId?: string): Promise<void> {
    if (this.seedingPromiseMap.has(tenantId)) {
      return this.seedingPromiseMap.get(tenantId)!;
    }

    const promise = (async () => {
      try {
        const count = await this.db('card_templates').where({ tenant_id: tenantId }).count('id as cnt').first();
        if (Number(count?.cnt ?? 0) > 0) return;

      let createdBy = createdByUserId;
      if (!createdBy) {
        const user = await this.db('users').where({ tenant_id: tenantId }).first();
        createdBy = user?.id;
      }
      if (!createdBy) return;

      const defaults = [
        {
          tenant_id: tenantId,
          name: 'Standard Student PVC Card',
          version: 1,
          status: 'approved',
          format: 'pvc',
          config: JSON.stringify({
            backgroundColor: '#1E293B',
            textColor: '#FFFFFF',
            fontFamily: 'Inter',
            fontSize: 12,
            logoPosition: 'top-left',
            layoutConfig: {
              photoPosition: { x: 5, y: 15, width: 25, height: 30 },
              namePosition: { x: 35, y: 15 },
              rolePosition: { x: 35, y: 25 },
              idPosition: { x: 35, y: 32 },
              qrCodePosition: { x: 65, y: 15, size: 18 },
              barcodePosition: { x: 35, y: 40 },
            },
          }),
          is_default: true,
          default_for_roles: ['student'],
          created_by: createdBy,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          tenant_id: tenantId,
          name: 'Professional Faculty & Staff PVC',
          version: 1,
          status: 'approved',
          format: 'pvc',
          config: JSON.stringify({
            backgroundColor: '#4C1D95',
            textColor: '#FFFFFF',
            fontFamily: 'Inter',
            fontSize: 12,
            logoPosition: 'top-right',
            layoutConfig: {
              photoPosition: { x: 5, y: 15, width: 25, height: 30 },
              namePosition: { x: 35, y: 15 },
              rolePosition: { x: 35, y: 25 },
              idPosition: { x: 35, y: 32 },
              qrCodePosition: { x: 65, y: 15, size: 18 },
              barcodePosition: { x: 35, y: 40 },
            },
          }),
          is_default: true,
          default_for_roles: ['teacher', 'staff', 'principal'],
          created_by: createdBy,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          tenant_id: tenantId,
          name: 'Standard Event & Lanyard Badge',
          version: 1,
          status: 'approved',
          format: 'badge',
          config: JSON.stringify({
            backgroundColor: '#0F172A',
            textColor: '#FFFFFF',
            fontFamily: 'Inter',
            fontSize: 14,
            logoPosition: 'top-center',
            layoutConfig: {
              photoPosition: { x: 25, y: 20, width: 50, height: 60 },
              namePosition: { x: 10, y: 90 },
              rolePosition: { x: 10, y: 105 },
              idPosition: { x: 10, y: 115 },
              qrCodePosition: { x: 38, y: 115, size: 25 },
              barcodePosition: { x: 10, y: 145 },
            },
          }),
          is_default: true,
          default_for_roles: ['student', 'teacher', 'staff', 'principal'],
          created_by: createdBy,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      for (const t of defaults) {
        await this.db('card_templates').insert(t);
      }
      logger.info(`Seeded ${defaults.length} default card templates for tenant ${tenantId}`);
    } catch (error: any) {
      logger.error('Failed to seed default templates', { tenantId, error: error.message });
    } finally {
      this.seedingPromiseMap.delete(tenantId);
    }
  })();

  this.seedingPromiseMap.set(tenantId, promise);
  return promise;
}

  /**
   * Get default template for a role
   * Requirements: 4.6
   */
  async getDefaultTemplate(tenantId: string, role: UserRole, format?: 'pvc' | 'badge'): Promise<Template> {
    try {
      const findTemplate = async () => {
        const base = () =>
          this.db('card_templates')
            .where({ tenant_id: tenantId })
            .where({ is_default: true })
            .whereRaw('? = ANY(default_for_roles)', [role])
            .where({ status: 'approved' });

        // Prefer a default that matches the requested format (e.g. a badge
        // template when generating a badge), otherwise fall back to any default.
        if (format) {
          const matched = await base().where({ format }).first();
          if (matched) return matched;
        }
        return base().first();
      };

      let template = await findTemplate();

      // Auto-provision standard defaults if the tenant has none yet, then retry.
      if (!template) {
        await this.ensureDefaultTemplates(tenantId);
        template = await findTemplate();
      }

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

      // Remove default flag/role from other templates for these roles
      const otherTemplates = await this.db('card_templates')
        .where({ tenant_id: template.tenant_id })
        .whereNot({ id: templateId })
        .where(function() {
          roles.forEach(role => {
            this.orWhereRaw('? = ANY(default_for_roles)', [role]);
          });
        });

      for (const other of otherTemplates) {
        const currentRoles: string[] = other.default_for_roles || [];
        const newRoles = currentRoles.filter(r => !roles.includes(r as any));
        await this.db('card_templates')
          .where({ id: other.id })
          .update({
            default_for_roles: newRoles,
            is_default: newRoles.length > 0 ? other.is_default : false,
            updated_at: new Date(),
          });
      }

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
          `Cannot delete or archive template: it is currently in use by ${activeCardsCount?.count} active cards. Please revoke or expire those cards first.`
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
   * Validate layout configuration with dynamic orientation support & safe clamping
   */
  private validateLayoutConfig(layout?: TemplateLayout, format: 'pvc' | 'badge' = 'pvc'): void {
    if (!layout) return;

    // Detect layout orientation (portrait vs landscape)
    const isPortrait =
      (layout as any).orientation === 'portrait' ||
      (format === 'badge' && (layout as any).orientation !== 'landscape') ||
      (layout.photoPosition && layout.photoPosition.y > 50) ||
      (layout.qrCodePosition && layout.qrCodePosition.y > 50);

    // Dynamic max dimensions based on format and orientation:
    // PVC Landscape: 85.6mm x 53.98mm | PVC Portrait: 53.98mm x 85.6mm
    // Badge Portrait: 101.6mm x 152.4mm | Badge Landscape: 152.4mm x 101.6mm
    const maxWidth = format === 'pvc' ? (isPortrait ? 53.98 : 85.6) : (isPortrait ? 101.6 : 152.4);
    const maxHeight = format === 'pvc' ? (isPortrait ? 85.6 : 53.98) : (isPortrait ? 152.4 : 101.6);

    // Validate and clamp photo position
    if (layout.photoPosition) {
      const p = layout.photoPosition;
      p.width = Math.min(Math.max(1, p.width || 25), maxWidth);
      p.height = Math.min(Math.max(1, p.height || 30), maxHeight);
      p.x = Math.max(0, Math.min(p.x || 0, maxWidth - p.width));
      p.y = Math.max(0, Math.min(p.y || 0, maxHeight - p.height));
    }

    // Validate and clamp QR code position
    if (layout.qrCodePosition) {
      const q = layout.qrCodePosition;
      q.size = Math.min(Math.max(1, q.size || 16), Math.min(maxWidth, maxHeight));
      q.x = Math.max(0, Math.min(q.x || 0, maxWidth - q.size));
      q.y = Math.max(0, Math.min(q.y || 0, maxHeight - q.size));
    }

    // Clamp text and barcode positions if present
    if (layout.namePosition) {
      layout.namePosition.x = Math.max(0, Math.min(layout.namePosition.x || 0, maxWidth - 2));
      layout.namePosition.y = Math.max(0, Math.min(layout.namePosition.y || 0, maxHeight - 2));
    }
    if (layout.rolePosition) {
      layout.rolePosition.x = Math.max(0, Math.min(layout.rolePosition.x || 0, maxWidth - 2));
      layout.rolePosition.y = Math.max(0, Math.min(layout.rolePosition.y || 0, maxHeight - 2));
    }
    if (layout.idPosition) {
      layout.idPosition.x = Math.max(0, Math.min(layout.idPosition.x || 0, maxWidth - 2));
      layout.idPosition.y = Math.max(0, Math.min(layout.idPosition.y || 0, maxHeight - 2));
    }
    if (layout.barcodePosition) {
      layout.barcodePosition.x = Math.max(0, Math.min(layout.barcodePosition.x || 0, maxWidth - 2));
      layout.barcodePosition.y = Math.max(0, Math.min(layout.barcodePosition.y || 0, maxHeight - 2));
    }
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
