import { apiClient } from '@lib/apiClient';
import useAuthStore from '@store/authStore';

// ── Device copy of the school's academic sessions (for offline year filters) ──
export interface CachedSession { id: string; name: string; is_active: boolean }

const sessionsKey = () => {
  const u: any = useAuthStore.getState().user;
  return `wiskul.sessions.${u?.tenantId ?? u?.tenant_id ?? 'none'}`;
};

/** Canonical "YYYY/YYYY" (accepts YYYY-YYYY); anything else is returned trimmed. */
const canonYear = (v: string) => {
  const s = String(v ?? '').trim();
  const m = /^(\d{4})[-/](\d{4})$/.exec(s);
  return m ? `${m[1]}/${m[2]}` : s;
};

function rememberAcademicSessions(list: Array<{ id: string; name: string; is_active: boolean }>) {
  try {
    const slim: CachedSession[] = list.map((s) => ({ id: String(s.id), name: canonYear(s.name), is_active: !!s.is_active }));
    localStorage.setItem(sessionsKey(), JSON.stringify(slim));
  } catch { /* storage unavailable — offline year filtering degrades gracefully */ }
}

/** The school's sessions as last seen online on this device (tenant-scoped). */
export function getCachedAcademicSessions(): CachedSession[] {
  try {
    const raw = localStorage.getItem(sessionsKey());
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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

/** What a year rollover carried into the new year. */
export interface CarryForwardCounts {
  classesCloned: number;
  classesSkipped: number;
  subjectsCopied: number;
  assignmentsCopied: number;
  timetableCopied: number;
  feeStructuresCopied: number;
  studentsMoved: number;
}

/** One student's record across every academic year (Academic Archive). */
export interface StudentHistory {
  student: {
    id: string; name: string; admission_no: string | null;
    photo_url?: string | null; status?: string | null; gender?: string | null;
    date_of_birth?: string | null; enrollment_date?: string | null; current_class?: string | null;
  } | null;
  /** Several students matched a name search — pick one. */
  matches?: Array<{ id: string; name: string; admission_no: string | null; class_name: string | null }>;
  years?: Array<{
    academic_year: string;
    attendance: { present: number; late: number; absent: number; excused: number; rate: number | null };
    fees: { billed: number; paid: number; outstanding: number };
  }>;
  enrollments: Array<{ class_id: string | null; class_name: string | null; level: string | null; academic_year: string | null; status: string | null; enrollment_date: string | null }>;
  terms: Array<{ academic_year: string; term: string; class_name: string | null; percentage: number | null; position: number | null; class_size: number | null }>;
  results: Array<{ academic_year: string; term: string; subject_name: string | null; mean: number | null }>;
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
   * List the tenant's real academic sessions (years), newest/active first.
   * Drives year pickers so admins can reach ANY past year with data.
   */
  async listAcademicSessions() {
    const res = await apiClient.get<Array<{ id: string; name: string; start_date: string; end_date: string; is_active: boolean }>>(
      '/api/v1/school-config/academic-sessions',
    );
    // Remember the sessions on this device so offline caches (e.g. the
    // teacher's class roster) can still be filtered by academic year.
    const list = (res as any)?.data;
    if ((res as any)?.success !== false && Array.isArray(list)) rememberAcademicSessions(list);
    return res;
  },

  /** Full read-only snapshot of one academic year (Academic Archive page). */
  async getYearArchive(academicYear: string) {
    return apiClient.get<{
      academic_year: string;
      session_id: string | null;
      is_active: boolean;
      counts: { classes: number; students_enrolled: number; subjects: number };
      finance: { billed: number; collected: number; outstanding: number } | null;
      attendance: { present: number; late: number; absent: number; excused: number; rate: number } | null;
      classes: Array<{
        id: string; name: string; level: string | null; section: string | null; enrolled: number;
        class_teacher: string | null;
        results: { students: number; average: number | null; top_student: string | null; top_average: number | null };
      }>;
      results: { students: number; average: number | null; classes_with_results: number; terms: string[] } | null;
      publications: any[];
      promotions: any[];
      examinations: any[];
    }>(`/api/v1/school-config/archive/${encodeURIComponent(academicYear)}`);
  },

  /**
   * Per-student history across all years (Academic Archive drill-down).
   * Accepts an admission number or a name; several name matches come back in
   * `matches` so the user can pick one.
   */
  async getStudentHistory(query: string) {
    return apiClient.get<StudentHistory>(`/api/v1/school-config/archive/student/${encodeURIComponent(query)}`);
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
      data: CarryForwardCounts & {
        sessionId: string;
        created: boolean;
        previousYearName: string | null;
        carriedForward: boolean;
      };
    }>('/api/v1/school-config/start-new-year', payload);
  },

  /** Bring last year's classes, setup and active students into the current year (idempotent). */
  async carryForwardIntoCurrentYear() {
    return apiClient.post<CarryForwardCounts & { fromYear: string | null; toYear: string | null }>(
      '/api/v1/school-config/carry-forward',
    );
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
