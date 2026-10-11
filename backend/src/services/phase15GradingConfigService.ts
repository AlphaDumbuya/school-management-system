
/**
 * Phase 15.2: Grading Configuration Service
 * 
 * Manages grading scale configuration including:
 * - Grading scale definitions (A-F, 0-100, etc.)
 * - Grade conversion rules
 * - Grade point calculations
 * - Grading configuration endpoints
 */

import { Knex } from 'knex';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface GradeScale {
  scale_id: string;
  tenant_id: string;
  name: string;
  description?: string;
  scale_type: 'letter' | 'numeric' | 'percentage' | 'point';
  min_value: number;
  max_value: number;
  is_default: boolean;
  is_active: boolean;
  grades: GradeEntry[];
  created_by: string;
  updated_by?: string;
}

export interface GradeEntry {
  grade: string;
  min_score: number;
  max_score: number;
  grade_points: number;
  description?: string;
}

export interface GradeConversionRule {
  rule_id: string;
  tenant_id: string;
  from_scale_id: string;
  to_scale_id: string;
  conversion_map: Record<string, string>;
  is_active: boolean;
  created_by: string;
}

export interface GradingWeightConfig {
  weight_id: string;
  tenant_id: string;
  name: string;
  components: {
    name: string;
    weight: number;
    description?: string;
  }[];
  total_weight: number;
  is_default: boolean;
  created_by: string;
}

/**
 * Phase 15.2: Grading Configuration Service
 */
export class Phase15GradingConfigService {
  private db: Knex;

  // Standard grade scales
  private standardScales = {
    letterA_F: {
      name: 'Letter Grade (A-F)',
      type: 'letter',
      min: 0,
      max: 100,
      grades: [
        { grade: 'A', min: 90, max: 100, points: 4.0 },
        { grade: 'B', min: 80, max: 89, points: 3.0 },
        { grade: 'C', min: 70, max: 79, points: 2.0 },
        { grade: 'D', min: 60, max: 69, points: 1.0 },
        { grade: 'F', min: 0, max: 59, points: 0.0 },
      ],
    },
    letterA_F_Plus_Minus: {
      name: 'Letter Grade (A+ to F)',
      type: 'letter',
      min: 0,
      max: 100,
      grades: [
        { grade: 'A+', min: 97, max: 100, points: 4.0 },
        { grade: 'A', min: 93, max: 96, points: 4.0 },
        { grade: 'A-', min: 90, max: 92, points: 3.7 },
        { grade: 'B+', min: 87, max: 89, points: 3.3 },
        { grade: 'B', min: 83, max: 86, points: 3.0 },
        { grade: 'B-', min: 80, max: 82, points: 2.7 },
        { grade: 'C+', min: 77, max: 79, points: 2.3 },
        { grade: 'C', min: 73, max: 76, points: 2.0 },
        { grade: 'C-', min: 70, max: 72, points: 1.7 },
        { grade: 'D+', min: 67, max: 69, points: 1.3 },
        { grade: 'D', min: 63, max: 66, points: 1.0 },
        { grade: 'D-', min: 60, max: 62, points: 0.7 },
        { grade: 'F', min: 0, max: 59, points: 0.0 },
      ],
    },
    percentage: {
      name: 'Percentage (0-100)',
      type: 'percentage',
      min: 0,
      max: 100,
      grades: [
        { grade: 'Excellent', min: 85, max: 100, points: 4.0 },
        { grade: 'Very Good', min: 75, max: 84, points: 3.5 },
        { grade: 'Good', min: 65, max: 74, points: 3.0 },
        { grade: 'Satisfactory', min: 50, max: 64, points: 2.0 },
        { grade: 'Fail', min: 0, max: 49, points: 0.0 },
      ],
    },
    numeric_0_10: {
      name: 'Numeric (0-10)',
      type: 'numeric',
      min: 0,
      max: 10,
      grades: [
        { grade: 'Excellent', min: 9, max: 10, points: 4.0 },
        { grade: 'Very Good', min: 8, max: 8.9, points: 3.5 },
        { grade: 'Good', min: 7, max: 7.9, points: 3.0 },
        { grade: 'Satisfactory', min: 5, max: 6.9, points: 2.0 },
        { grade: 'Fail', min: 0, max: 4.9, points: 0.0 },
      ],
    },
  };

