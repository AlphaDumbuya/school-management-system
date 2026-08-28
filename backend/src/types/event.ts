/**
 * Type definitions for Events Management Module
 * Phase 2.2
 */

export interface Event {
  event_id: string;
  tenant_id: string;
  title: string;
  description?: string;
  event_type: 'single' | 'multi_day' | 'recurring';
  start_date: Date;
  end_date: Date;
  all_day: boolean;
  location?: string;
  location_type?: 'on_campus' | 'off_campus' | 'virtual';
  venue_details?: string;
  capacity?: number;
  organizer_id: string;
  status: 'draft' | 'published' | 'cancelled' | 'completed';
  visibility: 'public' | 'private' | 'role_specific';
  visible_to_roles?: string[];
  registration_required: boolean;
  registration_deadline?: Date;
  approval_required: boolean;
  allow_guests: boolean;
  max_guests_per_registration: number;
  image_url?: string;
  external_link?: string;
  reminder_enabled: boolean;
  reminder_intervals?: number[];
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  updated_by?: string;
}

export interface EventCategory {
  category_id: string;
  tenant_id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  is_system: boolean;
  display_order: number;
  active: boolean;
  created_at: Date;
}

export interface EventRegistration {
  registration_id: string;
  event_id: string;
  user_id: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'waitlist';
  rsvp_status?: 'going' | 'maybe' | 'not_going';
  guests_count: number;
  registration_data?: Record<string, any>;
  approval_status?: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approved_at?: Date;
  check_in_time?: Date;
  check_out_time?: Date;
  attendance_status?: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface EventRecurrence {
  recurrence_id: string;
  event_id: string;
  parent_event_id?: string;
  recurrence_pattern: 'daily' | 'weekly' | 'monthly' | 'custom';
  recurrence_interval: number;
  recurrence_days?: number[];
  recurrence_end_date?: Date;
  recurrence_count?: number;
  exception_dates?: Date[];
  created_at: Date;
}

export interface EventNotification {
  notification_id: string;
  event_id: string;
  user_id: string;
  notification_type: 'reminder' | 'update' | 'cancellation' | 'confirmation';
  scheduled_time: Date;
  sent: boolean;
  sent_at?: Date;
  channels?: ('email' | 'sms' | 'in_app')[];
  metadata?: Record<string, any>;
  created_at: Date;
}

export interface EventAttendance {
  attendance_id: string;
  event_id: string;
  user_id: string;
  check_in_time?: Date;
  check_out_time?: Date;
  attendance_method?: 'manual' | 'qr_code' | 'automatic';
  marked_by?: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

// DTOs
export interface CreateEventDTO {
  title: string;
  description?: string;
  event_type: 'single' | 'multi_day' | 'recurring';
  start_date: Date;
  end_date: Date;
  all_day?: boolean;
  location?: string;
  location_type?: 'on_campus' | 'off_campus' | 'virtual';
  venue_details?: string;
  capacity?: number;
  organizer_id?: string;
  visibility?: 'public' | 'private' | 'role_specific';
  visible_to_roles?: string[];
  registration_required?: boolean;
  registration_deadline?: Date;
  approval_required?: boolean;
  allow_guests?: boolean;
  max_guests_per_registration?: number;
  image_url?: string;
  external_link?: string;
  reminder_enabled?: boolean;
  reminder_intervals?: number[];
  categories?: string[];
  recurrence?: RecurrencePatternDTO;
  metadata?: Record<string, any>;
}

export interface UpdateEventDTO extends Partial<CreateEventDTO> {}

export interface RecurrencePatternDTO {
  pattern: 'daily' | 'weekly' | 'monthly' | 'custom';
  interval?: number;
  days?: number[];
  end_date?: Date;
  count?: number;
}

export interface RegisterForEventDTO {
  rsvp_status: 'going' | 'maybe' | 'not_going';
  guests_count?: number;
  registration_data?: Record<string, any>;
}

export interface MarkAttendanceDTO {
  user_id: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  check_in_time?: Date;
  notes?: string;
}

export interface EventFilters {
  status?: string;
  event_type?: string;
  category?: string;
  start_date?: Date;
  end_date?: Date;
  organizer_id?: string;
  search?: string;
  visibility?: string;
  page?: number;
  limit?: number;
}

export interface EventStats {
  total_events: number;
  published_events: number;
  upcoming_events: number;
  total_registrations: number;
  total_attendance: number;
  average_attendance_rate: number;
}

export interface CategoryStats {
  category_id: string;
  category_name: string;
  event_count: number;
  total_registrations: number;
  average_attendance: number;
}

export interface CapacityInfo {
  capacity: number;
  registered: number;
  available: number;
  waitlist: number;
  is_full: boolean;
}

export interface AttendanceReport {
  event_id: string;
  event_title: string;
  total_registered: number;
  total_present: number;
  total_absent: number;
  total_late: number;
  total_excused: number;
  attendance_rate: number;
  attendees: Array<{
    user_id: string;
    name: string;
    status: string;
    check_in_time?: Date;
  }>;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
