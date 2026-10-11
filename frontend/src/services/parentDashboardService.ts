/**
 * Parent Dashboard API Service — wraps /api/v1/dashboards/parent
 * Returns only the logged-in parent's own children.
 *
 * Everything is for ONE academic year (default = the school's active year),
 * resolved per child: siblings can be in different classes, one promoted
 * mid-year (several `year_classes`), one graduated, one not yet moved into the
 * new year (`pending_transition`).
 */

import { apiClient } from '@lib/apiClient';
import type { StudentDashboardData, StudentScheduleSlot } from './studentDashboardService';

export interface ParentChildSummary {
  id: string;
  admission_no: string;
  name: string;
  photo_url: string | null;
  /** The latest class that year (a promoted child's new class). */
  class_id: string | null;
  class_name: string | null;
  class_level: string | null;
  /** Every class the child had that year, newest first. */
  year_classes?: { id: string; name: string }[];
  academic_year?: string | null;
  enrolled_in_year?: boolean;
  pending_transition?: { fromYear: string; className: string } | null;
  graduated?: { year: string; className: string } | null;
  attendance_rate: number;
  average_grade: number;
  /** That year's unpaid fees. */
  outstanding_fees: number;
  /** Earlier years' unpaid fees (still owed). */
  other_years_outstanding?: number;
  other_years?: { academic_year: string; outstanding: number }[];
  /** Everything this child still owes, all years. */
  total_owed?: number;
  results_published: boolean;
}

export interface ParentDashboardData {
  academic_year?: string;
  active_year?: string;
  viewing_past?: boolean;
  no_children?: boolean;
  children: ParentChildSummary[];
  stats: {
    total_children: number;
    children_in_year?: number;
    total_outstanding: number;
    other_years_outstanding?: number;
    total_owed?: number;
    average_attendance: number;
    average_grade: number;
  };
}

/** A child's full year view: the same payload as the student portal, plus `schedule`. */
export type ParentChildDetail = StudentDashboardData & {
  profile: NonNullable<StudentDashboardData['profile']> & { name: string };
  schedule: StudentScheduleSlot[];
};

export const parentDashboardService = {
  getDashboard: (academicYear?: string) =>
    apiClient.get<ParentDashboardData>('/api/v1/dashboards/parent', {
      params: { academic_year: academicYear || undefined },
    }),

  getChildDetail: (studentId: string, academicYear?: string, term?: string) =>
    apiClient.get<ParentChildDetail>(`/api/v1/dashboards/parent/child/${studentId}`, {
      params: { academic_year: academicYear || undefined, term: term || undefined },
    }),
};

export default parentDashboardService;
