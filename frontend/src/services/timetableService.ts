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

/** Period structure varies by school level */
export type SchoolLevel = 'nursery' | 'primary' | 'jss' | 'sss';

export interface PeriodDefinition {
  label: string;
  start: string;
  end: string;
  isBreak?: boolean;
}

/** Nursery: 8:00–12:30, 30 min activities, half day */
const NURSERY_PERIODS: PeriodDefinition[] = [
  { label: 'Activity 1', start: '08:00', end: '08:30' },
  { label: 'Activity 2', start: '08:30', end: '09:00' },
  { label: 'Activity 3', start: '09:00', end: '09:30' },
  { label: 'Activity 4', start: '09:30', end: '10:00' },
  { label: 'Snack Break', start: '10:00', end: '10:30', isBreak: true },
  { label: 'Activity 5', start: '10:30', end: '11:00' },
  { label: 'Activity 6', start: '11:00', end: '11:30' },
  { label: 'Activity 7', start: '11:30', end: '12:00' },
  { label: 'Closing', start: '12:00', end: '12:30', isBreak: true },
];

/** Primary: 8:00–14:00, 35 min periods, 7 periods */
const PRIMARY_PERIODS: PeriodDefinition[] = [
  { label: 'Period 1', start: '08:00', end: '08:35' },
  { label: 'Period 2', start: '08:35', end: '09:10' },
  { label: 'Period 3', start: '09:10', end: '09:45' },
  { label: 'Period 4', start: '09:45', end: '10:20' },
  { label: 'Break', start: '10:20', end: '10:45', isBreak: true },
  { label: 'Period 5', start: '10:45', end: '11:20' },
  { label: 'Period 6', start: '11:20', end: '11:55' },
  { label: 'Lunch', start: '11:55', end: '12:30', isBreak: true },
  { label: 'Period 7', start: '12:30', end: '13:05' },
  { label: 'Period 8', start: '13:05', end: '13:40' },
];

/** JSS: 8:00–14:30, 40 min periods, 8 periods */
const JSS_PERIODS: PeriodDefinition[] = [
  { label: 'Period 1', start: '08:00', end: '08:40' },
  { label: 'Period 2', start: '08:40', end: '09:20' },
  { label: 'Period 3', start: '09:20', end: '10:00' },
  { label: 'Break', start: '10:00', end: '10:20', isBreak: true },
  { label: 'Period 4', start: '10:20', end: '11:00' },
  { label: 'Period 5', start: '11:00', end: '11:40' },
  { label: 'Period 6', start: '11:40', end: '12:20' },
  { label: 'Lunch', start: '12:20', end: '13:00', isBreak: true },
  { label: 'Period 7', start: '13:00', end: '13:40' },
  { label: 'Period 8', start: '13:40', end: '14:20' },
];

/** SSS: 8:00–15:00, 45 min periods, 8 periods */
const SSS_PERIODS: PeriodDefinition[] = [
  { label: 'Period 1', start: '08:00', end: '08:45' },
  { label: 'Period 2', start: '08:45', end: '09:30' },
  { label: 'Period 3', start: '09:30', end: '10:15' },
  { label: 'Period 4', start: '10:15', end: '11:00' },
  { label: 'Break', start: '11:00', end: '11:15', isBreak: true },
  { label: 'Period 5', start: '11:15', end: '12:00' },
  { label: 'Period 6', start: '12:00', end: '12:45' },
  { label: 'Lunch', start: '12:45', end: '13:30', isBreak: true },
  { label: 'Period 7', start: '13:30', end: '14:15' },
  { label: 'Period 8', start: '14:15', end: '15:00' },
];

/** All period definitions keyed by level */
export const PERIOD_STRUCTURES: Record<SchoolLevel, PeriodDefinition[]> = {
  nursery: NURSERY_PERIODS,
  primary: PRIMARY_PERIODS,
  jss: JSS_PERIODS,
  sss: SSS_PERIODS,
};

/** Legacy constant for backward compat */
export const STANDARD_PERIODS = SSS_PERIODS;

/** Determine school level from class level string */
export function getSchoolLevel(classLevel: string): SchoolLevel {
  if (!classLevel) return 'sss';
  const upper = classLevel.toUpperCase();
  if (upper.startsWith('NURSERY')) return 'nursery';
  if (upper.startsWith('CLASS') || upper.startsWith('PRIMARY')) return 'primary';
  if (upper.startsWith('JSS')) return 'jss';
  if (upper.startsWith('SSS')) return 'sss';
  return 'sss'; // fallback
}

/** Get custom periods for level (or fallback to system defaults) */
export function getCustomPeriods(level: SchoolLevel): PeriodDefinition[] {
  try {
    const raw = localStorage.getItem(`wiskul_period_config_${level}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    // fallback
  }
  return PERIOD_STRUCTURES[level] || SSS_PERIODS;
}

/** Save custom periods for level */
export function saveCustomPeriods(level: SchoolLevel, periods: PeriodDefinition[]): void {
  localStorage.setItem(`wiskul_period_config_${level}`, JSON.stringify(periods));
}

/** Reset custom periods for level */
export function resetPeriodsToDefault(level: SchoolLevel): void {
  localStorage.removeItem(`wiskul_period_config_${level}`);
}

/** Helper interface for period auto-generator */
export interface GeneratePeriodsOptions {
  startTime: string;
  periodDuration: number;
  totalPeriods: number;
  includeBreak?: boolean;
  breakAfterPeriod?: number;
  breakDurationMinutes?: number;
  includeLunch?: boolean;
  lunchAfterPeriod?: number;
  lunchDurationMinutes?: number;
}

/** Auto-generate consecutive period time slots */
export function generatePeriodsSchedule(opts: GeneratePeriodsOptions): PeriodDefinition[] {
  const result: PeriodDefinition[] = [];
  const [startH, startM] = opts.startTime.split(':').map(Number);
  let currentMinutes = startH * 60 + startM;

  const formatTime = (totalM: number) => {
    const h = Math.floor(totalM / 60) % 24;
    const m = totalM % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  let teachingCount = 0;

  for (let i = 1; i <= opts.totalPeriods; i++) {
    teachingCount++;
    const startStr = formatTime(currentMinutes);
    currentMinutes += opts.periodDuration;
    const endStr = formatTime(currentMinutes);

    result.push({
      label: `Period ${teachingCount}`,
      start: startStr,
      end: endStr,
      isBreak: false,
    });

    // Check Morning Break
    if (opts.includeBreak && teachingCount === (opts.breakAfterPeriod || 4)) {
      const bStartStr = formatTime(currentMinutes);
      currentMinutes += opts.breakDurationMinutes || 15;
      const bEndStr = formatTime(currentMinutes);
      result.push({
        label: 'Short Break',
        start: bStartStr,
        end: bEndStr,
        isBreak: true,
      });
    }

    // Check Lunch Break
    if (opts.includeLunch && teachingCount === (opts.lunchAfterPeriod || 6)) {
      const lStartStr = formatTime(currentMinutes);
      currentMinutes += opts.lunchDurationMinutes || 30;
      const lEndStr = formatTime(currentMinutes);
      result.push({
        label: 'Lunch Break',
        start: lStartStr,
        end: lEndStr,
        isBreak: true,
      });
    }
  }

  return result;
}

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
