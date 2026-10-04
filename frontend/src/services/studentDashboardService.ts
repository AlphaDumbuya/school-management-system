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
  /** The class the result was recorded in (a year can have more than one). */
  class_id?: string;
  class_name?: string;
  /** That class's academic-year string (for the class ranking lookup). */
  class_year?: string;
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
  /** The year this payload is for, and the school's current year. */
  academic_year?: string;
  active_year?: string;
  viewing_past?: boolean;
  year_exists?: boolean;
  /** False when the student had no class in the selected year. */
  enrolled_in_year?: boolean;
  /** Set right after a rollover while the student is still in last year's class. */
  pending_transition?: { fromYear: string; className: string } | null;
  /** Finished SSS 3 and left the school: last class + year. */
  graduated?: { year: string; className: string } | null;
  results_published?: boolean;
  /** Every class the student was in that year (newest first). */
  year_classes?: { id: string; name: string; status: string }[];
  /** The class the weekly timetable belongs to. */
  timetable_class?: { id: string; name: string } | null;
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
  /** The selected year's fees; `other_years_outstanding` = arrears from other years. */
  fees: {
    total: number;
    paid: number;
    outstanding: number;
    other_years_outstanding?: number;
    /** Which other years still owe, oldest first. */
    other_years?: { academic_year: string; outstanding: number }[];
    invoices: StudentInvoice[];
  };
}

export const studentDashboardService = {
  /** The student's dashboard for one academic year (default = the active year). */
  getDashboard: (academicYear?: string) =>
    apiClient.get<StudentDashboardData>('/api/v1/dashboards/student', {
      params: { academic_year: academicYear || undefined },
    }),
};

export default studentDashboardService;
