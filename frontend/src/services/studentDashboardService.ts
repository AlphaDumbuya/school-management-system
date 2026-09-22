/**
 * Student Dashboard API Service — wraps /api/v1/dashboards/student
 * Returns only the logged-in student's own data.
 */

import { apiClient } from '@lib/apiClient';

export interface StudentGrade {
  id: string;
  subject_name: string;
  subject_code?: string;
  term: string;
  test1: number | null;
  test2: number | null;
  mean: number | null;
  subject_rank: number | null;
}

export interface StudentAttendanceRecord {
  id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused' | string;
  session_type?: string | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  marked_at?: string | null;
  remarks?: string | null;
}

export interface StudentScheduleSlot {
  id: string;
  day_of_week: string;
  subject_name: string;
  teacher_name: string | null;
  start_time: string;
  end_time: string;
  room?: string | null;
}

export interface StudentInvoice {
  id: string;
  invoice_number: string;
  total_amount: number | string;
  total_paid: number | string;
  balance: number | string;
  due_date: string;
  status: string;
}

export interface StudentDashboardData {
  student_profile_missing?: boolean;
  profile: {
    id: string;
    admission_no: string;
    first_name: string;
    last_name: string;
    full_name: string;
    photo_url: string | null;
    class_id: string | null;
    class_name: string | null;
    class_level: string | null;
    class_section: string | null;
    academic_year: string | null;
  } | null;
  stats: {
    attendance_rate: number;
    average_grade: number;
    classes_today: number;
    outstanding_fees: number;
  };
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
  today_schedule: StudentScheduleSlot[];
  weekly_schedule: StudentScheduleSlot[];
  fees: {
    total: number;
    paid: number;
    outstanding: number;
    invoices: StudentInvoice[];
  };
}

export const studentDashboardService = {
  getDashboard: () =>
    apiClient.get<StudentDashboardData>('/api/v1/dashboards/student'),
};

export default studentDashboardService;
