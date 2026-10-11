/**
 * Demo access: the homepage request form, emailed sign-in links, and the
 * super admin's list of testers (Platform → Demo requests).
 */
import { apiClient } from '@lib/apiClient';
import { API_CONFIG } from '@config/api.config';

export interface DemoRequestInput {
  full_name: string;
  email: string;
  phone: string;
  school_name: string;
  role: string;
  student_count?: string;
  consent_followup: boolean;
  website?: string; // honeypot, left empty by people
}

export interface DemoRequestRow {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  school_name: string;
  role: string;
  student_count: string | null;
  consent_followup: boolean;
  expires_at: string;
  link_expired: boolean;
  request_count: number;
  open_count: number;
  portals_opened: Record<string, number>;
  first_opened_at: string | null;
  last_opened_at: string | null;
  followups_sent: number;
  last_followup_at: string | null;
  notes: string | null;
  created_at: string;
  converted_tenant_id?: string | null;
  converted_school?: string | null;
  events?: Array<{ id: string; kind: string; portal: string | null; note: string | null; by_name?: string; created_at: string }>;
}

export const DEMO_ROLES: Array<{ value: string; label: string }> = [
  { value: 'owner', label: 'School owner / proprietor' },
  { value: 'principal', label: 'Principal / head teacher' },
  { value: 'administrator', label: 'Administrator' },
  { value: 'bursar', label: 'Bursar / accountant' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'other', label: 'Other' },
];
export const DEMO_STUDENT_COUNTS = ['under 200', '200-600', '600-1500', 'over 1500'];

const base = '/api/v1/platform/demo-requests';

export const demoService = {
  request: (body: DemoRequestInput) => apiClient.post<{ ok: boolean; email?: string }>('/api/v1/public/demo/request', body),

  /** Exchange an emailed link for a demo session; stores the tokens like any sign-in. */
  async startSession(token: string, portal: string) {
    const res: any = await apiClient.post('/api/v1/public/demo/session', { token, portal });
    const d = res?.data;
    if (res?.success && d?.accessToken && d?.user) {
      localStorage.setItem('accessToken', d.accessToken);
      if (d.refreshToken) localStorage.setItem('refreshToken', d.refreshToken);
      localStorage.setItem('user', JSON.stringify(d.user));
    }
    return res as { success: boolean; data?: { user: any; demo?: { name: string; portal: string } }; error?: any; code?: string };
  },

  list: (params: { search?: string; filter?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])).toString();
    return apiClient.get<any>(`${base}${qs ? `?${qs}` : ''}`) as Promise<any>;
  },
  get: (id: string) => apiClient.get<DemoRequestRow>(`${base}/${id}`) as Promise<any>,
  resend: (id: string) => apiClient.post<{ sent: boolean }>(`${base}/${id}/resend`) as Promise<any>,
  saveNotes: (id: string, notes: string) => apiClient.put<DemoRequestRow>(`${base}/${id}/notes`, { notes }) as Promise<any>,
  remove: (id: string) => apiClient.delete<{ removed: boolean }>(`${base}/${id}`) as Promise<any>,
  followUp: (ids: string[], subject: string, message: string) =>
    apiClient.post<{ sent: number; skipped: number; failed: number }>(`${base}/follow-up`, { ids, subject, message }) as Promise<any>,

  async downloadCsv(): Promise<boolean> {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`${API_CONFIG.baseURL}${base}/export.csv`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    if (!res.ok) return false;
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = `wiskul-demo-requests-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  },
};

export default demoService;
