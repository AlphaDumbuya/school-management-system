import { apiClient } from '@lib/apiClient';
import type { AttendanceStatus } from './attendanceService';

export interface TeacherAttendanceMark {
  id: string;
  teacher_id: string;
  status: AttendanceStatus;
  remarks: string | null;
  marked_at: string;
  marked_by: string;
  signed_in_at: string | null;
  signed_out_at: string | null;
  sign_in_comment: string | null;
  sign_out_comment: string | null;
}

export interface TeacherAttendanceRow {
  id: string;
  staff_code: string;
  first_name: string;
  last_name: string;
  designation?: string;
  department?: string;
  /** false = left/deactivated, listed only because they have a record that day. */
  is_active?: boolean;
  attendance: TeacherAttendanceMark | null;
}

export interface TeacherAttendanceHistory {
  id: string;
  date: string;
  status: AttendanceStatus;
  remarks: string | null;
  marked_at: string;
  marked_by: string;
  signed_in_at: string | null;
  signed_out_at: string | null;
  sign_in_comment: string | null;
  sign_out_comment: string | null;
}

export interface TeacherAttendanceStats {
  total: number; present: number; late: number; absent: number; excused: number; rate: number;
}

function requireData<T>(response: { success: boolean; data?: T; error?: string }): T {
  if (!response.success || !response.data) throw new Error(response.error || 'Unable to load teacher attendance');
  return response.data;
}

export const teacherAttendanceService = {
  async getRoster(date: string) {
    return requireData(await apiClient.get<{ date: string; read_only?: boolean; teachers: TeacherAttendanceRow[] }>(
      '/api/v1/attendance/teachers/roster', { params: { date } },
    ));
  },
  /** Own history; with a year, that academic year's records + summary. */
  async getMyAttendance(academicYear?: string) {
    return requireData(await apiClient.get<{ today: string; records: TeacherAttendanceHistory[]; stats?: TeacherAttendanceStats }>(
      '/api/v1/attendance/teachers/my', { params: { academic_year: academicYear || undefined } },
    ));
  },
  async checkIn({ status, comment }: { status: 'present' | 'late'; comment: string }) {
    return requireData(await apiClient.post<{ id: string; date: string; status: AttendanceStatus; signed_in_at: string }>(
      '/api/v1/attendance/teachers/check-in', { status, comment },
    ));
  },
  async signOut(comment: string) {
    return requireData(await apiClient.post<TeacherAttendanceHistory>(
      '/api/v1/attendance/teachers/sign-out', { comment },
    ));
  },
  async saveMark(teacherId: string, date: string, status: AttendanceStatus, remarks: string) {
    return requireData(await apiClient.put<TeacherAttendanceMark>(
      `/api/v1/attendance/teachers/${teacherId}/${date}`, { status, remarks },
    ));
  },
};
