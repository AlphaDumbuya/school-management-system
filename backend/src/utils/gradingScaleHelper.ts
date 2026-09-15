/**
 * gradingScaleHelper.ts
 *
 * Shared utility for resolving a tenant's configured grading scale and
 * computing letter grades dynamically. Used by:
 *   - resultsRoutes.ts (Results & Grades)
 *   - slReportCardService.ts (Report Cards)
 *   - slReportCardRoutes.ts (Report Card config endpoint)
 *
 * If no tenant-configured scale exists, falls back to the standard
 * Sierra Leone grading method.
 */

import db from '../utils/database.js';
import { logger } from '../utils/logger.js';

export interface GradeEntry {
  grade: string;
  min_score: number;
  max_score: number;
  grade_points?: number;
  description?: string;
}

export interface TenantGradingScale {
  scale_id: string;
  name: string;
  grades: GradeEntry[];
}

/** Hardcoded SL fallback (used when no tenant scale is configured) */
export const DEFAULT_SL_GRADES: GradeEntry[] = [
  { grade: 'A', min_score: 85, max_score: 100, grade_points: 4.0, description: 'Excellent' },
  { grade: 'B', min_score: 75, max_score: 84, grade_points: 3.0, description: 'Very Good' },
  { grade: 'C', min_score: 60, max_score: 74, grade_points: 2.0, description: 'Good' },
  { grade: 'D', min_score: 50, max_score: 59, grade_points: 1.0, description: 'Satisfactory' },
  { grade: 'F', min_score: 0, max_score: 49, grade_points: 0.0, description: 'Unsatisfactory' },
];

/**
 * Get the tenant's default grading scale from the DB.
 * Falls back to the hardcoded SL scale if none configured.
 */
export async function getTenantGradingScale(tenantId: string): Promise<TenantGradingScale> {
  try {
    const scale = await db('grading_scales')
      .where({ tenant_id: tenantId, is_default: true, is_active: true })
      .first();

    if (scale) {
      let grades: GradeEntry[] = [];
      // Try grades_json first (new column), then grades (original column)
      const rawGrades = scale.grades_json || scale.grades;
      if (rawGrades) {
        if (typeof rawGrades === 'string') {
          grades = JSON.parse(rawGrades);
        } else if (Array.isArray(rawGrades)) {
          grades = rawGrades;
        }
      }

      if (grades.length > 0) {
        return {
          scale_id: scale.scale_id || scale.id,
          name: scale.name,
          grades,
        };
      }
    }
  } catch (error) {
    logger.warn('Failed to load tenant grading scale, using SL default:', error);
  }

  // Fallback to hardcoded SL defaults
  return {
    scale_id: 'default-sl',
    name: 'Sierra Leone Standard (fallback)',
    grades: DEFAULT_SL_GRADES,
  };
}

/**
 * Compute letter grade and remark from a score using the tenant's
 * configured grading scale.
 */
export async function computeGrade(
  score: number,
  tenantId: string
): Promise<{ letter: string; remark: string; isFail: boolean }> {
  const scale = await getTenantGradingScale(tenantId);

  for (const entry of scale.grades) {
    if (score >= entry.min_score && score <= entry.max_score) {
      return {
        letter: entry.grade,
        remark: entry.description || '',
        isFail: entry.grade === 'F' || entry.grade_points === 0,
      };
    }
  }

  // Below all thresholds = fail
  const failEntry = scale.grades.find((g) => g.grade === 'F');
  return {
    letter: failEntry?.grade || 'F',
    remark: failEntry?.description || 'Unsatisfactory',
    isFail: true,
  };
}

/**
 * Sync version for cases where the scale is already loaded.
 */
export function computeGradeWithScale(
  score: number,
  scale: TenantGradingScale
): { letter: string; remark: string; isFail: boolean } {
  for (const entry of scale.grades) {
    if (score >= entry.min_score && score <= entry.max_score) {
      return {
        letter: entry.grade,
        remark: entry.description || '',
        isFail: entry.grade === 'F' || entry.grade_points === 0,
      };
    }
  }

  const failEntry = scale.grades.find((g) => g.grade === 'F');
  return {
    letter: failEntry?.grade || 'F',
    remark: failEntry?.description || 'Unsatisfactory',
    isFail: true,
  };
}
