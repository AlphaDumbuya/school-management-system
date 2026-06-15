/**
 * Print Configuration Service
 * 
 * Manages print configuration profiles for ID card printing:
 * - Paper size and orientation settings
 * - Margins and layout configuration
 * - Printer-specific driver settings
 * - Per-user configuration persistence
 * - Print preview generation
 * 
 * Requirements: 11.1, 11.2, 11.4, 11.5
 */

import { Knex } from 'knex';
import db from '../utils/database';
import { logger } from '../utils/logger';

// Print configuration types
export type PaperSize = 'A4' | 'Letter' | 'Legal' | 'CR80' | 'Custom';
export type Orientation = 'portrait' | 'landscape';
export type PrinterDriver = 'generic' | 'zebra' | 'evolis' | 'magicard' | 'fargo';

export interface PrintMargins {
  top: number;    // in mm
  right: number;  // in mm
  bottom: number; // in mm
  left: number;   // in mm
}

export interface CustomPaperSize {
  width: number;  // in mm
  height: number; // in mm
}

export interface PrintConfigData {
  paperSize: PaperSize;
  customSize?: CustomPaperSize;
  orientation: Orientation;
  margins: PrintMargins;
  printerDriver: PrinterDriver;
  printerName?: string;
  dpi: number;
  colorMode: 'color' | 'grayscale' | 'bw';
  cardsPerPage: number;
  addCropMarks: boolean;
  addAlignmentGuides: boolean;
}

