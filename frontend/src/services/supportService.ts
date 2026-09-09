/**
 * Support Ticket API Service.
 *
 * Tenant users use /api/v1/support/* (their own tenant's tickets).
 * Super admins use /api/v1/platform/support/* (all tenants, triage).
 */
import { apiClient } from '@lib/apiClient';

export type TicketStatus = 'open' | 'in-progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface SupportTicket {
  id: string;
  reference?: string;
  tenantId?: string;
  tenantName?: string;
  requesterName?: string;
  requesterEmail?: string;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  category: string;
  assignedTo?: string;
  resolution?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface TicketResponse {
  id: string;
  ticketId: string;
  responderId: string;
  message: string;
  isPublic: boolean;
  createdAt: string;
}

export const TICKET_CATEGORIES = [
  'Technical Issue',
  'Billing',
  'Account',
  'Feature Request',
  'How-to / Guidance',
  'Other',
];

export const TICKET_PRIORITIES: { value: TicketPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export const TICKET_STATUSES: { value: TicketStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export const supportService = {
  // ── Tenant user ───────────────────────────────────────────────────────────
  listMyTickets(params?: { status?: string; priority?: string }) {
    return apiClient.get<{ success: boolean; data: SupportTicket[] }>('/api/v1/support/tickets', { params });
  },
  getMyTicket(id: string) {
    return apiClient.get<{ success: boolean; data: SupportTicket }>(`/api/v1/support/tickets/${id}`);
  },
  createTicket(data: { subject: string; description: string; category: string; priority?: TicketPriority }) {
    return apiClient.post<{ success: boolean; data: SupportTicket }>('/api/v1/support/tickets', data);
  },
  getResponses(id: string) {
    return apiClient.get<{ success: boolean; data: TicketResponse[] }>(`/api/v1/support/tickets/${id}/responses`);
  },
  reply(id: string, message: string) {
    return apiClient.post<{ success: boolean; data: TicketResponse }>(`/api/v1/support/tickets/${id}/responses`, { message, isPublic: true });
  },

  // ── Super admin (platform triage) ───────────────────────────────────────────
  listAllTickets(params?: { status?: string; priority?: string; search?: string }) {
    return apiClient.get<{ success: boolean; data: SupportTicket[] }>('/api/v1/platform/support/tickets', { params });
  },
  getAdminTicket(id: string) {
    return apiClient.get<{ success: boolean; data: { ticket: SupportTicket; responses: TicketResponse[] } }>(`/api/v1/platform/support/tickets/${id}`);
  },
  adminReply(id: string, message: string) {
    return apiClient.post<{ success: boolean; data: TicketResponse }>(`/api/v1/platform/support/tickets/${id}/reply`, { message });
  },
  adminSetStatus(id: string, status: TicketStatus, resolution?: string) {
    return apiClient.patch<{ success: boolean; data: SupportTicket }>(`/api/v1/platform/support/tickets/${id}/status`, { status, resolution });
  },
};

export default supportService;
