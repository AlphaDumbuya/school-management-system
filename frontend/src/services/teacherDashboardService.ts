/**
 * Teacher Dashboard API Service — wraps /api/v1/dashboards/teacher
 */

import { apiClient } from '@lib/apiClient';

export interface TeacherClass {
  id: string;
  name: string;
  level: string;
  section?: string;
  room?: string;
  student_count: number;
  subjects: string[];
  is_class_teacher: boolean;
  class_teacher_name: string | null;
  status: string;
}

export interface TeacherScheduleSlot {
  id: string;
  class_id: string;
  class_name: string;
  subject_name: string;
  start_time: string;
  end_time: string;
  room?: string;
}

export interface TeacherActivity {
  type: 'attendance' | 'grade' | string;
  message: string;
  timestamp: string;
}

export interface TeacherDashboardData {
  teacher_profile_missing?: boolean;
  stats: {
    total_classes: number;
    total_students: number;
    total_subjects: number;
    classes_today: number;
  };
  classes: TeacherClass[];
  today_schedule: TeacherScheduleSlot[];
  recent_activity: TeacherActivity[];
}

export const teacherDashboardService = {
  getDashboard: () =>
    apiClient.get<TeacherDashboardData>('/api/v1/dashboards/teacher'),
};

export default teacherDashboardService;
