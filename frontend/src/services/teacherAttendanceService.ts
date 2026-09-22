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

function requireData<T>(response: { success: boolean; data?: T; error?: string }): T {
  if (!response.success || !response.data) throw new Error(response.error || 'Unable to load teacher attendance');
  return response.data;
}

export const teacherAttendanceService = {
  async getRoster(date: string) {
    return requireData(await apiClient.get<{ date: string; teachers: TeacherAttendanceRow[] }>(
      '/api/v1/attendance/teachers/roster', { params: { date } },
    ));
  },
  async getMyAttendance() {
    return requireData(await apiClient.get<{ today: string; records: TeacherAttendanceHistory[] }>(
      '/api/v1/attendance/teachers/my',
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
