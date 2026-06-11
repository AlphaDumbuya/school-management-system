import { GradingScale, GradeDefinition, GradeConversionRule, ConfigurationResponse } from '../types/configuration';

/**
 * Grading Configuration Service
 * Manages grading scales, definitions, and conversion rules
 */
export class GradingConfigurationService {
  private gradingScales: Map<string, GradingScale> = new Map();
  private conversionRules: Map<string, GradeConversionRule> = new Map();

  /**
   * Initialize default grading scales
   */
  initializeDefaults(): void {
    // A-F Scale
    const aFScale: GradingScale = {
      id: 'scale-a-f',
      name: 'A-F Grade Scale',
      grades: [
        { grade: 'A+', minMarks: 95, maxMarks: 100, gradePoints: 4.0, description: 'Excellent' },
        { grade: 'A', minMarks: 90, maxMarks: 94.9, gradePoints: 4.0, description: 'Excellent' },
        { grade: 'B+', minMarks: 85, maxMarks: 89.9, gradePoints: 3.5, description: 'Very Good' },
        { grade: 'B', minMarks: 80, maxMarks: 84.9, gradePoints: 3.0, description: 'Good' },
        { grade: 'C+', minMarks: 75, maxMarks: 79.9, gradePoints: 2.5, description: 'Satisfactory' },
        { grade: 'C', minMarks: 70, maxMarks: 74.9, gradePoints: 2.0, description: 'Satisfactory' },
        { grade: 'D', minMarks: 60, maxMarks: 69.9, gradePoints: 1.0, description: 'Pass' },
        { grade: 'F', minMarks: 0, maxMarks: 59.9, gradePoints: 0, description: 'Fail' },
      ],
      isDefault: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Percentage Scale
    const percentageScale: GradingScale = {
      id: 'scale-percentage',
      name: 'Percentage Scale (0-100)',
      grades: [
        { grade: '90-100%', minMarks: 90, maxMarks: 100, description: 'Excellent' },
        { grade: '80-89%', minMarks: 80, maxMarks: 89.9, description: 'Very Good' },
        { grade: '70-79%', minMarks: 70, maxMarks: 79.9, description: 'Good' },
        { grade: '60-69%', minMarks: 60, maxMarks: 69.9, description: 'Satisfactory' },
        { grade: 'Below 60%', minMarks: 0, maxMarks: 59.9, description: 'Needs Improvement' },
      ],
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Grade Points Scale
    const gpScale: GradingScale = {
      id: 'scale-grade-points',
      name: 'Grade Points (0-4)',
      grades: [
        { grade: '4.0', minMarks: 95, maxMarks: 100, gradePoints: 4.0, description: 'Excellent' },
        { grade: '3.5', minMarks: 85, maxMarks: 94.9, gradePoints: 3.5, description: 'Very Good' },
        { grade: '3.0', minMarks: 75, maxMarks: 84.9, gradePoints: 3.0, description: 'Good' },
        { grade: '2.5', minMarks: 65, maxMarks: 74.9, gradePoints: 2.5, description: 'Satisfactory' },
        { grade: '2.0', minMarks: 55, maxMarks: 64.9, gradePoints: 2.0, description: 'Pass' },
        { grade: '0.0', minMarks: 0, maxMarks: 54.9, gradePoints: 0, description: 'Fail' },
      ],
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.gradingScales.set(aFScale.id, aFScale);
    this.gradingScales.set(percentageScale.id, percentageScale);
    this.gradingScales.set(gpScale.id, gpScale);
  }

  /**
   * Get all grading scales
   */
  async getAllScales(): Promise<GradingScale[]> {
    if (this.gradingScales.size === 0) {
      this.initializeDefaults();
    }
    return Array.from(this.gradingScales.values());
  }

  /**
   * Get grading scale by ID
   */
  async getScale(scaleId: string): Promise<GradingScale | null> {
    if (this.gradingScales.size === 0) {
      this.initializeDefaults();
    }
    return this.gradingScales.get(scaleId) || null;
  }

  /**
   * Get default grading scale
   */
  async getDefaultScale(): Promise<GradingScale> {
    if (this.gradingScales.size === 0) {
      this.initializeDefaults();
    }
    const defaults = Array.from(this.gradingScales.values()).filter(s => s.isDefault);
    return defaults[0];
  }

  /**
   * Create custom grading scale
   */
  async createScale(scale: Omit<GradingScale, 'id' | 'createdAt' | 'updatedAt'>): Promise<ConfigurationResponse<GradingScale>> {
    try {
      // Validate grades
      const validation = this.validateGrades(scale.grades);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join(', '),
          timestamp: new Date().toISOString(),
        };
      }

      const newScale: GradingScale = {
        ...scale,
        id: `scale-custom-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.gradingScales.set(newScale.id, newScale);

      return {
        success: true,
        data: newScale,
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
   * Update grading scale
   */
  async updateScale(scaleId: string, updates: Partial<GradingScale>): Promise<ConfigurationResponse<GradingScale>> {
    try {
      const scale = this.gradingScales.get(scaleId);
      if (!scale) {
        return {
          success: false,
          error: 'Scale not found',
          timestamp: new Date().toISOString(),
        };
      }

      if (updates.grades) {
        const validation = this.validateGrades(updates.grades);
        if (!validation.valid) {
          return {
            success: false,
            error: validation.errors.join(', '),
            timestamp: new Date().toISOString(),
          };
        }
      }

      const updatedScale: GradingScale = {
        ...scale,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      this.gradingScales.set(scaleId, updatedScale);

      return {
        success: true,
        data: updatedScale,
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
   * Get grade for marks
   */
  async getGradeForMarks(marks: number, scaleId?: string): Promise<GradeDefinition | null> {
    const scale = scaleId ? await this.getScale(scaleId) : await this.getDefaultScale();
    if (!scale) return null;

    return scale.grades.find(g => marks >= g.minMarks && marks <= g.maxMarks) || null;
  }

  /**
   * Create grade conversion rule
   */
  async createConversionRule(
    fromScaleId: string,
    toScaleId: string,
    conversions: Array<{ fromGrade: string; toGrade: string }>
  ): Promise<ConfigurationResponse<GradeConversionRule>> {
    try {
      // Validate scales exist
      const fromScale = await this.getScale(fromScaleId);
      const toScale = await this.getScale(toScaleId);

      if (!fromScale || !toScale) {
        return {
          success: false,
          error: 'One or both scales not found',
          timestamp: new Date().toISOString(),
        };
      }

      const rule: GradeConversionRule = {
        id: `rule-${Date.now()}`,
        fromScale: fromScaleId,
        toScale: toScaleId,
        conversions,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.conversionRules.set(rule.id, rule);

      return {
        success: true,
        data: rule,
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
   * Convert grade between scales
   */
  async convertGrade(grade: string, ruleId: string): Promise<string | null> {
    const rule = this.conversionRules.get(ruleId);
    if (!rule) return null;

    const conversion = rule.conversions.find(c => c.fromGrade === grade);
    return conversion ? conversion.toGrade : null;
  }

  /**
   * Validate grades
   */
  private validateGrades(grades: GradeDefinition[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!grades || grades.length === 0) {
      errors.push('At least one grade definition is required');
      return { valid: false, errors };
    }

    // Check for overlapping ranges
    const sorted = [...grades].sort((a, b) => a.minMarks - b.minMarks);
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].maxMarks >= sorted[i + 1].minMarks) {
        errors.push(`Grade ranges overlap: ${sorted[i].grade} and ${sorted[i + 1].grade}`);
      }
    }

    // Check for gaps
    if (sorted[0].minMarks > 0) {
      errors.push('First grade must start from 0 marks');
    }
    if (sorted[sorted.length - 1].maxMarks < 100) {
      errors.push('Last grade must include 100 marks');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Calculate GPA from grades
   */
  calculateGPA(grades: GradeDefinition[], weights?: number[]): number {
    if (grades.length === 0) return 0;

    let totalPoints = 0;
    let totalWeight = 0;

    grades.forEach((grade, index) => {
      const weight = weights ? weights[index] || 1 : 1;
      totalPoints += (grade.gradePoints || 0) * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? totalPoints / totalWeight : 0;
  }
}

export default new GradingConfigurationService();
