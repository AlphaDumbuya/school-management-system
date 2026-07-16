/**
 * Events Management Service
 * Handles all events API calls
 * Phase 2.2: Events Management Module
 */

import { apiClient } from '@lib/apiClient';
import { ApiResponse, PaginatedResponse } from '@types/index';
import {
    Event,
    EventCategory,
    EventRegistration,
    EventAttendance,
    EventStats,
    OverallStats,
    CategoryStats,
    AttendanceReport,
    CapacityInfo,
    CreateEventDTO,
    UpdateEventDTO,
    RegisterForEventDTO,
    UpdateRegistrationDTO,
    MarkAttendanceDTO,
    BulkAttendanceDTO,
    CreateCategoryDTO,
    UpdateCategoryDTO,
    EventFilters,
    CalendarFilters,
    AnalyticsFilters,
} from '@types/events';

const BASE_PATH = '/api/v1/events';

export const eventsService = {
    // ============================================================================
    // Event Management
    // ============================================================================

    /**
     * Create a new event
     */
    createEvent: async (data: CreateEventDTO): Promise<ApiResponse<Event>> => {
        return apiClient.post<Event>(BASE_PATH, data);
    },

    /**
     * Get event by ID
     */
    getEvent: async (eventId: string): Promise<ApiResponse<Event>> => {
        return apiClient.get<Event>(`${BASE_PATH}/${eventId}`);
    },

    /**
     * List events with filters
     */
    listEvents: async (filters?: EventFilters): Promise<PaginatedResponse<Event>> => {
        const params = new URLSearchParams();
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    params.append(key, String(value));
                }
            });
        }

        const queryString = params.toString();
        const url = queryString ? `${BASE_PATH}?${queryString}` : BASE_PATH;

        return apiClient.get<PaginatedResponse<Event>>(url) as Promise<PaginatedResponse<Event>>;
    },

    /**
     * Update event
     */
    updateEvent: async (
        eventId: string,
        data: UpdateEventDTO
    ): Promise<ApiResponse<Event>> => {
        return apiClient.put<Event>(`${BASE_PATH}/${eventId}`, data);
    },

    /**
     * Delete event
     */
    deleteEvent: async (eventId: string): Promise<ApiResponse<void>> => {
        return apiClient.delete<void>(`${BASE_PATH}/${eventId}`);
    },

    /**
     * Publish event
     */
    publishEvent: async (eventId: string): Promise<ApiResponse<Event>> => {
        return apiClient.post<Event>(`${BASE_PATH}/${eventId}/publish`);
    },

    /**
     * Cancel event
     */
    cancelEvent: async (eventId: string, reason?: string): Promise<ApiResponse<Event>> => {
        return apiClient.post<Event>(`${BASE_PATH}/${eventId}/cancel`, { reason });
    },

    /**
     * Complete event
     */
    completeEvent: async (eventId: string): Promise<ApiResponse<Event>> => {
        return apiClient.post<Event>(`${BASE_PATH}/${eventId}/complete`);
    },

    /**
     * Duplicate event
     */
    duplicateEvent: async (eventId: string): Promise<ApiResponse<Event>> => {
        return apiClient.post<Event>(`${BASE_PATH}/${eventId}/duplicate`);
    },

    /**
     * Get upcoming events
     */
    getUpcomingEvents: async (limit?: number): Promise<ApiResponse<Event[]>> => {
        const url = limit ? `${BASE_PATH}/upcoming?limit=${limit}` : `${BASE_PATH}/upcoming`;
        return apiClient.get<Event[]>(url);
    },

    /**
     * Get user's events (created by user)
     */
    getMyEvents: async (): Promise<ApiResponse<Event[]>> => {
        return apiClient.get<Event[]>(`${BASE_PATH}/my-events`);
    },

    /**
     * Get user's registrations
     */
    getMyRegistrations: async (): Promise<ApiResponse<EventRegistration[]>> => {
        return apiClient.get<EventRegistration[]>(`${BASE_PATH}/my-registrations`);
    },

    // ============================================================================
    // Registration Management
    // ============================================================================

    /**
     * Register for an event
     */
    registerForEvent: async (
        eventId: string,
        data: RegisterForEventDTO
    ): Promise<ApiResponse<EventRegistration>> => {
        return apiClient.post<EventRegistration>(`${BASE_PATH}/${eventId}/register`, data);
    },

    /**
     * Cancel registration
     */
    cancelRegistration: async (eventId: string): Promise<ApiResponse<void>> => {
        return apiClient.delete<void>(`${BASE_PATH}/${eventId}/register`);
    },

    /**
     * Update registration
     */
    updateRegistration: async (
        eventId: string,
        registrationId: string,
        data: UpdateRegistrationDTO
    ): Promise<ApiResponse<EventRegistration>> => {
        return apiClient.put<EventRegistration>(
            `${BASE_PATH}/${eventId}/register/${registrationId}`,
            data
        );
    },

    /**
     * Approve registration
     */
    approveRegistration: async (
        eventId: string,
        registrationId: string
    ): Promise<ApiResponse<EventRegistration>> => {
        return apiClient.post<EventRegistration>(
            `${BASE_PATH}/${eventId}/register/${registrationId}/approve`
        );
    },

    /**
     * Reject registration
     */
    rejectRegistration: async (
        eventId: string,
        registrationId: string,
        reason?: string
    ): Promise<ApiResponse<EventRegistration>> => {
        return apiClient.post<EventRegistration>(
            `${BASE_PATH}/${eventId}/register/${registrationId}/reject`,
            { reason }
        );
    },

    /**
     * Get event registrations
     */
    getEventRegistrations: async (
        eventId: string
    ): Promise<ApiResponse<EventRegistration[]>> => {
        return apiClient.get<EventRegistration[]>(`${BASE_PATH}/${eventId}/registrations`);
    },

    /**
     * Check event capacity
     */
    checkCapacity: async (eventId: string): Promise<ApiResponse<CapacityInfo>> => {
        return apiClient.get<CapacityInfo>(`${BASE_PATH}/${eventId}/capacity`);
    },

    // ============================================================================
    // Attendance Management
    // ============================================================================

    /**
     * Mark attendance for a user
     */
    markAttendance: async (
        eventId: string,
        data: MarkAttendanceDTO
    ): Promise<ApiResponse<EventAttendance>> => {
        return apiClient.post<EventAttendance>(`${BASE_PATH}/${eventId}/attendance`, data);
    },

    /**
     * Bulk mark attendance
     */
    bulkMarkAttendance: async (
        eventId: string,
        attendances: BulkAttendanceDTO[]
    ): Promise<ApiResponse<void>> => {
        return apiClient.post<void>(`${BASE_PATH}/${eventId}/attendance/bulk`, {
            attendances,
        });
    },

    /**
     * Get event attendance
     */
    getEventAttendance: async (
        eventId: string
    ): Promise<ApiResponse<EventAttendance[]>> => {
        return apiClient.get<EventAttendance[]>(`${BASE_PATH}/${eventId}/attendance`);
    },

    /**
     * Generate QR code for attendance
     */
    generateAttendanceQRCode: async (eventId: string): Promise<ApiResponse<string>> => {
        return apiClient.post<string>(`${BASE_PATH}/${eventId}/attendance/qr-code`);
    },

    /**
     * Get attendance report
     */
    getAttendanceReport: async (
        eventId: string
    ): Promise<ApiResponse<AttendanceReport>> => {
        return apiClient.get<AttendanceReport>(`${BASE_PATH}/${eventId}/attendance/report`);
    },

    // ============================================================================
    // Calendar
    // ============================================================================

    /**
     * Get calendar events
     */
    getCalendarEvents: async (filters: CalendarFilters): Promise<ApiResponse<Event[]>> => {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                if (Array.isArray(value)) {
                    params.append(key, value.join(','));
                } else {
                    params.append(key, String(value));
                }
            }
        });

        return apiClient.get<Event[]>(`${BASE_PATH}/calendar?${params.toString()}`);
    },

    // ============================================================================
    // Analytics
    // ============================================================================

    /**
     * Get event statistics
     */
    getEventStats: async (eventId: string): Promise<ApiResponse<EventStats>> => {
        return apiClient.get<EventStats>(`${BASE_PATH}/${eventId}/stats`);
    },

    /**
     * Get overall analytics
     */
    getOverallAnalytics: async (
        filters?: AnalyticsFilters
    ): Promise<ApiResponse<OverallStats>> => {
        const params = new URLSearchParams();
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    params.append(key, String(value));
                }
            });
        }

        const queryString = params.toString();
        const url = queryString
            ? `${BASE_PATH}/analytics?${queryString}`
            : `${BASE_PATH}/analytics`;

        return apiClient.get<OverallStats>(url);
    },

    /**
     * Get popular events
     */
    getPopularEvents: async (limit?: number): Promise<ApiResponse<Event[]>> => {
        const url = limit
            ? `${BASE_PATH}/analytics/popular?limit=${limit}`
            : `${BASE_PATH}/analytics/popular`;
        return apiClient.get<Event[]>(url);
    },

    // ============================================================================
    // Category Management
    // ============================================================================

    /**
     * List all categories
     */
    listCategories: async (): Promise<ApiResponse<EventCategory[]>> => {
        return apiClient.get<EventCategory[]>(`${BASE_PATH}/categories`);
    },

    /**
     * Create category
     */
    createCategory: async (
        data: CreateCategoryDTO
    ): Promise<ApiResponse<EventCategory>> => {
        return apiClient.post<EventCategory>(`${BASE_PATH}/categories`, data);
    },

    /**
     * Update category
     */
    updateCategory: async (
        categoryId: string,
        data: UpdateCategoryDTO
    ): Promise<ApiResponse<EventCategory>> => {
        return apiClient.put<EventCategory>(`${BASE_PATH}/categories/${categoryId}`, data);
    },

    /**
     * Delete category
     */
    deleteCategory: async (categoryId: string): Promise<ApiResponse<void>> => {
        return apiClient.delete<void>(`${BASE_PATH}/categories/${categoryId}`);
    },

    /**
     * Get category statistics
     */
    getCategoryStats: async (): Promise<ApiResponse<CategoryStats[]>> => {
        return apiClient.get<CategoryStats[]>(`${BASE_PATH}/categories/stats`);
    },
};

export default eventsService;
