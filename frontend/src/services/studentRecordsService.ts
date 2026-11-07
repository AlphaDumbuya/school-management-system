/**
 * Student records: completing the records of students enrolled before the system.
 * Staff side: /api/v1/student-records. Parent side (no login): /api/v1/public/student-update/:token.
 */
import type { AxiosRequestConfig } from 'axios';
import type { ApiResponse } from '@appTypes/index';
import { apiClient } from '@lib/apiClient';

export interface RecordField {
  key: string;
  label: string;
  type: 'text' | 'long' | 'date' | 'gender' | 'phone' | 'email';
  required?: boolean;
  placeholder?: string;
  /** Short explanation shown under the field. */
  help?: string;
  /** Why a required field is needed; shown in the error when it is left empty. */
  why?: string;
  group: 'child' | 'guardian' | 'emergency';
}
export type RecordValues = Record<string, string>;

export interface RecordRow {
  id: string;
  student_id: string;
  name: string;
  class_id: string | null;
  class_name: string | null;
  guardian_name: string;
  guardian_phone: string;
  guardian_email: string;
  missing: string[];
  percent: number;
  has_photo: boolean;
  has_link: boolean;
  link_opened: boolean;
  link_expires_at: string | null;
  pending_update_id: string | null;
}
export interface RecordsList {
  summary: { students: number; complete: number; incomplete: number; no_photo: number; pending_updates: number; average_percent: number };
  total: number;
  page: number;
  limit: number;
  items: RecordRow[];
}
export interface RecordLink {
  student_id: string;
  admission_no: string;
  name: string;
  class_name: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_email: string;
  url: string;
  expires_at: string;
}
export interface RecordCandidate { id: string; student_id: string; name: string; class_name: string | null }
export interface SharedLink { url: string; expires_at: string | null; created_at: string }
export interface SchoolContact { phone: string | null; email: string | null }
export interface WelcomeMessage { message: string; is_custom: boolean; default_message: string }
/** The school on the parents' pages: its own colour (#RRGGBB) themes the page; the slug opens its admission form. */
export interface PublicSchool { name: string; logo_url: string | null; brand_color?: string | null; slug?: string | null }
export interface SharedForm {
  school: PublicSchool;
  /** The message parents read before the form, with the school's name filled in. */
  welcome: string;
  contact: SchoolContact;
  classes: { id: string; name: string }[];
  fields: RecordField[];
  expires_at: string | null;
}
/** Result of "Is my child registered?": verified only when name, date of birth and a known contact all match. */
export type CheckResult =
  | { verified: false }
  | {
      verified: true;
      /** Short-lived signed pass for the confirm step. */
      session: string;
      student: { first_name: string; last_name: string; class_name: string | null; student_number: string | null };
      fields: RecordField[];
      values: RecordValues;
      missing: string[];
      photo_note: string | null;
      school: PublicSchool;
      contact: SchoolContact;
    };
export interface RecordUpdate {
  id: string;
  /** Short code the parent sees after sending, so the office can find the form. */
  reference: string;
  status: string;
  created_at: string;
  review_note?: string | null;
  source: 'personal' | 'shared' | 'office';
  /** What the parent wrote about who the child is (shared link only). */
  claimed: { name: string; class_name: string | null } | null;
  /** Null until the name matched or the officer chose the student. */
  student: { id: string; student_id?: string; name: string; class_name: string | null } | null;
  candidates: RecordCandidate[];
  changes: { key: string; label: string; current: string; proposed: string }[];
}
export interface RecordDetail {
  id: string;
  student_id: string;
  name: string;
  class_name: string | null;
  photo_url: string | null;
  values: RecordValues;
  missing: string[];
}
export interface PublicRecordForm {
  school: PublicSchool;
  welcome: string;
  contact: SchoolContact;
  student: { first_name: string; last_name: string; class_name: string | null };
  fields: RecordField[];
  values: RecordValues;
  photo_note: string | null;
  expires_at: string;
}

/**
 * apiClient reports a failed request as a VALUE ({ success: false, error }) instead of throwing. These screens are
 * written as "try { await call(); show thank-you } catch { show the error }", so without this a rejected form
 * (rate limit, validation, server error) would still show "Thank you" and clear what the parent typed.
 * Every call below goes through `api`, which throws on a failure so the catch branch really runs.
 */
