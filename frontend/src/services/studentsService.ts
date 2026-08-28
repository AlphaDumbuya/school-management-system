/**
 * Students API Service
 * Wraps /api/v1/students endpoints.
 */

import { apiClient } from '@lib/apiClient';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StudentRecord {
  id: string;
  student_id: string; // admission/roll number
  first_name: string;
  last_name: string;
  email?: string;
  date_of_birth?: string;
  gender?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  status: 'active' | 'inactive' | 'suspended' | 'graduated';
  enrollment_date?: string;
  photo_url?: string;
  religion?: string;
  nationality?: string;
  place_of_birth?: string;
  guardian_name?: string;
  guardian_phone?: string;
  guardian_relationship?: string;
  guardian_occupation?: string;
  emergency_contact?: string;
  previous_school?: string;
  medical_conditions?: string;
  class_name?: string;
  class_level?: string;
  created_at: string;
}

export interface StudentFormData {
  first_name: string;
  last_name: string;
  email?: string;
  date_of_birth?: string;
  gender?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  status?: string;
  enrollment_date?: string;
  photo_url?: string;
  // Guardian / parent
  guardian_name?: string;
  guardian_email?: string;
  guardian_phone?: string;
  guardian_relationship?: string;
  guardian_occupation?: string;
}

export interface GuardianLookupResult {
  success: boolean;
  found: boolean;
  parent?: {
    user_id: string | null;
    has_account: boolean;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  };
  children?: Array<{ student_id: string; reg_id: string; name: string }>;
  children_count?: number;
}

export interface ListStudentsParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const studentsService = {
  async listStudents(params: ListStudentsParams = {}) {
    return apiClient.get<{ data: StudentRecord[]; pagination: any }>(
      '/api/v1/students',
      { params }
    );
  },

  async getStudent(id: string) {
    return apiClient.get<StudentRecord>(`/api/v1/students/${id}`);
  },

  /** Detect whether a parent already exists for the given guardian email/phone. */
  async guardianLookup(params: { email?: string; phone?: string }) {
    // Routed via /guardians mount (not /students) to avoid the /:studentId
    // param route in studentRoutes capturing "guardian-lookup".
    return apiClient.get<GuardianLookupResult>('/api/v1/guardians/guardian-lookup', { params });
  },

  async createStudent(data: StudentFormData) {
    return apiClient.post<StudentRecord>('/api/v1/students', data);
  },

  async updateStudent(id: string, data: Partial<StudentFormData>) {
    return apiClient.put<StudentRecord>(`/api/v1/students/${id}`, data);
  },

  async deactivateStudent(id: string) {
    return apiClient.delete(`/api/v1/students/${id}`);
  },

  async deleteStudent(id: string) {
    return apiClient.delete(`/api/v1/students/${id}/permanent`);
  },

  async createParentAccount(studentId: string, data: { email: string; first_name?: string; last_name?: string; phone?: string; relationship?: string; password?: string }) {
    return apiClient.post<{ success: boolean; message: string; user: any; temporary_password?: string }>(`/api/v1/students/${studentId}/parent-account`, data);
  },

  async reactivateStudent(id: string) {
    return apiClient.post(`/api/v1/students/${id}/reactivate`);
  },

  async getStudentAttendance(studentId: string) {
    return apiClient.get<{
      summary: {
        total_days: number;
        present_count: number;
        late_count: number;
        absent_count: number;
        excused_count: number;
        attendance_percentage: number;
        at_risk: boolean;
      };
      records: Array<{
        id: string;
        date: string;
        status: 'present' | 'absent' | 'late' | 'excused';
        remarks?: string;
      }>;
    }>(`/api/v1/attendance/student/${studentId}`);
  },

  async getStudentFees(studentId: string) {
    return apiClient.get<{
      success: boolean;
      data: Array<{
        id: string;
        type: string;
        amount: number;
        dueDate: string;
        status: 'paid' | 'unpaid' | 'partially_paid';
        description?: string;
      }>;
    }>(`/api/v1/students/${studentId}/fees`);
  },

  async getStudentOutstanding(studentId: string) {
    return apiClient.get<{
      success: boolean;
      data: {
        studentId: string;
        outstandingBalance: number;
      };
    }>(`/api/v1/students/${studentId}/outstanding`);
  },

  async getStudentInvoices(studentId: string) {
    return apiClient.get<{
      success: boolean;
      data: Array<{
        id: string;
        invoiceNumber: string;
        amount: number;
        paidAmount: number;
        dueDate: string;
        status: 'paid' | 'unpaid' | 'partially_paid';
        issueDate: string;
      }>;
    }>(`/api/v1/students/${studentId}/invoices`);
  },

  async getStudentPayments(studentId: string) {
    return apiClient.get<{
      success: boolean;
      data: Array<{
        id: string;
        amount: number;
        paymentDate: string;
        paymentMethod: string;
        reference?: string;
        notes?: string;
      }>;
    }>(`/api/v1/students/${studentId}/payments`);
  },
};

export default studentsService;
