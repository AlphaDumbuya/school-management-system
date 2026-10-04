/**
 * Attendance API Service
 * Wraps /api/v1/attendance endpoints with session support
 */

import { apiClient } from '@lib/apiClient';
import useAuthStore from '@store/authStore';
import { attendanceRepo } from '../offline/repositories/attendanceRepo';

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
  check_in_time?: string | null;
  check_out_time?: string | null;
  marked_at?: string | null;
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
  /** Canonical YYYY/YYYY — only that year's classes. */
  academic_year?: string;
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
  records: Array<{ id: string; class_id?: string; date: string; status: string; session_type?: SessionType; check_in_time?: string | null; check_out_time?: string | null; marked_at?: string | null; remarks?: string }>;
}

export const attendanceService = {
  async listAttendance(params: ListAttendanceParams = {}) {
    return apiClient.get<{ data: AttendanceRecord[]; pagination: any }>(
      '/api/v1/attendance',
      { params }
    );
  },

  /** Attendance for the currently logged-in student (own records only). */
  async getMyAttendance(academicYear?: string) {
    return apiClient.get<MyAttendanceResponse>('/api/v1/attendance/my', {
      params: { academic_year: academicYear || undefined },
    });
  },

  async submitBulkAttendance(payload: BulkAttendancePayload) {
    // Offline-first: for teachers with no connectivity, queue each mark locally
    // (Dexie + outbox) and report success. The sync engine flushes on reconnect.
    const user = useAuthStore.getState().user;
    if (!navigator.onLine && user?.role === 'teacher') {
      for (const rec of payload.records) {
        await attendanceRepo.mark(user.id, {
          studentId: rec.student_id,
          classId: payload.class_id,
          date: payload.date,
          sessionType: (rec.session_type || payload.session_type) as string | undefined,
          status: rec.status,
          checkInTime: rec.check_in_time,
          checkOutTime: rec.check_out_time,
          remarks: rec.remarks,
        });
      }
      return { success: true, message: `Saved ${payload.records.length} record(s) offline — will sync when you reconnect.`, offline: true } as { success: boolean; message: string; offline?: boolean };
    }
    return apiClient.post<{ success: boolean; message: string; offline?: boolean }>(
      '/api/v1/attendance/bulk',
      payload
    );
  },

  async updateAttendance(id: string, data: { 
    status?: AttendanceStatus; 
    session_type?: SessionType;
    check_in_time?: string | null;
    check_out_time?: string | null;
    remarks?: string;
  }) {
    return apiClient.put<{ message: string; attendance: AttendanceRecord }>(
      `/api/v1/attendance/${id}`,
      data
    );
  },

  /** Server-computed attendance analytics (totals, rate, at-risk, per-class). */
  async getAnalytics(classId?: string, academicYear?: string) {
    return apiClient.get<{
      success: boolean;
      data: {
        total: number; present: number; late: number; absent: number; excused: number; rate: number;
        atRisk: { name: string; admissionNo: string; rate: number; total: number; p: number }[];
        classRates: { name: string; rate: number; total: number }[];
      };
    }>('/api/v1/attendance/analytics', { params: { classId, academic_year: academicYear } });
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