export class RecordsApiError extends Error {
  status?: number;
  code?: string;
  constructor(message: string, status?: number, code?: string) { super(message); this.name = 'RecordsApiError'; this.status = status; this.code = code; }
}
async function ok<T>(request: Promise<ApiResponse<T>>): Promise<ApiResponse<T>> {
  const r: any = await request;
  if (r && r.success === false) throw new RecordsApiError(String(r.error || 'Something went wrong. Please try again.'), r.statusCode, r.code);
  return r;
}
const api = {
  get: <T,>(url: string, config?: AxiosRequestConfig) => ok(apiClient.get<T>(url, config)),
  post: <T,>(url: string, data?: unknown, config?: AxiosRequestConfig) => ok(apiClient.post<T>(url, data, config)),
  put: <T,>(url: string, data?: unknown, config?: AxiosRequestConfig) => ok(apiClient.put<T>(url, data, config)),
  delete: <T,>(url: string, config?: AxiosRequestConfig) => ok(apiClient.delete<T>(url, config)),
};
/** A readable message from an API failure. */
export function recordsError(e: any, fallback = 'Something went wrong. Please try again.'): string {
  if (e instanceof RecordsApiError) return e.message || fallback;
  const d = e?.response?.data;
  const m = d?.error?.message || (typeof d?.error === 'string' ? d.error : '') || d?.message || '';
  return m || (e?.response ? fallback : 'Could not reach the server. Check your connection and try again.');
}

const base = '/api/v1/student-records';
export const studentRecordsService = {
  meta: () => api.get<{ fields: RecordField[] }>(`${base}/meta`),
  list: (params: Record<string, unknown>) => api.get<RecordsList>(base, { params }),
  detail: (studentId: string) => api.get<RecordDetail>(`${base}/students/${studentId}`),
  saveDirect: (studentId: string, values: RecordValues) => api.put<RecordDetail>(`${base}/students/${studentId}`, values),
  createLinks: (body: { student_ids?: string[]; class_id?: string; only_incomplete?: boolean; days?: number }) =>
    api.post<{ days: number; count: number; links: RecordLink[] }>(`${base}/links`, body),
  updates: (status = 'pending') => api.get<RecordUpdate[]>(`${base}/updates`, { params: { status } }),
  approve: (id: string, overrides?: RecordValues) => api.post(`${base}/updates/${id}/approve`, { overrides }),
  reject: (id: string, note?: string) => api.post(`${base}/updates/${id}/reject`, { note }),
  getWelcome: () => api.get<WelcomeMessage>(`${base}/welcome`),
  setWelcome: (message: string) => api.put<WelcomeMessage>(`${base}/welcome`, { message }),
  sharedLink: () => api.get<SharedLink | null>(`${base}/shared-link`),
  createSharedLink: (days?: number) => api.post<SharedLink>(`${base}/shared-link`, { days }),
  closeSharedLink: () => api.delete(`${base}/shared-link`),
  matchUpdate: (id: string, student_id: string) => api.post(`${base}/updates/${id}/match`, { student_id }),
  setPhoto: (studentId: string, photo_url: string) => api.put(`/api/v1/students/${studentId}`, { photo_url }),

  // Parent side: the school's shared link
  openShared: (token: string) => api.get<SharedForm>(`/api/v1/public/student-update/shared/${encodeURIComponent(token)}`),
  submitShared: (token: string, body: { child_first_name: string; child_last_name: string; class_id?: string; values: RecordValues; website?: string }) =>
    api.post<{ received: boolean; reference: string }>(`/api/v1/public/student-update/shared/${encodeURIComponent(token)}`, body),

  /** "Is my child registered?" (tight rate limit). */
  checkShared: (token: string, body: { child_first_name: string; child_last_name: string; date_of_birth: string; contact: string; website?: string }) =>
    api.post<CheckResult>(`/api/v1/public/student-update/shared/${encodeURIComponent(token)}/check`, body),
  /** The checked parent confirms or corrects the record. */
  submitVerified: (token: string, session: string, values: RecordValues, website = '') =>
    api.post<{ received: boolean; changed: number; still_missing: number; reference: string }>(
      `/api/v1/public/student-update/shared/${encodeURIComponent(token)}/verified`, { session, values, website }),
  // Parent side: a personal link
  open: (token: string) => api.get<PublicRecordForm>(`/api/v1/public/student-update/${encodeURIComponent(token)}`),
  submit: (token: string, values: RecordValues, website = '') =>
    api.post<{ received: boolean; changed: number; still_missing: number; reference: string }>(
      `/api/v1/public/student-update/${encodeURIComponent(token)}`, { values, website }),
};
export default studentRecordsService;
