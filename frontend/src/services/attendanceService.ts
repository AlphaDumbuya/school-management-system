/**
 * Attendance API Service
 * Wraps /api/v1/attendance endpoints with session support
 */

import { apiClient } from '@lib/apiClient';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type SessionType = 'morning' | 'afternoon' | 'full_day';

export interface AttendanceRecord {
  id: string;
  student_id: string;
  class_id: string;
  date: string;
  status: AttendanceStatus;
  session_type?: SessionType;
  check_in_time?: string;
  check_out_time?: string;
  marked_at?: string;
  remarks?: string;
  created_at?: string;
  student_name?: string;
  student_id_code?: string;
  photo_url?: string;
  class_name?: string;
}

export interface ListAttendanceParams {
  page?: number;
  limit?: number;
  studentId?: string;
  classId?: string;
  status?: string;
  date?: string;
  session_type?: SessionType;
  search?: string;
}

export interface BulkAttendanceRecord {
  student_id: string;
  status: AttendanceStatus;
  session_type?: SessionType;
  check_in_time?: string;
  check_out_time?: string;
  remarks?: string;
}

export interface BulkAttendancePayload {
  class_id?: string;
  date: string;
  session_type?: SessionType;
  records: BulkAttendanceRecord[];
}

export interface MyAttendanceResponse {
  student_id: string | null;
  summary: {
    total_days: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
    attendance_percentage: number;
    at_risk: boolean;
  };
  records: Array<{ id: string; class_id?: string; date: string; status: string; remarks?: string }>;
}

export const attendanceService = {
  async listAttendance(params: ListAttendanceParams = {}) {
    return apiClient.get<{ data: AttendanceRecord[]; pagination: any }>(
      '/api/v1/attendance',
      { params }
    );
  },

  /** Attendance for the currently logged-in student (own records only). */
  async getMyAttendance() {
    return apiClient.get<MyAttendanceResponse>('/api/v1/attendance/my');
  },

  async submitBulkAttendance(payload: BulkAttendancePayload) {
    return apiClient.post<{ success: boolean; message: string }>(
      '/api/v1/attendance/bulk',
      payload
    );
  },

  async updateAttendance(id: string, data: { 
    status?: AttendanceStatus; 
    session_type?: SessionType;
    check_in_time?: string;
    check_out_time?: string;
    remarks?: string;
  }) {
    return apiClient.put<{ message: string; attendance: AttendanceRecord }>(
      `/api/v1/attendance/${id}`,
      data
    );
  },

  async getClassAttendanceSummary(classId: string, date?: string, session_type?: SessionType) {
    return apiClient.get<{
      class_id: string;
      class_name: string;
      attendance_records: AttendanceRecord[];
    }>(`/api/v1/attendance/class/${classId}`, {
      params: { date, session_type }
    });
  },
};

export default attendanceService;
