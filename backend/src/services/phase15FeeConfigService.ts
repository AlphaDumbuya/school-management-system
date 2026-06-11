
/**
 * Phase 15.4: Fee Configuration Service
 * 
 * Manages fee configurations with:
 * - Fee type definitions
 * - Default fee amounts
 * - Fee configuration endpoints
 */

import { Knex } from 'knex';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface FeeConfig {
  config_id: string;
  tenant_id: string;
  fee_type: string;
  description?: string;
  amount: number;
  currency: string;
  frequency: 'once' | 'monthly' | 'semester' | 'yearly';
  is_mandatory: boolean;
  is_active: boolean;
  effective_from?: Date;
  effective_to?: Date;
  created_by: string;
}

/**
 * Phase 15.4: Fee Configuration Service
 */
export class Phase15FeeConfigService {
  private db: Knex;
  private standardFees = {
    tuition: { description: 'Tuition Fee', frequency: 'monthly', mandatory: true },
    admission: { description: 'Admission Fee', frequency: 'once', mandatory: true },
    activity: { description: 'Activity Fee', frequency: 'yearly', mandatory: false },
    library: { description: 'Library Fee', frequency: 'yearly', mandatory: false },
    transport: { description: 'Transport Fee', frequency: 'monthly', mandatory: false },
    uniform: { description: 'Uniform Fee', frequency: 'once', mandatory: false },
    exam: { description: 'Examination Fee', frequency: 'semester', mandatory: true },
  };

  constructor(db: Knex) {
    this.db = db;
  }

