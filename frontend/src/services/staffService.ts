/**
 * Support staff API — /api/v1/staff
 * Security, cleaners, cooks, drivers…: an easy-onboarding staff record with no
 * login. Professional staff (teachers, accountants, admissions officers) use
 * teachersService (/api/v1/teachers) and the full onboarding.
 */
import { apiClient } from '@lib/apiClient';

export type SupportJobType = 'security' | 'cleaner' | 'cook' | 'driver' | 'gardener' | 'maintenance' | 'other';
export type SupportStatus = 'active' | 'inactive' | 'suspended' | 'dismissed';

export const SUPPORT_JOB_LABEL: Record<SupportJobType, string> = {
  security: 'Security',
  cleaner: 'Cleaner',
  cook: 'Cook / Kitchen',
  driver: 'Driver',
  gardener: 'Gardener',
  maintenance: 'Maintenance',
  other: 'Other',
};

export interface SupportStaff {
  id: string;
  staff_id: string;
  first_name: string;
  last_name: string;
  job_type: SupportJobType;
  job_title?: string | null;
  gender?: string | null;
  phone?: string | null;
  address?: string | null;
  photo_url?: string | null;
  hire_date?: string | null;
  employment_type?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  status: SupportStatus;
  notes?: string | null;
  created_at?: string;
}

export type SupportStaffForm = Partial<Omit<SupportStaff, 'id' | 'staff_id' | 'created_at'>>;

export const staffService = {
  list: (params: { job_type?: string; status?: string; search?: string } = {}) =>
    apiClient.get<{ data: SupportStaff[]; stats: Record<string, number> }>('/api/v1/staff', { params }),
  create: (data: SupportStaffForm) => apiClient.post<SupportStaff>('/api/v1/staff', data),
  update: (id: string, data: SupportStaffForm) => apiClient.put<SupportStaff>(`/api/v1/staff/${id}`, data),
};

export default staffService;
