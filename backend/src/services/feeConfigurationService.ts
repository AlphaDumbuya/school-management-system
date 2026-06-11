import { FeeConfiguration, FeeStructure, ConfigurationResponse } from '../types/configuration';

/**
 * Fee Configuration Service
 * Manages fee types, structures, and configurations
 */
export class FeeConfigurationService {
  private feeTypes: Map<string, FeeConfiguration> = new Map();
  private feeStructures: Map<string, FeeStructure> = new Map();

  /**
   * Initialize default fee types
   */
  initializeDefaults(): void {
    const defaultFees: FeeConfiguration[] = [
      {
        id: 'fee-tuition',
        name: 'Tuition Fee',
        amount: 5000,
        currency: 'USD',
        description: 'Monthly tuition fee for school education',
        frequency: 'monthly',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'fee-transport',
        name: 'Transport Fee',
        amount: 500,
        currency: 'USD',
        description: 'Monthly school transport fee',
        frequency: 'monthly',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'fee-registration',
        name: 'Registration Fee',
        amount: 2000,
        currency: 'USD',
        description: 'One-time registration fee',
        frequency: 'one-time',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'fee-exam',
        name: 'Examination Fee',
        amount: 1000,
        currency: 'USD',
        description: 'Annual examination fee',
        frequency: 'annual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'fee-activities',
        name: 'Activities Fee',
        amount: 300,
        currency: 'USD',
        description: 'Monthly activities and sports fee',
        frequency: 'monthly',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    defaultFees.forEach(fee => this.feeTypes.set(fee.id, fee));
  }

  /**
   * Get all fee types
   */
  async getAllFeeTypes(): Promise<FeeConfiguration[]> {
    if (this.feeTypes.size === 0) {
      this.initializeDefaults();
    }
    return Array.from(this.feeTypes.values());
  }

  /**
   * Get fee type by ID
   */
  async getFeeType(feeId: string): Promise<FeeConfiguration | null> {
    if (this.feeTypes.size === 0) {
      this.initializeDefaults();
    }
    return this.feeTypes.get(feeId) || null;
  }

  /**
   * Create new fee type
   */
  async createFeeType(fee: Omit<FeeConfiguration, 'id' | 'createdAt' | 'updatedAt'>): Promise<ConfigurationResponse<FeeConfiguration>> {
    try {
      // Validate fee data
      const validation = this.validateFeeType(fee);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join(', '),
          timestamp: new Date().toISOString(),
        };
      }

      const newFee: FeeConfiguration = {
        ...fee,
        id: `fee-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.feeTypes.set(newFee.id, newFee);

      return {
        success: true,
        data: newFee,
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
   * Update fee type
   */
  async updateFeeType(feeId: string, updates: Partial<FeeConfiguration>): Promise<ConfigurationResponse<FeeConfiguration>> {
    try {
      const fee = this.feeTypes.get(feeId);
      if (!fee) {
        return {
          success: false,
          error: 'Fee type not found',
          timestamp: new Date().toISOString(),
        };
      }

      const updatedFee: FeeConfiguration = {
        ...fee,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      // Validate updated fee
      const validation = this.validateFeeType(updatedFee);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join(', '),
          timestamp: new Date().toISOString(),
        };
      }

      this.feeTypes.set(feeId, updatedFee);

      return {
        success: true,
        data: updatedFee,
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
   * Delete fee type
   */
  async deleteFeeType(feeId: string): Promise<ConfigurationResponse<void>> {
    try {
      if (!this.feeTypes.has(feeId)) {
        return {
          success: false,
          error: 'Fee type not found',
          timestamp: new Date().toISOString(),
        };
      }

      this.feeTypes.delete(feeId);

      return {
        success: true,
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
   * Create fee structure for session
   */
  async createFeeStructure(sessionId: string, feeTypeIds: string[]): Promise<ConfigurationResponse<FeeStructure>> {
    try {
      if (this.feeTypes.size === 0) {
        this.initializeDefaults();
      }

      const selectedFees: FeeConfiguration[] = [];
      let totalFee = 0;

      for (const feeId of feeTypeIds) {
        const fee = this.feeTypes.get(feeId);
        if (!fee) {
          return {
            success: false,
            error: `Fee type ${feeId} not found`,
            timestamp: new Date().toISOString(),
          };
        }

        selectedFees.push(fee);

        // Calculate total annual fee
        if (fee.frequency === 'annual' || fee.frequency === 'one-time') {
          totalFee += fee.amount;
        } else if (fee.frequency === 'monthly') {
          totalFee += fee.amount * 12;
        } else if (fee.frequency === 'quarterly') {
          totalFee += fee.amount * 4;
        } else if (fee.frequency === 'semi-annual') {
          totalFee += fee.amount * 2;
        }
      }

      const structure: FeeStructure = {
        id: `structure-${Date.now()}`,
        sessionId,
        feeTypes: selectedFees,
        totalAnnualFee: totalFee,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.feeStructures.set(structure.id, structure);

      return {
        success: true,
        data: structure,
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
   * Get fee structure
   */
  async getFeeStructure(sessionId: string): Promise<FeeStructure | null> {
    const structures = Array.from(this.feeStructures.values());
    return structures.find(s => s.sessionId === sessionId) || null;
  }

  /**
   * Get total annual fee for session
   */
  async getTotalAnnualFee(sessionId: string): Promise<number> {
    const structure = await this.getFeeStructure(sessionId);
    return structure ? structure.totalAnnualFee : 0;
  }

  /**
   * Get monthly fee breakdown
   */
  async getMonthlyFeeBreakdown(sessionId: string): Promise<Array<{ type: string; amount: number }>> {
    const structure = await this.getFeeStructure(sessionId);
    if (!structure) return [];

    const breakdown: Array<{ type: string; amount: number }> = [];

    structure.feeTypes.forEach(fee => {
      let monthlyAmount = 0;

      switch (fee.frequency) {
        case 'monthly':
          monthlyAmount = fee.amount;
          break;
        case 'quarterly':
          monthlyAmount = fee.amount / 3;
          break;
        case 'semi-annual':
          monthlyAmount = fee.amount / 6;
          break;
        case 'annual':
        case 'one-time':
          monthlyAmount = fee.amount / 12;
          break;
      }

      breakdown.push({
        type: fee.name,
        amount: monthlyAmount,
      });
    });

    return breakdown;
  }

  /**
   * Calculate fee for specific period
   */
  calculateFeeForPeriod(feeType: FeeConfiguration, months: number): number {
    switch (feeType.frequency) {
      case 'monthly':
        return feeType.amount * months;
      case 'quarterly':
        return (feeType.amount / 3) * months;
      case 'semi-annual':
        return (feeType.amount / 6) * months;
      case 'annual':
      case 'one-time':
        return feeType.amount;
      default:
        return 0;
    }
  }

  /**
   * Validate fee type data
   */
  private validateFeeType(fee: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!fee.name || fee.name.trim() === '') {
      errors.push('Fee name is required');
    }

    if (fee.amount === undefined || fee.amount <= 0) {
      errors.push('Fee amount must be greater than 0');
    }

    if (!fee.currency || fee.currency.trim() === '') {
      errors.push('Currency is required');
    }

    const validFrequencies = ['one-time', 'monthly', 'quarterly', 'semi-annual', 'annual'];
    if (!fee.frequency || !validFrequencies.includes(fee.frequency)) {
      errors.push('Valid frequency is required (one-time, monthly, quarterly, semi-annual, annual)');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get fee summary
   */
  async getFeeSummary(): Promise<{
    totalFeeTypes: number;
    totalStructures: number;
    averageAnnualFee: number;
  }> {
    if (this.feeTypes.size === 0) {
      this.initializeDefaults();
    }

    const structures = Array.from(this.feeStructures.values());
    const totalFees = structures.reduce((sum, s) => sum + s.totalAnnualFee, 0);
    const averageFee = structures.length > 0 ? totalFees / structures.length : 0;

    return {
      totalFeeTypes: this.feeTypes.size,
      totalStructures: this.feeStructures.size,
      averageAnnualFee: averageFee,
    };
  }
}

export default new FeeConfigurationService();
