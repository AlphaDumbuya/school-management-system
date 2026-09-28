import { apiClient } from '@lib/apiClient';

export interface SchoolInfo {
  school_id: string;
  tenant_id: string;
  name: string;
  short_name?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  logo_url?: string;
  motto?: string;
  founded_year?: number;
  principal_name?: string;
  principal_email?: string;
  school_registration_number?: string;
  emis_code?: string;
  accreditation_status?: string;
  timezone?: string;
  language_preference?: string;
  /** School level: "Primary", "Secondary (JSS & SSS)", "Primary & Secondary", … */
  school_type?: string;
}

export interface GradeEntry {
  grade: string;
  min_score: number;
  max_score: number;
  grade_points: number;
  description?: string;
}

export interface GradeScale {
  scale_id?: string;
  name: string;
  description?: string;
  scale_type: 'letter' | 'numeric' | 'percentage' | 'point';
  min_value: number;
  max_value: number;
  is_default: boolean;
  is_active: boolean;
  grades: GradeEntry[];
}

export interface BillingInvoice {
  id: string;
  tenant_id: string;
  subscription_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  transaction_id: string;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  billing_date: string;
  due_date: string;
  paid_date?: string;
  notes?: string;
}

export interface SubscriptionInfo {
  id: string;
  tenant_id: string;
  plan_type: 'freetong' | 'combra' | 'bintumani';
  status: 'active' | 'suspended' | 'expired' | 'cancelled';
  start_date: string;
  end_date: string | null;
  monthly_price: number;
  max_users: number;
  max_students: number;
  max_storage_gb: number;
  features: Record<string, boolean>;
  is_trial?: boolean;
  is_comp?: boolean;
  comp_reason?: string | null;
}

export interface SubscriptionDetails {
  subscription: SubscriptionInfo;
  usage: {
    students: { current: number; max: number };
    staff: { current: number; max: number };
  };
}

export const schoolConfigService = {
  async getSchoolInfo() {
    return apiClient.get<SchoolInfo>('/api/v1/school-config/info');
  },

  async updateSchoolInfo(data: Partial<SchoolInfo>) {
    return apiClient.put<{ message: string; data: SchoolInfo }>('/api/v1/school-config/info', data);
  },

  async getSettings() {
    return apiClient.get<Record<string, any>>('/api/v1/school-config/settings');
  },

  /** Get a single setting by key from the school's settings map. */
  async getSetting(key: string) {
    const res = await apiClient.get<Record<string, any>>('/api/v1/school-config/settings');
    const data = (res as any)?.data ?? res ?? {};
    return data?.[key] ?? null;
  },

  /** Update a single setting by key. */
  async updateSetting(key: string, value: any) {
    return apiClient.post<{ message: string }>('/api/v1/school-config/settings', { [key]: value });
  },

  async updateSettings(settings: Record<string, any>) {
    return apiClient.post<{ message: string }>('/api/v1/school-config/settings', settings);
  },

  /**
   * Start a new academic year (non-destructive rollover): archives the current
   * session, activates/creates the new one, and optionally clones classes.
   */
  async startNewAcademicYear(payload: {
    new_year_name: string;
    start_date?: string | null;
    end_date?: string | null;
    clone_classes?: boolean;
  }) {
    return apiClient.post<{
      message: string;
      data: {
        sessionId: string;
        created: boolean;
        classesCloned: number;
        classesSkipped: number;
        previousYearName: string | null;
      };
    }>('/api/v1/school-config/start-new-year', payload);
  },

  async getGradingScales() {
    return apiClient.get<GradeScale[]>('/api/v1/school-config/grading-scales');
  },

  async saveGradingScale(scale: GradeScale) {
    return apiClient.post<{ message: string; data: GradeScale }>('/api/v1/school-config/grading-scales', scale);
  },

  async deleteGradingScale(scaleId: string) {
    return apiClient.delete<{ message: string }>(`/api/v1/school-config/grading-scales/${scaleId}`);
  },

  async getActiveSubscription() {
    return apiClient.get<SubscriptionDetails>('/api/v1/school-config/subscription/active');
  },

  async changePlan(planType: 'freetong' | 'combra' | 'bintumani', billingCycle: 'monthly' | 'yearly') {
    // Returns an in-app USSD payment code — the plan activates only after the
    // platform-account payment is confirmed via webhook (never a free upgrade).
    return apiClient.post<{ message: string; data: { sessionId: string; ussdCode: string | null; amount: number; expireTime: string | null } }>(
      '/api/v1/school-config/subscription/change-plan',
      { plan_type: planType, billing_cycle: billingCycle }
    );
  },

  /** Poll a subscription payment session after returning from Monime. */
  async getSubscriptionCheckoutStatus(sessionId: string) {
    return apiClient.get<{ status: string; planType: string }>(
      `/api/v1/school-config/subscription/checkout/${sessionId}`
    );
  },

  // ── Monime payment credentials (school's OWN account for fee collection) ──
  async getMonimeConfig() {
    return apiClient.get<{ configured: boolean; spaceId: string | null; tokenMasked: string | null }>(
      '/api/v1/school-config/monime'
    );
  },

  async saveMonimeConfig(payload: { accessToken?: string; spaceId?: string; enabled?: boolean }) {
    return apiClient.post<{ message: string; data: { configured: boolean; spaceId: string | null; tokenMasked: string | null } }>(
      '/api/v1/school-config/monime',
      payload
    );
  },

  async getBillingHistory() {
    return apiClient.get<BillingInvoice[]>('/api/v1/school-config/subscription/billing');
  },

  async getSubscriptionAIAnalysis() {
    return apiClient.get<{
      healthStatus: 'healthy' | 'warning' | 'critical';
      summary: string;
      insights: string[];
      recommendations: string[];
    }>('/api/v1/school-config/subscription/ai-analysis');
  },
};

export default schoolConfigService;
