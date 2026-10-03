/**
 * Events Management Module Types
 * Phase 2.2: Events Management
 */

// ============================================================================
// Core Event Types
// ============================================================================

export type EventType = 'single' | 'multi_day' | 'recurring';
export type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed';
export type EventVisibility = 'public' | 'private' | 'role_specific';
export type LocationType = 'on_campus' | 'off_campus' | 'virtual';
export type RSVPStatus = 'going' | 'maybe' | 'not_going';
export type RegistrationStatus = 'pending' | 'confirmed' | 'cancelled' | 'waitlist';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type AttendanceMethod = 'manual' | 'qr_code' | 'automatic';
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'custom';
export type NotificationType = 'reminder' | 'update' | 'cancellation' | 'confirmation';
export type CalendarView = 'month' | 'week' | 'day';

// ============================================================================
// Event Interfaces
// ============================================================================

export interface Event {
    event_id: string;
    tenant_id: string;
    title: string;
    description?: string;
    event_type: EventType;
    start_date: string; // ISO 8601
    end_date: string; // ISO 8601
    all_day: boolean;
    location?: string;
    location_type?: LocationType;
    venue_details?: string;
    capacity?: number;
    organizer_id: string;
    organizer?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
    };
    status: EventStatus;
    visibility: EventVisibility;
    registration_required: boolean;
    registration_deadline?: string; // ISO 8601
    approval_required: boolean;
    allow_guests: boolean;
    max_guests_per_registration: number;
    image_url?: string;
    external_link?: string;
    reminder_enabled: boolean;
    reminder_intervals?: number[]; // Hours before event
    metadata?: Record<string, any>;
    created_at: string;
    updated_at: string;
    created_by?: string;
    updated_by?: string;

    // Extended fields
    categories?: EventCategory[];
    registrations_count?: number;
    attendance_count?: number;
    is_registered?: boolean;
    user_registration?: EventRegistration;
    recurrence?: EventRecurrence;
}

export interface EventCategory {
    category_id: string;
    tenant_id: string;
    name: string;
    description?: string;
    color?: string; // Hex color
    icon?: string;
    is_system: boolean;
    display_order: number;
    active: boolean;
    created_at: string;
}

export interface EventRegistration {
    registration_id: string;
    event_id: string;
    user_id: string;
    user?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
    };
    status: RegistrationStatus;
    rsvp_status?: RSVPStatus;
    guests_count: number;
    registration_data?: Record<string, any>;
    approval_status?: ApprovalStatus;
    approved_by?: string;
    approved_at?: string;
    check_in_time?: string;
    check_out_time?: string;
    attendance_status?: AttendanceStatus;
    notes?: string;
    created_at: string;
    updated_at: string;
}

export interface EventRecurrence {
    recurrence_id: string;
    event_id: string;
    parent_event_id?: string;
    recurrence_pattern: RecurrencePattern;
    recurrence_interval: number;
    recurrence_days?: number[]; // 0-6 for Sunday-Saturday
    recurrence_end_date?: string;
    recurrence_count?: number;
    exception_dates?: string[]; // ISO 8601 dates
    created_at: string;
}

export interface EventAttendance {
    attendance_id: string;
    event_id: string;
    user_id: string;
    user?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
    };
    check_in_time?: string;
    check_out_time?: string;
    attendance_method: AttendanceMethod;
    marked_by?: string;
    status: AttendanceStatus;
    notes?: string;
    created_at: string;
    updated_at: string;
}

export interface EventNotification {
    notification_id: string;
    event_id: string;
    user_id: string;
    notification_type: NotificationType;
    scheduled_time: string;
    sent: boolean;
    sent_at?: string;
    channels: string[]; // ['email', 'sms', 'in_app']
    metadata?: Record<string, any>;
    created_at: string;
}

// ============================================================================
// Analytics & Statistics
// ============================================================================

export interface EventStats {
    event_id: string;
    total_registrations: number;
    confirmed_registrations: number;
    cancelled_registrations: number;
    waitlist_count: number;
    attendance_count: number;
    attendance_rate: number; // Percentage
    rsvp_going: number;
    rsvp_maybe: number;
    rsvp_not_going: number;
    capacity_utilization: number; // Percentage
    no_show_count: number;
}

export interface CategoryStats {
    category_id: string;
    category_name: string;
    total_events: number;
    upcoming_events: number;
    completed_events: number;
    total_registrations: number;
    average_attendance_rate: number;
}

