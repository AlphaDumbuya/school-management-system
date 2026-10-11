/**
 * Standard Sierra Leone grading scales a school can start from in
 * Settings → Grading & Results. Every band stays editable after it is picked,
 * because schools map their own internal marks to these grades.
 *
 * - WASSCE (WAEC, SSS 3): A1–F9. A1–C6 are credits, D7/E8 passes, F9 fail.
 * - BECE (JSS 3): grades 1 (excellent) to 7 (fail); the best six subjects
 *   give an aggregate from 6 to 42. The mark ranges are the usual school
 *   mapping, not published by WAEC.
 * - NPSE (Class 6): reported as an aggregate; the government pass mark is 230,
 *   i.e. about 46%. These bands turn a subject mark into a school grade.
 */
import type { GradeEntry, GradeScale } from '@services/schoolConfigService';

export interface GradingPreset {
  id: string;
  label: string;
  level: string;
  name: string;
  description: string;
  scale_type: GradeScale['scale_type'];
  grades: GradeEntry[];
}

export const GRADING_PRESETS: GradingPreset[] = [
  {
    id: 'wassce',
    label: 'WASSCE (SSS): A1 to F9',
    level: 'SSS',
    name: 'WASSCE (A1–F9)',
    description: 'WAEC WASSCE scale. A1–C6 credit, D7–E8 pass, F9 fail.',
    scale_type: 'letter',
    grades: [
      { grade: 'A1', min_score: 75, max_score: 100, grade_points: 1, description: 'Excellent' },
      { grade: 'B2', min_score: 70, max_score: 74, grade_points: 2, description: 'Very Good' },
      { grade: 'B3', min_score: 65, max_score: 69, grade_points: 3, description: 'Good' },
      { grade: 'C4', min_score: 60, max_score: 64, grade_points: 4, description: 'Credit' },
      { grade: 'C5', min_score: 55, max_score: 59, grade_points: 5, description: 'Credit' },
      { grade: 'C6', min_score: 50, max_score: 54, grade_points: 6, description: 'Credit' },
      { grade: 'D7', min_score: 45, max_score: 49, grade_points: 7, description: 'Pass' },
      { grade: 'E8', min_score: 40, max_score: 44, grade_points: 8, description: 'Pass' },
      { grade: 'F9', min_score: 0, max_score: 39, grade_points: 9, description: 'Fail' },
    ],
  },
  {
    id: 'bece',
    label: 'BECE (JSS): 1 to 7',
    level: 'JSS',
    name: 'BECE (1–7)',
    description: 'BECE scale: 1 is the best, 7 is a fail. Best six subjects give an aggregate of 6–42.',
    scale_type: 'numeric',
    grades: [
      { grade: '1', min_score: 70, max_score: 100, grade_points: 1, description: 'Excellent' },
      { grade: '2', min_score: 60, max_score: 69, grade_points: 2, description: 'Very Good' },
      { grade: '3', min_score: 55, max_score: 59, grade_points: 3, description: 'Good' },
      { grade: '4', min_score: 50, max_score: 54, grade_points: 4, description: 'Credit' },
      { grade: '5', min_score: 45, max_score: 49, grade_points: 5, description: 'Pass' },
      { grade: '6', min_score: 40, max_score: 44, grade_points: 6, description: 'Pass' },
      { grade: '7', min_score: 0, max_score: 39, grade_points: 7, description: 'Fail' },
    ],
  },
  {
    id: 'npse',
    label: 'NPSE (Primary): Distinction to Fail',
    level: 'Primary',
    name: 'NPSE (Primary)',
    description: 'Primary scale aligned to the NPSE pass mark (230 aggregate, about 46%).',
    scale_type: 'letter',
    grades: [
      { grade: 'A', min_score: 70, max_score: 100, grade_points: 4, description: 'Distinction' },
      { grade: 'B', min_score: 60, max_score: 69, grade_points: 3, description: 'Very Good' },
      { grade: 'C', min_score: 50, max_score: 59, grade_points: 2, description: 'Credit' },
      { grade: 'D', min_score: 46, max_score: 49, grade_points: 1, description: 'Pass' },
      { grade: 'F', min_score: 0, max_score: 45, grade_points: 0, description: 'Fail' },
    ],
  },
  {
    id: 'custom',
    label: 'Custom (our own scale)',
    level: 'Any',
    name: '',
    description: '',
    scale_type: 'letter',
    grades: [
      { grade: 'A', min_score: 80, max_score: 100, grade_points: 4, description: 'Excellent' },
      { grade: 'B', min_score: 65, max_score: 79, grade_points: 3, description: 'Very Good' },
      { grade: 'C', min_score: 50, max_score: 64, grade_points: 2, description: 'Good' },
      { grade: 'D', min_score: 40, max_score: 49, grade_points: 1, description: 'Pass' },
      { grade: 'F', min_score: 0, max_score: 39, grade_points: 0, description: 'Fail' },
    ],
  },
];

/** A fresh, editable copy of a preset as a new scale. */
export function scaleFromPreset(id: string, isDefault = false): GradeScale {
  const p = GRADING_PRESETS.find((x) => x.id === id) || GRADING_PRESETS[0];
  return {
    name: p.name,
    description: p.description,
    scale_type: p.scale_type,
    min_value: 0,
    max_value: 100,
    is_default: isDefault,
    is_active: true,
    grades: p.grades.map((g) => ({ ...g })),
  };
}
