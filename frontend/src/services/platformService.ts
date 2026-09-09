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
  totalStaff?: number;
  newTenantsThisMonth?: number;
  // Feature adoption (recent features)
  verifiedSchools?: number;
  unverifiedSchools?: number;
  passkeyUsers?: number;
  twoFactorUsers?: number;
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

  /** Read a tenant's transactional email sender config. */
  async getTenantEmailSender(id: string) {
    return apiClient.get<{ success: boolean; data: { mode: 'platform' | 'own'; verified: boolean; fromAddress: string | null; contactEmail: string | null } }>(
      `/api/v1/platform/tenants/${id}/email-sender`
    );
  },

  /** Switch a tenant's email sender mode (after verifying its domain in Brevo). */
  async setTenantEmailSender(id: string, mode: 'platform' | 'own', fromAddress?: string) {
    return apiClient.post<{ success: boolean; message: string; data: any }>(`/api/v1/platform/tenants/${id}/email-sender`, {
      mode,
      fromAddress,
    });
  },

  // ── Restore & school profile ──────────────────────────────────────────────
  async restoreTenant(id: string) {
    return apiClient.post<{ success: boolean; data: PlatformTenant; message: string }>(`/api/v1/platform/tenants/${id}/restore`);
  },
  async getTenantSchoolProfile(id: string) {
    return apiClient.get<{ success: boolean; data: any }>(`/api/v1/platform/tenants/${id}/school-profile`);
  },
  async updateTenantSchoolProfile(id: string, data: Record<string, any>) {
    return apiClient.put<{ success: boolean; data: any }>(`/api/v1/platform/tenants/${id}/school-profile`, data);
  },

  // ── Billing ────────────────────────────────────────────────────────────────
  async getTenantBilling(id: string) {
    return apiClient.get<{ success: boolean; data: { history: any[]; subscription: any } }>(`/api/v1/platform/tenants/${id}/billing`);
  },
  async renewSubscription(id: string, billingCycle: 'monthly' | 'yearly') {
    return apiClient.post<{ success: boolean; data: any; message: string }>(`/api/v1/platform/tenants/${id}/subscription/renew`, { billing_cycle: billingCycle });
  },
  async extendSubscription(id: string, days: number) {
    return apiClient.post<{ success: boolean; data: any; message: string }>(`/api/v1/platform/tenants/${id}/subscription/extend`, { days });
  },
  async expireSubscription(id: string) {
    return apiClient.post<{ success: boolean; data: any; message: string }>(`/api/v1/platform/tenants/${id}/subscription/expire`);
  },

  // ── Tenant users ─────────────────────────────────────────────────────────
  async getTenantUsers(id: string, filters?: { search?: string; role?: string; status?: string }) {
    return apiClient.get<{ success: boolean; data: any[] }>(`/api/v1/platform/tenants/${id}/users`, { params: filters });
  },
  async resetTenantUserPassword(id: string, userId: string) {
    return apiClient.post<{ success: boolean; data: { tempPassword: string; email: string }; message: string }>(`/api/v1/platform/tenants/${id}/users/${userId}/reset-password`);
  },
  async setTenantUserStatus(id: string, userId: string, status: 'active' | 'inactive') {
    return apiClient.post<{ success: boolean; message: string }>(`/api/v1/platform/tenants/${id}/users/${userId}/status`, { status });
  },
  async unlockTenantUser(id: string, userId: string) {
    return apiClient.post<{ success: boolean; message: string }>(`/api/v1/platform/tenants/${id}/users/${userId}/unlock`);
  },
  async disableTenantUser2FA(id: string, userId: string) {
    return apiClient.post<{ success: boolean; message: string }>(`/api/v1/platform/tenants/${id}/users/${userId}/disable-2fa`);
  },

  // ── Impersonation ──────────────────────────────────────────────────────────
  async impersonateTenant(id: string, userId?: string) {
    return apiClient.post<{ success: boolean; data: { access_token: string; user: any }; message: string }>(`/api/v1/platform/tenants/${id}/impersonate`, { userId });
  },

  // ── Audit ────────────────────────────────────────────────────────────────
  async getAudit(filters?: { tenantId?: string; action?: string; limit?: number; offset?: number }) {
    return apiClient.get<{ success: boolean; data: any[] }>(`/api/v1/platform/audit`, { params: filters });
  },

  // ── Communications hub ─────────────────────────────────────────────────────
  async getMessages(filters?: { status?: string; search?: string; limit?: number; offset?: number }) {
    return apiClient.get<{ success: boolean; data: any[]; total: number }>(`/api/v1/platform/communications/messages`, { params: filters });
  },
  async getMessagesUnreadCount() {
    return apiClient.get<{ success: boolean; data: { count: number } }>(`/api/v1/platform/communications/unread-count`);
  },
  async setMessageStatus(id: string, status: 'unread' | 'read' | 'archived') {
    return apiClient.post<{ success: boolean; data: any }>(`/api/v1/platform/communications/messages/${id}/status`, { status });
  },
  async replyMessage(id: string, subject: string, body: string, purpose?: 'info' | 'support' | 'sales') {
    return apiClient.post<{ success: boolean; message: string }>(`/api/v1/platform/communications/messages/${id}/reply`, { subject, body, purpose });
  },
  async deleteMessage(id: string) {
    return apiClient.delete<{ success: boolean; message: string }>(`/api/v1/platform/communications/messages/${id}`);
  },
  async broadcast(data: { subject: string; body: string; audience: 'all' | 'active' | 'trial' | 'suspended'; purpose?: 'info' | 'support' | 'sales' }) {
    return apiClient.post<{ success: boolean; data: { recipients: number; delivered: number }; message: string }>(`/api/v1/platform/communications/broadcast`, data);
  },
  async getBroadcasts() {
    return apiClient.get<{ success: boolean; data: any[] }>(`/api/v1/platform/communications/broadcasts`);
  },

  // ── Newsletter / Marketing ─────────────────────────────────────────────────
  async getSubscribers(filters?: { status?: string; search?: string; limit?: number; offset?: number }) {
    return apiClient.get<{ success: boolean; data: any[]; total: number; counts: { subscribed: number; unsubscribed: number } }>(`/api/v1/platform/newsletter/subscribers`, { params: filters });
  },
  async addSubscriber(email: string, name?: string) {
    return apiClient.post<{ success: boolean; data: any }>(`/api/v1/platform/newsletter/subscribers`, { email, name });
  },
  async setSubscriberStatus(id: string, status: 'subscribed' | 'unsubscribed') {
    return apiClient.post<{ success: boolean; data: any }>(`/api/v1/platform/newsletter/subscribers/${id}/status`, { status });
  },
  async sendCampaign(data: { subject: string; body: string; segment: 'all' | 'tenants' | 'prospects' }) {
    return apiClient.post<{ success: boolean; data: { recipients: number; delivered: number }; message: string }>(`/api/v1/platform/newsletter/campaign`, data);
  },
  async getCampaigns() {
    return apiClient.get<{ success: boolean; data: any[] }>(`/api/v1/platform/newsletter/campaigns`);
  },
};

export default platformService;