export interface OverallStats {
    total_events: number;
    upcoming_events: number;
    past_events: number;
    total_registrations: number;
    total_attendees: number;
    average_attendance_rate: number;
    popular_categories: CategoryStats[];
    trends: TrendData[];
}

export interface TrendData {
    date: string;
    events_count: number;
    registrations_count: number;
    attendance_count: number;
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
    attendees: EventAttendance[];
}

export interface CapacityInfo {
    capacity?: number;
    current_registrations: number;
    available_spots?: number;
    is_full: boolean;
    waitlist_count: number;
}

// ============================================================================
// DTO Types (Data Transfer Objects)
// ============================================================================

export interface CreateEventDTO {
    title: string;
    description?: string;
    event_type: EventType;
    start_date: string;
    end_date: string;
    all_day?: boolean;
    location?: string;
    location_type?: LocationType;
    venue_details?: string;
    capacity?: number;
    visibility?: EventVisibility;
    registration_required?: boolean;
    registration_deadline?: string;
    approval_required?: boolean;
    allow_guests?: boolean;
    max_guests_per_registration?: number;
    image_url?: string;
    external_link?: string;
    reminder_enabled?: boolean;
    reminder_intervals?: number[];
    categories?: string[]; // Category IDs
    recurrence?: RecurrenceConfig;
    metadata?: Record<string, any>;
}

export interface UpdateEventDTO extends Partial<CreateEventDTO> {
    status?: EventStatus;
}

export interface RecurrenceConfig {
    pattern: RecurrencePattern;
    interval?: number;
    days?: number[];
    end_date?: string;
    count?: number;
    exception_dates?: string[];
}

export interface RegisterForEventDTO {
    rsvp_status?: RSVPStatus;
    guests_count?: number;
    registration_data?: Record<string, any>;
}

export interface UpdateRegistrationDTO {
    rsvp_status?: RSVPStatus;
    guests_count?: number;
    notes?: string;
}

export interface MarkAttendanceDTO {
    user_id: string;
    status: AttendanceStatus;
    check_in_time?: string;
    check_out_time?: string;
    notes?: string;
}

export interface BulkAttendanceDTO {
    user_id: string;
    status: AttendanceStatus;
}

export interface CreateCategoryDTO {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    display_order?: number;
}

export interface UpdateCategoryDTO extends Partial<CreateCategoryDTO> {
    active?: boolean;
}

// ============================================================================
// Filter & Query Types
// ============================================================================

export interface EventFilters {
    page?: number;
    limit?: number;
    status?: EventStatus;
    event_type?: EventType;
    category?: string; // Category ID
    organizer_id?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
    visibility?: EventVisibility;
    registration_required?: boolean;
    sort_by?: 'start_date' | 'created_at' | 'title';
    sort_order?: 'asc' | 'desc';
}

export interface CalendarFilters {
    start_date: string;
    end_date: string;
    view?: CalendarView;
    categories?: string[];
    status?: EventStatus[];
}

export interface AnalyticsFilters {
    start_date?: string;
    end_date?: string;
    category?: string;
    /** Academic year window (used when no explicit dates are set). */
    academic_year?: string;
}

// ============================================================================
// Component Prop Types
// ============================================================================

export interface EventCreatorProps {
    onSuccess?: (event: Event) => void;
    onCancel?: () => void;
    initialData?: Partial<CreateEventDTO>;
}

export interface EventListProps {
    filters?: EventFilters;
    showFilters?: boolean;
    onEventClick?: (event: Event) => void;
}

export interface EventCardProps {
    event: Event;
    onClick?: () => void;
    showActions?: boolean;
    compact?: boolean;
}

export interface EventDetailsProps {
    eventId: string;
    onUpdate?: () => void;
}

export interface EventCalendarProps {
    filters?: CalendarFilters;
    defaultView?: CalendarView;
    onEventClick?: (event: Event) => void;
    onDateClick?: (date: Date) => void;
}

export interface RSVPButtonProps {
    event: Event;
    onUpdate?: () => void;
}

export interface RegistrationFormProps {
    event: Event;
    onSubmit?: (registration: EventRegistration) => void;
    onCancel?: () => void;
}

export interface AttendanceMarkerProps {
    eventId: string;
    registrations: EventRegistration[];
    onUpdate?: () => void;
}

export interface RecurrenceEditorProps {
    value?: RecurrenceConfig;
    onChange: (config: RecurrenceConfig) => void;
}

export interface CategorySelectorProps {
    selected?: string[];
    onChange: (categoryIds: string[]) => void;
    allowCreate?: boolean;
}

export interface EventAnalyticsProps {
    filters?: AnalyticsFilters;
}
