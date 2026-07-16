/**
 * Timetable API Service
 * Wraps /api/v1/timetable endpoints.
 */

import { apiClient } from '@lib/apiClient';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TimetableSlot {
  id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room_number?: string;
  // Joined fields
  class_name?: string;
  class_level?: string;
  subject_name?: string;
  subject_code?: string;
  subject_category?: string;
  teacher_name?: string;
  created_at: string;
  updated_at?: string;
}

export interface WeeklySchedule {
  class_id: string;
  class_name: string;
  class_level: string;
  weekly: Record<string, TimetableSlot[]>;
  total_slots: number;
}

export interface SlotFormData {
  class_id: string;
  subject_id: string;
  teacher_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room_number?: string;
}

export interface TeacherOption {
  id: string;
  staff_id: string;
  first_name: string;
  last_name: string;
  specialization?: string;
}

export interface ListSlotsParams {
  class_id?: string;
  teacher_id?: string;
  day_of_week?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export const STANDARD_PERIODS = [
  { label: 'Period 1', start: '08:00', end: '08:45' },
  { label: 'Period 2', start: '08:45', end: '09:30' },
  { label: 'Period 3', start: '09:30', end: '10:15' },
  { label: 'Period 4', start: '10:15', end: '11:00' },
  { label: 'Break',    start: '11:00', end: '11:15', isBreak: true },
  { label: 'Period 5', start: '11:15', end: '12:00' },
  { label: 'Period 6', start: '12:00', end: '12:45' },
  { label: 'Lunch',    start: '12:45', end: '13:30', isBreak: true },
  { label: 'Period 7', start: '13:30', end: '14:15' },
  { label: 'Period 8', start: '14:15', end: '15:00' },
];

// ── Service ───────────────────────────────────────────────────────────────────

export const timetableService = {
  /** GET /api/v1/timetable — list slots with optional filters */
  async listSlots(params: ListSlotsParams = {}) {
    return apiClient.get<{ data: TimetableSlot[]; total: number }>(
      '/api/v1/timetable',
      { params }
    );
  },

  /** GET /api/v1/timetable/weekly/:classId — full weekly grid */
  async getWeeklySchedule(classId: string) {
    return apiClient.get<WeeklySchedule>(`/api/v1/timetable/weekly/${classId}`);
  },

  /** GET /api/v1/timetable/teachers — teacher dropdown options */
  async getTeachers() {
    return apiClient.get<{ data: TeacherOption[] }>('/api/v1/timetable/teachers');
  },

  /** POST /api/v1/timetable — create a slot */
  async createSlot(data: SlotFormData) {
    return apiClient.post<TimetableSlot>('/api/v1/timetable', data);
  },

  /** PUT /api/v1/timetable/:id — update a slot */
  async updateSlot(id: string, data: Partial<SlotFormData>) {
    return apiClient.put<TimetableSlot>(`/api/v1/timetable/${id}`, data);
  },

  /** DELETE /api/v1/timetable/:id — delete a slot */
  async deleteSlot(id: string) {
    return apiClient.delete(`/api/v1/timetable/${id}`);
  },
};

export default timetableService;