export interface PrintConfig {
  id: string;
  userId: string;
  tenantId: string;
  name: string;
  config: PrintConfigData;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Predefined paper sizes (in mm)
const PAPER_SIZES: Record<Exclude<PaperSize, 'Custom'>, { width: number; height: number }> = {
  'A4': { width: 210, height: 297 },
  'Letter': { width: 215.9, height: 279.4 },
  'Legal': { width: 215.9, height: 355.6 },
  'CR80': { width: 85.6, height: 53.98 } // Standard PVC card size
};

// Default print configurations by card type
const DEFAULT_CONFIGS: Record<string, Partial<PrintConfigData>> = {
  'pvc-card': {
    paperSize: 'CR80',
    orientation: 'landscape',
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
    dpi: 300,
    colorMode: 'color',
    cardsPerPage: 1,
    addCropMarks: false,
    addAlignmentGuides: false
  },
  'badge': {
    paperSize: 'A4',
    orientation: 'portrait',
    margins: { top: 10, right: 10, bottom: 10, left: 10 },
    dpi: 300,
    colorMode: 'color',
    cardsPerPage: 8,
    addCropMarks: true,
    addAlignmentGuides: true
  }
};

class PrintConfigService {
  /**
   * Create new print configuration
   */
  async createConfig(
    userId: string,
    tenantId: string,
    name: string,
    config: PrintConfigData
  ): Promise<PrintConfig> {
    try {
      // Validate configuration
      this.validateConfig(config);

      const [createdConfig] = await db('print_configs')
        .insert({
          id: db.raw('gen_random_uuid()'),
          user_id: userId,
          tenant_id: tenantId,
          name,
          config: JSON.stringify(config),
          is_default: false,
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('*');

      logger.info('Print configuration created', { configId: createdConfig.id, userId, name });

      return this.mapToConfig(createdConfig);
    } catch (error) {
      logger.error('Failed to create print configuration', { error, userId, name });
      throw error;
    }
  }

  /**
   * Update existing print configuration
   */
  async updateConfig(
    configId: string,
    userId: string,
    tenantId: string,
    updates: Partial<PrintConfigData> & { name?: string }
  ): Promise<PrintConfig> {
    try {
      const existing = await this.getConfigById(configId, tenantId);

      // Verify ownership
      if (existing.userId !== userId) {
        throw new Error('Unauthorized: Cannot update another user\'s configuration');
      }

      const updatedConfig = { ...existing.config, ...updates };
      this.validateConfig(updatedConfig);

      const updateData: any = {
        updated_at: new Date()
      };

      if (updates.name) {
        updateData.name = updates.name;
      }

      if (Object.keys(updates).some(key => key !== 'name')) {
        updateData.config = JSON.stringify(updatedConfig);
      }

      const [updated] = await db('print_configs')
        .where({ id: configId, tenant_id: tenantId })
        .update(updateData)
        .returning('*');

      logger.info('Print configuration updated', { configId, userId });

      return this.mapToConfig(updated);
    } catch (error) {
      logger.error('Failed to update print configuration', { error, configId, userId });
      throw error;
    }
  }

  /**
   * Get print configuration by ID
   */
  async getConfigById(configId: string, tenantId: string): Promise<PrintConfig> {
    const config = await db('print_configs')
      .where({ id: configId, tenant_id: tenantId })
      .first();

    if (!config) {
      throw new Error('Print configuration not found');
    }

    return this.mapToConfig(config);
  }

  /**
   * Get all configurations for a user
   */
  async getConfigsByUser(userId: string, tenantId: string): Promise<PrintConfig[]> {
    const configs = await db('print_configs')
      .where({ user_id: userId, tenant_id: tenantId })
      .orderBy('created_at', 'desc');

    return configs.map(c => this.mapToConfig(c));
  }

  /**
   * Get default configuration for a user
   */
  async getDefaultConfig(userId: string, tenantId: string): Promise<PrintConfig | null> {
    const config = await db('print_configs')
      .where({ user_id: userId, tenant_id: tenantId, is_default: true })
      .first();

    return config ? this.mapToConfig(config) : null;
  }

  /**
   * Set configuration as default for user
   */
  async setDefaultConfig(configId: string, userId: string, tenantId: string): Promise<void> {
    try {
      await db.transaction(async (trx: Knex.Transaction) => {
        // Verify ownership
        const config = await trx('print_configs')
          .where({ id: configId, tenant_id: tenantId })
          .first();

        if (!config || config.user_id !== userId) {
          throw new Error('Configuration not found or unauthorized');
        }

        // Remove default flag from all user's configs
        await trx('print_configs')
          .where({ user_id: userId, tenant_id: tenantId })
          .update({ is_default: false });

        // Set this config as default
        await trx('print_configs')
          .where({ id: configId })
          .update({ is_default: true, updated_at: new Date() });
      });

      logger.info('Default print configuration set', { configId, userId });
    } catch (error) {
      logger.error('Failed to set default configuration', { error, configId, userId });
      throw error;
    }
  }

  /**
   * Delete print configuration
   */
  async deleteConfig(configId: string, userId: string, tenantId: string): Promise<void> {
    try {
      const config = await this.getConfigById(configId, tenantId);

      // Verify ownership
      if (config.userId !== userId) {
        throw new Error('Unauthorized: Cannot delete another user\'s configuration');
      }

      await db('print_configs')
        .where({ id: configId })
        .delete();

      logger.info('Print configuration deleted', { configId, userId });
    } catch (error) {
      logger.error('Failed to delete print configuration', { error, configId, userId });
      throw error;
    }
  }

  /**
   * Get last used configuration for user (for auto-persistence)
   */
  async getLastUsedConfig(userId: string, tenantId: string): Promise<PrintConfig | null> {
    // Try to get default config first
    const defaultConfig = await this.getDefaultConfig(userId, tenantId);
    if (defaultConfig) {
      return defaultConfig;
    }

    // Otherwise get most recently updated config
    const config = await db('print_configs')
      .where({ user_id: userId, tenant_id: tenantId })
      .orderBy('updated_at', 'desc')
      .first();

    return config ? this.mapToConfig(config) : null;
  }

  /**
   * Update last used timestamp (for tracking usage)
   */
  async updateLastUsed(configId: string, tenantId: string): Promise<void> {
    await db('print_configs')
      .where({ id: configId, tenant_id: tenantId })
      .update({ updated_at: new Date() });
  }

  /**
   * Get default configuration for card type
   */
  getDefaultConfigForType(cardType: 'pvc' | 'badge'): PrintConfigData {
    const baseConfig = cardType === 'pvc' 
      ? DEFAULT_CONFIGS['pvc-card']
      : DEFAULT_CONFIGS['badge'];

    return {
      paperSize: baseConfig.paperSize!,
      orientation: baseConfig.orientation!,
      margins: baseConfig.margins!,
      printerDriver: 'generic',
      dpi: baseConfig.dpi!,
      colorMode: baseConfig.colorMode!,
      cardsPerPage: baseConfig.cardsPerPage!,
      addCropMarks: baseConfig.addCropMarks!,
      addAlignmentGuides: baseConfig.addAlignmentGuides!
    };
  }

  /**
   * Calculate print layout dimensions
   */
  calculatePrintLayout(config: PrintConfigData): {
    pageWidth: number;
    pageHeight: number;
    cardWidth: number;
    cardHeight: number;
    usableWidth: number;
    usableHeight: number;
    cardsPerRow: number;
    cardsPerColumn: number;
  } {
    // Get page dimensions
    let pageWidth: number, pageHeight: number;
    
    if (config.paperSize === 'Custom') {
      if (!config.customSize) {
        throw new Error('Custom paper size requires customSize');
      }
      pageWidth = config.customSize.width;
      pageHeight = config.customSize.height;
    } else {
      const size = PAPER_SIZES[config.paperSize as Exclude<PaperSize, 'Custom'>];
      pageWidth = size.width;
      pageHeight = size.height;
    }

    // Adjust for orientation
    if (config.orientation === 'landscape') {
      [pageWidth, pageHeight] = [pageHeight, pageWidth];
    }

    // Calculate usable area
    const usableWidth = pageWidth - config.margins.left - config.margins.right;
    const usableHeight = pageHeight - config.margins.top - config.margins.bottom;

    // Standard PVC card size
    const cardWidth = 85.6;  // mm
    const cardHeight = 53.98; // mm

    // Calculate how many cards fit per page
    const cardsPerRow = Math.floor(usableWidth / (cardWidth + 5)); // 5mm spacing
    const cardsPerColumn = Math.floor(usableHeight / (cardHeight + 5));

    return {
      pageWidth,
      pageHeight,
      cardWidth,
      cardHeight,
      usableWidth,
      usableHeight,
      cardsPerRow: Math.max(1, cardsPerRow),
      cardsPerColumn: Math.max(1, cardsPerColumn)
    };
  }

  /**
   * Validate print configuration
   */
  private validateConfig(config: PrintConfigData): void {
    // Validate paper size
    if (config.paperSize === 'Custom') {
      if (!config.customSize) {
        throw new Error('Custom paper size requires customSize property');
      }
      if (config.customSize.width <= 0 || config.customSize.height <= 0) {
        throw new Error('Invalid custom paper dimensions');
      }
    }

    // Validate margins
    if (Object.values(config.margins).some(m => m < 0)) {
      throw new Error('Margins cannot be negative');
    }

    // Validate DPI
    if (config.dpi < 72 || config.dpi > 1200) {
      throw new Error('DPI must be between 72 and 1200');
    }

    // Validate cards per page
    if (config.cardsPerPage < 1 || config.cardsPerPage > 100) {
      throw new Error('Cards per page must be between 1 and 100');
    }
  }

  /**
   * Map database record to PrintConfig
   */
  private mapToConfig(record: any): PrintConfig {
    return {
      id: record.id,
      userId: record.user_id,
      tenantId: record.tenant_id,
      name: record.name,
      config: typeof record.config === 'string' ? JSON.parse(record.config) : record.config,
      isDefault: record.is_default,
      createdAt: record.created_at,
      updatedAt: record.updated_at
    };
  }
}

export default new PrintConfigService();
