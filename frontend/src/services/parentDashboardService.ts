/**
 * Parent Dashboard API Service — wraps /api/v1/dashboards/parent
 * Returns only the logged-in parent's own children.
 */

import { apiClient } from '@lib/apiClient';
import type { StudentGrade, StudentAttendanceRecord, StudentScheduleSlot, StudentInvoice } from './studentDashboardService';

export interface ParentChildSummary {
  id: string;
  admission_no: string;
  name: string;
  photo_url: string | null;
  class_id: string | null;
  class_name: string | null;
  class_level: string | null;
  attendance_rate: number;
  average_grade: number;
  outstanding_fees: number;
  results_published: boolean;
}

export interface ParentDashboardData {
  no_children?: boolean;
  children: ParentChildSummary[];
  stats: {
    total_children: number;
    total_outstanding: number;
    average_attendance: number;
    average_grade: number;
  };
}

export interface ParentChildDetail {
  profile: {
    id: string;
    admission_no: string;
    name: string;
    photo_url: string | null;
    class_id: string | null;
    class_name: string | null;
    class_level: string | null;
    academic_year: string | null;
  };
  results_published: boolean;
  grades: StudentGrade[];
  attendance: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
    percentage: number;
    records: StudentAttendanceRecord[];
  };
  schedule: StudentScheduleSlot[];
  fees: {
    total: number;
    paid: number;
    outstanding: number;
    invoices: StudentInvoice[];
  };
}

export const parentDashboardService = {
  getDashboard: () =>
    apiClient.get<ParentDashboardData>('/api/v1/dashboards/parent'),

  getChildDetail: (studentId: string) =>
    apiClient.get<ParentChildDetail>(`/api/v1/dashboards/parent/child/${studentId}`),
};

export default parentDashboardService;