  constructor(db: Knex) {
    this.db = db;
  }

  /**
   * Create grading scale
   */
  async createGradeScale(
    tenantId: string,
    scaleData: {
      name: string;
      description?: string;
      scale_type: 'letter' | 'numeric' | 'percentage' | 'point';
      min_value: number;
      max_value: number;
      grades: GradeEntry[];
      is_default?: boolean;
    },
    userId: string
  ): Promise<GradeScale> {
    try {
      // Validate input
      if (!scaleData.name || scaleData.name.trim() === '') {
        throw new AppError('Scale name is required', 400, 'VALIDATION_ERROR');
      }

      if (scaleData.grades.length === 0) {
        throw new AppError('At least one grade entry is required', 400, 'VALIDATION_ERROR');
      }

      // Validate grades
      this.validateGradeEntries(scaleData.grades);

      const scaleId = uuidv4();

      // If this is default, unset other defaults
      if (scaleData.is_default) {
        await this.db('grading_scales')
          .where('tenant_id', tenantId)
          .where('is_default', true)
          .update({ is_default: false });
      }

      // Create scale
      await this.db('grading_scales').insert({
        scale_id: scaleId,
        tenant_id: tenantId,
        name: scaleData.name,
        description: scaleData.description || null,
        scale_type: scaleData.scale_type,
        min_value: scaleData.min_value,
        max_value: scaleData.max_value,
        is_default: scaleData.is_default || false,
        is_active: true,
        grades_json: JSON.stringify(scaleData.grades),
        created_by: userId,
        created_at: new Date(),
        updated_at: new Date(),
      });

      logger.info(`Grading scale created: ${scaleData.name} (${scaleId})`);

      return {
        scale_id: scaleId,
        tenant_id: tenantId,
        name: scaleData.name,
        description: scaleData.description,
        scale_type: scaleData.scale_type,
        min_value: scaleData.min_value,
        max_value: scaleData.max_value,
        is_default: scaleData.is_default || false,
        is_active: true,
        grades: scaleData.grades,
        created_by: userId,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        `Failed to create grading scale: ${(error as Error).message}`,
        500,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Get grading scale
   */
  async getGradeScale(scaleId: string, tenantId: string): Promise<GradeScale> {
    try {
      const scale = await this.db('grading_scales')
        .where('scale_id', scaleId)
        .where('tenant_id', tenantId)
        .first();

      if (!scale) {
        throw new AppError('Grading scale not found', 404, 'NOT_FOUND');
      }

      return {
        scale_id: scale.scale_id,
        tenant_id: scale.tenant_id,
        name: scale.name,
        description: scale.description,
        scale_type: scale.scale_type,
        min_value: scale.min_value,
        max_value: scale.max_value,
        is_default: scale.is_default,
        is_active: scale.is_active,
        grades: JSON.parse(scale.grades_json),
        created_by: scale.created_by,
        updated_by: scale.updated_by,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        `Failed to retrieve grading scale: ${(error as Error).message}`,
        500,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Get all grading scales for tenant
   */
  async getGradeScales(tenantId: string): Promise<GradeScale[]> {
    try {
      const scales = await this.db('grading_scales')
        .where('tenant_id', tenantId)
        .where('is_active', true)
        .orderBy('is_default', 'desc')
        .orderBy('created_at', 'asc');

      return scales.map((scale: any) => ({
        scale_id: scale.scale_id,
        tenant_id: scale.tenant_id,
        name: scale.name,
        description: scale.description,
        scale_type: scale.scale_type,
        min_value: scale.min_value,
        max_value: scale.max_value,
        is_default: scale.is_default,
        is_active: scale.is_active,
        grades: JSON.parse(scale.grades_json),
        created_by: scale.created_by,
        updated_by: scale.updated_by,
      }));
    } catch (error) {
      logger.error('Failed to retrieve grading scales:', error);
      return [];
    }
  }

  /**
   * Get default grading scale
   */
  async getDefaultGradeScale(tenantId: string): Promise<GradeScale | null> {
    try {
      const scale = await this.db('grading_scales')
        .where('tenant_id', tenantId)
        .where('is_default', true)
        .where('is_active', true)
        .first();

      if (!scale) {
        return null;
      }

      return {
        scale_id: scale.scale_id,
        tenant_id: scale.tenant_id,
        name: scale.name,
        description: scale.description,
        scale_type: scale.scale_type,
        min_value: scale.min_value,
        max_value: scale.max_value,
        is_default: scale.is_default,
        is_active: scale.is_active,
        grades: JSON.parse(scale.grades_json),
        created_by: scale.created_by,
        updated_by: scale.updated_by,
      };
    } catch (error) {
      logger.error('Failed to retrieve default grading scale:', error);
      return null;
    }
  }

  /**
   * Update grading scale
   */
  async updateGradeScale(
    scaleId: string,
    tenantId: string,
    updates: Partial<GradeScale>,
    userId: string
  ): Promise<GradeScale> {
    try {
      const scale = await this.getGradeScale(scaleId, tenantId);

      // Validate grades if updating
      if (updates.grades) {
        this.validateGradeEntries(updates.grades);
      }

      const updateData: any = {
        updated_at: new Date(),
        updated_by: userId,
      };

      if (updates.name) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.grades) updateData.grades_json = JSON.stringify(updates.grades);
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

      // If setting as default, unset others
      if (updates.is_default) {
        await this.db('grading_scales')
          .where('tenant_id', tenantId)
          .where('scale_id', '!=', scaleId)
          .update({ is_default: false });
        updateData.is_default = true;
      }

      await this.db('grading_scales')
        .where('scale_id', scaleId)
        .update(updateData);

      logger.info(`Grading scale updated: ${scaleId}`);

      return this.getGradeScale(scaleId, tenantId);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        `Failed to update grading scale: ${(error as Error).message}`,
        500,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Delete grading scale
   */
  async deleteGradeScale(scaleId: string, tenantId: string): Promise<void> {
    try {
      const scale = await this.db('grading_scales')
        .where('scale_id', scaleId)
        .where('tenant_id', tenantId)
        .first();

      if (!scale) {
        throw new AppError('Grading scale not found', 404, 'NOT_FOUND');
      }

      if (scale.is_default) {
        throw new AppError(
          'Cannot delete default grading scale. Set another as default first.',
          400,
          'VALIDATION_ERROR'
        );
      }

      // Check if scale is in use
      const inUse = await this.db('grades')
        .where('scale_id', scaleId)
        .first();

      if (inUse) {
        throw new AppError(
          'Cannot delete grading scale that is in use',
          400,
          'VALIDATION_ERROR'
        );
      }

      await this.db('grading_scales')
        .where('scale_id', scaleId)
        .delete();

      logger.info(`Grading scale deleted: ${scaleId}`);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        `Failed to delete grading scale: ${(error as Error).message}`,
        500,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Create grade conversion rule
   */
  async createConversionRule(
    tenantId: string,
    fromScaleId: string,
    toScaleId: string,
    conversionMap: Record<string, string>,
    userId: string
  ): Promise<GradeConversionRule> {
    try {
      // Validate scales exist
      await this.getGradeScale(fromScaleId, tenantId);
      await this.getGradeScale(toScaleId, tenantId);

      const ruleId = uuidv4();

      await this.db('grade_conversion_rules').insert({
        rule_id: ruleId,
        tenant_id: tenantId,
        from_scale_id: fromScaleId,
        to_scale_id: toScaleId,
        conversion_map: JSON.stringify(conversionMap),
        is_active: true,
        created_by: userId,
        created_at: new Date(),
      });

      logger.info(`Grade conversion rule created: ${ruleId}`);

      return {
        rule_id: ruleId,
        tenant_id: tenantId,
        from_scale_id: fromScaleId,
        to_scale_id: toScaleId,
        conversion_map: conversionMap,
        is_active: true,
        created_by: userId,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        `Failed to create conversion rule: ${(error as Error).message}`,
        500,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Convert grade using rule
   */
  async convertGrade(
    ruleId: string,
    gradeValue: string,
    tenantId: string
  ): Promise<string> {
    try {
      const rule = await this.db('grade_conversion_rules')
        .where('rule_id', ruleId)
        .where('tenant_id', tenantId)
        .where('is_active', true)
        .first();

      if (!rule) {
        throw new AppError('Conversion rule not found', 404, 'NOT_FOUND');
      }

      const conversionMap = JSON.parse(rule.conversion_map);
      const convertedGrade = conversionMap[gradeValue];

      if (!convertedGrade) {
        throw new AppError(
          `No conversion found for grade: ${gradeValue}`,
          400,
          'VALIDATION_ERROR'
        );
      }

      return convertedGrade;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        `Failed to convert grade: ${(error as Error).message}`,
        500,
        'CONVERSION_ERROR'
      );
    }
  }

  /**
   * Get standard grading scale
   */
  async getStandardScale(scaleKey: keyof typeof this.standardScales): Promise<any> {
    const scale = this.standardScales[scaleKey];
    if (!scale) {
      throw new AppError('Standard scale not found', 404, 'NOT_FOUND');
    }
    return scale;
  }

  /**
   * Create standard grading scale for tenant
   */
  async createStandardScale(
    tenantId: string,
    scaleKey: keyof typeof this.standardScales,
    userId: string
  ): Promise<GradeScale> {
    try {
      const standardScale = this.standardScales[scaleKey];
      if (!standardScale) {
        throw new AppError('Standard scale not found', 404, 'NOT_FOUND');
      }

      return this.createGradeScale(
        tenantId,
        {
          name: standardScale.name,
          scale_type: standardScale.type as any,
          min_value: standardScale.min,
          max_value: standardScale.max,
          grades: standardScale.grades as any,
          is_default: true,
        },
        userId
      );
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        `Failed to create standard scale: ${(error as Error).message}`,
        500,
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Validate grade entries
   */
  private validateGradeEntries(grades: GradeEntry[]): void {
    if (!grades || grades.length === 0) {
      throw new AppError('At least one grade entry is required', 400, 'VALIDATION_ERROR');
    }

    // Check for overlaps
    for (let i = 0; i < grades.length; i++) {
      for (let j = i + 1; j < grades.length; j++) {
        if (
          (grades[i].min_score <= grades[j].min_score && grades[j].min_score <= grades[i].max_score) ||
          (grades[j].min_score <= grades[i].min_score && grades[i].min_score <= grades[j].max_score)
        ) {
          throw new AppError(
            `Grade ranges overlap: ${grades[i].grade} and ${grades[j].grade}`,
            400,
            'VALIDATION_ERROR'
          );
        }
      }
    }

    // Check grade points range
    grades.forEach((grade) => {
      // 0–9: GPA-style scales use 0–4, WASSCE uses 1–9 and BECE 1–7.
      if (grade.grade_points < 0 || grade.grade_points > 9) {
        throw new AppError(
          `Grade points must be between 0 and 9 for grade ${grade.grade}`,
          400,
          'VALIDATION_ERROR'
        );
      }
    });
  }

  /**
   * Calculate GPA from grades and scale
   */
  async calculateGPA(
    scaleId: string,
    grades: { gradeValue: string; weight?: number }[],
    tenantId: string
  ): Promise<number> {
    try {
      const scale = await this.getGradeScale(scaleId, tenantId);

      let totalWeightedPoints = 0;
      let totalWeight = 0;

      for (const grade of grades) {
        const gradeEntry = scale.grades.find((g) => g.grade === grade.gradeValue);
        if (!gradeEntry) {
          continue;
        }

        const weight = grade.weight || 1;
        totalWeightedPoints += gradeEntry.grade_points * weight;
        totalWeight += weight;
      }

      const gpa = totalWeight > 0 ? totalWeightedPoints / totalWeight : 0;
      return Math.min(parseFloat(gpa.toFixed(2)), 4.0);
    } catch (error) {
      logger.error('Failed to calculate GPA:', error);
      return 0;
    }
  }
}
