import apiClient from '../lib/apiClient';

export interface PlatformTenant {
  id: string;
  name: string;
  slug: string;
  description?: string;
  domain?: string;
  status: 'active' | 'suspended' | 'trial' | 'expired';
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  timezone?: string;
  currency?: string;
  language?: string;
  max_users?: number;
  max_storage_gb?: number;
  created_at: string;
  updated_at: string;
  stats?: {
    usersCount: number;
    studentsCount: number;
    staffCount: number;
  };
}

export interface PlatformStatistics {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  trialTenants: number;
  totalUsers: number;
  totalStudents: number;
  totalStaff: number;
}

export const platformService = {
  async getStatistics() {
    return apiClient.get<{ success: boolean; data: PlatformStatistics }>('/api/v1/platform/statistics');
  },

  async getTenants(filters?: { status?: string; search?: string; limit?: number; offset?: number }) {
    return apiClient.get<{ success: boolean; data: PlatformTenant[]; total: number }>('/api/v1/platform/tenants', {
      params: filters,
    });
  },

  async getTenant(id: string) {
    return apiClient.get<{ success: boolean; data: PlatformTenant }>(`/api/v1/platform/tenants/${id}`);
  },

  async createTenant(data: any) {
    // Map camelCase/snake_case properly for backend endpoint
    const payload = {
      name: data.name,
      slug: data.slug,
      description: data.description,
      domain: data.domain,
      contactEmail: data.contact_email,
      contactPhone: data.contact_phone,
      address: data.address,
      timezone: data.timezone || 'Africa/Freetown',
      currency: data.currency || 'SLE',
      language: data.language || 'en',
      maxUsers: data.max_users || 500,
      maxStorageGb: data.max_storage_gb || 10,
      adminFirstName: data.adminFirstName,
      adminLastName: data.adminLastName,
      adminEmail: data.adminEmail,
      adminPassword: data.adminPassword,
    };
    return apiClient.post<{ success: boolean; data: PlatformTenant }>('/api/v1/platform/tenants', payload);
  },

  async updateTenant(id: string, data: Partial<PlatformTenant>) {
    return apiClient.put<{ success: boolean; data: PlatformTenant }>(`/api/v1/platform/tenants/${id}`, data);
  },

  async activateTenant(id: string) {
    return apiClient.post<{ success: boolean; data: PlatformTenant; message: string }>(`/api/v1/platform/tenants/${id}/activate`);
  },

  async suspendTenant(id: string, reason: string) {
    return apiClient.post<{ success: boolean; data: PlatformTenant; message: string }>(`/api/v1/platform/tenants/${id}/suspend`, { reason });
  },

  async deleteTenant(id: string) {
    return apiClient.delete<{ success: boolean; message: string }>(`/api/v1/platform/tenants/${id}`);
  },

  async changeTenantSubscription(id: string, planType: string, billingCycle: string) {
    return apiClient.post<{ success: boolean; data: any; message: string }>(`/api/v1/platform/tenants/${id}/subscription`, {
      plan_type: planType,
      billing_cycle: billingCycle,
    });
  },
};

export default platformService;