  /**
   * Create fee configuration
   */
  async createFeeConfig(
    tenantId: string,
    data: {
      fee_type: string;
      description?: string;
      amount: number;
      currency?: string;
      frequency: 'once' | 'monthly' | 'semester' | 'yearly';
      is_mandatory?: boolean;
      effective_from?: Date;
      effective_to?: Date;
    },
    userId: string
  ): Promise<FeeConfig> {
    try {
      if (data.amount < 0) {
        throw new AppError('Fee amount cannot be negative', 400, 'VALIDATION_ERROR');
      }

      const configId = uuidv4();

      await this.db('fee_configurations').insert({
        config_id: configId,
        tenant_id: tenantId,
        fee_type: data.fee_type,
        description: data.description || null,
        amount: data.amount,
        currency: data.currency || 'USD',
        frequency: data.frequency,
        is_mandatory: data.is_mandatory ?? true,
        is_active: true,
        effective_from: data.effective_from || null,
        effective_to: data.effective_to || null,
        created_by: userId,
        created_at: new Date(),
        updated_at: new Date(),
      });

      logger.info(`Fee configuration created: ${data.fee_type} (${configId})`);

      return {
        config_id: configId,
        tenant_id: tenantId,
        fee_type: data.fee_type,
        description: data.description,
        amount: data.amount,
        currency: data.currency || 'USD',
        frequency: data.frequency,
        is_mandatory: data.is_mandatory ?? true,
        is_active: true,
        effective_from: data.effective_from,
        effective_to: data.effective_to,
        created_by: userId,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        `Failed to create fee configuration: ${(error as Error).message}`,
        500,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Get fee configuration
   */
  async getFeeConfig(configId: string, tenantId: string): Promise<FeeConfig> {
    try {
      const config = await this.db('fee_configurations')
        .where('config_id', configId)
        .where('tenant_id', tenantId)
        .first();

      if (!config) {
        throw new AppError('Fee configuration not found', 404, 'NOT_FOUND');
      }

      return {
        config_id: config.config_id,
        tenant_id: config.tenant_id,
        fee_type: config.fee_type,
        description: config.description,
        amount: config.amount,
        currency: config.currency,
        frequency: config.frequency,
        is_mandatory: config.is_mandatory,
        is_active: config.is_active,
        effective_from: config.effective_from ? new Date(config.effective_from) : undefined,
        effective_to: config.effective_to ? new Date(config.effective_to) : undefined,
        created_by: config.created_by,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        `Failed to retrieve fee configuration: ${(error as Error).message}`,
        500,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Get all fee configurations
   */
  async getAllFeeConfigs(tenantId: string, activeOnly: boolean = true): Promise<FeeConfig[]> {
    try {
      let query = this.db('fee_configurations').where('tenant_id', tenantId);

      if (activeOnly) {
        query = query.where('is_active', true);
      }

      const configs = await query.orderBy('fee_type', 'asc');

      return configs.map((c: any) => ({
        config_id: c.config_id,
        tenant_id: c.tenant_id,
        fee_type: c.fee_type,
        description: c.description,
        amount: c.amount,
        currency: c.currency,
        frequency: c.frequency,
        is_mandatory: c.is_mandatory,
        is_active: c.is_active,
        effective_from: c.effective_from ? new Date(c.effective_from) : undefined,
        effective_to: c.effective_to ? new Date(c.effective_to) : undefined,
        created_by: c.created_by,
      }));
    } catch (error) {
      logger.error('Failed to get fee configurations:', error);
      return [];
    }
  }

  /**
   * Get mandatory fees
   */
  async getMandatoryFees(tenantId: string): Promise<FeeConfig[]> {
    try {
      const configs = await this.db('fee_configurations')
        .where('tenant_id', tenantId)
        .where('is_mandatory', true)
        .where('is_active', true);

      return configs.map((c: any) => ({
        config_id: c.config_id,
        tenant_id: c.tenant_id,
        fee_type: c.fee_type,
        description: c.description,
        amount: c.amount,
        currency: c.currency,
        frequency: c.frequency,
        is_mandatory: c.is_mandatory,
        is_active: c.is_active,
        created_by: c.created_by,
      }));
    } catch (error) {
      logger.error('Failed to get mandatory fees:', error);
      return [];
    }
  }

  /**
   * Update fee configuration
   */
  async updateFeeConfig(
    configId: string,
    tenantId: string,
    updates: Partial<FeeConfig>,
    userId: string
  ): Promise<FeeConfig> {
    try {
      const updateData: any = {
        updated_at: new Date(),
        updated_by: userId,
      };

      if (updates.amount !== undefined) {
        if (updates.amount < 0) {
          throw new AppError('Fee amount cannot be negative', 400, 'VALIDATION_ERROR');
        }
        updateData.amount = updates.amount;
      }

      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.frequency !== undefined) updateData.frequency = updates.frequency;
      if (updates.is_mandatory !== undefined) updateData.is_mandatory = updates.is_mandatory;
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
      if (updates.effective_from !== undefined) updateData.effective_from = updates.effective_from;
      if (updates.effective_to !== undefined) updateData.effective_to = updates.effective_to;

      await this.db('fee_configurations')
        .where('config_id', configId)
        .where('tenant_id', tenantId)
        .update(updateData);

      logger.info(`Fee configuration updated: ${configId}`);

      return this.getFeeConfig(configId, tenantId);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        `Failed to update fee configuration: ${(error as Error).message}`,
        500,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Deactivate fee configuration
   */
  async deactivateFeeConfig(configId: string, tenantId: string, userId: string): Promise<void> {
    try {
      await this.db('fee_configurations')
        .where('config_id', configId)
        .where('tenant_id', tenantId)
        .update({
          is_active: false,
          updated_at: new Date(),
          updated_by: userId,
        });

      logger.info(`Fee configuration deactivated: ${configId}`);
    } catch (error) {
      logger.error('Failed to deactivate fee configuration:', error);
      throw new AppError(
        `Failed to deactivate fee configuration: ${(error as Error).message}`,
        500,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Initialize standard fees
   */
  async initializeStandardFees(tenantId: string, userId: string): Promise<FeeConfig[]> {
    try {
      const created: FeeConfig[] = [];

      for (const [feeType, config] of Object.entries(this.standardFees)) {
        const result = await this.createFeeConfig(
          tenantId,
          {
            fee_type: feeType,
            description: (config as any).description,
            amount: 0, // To be set by admin
            frequency: (config as any).frequency as any,
            is_mandatory: (config as any).mandatory,
          },
          userId
        );
        created.push(result);
      }

      logger.info(`Standard fees initialized for tenant: ${tenantId}`);
      return created;
    } catch (error) {
      logger.error('Failed to initialize standard fees:', error);
      return [];
    }
  }

  /**
   * Calculate total fees for student
   */
  async calculateStudentFees(
    studentId: string,
    tenantId: string,
    period: 'month' | 'semester' | 'year'
  ): Promise<number> {
    try {
      const fees = await this.getAllFeeConfigs(tenantId, true);
      let total = 0;

      fees.forEach((fee) => {
        if (fee.frequency === 'once') {
          // Only count once fees once per year
          if (period === 'year') total += fee.amount;
        } else if (fee.frequency === 'monthly') {
          if (period === 'month') total += fee.amount;
          else if (period === 'semester') total += fee.amount * 6;
          else if (period === 'year') total += fee.amount * 12;
        } else if (fee.frequency === 'semester') {
          if (period === 'semester') total += fee.amount;
          else if (period === 'year') total += fee.amount * 2;
        } else if (fee.frequency === 'yearly') {
          if (period === 'year') total += fee.amount;
        }
      });

      return total;
    } catch (error) {
      logger.error('Failed to calculate student fees:', error);
      return 0;
    }
  }
}
